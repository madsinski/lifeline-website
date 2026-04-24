import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { renderAcceptancePdf } from "@/lib/pdf-acceptance-renderer";
import { sendEmail } from "@/lib/email";
import { STAFF_DOC_REGISTRY } from "@/lib/staff-terms-content";

// Accept a staff-level legal document. Body: { document_key, typed_signature? }
// Writes a staff_agreement_acceptances row, renders + uploads the PDF
// certificate, emails a copy to the signer. Idempotent at the
// (staff_id, document_key, document_version) unique key.

export const maxDuration = 60;

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

type Body = {
  document_key?: string;
  typed_signature?: string;
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, name, email, role, active")
    .eq("id", user.id)
    .maybeSingle();
  if (!staffRow || !staffRow.active) {
    return NextResponse.json({ error: "not_active_staff" }, { status: 403 });
  }

  const body: Body = await req.json().catch(() => ({}));
  const key = (body.document_key || "").trim();
  const typedSig = (body.typed_signature || "").trim();
  if (!key) return NextResponse.json({ error: "document_key_required" }, { status: 400 });
  if (!typedSig) return NextResponse.json({ error: "typed_signature_required" }, { status: 400 });

  const meta = STAFF_DOC_REGISTRY[key];
  if (!meta) return NextResponse.json({ error: "unknown_document", detail: key }, { status: 400 });

  const text = meta.render();
  const textHash = sha256(text);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const ua = req.headers.get("user-agent") || null;

  // Idempotency: if the current version already signed, return success.
  const { data: existing } = await supabaseAdmin
    .from("staff_agreement_acceptances")
    .select("id, accepted_at, pdf_storage_path, text_hash")
    .eq("staff_id", user.id)
    .eq("document_key", key)
    .eq("document_version", meta.version)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      ok: true,
      already_signed: true,
      accepted_at: existing.accepted_at,
      pdf_storage_path: existing.pdf_storage_path,
    });
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("staff_agreement_acceptances")
    .insert({
      staff_id: user.id,
      document_key: key,
      document_version: meta.version,
      document_title: meta.title,
      text_hash: textHash,
      ip,
      user_agent: ua,
      typed_signature: typedSig,
    })
    .select("id, accepted_at")
    .single();
  if (insErr || !inserted) {
    return NextResponse.json({ error: "insert_failed", detail: insErr?.message }, { status: 500 });
  }

  // PDF certificate
  let pdfStoragePath: string | null = null;
  let pdfSha: string | null = null;
  let pdfBytes: Buffer | null = null;
  try {
    pdfBytes = await renderAcceptancePdf({
      userEmail: staffRow.email || "(unknown)",
      userId: user.id,
      documentKey: key,
      documentTitle: meta.title,
      documentVersion: meta.version,
      documentText: text,
      textHash,
      ip,
      userAgent: ua,
      acceptedAt: inserted.accepted_at,
    });
    const storagePath = `${user.id}/${inserted.id}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("staff-acceptance-pdfs")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (upErr) {
      console.error("[staff-accept] PDF upload failed", upErr);
    } else {
      pdfStoragePath = storagePath;
      pdfSha = sha256(pdfBytes);
      await supabaseAdmin
        .from("staff_agreement_acceptances")
        .update({ pdf_storage_path: storagePath, pdf_sha256: pdfSha })
        .eq("id", inserted.id);
    }
  } catch (e) {
    console.error("[staff-accept] PDF render failed", e);
  }

  // Email a copy to the signer — best effort.
  if (staffRow.email && pdfBytes) {
    try {
      await sendEmail({
        to: staffRow.email,
        bcc: ["contact@lifelinehealth.is"],
        subject: `Staðfesting á samþykki — ${meta.title} ${meta.version}`,
        html: `<!doctype html><html><body style="font-family:sans-serif;padding:24px;color:#374151;"><p>Hæ ${staffRow.name || "starfsmaður"},</p><p>Meðfylgjandi er staðfesting á rafrænni undirritun þinni á <strong>${meta.title}</strong> (${meta.version}).</p><p>— Lifeline Health ehf.</p></body></html>`,
        text: `Hæ ${staffRow.name || "starfsmaður"},\n\nMeðfylgjandi er staðfesting á rafrænni undirritun þinni á ${meta.title} (${meta.version}).\n\n— Lifeline Health ehf.`,
        attachments: [{ filename: `${key}-${meta.version}.pdf`, content: pdfBytes.toString("base64"), contentType: "application/pdf" }],
      });
    } catch (e) {
      console.error("[staff-accept] email failed", e);
    }
  }

  return NextResponse.json({
    ok: true,
    acceptance_id: inserted.id,
    accepted_at: inserted.accepted_at,
    pdf_storage_path: pdfStoragePath,
  });
}
