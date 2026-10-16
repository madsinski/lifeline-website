// Booking what was bought: a measurement on a Lifeline station slot, or the
// doctor interview on the doctor's day.
//
// GET  ?order_id=          → free slots this order can take, and its booking
// POST { order_id, slot_id } → claims the slot and books it
// POST { cancel: booking_id } → cancels and gives the slot back
//
// Rules, all enforced here rather than on the page:
//   - the order is the caller's own and paid;
//   - a standalone measurement order books a station slot
//     (station_slots); a doctor-interview order, or the health check /
//     re-evaluation (the bundle's doctor interview), books a doctor slot
//     (doctor_slots) on the doctor's day (hc_packages.quota.doctor_weekday on
//     'laeknisvidtal', src/lib/hc/shop.ts);
//   - one active booking per paid order (unique index
//     hc_bookings_order_active_uq);
//   - only a published, free, future slot, claimed atomically (an UPDATE
//     that only matches while client_id is null), so two people can never
//     hold the same time.
//
// The interview itself is held and recorded in Medalia; Lifeline only holds
// the time. Schema: supabase/migration-single-shop.sql.

import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getClientProfile, hcAudit, requireUser } from "@/lib/hc/server";
import { syncOwner } from "@/lib/hc/calendar-sync";
import { canBookDoctor, canBookStation } from "@/lib/hc/shop";
import { doctorConfig, releaseSlot } from "@/lib/hc/shop-server";
import { WEEKDAY_DAT_PL } from "@/lib/hc/coaching-config";

export const runtime = "nodejs";

/** How far ahead a slot can be booked. */
const AHEAD_DAYS = 90;
/** What a standalone measurement is. */
const MEASUREMENT_ITEMS = ["bodycomp", "bloodpressure"];

type BookingKind = "measurement" | "doctor";

interface Order { id: string; journey_id: string; client_id: string; kind: string; status: string }

async function ownPaidOrder(orderId: string, userId: string): Promise<Order | null> {
  const { data } = await supabaseAdmin.from("hc_orders")
    .select("id, journey_id, client_id, kind, status").eq("id", orderId).eq("client_id", userId).maybeSingle();
  return data && data.status === "paid" ? (data as Order) : null;
}

const bookingKindFor = (orderKind: string): BookingKind | null =>
  canBookStation(orderKind) ? "measurement" : canBookDoctor(orderKind) ? "doctor" : null;

interface Slot { id: string; slot_at: string; duration_minutes: number; location: string | null; mode?: string | null }

