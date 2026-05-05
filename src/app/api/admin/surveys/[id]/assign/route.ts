// POST /api/admin/surveys/[id]/assign
// Send a (single) approved survey to a (single) client. Creates the
// feedback_assignments row, generates a unique completion token, and
// emails the client a link to /survey/[token].
//
// Admin-only. Survey must be in 'approved' status.
//
// Body: { client_id: uuid }

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderSurveyInviteEmail } from "@/lib/email";

export const runtime = "nodejs";

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "https://www.lifelinehealth.is";

interface RequestBody {
  client_id?: string;
}

function newToken(): string {
  // 32 bytes of randomness → 64 hex chars. Unguessable.
  return randomBytes(32).toString("hex");
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await ctx.params;

  let body: RequestBody = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const clientId = (body.client_id || "").trim();
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "client_id required" }, { status: 400 });
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

  // Look up the client (decrypted view because email/full_name are encrypted)
  const { data: clientRow } = await supabaseAdmin
    .from("clients_decrypted")
    .select("id, email, full_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!clientRow || !clientRow.email) {
    return NextResponse.json({ ok: false, error: "Client not found or has no email" }, { status: 404 });
  }

  // Generate token + create assignment row
  const completionToken = newToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const { data: assignment, error: insErr } = await supabaseAdmin
    .from("feedback_assignments")
    .insert({
      survey_id: surveyId,
      client_id: clientRow.id,
      client_email: clientRow.email,
      client_name: clientRow.full_name || null,
      completion_token: completionToken,
      sent_by: staffRow.id,
      sent_by_name: staffRow.name || userData.user.email,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, sent_at, expires_at")
    .single();
  if (insErr || !assignment) {
    return NextResponse.json({ ok: false, error: `Could not create assignment: ${insErr?.message}` }, { status: 500 });
  }

  // Send the invite email
  const surveyUrl = `${ORIGIN}/survey/${completionToken}`;
  const { text, html, subject } = renderSurveyInviteEmail({
    recipientName: clientRow.full_name || "",
    surveyTitleIs: surveyRow.title_is,
    estimatedMinutes: surveyRow.estimated_minutes,
    surveyUrl,
    expiresAt,
  });
  const emailRes = await sendEmail({
    to: clientRow.email,
    subject,
    html,
    text,
  });
  if (!emailRes.ok) {
    // Roll back the assignment so we don't leave a dangling token
    // when the email never went out.
    try {
      await supabaseAdmin.from("feedback_assignments").delete().eq("id", assignment.id);
    } catch {}
    return NextResponse.json({ ok: false, error: `Email send failed: ${emailRes.error}` }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    assignment_id: assignment.id,
    sent_to: clientRow.email,
    expires_at: assignment.expires_at,
    survey_url: surveyUrl,
  });
}
