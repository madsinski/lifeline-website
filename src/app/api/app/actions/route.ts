// The day's actions, and ticking them off.
//
// GET  ?day=YYYY-MM-DD  → that day's resolved actions, with done state
// POST { actionKey, date, status } → upsert a completion
//
// The write path mirrors api.ts:2627 (toggleActionStatus), including its
// anti-cheat rules. That function's own comment says they are "server-enforced
// because the client can be modified" — in the app they run on the device
// with the anon key, so they are not. Here they genuinely are.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";
import { dowOf, resolveWeek, withCompletions } from "@/lib/app/resolve-actions";

export const runtime = "nodejs";

/** api.ts:2660-2663 — the app's own constants. */
const TOGGLE_MIN_GAP_MS = 3000;
const POINTS_PER_ACTION = 3;
const DAILY_POINT_CAP = 100;

const isoToday = () => new Date().toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const day = req.nextUrl.searchParams.get("day") || isoToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "bad day" }, { status: 400 });
  }

  const week = await resolveWeek(user.id, isoToday());
  const dow = dowOf(new Date(`${day}T12:00:00`));
  const forDay = week.filter((a) => a.dayOfWeek === dow);
  const actions = (await withCompletions(user.id, day, forDay)).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "is"),
  );

  return NextResponse.json({
    day,
    dow,
    actions,
    /** Per-day counts for the whole week, so the UI can show a strip. */
    week: Array.from({ length: 7 }, (_, i) => ({
      dow: i,
      count: week.filter((a) => a.dayOfWeek === i).length,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => null);
  const actionKey = typeof body?.actionKey === "string" ? body.actionKey : null;
  const date = typeof body?.date === "string" ? body.date : null;
  const status = body?.status === "done" ? "done" : "todo";
  if (!actionKey || !date) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // Gate 1 — today only. Yesterday's rows are immutable; no backfilling and
  // no completing tomorrow in advance (api.ts:2556).
  if (date !== isoToday()) {
    return NextResponse.json({ error: "wrong-date", message: "Aðeins er hægt að haka við í dag." }, { status: 409 });
  }

  // Gate 2 — 3s between completions. Not applied to undo, so a mistake can
  // always be corrected immediately (api.ts:2650-2653).
  if (status === "done") {
    const { data: recent } = await supabaseAdmin
      .from("action_completions")
      .select("completed_at")
      .eq("client_id", user.id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.completed_at) {
      const gap = Date.now() - new Date(recent.completed_at as string).getTime();
      if (gap < TOGGLE_MIN_GAP_MS) {
        return NextResponse.json(
          { error: "too-fast", message: "Aðeins of hratt — reyndu aftur eftir augnablik." },
          { status: 429 },
        );
      }
    }
  }

  const { error } = await supabaseAdmin.from("action_completions").upsert(
    {
      client_id: user.id,
      action_key: actionKey,
      date,
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
      ...(typeof body?.label === "string" ? { label: body.label } : {}),
    },
    { onConflict: "client_id,action_key,date" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "done") {
    // Points. The app's awardPointsOnce (api.ts:3189) stores its dedup key
    // IN the category column — the comment there says so outright — so the
    // same key is used here and the two surfaces cannot double-award.
    const dedupKey = `action-done-${actionKey}-${date}`;

    const { data: already } = await supabaseAdmin
      .from("lifescore_points")
      .select("id")
      .eq("client_id", user.id)
      .eq("category", dedupKey)
      .limit(1);

    if (!already?.length) {
      // The daily cap, counted the only way the schema allows.
      //
      // The app counts category = 'action', but awardPointsOnce never writes
      // that value — it writes the dedup key. Confirmed against production:
      // zero rows have category = 'action', so the app's 100/day cap has
      // never once fired. Counting the action-done-% rows is what the
      // constant was meant to do, so that is what happens here.
      const { data: todayPts } = await supabaseAdmin
        .from("lifescore_points")
        .select("points")
        .eq("client_id", user.id)
        .like("category", "action-done-%")
        .gte("created_at", `${date}T00:00:00Z`);
      const spent = (todayPts ?? []).reduce((a, p) => a + Number(p.points ?? 0), 0);

      if (spent < DAILY_POINT_CAP) {
        await supabaseAdmin.from("lifescore_points").insert({
          client_id: user.id,
          points: POINTS_PER_ACTION,
          reason: "Completed a daily action",
          category: dedupKey,
        });
        // The app writes the feed row alongside the points (api.ts:3206), and
        // the community feed reads it, so parity matters.
        await supabaseAdmin.from("activity_feed").insert({
          client_id: user.id,
          action: "Completed a daily action",
          points: POINTS_PER_ACTION,
        });
      }
    }

    // Recompute the meters the home screen reads. Fire-and-forget, as the app
    // does — a failed refresh must not fail the tick.
    void supabaseAdmin.rpc("refresh_user_meters", { p_client_id: user.id });
  }

  return NextResponse.json({ ok: true });
}
