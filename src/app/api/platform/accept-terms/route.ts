import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";
import {
  TOS_KEY,
  TOS_VERSION,
  DPA_KEY,
  DPA_VERSION,
  EMPLOYEE_TOS_KEY,
  EMPLOYEE_TOS_VERSION,
  HEALTH_CONSENT_KEY,
  HEALTH_CONSENT_VERSION,
  renderTermsOfService,
  renderDataProcessingAgreement,
  renderEmployeeTermsOfService,
  renderHealthAssessmentConsent,
} from "@/lib/platform-terms-content";
import { renderAcceptancePdf } from "@/lib/pdf-acceptance-renderer";

export const runtime = "nodejs";
export const maxDuration = 30;

const DOCUMENT_TITLES: Record<string, string> = {
  [TOS_KEY]: "Notkunarskilmálar (Terms of Service)",
  [DPA_KEY]: "Vinnslusamningur (Data Processing Agreement)",
  [EMPLOYEE_TOS_KEY]: "Notkunarskilmálar starfsmanns",
  [HEALTH_CONSENT_KEY]: "Upplýst samþykki fyrir heilsumat",
};

interface AcceptPayload {
  document_key: string;
  document_version: string;
}

function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body: AcceptPayload = await req.json().catch(() => ({} as AcceptPayload));
  const { document_key, document_version } = body;
  if (!document_key || !document_version) {
    return NextResponse.json({ error: "document_key and document_version required" }, { status: 400 });
  }

  // Server is the source of truth for the document text. Re-render to get the
  // hash — prevents a client from pretending to have accepted a different
  // version than what we actually serve.
  let canonicalText: string | null = null;
  if (document_key === TOS_KEY && document_version === TOS_VERSION) {
    canonicalText = renderTermsOfService();
  } else if (document_key === DPA_KEY && document_version === DPA_VERSION) {
    canonicalText = renderDataProcessingAgreement();
  } else if (document_key === EMPLOYEE_TOS_KEY && document_version === EMPLOYEE_TOS_VERSION) {
    canonicalText = renderEmployeeTermsOfService();
  } else if (document_key === HEALTH_CONSENT_KEY && document_version === HEALTH_CONSENT_VERSION) {
    canonicalText = renderHealthAssessmentConsent();
  }
  if (!canonicalText) {
    return NextResponse.json({ error: "unknown_document_or_version" }, { status: 400 });
  }

  const textHash = sha256Hex(canonicalText);
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");

  // Upsert — if the user already accepted this exact (key, version) the
  // existing row stays. We do NOT overwrite the original accepted_at.
  const { data: existing } = await supabaseAdmin
    .from("platform_agreement_acceptances")
    .select("id, accepted_at")
    .eq("user_id", user.id)
    .eq("document_key", document_key)
    .eq("document_version", document_version)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, id: existing.id, accepted_at: existing.accepted_at, existing: true });
  }

  const { data, error: insErr } = await supabaseAdmin
    .from("platform_agreement_acceptances")
    .insert({
      user_id: user.id,
      document_key,
      document_version,
      text_hash: textHash,
      ip,
      user_agent: ua,
    })
    .select("id, accepted_at")
    .single();
  if (insErr) return NextResponse.json({ error: "insert_failed", detail: insErr.message }, { status: 500 });

  // ─── Generate acceptance certificate PDF ────────────────────
  let pdfStoragePath: string | null = null;
  try {
    const userEmail = user.email || "—";
    const pdfBytes = await renderAcceptancePdf({
      userEmail,
      userId: user.id,
      documentKey: document_key,
      documentTitle: DOCUMENT_TITLES[document_key] || document_key,
      documentVersion: document_version,
      documentText: canonicalText,
      textHash,
      ip,
      userAgent: ua,
      acceptedAt: data.accepted_at,
    });
    const pdfHash = sha256Hex(pdfBytes);

    pdfStoragePath = `${user.id}/${data.id}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("platform-acceptance-pdfs")
      .upload(pdfStoragePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upErr) {
      console.error("[accept-terms] PDF upload failed:", upErr.message);
      pdfStoragePath = null;
    } else {
      await supabaseAdmin
        .from("platform_agreement_acceptances")
        .update({ pdf_storage_path: pdfStoragePath, pdf_sha256: pdfHash })
        .eq("id", data.id);

      // Email the certificate to the user (BCC ops)
      try {
        const subject = `Staðfesting á samþykki — ${DOCUMENT_TITLES[document_key] || document_key} ${document_version}`;
        const html = `
<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:32px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 8px;color:#111827;">Takk fyrir samþykkið.</h2>
    <p style="margin:0 0 16px;color:#4b5563;">
      Meðfylgjandi er staðfesting á samþykki þínu á <strong>${DOCUMENT_TITLES[document_key] || document_key}</strong>
      (${document_version}).
    </p>
    <p style="margin:0 0 8px;color:#4b5563;">Afrit er einnig varðveitt í Lifeline þjónustukerfinu.</p>
    <p style="margin:18px 0 0;color:#9ca3af;font-size:12px;">Lifeline Health ehf. · kt. 590925-1440</p>
  </div>
</body></html>`;
        await sendEmail({
          to: userEmail,
          bcc: ["contact@lifelinehealth.is"],
          subject,
          html,
          text: `Takk fyrir samþykkið. Meðfylgjandi er staðfesting á samþykki þínu á ${DOCUMENT_TITLES[document_key] || document_key} (${document_version}).`,
          attachments: [{
            filename: `${document_key}-${document_version}.pdf`,
            content: pdfBytes.toString("base64"),
            contentType: "application/pdf",
          }],
        });
      } catch (e) {
        console.error("[accept-terms] email failed:", (e as Error).message);
      }
    }
  } catch (e) {
    console.error("[accept-terms] PDF render failed:", (e as Error).message);
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    accepted_at: data.accepted_at,
    existing: false,
    pdf_storage_path: pdfStoragePath,
  });
}

// GET: list current user's acceptances (used by client to skip the step if
// they've already accepted the current versions).
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("platform_agreement_acceptances")
    .select("document_key, document_version, accepted_at")
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ acceptances: data ?? [] });
}
