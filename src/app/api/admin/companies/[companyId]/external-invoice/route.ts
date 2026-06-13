// Attach an externally-generated PayDay invoice (PDF + basic fields) to
// a company. Stores the PDF in the private company-invoice-pdfs bucket
// and inserts a company_invoices row (payday_invoice_id NULL → the
// PayDay status sync skips it). Shows in the Invoices section and counts
// as B2B income in accounting.
//
// POST   multipart: file, invoice_number, amount_total, status?, issued_at?
// DELETE ?id=…  — remove the row + its stored PDF
//
// Tables: supabase/migration-external-invoices.sql.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "company-invoice-pdfs";
const MAX_BYTES = 15 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["draft", "sent", "paid", "cancelled"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  if (!UUID_RE.test(companyId)) return NextResponse.json({ error: "bad_company" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const invoiceNumber = String(form?.get("invoice_number") || "").trim();
  const amountTotal = Math.round(Number(form?.get("amount_total")));
  const statusIn = String(form?.get("status") || "sent");
  const status = STATUSES.includes(statusIn) ? statusIn : "sent";
  const issuedAt = String(form?.get("issued_at") || "").trim();
  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "pdf_required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  if (!Number.isInteger(amountTotal) || amountTotal < 0) {
    return NextResponse.json({ error: "amount_required" }, { status: 400 });
  }
  const issuedISO = /^\d{4}-\d{2}-\d{2}/.test(issuedAt) ? new Date(issuedAt).toISOString() : new Date().toISOString();

  const id = crypto.randomUUID();
  const safe = (invoiceNumber || "invoice").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const storagePath = `${companyId}/${id}-${safe}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let upErr = (await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buffer, { contentType: "application/pdf", upsert: false })).error;
  if (upErr && /bucket/i.test(upErr.message)) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false }).catch(() => null);
    upErr = (await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buffer, { contentType: "application/pdf", upsert: false })).error;
  }
  if (upErr) return NextResponse.json({ error: `upload_failed: ${upErr.message}` }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("company_invoices")
    .insert({
      id,
      company_id: companyId,
      payday_invoice_id: null,
      payday_invoice_number: invoiceNumber || null,
      status,
      currency: "ISK",
      amount_net: amountTotal,
      amount_total: amountTotal,
      issued_at: issuedISO,
      pdf_storage_path: storagePath,
      pdf_url: `/api/admin/companies/${companyId}/external-invoice/${id}/pdf`,
      created_by: auth.id,
    })
    .select("id")
    .single();
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]).catch(() => null);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { data: row } = await supabaseAdmin
    .from("company_invoices").select("pdf_storage_path, payday_invoice_id").eq("id", id).eq("company_id", companyId).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Only external (manually-attached) invoices are deletable here.
  if (row.payday_invoice_id) return NextResponse.json({ error: "not_external" }, { status: 400 });
  const { error } = await supabaseAdmin.from("company_invoices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (row.pdf_storage_path) await supabaseAdmin.storage.from(BUCKET).remove([row.pdf_storage_path as string]).catch(() => null);
  return NextResponse.json({ ok: true });
}
