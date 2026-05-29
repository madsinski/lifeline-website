// /api/employment-contract
//
// Employment contracts generated from an approved job description and
// sent to the candidate for electronic signature.
//
// POST { job_description_id }     — create + send a contract (admin AAL2).
//                                   Snapshots the agreed terms, generates
//                                   an unguessable token, emails the
//                                   candidate a signing link, and voids any
//                                   earlier un-signed contract for the same
//                                   job description.
// GET                             — list contracts (admin). ?job_description_id= filters.
// GET ?id=<id>                    — one contract + signed-PDF download URL (admin).
// GET ?token=<token>              — public: contract text + status for the
//                                   sign page. No auth (token is the gate).

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import {
  EMPLOYMENT_CONTRACT_VERSION,
  renderEmploymentContract,
  type AgreedTerms,
  type ContractParties,
} from "@/lib/employment-contract-template";

export const runtime = "nodejs";

const COMPANY_NAME = "Lifeline Health ehf.";
const COMPANY_KENNITALA = "590925-1440";
const BUCKET = "employment-contracts";

function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

function siteUrl(req: NextRequest): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "https://www.lifelinehealth.is";
  return origin.replace(/\/$/, "");
}

// Build the agreed-terms snapshot from a job description's saved fields.
// The "agreed" column wins; otherwise we fall back to the proposal.
function agreedTermsFromFields(f: Record<string, unknown>): AgreedTerms {
  const g = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : "");
  const pref = (agreed: string, proposal: string) => (g(agreed).trim() || g(proposal).trim());
  return {
    starfsheiti: g("starfsheiti"),
    fyrirtaeki: g("fyrirtaeki") || "Lifeline",
    salary: pref("salaryAgreed", "salary"),
    salaryStart: pref("salaryStartAgreed", "salaryStart"),
    equity: pref("equityAgreed", "equity"),
    vesting: pref("vestingAgreed", "vesting"),
    startDate: pref("startAgreed", "startDate"),
    starfshlutfall: g("starfshlutfall"),
    stadsetning: g("stadsetning"),
  };
}

// Canonical text used for the integrity hash. Excludes the candidate's
// kennitala (supplied only at signing) so the hash is stable from send
// to sign.
function canonicalText(candidateName: string, terms: AgreedTerms): string {
  const parties: ContractParties = {
    candidateName,
    companyName: COMPANY_NAME,
    companyKennitala: COMPANY_KENNITALA,
  };
  return renderEmploymentContract(parties, terms);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const id = req.nextUrl.searchParams.get("id");

  // ── Public sign-page fetch (token-gated, no auth) ──────────────
  if (token) {
    const { data, error } = await supabaseAdmin
      .from("employment_contracts")
      .select("candidate_name, status, agreed_terms, contract_version, signed_at, signatory_name")
      .eq("token", token)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({
      contract: {
        candidate_name: data.candidate_name,
        status: data.status,
        contract_version: data.contract_version,
        signed_at: data.signed_at,
        signatory_name: data.signatory_name,
        contract_text: canonicalText(data.candidate_name, data.agreed_terms as AgreedTerms),
      },
    });
  }

  // ── Everything else is admin-only ──────────────────────────────
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (id) {
    const { data, error } = await supabaseAdmin
      .from("employment_contracts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    let pdfUrl: string | null = null;
    if (data.pdf_storage_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(data.pdf_storage_path, 60 * 10);
      pdfUrl = signed?.signedUrl ?? null;
    }
    return NextResponse.json({ contract: data, pdf_url: pdfUrl });
  }

  const jobId = req.nextUrl.searchParams.get("job_description_id");
  let q = supabaseAdmin
    .from("employment_contracts")
    .select("id, job_description_id, candidate_name, candidate_email, status, contract_version, signed_at, created_at, pdf_storage_path")
    .order("created_at", { ascending: false });
  if (jobId) q = q.eq("job_description_id", jobId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }

  let body: { job_description_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  const jobId = body.job_description_id;
  if (!jobId) return NextResponse.json({ error: "job_description_id_required" }, { status: 400 });

  // Load the job description (terms + candidate).
  const { data: jd, error: jdErr } = await supabaseAdmin
    .from("job_descriptions")
    .select("id, candidate_name, candidate_email, fields")
    .eq("id", jobId)
    .maybeSingle();
  if (jdErr) return NextResponse.json({ error: jdErr.message }, { status: 500 });
  if (!jd) return NextResponse.json({ error: "job_description_not_found" }, { status: 404 });

  const fields = (jd.fields as Record<string, unknown>) ?? {};
  const candidateName = (jd.candidate_name || (fields.applicantName as string) || "").trim();
  const candidateEmail = (jd.candidate_email || "").trim().toLowerCase();
  if (!candidateName) return NextResponse.json({ error: "candidate_name_required" }, { status: 400 });
  if (!candidateEmail) return NextResponse.json({ error: "candidate_email_required" }, { status: 400 });

  const terms = agreedTermsFromFields(fields);
  const termsHash = sha256Hex(canonicalText(candidateName, terms));
  const token = randomBytes(24).toString("base64url");

  // Void any earlier un-signed contract for this job description so only
  // one signing link is live at a time.
  await supabaseAdmin
    .from("employment_contracts")
    .update({ status: "void" })
    .eq("job_description_id", jobId)
    .eq("status", "sent");

  const { data: contract, error: insErr } = await supabaseAdmin
    .from("employment_contracts")
    .insert({
      job_description_id: jobId,
      token,
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      agreed_terms: terms,
      contract_version: EMPLOYMENT_CONTRACT_VERSION,
      terms_hash: termsHash,
      status: "sent",
      created_by: user.id,
    })
    .select("id, token, candidate_name, candidate_email, status, created_at")
    .single();
  if (insErr || !contract) {
    return NextResponse.json({ error: "contract_insert_failed", detail: insErr?.message }, { status: 500 });
  }

  // Move the job description to "contract sent".
  await supabaseAdmin.from("job_descriptions").update({ status: "contract_sent" }).eq("id", jobId);

  // Email the candidate the signing link.
  const signUrl = `${siteUrl(req)}/radningarsamningur/${token}`;
  try {
    const firstName = candidateName.split(" ")[0];
    const html = `
<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:32px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 8px;color:#111827;">Sæl/sæll ${firstName},</h2>
    <p style="margin:0 0 16px;color:#4b5563;">
      Meðfylgjandi er ráðningarsamningur þinn við <strong>${COMPANY_NAME}</strong> til rafrænnar undirritunar.
      Smelltu á hnappinn til að skoða og undirrita.
    </p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${signUrl}" style="background:#059669;color:white;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;display:inline-block;">
        Skoða og undirrita samning
      </a>
    </p>
    <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;">Ef hnappurinn virkar ekki, afritaðu þessa slóð: ${signUrl}</p>
    <p style="margin:18px 0 0;color:#9ca3af;font-size:12px;">${COMPANY_NAME} · kt. ${COMPANY_KENNITALA} · Langholtsvegi 111, 104 Reykjavík</p>
  </div>
</body></html>`;
    await sendEmail({
      to: candidateEmail,
      bcc: ["contact@lifelinehealth.is"],
      subject: `Ráðningarsamningur til undirritunar — ${COMPANY_NAME}`,
      html,
      text: `Sæl/sæll ${firstName}, meðfylgjandi er ráðningarsamningur þinn við ${COMPANY_NAME} til rafrænnar undirritunar: ${signUrl}`,
    });
  } catch (e) {
    console.error("[employment-contract] send email failed:", (e as Error).message);
  }

  return NextResponse.json({ contract, sign_url: signUrl }, { status: 201 });
}
