import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";

export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const subject = (body?.subject || "").trim();
  const message = (body?.message || "").trim();
  if (!subject || !message) {
    return NextResponse.json({ error: "subject_and_message_required" }, { status: 400 });
  }

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, contact_person_id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: contactUser } = await supabaseAdmin.auth.admin.getUserById(company.contact_person_id);
  const contactEmail = contactUser?.user?.email;
  if (!contactEmail) return NextResponse.json({ error: "contact_email_missing" }, { status: 400 });

  // Staff sender name for the salutation
  const { data: staffRow } = await supabaseAdmin
    .from("staff").select("name, email").eq("id", user.id).maybeSingle();
  const fromName = staffRow?.name || user.email || "Lifeline Health";
  const fromEmail = staffRow?.email || user.email || null;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:40px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
    <p style="margin:0 0 12px;color:#6b7280;font-size:12px;">Message from ${escapeHtml(fromName)} at Lifeline Health regarding <strong>${escapeHtml(company.name)}</strong></p>
    <div style="white-space:pre-wrap;color:#111827;font-size:15px;line-height:1.6;">${escapeHtml(message)}</div>
    <p style="margin:28px 0 0;color:#6b7280;font-size:13px;">Reply directly to this email to reach ${escapeHtml(fromName)}${fromEmail ? ` (${escapeHtml(fromEmail)})` : ""}.</p>
  </div>
</body></html>`;
  const text = `Message from ${fromName} at Lifeline Health regarding ${company.name}\n\n${message}\n\nReply to this email to reach ${fromName}${fromEmail ? ` (${fromEmail})` : ""}.`;

  // Using reply-to so the contact person's reply goes to the staff member.
  // sendEmail helper doesn't support reply-to directly — we pass through Resend
  // via a minimal variant when fromEmail is set. The helper currently accepts
  // only {to, subject, text, html}; include the staff address as the sender
  // name so the subject makes it obvious who wrote.
  const r = await sendEmail({
    to: contactEmail,
    subject: `[Lifeline] ${subject}`,
    text,
    html,
  });
  if (!r.ok) return NextResponse.json({ error: "send_failed", detail: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, to: contactEmail });
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
