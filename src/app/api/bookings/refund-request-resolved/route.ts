import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

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
    <p>We've approved your cancellation for <strong>${escapeHtml(pkgLabel)}</strong>${when ? ` on ${escapeHtml(when)}` : ""}.</p>
    <p>We're refunding <strong>${approvedAmount.toLocaleString("is-IS")} ISK</strong> to the card you used. It usually lands within 3–5 business days, depending on your bank.</p>
    ${rr.admin_note ? `<p style="margin-top:16px;padding:12px;background:#f1f5f9;border-radius:8px;font-size:13px;color:#334155;"><strong>Note from us:</strong> ${escapeHtml(rr.admin_note)}</p>` : ""}
    <p>If you'd like to rebook, just visit your dashboard when you're ready — no rush.</p>
  ` : `
    <p>Thanks for your cancellation request for <strong>${escapeHtml(pkgLabel)}</strong>${when ? ` on ${escapeHtml(when)}` : ""}.</p>
    <p>We're not able to approve a refund in this case${rr.admin_note ? `:</p><p style="padding:12px;background:#fef2f2;border-left:3px solid #dc2626;font-size:13.5px;color:#334155;">${escapeHtml(rr.admin_note)}</p><p>` : "."}</p>
    <p>Your booking is still on the calendar. If there's anything we can do to help you make it, please reply to this email and we'll try our best.</p>
  `;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);color:#0f172a;">
    <div style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;${approved ? "background:#dcfce7;color:#166534;" : "background:#fee2e2;color:#991b1b;"}">${approved ? "Refund approved" : "Request reviewed"}</div>
    <h1 style="margin:16px 0 12px;font-size:20px;">${approved ? "We've processed your refund" : "About your cancellation request"}</h1>
    <p style="color:#475569;font-size:14px;line-height:1.6;">${hello}</p>
    <div style="color:#334155;font-size:14px;line-height:1.65;">${bodyHtml}</div>
    <p style="margin-top:24px;font-size:13px;color:#64748b;">Questions? Reply to this email or contact@lifelinehealth.is.</p>
  </div></body></html>`;

  const text = approved
    ? `${hello}\n\nWe've approved your cancellation for ${pkgLabel}${when ? ` on ${when}` : ""}.\n\nWe're refunding ${approvedAmount.toLocaleString("is-IS")} ISK to your card — usually within 3–5 business days.\n\n${rr.admin_note ? `Note: ${rr.admin_note}\n\n` : ""}Reply here or email contact@lifelinehealth.is with questions.\n\n— Lifeline Health`
    : `${hello}\n\nThanks for the cancellation request for ${pkgLabel}${when ? ` on ${when}` : ""}.\n\nWe're not able to approve a refund in this case.${rr.admin_note ? `\n\nNote: ${rr.admin_note}` : ""}\n\nYour booking is still on the calendar. Reply here if we can help.\n\n— Lifeline Health`;

  const result = await sendEmail({ to: client.email, subject, html, text });
  if (!result.ok) return NextResponse.json({ error: result.error || "send_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
