// Cost-invoice uploads for the accounting tab.
//
// GET    /api/admin/accounting/invoices?month=YYYY-MM — list + signed PDF URLs
// POST   /api/admin/accounting/invoices — multipart upload (file, month,
//        category?, company_id?) → store PDF in the private
//        accounting-invoices bucket, AI-extract vendor/amount/period/
//        client-count, insert the row. month="auto" (bulk dump): the AI
//        decides the accounting month from the invoice date, and
//        duplicates (same vendor + invoice number already stored) are
//        skipped with { duplicate: true }. Extraction is best-effort:
//        if the model fails the invoice is still saved (in the current
//        month when auto) and the fields can be fixed via PATCH.
// PATCH  /api/admin/accounting/invoices — edit extracted fields by id
// DELETE /api/admin/accounting/invoices?id=… — remove row + stored file
//
// Tables: supabase/migration-accounting.sql (accounting_expense_invoices).
// A single invoice can cover a whole month of clients (e.g. Sameind's
// monthly blood-test invoice) — client_count captures how many.

import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { MONTH_RE, monthBounds, getFxRate, EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/accounting";

export const runtime = "nodejs";
export const maxDuration = 120;

const BUCKET = "accounting-invoices";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const MODEL = "gpt-5.4";

const extractionSchema = z.object({
  direction: z.enum(["cost", "income"]),
  vendor: z.string().nullable(),
  invoice_number: z.string().nullable(),
  invoice_date: z.string().nullable(),   // YYYY-MM-DD
  total_amount: z.number().nullable(),   // grand total incl. VAT
  currency: z.string().nullable(),       // ISK | USD | EUR | …
  client_count: z.number().nullable(),   // people/tests covered, if stated
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().nullable(),    // one line, what was bought
  confidence: z.enum(["high", "medium", "low"]),
  warnings: z.array(z.string()),
});

const SELECT_COLS =
  "id, month, direction, vendor, description, category, amount_isk, currency, amount_original, invoice_number, invoice_date, client_count, company_id, company:companies(name), paid_by, reimbursed_at, payer:staff!paid_by(name), storage_path, content_type, size_bytes, ai_confidence, created_at";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function withSignedUrls(rows: Array<Record<string, unknown>>) {
  return Promise.all(rows.map(async (r) => {
    let url: string | null = null;
    if (r.storage_path) {
      const { data } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(r.storage_path as string, 600);
      url = data?.signedUrl || null;
    }
    return { ...r, file_url: url };
  }));
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const month = req.nextUrl.searchParams.get("month") || "";
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "bad_month" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("accounting_expense_invoices")
    .select(SELECT_COLS)
    .eq("month", monthBounds(month).monthDate)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoices: await withSignedUrls(data || []) });
}

