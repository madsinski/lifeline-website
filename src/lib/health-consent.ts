// GDPR Art. 9 informed consent for the health assessment ("Upplýst samþykki
// fyrir heilsumat"). One place records it — the legacy account onboarding
// and the heilsuferð profile step both call this — so every acceptance gets
// the same audit row, PDF certificate and confirmation email. Server-only.

import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import { HEALTH_CONSENT_KEY, HEALTH_CONSENT_VERSION, renderHealthAssessmentConsent } from "@/lib/platform-terms-content";
import { renderAcceptancePdf } from "@/lib/pdf-acceptance-renderer";

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

/** Has this user accepted the current version? */
export async function hasHealthConsent(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("platform_agreement_acceptances").select("id")
    .eq("user_id", userId).eq("document_key", HEALTH_CONSENT_KEY).eq("document_version", HEALTH_CONSENT_VERSION).maybeSingle();
  return !!data;
}

/**
 * Record acceptance of the current version (idempotent). The DB row is the
 * source of truth; the PDF certificate and email are best effort.
 */
export async function recordHealthConsent(opts: { userId: string; email: string | null; ip: string | null; userAgent: string | null; tag?: string }): Promise<boolean> {
  const tag = opts.tag ?? "health-consent";
  const text = renderHealthAssessmentConsent();
  if (await hasHealthConsent(opts.userId)) return true;
  const { data: inserted, error } = await supabaseAdmin.from("platform_agreement_acceptances").insert({
    user_id: opts.userId,
    document_key: HEALTH_CONSENT_KEY,
    document_version: HEALTH_CONSENT_VERSION,
    text_hash: sha256(text),
    ip: opts.ip,
    user_agent: opts.userAgent,
  }).select("id, accepted_at").single();
  if (error || !inserted) {
    console.error(`[${tag}] acceptance insert:`, error?.message);
    return false;
  }
  try {
    const pdfBytes = await renderAcceptancePdf({
      userEmail: opts.email ?? "",
      userId: opts.userId,
      documentKey: HEALTH_CONSENT_KEY,
      documentTitle: "Upplýst samþykki fyrir heilsumat",
      documentVersion: HEALTH_CONSENT_VERSION,
      documentText: text,
      textHash: sha256(text),
      ip: opts.ip,
      userAgent: opts.userAgent,
      acceptedAt: inserted.accepted_at,
    });
    const storagePath = `${opts.userId}/${inserted.id}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage.from("platform-acceptance-pdfs")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) { console.error(`[${tag}] consent PDF upload:`, upErr.message); return true; }
    await supabaseAdmin.from("platform_agreement_acceptances")
      .update({ pdf_storage_path: storagePath, pdf_sha256: sha256(pdfBytes) }).eq("id", inserted.id);
    if (opts.email) {
      await sendEmail({
        to: opts.email,
        bcc: ["contact@lifelinehealth.is"],
        subject: `Staðfesting á samþykki — Upplýst samþykki fyrir heilsumat ${HEALTH_CONSENT_VERSION}`,
        html: `<!doctype html><html><body style="font-family:sans-serif;padding:24px;color:#374151;"><p>Meðfylgjandi er staðfesting á samþykki þínu á <strong>Upplýst samþykki fyrir heilsumat</strong> (${HEALTH_CONSENT_VERSION}).</p><p>— Lifeline Health ehf.</p></body></html>`,
        text: `Meðfylgjandi er staðfesting á samþykki þínu á Upplýst samþykki fyrir heilsumat (${HEALTH_CONSENT_VERSION}).`,
        attachments: [{ filename: `health-consent-${HEALTH_CONSENT_VERSION}.pdf`, content: pdfBytes.toString("base64"), contentType: "application/pdf" }],
      }).catch((e) => console.error(`[${tag}] consent email:`, (e as Error).message));
    }
  } catch (e) {
    console.error(`[${tag}] consent PDF render:`, (e as Error).message);
  }
  return true;
}
