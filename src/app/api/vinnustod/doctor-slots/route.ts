// Doctor-day times, opened from the workstation.
//
// The doctor works one day a week (hc_packages.quota.doctor_weekday on
// 'laeknisvidtal', src/lib/hc/shop.ts). Staff open that day's times here; a
// participant who has paid for a doctor interview or the health check books
// one of them under Þjónusta (/api/hc/shop/book). The interview is held and
// recorded in Medalia; this only holds the time. Same table as
// /admin/doctor-slots (doctor_slots), same range-at-a-time shape as
// /api/vinnustod/slots for the station.
//
// GET    ?days=90                                   -> slots, doctors, weekday
// POST   { date, from, to, minutes, doctorId?, mode? } -> open a range (doctor day only)
// PATCH  { id, doctorId }                           -> who takes it
// DELETE ?id=                                       -> remove one, refused if held
//
// Auth: workstation actor. Writes are audited.
// Schema: supabase/migration-single-shop.sql.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor, type HcActor } from "@/lib/hc/ws-auth";
import { hcAudit } from "@/lib/hc/server";
import { doctorConfig } from "@/lib/hc/shop-server";
import { WEEKDAY_DAT_PL } from "@/lib/hc/coaching-config";

export const runtime = "nodejs";

const DEFAULT_LOCATION = "Lifeline";
const MODES = new Set(["in_person", "video", "phone"]);

/*
 * The doctor's day is Lifeline's own rota, shared across every place (the
 * table has no location), and the list names who is booked. Partner
 * workers (Vera, heilsugæsla) see their own clients' times elsewhere; they
 * neither read nor change this one. Security review, 2026-10-16.
 */
function lifelineOwn(actor: HcActor): boolean {
  return actor.kind === "staff" || actor.worker.organization === "lifeline";
}

