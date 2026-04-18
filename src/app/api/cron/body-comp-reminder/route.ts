import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderEventReminderEmail } from "@/lib/email";

export const maxDuration = 300;

function authorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) return false;
  const a = Buffer.from(auth.slice(prefix.length));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Find events happening tomorrow (UTC date)
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const { data: events } = await supabaseAdmin
    .from("body_comp_events")
    .select("id, company_id, event_date, start_time, end_time, location, room_notes, status, companies:company_id(name)")
    .eq("event_date", tomorrow)
    .eq("status", "scheduled");

  if (!events?.length) {
    return NextResponse.json({ ok: true, reminded: 0, events: 0, run_date: tomorrow });
  }

  let totalReminded = 0;
  let totalFailed = 0;

  for (const ev of events) {
    const companyName = (() => {
      const raw = (ev as Record<string, unknown>).companies;
      const c = Array.isArray(raw) ? raw[0] : raw;
      return (c as { name?: string })?.name || "your company";
    })();

    // Find bookings for this event + join client name + auth email
    const { data: bookings } = await supabaseAdmin
      .from("body_comp_event_bookings")
      .select("slot_at, client_id, clients:client_id(full_name, email)")
      .eq("event_id", ev.id);
    if (!bookings?.length) continue;

    const dateLabel = new Date(ev.event_date + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long",
    });

    for (const b of bookings) {
      const raw = (b as Record<string, unknown>).clients;
      const c = Array.isArray(raw) ? raw[0] : raw;
      const client = c as { full_name?: string; email?: string } | null;
      if (!client?.email) continue;
      const slotTime = new Date(b.slot_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
      const { text, html } = renderEventReminderEmail({
        recipientName: (client.full_name || "").split(" ")[0] || "there",
        companyName,
        eventDateLabel: dateLabel,
        slotTime,
        location: ev.location,
        roomNotes: ev.room_notes,
      });
      const r = await sendEmail({
        to: client.email,
        subject: `Reminder: your Lifeline measurement tomorrow at ${slotTime}`,
        text, html,
      });
      if (r.ok) totalReminded++; else totalFailed++;
    }
  }

  return NextResponse.json({
    ok: true,
    events: events.length,
    reminded: totalReminded,
    failed: totalFailed,
    run_date: tomorrow,
  });
}
