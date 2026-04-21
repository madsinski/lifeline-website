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

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Dedicated fasting reminder for B2C body_comp_bookings — Foundational and
// Check-in visits require an overnight fast before the blood panel. Copy is
// simpler than the B2B event variant because there's no company context.
function renderB2CReminder(args: {
  firstName: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  packageLabel: string;
}): { html: string; text: string } {
  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);color:#0f172a;">
    <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Tomorrow</div>
    <h1 style="margin:16px 0 8px;font-size:22px;">Your ${escapeHtml(args.packageLabel)} is tomorrow, ${escapeHtml(args.firstName)}.</h1>
    <div style="margin:18px 0;padding:14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">
      <div style="font-size:15px;color:#0f172a;font-weight:600;">${escapeHtml(args.dateLabel)} at ${escapeHtml(args.timeLabel)}</div>
      <div style="font-size:13px;color:#475569;margin-top:2px;">${escapeHtml(args.location)}</div>
    </div>
    <div style="padding:14px;background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;font-size:14px;color:#78350f;">
      <strong style="font-size:13px;display:block;margin-bottom:4px;">⚠ Fast from midnight tonight</strong>
      Water only — no food, coffee, tea, juice, or alcohol. This matters for clean blood-panel results.
    </div>
    <p style="margin-top:20px;font-size:13px;color:#64748b;line-height:1.6;">
      The visit takes about 20 minutes. Bring a jumper — it's easier to measure with a short-sleeved inner layer.
    </p>
    <p style="margin-top:12px;font-size:13px;color:#64748b;">Need to reschedule? <a href="https://www.lifelinehealth.is/account" style="color:#0369a1;">Manage your booking</a>. Free refund up to 48 hours before your slot.</p>
  </div></body></html>`;

  const text = `Hi ${args.firstName},\n\nYour ${args.packageLabel} is tomorrow.\n\nWhen: ${args.dateLabel} at ${args.timeLabel}\nWhere: ${args.location}\n\n*** FAST FROM MIDNIGHT TONIGHT — water only, no food, coffee, tea, juice, or alcohol. ***\n\nThe visit takes about 20 minutes. Bring a jumper — easier to measure with a short-sleeved inner layer.\n\nNeed to reschedule? https://www.lifelinehealth.is/account (free refund up to 48h before).\n\n— Lifeline Health`;

  return { html, text };
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // We send tomorrow's reminders. Compute the date in Iceland time so a
  // 01:00 UTC cron still picks up the right day.
  const nowPlus24 = new Date(Date.now() + 86_400_000);
  const tomorrow = nowPlus24.toLocaleDateString("en-CA", { timeZone: "Atlantic/Reykjavik" }); // YYYY-MM-DD

  let totalReminded = 0;
  let totalFailed = 0;

  // ─── B2B: company body-comp events ─────────────────────────────────────
  const { data: events } = await supabaseAdmin
    .from("body_comp_events")
    .select("id, company_id, event_date, start_time, end_time, location, room_notes, status, companies:company_id(name)")
    .eq("event_date", tomorrow)
    .eq("status", "scheduled");

  for (const ev of events || []) {
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

  // ─── B2C: solo body_comp_bookings at the Lifeline station ──────────────
  // Range covers the whole Iceland-local day to avoid timezone edge cases.
  const dayStartIso = new Date(`${tomorrow}T00:00:00Z`).toISOString();
  const dayEndIso = new Date(`${tomorrow}T23:59:59Z`).toISOString();

  const { data: b2cBookings } = await supabaseAdmin
    .from("body_comp_bookings")
    .select("id, scheduled_at, location, package, amount_isk, payment_status, status, clients:client_id(full_name, email)")
    .gte("scheduled_at", dayStartIso)
    .lte("scheduled_at", dayEndIso)
    .in("status", ["requested", "confirmed"])
    .neq("package", "self-checkin");

  let totalB2CReminded = 0;
  let totalB2CFailed = 0;

  for (const bk of b2cBookings || []) {
    // Only remind for bookings that were paid (or free legacy rows).
    if (bk.payment_status !== "paid" && (bk.amount_isk ?? 0) > 0) continue;
    const raw = (bk as Record<string, unknown>).clients;
    const c = Array.isArray(raw) ? raw[0] : raw;
    const client = c as { full_name?: string; email?: string } | null;
    if (!client?.email || !bk.scheduled_at) continue;
    const at = new Date(bk.scheduled_at);
    const dateLabel = at.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", timeZone: "Atlantic/Reykjavik",
    });
    const timeLabel = at.toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Atlantic/Reykjavik",
    });
    const packageLabel = bk.package === "foundational" ? "Foundational Health assessment"
      : bk.package === "checkin" ? "Check-in round"
      : "Lifeline visit";
    const { html, text } = renderB2CReminder({
      firstName: (client.full_name || "").split(" ")[0] || "there",
      dateLabel,
      timeLabel,
      location: bk.location || "Lifeline station, Reykjavík",
      packageLabel,
    });
    const r = await sendEmail({
      to: client.email,
      subject: `Tomorrow at ${timeLabel} — fast from midnight`,
      html, text,
    });
    if (r.ok) { totalReminded++; totalB2CReminded++; }
    else { totalFailed++; totalB2CFailed++; }
  }

  return NextResponse.json({
    ok: true,
    events: events?.length ?? 0,
    b2c_bookings: (b2cBookings || []).length,
    reminded: totalReminded,
    failed: totalFailed,
    b2c_reminded: totalB2CReminded,
    b2c_failed: totalB2CFailed,
    run_date: tomorrow,
  });
}
