import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { sendEmail, renderWelcomeEmail } from "@/lib/email";
import { activateBiodyForClient } from "@/lib/biody";
import { recordHealthConsent } from "@/lib/health-consent";

// B2C post-signup onboarding: collects body-composition profile + health
// consent + activates Biody. The B2B equivalent is
// /api/business/onboard/[token]/complete; this mirrors the same acceptance
// audit trail and Biody activation but skips the kennitala + Employee TOS
// steps (those are employer-flow specific).

export const maxDuration = 60;

type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active" | "extra_active";

type Body = {
  sex?: "male" | "female";
  date_of_birth?: string; // YYYY-MM-DD
  height_cm?: number;
  weight_kg?: number;
  activity_level?: ActivityLevel;
  accept_health_consent?: boolean;
  research_opt_out?: boolean;
  marketing_opt_out?: boolean;
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const { sex, date_of_birth, height_cm, weight_kg, activity_level, accept_health_consent } = body;

  // Validation — everything required, same as B2B flow
  if (!sex || !date_of_birth || !height_cm || !weight_kg || !activity_level) {
    return NextResponse.json({ error: "sex, date_of_birth, height_cm, weight_kg, activity_level required" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
    return NextResponse.json({ error: "date_of_birth must be YYYY-MM-DD" }, { status: 400 });
  }
  if (!accept_health_consent) {
    return NextResponse.json({ error: "health_consent_required" }, { status: 400 });
  }

  const email = user.email || "";
  const clientIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const clientUa = req.headers.get("user-agent") || null;
  const nowIso = new Date().toISOString();

  // 1. Update the client row with the profile fields + opt-outs + welcome_seen_at.
  const { error: upErr } = await supabaseAdmin
    .from("clients_decrypted")
    .update({
      sex,
      date_of_birth,
      height_cm,
      weight_kg,
      activity_level,
      research_opt_out: !!body.research_opt_out,
      marketing_opt_out: !!body.marketing_opt_out,
      welcome_seen_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", user.id);
  if (upErr) {
    return NextResponse.json({ error: "profile_update_failed", detail: upErr.message }, { status: 500 });
  }

  // 2. Record the health-consent acceptance with audit trail + PDF certificate.
  //    Best-effort — the DB row is the source of truth; PDF + email are nice-to-have.
  await recordHealthConsent({ userId: user.id, email, ip: clientIp, userAgent: clientUa, tag: "account/onboard/complete" })
    .catch((e) => console.error("[account/onboard/complete] acceptance block:", (e as Error).message));

  // 3. Activate Biody. Skipped if already active (idempotent inside activateBiodyForClient).
  const activation = await activateBiodyForClient(user.id);
  if (!activation.ok) {
    // Don't fail the whole onboarding if Biody is temporarily down — profile
    // + consent are still saved and the user can retry from the dashboard
    // via BiodyProfileModal. Surface a soft warning in the response and
    // page the team via Sentry — silent Biody failures left clients in
    // limbo previously, with no signal to ops until a support ticket.
    console.error("[account/onboard/complete] biody activation:", activation.error, activation.detail);
    Sentry.captureMessage("biody_activation_failed", {
      level: "error",
      tags: { surface: "b2c_onboarding", error: activation.error || "unknown" },
      extra: { user_id: user.id, detail: activation.detail },
    });
  } else if (activation.biody_patient_id && !activation.existing) {
    // Persist biody_patient_id ourselves rather than trusting the remote
    // biody-sync Edge Function to do it. Writes the base `clients` table
    // directly so the clients_decrypted view trigger is bypassed (no risk
    // of incidentally blanking other columns). If activation.existing is
    // true we already had a biody_patient_id, so nothing to write.
    const { error: biodyWriteErr } = await supabaseAdmin
      .from("clients")
      .update({
        biody_patient_id: activation.biody_patient_id,
        biody_uuid: activation.biody_uuid ?? null,
      })
      .eq("id", user.id);
    if (biodyWriteErr) {
      console.error("[account/onboard/complete] biody_patient_id write:", biodyWriteErr.message);
    }
  }

  // 4. Send B2C welcome email (non-blocking).
  try {
    const { data: clientRow } = await supabaseAdmin
      .from("clients_decrypted")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const origin = req.headers.get("origin") || "https://www.lifelinehealth.is";
    const firstName = (clientRow?.full_name || email.split("@")[0] || "there").split(" ")[0];
    const { html, text } = renderWelcomeEmail({
      companyName: null,            // B2C variant — renderWelcomeEmail already handles null
      recipientName: firstName,
      welcomeUrl: `${origin}/account`,
      loginUrl: `${origin}/account/login`,
    });
    await sendEmail({
      to: email,
      subject: "Welcome to Lifeline Health",
      html,
      text,
    });
  } catch (e) {
    console.error("[account/onboard/complete] welcome email:", (e as Error).message);
  }

  return NextResponse.json({
    ok: true,
    biody_activated: activation.ok,
    biody_error: activation.ok ? null : (activation.error || "activation_failed"),
  });
}