async function extractInvoice(buffer: Buffer, contentType: string, monthNote: string) {
  if (!process.env.OPENAI_API_KEY) return null;
  const systemPrompt = `You extract structured data from a COST invoice received by Lifeline Health ehf. (an Icelandic health company). The document is an invoice from a supplier — e.g. Sameind (blood-test lab, typically ~9.000 ISK per client, one invoice can cover many clients in a month), measurement providers, doctors, or SaaS vendors.

RULES
  • direction — READ WHO ISSUED THE INVOICE. Lifeline Health ehf. is OUR company. If Lifeline Health is the ISSUER/seller (an outgoing invoice TO a customer — e.g. a municipality like Vestmannaeyjabær, or a company buying health checks), set direction="income" and put the CUSTOMER's name in vendor. If Lifeline Health is the recipient/buyer, set direction="cost" with the supplier's name in vendor.
  • Amounts: total_amount is the grand total payable (including VAT if any). Icelandic format uses "." as thousands separator and "," for decimals — "129.000 kr." means 129000 ISK.
  • currency: the invoice currency code (ISK, USD, EUR, …). Icelandic invoices showing "kr." are ISK.
  • invoice_date: the issue date as YYYY-MM-DD.
  • client_count: if the invoice states a number of clients/tests/persons (e.g. line items "Blóðrannsókn × 14"), return that count; otherwise null. Never invent it.
  • category: blood_tests for lab/blood work (Sameind, rannsóknarstofa), measurements for body-composition/measurement services, doctor for physician services, saas for software subscriptions, other otherwise.
  • description: one short line in English describing what was bought (e.g. "Blood panels for 14 clients, May 2026").
  • Put anything ambiguous (unreadable totals, unclear currency, multiple candidate totals) into warnings.
  • ${monthNote}`;
  const result = await generateText({
    model: openai(MODEL),
    output: Output.object({ schema: extractionSchema }),
    system: systemPrompt,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Extract the invoice data. Follow the rules in the system prompt." },
        contentType === "application/pdf"
          ? { type: "file" as const, data: buffer.toString("base64"), mediaType: "application/pdf", filename: "invoice.pdf" }
          : { type: "image" as const, image: `data:${contentType};base64,${buffer.toString("base64")}` },
      ],
    }],
    maxOutputTokens: 2000,
  });
  return (result.experimental_output as z.infer<typeof extractionSchema>) || null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const monthParam = String(form?.get("month") || "");
  const autoMonth = monthParam === "auto";
  const forcedCategory = String(form?.get("category") || "");
  const companyId = String(form?.get("company_id") || "");
  if (!(file instanceof File) || (!autoMonth && !MONTH_RE.test(monthParam))) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (companyId && !UUID_RE.test(companyId)) {
    return NextResponse.json({ error: "bad_company" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Extraction runs BEFORE storage so an auto-month dump can file the
  // invoice under its own date and skip duplicates without leaving
  // orphaned files. Best-effort — a failed parse still saves the row.
  let extracted: z.infer<typeof extractionSchema> | null = null;
  let extractError: string | null = null;
  try {
    extracted = await extractInvoice(
      buffer, file.type,
      autoMonth
        ? "Determine the correct accounting month yourself from the invoice date — extract invoice_date carefully."
        : `This invoice is being booked into accounting month ${monthParam}.`,
    );
  } catch (e) {
    extractError = (e as Error).message;
  }

  const aiMonth = (extracted?.invoice_date || "").slice(0, 7);
  const month = autoMonth
    ? (MONTH_RE.test(aiMonth) ? aiMonth : new Date().toISOString().slice(0, 7))
    : monthParam;
  const { monthDate } = monthBounds(month);

  // Dump dedupe: the same supplier invoice already stored → skip.
  if (extracted?.invoice_number && extracted?.vendor) {
    const { data: dup } = await supabaseAdmin
      .from("accounting_expense_invoices")
      .select("id, month, amount_isk")
      .eq("invoice_number", extracted.invoice_number)
      .ilike("vendor", extracted.vendor)
      .maybeSingle();
    if (dup) {
      return NextResponse.json({
        ok: true, duplicate: true, existing_id: dup.id,
        month: dup.month, vendor: extracted.vendor, invoice_number: extracted.invoice_number,
      });
    }
  }

  const id = crypto.randomUUID();
  const safeName = (file.name || "invoice").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const storagePath = `${month}/${id}-${safeName}`;

  let upErr = (await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })).error;
  if (upErr && /bucket/i.test(upErr.message)) {
    // First use — bucket may not exist yet if the migration's storage
    // insert wasn't run. Create it and retry once.
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false }).catch(() => null);
    upErr = (await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })).error;
  }
  if (upErr) return NextResponse.json({ error: `upload_failed: ${upErr.message}` }, { status: 500 });

  const currency = (extracted?.currency || "ISK").toUpperCase();
  let amountIsk = 0;
  const warnings = [...(extracted?.warnings || [])];
  if (extractError) warnings.push(`AI extraction failed: ${extractError}`);
  if (extracted?.total_amount != null) {
    if (currency === "ISK") {
      amountIsk = Math.round(extracted.total_amount);
    } else if (currency === "USD") {
      const fx = await getFxRate(month);
      if (fx) {
        amountIsk = Math.round(extracted.total_amount * fx.usd_isk);
        warnings.push(`Converted $${extracted.total_amount} at ${fx.usd_isk} USD/ISK`);
      } else {
        warnings.push("USD invoice but no FX rate — amount_isk left at 0, edit manually.");
      }
    } else {
      warnings.push(`Currency ${currency} not auto-converted — edit amount_isk manually.`);
    }
  }
  const category: ExpenseCategory =
    (EXPENSE_CATEGORIES as readonly string[]).includes(forcedCategory)
      ? (forcedCategory as ExpenseCategory)
      : extracted?.category || "other";

  const { data, error } = await supabaseAdmin
    .from("accounting_expense_invoices")
    .insert({
      month: monthDate,
      direction: extracted?.direction === "income" ? "income" : "cost",
      vendor: extracted?.vendor || null,
      description: extracted?.description || null,
      category,
      amount_isk: amountIsk,
      currency,
      amount_original: extracted?.total_amount ?? null,
      invoice_number: extracted?.invoice_number || null,
      invoice_date: /^\d{4}-\d{2}-\d{2}$/.test(extracted?.invoice_date || "") ? extracted!.invoice_date : null,
      client_count: extracted?.client_count != null ? Math.round(extracted.client_count) : null,
      company_id: companyId || null,
      storage_path: storagePath,
      content_type: file.type,
      size_bytes: file.size,
      ai_extracted: extracted ? { ...extracted, warnings } : { error: extractError },
      ai_confidence: extracted?.confidence || null,
      created_by: auth.id,
    })
    .select(SELECT_COLS)
    .single();
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]).catch(() => null);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const [withUrl] = await withSignedUrls([data]);
  return NextResponse.json({ ok: true, invoice: withUrl, warnings });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const fields: Record<string, unknown> = {};
  if (body.vendor !== undefined) fields.vendor = body.vendor === null ? null : String(body.vendor).trim();
  if (body.description !== undefined) fields.description = body.description === null ? null : String(body.description).trim();
  if (body.category !== undefined) {
    if (!(EXPENSE_CATEGORIES as readonly string[]).includes(String(body.category))) {
      return NextResponse.json({ error: "bad_category" }, { status: 400 });
    }
    fields.category = body.category;
  }
  if (body.amount_isk !== undefined) {
    const n = Number(body.amount_isk);
    if (!Number.isInteger(n) || n < 0) return NextResponse.json({ error: "bad_amount" }, { status: 400 });
    fields.amount_isk = n;
  }
  if (body.invoice_number !== undefined) fields.invoice_number = body.invoice_number === null ? null : String(body.invoice_number).trim();
  if (body.invoice_date !== undefined) {
    if (body.invoice_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.invoice_date))) {
      return NextResponse.json({ error: "bad_date" }, { status: 400 });
    }
    fields.invoice_date = body.invoice_date;
  }
  if (body.client_count !== undefined) {
    const n = body.client_count === null ? null : Number(body.client_count);
    if (n !== null && (!Number.isInteger(n) || n < 0)) return NextResponse.json({ error: "bad_count" }, { status: 400 });
    fields.client_count = n;
  }
  if (body.company_id !== undefined) {
    if (body.company_id !== null && !UUID_RE.test(String(body.company_id))) {
      return NextResponse.json({ error: "bad_company" }, { status: 400 });
    }
    fields.company_id = body.company_id;
  }
  if (body.paid_by !== undefined) {
    if (body.paid_by !== null && !UUID_RE.test(String(body.paid_by))) {
      return NextResponse.json({ error: "bad_payer" }, { status: 400 });
    }
    fields.paid_by = body.paid_by;
    // Switching back to company-paid clears any reimbursement stamp.
    if (body.paid_by === null) fields.reimbursed_at = null;
  }
  if (body.reimbursed !== undefined) {
    fields.reimbursed_at = body.reimbursed ? new Date().toISOString() : null;
  }
  if (body.direction !== undefined) {
    if (body.direction !== "cost" && body.direction !== "income") {
      return NextResponse.json({ error: "bad_direction" }, { status: 400 });
    }
    fields.direction = body.direction;
  }
  if (body.month !== undefined) {
    const m = String(body.month);
    if (!MONTH_RE.test(m)) return NextResponse.json({ error: "bad_month" }, { status: 400 });
    fields.month = monthBounds(m).monthDate;
  }
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: "no_fields" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("accounting_expense_invoices")
    .update(fields)
    .eq("id", id)
    .select(SELECT_COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const [withUrl] = await withSignedUrls([data]);
  return NextResponse.json({ ok: true, invoice: withUrl });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { data: row } = await supabaseAdmin
    .from("accounting_expense_invoices")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabaseAdmin.from("accounting_expense_invoices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (row?.storage_path) {
    await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]).catch(() => null);
  }
  return NextResponse.json({ ok: true });
}
