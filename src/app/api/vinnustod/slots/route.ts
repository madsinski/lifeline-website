// Measurement times, opened from the workstation.
//
// The times a participant sees under "Bókaðu heilsufarsskoðunina" come from
// station_slots. /admin/station-slots has always been able to write them —
// one at a time, from the admin app, with the anon key. That is almost
// certainly why there are 152 slots and not one of them is in the future:
// somebody opened a batch by hand once and nobody did it again.
//
// So this is the same table from the workstation, where the person who knows
// which mornings the station is staffed actually works, and it opens a RANGE
// rather than a slot. Opening Tuesday 09:00–12:00 at 30-minute intervals is
// one action here and six there.
//
// GET    ?days=28           -> upcoming slots, free and booked
// POST   { date, from, to, minutes, location, capacity } -> generate a range
// DELETE ?id=               -> remove one, refused if somebody holds it
//
// Auth: workstation actor. Writes are audited.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor } from "@/lib/hc/ws-auth";
import { hcAudit } from "@/lib/hc/server";

export const runtime = "nodejs";

const DEFAULT_LOCATION = "Lifeline station, Reykjavík";

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? 28), 1), 120);
  const until = new Date(Date.now() + days * 86400_000).toISOString();

  const { data } = await supabaseAdmin.from("station_slots")
    .select("id, slot_at, duration_minutes, location, capacity, client_id, booking_id, notes, measurer_id")
    .gte("slot_at", new Date().toISOString())
    .lte("slot_at", until)
    .order("slot_at");

  const rows = data ?? [];
  /* Names for the booked ones, so a coach can see who holds a time without
     opening the client. Read through clients_decrypted like everywhere
     else. */
  const ids = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[];
  const { data: people } = ids.length
    ? await supabaseAdmin.from("clients_decrypted").select("id, name").in("id", ids)
    : { data: [] as { id: string; name: string | null }[] };
  const byId = new Map((people ?? []).map((p) => [p.id, p.name]));

  /* Who is taking the measurement. measurer_id has existed on this table
     all along, references staff, and nothing had ever written to it — 0 of
     170 rows. A coach could see times but not who was covering them, which
     is why every slot looked like somebody else's problem. */
  const { data: staff } = await supabaseAdmin.from("staff")
    .select("id, name, role").eq("active", true).order("name");
  const staffById = new Map((staff ?? []).map((w) => [w.id, w.name]));

  return NextResponse.json({
    staff: staff ?? [],
    slots: rows.map((r) => ({
      ...r,
      client_name: r.client_id ? byId.get(r.client_id) ?? null : null,
      measurer_name: r.measurer_id ? staffById.get(r.measurer_id) ?? null : null,
    })),
    /* Said out loud, because an empty picker on the participant's side looks
       like a broken page rather than an empty calendar. */
    freeAhead: rows.filter((r) => !r.client_id).length,
  });
}

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  const date = typeof b?.date === "string" ? b.date : "";          // YYYY-MM-DD
  const from = typeof b?.from === "string" ? b.from : "";          // HH:MM
  const to = typeof b?.to === "string" ? b.to : "";
  const minutes = Math.min(Math.max(Number(b?.minutes ?? 30), 5), 240);
  const capacity = Math.min(Math.max(Number(b?.capacity ?? 1), 1), 20);
  const location = (typeof b?.location === "string" && b.location.trim())
    ? b.location.trim().slice(0, 120) : DEFAULT_LOCATION;
  /* Optional: a morning can be opened before anybody is assigned to it. */
  const measurerId = typeof b?.measurerId === "string" && b.measurerId ? b.measurerId : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Dagsetning eða tími er ekki á réttu formi." }, { status: 400 });
  }

  /* Built in local wall-clock terms and stored as an instant. Iceland keeps
     UTC year round, so this is exact rather than approximately right — a
     comment worth leaving, because the same code elsewhere would need a zone. */
  const start = new Date(`${date}T${from}:00.000Z`);
  const end = new Date(`${date}T${to}:00.000Z`);
  if (!(start < end)) return NextResponse.json({ error: "Lokatími þarf að vera á eftir upphafstíma." }, { status: 400 });

  const wanted: string[] = [];
  for (let t = start.getTime(); t + minutes * 60_000 <= end.getTime(); t += minutes * 60_000) {
    wanted.push(new Date(t).toISOString());
  }
  if (!wanted.length) return NextResponse.json({ error: "Þetta bil rúmar engan tíma." }, { status: 400 });
  if (wanted.length > 60) return NextResponse.json({ error: "Of margir tímar í einu (hámark 60)." }, { status: 400 });

  /* Opening the same morning twice should add nothing rather than double it.
     Checked rather than relying on a constraint, because there is none and
     adding one would have to decide what "the same slot" means across
     locations. */
  const { data: existing } = await supabaseAdmin.from("station_slots")
    .select("slot_at").in("slot_at", wanted).eq("location", location);
  const taken = new Set((existing ?? []).map((r) => new Date(r.slot_at).toISOString()));
  const fresh = wanted.filter((w) => !taken.has(w));
  if (!fresh.length) {
    return NextResponse.json({ ok: true, created: 0, skipped: wanted.length, message: "Þessir tímar voru þegar opnir." });
  }

  const { error } = await supabaseAdmin.from("station_slots").insert(
    fresh.map((slot_at) => ({ slot_at, duration_minutes: minutes, location, capacity, measurer_id: measurerId })),
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await hcAudit(actor.label, "station_slots_opened", null,
    { date, from, to, minutes, location, created: fresh.length });
  return NextResponse.json({ ok: true, created: fresh.length, skipped: wanted.length - fresh.length });
}

/** Who is covering a time. Any coach may set it for anybody — the point of
 *  a shared calendar is that cover can be arranged without each person
 *  editing only their own row. */
export async function PATCH(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const measurerId = typeof b?.measurerId === "string" && b.measurerId ? b.measurerId : null;

  const { error } = await supabaseAdmin.from("station_slots")
    .update({ measurer_id: measurerId }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await hcAudit(actor.label, "station_slot_assigned", null, { id, measurerId });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  /* A held time is not withdrawn under somebody. Cancelling their booking is
     a different act with a different conversation attached to it. */
  const { data: slot } = await supabaseAdmin.from("station_slots")
    .select("client_id").eq("id", id).maybeSingle();
  if (!slot) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (slot.client_id) {
    return NextResponse.json({ error: "Tíminn er bókaður. Afbókaðu hjá skjólstæðingnum fyrst." }, { status: 409 });
  }

  await supabaseAdmin.from("station_slots").delete().eq("id", id);
  await hcAudit(actor.label, "station_slot_removed", null, { id });
  return NextResponse.json({ ok: true });
}
