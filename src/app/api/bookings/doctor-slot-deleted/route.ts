import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

// Called by /admin/doctor-slots right before admin deletes a booked slot.
// Emails the client so they know the consultation's gone — otherwise the
// admin silently erases a scheduled appointment.

export const maxDuration = 20;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const slotId = (body?.slotId || "").trim();
  const reason = (body?.reason || "").trim();
  if (!slotId) return NextResponse.json({ error: "slotId_required" }, { status: 400 });

  const { data: slot } = await supabaseAdmin
    .from("doctor_slots")
    .select("id, slot_at, mode, location, meeting_link, client_id, doctor_name")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!slot.client_id) return NextResponse.json({ ok: true, skipped: "no_client" });

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("full_name, email")
    .eq("id", slot.client_id)
    .maybeSingle();
  if (!client?.email) return NextResponse.json({ ok: true, skipped: "no_client_email" });

  const when = new Date(slot.slot_at).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Atlantic/Reykjavik" });
  const firstName = client.full_name?.split(" ")[0] || "there";
  const modeLabel = slot.mode === "video" ? "video consultation" : slot.mode === "phone" ? "phone consultation" : "in-person consultation";

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);color:#0f172a;">
    <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Consultation cancelled</div>
    <h1 style="margin:16px 0 8px;font-size:20px;">We had to cancel your doctor consultation</h1>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">Hi ${escapeHtml(firstName)},</p>
    <p style="color:#334155;font-size:14px;line-height:1.65;">We're sorry — we had to cancel your <strong>${escapeHtml(modeLabel)}</strong>${slot.doctor_name ? ` with ${escapeHtml(slot.doctor_name)}` : ""} scheduled for <strong>${escapeHtml(when)}</strong>.</p>
    ${reason ? `<div style="margin:18px 0;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;color:#334155;"><strong>Reason:</strong> ${escapeHtml(reason)}</div>` : ""}
    <p style="color:#334155;font-size:14px;line-height:1.65;">To book a new time, log in to your <a href="https://www.lifelinehealth.is/account" style="color:#0369a1;">dashboard</a>. If you have questions, reply to this email.</p>
    <p style="margin-top:24px;font-size:13px;color:#64748b;">— Lifeline Health</p>
  </div></body></html>`;

  const text = `Hi ${firstName},\n\nWe're sorry — we had to cancel your ${modeLabel}${slot.doctor_name ? ` with ${slot.doctor_name}` : ""} scheduled for ${when}.\n${reason ? `\nReason: ${reason}\n` : ""}\nTo book a new time, log in at https://www.lifelinehealth.is/account. Reply here with questions.\n\n— Lifeline Health`;

  const result = await sendEmail({
    to: client.email,
    subject: `Your Lifeline doctor consultation has been cancelled`,
    html,
    text,
  });
  if (!result.ok) return NextResponse.json({ error: result.error || "send_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
