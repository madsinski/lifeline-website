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

  // Resolve recipient client_ids: union of explicit ids + expansion of companies.
  const explicitIds = new Set<string>();
  if (body.client_id) explicitIds.add(body.client_id.trim());
  for (const id of body.client_ids || []) {
    if (typeof id === "string" && id.trim()) explicitIds.add(id.trim());
  }
  if (Array.isArray(body.company_ids) && body.company_ids.length > 0) {
    const cleanedCompanyIds = body.company_ids
      .filter((id): id is string => typeof id === "string" && !!id.trim())
      .map((id) => id.trim());
    if (cleanedCompanyIds.length > 0) {
      const { data: rows, error: cErr } = await supabaseAdmin
        .from("clients_decrypted")
        .select("id")
        .in("company_id", cleanedCompanyIds);
      if (cErr) {
        return NextResponse.json({ ok: false, error: `Company expansion failed: ${cErr.message}` }, { status: 500 });
      }
      for (const r of (rows || []) as { id: string }[]) explicitIds.add(r.id);
    }
  }
  if (explicitIds.size === 0) {
    return NextResponse.json({ ok: false, error: "No recipients selected." }, { status: 400 });
  }

  // Look up each client (need email + name from the decrypted view).
  const { data: clientRows, error: clientErr } = await supabaseAdmin
    .from("clients_decrypted")
    .select("id, email, full_name")
    .in("id", Array.from(explicitIds));
  if (clientErr) {
    return NextResponse.json({ ok: false, error: `Recipient lookup failed: ${clientErr.message}` }, { status: 500 });
  }

  // Existing active assignments for this survey — to skip people who
  // already have an outstanding invite. Completed or expired prior
  // assignments are ignored (they can be re-invited).
  const { data: existing } = await supabaseAdmin
    .from("feedback_assignments")
    .select("client_id, completed_at, expires_at")
    .eq("survey_id", surveyId)
    .in("client_id", Array.from(explicitIds));
  const nowMs = Date.now();
  const activeRecipients = new Set<string>();
  for (const a of (existing || []) as { client_id: string; completed_at: string | null; expires_at: string }[]) {
    if (!a.completed_at && new Date(a.expires_at).getTime() > nowMs) {
      activeRecipients.add(a.client_id);
    }
  }

  const results: SendResult[] = [];
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  for (const id of explicitIds) {
    const client = (clientRows || []).find((c) => c.id === id) as
      | { id: string; email: string | null; full_name: string | null }
      | undefined;
    if (!client) {
      results.push({ client_id: id, email: null, status: "skipped", reason: "client_not_found" });
      continue;
    }
    if (!client.email) {
      results.push({ client_id: id, email: null, status: "skipped", reason: "no_email" });
      continue;
    }
    if (activeRecipients.has(id)) {
      results.push({ client_id: id, email: client.email, status: "skipped", reason: "already_invited_active" });
      continue;
    }

    const completionToken = newToken();
    const { data: assignment, error: insErr } = await supabaseAdmin
      .from("feedback_assignments")
      .insert({
        survey_id: surveyId,
        client_id: client.id,
        client_email: client.email,
        client_name: client.full_name || null,
        completion_token: completionToken,
        sent_by: staffRow.id,
        sent_by_name: staffRow.name || userData.user.email,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();
    if (insErr || !assignment) {
      results.push({ client_id: id, email: client.email, status: "failed", reason: insErr?.message || "insert_failed" });
      continue;
    }

    const surveyUrl = `${ORIGIN}/survey/${completionToken}`;
    const { text, html, subject } = renderSurveyInviteEmail({
      recipientName: client.full_name || "",
      surveyTitleIs: surveyRow.title_is,
      estimatedMinutes: surveyRow.estimated_minutes,
      surveyUrl,
      expiresAt,
    });
    const emailRes = await sendEmail({
      to: client.email,
      subject,
      html,
      text,
    });
    if (!emailRes.ok) {
      try { await supabaseAdmin.from("feedback_assignments").delete().eq("id", assignment.id); } catch {}
      results.push({ client_id: id, email: client.email, status: "failed", reason: `email_send_failed: ${emailRes.error || ""}` });
      continue;
    }
    results.push({ client_id: id, email: client.email, status: "sent", assignment_id: assignment.id });
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
