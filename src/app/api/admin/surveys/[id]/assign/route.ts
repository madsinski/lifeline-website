// POST /api/admin/surveys/[id]/assign
// Send an approved survey to one or more clients. Accepts either a
// single client_id, a list of client_ids, a list of company_ids
// (expanded to all employees with an email on file), or any
// combination. Creates a feedback_assignments row per recipient,
// generates a unique completion token, and emails each one a link to
// /survey/[token].
//
// Admin-only. Survey must be in 'approved' status.
//
// Body (any of):
//   { client_id: uuid }            // legacy single
//   { client_ids: uuid[] }
//   { company_ids: uuid[] }        // expand to all clients in those companies

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { aalFromToken } from "@/lib/auth-helpers";
import { sendEmail, renderSurveyInviteEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://www.lifelinehealth.is";

interface RequestBody {
  client_id?: string;
  client_ids?: string[];
  company_ids?: string[];
}

interface SendResult {
  client_id: string;
  email: string | null;
  status: "sent" | "skipped" | "failed";
  reason?: string;
  assignment_id?: string;
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await ctx.params;

  let body: RequestBody = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Auth + admin
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData.user?.email) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, role, name, active")
    .eq("email", userData.user.email)
    .maybeSingle();
  if (!staffRow || !staffRow.active || staffRow.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin role required" }, { status: 403 });
  }
  // Defence in depth: the /admin UI already gates on AAL2, but a leaked
  // AAL1 access token must not be able to fire mass-email assignments
  // directly via the API.
  if (aalFromToken(token) !== "aal2") {
    return NextResponse.json(
      { ok: false, error: "MFA step-up required to send surveys." },
      { status: 403 },
    );
  }

  // Verify survey is approved
  const { data: surveyRow } = await supabaseAdmin
    .from("feedback_surveys")
    .select("id, status, title_is, estimated_minutes")
    .eq("id", surveyId)
    .maybeSingle();
  if (!surveyRow) {
    return NextResponse.json({ ok: false, error: "Survey not found" }, { status: 404 });
  }
  if (surveyRow.status !== "approved") {
    return NextResponse.json({
      ok: false,
      error: `Survey must be 'approved' to send (currently '${surveyRow.status}'). Approve it via the medical advisor first.`,
    }, { status: 409 });
  }

  // Resolve recipients. A recipient is uniquely identified by email
  // (lowercased) so the same person appearing in both clients_decrypted
  // and company_members is only sent to once. The stored client_id may
  // be either a real clients.id or a company_members.id — the
  // feedback_assignments table doesn't enforce an FK, so this is safe.
  type Recipient = { id: string; email: string; full_name: string | null; source: "client" | "member" };
  const recipients = new Map<string, Recipient>();
  const results: SendResult[] = [];

  // (1) explicit client_ids — clients_decrypted only.
  const explicitClientIds = new Set<string>();
  if (body.client_id) explicitClientIds.add(body.client_id.trim());
  for (const id of body.client_ids || []) {
    if (typeof id === "string" && id.trim()) explicitClientIds.add(id.trim());
  }
  if (explicitClientIds.size > 0) {
    const { data: rows, error: clientErr } = await supabaseAdmin
      .from("clients_decrypted")
      .select("id, email, full_name")
      .in("id", Array.from(explicitClientIds));
    if (clientErr) {
      return NextResponse.json({ ok: false, error: `Recipient lookup failed: ${clientErr.message}` }, { status: 500 });
    }
    const found = new Set<string>();
    for (const c of (rows || []) as { id: string; email: string | null; full_name: string | null }[]) {
      found.add(c.id);
      if (!c.email) {
        results.push({ client_id: c.id, email: null, status: "skipped", reason: "no_email" });
        continue;
      }
      const key = c.email.trim().toLowerCase();
      if (!recipients.has(key)) {
        recipients.set(key, { id: c.id, email: c.email, full_name: c.full_name, source: "client" });
      }
    }
    for (const id of explicitClientIds) {
      if (!found.has(id)) {
        results.push({ client_id: id, email: null, status: "skipped", reason: "client_not_found" });
      }
    }
  }

  // (2) company_ids — pull BOTH onboarded clients and the company_members
  // roster (employees the company admin uploaded with name/email/phone
  // but who haven't created an app account yet). Prefer clients when an
  // email matches in both, since they have a real account.
  if (Array.isArray(body.company_ids) && body.company_ids.length > 0) {
    const cleanedCompanyIds = body.company_ids
      .filter((id): id is string => typeof id === "string" && !!id.trim())
      .map((id) => id.trim());
    if (cleanedCompanyIds.length > 0) {
      const [clientsRes, membersRes] = await Promise.all([
        supabaseAdmin
          .from("clients_decrypted")
          .select("id, email, full_name")
          .in("company_id", cleanedCompanyIds),
        supabaseAdmin
          .from("company_members")
          .select("id, email, full_name")
          .in("company_id", cleanedCompanyIds),
      ]);
      if (clientsRes.error) {
        return NextResponse.json({ ok: false, error: `Company client expansion failed: ${clientsRes.error.message}` }, { status: 500 });
      }
      if (membersRes.error) {
        return NextResponse.json({ ok: false, error: `Company roster expansion failed: ${membersRes.error.message}` }, { status: 500 });
      }
      for (const c of (clientsRes.data || []) as { id: string; email: string | null; full_name: string | null }[]) {
        if (!c.email) continue;
        const key = c.email.trim().toLowerCase();
        // Clients win over members (they have a real account).
        recipients.set(key, { id: c.id, email: c.email, full_name: c.full_name, source: "client" });
      }
      for (const m of (membersRes.data || []) as { id: string; email: string | null; full_name: string | null }[]) {
        if (!m.email) continue;
        const key = m.email.trim().toLowerCase();
        if (!recipients.has(key)) {
          recipients.set(key, { id: m.id, email: m.email, full_name: m.full_name, source: "member" });
        }
      }
    }
  }

  if (recipients.size === 0 && results.length === 0) {
    return NextResponse.json({ ok: false, error: "No recipients selected." }, { status: 400 });
  }

  // Skip people who already have an outstanding invite for this survey.
  const allRecipientIds = Array.from(recipients.values()).map((r) => r.id);
  const { data: existing } = allRecipientIds.length > 0
    ? await supabaseAdmin
        .from("feedback_assignments")
        .select("client_id, completed_at, expires_at")
        .eq("survey_id", surveyId)
        .in("client_id", allRecipientIds)
    : { data: [] as { client_id: string; completed_at: string | null; expires_at: string }[] };
  const nowMs = Date.now();
  const activeRecipients = new Set<string>();
  for (const a of (existing || []) as { client_id: string; completed_at: string | null; expires_at: string }[]) {
    if (!a.completed_at && new Date(a.expires_at).getTime() > nowMs) {
      activeRecipients.add(a.client_id);
    }
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Throttle to stay under Resend's 5 req/sec rate limit. 250ms between
  // sends ≈ 4/sec, leaving headroom for any concurrent Resend calls
  // elsewhere in the app. Skipped recipients don't hit the network so
  // we only sleep before an actual sendEmail call.
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  let firstSend = true;

  for (const recipient of recipients.values()) {
    if (activeRecipients.has(recipient.id)) {
      results.push({ client_id: recipient.id, email: recipient.email, status: "skipped", reason: "already_invited_active" });
      continue;
    }

    const completionToken = newToken();
    const { data: assignment, error: insErr } = await supabaseAdmin
      .from("feedback_assignments")
      .insert({
        survey_id: surveyId,
        client_id: recipient.id,
        client_email: recipient.email,
        client_name: recipient.full_name || null,
        completion_token: completionToken,
        sent_by: staffRow.id,
        sent_by_name: staffRow.name || userData.user.email,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();
    if (insErr || !assignment) {
      results.push({ client_id: recipient.id, email: recipient.email, status: "failed", reason: insErr?.message || "insert_failed" });
      continue;
    }

    const surveyUrl = `${ORIGIN}/survey/${completionToken}`;
    const { text, html, subject } = renderSurveyInviteEmail({
      recipientName: recipient.full_name || "",
      surveyTitleIs: surveyRow.title_is,
      estimatedMinutes: surveyRow.estimated_minutes,
      surveyUrl,
      expiresAt,
    });
    if (!firstSend) await sleep(250);
    firstSend = false;
    const emailRes = await sendEmail({
      to: recipient.email,
      subject,
      html,
      text,
    });
    if (!emailRes.ok) {
      try { await supabaseAdmin.from("feedback_assignments").delete().eq("id", assignment.id); } catch {}
      results.push({ client_id: recipient.id, email: recipient.email, status: "failed", reason: `email_send_failed: ${emailRes.error || ""}` });
      continue;
    }
    results.push({ client_id: recipient.id, email: recipient.email, status: "sent", assignment_id: assignment.id });
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return NextResponse.json({
    ok: failed === 0,
    summary: { sent, skipped, failed, total: results.length },
    results,
  });
}
