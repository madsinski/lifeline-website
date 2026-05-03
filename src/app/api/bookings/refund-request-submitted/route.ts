import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { sendEmail, renderBrandedEmail } from "@/lib/email";

// Called by the client immediately after inserting a refund_requests row.
// Notifies the Lifeline team at contact@lifelinehealth.is so they can
// resolve it in /admin/bookings. The row itself carries all the data we
// need; the client just passes the id.

export const maxDuration = 20;

const ADMIN_INBOX = process.env.REFUND_REQUEST_INBOX || "contact@lifelinehealth.is";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const requestId = (body?.requestId || "").trim();
  if (!requestId) return NextResponse.json({ error: "requestId_required" }, { status: 400 });

  // Load the request and validate the caller actually owns it
  const { data: rr } = await supabaseAdmin
    .from("refund_requests")
    .select("id, client_id, booking_id, reason, requested_isk, include_checkin_addon, created_at")
    .eq("id", requestId)
    .maybeSingle();
  if (!rr) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (rr.client_id !== user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: client } = await supabaseAdmin
    .from("clients_decrypted")
    .select("full_name, email, phone")
    .eq("id", rr.client_id)
    .maybeSingle();

  const { data: booking } = rr.booking_id ? await supabaseAdmin
    .from("body_comp_bookings")
    .select("scheduled_at, package, amount_isk, payment_reference")
    .eq("id", rr.booking_id)
    .maybeSingle() : { data: null };

  const pkgLabel = booking?.package === "foundational" ? "Foundational Health"
    : booking?.package === "checkin" ? "Check-in"
    : booking?.package === "self-checkin" ? "Self Check-in"
    : "—";
  const when = booking?.scheduled_at ? new Date(booking.scheduled_at).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Atlantic/Reykjavik" }) : "—";
  const hoursUntil = booking?.scheduled_at ? Math.round((new Date(booking.scheduled_at).getTime() - Date.now()) / 3_600_000) : null;

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#334155;">A client inside the 48-hour self-serve window has asked for a cancellation. Review and resolve in the admin bookings queue.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">
      <tr><td style="padding:6px 0;color:#64748B;">Client</td><td style="padding:6px 0;text-align:right;font-weight:500;">${escapeHtml(client?.full_name || "")} &lt;${escapeHtml(client?.email || "")}&gt;</td></tr>
      <tr><td style="padding:6px 0;color:#64748B;">Package</td><td style="padding:6px 0;text-align:right;">${escapeHtml(pkgLabel)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748B;">Scheduled</td><td style="padding:6px 0;text-align:right;">${escapeHtml(when)}${hoursUntil !== null ? ` <span style="color:#DC2626;font-size:12px;">(in ${hoursUntil}h)</span>` : ""}</td></tr>
      <tr><td style="padding:6px 0;color:#64748B;">Requested refund</td><td style="padding:6px 0;text-align:right;font-weight:700;">${rr.requested_isk.toLocaleString("is-IS")} ISK${rr.include_checkin_addon ? " <span style=\"color:#7C3AED;font-size:12px;\">(incl. doctor add-on)</span>" : ""}</td></tr>
    </table>
    <div style="margin:20px 0;padding:14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748B;margin-bottom:6px;">Client's reason</div>
      <div style="white-space:pre-wrap;font-size:14px;color:#0F172A;">${escapeHtml(rr.reason)}</div>
    </div>
  `;

  const html = renderBrandedEmail({
    title: "New cancellation request",
    preheader: `${client?.full_name || client?.email} · ${rr.requested_isk.toLocaleString("is-IS")} ISK`,
    accentLabel: "Refund request",
    accentTone: "amber",
    bodyHtml,
    ctaLabel: "Open in admin",
    ctaUrl: "https://www.lifelinehealth.is/admin/bookings",
  });

  const text = `New refund request\n\nClient: ${client?.full_name} <${client?.email}>\nPackage: ${pkgLabel}\nScheduled: ${when}\nRequested refund: ${rr.requested_isk.toLocaleString("is-IS")} ISK${rr.include_checkin_addon ? " (incl. doctor add-on)" : ""}\n\nReason:\n${rr.reason}\n\nResolve: https://www.lifelinehealth.is/admin/bookings`;

  const result = await sendEmail({
    to: ADMIN_INBOX,
    subject: `Cancellation request — ${client?.full_name || client?.email} (${rr.requested_isk.toLocaleString("is-IS")} ISK)`,
    html,
    text,
  });
  if (!result.ok) return NextResponse.json({ error: result.error || "send_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
