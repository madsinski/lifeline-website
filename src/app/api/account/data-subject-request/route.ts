// Data Subject Rights endpoint (GDPR Art. 15–22 / Lög 90/2018).
// Records the request to dsr_requests, then notifies the DPO inbox
// and confirms to the user. Internal fulfilment runbook lives at
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

// Plain-language labels shown back to the user + admin.
const PLAIN_LABELS: Record<RequestType, string> = {
  access: "Get a copy of all my data",
  rectification: "Correct something that's wrong",
  erasure: "Delete my account and data",
  restriction: "Pause processing while a question is sorted",
  portability: "Export my data to another service",
  objection: "Stop using my data for a specific purpose",
  withdraw_consent: "Withdraw consent I gave earlier",
};

const ARTICLE_REFS: Record<RequestType, string> = {
  access: "GDPR Art. 15",
  rectification: "GDPR Art. 16",
  erasure: "GDPR Art. 17",
  restriction: "GDPR Art. 18",
  portability: "GDPR Art. 20",
  objection: "GDPR Art. 21",
  withdraw_consent: "GDPR Art. 7(3)",
};

// What the admin needs to do for each type. Mirrors dsr-runbook.md.
const ADMIN_STEPS: Record<RequestType, string[]> = {
  access: [
    "Acknowledge to the user within 72 hours.",
    "Run the SQL block under 'Access (Art. 15)' in supabase/runbooks/dsr-runbook.md to pull all their data.",
    "Bundle as a zip, email it from Resend, mark dsr_requests.status = 'completed'.",
  ],
  rectification: [
    "Confirm the corrected value with the user (reply asking what to change to what).",
    "Update via the admin UI when possible; SQL when not.",
    "Audit log fires automatically. Mark dsr_requests.status = 'completed'.",
  ],
  erasure: [
    "Confirm the user understands which data is in scope (Lifeline) vs. Medalia (separate retention rules).",
    "Trigger the delete-user edge function with the user's auth.uid.",
    "Coordinate with Medalia for sjúkraskrá redaction where lawful.",
    "Mark dsr_requests.status = 'completed' once both sides are done.",
  ],
  restriction: [
    "Add a row in client_consents with granted=false for the relevant processing key.",
    "Pause the relevant background processing (cron jobs, marketing).",
    "Mark dsr_requests.status = 'completed'.",
  ],
  portability: [
    "Same as access, but emit JSON-LD or another machine-readable format.",
    "CSV is acceptable when no obvious target exists.",
    "Mark dsr_requests.status = 'completed'.",
  ],
  objection: [
    "Stop processing for the named purpose unless there are compelling legitimate grounds.",
    "Most common: marketing emails — flip subscriptions / email_preferences flags.",
    "Mark dsr_requests.status = 'completed'.",
  ],
  withdraw_consent: [
    "Find the active row in client_consents for the relevant consent_key.",
    "Set revoked_at = now().",
    "If it's the Biody-import consent: tombstone cached weight_log/body comp rows.",
    "Mark dsr_requests.status = 'completed'.",
  ],
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

  // Persist as an auditable row first.
  const { data: dsrRow, error: dsrErr } = await supabaseAdmin
    .from("dsr_requests")
    .insert({
      client_id: user.id,
      client_email: user.email ?? null,
      request_type: type,
      details: details || null,
      status: "received",
      ip,
      user_agent: userAgent,
    })
    .select("id, submitted_at")
    .single();

  if (dsrErr) {
    return NextResponse.json(
      { ok: false, error: `Could not record request: ${dsrErr.message}` },
      { status: 500 },
    );
  }

  const dpoEmail = process.env.DPO_EMAIL || "contact@lifelinehealth.is";
  const plain = PLAIN_LABELS[type];
  const article = ARTICLE_REFS[type];
  const steps = ADMIN_STEPS[type];

  const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Admin notification — action-oriented format.
  const subject = `[Privacy request] ${plain} — ${user.email ?? user.id}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px;">
      <h2 style="margin:0 0 8px 0;">A user made a privacy request</h2>
      <p style="margin:0 0 18px 0; color:#6b7280;">Through their Lifeline account → Settings → Data &amp; privacy.</p>

      <table style="width:100%; border-collapse: collapse; margin-bottom: 18px;">
        <tr><td style="padding: 6px 0; color:#6b7280; width: 140px;">What they want</td><td style="padding: 6px 0;"><strong>${plain}</strong> <span style="color:#9ca3af;">(${article})</span></td></tr>
        <tr><td style="padding: 6px 0; color:#6b7280;">Submitted</td><td style="padding: 6px 0;">${dsrRow.submitted_at}</td></tr>
        <tr><td style="padding: 6px 0; color:#6b7280;">Respond by</td><td style="padding: 6px 0;"><strong style="color:#dc2626;">${deadline}</strong> (30 days, GDPR Art. 12(3))</td></tr>
      </table>

      <h3 style="margin: 18px 0 8px 0;">Requester</h3>
      <table style="width:100%; border-collapse: collapse; margin-bottom: 18px; font-size: 14px;">
        <tr><td style="padding: 4px 0; color:#6b7280; width: 140px;">Name</td><td style="padding: 4px 0;">${escapeHtml(clientRow?.full_name ?? "(no clients row)")}</td></tr>
        <tr><td style="padding: 4px 0; color:#6b7280;">Email</td><td style="padding: 4px 0;"><a href="mailto:${escapeHtml(user.email ?? "")}">${escapeHtml(user.email ?? "(unknown)")}</a></td></tr>
        <tr><td style="padding: 4px 0; color:#6b7280;">Phone</td><td style="padding: 4px 0;">${escapeHtml(clientRow?.phone ?? "—")}</td></tr>
        <tr><td style="padding: 4px 0; color:#6b7280;">Kennitala (last 4)</td><td style="padding: 4px 0;">${escapeHtml(clientRow?.kennitala_last4 ?? "—")}</td></tr>
        <tr><td style="padding: 4px 0; color:#6b7280;">auth.uid</td><td style="padding: 4px 0;"><code style="background:#f3f4f6; padding:2px 4px; border-radius:3px;">${escapeHtml(user.id)}</code></td></tr>
        <tr><td style="padding: 4px 0; color:#6b7280;">company_id</td><td style="padding: 4px 0;">${escapeHtml(clientRow?.company_id ?? "—")}</td></tr>
        <tr><td style="padding: 4px 0; color:#6b7280;">IP / UA</td><td style="padding: 4px 0; color:#9ca3af; font-size: 12px;">${escapeHtml(ip)} · ${escapeHtml(userAgent)}</td></tr>
      </table>

      ${
        details
          ? `<h3 style="margin: 18px 0 8px 0;">Details from the user</h3>
             <pre style="white-space: pre-wrap; font-family: ui-monospace, monospace; background: #f9fafb; padding: 12px; border-radius: 6px; font-size: 13px;">${escapeHtml(details)}</pre>`
          : ""
      }

      <h3 style="margin: 18px 0 8px 0;">What to do</h3>
      <ol style="padding-left: 20px;">
        ${steps.map((s) => `<li style="margin-bottom: 6px;">${escapeHtml(s)}</li>`).join("")}
      </ol>

      <p style="margin-top: 18px; padding-top: 12px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">
        Tracked as <code>dsr_requests.id = ${dsrRow.id}</code>.
        Full runbook with copy-paste SQL: <code>supabase/runbooks/dsr-runbook.md</code>.
      </p>
    </div>
  `;

  const sent = await sendEmail({ to: dpoEmail, subject, html });

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "We received your privacy request",
      html: `
        <p>Hi ${escapeHtml(clientRow?.full_name?.split(" ")[0] ?? "there")},</p>
        <p>Thanks for getting in touch. We've received your request:</p>
        <p style="padding: 12px 16px; background: #f9fafb; border-left: 3px solid #10B981;"><strong>${plain}</strong></p>
        <p>Our team will respond within 30 days. For matters involving your medical record (sjúkraskrá), we coordinate with Medalia, the licensed health-record system that holds it.</p>
        <p>If you didn't make this request, please reply to this email immediately.</p>
        <p style="color:#6b7280; font-size:13px;">— Lifeline Health</p>
      `,
    });
  }

  if (!sent.ok) {
    return NextResponse.json(
      { ok: false, error: `Email delivery failed: ${sent.error}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, type, requestId: dsrRow.id });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
