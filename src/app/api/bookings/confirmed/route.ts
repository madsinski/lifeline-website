import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

// Called by the book flow right after handlePay succeeds. Sends the client
// a confirmation with booking details + fast-before-visit reminder. Also
// CCs the Lifeline inbox so staff see new bookings in real time.

export const maxDuration = 20;

const ADMIN_INBOX = process.env.BOOKING_INBOX || process.env.REFUND_REQUEST_INBOX || "contact@lifelinehealth.is";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bookingId = (body?.bookingId || "").trim();
  if (!bookingId) return NextResponse.json({ error: "bookingId_required" }, { status: 400 });

  const { data: booking } = await supabaseAdmin
    .from("body_comp_bookings")
    .select("id, client_id, scheduled_at, location, package, amount_isk, payment_status, paid_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (booking.client_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (booking.payment_status !== "paid") return NextResponse.json({ error: "not_paid" }, { status: 400 });

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("full_name, email")
    .eq("id", booking.client_id)
    .maybeSingle();
  if (!client?.email) return NextResponse.json({ error: "no_client_email" }, { status: 400 });

  const pkgLabel = booking.package === "foundational" ? "Foundational Health"
    : booking.package === "checkin" ? "Check-in"
    : booking.package === "self-checkin" ? "Self Check-in"
    : "your booking";
  const when = booking.scheduled_at
    ? new Date(booking.scheduled_at).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Atlantic/Reykjavik" })
    : null;
  const needsVisit = booking.package !== "self-checkin" && !!when;
  const amount = (booking.amount_isk ?? 0).toLocaleString("is-IS");
  const firstName = client.full_name?.split(" ")[0] || "there";

  const detailsBlock = needsVisit ? `
    <div style="margin:18px 0;padding:14px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;">
      <div style="font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#0369a1;margin-bottom:8px;">Your appointment</div>
      <div style="font-size:15px;color:#0f172a;font-weight:600;">${escapeHtml(when || "")}</div>
      <div style="font-size:13px;color:#475569;margin-top:2px;">${escapeHtml(booking.location || "Lifeline station, Reykjavík")}</div>
    </div>
    <div style="padding:12px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:6px;font-size:13px;color:#78350f;">
      <strong>Fast from midnight</strong> the night before your visit — water only, no food, coffee, tea, juice, or alcohol. It's important for clean blood-panel results.
    </div>
  ` : `
    <div style="margin:18px 0;padding:14px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;">
      <div style="font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6d28d9;margin-bottom:8px;">Self Check-in</div>
      <div style="font-size:13px;color:#475569;">Start the questionnaire any time from your dashboard — no visit needed.</div>
    </div>
  `;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);color:#0f172a;">
    <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Booking confirmed</div>
    <h1 style="margin:16px 0 8px;font-size:22px;">You're booked, ${escapeHtml(firstName)}.</h1>
    <p style="margin:0 0 6px;color:#475569;font-size:14px;line-height:1.6;">We've received your payment and reserved your spot for <strong>${escapeHtml(pkgLabel)}</strong>.</p>
    ${detailsBlock}
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#475569;margin-top:20px;">
      <tr><td style="padding:5px 0;">Package</td><td style="padding:5px 0;text-align:right;color:#0f172a;">${escapeHtml(pkgLabel)}</td></tr>
      <tr><td style="padding:5px 0;">Amount paid</td><td style="padding:5px 0;text-align:right;color:#0f172a;font-weight:600;">${amount} ISK</td></tr>
      <tr><td style="padding:5px 0;">Reference</td><td style="padding:5px 0;text-align:right;color:#94a3b8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;">${escapeHtml(bookingId.slice(0, 8))}</td></tr>
    </table>
    <p style="margin-top:24px;font-size:13px;color:#64748b;line-height:1.6;">
      Need to change or cancel? Log in to <a href="https://www.lifelinehealth.is/account" style="color:#0369a1;">your dashboard</a>. Free refund up to 48 hours before your slot. Beyond that, you can send a cancellation request and we'll review it.
    </p>
    <p style="margin-top:12px;font-size:12px;color:#94a3b8;">Healthcare services are exempt from VAT in Iceland (Act 50/1988).</p>
  </div></body></html>`;

  const text = `Hi ${firstName},\n\nYou're booked for ${pkgLabel}.${when ? `\n\nWhen: ${when}\nWhere: ${booking.location || "Lifeline station, Reykjavík"}\n\nFAST FROM MIDNIGHT the night before your visit — water only.` : "\n\nStart your Self Check-in questionnaire from your dashboard whenever you're ready."}\n\nAmount paid: ${amount} ISK\nReference: ${bookingId.slice(0, 8)}\n\nNeed to change or cancel? Log in at https://www.lifelinehealth.is/account — free refund up to 48h before your slot.\n\n— Lifeline Health`;

  const result = await sendEmail({
    to: client.email,
    bcc: ADMIN_INBOX,
    subject: `Your Lifeline ${pkgLabel} booking is confirmed`,
    html,
    text,
  });
  if (!result.ok) return NextResponse.json({ error: result.error || "send_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
