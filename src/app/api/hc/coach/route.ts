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

import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, hcAudit, requireUser } from "@/lib/hc/server";
import { syncOwner } from "@/lib/hc/calendar-sync";

export const runtime = "nodejs";

/**
 * How long each measurement takes, and the only place that says so.
 *
 * The page adds these up to show a total; the endpoint adds them up again to
 * decide what actually goes in the diary. Two readings of one table rather
 * than the server trusting a number the page sent.
 */
const MEASURE_MINUTES: Record<string, number> = {
  bloodpressure: 10,
  bodycomp: 5,
  vo2max: 30,
  strength: 20,
};

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
  const [me, others, thread, booked, used, where] = await Promise.all([
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
    /*
     * Where a measurement happens, and what the site says about coming to
     * it. Booked into the diary with no address is a booking you have to
     * ask somebody about.
     */
    journey.location_id
      ? supabaseAdmin.from("hc_locations")
          .select("name, measurement_site, measurement_address, measurement_info")
          .eq("id", journey.location_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const allowance = journey.video_consults_per_month ?? 2;
  const spent = used.count ?? 0;

  return NextResponse.json({
    journeyId: journey.id,
    place: where.data
      ? {
          site: (where.data as Record<string, string | null>).measurement_site ?? null,
          address: (where.data as Record<string, string | null>).measurement_address ?? null,
          info: (where.data as Record<string, string | null>).measurement_info ?? null,
        }
      : null,
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
    if (!["video", "measurement"].includes(kind)) {
      return NextResponse.json({ error: "bad_kind" }, { status: 400 });
    }
    /*
     * A measurement visit is a list, and its length is its duration.
     *
     * Minutes are summed here rather than taken from the page: the page can
     * show whatever it likes, but what goes in the diary — and in the
     * coach's day — has to come from the same table the page read.
     */
    const items: string[] = kind === "measurement"
      ? [...new Set((Array.isArray(body.items) ? (body.items as unknown[]) : []).map((x) => String(x)))]
        .filter((x) => Object.hasOwn(MEASURE_MINUTES, x))
      : [];
    if (kind === "measurement" && !items.length) {
      return NextResponse.json({ error: "no_items" }, { status: 400 });
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
      kind, starts_at: when.toISOString(), items,
      minutes: kind === "video" ? 30 : items.reduce((n, k) => n + (MEASURE_MINUTES[k] ?? 0), 0),
      note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
    }).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await hcAudit("client", "booking_created", journey.id, { kind, starts_at: when.toISOString() });
    /*
     * Both calendars, after the response.
     *
     * The coach's copy is the one that asks Google for the Meet link and
     * writes it back onto the booking, so it has to run too — syncing only
     * the client would put the call in their calendar with no way to join
     * it. after(), not a bare void: a promise still running when the
     * response returns is killed with the invocation on Vercel.
     */
    after(async () => {
      await syncOwner("client", user.id).catch(() => {});
      if (journey.coach_id) await syncOwner("worker", journey.coach_id).catch(() => {});
    });
    return NextResponse.json({ ok: true, id: data?.id });
  }

  /* ── Move one ───────────────────────────────────────────────────────────
   *
   * Cancel-and-rebook was the only way to change a time, which loses the
   * booking's identity: a video call would be counted against the monthly
   * allowance twice, and the pair of calendar events would churn. Moving
   * keeps the row and sends the new time to both calendars.
   *
   * No allowance check, deliberately — the consult was already spent, and
   * moving it must not be refused by the rule that granted it.
   */
  if (typeof body.move === "string" && typeof body.starts_at === "string") {
    const when = new Date(body.starts_at);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
      return NextResponse.json({ error: "bad_time" }, { status: 400 });
    }
    const { data: moved, error } = await supabaseAdmin.from("hc_bookings")
      .update({ starts_at: when.toISOString(), updated_at: new Date().toISOString() })
      .eq("id", body.move).eq("client_id", user.id).neq("status", "cancelled")
      .select("id, kind").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!moved) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await hcAudit("client", "booking_moved", journey.id, { id: body.move, starts_at: when.toISOString() });
    after(async () => {
      await syncOwner("client", user.id).catch(() => {});
      if (journey.coach_id) await syncOwner("worker", journey.coach_id).catch(() => {});
    });
    return NextResponse.json({ ok: true });
  }

  // ── Cancel one ────────────────────────────────────────────────────────
  if (typeof body.cancel === "string") {
    await supabaseAdmin.from("hc_bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", body.cancel).eq("client_id", user.id);
    // A cancelled booking has to leave both calendars, or it sits there
    // looking like it is still happening.
    after(async () => {
      await syncOwner("client", user.id).catch(() => {});
      if (journey.coach_id) await syncOwner("worker", journey.coach_id).catch(() => {});
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "no_action" }, { status: 400 });
}
