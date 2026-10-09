// The Þjálfari surface in one endpoint: who your coach is, who else you
// could have, the thread between you, what the month still holds and what
// is booked.
//
// One request rather than five, because the page shows all of it at once
// and five round trips on a phone is five chances to see a half-drawn page.
//
// Reads and writes go through the service role: hc_chat and hc_bookings are
// blocked to the client by RLS, which is the house pattern for clinical
// tables here. Every query is scoped to the caller's own journey.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, hcAudit, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

const WORKER_COLS = "id, name, role, organization, credentials, bio, photo_url, specialties, accepting_clients, active";

/** First and last instant of the month a date falls in, in UTC. */
function monthBounds(now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { from, to } = monthBounds();
  const [me, others, thread, booked, used] = await Promise.all([
    journey.coach_id
      ? supabaseAdmin.from("hc_workers").select(WORKER_COLS).eq("id", journey.coach_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Who you could switch to. Someone at capacity is left out rather than
    // offered and then refused.
    supabaseAdmin.from("hc_workers").select(WORKER_COLS)
      .eq("active", true).eq("accepting_clients", true).order("name"),
    supabaseAdmin.from("hc_chat_decrypted").select("*")
      .eq("journey_id", journey.id).order("created_at", { ascending: true }).limit(200),
    supabaseAdmin.from("hc_bookings").select("*")
      .eq("client_id", user.id).neq("status", "cancelled")
      .gte("starts_at", new Date().toISOString()).order("starts_at").limit(20),
    // The allowance is per calendar month and counts what was booked in it,
    // kept or not — a call someone booked and did not attend has been spent.
    supabaseAdmin.from("hc_bookings").select("id", { count: "exact", head: true })
      .eq("client_id", user.id).eq("kind", "video").neq("status", "cancelled")
      .gte("starts_at", from).lt("starts_at", to),
  ]);

  const allowance = journey.video_consults_per_month ?? 2;
  const spent = used.count ?? 0;

  return NextResponse.json({
    journeyId: journey.id,
    coach: me.data ?? null,
    coaches: (others.data ?? []).filter((w) => w.id !== journey.coach_id),
    thread: thread.data ?? [],
    unread: (thread.data ?? []).filter((m) => m.author_kind === "coach" && !m.read_by_client_at).length,
    bookings: booked.data ?? [],
    consults: { allowance, spent, left: Math.max(0, allowance - spent) },
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  // ── Say something ─────────────────────────────────────────────────────
  if (typeof body.send === "string") {
    const text = body.send.trim().slice(0, 4000);
    if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
    const { error } = await supabaseAdmin.from("hc_chat_decrypted").insert({
      journey_id: journey.id, client_id: user.id,
      author_kind: "client", author_id: user.id, body: text,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Mark the coach's messages read ────────────────────────────────────
  if (body.seen) {
    await supabaseAdmin.from("hc_chat").update({ read_by_client_at: new Date().toISOString() })
      .eq("journey_id", journey.id).eq("author_kind", "coach").is("read_by_client_at", null);
    return NextResponse.json({ ok: true });
  }

  // ── Change coach ──────────────────────────────────────────────────────
  if (typeof body.coach_id === "string") {
    // Only to somebody who is actually taking clients, checked here rather
    // than trusted from the page.
    const { data: w } = await supabaseAdmin.from("hc_workers")
      .select("id, name").eq("id", body.coach_id).eq("active", true).eq("accepting_clients", true).maybeSingle();
    if (!w) return NextResponse.json({ error: "unavailable" }, { status: 400 });
    await supabaseAdmin.from("hc_journeys")
      .update({ coach_id: w.id, coach_changed_at: new Date().toISOString() }).eq("id", journey.id);
    await hcAudit("client", "coach_changed", journey.id, { to: w.id });
    return NextResponse.json({ ok: true, coach_id: w.id });
  }

  // ── Book something ────────────────────────────────────────────────────
  if (typeof body.kind === "string" && typeof body.starts_at === "string") {
    const kind = body.kind;
    if (!["video", "measurement", "vo2max", "strength"].includes(kind)) {
      return NextResponse.json({ error: "bad_kind" }, { status: 400 });
    }
    const when = new Date(body.starts_at);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
      return NextResponse.json({ error: "bad_time" }, { status: 400 });
    }
    // The allowance is enforced here, not only shown. A page that hides the
    // button is a page, not a rule.
    if (kind === "video") {
      const { from, to } = monthBounds(when);
      const { count } = await supabaseAdmin.from("hc_bookings").select("id", { count: "exact", head: true })
        .eq("client_id", user.id).eq("kind", "video").neq("status", "cancelled")
        .gte("starts_at", from).lt("starts_at", to);
      if ((count ?? 0) >= (journey.video_consults_per_month ?? 2)) {
        return NextResponse.json({ error: "no_consults_left" }, { status: 409 });
      }
    }
    const { data, error } = await supabaseAdmin.from("hc_bookings").insert({
      journey_id: journey.id, client_id: user.id, coach_id: journey.coach_id ?? null,
      kind, starts_at: when.toISOString(),
      minutes: kind === "video" ? 30 : kind === "vo2max" ? 60 : 30,
      note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
    }).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await hcAudit("client", "booking_created", journey.id, { kind, starts_at: when.toISOString() });
    return NextResponse.json({ ok: true, id: data?.id });
  }

  // ── Cancel one ────────────────────────────────────────────────────────
  if (typeof body.cancel === "string") {
    await supabaseAdmin.from("hc_bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", body.cancel).eq("client_id", user.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "no_action" }, { status: 400 });
}
