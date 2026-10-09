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

  // ?pillar=exercise returns that pillar's whole week instead of one day —
  // the pillar tabs show the week, Today shows the day.
  const pillar = req.nextUrl.searchParams.get("pillar");

  const week = await resolveWeek(user.id, isoToday());
  const dow = dowOf(new Date(`${day}T12:00:00`));
  const byOrder = (a: { sortOrder: number; label: string }, b: { sortOrder: number; label: string }) =>
    a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "is");

  const forDay = week.filter((a) => a.dayOfWeek === dow);
  const actions = (await withCompletions(user.id, day, forDay)).sort(byOrder);

  let pillarWeek: { dow: number; actions: typeof week }[] | undefined;
  if (pillar) {
    const mine = week.filter((a) => a.pillar === pillar);
    // Completions are per date, so only today's row can show a tick; the
    // other days are the plan, not a history.
    const todayDone = await withCompletions(user.id, day, mine.filter((a) => a.dayOfWeek === dow));
    const doneKeys = new Set(todayDone.filter((a) => a.done).map((a) => a.actionKey));
    pillarWeek = Array.from({ length: 7 }, (_, i) => ({
      dow: i,
      actions: mine
        .filter((a) => a.dayOfWeek === i)
        .map((a) => ({ ...a, done: i === dow && doneKeys.has(a.actionKey) }))
        .sort(byOrder),
    }));
  }

  return NextResponse.json({
    day,
    dow,
    actions,
    pillarWeek,
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

    // Recompute the meters Heim reads. Awaited, unlike the app.
    //
    // api.ts:2695 fires this without waiting, which is fine in a long-lived
    // React Native process. In a serverless function the response returns and
    // the instance freezes, so an un-awaited call simply never runs: verified
    // live — the tick persisted, points were awarded, and consistency_score
    // stayed 0 until the RPC was invoked by hand, which moved it to 4/14/100.
    // It costs a few milliseconds and it is the whole point of ticking.
    const { error: meterErr } = await supabaseAdmin.rpc("refresh_user_meters", { p_client_id: user.id });
    // A failed refresh must not fail the tick — the completion is already
    // written, and the meters are recomputed on the next one.
    if (meterErr) console.error("refresh_user_meters failed", meterErr.message);
  }

  return NextResponse.json({ ok: true });
}