async function doctors() {
  const { data } = await supabaseAdmin.from("staff")
    .select("id, name, role").eq("active", true).eq("role", "doctor").order("name");
  return data ?? [];
}

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!lifelineOwn(actor)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? 90), 1), 120);
  const until = new Date(Date.now() + days * 86400_000).toISOString();
  const [{ data }, staff, cfg] = await Promise.all([
    supabaseAdmin.from("doctor_slots")
      .select("id, slot_at, duration_minutes, location, mode, client_id, doctor_id, doctor_name, company_id, completed_at")
      .gte("slot_at", new Date().toISOString()).lte("slot_at", until).order("slot_at"),
    doctors(),
    doctorConfig(),
  ]);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[];
  const { data: people } = ids.length
    ? await supabaseAdmin.from("clients_decrypted").select("id, name").in("id", ids)
    : { data: [] as { id: string; name: string | null }[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p.name]));
  const staffById = new Map(staff.map((w) => [w.id, w.name]));

  return NextResponse.json({
    weekday: cfg.doctor_weekday,
    slot_minutes: cfg.slot_minutes,
    staff,
    slots: rows.map((r) => ({
      ...r,
      capacity: 1,
      client_name: r.client_id ? byId.get(r.client_id) ?? null : null,
      measurer_id: r.doctor_id,
      measurer_name: r.doctor_id ? staffById.get(r.doctor_id) ?? r.doctor_name ?? null : r.doctor_name ?? null,
    })),
    freeAhead: rows.filter((r) => !r.client_id && new Date(r.slot_at).getUTCDay() === cfg.doctor_weekday).length,
  });
}

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!lifelineOwn(actor)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const b = await req.json().catch(() => null);
  const date = typeof b?.date === "string" ? b.date : "";
  const from = typeof b?.from === "string" ? b.from : "";
  const to = typeof b?.to === "string" ? b.to : "";
  const cfg = await doctorConfig();
  const minutes = Math.min(Math.max(Number(b?.minutes ?? cfg.slot_minutes), 5), 240);
  const mode = typeof b?.mode === "string" && MODES.has(b.mode) ? b.mode : "in_person";
  const location = (typeof b?.location === "string" && b.location.trim()) ? b.location.trim().slice(0, 120) : DEFAULT_LOCATION;
  const doctorId = typeof b?.doctorId === "string" && b.doctorId ? b.doctorId
    : typeof b?.measurerId === "string" && b.measurerId ? b.measurerId : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Dagsetning eða tími er ekki á réttu formi." }, { status: 400 });
  }
  /* Iceland keeps UTC all year, so wall clock = UTC here. */
  const start = new Date(`${date}T${from}:00.000Z`);
  const end = new Date(`${date}T${to}:00.000Z`);
  if (!(start < end)) return NextResponse.json({ error: "Lokatími þarf að vera á eftir upphafstíma." }, { status: 400 });
  if (start.getUTCDay() !== cfg.doctor_weekday) {
    return NextResponse.json({ error: `Læknistímar eru opnaðir á ${WEEKDAY_DAT_PL[cfg.doctor_weekday]}, læknadegi vikunnar.` }, { status: 400 });
  }

  const wanted: string[] = [];
  for (let t = start.getTime(); t + minutes * 60_000 <= end.getTime(); t += minutes * 60_000) wanted.push(new Date(t).toISOString());
  if (!wanted.length) return NextResponse.json({ error: "Þetta bil rúmar engan tíma." }, { status: 400 });
  if (wanted.length > 40) return NextResponse.json({ error: "Of margir tímar í einu (hámark 40)." }, { status: 400 });

  let doctorName: string | null = null;
  if (doctorId) {
    const doc = (await doctors()).find((d) => d.id === doctorId);
    if (!doc) return NextResponse.json({ error: "Læknirinn fannst ekki." }, { status: 400 });
    doctorName = doc.name ?? null;
  }

  /* Opening the same morning twice adds nothing rather than doubling it. */
  const { data: existing } = await supabaseAdmin.from("doctor_slots").select("slot_at").in("slot_at", wanted);
  const taken = new Set((existing ?? []).map((r) => new Date(r.slot_at).toISOString()));
  const fresh = wanted.filter((w) => !taken.has(w));
  if (!fresh.length) return NextResponse.json({ ok: true, created: 0, skipped: wanted.length });

  const { error } = await supabaseAdmin.from("doctor_slots").insert(
    fresh.map((slot_at) => ({ slot_at, duration_minutes: minutes, mode, location, doctor_id: doctorId, doctor_name: doctorName })),
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await hcAudit(actor.label, "doctor_slots_opened", null, { date, from, to, minutes, mode, created: fresh.length });
  return NextResponse.json({ ok: true, created: fresh.length, skipped: wanted.length - fresh.length });
}

export async function PATCH(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!lifelineOwn(actor)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => null);
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const doctorId = typeof b?.doctorId === "string" && b.doctorId ? b.doctorId
    : typeof b?.measurerId === "string" && b.measurerId ? b.measurerId : null;
  const doc = doctorId ? (await doctors()).find((d) => d.id === doctorId) : null;
  if (doctorId && !doc) return NextResponse.json({ error: "Læknirinn fannst ekki." }, { status: 400 });
  const { error } = await supabaseAdmin.from("doctor_slots")
    .update({ doctor_id: doctorId, doctor_name: doc?.name ?? null, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await hcAudit(actor.label, "doctor_slot_assigned", null, { id, doctorId });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!lifelineOwn(actor)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  /* Only a free time is removed, in one statement, so a booking that lands
     between a check and a delete is never deleted under somebody. */
  const { data: gone, error } = await supabaseAdmin.from("doctor_slots")
    .delete().eq("id", id).is("client_id", null).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!gone?.length) {
    const { data: still } = await supabaseAdmin.from("doctor_slots").select("id").eq("id", id).maybeSingle();
    return still
      ? NextResponse.json({ error: "Tíminn er bókaður. Afbókaðu hjá skjólstæðingnum fyrst." }, { status: 409 })
      : NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  await hcAudit(actor.label, "doctor_slot_removed", null, { id });
  return NextResponse.json({ ok: true });
}
