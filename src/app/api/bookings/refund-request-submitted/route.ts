import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

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
    .from("clients")
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

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Refund request</div>
    <h1 style="margin:16px 0 8px;color:#0f172a;font-size:20px;">New cancellation request</h1>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;">A client inside the 48-hour self-serve window has asked for a cancellation. Review and resolve in the admin bookings queue.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">
      <tr><td style="padding:6px 0;color:#64748b;">Client</td><td style="padding:6px 0;text-align:right;font-weight:500;">${escapeHtml(client?.full_name || "")} &lt;${escapeHtml(client?.email || "")}&gt;</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Package</td><td style="padding:6px 0;text-align:right;">${escapeHtml(pkgLabel)}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Scheduled</td><td style="padding:6px 0;text-align:right;">${escapeHtml(when)}${hoursUntil !== null ? ` <span style="color:#dc2626;font-size:12px;">(in ${hoursUntil}h)</span>` : ""}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Requested refund</td><td style="padding:6px 0;text-align:right;font-weight:600;">${rr.requested_isk.toLocaleString("is-IS")} ISK${rr.include_checkin_addon ? " <span style=\"color:#7c3aed;font-size:12px;\">(incl. doctor add-on)</span>" : ""}</td></tr>
    </table>
    <div style="margin:20px 0;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
      <div style="font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#64748b;margin-bottom:6px;">Client's reason</div>
      <div style="white-space:pre-wrap;font-size:14px;color:#0f172a;">${escapeHtml(rr.reason)}</div>
    </div>
    <a href="https://www.lifelinehealth.is/admin/bookings" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:white;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Open in admin</a>
  </div></body></html>`;

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