/** Free, future slots of the kind. Doctor slots only on the doctor's day. */
async function freeSlots(kind: BookingKind, companyId: string | null): Promise<Slot[]> {
  const now = new Date().toISOString();
  const until = new Date(Date.now() + AHEAD_DAYS * 86400_000).toISOString();
  if (kind === "measurement") {
    const { data } = await supabaseAdmin.from("station_slots")
      .select("id, slot_at, duration_minutes, location")
      .is("client_id", null).is("completed_at", null).gt("slot_at", now).lte("slot_at", until)
      .order("slot_at").limit(200);
    return (data ?? []) as Slot[];
  }
  const cfg = await doctorConfig();
  const { data } = await supabaseAdmin.from("doctor_slots")
    .select("id, slot_at, duration_minutes, location, mode, company_id")
    .is("client_id", null).is("completed_at", null).gt("slot_at", now).lte("slot_at", until)
    .order("slot_at").limit(300);
  return ((data ?? []) as (Slot & { company_id: string | null })[])
    /* Slots staff reserved for a company stay that company's. */
    .filter((s) => !s.company_id || s.company_id === companyId)
    .filter((s) => new Date(s.slot_at).getUTCDay() === cfg.doctor_weekday)
    .map(({ company_id: _c, ...s }) => { void _c; return s; });
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const order = await ownPaidOrder(req.nextUrl.searchParams.get("order_id") || "", user.id);
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  const kind = bookingKindFor(order.kind);
  if (!kind) return NextResponse.json({ error: "Þessi vara er ekki bókuð hér." }, { status: 400 });
  const profile = await getClientProfile(user.id);
  const [slots, cfg, { data: current }] = await Promise.all([
    freeSlots(kind, profile?.company_id ?? null),
    doctorConfig(),
    supabaseAdmin.from("hc_bookings").select("id, order_id, kind, starts_at, minutes, status, slot_id")
      .eq("order_id", order.id).eq("kind", kind).neq("status", "cancelled").maybeSingle(),
  ]);
  /* Where the held time is, from its slot. */
  let location: string | null = null;
  if (current?.slot_id) {
    const { data: s } = await supabaseAdmin.from(kind === "doctor" ? "doctor_slots" : "station_slots")
      .select("location").eq("id", current.slot_id).maybeSingle();
    location = s?.location ?? null;
  }
  return NextResponse.json({ kind, slots, doctor_weekday: cfg.doctor_weekday, booking: current ?? null, location });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => ({}));

  // ── Cancel ─────────────────────────────────────────────────────────────
  if (typeof body.cancel === "string") {
    const { data: gone, error } = await supabaseAdmin.from("hc_bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", body.cancel).eq("client_id", user.id).not("order_id", "is", null)
      .neq("status", "cancelled").gt("starts_at", new Date().toISOString())
      .select("id, kind, slot_id, journey_id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!gone?.length) return NextResponse.json({ error: "Bókunin fannst ekki eða er liðin." }, { status: 404 });
    for (const g of gone) await releaseSlot(g.kind, g.slot_id, user.id);
    await hcAudit(`client:${user.id}`, "shop_booking_cancelled", gone[0].journey_id, { booking_id: body.cancel });
    after(async () => { await syncOwner("client", user.id).catch(() => {}); });
    return NextResponse.json({ ok: true });
  }

  // ── Book ───────────────────────────────────────────────────────────────
  const order = await ownPaidOrder(String(body.order_id || ""), user.id);
  if (!order) return NextResponse.json({ error: "Pöntunin fannst ekki." }, { status: 404 });
  const kind = bookingKindFor(order.kind);
  if (!kind) return NextResponse.json({ error: "Þessi vara er ekki bókuð hér." }, { status: 400 });
  const slotId = String(body.slot_id || "");
  if (!slotId) return NextResponse.json({ error: "Veldu tíma." }, { status: 400 });

  /* One active booking per order — checked first for a clear answer; the
     unique index is what actually guarantees it. */
  const { data: existing } = await supabaseAdmin.from("hc_bookings").select("id")
    .eq("order_id", order.id).eq("kind", kind).neq("status", "cancelled").limit(1);
  if (existing?.length) {
    return NextResponse.json({ error: "Tími hefur þegar verið bókaður fyrir þessa pöntun. Afbókaðu hann fyrst til að velja annan." }, { status: 409 });
  }

  const table = kind === "doctor" ? "doctor_slots" : "station_slots";
  const { data: slot } = await supabaseAdmin.from(table)
    .select(kind === "doctor" ? "id, slot_at, duration_minutes, location, company_id" : "id, slot_at, duration_minutes, location")
    .eq("id", slotId).maybeSingle<Slot & { company_id?: string | null }>();
  if (!slot) return NextResponse.json({ error: "Tíminn fannst ekki." }, { status: 404 });
  if (Date.parse(slot.slot_at) <= Date.now()) return NextResponse.json({ error: "Tíminn er liðinn." }, { status: 400 });
  if (kind === "doctor") {
    const cfg = await doctorConfig();
    if (new Date(slot.slot_at).getUTCDay() !== cfg.doctor_weekday) {
      return NextResponse.json({ error: `Læknisviðtöl eru bókuð á ${WEEKDAY_DAT_PL[cfg.doctor_weekday]}, læknadegi vikunnar.` }, { status: 400 });
    }
    if (slot.company_id) {
      const profile = await getClientProfile(user.id);
      if (slot.company_id !== profile?.company_id) return NextResponse.json({ error: "Tíminn er frátekinn." }, { status: 409 });
    }
  }

  /* The atomic claim: only matches while nobody holds the slot. */
  const now = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabaseAdmin.from(table)
    .update({ client_id: user.id, booked_at: now, updated_at: now })
    .eq("id", slot.id).is("client_id", null).is("completed_at", null).gt("slot_at", now)
    .select("id");
  if (claimErr) {
    /* uq_*_client_active: one open slot per client in each table. */
    if (claimErr.code === "23505") {
      return NextResponse.json({ error: kind === "doctor"
        ? "Þú átt þegar bókað læknisviðtal. Afbókaðu það fyrst ef þú vilt annan tíma."
        : "Þú átt þegar bókaðan mælingartíma. Afbókaðu hann fyrst ef þú vilt annan tíma." }, { status: 409 });
    }
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }
  if (!claimed?.length) return NextResponse.json({ error: "Einhver var á undan þér með þennan tíma. Veldu annan." }, { status: 409 });

  const { data: booking, error } = await supabaseAdmin.from("hc_bookings").insert({
    journey_id: order.journey_id, client_id: user.id, coach_id: null,
    kind, starts_at: slot.slot_at, minutes: slot.duration_minutes || 30,
    items: kind === "measurement" ? MEASUREMENT_ITEMS : [],
    order_id: order.id, slot_id: slot.id,
    note: typeof body.note === "string" ? body.note.slice(0, 500) : null,
  }).select("id, order_id, kind, starts_at, minutes, status, slot_id").maybeSingle();
  if (error || !booking) {
    /* Lost the per-order race (or anything else): give the slot back. */
    await releaseSlot(kind, slot.id, user.id);
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Tími hefur þegar verið bókaður fyrir þessa pöntun." }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message || "booking_failed" }, { status: 500 });
  }

  await hcAudit(`client:${user.id}`, "shop_booking_created", order.journey_id,
    { booking_id: booking.id, order_id: order.id, kind, starts_at: slot.slot_at });
  after(async () => { await syncOwner("client", user.id).catch(() => {}); });
  return NextResponse.json({ ok: true, booking, location: slot.location ?? null });
}
