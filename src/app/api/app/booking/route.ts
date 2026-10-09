// Booking a consultation.
//
// Mirrors BookConsultationScreen + api.ts:createAppointment (516).
//
// Two things about `appointments` decide how this writes:
//   • date and time are TEXT, and the app writes the date as
//     "April 13, 2026" with English month names (BookConsultationScreen:362)
//     and consultation times as 24h "11:30" (confirmed against the stored
//     rows). This writes the same, so a booking made on the web is readable
//     in the app. The Icelandic date the person sees is a rendering of it.
//   • status defaults to 'booked', so a new row is upcoming without
//     being told.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

/** BookConsultationScreen.tsx:47-50 — the app's own four. */
export const CONSULTATION_TYPES = [
  { key: "general", label: "General check-in", minutes: 30 },
  { key: "program", label: "Program review", minutes: 30 },
  { key: "results", label: "Results discussion", minutes: 45 },
  { key: "nutrition", label: "Nutrition planning", minutes: 30 },
] as const;

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/** Half-hourly, 09:00–16:30 — the shape of the slots already in the table. */
const SLOTS = Array.from({ length: 16 }, (_, i) => {
  const m = 9 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const { data: coaches } = await supabaseAdmin
    .from("staff")
    .select("id, name, role, specialty")
    .eq("active", true)
    .contains("permissions", ["send_messages"]);

  // De-duplicated by name: the staff table holds several rows for the same
  // person (test accounts), and offering the same coach three times is odd.
  const seen = new Set<string>();
  const unique = (coaches ?? []).filter((c) => {
    const n = (c.name as string) ?? "";
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });

  return NextResponse.json({
    coaches: unique.map((c) => ({
      id: c.id as string, name: c.name as string,
      role: (c.role as string) ?? null, specialty: (c.specialty as string) ?? null,
    })),
    types: CONSULTATION_TYPES,
    slots: SLOTS,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const b = await req.json().catch(() => null);
  const dateIso = typeof b?.date === "string" ? b.date : null;   // YYYY-MM-DD
  const time = typeof b?.time === "string" ? b.time : null;      // HH:MM
  const typeKey = typeof b?.typeKey === "string" ? b.typeKey : null;
  const coachName = typeof b?.coachName === "string" ? b.coachName : null;

  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso) || !time || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: "bad date or time" }, { status: 400 });
  }
  const type = CONSULTATION_TYPES.find((t) => t.key === typeKey);
  if (!type) return NextResponse.json({ error: "unknown type" }, { status: 400 });
  if (!SLOTS.includes(time)) return NextResponse.json({ error: "slot not offered" }, { status: 400 });

  // No booking in the past. The column is text, so this is checked here.
  const [y, m, d] = dateIso.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (new Date(y, m - 1, d, hh, mm).getTime() < Date.now()) {
    return NextResponse.json({ error: "past", message: "Þessi tími er liðinn." }, { status: 409 });
  }

  // One booking per slot per person — a double tap should not book twice.
  const stored = `${MONTHS[m - 1]} ${d}, ${y}`;
  const { data: clash } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("client_id", user.id)
    .eq("date", stored)
    .eq("time", time)
    .eq("status", "booked")
    .limit(1);
  if (clash?.length) {
    return NextResponse.json({ error: "duplicate", message: "Þú ert þegar með tíma á þessum tíma." }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from("appointments").insert({
    client_id: user.id,
    type: "consultation",
    date: stored,
    time,
    consultation_type: type.label,
    coach_name: coachName,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
