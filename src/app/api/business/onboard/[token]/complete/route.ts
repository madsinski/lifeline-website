import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderWelcomeEmail } from "@/lib/email";
import { findAuthUserByEmail } from "@/lib/auth-helpers";
import { signBiodyHeaders } from "@/lib/biody";
import {
  EMPLOYEE_TOS_KEY, EMPLOYEE_TOS_VERSION,
  HEALTH_CONSENT_KEY, HEALTH_CONSENT_VERSION,
  renderEmployeeTermsOfService, renderHealthAssessmentConsent,
} from "@/lib/platform-terms-content";
import { renderAcceptancePdf } from "@/lib/pdf-acceptance-renderer";

export const maxDuration = 60;

const BIODY_SYNC_URL = process.env.BIODY_SYNC_URL ||
  "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/biody-sync";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    return await handle(req, params);
  } catch (e) {
    console.error("[onboard-complete] uncaught:", e);
    return NextResponse.json({
      error: "onboard_complete_crashed",
      detail: (e as Error)?.message || String(e),
      stack: (e as Error)?.stack,
    }, { status: 500 });
  }
}

async function handle(
  req: NextRequest,
  params: Promise<{ token: string }>,
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const {
    password,
    account_password,
    sex,
    height_cm,
    weight_kg,
    activity_level,
    terms_version,
    research_opt_out,
    marketing_opt_out,
  } = body || {};

  if (!token || !password || !account_password) {
    return NextResponse.json({ error: "token, password, and account_password required" }, { status: 400 });
  }
  if (!sex || !height_cm || !weight_kg || !activity_level) {
    return NextResponse.json({ error: "sex, height_cm, weight_kg, activity_level required" }, { status: 400 });
  }

  // Verify invite
  const { data: verifyData, error: verifyErr } = await supabaseAdmin.rpc("verify_member_invite", {
    p_token: token,
    p_password: password,
  });
  if (verifyErr) return NextResponse.json({ error: "verification_failed" }, { status: 500 });
  const member = Array.isArray(verifyData) ? verifyData[0] : verifyData;
  if (!member) return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  if (member.completed_at) {
    return NextResponse.json({ error: "already completed" }, { status: 409 });
  }

  // M2: log the decrypt that happened inside verify_member_invite
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const ua = req.headers.get("user-agent") || "";
  await supabaseAdmin.rpc("log_kennitala_access", {
    p_actor_role: "onboarding",
    p_scope: "full",
    p_purpose: "onboard_complete",
    p_subject_kind: "company_member",
    p_subject_id: member.id,
    p_ip: ip,
    p_user_agent: ua,
  });

  // Load full member row (with encrypted kennitala blob) + company
  const { data: memberRow } = await supabaseAdmin
    .from("company_members")
    .select("id, company_id, kennitala_encrypted, email, full_name, phone")
    .eq("id", member.id)
    .maybeSingle();
  if (!memberRow) return NextResponse.json({ error: "member missing" }, { status: 404 });

  // Create or find auth user.
  // SECURITY: if a user already exists with this email, we refuse to silently
  // overwrite their password. That would let a malicious contact person hijack
  // an existing Lifeline account by adding the email to their roster.
  let userId: string | null = null;
  const email = (memberRow.email || member.email || "").toLowerCase();

  const existing = await findAuthUserByEmail(email);
  if (existing) {
    return NextResponse.json({
      error: "email_already_registered",
      detail: "This email already has a Lifeline account. Please sign in with your existing password at /account/login, then contact support to link your account to this company.",
    }, { status: 409 });
  }

  // Defensive cleanup: if an orphan clients row exists for this email (e.g.
  // left behind when a previous test account's auth.users row was deleted),
  // remove it so the handle_new_user trigger doesn't collide on clients.email.
  try {
    const { data: staleClients } = await supabaseAdmin
      .from("clients")
      .select("id")
      .ilike("email", email);
    for (const row of staleClients || []) {
      const { data: authCheck } = await supabaseAdmin.auth.admin.getUserById(row.id);
      if (!authCheck?.user) {
        console.warn("[onboard-complete] removing orphan clients row", row.id, email);
        await supabaseAdmin.from("clients").delete().eq("id", row.id);
      }
    }
  } catch (e) {
    console.error("[onboard-complete] orphan cleanup failed:", e);
  }

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: account_password,
    email_confirm: true,
    user_metadata: { full_name: memberRow.full_name },
  });
  if (createErr || !created.user) {
    console.error("[onboard-complete] createUser failed:", createErr);
    return NextResponse.json({
      error: "registration_failed",
      detail: createErr?.message || "auth create returned no user",
    }, { status: 500 });
  }
  userId = created.user.id;

  // Upsert clients row — copy encrypted kennitala from member
  const now = new Date().toISOString();
  const dobIso = parseKennitalaToDob(member.kennitala);
  const clientPayload: Record<string, unknown> = {
    id: userId,
    email,
    full_name: memberRow.full_name,
    phone: memberRow.phone || null,
    sex,
    height_cm,
    weight_kg,
    activity_level,
    kennitala_encrypted: memberRow.kennitala_encrypted,
    research_opt_out: !!research_opt_out,
    marketing_opt_out: !!marketing_opt_out,
    company_id: memberRow.company_id,
    terms_version,
    terms_accepted_at: now,
    updated_at: now,
  };
  if (dobIso) clientPayload.date_of_birth = dobIso;

  const { error: upErr } = await supabaseAdmin
    .from("clients")
    .upsert(clientPayload, { onConflict: "id" });
  if (upErr) return NextResponse.json({ error: `clients upsert: ${upErr.message}` }, { status: 500 });

  // Mark member completed
  await supabaseAdmin
    .from("company_members")
    .update({ client_id: userId, completed_at: now })
    .eq("id", memberRow.id);

  // Record platform acceptances (Employee TOS + Health assessment consent)
  // with server-authoritative audit trail + PDF certificates. Run best-effort
  // in parallel; onboarding still succeeds if any step fails (the DB row is
  // the source of truth for whether it's binding).
  try {
    const clientIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    const clientUa = req.headers.get("user-agent") || null;
    const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

    const acceptances: Array<{
      key: string; version: string; title: string; text: string;
    }> = [
      { key: EMPLOYEE_TOS_KEY, version: EMPLOYEE_TOS_VERSION, title: "Notkunarskilmálar starfsmanns", text: renderEmployeeTermsOfService() },
      { key: HEALTH_CONSENT_KEY, version: HEALTH_CONSENT_VERSION, title: "Upplýst samþykki fyrir heilsumat", text: renderHealthAssessmentConsent() },
    ];

    await Promise.all(acceptances.map(async (doc) => {
      // Skip if already recorded for this version (idempotency)
      const { data: existing } = await supabaseAdmin
        .from("platform_agreement_acceptances")
        .select("id")
        .eq("user_id", userId!)
        .eq("document_key", doc.key)
        .eq("document_version", doc.version)
        .maybeSingle();
      if (existing) return;

      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("platform_agreement_acceptances")
        .insert({
          user_id: userId,
          document_key: doc.key,
          document_version: doc.version,
          text_hash: sha256(doc.text),
          ip: clientIp,
          user_agent: clientUa,
        })
        .select("id, accepted_at")
        .single();
      if (insErr || !inserted) {
        console.error(`[onboard-complete] acceptance insert ${doc.key}:`, insErr?.message);
        return;
      }

      // Generate certificate PDF + upload + update row path (best effort)
      try {
        const pdfBytes = await renderAcceptancePdf({
          userEmail: email,
          userId: userId!,
          documentKey: doc.key,
          documentTitle: doc.title,
          documentVersion: doc.version,
          documentText: doc.text,
          textHash: sha256(doc.text),
          ip: clientIp,
          userAgent: clientUa,
          acceptedAt: inserted.accepted_at,
        });
        const storagePath = `${userId}/${inserted.id}.pdf`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("platform-acceptance-pdfs")
          .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });
        if (!upErr) {
          await supabaseAdmin
            .from("platform_agreement_acceptances")
            .update({ pdf_storage_path: storagePath, pdf_sha256: sha256(pdfBytes) })
            .eq("id", inserted.id);
          // Email certificate to the employee (BCC ops)
          try {
            await sendEmail({
              to: email,
              bcc: ["contact@lifelinehealth.is"],
              subject: `Staðfesting á samþykki — ${doc.title} ${doc.version}`,
              html: `<!doctype html><html><body style="font-family:sans-serif;padding:24px;color:#374151;"><p>Meðfylgjandi er staðfesting á samþykki þínu á <strong>${doc.title}</strong> (${doc.version}).</p><p>— Lifeline Health ehf.</p></body></html>`,
              text: `Meðfylgjandi er staðfesting á samþykki þínu á ${doc.title} (${doc.version}).`,
              attachments: [{ filename: `${doc.key}-${doc.version}.pdf`, content: pdfBytes.toString("base64"), contentType: "application/pdf" }],
            });
          } catch (e) {
            console.error(`[onboard-complete] email ${doc.key}:`, (e as Error).message);
          }
        } else {
          console.error(`[onboard-complete] PDF upload ${doc.key}:`, upErr.message);
        }
      } catch (e) {
        console.error(`[onboard-complete] PDF render ${doc.key}:`, (e as Error).message);
      }
    }));
  } catch (e) {
    console.error("[onboard-complete] acceptance block failed:", (e as Error).message);
  }

  // Kick off Biody patient creation
  let biodyResult: unknown = null;
  if (SERVICE_ROLE_KEY) {
    try {
      const bodyText = JSON.stringify({
        client_id: userId,
        first_name: memberRow.full_name?.split(" ")[0] || memberRow.full_name,
        last_name: memberRow.full_name?.split(" ").slice(1).join(" ") || "-",
        date_of_birth: dobIso,
        sex,
        height_cm,
        activity_level,
      });
      const bRes = await fetch(`${BIODY_SYNC_URL}/create-patient`, {
        method: "POST",
        headers: signBiodyHeaders(bodyText),
        body: bodyText,
      });
      biodyResult = await bRes.json().catch(() => null);
      // Log activation status on the member record
      const biodyOk = bRes.ok && (biodyResult as any)?.ok;
      try { await supabaseAdmin.from("company_members").update({
        biody_activation_error: biodyOk ? null : JSON.stringify(biodyResult || "unknown"),
      }).eq("id", memberRow.id); } catch {}
    } catch (e) {
      biodyResult = { error: (e as Error).message };
      try { await supabaseAdmin.from("company_members").update({
        biody_activation_error: (e as Error).message,
      }).eq("id", memberRow.id); } catch {}
    }
  }

  // Apply company default tier (if set) — create/update a subscription.
  try {
    const { data: companyTier } = await supabaseAdmin
      .from("companies").select("default_tier").eq("id", memberRow.company_id).maybeSingle();
    if (companyTier?.default_tier) {
      await supabaseAdmin.from("subscriptions").upsert({
        client_id: userId,
        tier: companyTier.default_tier,
        status: "active",
        current_period_start: new Date().toISOString(),
      }, { onConflict: "client_id" });
    }
  } catch (e) {
    console.error("[onboard-complete] tier apply failed:", (e as Error).message);
  }

  // Send a welcome email — non-blocking; failures don't break the flow.
  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "https://lifelinehealth.is";
    const { data: companyRow } = await supabaseAdmin
      .from("companies").select("name").eq("id", memberRow.company_id).maybeSingle();
    const { text, html } = renderWelcomeEmail({
      companyName: companyRow?.name || null,
      recipientName: (memberRow.full_name || "").split(" ")[0] || "there",
      welcomeUrl: `${origin.replace(/\/$/, "")}/account/login?next=${encodeURIComponent("/account/welcome")}`,
      loginUrl: `${origin.replace(/\/$/, "")}/account/login`,
    });
    await sendEmail({
      to: email,
      subject: `Welcome to Lifeline Health${companyRow?.name ? ` — ${companyRow.name}` : ""}`,
      text,
      html,
    });
  } catch (e) {
    console.error("[onboard-complete] welcome email failed:", (e as Error).message);
  }

  return NextResponse.json({ ok: true, biody: biodyResult });
}

function parseKennitalaToDob(kt: string | null | undefined): string | null {
  if (!kt || kt.length !== 10) return null;
  // kennitala structure: DDMMYY-NNNC where C indicates century:
  // 8 or 9 = 1800s or 1900s, 0 = 2000s.
  const dd = kt.slice(0, 2);
  const mm = kt.slice(2, 4);
  const yy = kt.slice(4, 6);
  const century = kt[9];
  let yyyy: string;
  if (century === "9") yyyy = `19${yy}`;
  else if (century === "0") yyyy = `20${yy}`;
  else if (century === "8") yyyy = `18${yy}`;
  else return null;
  return `${yyyy}-${mm}-${dd}`;
}
