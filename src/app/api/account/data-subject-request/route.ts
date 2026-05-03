// Data Subject Rights endpoint (GDPR Art. 15–22 / Lög 90/2018).
// Authenticated users submit a typed request; we email
// pv@lifelinehealth.is with full context and respond to the user
// from the data-protection inbox. The Lifeline-side runbook for
// fulfilling each request type lives in
// supabase/runbooks/dsr-runbook.md.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

const REQUEST_TYPES = [
  "access",
  "rectification",
  "erasure",
  "restriction",
  "portability",
  "objection",
  "withdraw_consent",
] as const;
type RequestType = (typeof REQUEST_TYPES)[number];

const TYPE_LABELS: Record<RequestType, string> = {
  access: "Access (Art. 15) — copy of my personal data",
  rectification: "Rectification (Art. 16) — correct inaccurate data",
  erasure: "Erasure / right to be forgotten (Art. 17)",
  restriction: "Restriction of processing (Art. 18)",
  portability: "Data portability (Art. 20)",
  objection: "Objection to processing (Art. 21)",
  withdraw_consent: "Withdraw consent (Art. 7(3))",
};

export async function POST(req: Request) {
  let body: { type?: string; details?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type as RequestType | undefined;
  const details = (body.details || "").toString().slice(0, 4000);

  if (!type || !REQUEST_TYPES.includes(type)) {
    return NextResponse.json({ ok: false, error: "Invalid request type" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const accessToken = authHeader.slice("Bearer ".length);

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }
  const user = userData.user;

  // Look up the matching client + company for context.
  const { data: clientRow } = await supabaseAdmin
    .from("clients")
    .select("id, full_name, email, phone, company_id, kennitala_last4")
    .eq("id", user.id)
    .maybeSingle();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  const submittedAt = new Date().toISOString();

  const subject = `[DSR] ${TYPE_LABELS[type]} — ${user.email ?? user.id}`;
  const html = `
    <h2>Data Subject Rights request received</h2>
    <p><strong>Request type:</strong> ${TYPE_LABELS[type]}</p>
    <p><strong>Submitted at:</strong> ${submittedAt}</p>
    <h3>Requester</h3>
    <ul>
      <li>auth.users.id: <code>${user.id}</code></li>
      <li>email: ${user.email ?? "(unknown)"}</li>
      <li>full_name: ${clientRow?.full_name ?? "(no clients row)"}</li>
      <li>phone: ${clientRow?.phone ?? "—"}</li>
      <li>kennitala_last4: ${clientRow?.kennitala_last4 ?? "—"}</li>
      <li>company_id: ${clientRow?.company_id ?? "—"}</li>
      <li>IP: ${ip}</li>
      <li>User-Agent: ${userAgent}</li>
    </ul>
    <h3>Free-text details from requester</h3>
    <pre style="white-space: pre-wrap; font-family: ui-monospace, monospace; background: #f5f5f5; padding: 12px; border-radius: 6px;">${escapeHtml(details || "(none provided)")}</pre>
    <p>Action required: respond within 30 days per GDPR Art. 12.
    Runbook: supabase/runbooks/dsr-runbook.md</p>
  `;

  const dpoEmail = process.env.DPO_EMAIL || "contact@lifelinehealth.is";

  const sent = await sendEmail({
    to: dpoEmail,
    subject,
    html,
  });

  // Confirmation to the requester.
  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "We received your data protection request",
      html: `
        <p>Hi ${clientRow?.full_name?.split(" ")[0] ?? "there"},</p>
        <p>We've received your request: <strong>${TYPE_LABELS[type]}</strong>.</p>
        <p>Our data protection officer will respond within 30 days.
        For health record matters, we coordinate with Medalia per our joint-controller arrangement.</p>
        <p>If you didn't make this request, please reply to this email immediately.</p>
        <p>— Lifeline Health</p>
      `,
    });
  }

  if (!sent.ok) {
    return NextResponse.json(
      { ok: false, error: `Email delivery failed: ${sent.error}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, type, submittedAt });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
