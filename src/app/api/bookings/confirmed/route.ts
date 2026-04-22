import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { sendEmail, renderBrandedEmail } from "@/lib/email";

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
    <div style="margin:18px 0;padding:14px;background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#0369A1;margin-bottom:8px;">Your appointment</div>
      <div style="font-size:15px;color:#0F172A;font-weight:700;">${escapeHtml(when || "")}</div>
      <div style="font-size:13px;color:#475569;margin-top:2px;">${escapeHtml(booking.location || "Lifeline station, Reykjavík")}</div>
    </div>
    <div style="padding:12px 14px;background:#FFFBEB;border-left:3px solid #F59E0B;border-radius:6px;font-size:13px;color:#78350F;">
      <strong>Fast from midnight</strong> the night before your visit — water only, no food, coffee, tea, juice, or alcohol. It's important for clean blood-panel results.
    </div>
  ` : `
    <div style="margin:18px 0;padding:14px;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:10px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#6D28D9;margin-bottom:8px;">Self Check-in</div>
      <div style="font-size:13px;color:#475569;">Start the questionnaire any time from your dashboard — no visit needed.</div>
    </div>
  `;

  const bodyHtml = `
    <p style="margin:0 0 6px;color:#334155;">Hi ${escapeHtml(firstName)} — we've received your payment and reserved your spot for <strong>${escapeHtml(pkgLabel)}</strong>.</p>
    ${detailsBlock}
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#475569;margin-top:20px;">
      <tr><td style="padding:5px 0;">Package</td><td style="padding:5px 0;text-align:right;color:#0F172A;">${escapeHtml(pkgLabel)}</td></tr>
      <tr><td style="padding:5px 0;">Amount paid</td><td style="padding:5px 0;text-align:right;color:#0F172A;font-weight:700;">${amount} ISK</td></tr>
      <tr><td style="padding:5px 0;">Reference</td><td style="padding:5px 0;text-align:right;color:#94A3B8;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;">${escapeHtml(bookingId.slice(0, 8))}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12.5px;color:#94A3B8;">Healthcare services are exempt from VAT in Iceland (Act 50/1988).</p>
  `;

  const html = renderBrandedEmail({
    title: `You're booked, ${firstName}.`,
    preheader: `Your ${pkgLabel} is reserved${when ? ` — ${when}` : ""}.`,
    accentLabel: "Booking confirmed",
    accentTone: "emerald",
    bodyHtml,
    ctaLabel: "Open dashboard",
    ctaUrl: "https://www.lifelinehealth.is/account",
    footerNote: "Need to change or cancel? Log in to your dashboard. Free refund up to 48 hours before your slot — beyond that you can send a cancellation request for review.",
  });

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
