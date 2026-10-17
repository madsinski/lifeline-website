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
/* Shared with the coach's own booking route, so the two cannot disagree
   about what a measurement is called or how long it takes. */
import { bookingItems, bookingMinutes, isBookingKind, monthBounds } from "@/lib/hc/bookings";
import {
  coachingAccess, coachingEligibility, coachingPackage, coachingRemaining,
  isDate, measurementBlockedUntil, nextMonthStart, type CoachingAccess,
} from "@/lib/hc/coaching";
import { WEEKDAY_DAT_PL } from "@/lib/hc/coaching-config";
import { requestView } from "@/lib/hc/coaching-requests";
import type { HcJourney } from "@/lib/hc/types";

export const runtime = "nodejs";

/*
 * ── Who gets the coach (src/lib/hc/coaching.ts) ─────────────────────
 *
 * The app tier alone has nobody on the other end. GET answers with
 * `access.ok = false` and the coaching offer instead of the thread, and
 * POST refuses to send or book (403 'no_coaching'). Health-check / B2B
 * participants ("care") and coaching-track people already in a
 * conversation before the tier ("grandfathered") keep the old rules: the
 * journey's own video allowance, any weekday. "Lifeline þjálfun"
 * subscribers ("coaching") get the tier's quotas from hc_packages.quota,
 * enforced here: video check-ins per calendar month, one measurement per N
 * months, and bookings only on the coach's service day.
 */

/** The video allowance under these rules. */
function videoAllowance(a: CoachingAccess, journey: HcJourney): number {
  return a.mode === "coaching" ? a.quota.video_per_month : (journey.video_consults_per_month ?? 2);
}

/** A refusal the page can show as it is. */
const refuse = (error: string, message: string, status: number) =>
  NextResponse.json({ error, message }, { status });

const WORKER_COLS = "id, name, role, organization, credentials, bio, photo_url, specialties, accepting_clients, active";

/**
 * Keep hc_journeys.measurements_booked_for in step with the participant's
 * own measurement bookings: the earliest upcoming one that is not
 * cancelled, or null. A direct update, not patchJourney: the booking itself
 * already goes to the calendars, and the journey field would add a second
 * event for the same visit.
 */
