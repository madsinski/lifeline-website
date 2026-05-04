import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";
import {
  renderFullAgreementForSigning,
  THJONUSTUSKILMALAR_VERSION,
  THJONUSTUSAMNINGUR_VERSION,
  type PurchaseOrderLineItem,
} from "@/lib/agreement-templates";
import { renderAgreementPdf } from "@/lib/pdf-agreement-renderer";

export const maxDuration = 60;
// Force Node.js runtime — @react-pdf/renderer needs fs + Buffer for font loading.
export const runtime = "nodejs";

interface SignPayload {
  signatory_name: string;
  signatory_role: string;
  signatory_email: string;
  line_items: PurchaseOrderLineItem[];
  subtotal_isk: number;
  vat_isk: number;
  total_isk: number;
  billing_cadence: string;
  starts_at: string | null;
  ends_at: string | null;
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body: SignPayload = await req.json().catch(() => ({} as SignPayload));

  // ─── Authz: primary contact person or active staff ──────────
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name, kennitala_encrypted, contact_person_id, agreement_signed_at")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const isPrimary = company.contact_person_id === user.id;
  const staff = await isStaff(user.id);
  if (!isPrimary && !staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // ─── Basic payload validation ───────────────────────────────
  if (!body.signatory_name?.trim() || !body.signatory_role?.trim() || !body.signatory_email?.trim()) {
    return NextResponse.json({ error: "signatory_name, signatory_role, signatory_email are required" }, { status: 400 });
  }
  if (!Array.isArray(body.line_items) || body.line_items.length === 0) {
    return NextResponse.json({ error: "at_least_one_line_item_required" }, { status: 400 });
  }

  // ─── Get company kennitala (decrypted) for the doc text ─────
  const { data: knData } = await supabaseAdmin.rpc("dec_kennitala", { p_enc: company.kennitala_encrypted });
  const rawKennitala = (knData as string | null) || "";
  const companyKennitala = rawKennitala.length === 10
    ? `${rawKennitala.slice(0, 6)}-${rawKennitala.slice(6)}`
    : rawKennitala;

  // ─── Generate PO number ─────────────────────────────────────
  const { data: poNumData, error: poNumErr } = await supabaseAdmin.rpc("generate_b2b_po_number");
  if (poNumErr || !poNumData) {
    return NextResponse.json({ error: "po_number_failed", detail: poNumErr?.message }, { status: 500 });
  }
  const poNumber = poNumData as string;

  // ─── Canonical hash of the terms text ───────────────────────
  const canonicalText = renderFullAgreementForSigning(
    { companyName: company.name, companyKennitala },
    {
      companyName: company.name,
      companyKennitala,
      poNumber,
      lineItems: body.line_items,
      subtotalIsk: body.subtotal_isk,
      vatIsk: body.vat_isk,
      totalIsk: body.total_isk,
      billingCadence: body.billing_cadence,
      startsAt: body.starts_at,
      endsAt: body.ends_at,
    },
  );
  const termsHash = sha256Hex(canonicalText);
  const agreementVersion = `${THJONUSTUSAMNINGUR_VERSION}+${THJONUSTUSKILMALAR_VERSION}`;

  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");

  // ─── Insert agreement row ───────────────────────────────────
  const { data: agreement, error: insErr } = await supabaseAdmin
    .from("b2b_agreements")
    .insert({
      company_id: companyId,
      agreement_version: agreementVersion,
      terms_hash: termsHash,
      signatory_name: body.signatory_name.trim(),
      signatory_role: body.signatory_role.trim(),
      signatory_email: body.signatory_email.trim().toLowerCase(),
      signatory_auth_user_id: user.id,
      signatory_ip: ip,
      signatory_user_agent: ua,
    })
    .select("id, signed_at")
    .single();
  if (insErr || !agreement) {
    return NextResponse.json({ error: "agreement_insert_failed", detail: insErr?.message }, { status: 500 });
  }

  // ─── Insert purchase order row ──────────────────────────────
  const { error: poErr } = await supabaseAdmin
    .from("b2b_purchase_orders")
    .insert({
      company_id: companyId,
      agreement_id: agreement.id,
      po_number: poNumber,
      line_items: body.line_items,
      subtotal_isk: body.subtotal_isk,
      vat_isk: body.vat_isk,
      total_isk: body.total_isk,
      billing_cadence: body.billing_cadence,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      status: "signed",
    });
  if (poErr) {
    await supabaseAdmin.from("b2b_agreements").delete().eq("id", agreement.id);
    return NextResponse.json({ error: "po_insert_failed", detail: poErr.message }, { status: 500 });
  }

  // ─── Render PDF server-side (real text, not image) ──────────
  let pdfBytes: Buffer;
  try {
    pdfBytes = await renderAgreementPdf({
      companyName: company.name,
      companyKennitala,
      poNumber,
      lineItems: body.line_items,
      subtotalIsk: body.subtotal_isk,
      vatIsk: body.vat_isk,
      totalIsk: body.total_isk,
      billingCadence: body.billing_cadence,
      startsAt: body.starts_at,
      endsAt: body.ends_at,
      signatoryName: body.signatory_name.trim(),
      signatoryRole: body.signatory_role.trim(),
      signatoryEmail: body.signatory_email.trim().toLowerCase(),
      signedAt: agreement.signed_at,
      signatoryIp: ip,
      signatoryUserAgent: ua,
      termsHash,
      agreementVersion,
    });
  } catch (e) {
    console.error("[b2b-sign] PDF render failed:", (e as Error).message);
    return NextResponse.json({ error: "pdf_render_failed", detail: (e as Error).message }, { status: 500 });
  }
  const pdfHash = sha256Hex(pdfBytes);

  // ─── Upload PDF to storage ──────────────────────────────────
  const storagePath = `${companyId}/${agreement.id}.pdf`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("b2b-signed-documents")
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (upErr) {
    console.error("[b2b-sign] PDF upload failed:", upErr.message);
  }

  await supabaseAdmin
    .from("b2b_agreements")
    .update({ pdf_storage_path: upErr ? null : storagePath, pdf_sha256: pdfHash })
    .eq("id", agreement.id);

  // ─── Mark company as signed ─────────────────────────────────
  await supabaseAdmin
    .from("companies")
    .update({
      agreement_signed_at: agreement.signed_at,
      agreement_id: agreement.id,
    })
    .eq("id", companyId);

  // ─── Email PDF to signatory + BCC ops ───────────────────────
  if (!upErr) {
    try {
      const fmt = (n: number) => n.toLocaleString("is-IS") + " kr";
      const subject = `Undirritaður þjónustusamningur — ${company.name} (${poNumber})`;
      const html = `
<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:32px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 8px;color:#111827;">Takk fyrir að undirrita, ${body.signatory_name.split(" ")[0]}.</h2>
    <p style="margin:0 0 16px;color:#4b5563;">
      Meðfylgjandi er undirritaður þjónustusamningur og innkaupapöntun fyrir <strong>${company.name}</strong>.
    </p>
    <ul style="margin:0 0 16px;color:#4b5563;padding-left:20px;line-height:1.6;">
      <li>Pöntun: <strong>${poNumber}</strong></li>
      <li>Samtals: <strong>${fmt(body.total_isk)}</strong></li>
      <li>Undirritað: ${new Date(agreement.signed_at).toLocaleString("is-IS")}</li>
    </ul>
    <p style="margin:0 0 8px;color:#4b5563;">Afrit er einnig varðveitt í Lifeline þjónustukerfinu.</p>
    <p style="margin:18px 0 0;color:#9ca3af;font-size:12px;">Lifeline Health ehf. · kt. 590925-1440 · Langholtsvegi 111, 104 Reykjavík</p>
  </div>
</body></html>`;
      await sendEmail({
        to: body.signatory_email,
        bcc: ["contact@lifelinehealth.is"],
        subject,
        html,
        text: `Takk fyrir að undirrita. Meðfylgjandi er undirritaður þjónustusamningur og innkaupapöntun fyrir ${company.name}. Pöntun ${poNumber}, samtals ${fmt(body.total_isk)}.`,
        attachments: [{
          filename: `${poNumber}-${company.name.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`,
          content: pdfBytes.toString("base64"),
          contentType: "application/pdf",
        }],
      });
    } catch (e) {
      console.error("[b2b-sign] email failed:", (e as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    agreement_id: agreement.id,
    po_number: poNumber,
    signed_at: agreement.signed_at,
    pdf_storage_path: upErr ? null : storagePath,
    pdf_uploaded: !upErr,
  });
}
