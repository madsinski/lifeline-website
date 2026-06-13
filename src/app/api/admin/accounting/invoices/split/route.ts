// Split a cost invoice across several companies.
//
// POST { id, allocations: [{ company_id, amount_isk, client_count? }] }
//   Turns one expense invoice into one row per company, each with its
//   share of the amount + client count, sharing the same stored PDF.
//   The original row becomes the first allocation; the rest are
//   inserted. All siblings get the same split_group_id. Each company's
//   costs then reflect only its share — no other costing change needed.
//
// Tables: supabase/migration-cost-invoice-split.sql.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COPY_COLS = "id, month, direction, vendor, description, category, currency, amount_original, invoice_number, invoice_date, storage_path, content_type, size_bytes, ai_extracted, ai_confidence, split_group_id";

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const allocations = Array.isArray(body?.allocations) ? body.allocations : [];
  if (!UUID_RE.test(id) || allocations.length < 1) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const clean = allocations.map((a: Record<string, unknown>) => ({
    company_id: String(a?.company_id || ""),
    amount_isk: Math.round(Number(a?.amount_isk)),
    client_count: a?.client_count == null || a?.client_count === "" ? null : Math.round(Number(a.client_count)),
  }));
  for (const a of clean) {
    if (!UUID_RE.test(a.company_id) || !Number.isInteger(a.amount_isk) || a.amount_isk < 0
        || (a.client_count !== null && (!Number.isInteger(a.client_count) || a.client_count < 0))) {
      return NextResponse.json({ error: "bad_allocation" }, { status: 400 });
    }
  }

  const { data: orig, error: oErr } = await supabaseAdmin
    .from("accounting_expense_invoices").select(COPY_COLS).eq("id", id).maybeSingle();
  if (oErr || !orig) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (orig.direction === "income") return NextResponse.json({ error: "income_invoice" }, { status: 400 });

  const groupId = (orig.split_group_id as string | null) || id;
  const baseDesc = (orig.description as string | null) || (orig.vendor as string | null) || "Cost invoice";

  // First allocation reuses the original row (keeps the file owner).
  const first = clean[0];
  const { error: upErr } = await supabaseAdmin
    .from("accounting_expense_invoices")
    .update({
      company_id: first.company_id,
      amount_isk: first.amount_isk,
      client_count: first.client_count,
      split_group_id: groupId,
      description: `${baseDesc} (split)`,
    })
    .eq("id", id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Remaining allocations are new rows sharing the same PDF.
  const rest = clean.slice(1).map((a: { company_id: string; amount_isk: number; client_count: number | null }) => ({
    month: orig.month,
    direction: "cost",
    vendor: orig.vendor,
    description: `${baseDesc} (split)`,
    category: orig.category,
    currency: orig.currency,
    amount_original: null,
    invoice_number: orig.invoice_number,
    invoice_date: orig.invoice_date,
    storage_path: orig.storage_path,
    content_type: orig.content_type,
    size_bytes: orig.size_bytes,
    ai_confidence: orig.ai_confidence,
    company_id: a.company_id,
    amount_isk: a.amount_isk,
    client_count: a.client_count,
    split_group_id: groupId,
    created_by: auth.id,
  }));
  if (rest.length > 0) {
    const { error: insErr } = await supabaseAdmin.from("accounting_expense_invoices").insert(rest);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rows: clean.length });
}