async function syncMeasurementBooking(journeyId: string, clientId: string) {
  const { data } = await supabaseAdmin.from("hc_bookings").select("starts_at")
    .eq("journey_id", journeyId).eq("client_id", clientId).eq("kind", "measurement")
    .neq("status", "cancelled").gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true }).limit(1).maybeSingle();
  await supabaseAdmin.from("hc_journeys")
    .update({ measurements_booked_for: data?.starts_at ?? null, updated_at: new Date().toISOString() })
    .eq("id", journeyId).then(() => {}, () => {});
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const access = await coachingAccess(user.id, journey);
  if (!access.ok) {
    /* The offer instead of the thread: whether it can be bought here, and for how much. */
    const [pkg, el, request] = await Promise.all([coachingPackage(), coachingEligibility(user.id), requestView(user.id)]);
    return NextResponse.json({
      journeyId: journey.id,
      access: {
        ok: false, mode: access.mode,
        offer: {
          available: pkg.in_catalogue && el.eligible, eligible: el.eligible, reason: el.reason,
          price_isk: pkg.price_isk, name: pkg.name, includes: pkg.includes,
          service_weekday: pkg.quota.service_weekday,
          /* Approved by Lifeline before payment (src/lib/hc/coaching-requests.ts). */
          request,
        },
      },
      coach: null, coaches: [], thread: [], unread: 0, bookings: [],
      consults: { allowance: 0, spent: 0, left: 0 }, place: null,
    });
  }

  const { from, to } = monthBounds();
  const [me, others, thread, booked, used, where, remaining] = await Promise.all([
    journey.coach_id
      ? supabaseAdmin.from("hc_workers").select(WORKER_COLS).eq("id", journey.coach_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Who you could switch to. Someone at capacity is left out rather than
    // offered and then refused.
    supabaseAdmin.from("hc_workers").select(WORKER_COLS)
      .eq("active", true).eq("accepting_clients", true).order("name"),
    supabaseAdmin.from("hc_chat_decrypted").select("*")
      .eq("journey_id", journey.id).order("created_at", { ascending: true }).limit(200),
    /* Shop bookings (hc_bookings.order_id: a bought measurement or the
       doctor's interview) are managed on Þjónusta, /api/hc/shop/book. */
    supabaseAdmin.from("hc_bookings").select("*")
      .eq("client_id", user.id).neq("status", "cancelled").is("order_id", null)
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
    access.mode === "coaching" ? coachingRemaining(user.id, access.quota) : Promise.resolve(null),
  ]);

  const allowance = videoAllowance(access, journey);
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
    access: {
      ok: true,
      mode: access.mode,
      /* Only the coaching tier is held to a day, a call length and a measurement interval. */
      service_weekday: access.mode === "coaching" ? access.quota.service_weekday : null,
      video_minutes: access.mode === "coaching" ? access.quota.video_minutes : null,
      measurement_every_months: access.mode === "coaching" ? access.quota.measurement_every_months : null,
      measurement_next_at: remaining?.measurement_next_at ?? null,
      next_video_from: access.mode === "coaching" ? nextMonthStart().toISOString() : null,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  /*
   * Reading, moving and cancelling what already exists is always allowed —
   * a booking made before somebody downgraded must still be movable. Saying
   * something new, booking, or picking a coach needs coaching access.
   */
  const needsCoach = typeof body.send === "string" || typeof body.coach_id === "string"
    || (typeof body.kind === "string" && typeof body.starts_at === "string");
  const access = needsCoach || typeof body.move === "string" ? await coachingAccess(user.id, journey) : null;
  if (needsCoach && !access?.ok) {
    return refuse("no_coaching", "Skilaboð og bókanir fylgja Lifeline þjálfun og heilsufarsskoðun.", 403);
  }

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
    const { error } = await supabaseAdmin.from("hc_journeys")
      .update({ coach_id: w.id, coach_changed_at: new Date().toISOString() }).eq("id", journey.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await hcAudit("client", "coach_changed", journey.id, { to: w.id });
    return NextResponse.json({ ok: true, coach_id: w.id });
  }

  // ── Book something ────────────────────────────────────────────────────
  if (typeof body.kind === "string" && typeof body.starts_at === "string") {
    const kind = body.kind;
    if (!isBookingKind(kind)) {
      return NextResponse.json({ error: "bad_kind" }, { status: 400 });
    }
    /*
     * A measurement visit is a list, and its length is its duration.
     *
     * Minutes are summed here rather than taken from the page: the page can
     * show whatever it likes, but what goes in the diary — and in the
     * coach's day — has to come from the same table the page read.
     */
    const items = bookingItems(kind, body.items);
    if (kind === "measurement" && !items.length) {
      return NextResponse.json({ error: "no_items" }, { status: 400 });
    }
    const when = new Date(body.starts_at);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
      return NextResponse.json({ error: "bad_time" }, { status: 400 });
    }
    const tier = access!.mode === "coaching" ? access!.quota : null;
    // The coaching tier is served one day a week (Iceland keeps UTC all year).
    if (tier && when.getUTCDay() !== tier.service_weekday) {
      return refuse("not_service_day", `Tímar eru bókaðir á ${WEEKDAY_DAT_PL[tier.service_weekday]}, þjónustudegi vikunnar.`, 400);
    }
    // The allowance is enforced here, not only shown. A page that hides the
    // button is a page, not a rule.
    if (kind === "video") {
      const { from, to } = monthBounds(when);
      const { count } = await supabaseAdmin.from("hc_bookings").select("id", { count: "exact", head: true })
        .eq("client_id", user.id).eq("kind", "video").neq("status", "cancelled")
        .gte("starts_at", from).lt("starts_at", to);
      if ((count ?? 0) >= videoAllowance(access!, journey)) {
        if (tier) {
          const next = nextMonthStart(when);
          return refuse("no_consults_left", `Myndsamtal mánaðarins hefur verið bókað. Næst er hægt að bóka tíma frá ${isDate(next)}.`, 409);
        }
        return NextResponse.json({ error: "no_consults_left" }, { status: 409 });
      }
    }
    if (kind === "measurement" && tier) {
      const blocked = await measurementBlockedUntil(user.id, when, tier.measurement_every_months);
      if (blocked) {
        return refuse("no_measurements_left",
          `Ein mæling er innifalin á ${tier.measurement_every_months} mánaða fresti. Næst er hægt að bóka mælingu frá ${isDate(blocked)}.`, 409);
      }
    }
    const { data, error } = await supabaseAdmin.from("hc_bookings").insert({
      journey_id: journey.id, client_id: user.id, coach_id: journey.coach_id ?? null,
      kind, starts_at: when.toISOString(), items,
      minutes: kind === "video" && tier ? tier.video_minutes : bookingMinutes(kind, items),
      note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
    }).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await hcAudit("client", "booking_created", journey.id, { kind, starts_at: when.toISOString() });
    if (kind === "measurement") await syncMeasurementBooking(journey.id, user.id);
    /*
     * Both calendars, after the response.
     *
     * The coach's copy is the one that asks Google for the Meet link and
     * writes it back onto the booking, so it has to run too — syncing only
     * the client would put the call in their calendar with no way to join
     * it. after(), not a bare void: a promise still running when the
     * response returns is killed with the invocation on Vercel.
     */
    /*
     * Coach first, then participant. The order is the whole point.
     *
     * Only the coach's sync asks Google for the conference, and it writes
     * the link back onto the booking. Syncing the participant first wrote
     * their event while meeting_url was still null — so their copy had no
     * Meet link and nothing ever came back to fix it. Mads opened the
     * 12 October call on his phone and found exactly that: a link on the
     * coach's calendar and none on his own.
     */
    after(async () => {
      if (journey.coach_id) await syncOwner("worker", journey.coach_id).catch(() => {});
      await syncOwner("client", user.id).catch(() => {});
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
    // Moved, it still has to land on the service day.
    if (access?.mode === "coaching" && when.getUTCDay() !== access.quota.service_weekday) {
      return refuse("not_service_day", `Tímar eru bókaðir á ${WEEKDAY_DAT_PL[access.quota.service_weekday]}, þjónustudegi vikunnar.`, 400);
    }
    const { data: moved, error } = await supabaseAdmin.from("hc_bookings")
      .update({ starts_at: when.toISOString(), updated_at: new Date().toISOString() })
      .eq("id", body.move).eq("client_id", user.id).neq("status", "cancelled")
      /* A shop booking holds a published slot; it is moved by rebooking there. */
      .is("order_id", null)
      .select("id, kind").maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!moved) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await hcAudit("client", "booking_moved", journey.id, { id: body.move, starts_at: when.toISOString() });
    if (moved.kind === "measurement") await syncMeasurementBooking(journey.id, user.id);
    /*
     * Coach first, then participant. The order is the whole point.
     *
     * Only the coach's sync asks Google for the conference, and it writes
     * the link back onto the booking. Syncing the participant first wrote
     * their event while meeting_url was still null — so their copy had no
     * Meet link and nothing ever came back to fix it. Mads opened the
     * 12 October call on his phone and found exactly that: a link on the
     * coach's calendar and none on his own.
     */
    after(async () => {
      if (journey.coach_id) await syncOwner("worker", journey.coach_id).catch(() => {});
      await syncOwner("client", user.id).catch(() => {});
    });
    return NextResponse.json({ ok: true });
  }

  // ── Cancel one ────────────────────────────────────────────────────────
  if (typeof body.cancel === "string") {
    // Checked, so a cancel that did not happen is never answered "ok" and
    // the booking does not stay in the diary while the page says it went.
    const { data: gone, error } = await supabaseAdmin.from("hc_bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", body.cancel).eq("client_id", user.id).is("order_id", null).select("id, kind");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!gone?.length) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (gone.some((g) => g.kind === "measurement")) await syncMeasurementBooking(journey.id, user.id);
    // A cancelled booking has to leave both calendars, or it sits there
    // looking like it is still happening.
    /*
     * Coach first, then participant. The order is the whole point.
     *
     * Only the coach's sync asks Google for the conference, and it writes
     * the link back onto the booking. Syncing the participant first wrote
     * their event while meeting_url was still null — so their copy had no
     * Meet link and nothing ever came back to fix it. Mads opened the
     * 12 October call on his phone and found exactly that: a link on the
     * coach's calendar and none on his own.
     */
    after(async () => {
      if (journey.coach_id) await syncOwner("worker", journey.coach_id).catch(() => {});
      await syncOwner("client", user.id).catch(() => {});
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "no_action" }, { status: 400 });
}
