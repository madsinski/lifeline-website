import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2, gateError } from "@/lib/auth-helpers";
import { sendEmail, renderBrandedEmail } from "@/lib/email";

// Called by /admin/doctor-slots to delete a doctor slot. One server step:
// read the slot (+ booked client), delete the row, and ONLY THEN email the
// client (if the slot was booked) so they know the consultation's gone.
// A failed delete never sends a cancellation email; a failed email after a
// successful delete is reported back as { ok: true, notified: false }.
//
// Gate: write-authorized staff + AAL2 (requireAdminAAL2).

export const maxDuration = 20;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") return gateError(user);

  const body = await req.json().catch(() => ({}));
  const slotId = (body?.slotId || "").trim();
  const reason = (body?.reason || "").trim();
  if (!slotId) return NextResponse.json({ error: "slotId_required" }, { status: 400 });

  const { data: slot } = await supabaseAdmin
    .from("doctor_slots")
    .select("id, slot_at, mode, location, meeting_link, client_id, doctor_name")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot) return NextResponse.json({ error: "Tíminn fannst ekki." }, { status: 404 });

  // Read the client BEFORE deleting (the slot row holds the link).
  const { data: client } = slot.client_id
    ? await supabaseAdmin.from("clients_decrypted").select("full_name, email").eq("id", slot.client_id).maybeSingle()
    : { data: null };

  const { error: delErr } = await supabaseAdmin.from("doctor_slots").delete().eq("id", slotId);
  if (delErr) {
    console.error("[bookings/doctor-slot-deleted] delete failed", delErr.code);
    return NextResponse.json({ error: "Ekki tókst að eyða tímanum." }, { status: 500 });
  }

  if (!slot.client_id) return NextResponse.json({ ok: true, notified: false, skipped: "no_client" });
  if (!client?.email) return NextResponse.json({ ok: true, notified: false, skipped: "no_client_email" });

  const when = new Date(slot.slot_at).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Atlantic/Reykjavik" });
  const firstName = client.full_name?.split(" ")[0] || "there";
  const modeLabel = slot.mode === "video" ? "video consultation" : slot.mode === "phone" ? "phone consultation" : "in-person consultation";

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hi ${escapeHtml(firstName)},</p>
    <p style="margin:0 0 14px;">We're sorry — we had to cancel your <strong>${escapeHtml(modeLabel)}</strong>${slot.doctor_name ? ` with ${escapeHtml(slot.doctor_name)}` : ""} scheduled for <strong>${escapeHtml(when)}</strong>.</p>
    ${reason ? `<div style="margin:18px 0;padding:14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;font-size:13px;color:#334155;"><strong>Reason:</strong> ${escapeHtml(reason)}</div>` : ""}
    <p style="margin:0;">To book a new time, log in to your dashboard. If you have questions, reply to this email.</p>
  `;

  const html = renderBrandedEmail({
    title: "We had to cancel your doctor consultation",
    preheader: `Your ${modeLabel} on ${when} has been cancelled.`,
    accentLabel: "Consultation cancelled",
    accentTone: "red",
    bodyHtml,
    ctaLabel: "Book a new time",
    ctaUrl: "https://www.lifelinehealth.is/account",
  });

  const text = `Hi ${firstName},\n\nWe're sorry — we had to cancel your ${modeLabel}${slot.doctor_name ? ` with ${slot.doctor_name}` : ""} scheduled for ${when}.\n${reason ? `\nReason: ${reason}\n` : ""}\nTo book a new time, log in at https://www.lifelinehealth.is/account. Reply here with questions.\n\n— Lifeline Health`;

  const result = await sendEmail({
    to: client.email,
    subject: `Your Lifeline doctor consultation has been cancelled`,
    html,
    text,
  });
  if (!result.ok) {
    console.error("[bookings/doctor-slot-deleted] email failed");
    return NextResponse.json({ ok: true, notified: false, notify_error: "Tímanum var eytt en ekki tókst að senda skjólstæðingi tölvupóst." });
  }

  return NextResponse.json({ ok: true, notified: true });
}
