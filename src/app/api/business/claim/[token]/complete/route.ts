import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { findAuthUserByEmail } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";
import {
  TOS_KEY, TOS_VERSION, renderTermsOfService,
  DPA_KEY, DPA_VERSION, renderDataProcessingAgreement,
} from "@/lib/platform-terms-content";
import { renderAcceptancePdf } from "@/lib/pdf-acceptance-renderer";

// Public endpoint — consume a claim token, create / link the contact
// auth user, record TOS + DPA acceptances with audit trail + PDFs,
// flip the company from 'contact_invited' to 'active', and bind
// contact_person_id.

export const runtime = "nodejs";
export const maxDuration = 60;

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

type Body = {
  password?: string;
  signatory_name?: string;
  signatory_role?: string;
  signatory_email?: string;
  accept_tos?: boolean;
  accept_dpa?: boolean;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const tokenHash = sha256(token);
  const body: Body = await req.json().catch(() => ({}));
  const password = body.password || "";
  const signatoryName = (body.signatory_name || "").trim();
  const signatoryRole = (body.signatory_role || "").trim();
  const signatoryEmail = (body.signatory_email || "").trim().toLowerCase();

  if (password.length < 8) return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  if (!signatoryName) return NextResponse.json({ error: "signatory_name_required" }, { status: 400 });
  if (!signatoryEmail) return NextResponse.json({ error: "signatory_email_required" }, { status: 400 });
  if (!body.accept_tos) return NextResponse.json({ error: "tos_required" }, { status: 400 });
  if (!body.accept_dpa) return NextResponse.json({ error: "dpa_required" }, { status: 400 });

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, status, contact_draft_email, contact_draft_name, claim_token_expires_at")
    .eq("claim_token_hash", tokenHash)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "invalid_or_consumed" }, { status: 404 });
  if (company.status !== "contact_invited" && company.status !== "draft") {
    return NextResponse.json({ error: "already_claimed" }, { status: 409 });
  }
  if (company.claim_token_expires_at && new Date(company.claim_token_expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  // Guard: the signatory email should match the draft email the admin
  // set (case-insensitive). Protects against token leak letting a
  // different email onto the company.
  if (company.contact_draft_email && signatoryEmail !== company.contact_draft_email.toLowerCase()) {
    return NextResponse.json({ error: "email_mismatch", detail: "Use the email the invite was sent to." }, { status: 400 });
  }

  // Find or create the auth user. If they already exist (they had a
  // personal account before), we leave their password alone and simply
  // bind them as the contact.
  let userId: string;
  const existing = await findAuthUserByEmail(signatoryEmail);
  if (existing) {
    userId = existing.id;
  } else {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: signatoryEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: signatoryName, contact_for_company: company.id },
    });
    if (createErr || !created?.user) {
      return NextResponse.json({ error: "create_user_failed", detail: createErr?.message }, { status: 500 });
    }
    userId = created.user.id;
  }

  // Make sure a clients row exists so the contact also has a personal
  // profile they can sign in to. Kept optional — agreement signing is
  // the critical bit here.
  await supabaseAdmin.from("clients").upsert(
    {
      id: userId,
      email: signatoryEmail,
      full_name: signatoryName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: false },
  );

  // Record TOS + DPA acceptances with PDF certificates + email a copy.
  const clientIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const clientUa = req.headers.get("user-agent") || null;
  const acceptances = [
    { key: TOS_KEY, version: TOS_VERSION, title: "Notkunarskilmálar", text: renderTermsOfService() },
    { key: DPA_KEY, version: DPA_VERSION, title: "Gagnavinnslusamningur (DPA)", text: renderDataProcessingAgreement() },
  ];

  for (const doc of acceptances) {
    const { data: prior } = await supabaseAdmin
      .from("platform_agreement_acceptances")
      .select("id")
      .eq("user_id", userId)
      .eq("document_key", doc.key)
      .eq("document_version", doc.version)
      .maybeSingle();
    if (prior) continue;

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
      console.error("[claim-complete] acceptance insert:", doc.key, insErr?.message);
      continue;
    }
    try {
      const pdfBytes = await renderAcceptancePdf({
        userEmail: signatoryEmail,
        userId,
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
        try {
          await sendEmail({
            to: signatoryEmail,
            bcc: ["contact@lifelinehealth.is"],
            subject: `Staðfesting á samþykki — ${doc.title} ${doc.version}`,
            html: `<!doctype html><html><body style="font-family:sans-serif;padding:24px;color:#374151;"><p>Meðfylgjandi er staðfesting á samþykki þínu á <strong>${doc.title}</strong> (${doc.version}) fyrir hönd <strong>${company.name}</strong>.</p><p>— Lifeline Health ehf.</p></body></html>`,
            text: `Meðfylgjandi er staðfesting á samþykki þínu á ${doc.title} (${doc.version}) fyrir hönd ${company.name}.`,
            attachments: [{ filename: `${doc.key}-${doc.version}.pdf`, content: pdfBytes.toString("base64"), contentType: "application/pdf" }],
          });
        } catch (e) {
          console.error("[claim-complete] email:", doc.key, (e as Error).message);
        }
      } else {
        console.error("[claim-complete] pdf upload:", doc.key, upErr.message);
      }
    } catch (e) {
      console.error("[claim-complete] pdf render:", doc.key, (e as Error).message);
    }
  }

  // Flip the company: bind contact + clear the claim token + flip status.
  const { error: companyUpdErr } = await supabaseAdmin
    .from("companies")
    .update({
      status: "active",
      contact_person_id: userId,
      agreement_version: `tos_${TOS_VERSION}/dpa_${DPA_VERSION}`,
      agreement_accepted_at: new Date().toISOString(),
      claim_token_hash: null,
      claim_token_expires_at: null,
      contact_draft_email: null,
      contact_draft_name: null,
      contact_draft_phone: null,
      contact_draft_role: null,
    })
    .eq("id", company.id);
  if (companyUpdErr) {
    return NextResponse.json({ error: "activate_failed", detail: companyUpdErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, company_id: company.id, signed_in_email: signatoryEmail });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Lightweight lookup used by the claim page to pre-fill the form.
  const { token } = await params;
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  const tokenHash = sha256(token);
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, status, contact_draft_email, contact_draft_name, contact_draft_role, claim_token_expires_at")
    .eq("claim_token_hash", tokenHash)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "invalid_or_consumed" }, { status: 404 });
  if (company.status === "active") return NextResponse.json({ error: "already_claimed" }, { status: 409 });
  if (company.claim_token_expires_at && new Date(company.claim_token_expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  return NextResponse.json({
    ok: true,
    company_name: company.name,
    contact_draft_name: company.contact_draft_name,
    contact_draft_email: company.contact_draft_email,
    contact_draft_role: company.contact_draft_role,
  });
}
