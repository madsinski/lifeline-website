// Public contact-form endpoint. Emails the submission to the team inbox with
// Reply-To set to the sender, so staff can reply directly. No DB write — the
// email IS the record. Uses the shared Resend helper + branded template.

import { NextRequest, NextResponse } from "next/server";
import { sendEmail, renderBrandedEmail } from "@/lib/email";

export const runtime = "nodejs";

const TO = process.env.CONTACT_TO_EMAIL || "contact@lifelinehealth.is";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown; email?: unknown; subject?: unknown; message?: unknown; company?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Honeypot: bots fill hidden fields. Pretend success without sending.
  if (typeof body.company === "string" && body.company.trim()) {
    return NextResponse.json({ ok: true });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!name || !subject || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please fill in every field with a valid email." }, { status: 400 });
  }
  if (name.length > 200 || email.length > 200 || subject.length > 300 || message.length > 5000) {
    return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });
  }

  const html = renderBrandedEmail({
    title: "New contact form message",
    accentLabel: "Contact form",
    accentTone: "blue",
    preheader: `${name}: ${subject}`,
    bodyHtml: `
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">
        <tr><td style="padding:4px 0;width:90px;color:#64748B;">Name</td><td style="padding:4px 0;font-weight:600;">${esc(name)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748B;">Email</td><td style="padding:4px 0;"><a href="mailto:${esc(email)}" style="color:#10B981;text-decoration:none;">${esc(email)}</a></td></tr>
        <tr><td style="padding:4px 0;color:#64748B;">Subject</td><td style="padding:4px 0;font-weight:600;">${esc(subject)}</td></tr>
      </table>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #F1F5F9;white-space:pre-wrap;line-height:1.6;">${esc(message)}</div>`,
    footerNote: "Reply to this email to respond directly to the sender.",
  });
  const text = `New contact form message\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`;

  const res = await sendEmail({
    to: TO,
    replyTo: email,
    subject: `Contact form: ${subject}`,
    html,
    text,
  });

  if (!res.ok) {
    console.error("contact email failed", res.error);
    return NextResponse.json({ error: "Could not send your message. Please try again or email us directly." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
