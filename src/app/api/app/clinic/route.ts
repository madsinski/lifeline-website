// Stofan — the person's appointments, past and future.
//
// ClinicInfoScreen in the app is mostly static copy plus an email-to-book
// CTA; the part worth porting is "when am I next seen", which lives in
// `appointments` and `body_comp_bookings`.
//
// appointments.date/.time are text holding US display strings, so the split
// into past and future happens after parsing — see
// src/lib/app/appointment-date.ts for why a SQL date filter cannot work here.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";
import { APPOINTMENT_KIND, parseAppointment } from "@/lib/app/appointment-date";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const [{ data: appts }, { data: bookings }] = await Promise.all([
    supabaseAdmin
      .from("appointments")
      .select("id, type, date, time, station_name, station_address, package_name, coach_name, status, video_room_url, consultation_type")
      .eq("client_id", user.id),
    supabaseAdmin
      .from("body_comp_bookings")
      .select("id, scheduled_at, location, status, package")
      .eq("client_id", user.id)
      .order("scheduled_at", { ascending: false }),
  ]);

  const now = Date.now();
  const parsed = (appts ?? [])
    .map((a) => ({ a, at: parseAppointment(a.date, a.time) }))
    .filter((x): x is { a: typeof x.a; at: Date } => x.at !== null)
    .map(({ a, at }) => ({
      id: a.id as string,
      kind: APPOINTMENT_KIND[a.type as string] ?? "other",
      rawType: a.type as string,
      at: at.toISOString(),
      status: (a.status as string) ?? null,
      where: (a.station_name as string) ?? null,
      address: (a.station_address as string) ?? null,
      who: (a.coach_name as string) ?? null,
      packageName: (a.package_name as string) ?? null,
      videoUrl: (a.video_room_url as string) ?? null,
      future: at.getTime() >= now,
    }))
    .sort((x, y) => new Date(x.at).getTime() - new Date(y.at).getTime());

  return NextResponse.json({
    // Only "booked" is genuinely ahead: the table also holds completed and
    // cancelled rows, and showing those as upcoming is what the Heim bug was.
    upcoming: parsed.filter((p) => p.future && p.status === "booked"),
    past: parsed.filter((p) => !p.future || p.status !== "booked").reverse().slice(0, 20),
    bookings: (bookings ?? []).map((b) => ({
      id: b.id as string,
      at: b.scheduled_at as string,
      location: (b.location as string) ?? null,
      status: (b.status as string) ?? null,
      packageName: (b.package as string) ?? null,
    })),
  });
}
