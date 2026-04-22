import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail, renderBrandedEmail } from "@/lib/email";

// Called by /admin/bookings after a refund_requests row is flipped to
// approved or denied. Sends the client a short lifecycle email so they
// know what happened.

export const maxDuration = 20;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const requestId = (body?.requestId || "").trim();
  if (!requestId) return NextResponse.json({ error: "requestId_required" }, { status: 400 });

  const { data: rr } = await supabaseAdmin
    .from("refund_requests")
    .select("id, client_id, booking_id, status, approved_isk, requested_isk, admin_note, resolved_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!rr) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (rr.status !== "approved" && rr.status !== "denied") {
    return NextResponse.json({ error: "not_resolved" }, { status: 400 });
  }

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("full_name, email")
    .eq("id", rr.client_id)
    .maybeSingle();
  if (!client?.email) return NextResponse.json({ error: "no_client_email" }, { status: 400 });

  const { data: booking } = rr.booking_id ? await supabaseAdmin
    .from("body_comp_bookings")
    .select("scheduled_at, package")
    .eq("id", rr.booking_id)
    .maybeSingle() : { data: null };

  const pkgLabel = booking?.package === "foundational" ? "Foundational Health"
    : booking?.package === "checkin" ? "Check-in"
    : booking?.package === "self-checkin" ? "Self Check-in"
    : "your booking";
  const when = booking?.scheduled_at ? new Date(booking.scheduled_at).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Atlantic/Reykjavik" }) : "";

  const approved = rr.status === "approved";
  const approvedAmount = rr.approved_isk ?? 0;
  const hello = `Hi ${escapeHtml(client.full_name?.split(" ")[0] || "there")},`;

  const subject = approved
    ? `Your Lifeline cancellation is approved — refund ${approvedAmount.toLocaleString("is-IS")} ISK`
    : `About your Lifeline cancellation request`;

  const bodyHtml = approved ? `
    <p style="margin:0 0 14px;">${hello}</p>
    <p style="margin:0 0 14px;">We've approved your cancellation for <strong>${escapeHtml(pkgLabel)}</strong>${when ? ` on ${escapeHtml(when)}` : ""}.</p>
    <p style="margin:0 0 14px;">We're refunding <strong>${approvedAmount.toLocaleString("is-IS")} ISK</strong> to the card you used. It usually lands within 3–5 business days, depending on your bank.</p>
    ${rr.admin_note ? `<p style="margin:18px 0;padding:12px 14px;background:#F1F5F9;border-radius:8px;font-size:13px;color:#334155;"><strong>Note from us:</strong> ${escapeHtml(rr.admin_note)}</p>` : ""}
    <p style="margin:0;">If you'd like to rebook, just visit your dashboard when you're ready — no rush.</p>
  ` : `
    <p style="margin:0 0 14px;">${hello}</p>
    <p style="margin:0 0 14px;">Thanks for your cancellation request for <strong>${escapeHtml(pkgLabel)}</strong>${when ? ` on ${escapeHtml(when)}` : ""}.</p>
    <p style="margin:0 0 14px;">We're not able to approve a refund in this case${rr.admin_note ? ":" : "."}</p>
    ${rr.admin_note ? `<p style="margin:0 0 14px;padding:12px 14px;background:#FEF2F2;border-left:3px solid #DC2626;font-size:13.5px;color:#334155;">${escapeHtml(rr.admin_note)}</p>` : ""}
    <p style="margin:0;">Your booking is still on the calendar. If there's anything we can do to help you make it, please reply to this email and we'll try our best.</p>
  `;

  const html = renderBrandedEmail({
    title: approved ? "We've processed your refund" : "About your cancellation request",
    preheader: approved ? `Refund of ${approvedAmount.toLocaleString("is-IS")} ISK on the way.` : "We've reviewed your request.",
    accentLabel: approved ? "Refund approved" : "Request reviewed",
    accentTone: approved ? "emerald" : "red",
    bodyHtml,
    ctaLabel: approved ? "Open dashboard" : undefined,
    ctaUrl: approved ? "https://www.lifelinehealth.is/account" : undefined,
    footerNote: "Questions? Reply to this email or contact@lifelinehealth.is.",
  });

  const text = approved
    ? `${hello}\n\nWe've approved your cancellation for ${pkgLabel}${when ? ` on ${when}` : ""}.\n\nWe're refunding ${approvedAmount.toLocaleString("is-IS")} ISK to your card — usually within 3–5 business days.\n\n${rr.admin_note ? `Note: ${rr.admin_note}\n\n` : ""}Reply here or email contact@lifelinehealth.is with questions.\n\n— Lifeline Health`
    : `${hello}\n\nThanks for the cancellation request for ${pkgLabel}${when ? ` on ${when}` : ""}.\n\nWe're not able to approve a refund in this case.${rr.admin_note ? `\n\nNote: ${rr.admin_note}` : ""}\n\nYour booking is still on the calendar. Reply here if we can help.\n\n— Lifeline Health`;

  const result = await sendEmail({ to: client.email, subject, html, text });
  if (!result.ok) return NextResponse.json({ error: result.error || "send_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
