// /api/employment-contract/sign
//
// Public, token-gated electronic signing of an employment contract.
// Mirrors the B2B service-agreement signing pipeline: verify the terms
// hash hasn't changed → record the signature (name/kennitala/IP/UA/ts)
// → render the PDF → archive it in private storage → email a copy.
//
// No login required: the unguessable token from the email is the gate.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import {
  EMPLOYMENT_CONTRACT_VERSION,
  renderEmploymentContract,
  type AgreedTerms,
  type ContractParties,
} from "@/lib/employment-contract-template";
import { renderEmploymentContractPdf } from "@/lib/pdf-employment-contract-renderer";

export const maxDuration = 60;
export const runtime = "nodejs";

const COMPANY_NAME = "Lifeline Health ehf.";
const COMPANY_KENNITALA = "590925-1440";
const BUCKET = "employment-contracts";

function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}
function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() ?? null;
}

interface SignPayload {
  token: string;
  signatory_name: string;
  signatory_kennitala?: string;
  agree?: boolean;
}

export async function POST(req: NextRequest) {
  const body: SignPayload = await req.json().catch(() => ({} as SignPayload));

  if (!body.token) return NextResponse.json({ error: "token_required" }, { status: 400 });
  if (!body.signatory_name?.trim()) return NextResponse.json({ error: "signatory_name_required" }, { status: 400 });
  if (!body.agree) return NextResponse.json({ error: "must_agree" }, { status: 400 });

  // ── Load the contract; must be awaiting signature ──────────────
  const { data: contract, error: cErr } = await supabaseAdmin
    .from("employment_contracts")
    .select("*")
    .eq("token", body.token)
    .maybeSingle();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (contract.status === "signed") {
    return NextResponse.json({ error: "already_signed" }, { status: 409 });
  }
  if (contract.status !== "sent") {
    return NextResponse.json({ error: "not_signable" }, { status: 409 });
  }

  const terms = contract.agreed_terms as AgreedTerms;
  const parties: ContractParties = {
    candidateName: contract.candidate_name,
    companyName: COMPANY_NAME,
    companyKennitala: COMPANY_KENNITALA,
  };

  // ── Integrity check: terms must not have changed since send ────
  const recomputedHash = sha256Hex(renderEmploymentContract(parties, terms));
  if (recomputedHash !== contract.terms_hash) {
    return NextResponse.json({ error: "terms_changed" }, { status: 409 });
  }

  const signedAt = new Date().toISOString();
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");
  const kennitala = body.signatory_kennitala?.trim() || null;

  // ── Render the signed PDF ──────────────────────────────────────
  let pdfBytes: Buffer;
  try {
    pdfBytes = await renderEmploymentContractPdf({
      parties: { ...parties, candidateKennitala: kennitala ?? undefined },
      terms,
      signatoryName: body.signatory_name.trim(),
      signatoryKennitala: kennitala,
      signedAt,
      signatoryIp: ip,
      signatoryUserAgent: ua,
      companySignatoryName: null,
      companySignedAt: null,
      termsHash: contract.terms_hash,
      contractVersion: contract.contract_version || EMPLOYMENT_CONTRACT_VERSION,
    });
  } catch (e) {
    console.error("[employment-contract sign] PDF render failed:", (e as Error).message);
    return NextResponse.json({ error: "pdf_render_failed", detail: (e as Error).message }, { status: 500 });
  }
  const pdfHash = sha256Hex(pdfBytes);

  // ── Archive PDF in private storage ─────────────────────────────
  const storagePath = `${contract.id}.pdf`;
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) console.error("[employment-contract sign] PDF upload failed:", upErr.message);

  // ── Record signature ───────────────────────────────────────────
  const { error: updErr } = await supabaseAdmin
    .from("employment_contracts")
    .update({
      status: "signed",
      signatory_name: body.signatory_name.trim(),
      signatory_kennitala: kennitala,
      signatory_ip: ip,
      signatory_user_agent: ua,
      signed_at: signedAt,
      pdf_storage_path: upErr ? null : storagePath,
      pdf_sha256: pdfHash,
    })
    .eq("id", contract.id);
  if (updErr) {
    return NextResponse.json({ error: "sign_update_failed", detail: updErr.message }, { status: 500 });
  }

  // ── Advance the originating job description ─────────────────────
  if (contract.job_description_id) {
    await supabaseAdmin.from("job_descriptions").update({ status: "signed" }).eq("id", contract.job_description_id);
  }

  // ── Email the signed PDF to the candidate + BCC ops ────────────
  try {
    const firstName = body.signatory_name.trim().split(" ")[0];
    const html = `
<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:32px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 8px;color:#111827;">Takk fyrir að undirrita, ${firstName}.</h2>
    <p style="margin:0 0 16px;color:#4b5563;">
      Meðfylgjandi er undirritaður ráðningarsamningur þinn við <strong>${COMPANY_NAME}</strong>.
      Afrit er einnig varðveitt í þjónustukerfi Lifeline Health.
    </p>
    <p style="margin:0 0 4px;color:#4b5563;">Undirritað: ${new Date(signedAt).toLocaleString("is-IS")}</p>
    <p style="margin:18px 0 0;color:#9ca3af;font-size:12px;">${COMPANY_NAME} · kt. ${COMPANY_KENNITALA} · Langholtsvegi 111, 104 Reykjavík</p>
  </div>
</body></html>`;
    await sendEmail({
      to: contract.candidate_email,
      bcc: ["contact@lifelinehealth.is"],
      subject: `Undirritaður ráðningarsamningur — ${COMPANY_NAME}`,
      html,
      text: `Takk fyrir að undirrita, ${firstName}. Meðfylgjandi er undirritaður ráðningarsamningur þinn við ${COMPANY_NAME}.`,
      attachments: upErr ? undefined : [{
        filename: `radningarsamningur-${contract.candidate_name.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`,
        content: pdfBytes.toString("base64"),
        contentType: "application/pdf",
      }],
    });
  } catch (e) {
    console.error("[employment-contract sign] email failed:", (e as Error).message);
  }

  return NextResponse.json({ ok: true, signed_at: signedAt });
}
