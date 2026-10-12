// A client's video calls and measurement visits, for the coach.
//
// GET    → this journey's bookings, soonest first
// POST   → book one on the client's behalf
// PATCH  → move one, or cancel it
//
// The workstation diary already showed these (agenda, calendar/events), but
// only as blocks of busy time: opening a client told you nothing about what
// they had booked, and there was no way to move or cancel it from here. A
// coach reading "10:30 is taken" in the diary and then having to ring the
// client to change it is the gap this closes.
//
// Writes the same hc_bookings rows the participant's own Þjálfari page
// writes, through the same shared rules (lib/hc/bookings), so neither side
// can disagree about what a measurement is called or how long it takes.
//
// Auth: workstation actor, and the journey must be at a location they may
// see — the same gate as as-client.

import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hcAudit } from "@/lib/hc/server";
import { syncOwner } from "@/lib/hc/calendar-sync";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { bookingItems, bookingMinutes, isBookingKind } from "@/lib/hc/bookings";

export const runtime = "nodejs";

async function visible(req: NextRequest, journeyId: string) {
  const actor = await getHcActor(req);
  if (!actor) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  let q = supabaseAdmin.from("hc_journeys")
    .select("id, client_id, coach_id, location_id")
    .eq("id", journeyId);
  const locs = actorLocationFilter(actor);
  if (locs !== null) {
    if (locs.length === 0) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
    q = q.in("location_id", locs);
  }
  const { data } = await q.maybeSingle<{ id: string; client_id: string; coach_id: string | null; location_id: string | null }>();
  if (!data) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  const who = actor.kind === "staff" ? `staff:${actor.staffId}` : `worker:${actor.worker.id}`;
  return { actor, journey: data, who };
}

/**
 * Both calendars, after the response, coach first.
 *
 * The order is not cosmetic: only the coach's sync asks Google for the
 * conference and writes the link back onto the booking, so syncing the
 * participant first writes their event while meeting_url is still null —
 * their copy gets no Meet link and nothing comes back to fix it. The
 * participant route learned this the hard way; this one inherits the
 * lesson rather than repeating it.
 *
 * after(), not a bare void: a promise still running when the response
 * returns is killed with the invocation on Vercel, so the sync would simply
 * never happen.
 */
function syncBoth(coachId: string | null, clientId: string) {
  after(async () => {
    if (coachId) await syncOwner("worker", coachId).catch(() => {});
    await syncOwner("client", clientId).catch(() => {});
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const got = await visible(req, id);
  if ("error" in got) return got.error;

  const { data } = await supabaseAdmin.from("hc_bookings")
    .select("id, kind, items, starts_at, minutes, status, meeting_url, note, coach_id, created_at")
    .eq("journey_id", got.journey.id)
    .order("starts_at", { ascending: true });

  return NextResponse.json({ bookings: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const got = await visible(req, id);
  if ("error" in got) return got.error;
  const { journey, who } = got;
  const body = await req.json().catch(() => ({}));

  if (!isBookingKind(body.kind)) return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  const items = bookingItems(body.kind, body.items);
  if (body.kind === "measurement" && !items.length) {
    return NextResponse.json({ error: "no_items" }, { status: 400 });
  }
  const when = new Date(String(body.starts_at));
  if (Number.isNaN(when.getTime())) return NextResponse.json({ error: "bad_time" }, { status: 400 });

  /*
   * The monthly video allowance is NOT applied here, deliberately.
   *
   * It exists to stop a client booking more of a coach's time than their
   * plan includes. A coach offering a call is already the person whose time
   * it is, so the limit has nothing to protect — and a coach blocked from
   * booking a call they just promised in the chat would be the system
   * arguing with its own user. The client's count is unaffected either way,
   * so this cannot quietly spend their allowance.
   */
  const { data, error } = await supabaseAdmin.from("hc_bookings").insert({
    journey_id: journey.id, client_id: journey.client_id,
    coach_id: journey.coach_id ?? null,
    kind: body.kind, starts_at: when.toISOString(), items,
    minutes: bookingMinutes(body.kind, items),
    note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
  }).select("id, kind, items, starts_at, minutes, status, meeting_url, note").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await hcAudit(who, "coach_booking_created", journey.id, { kind: body.kind, starts_at: when.toISOString(), items });
  syncBoth(journey.coach_id, journey.client_id);
  return NextResponse.json({ booking: data });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const got = await visible(req, id);
  if ("error" in got) return got.error;
  const { journey, who } = got;
  const body = await req.json().catch(() => ({}));

  const bookingId = String(body.booking_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  /* Scoped to this journey, so a booking id from elsewhere cannot be moved
     by someone who happens to be allowed to see this client. */
  const { data: existing } = await supabaseAdmin.from("hc_bookings")
    .select("id, kind, items, starts_at, status")
    .eq("id", bookingId).eq("journey_id", journey.id).maybeSingle<{
      id: string; kind: string; items: unknown; starts_at: string; status: string;
    }>();
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let action = "coach_booking_updated";

  if (body.cancel === true) {
    patch.status = "cancelled";
    action = "coach_booking_cancelled";
  } else if (typeof body.starts_at === "string") {
    const when = new Date(body.starts_at);
    if (Number.isNaN(when.getTime())) return NextResponse.json({ error: "bad_time" }, { status: 400 });
    patch.starts_at = when.toISOString();
    /* Reviving a cancelled booking by moving it would be a surprise; moving
       a live one is the ordinary case. */
    if (existing.status === "cancelled") return NextResponse.json({ error: "cancelled" }, { status: 409 });
    action = "coach_booking_moved";
  } else if (typeof body.note === "string") {
    patch.note = body.note.slice(0, 500) || null;
  } else {
    return NextResponse.json({ error: "nothing_to_do" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("hc_bookings")
    .update(patch).eq("id", bookingId).eq("journey_id", journey.id)
    .select("id, kind, items, starts_at, minutes, status, meeting_url, note").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await hcAudit(who, action, journey.id, { booking_id: bookingId, from: existing.starts_at, to: patch.starts_at ?? null });
  syncBoth(journey.coach_id, journey.client_id);
  return NextResponse.json({ booking: data });
}
