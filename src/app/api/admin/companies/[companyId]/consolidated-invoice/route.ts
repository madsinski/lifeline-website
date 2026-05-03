import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { ensurePaydayCustomer, createPaydayInvoice, paydayPdfUrl } from "@/lib/payday";
import { logAdminAction } from "@/lib/audit";

// Consolidated invoice for a parent (municipality-style) company: one
// PayDay invoice with one line per active sub-company, billed to the
// parent's billing contact. Use when finance wants a single bill for
// the whole organisation instead of one invoice per sub.
//
// Quantity per sub can be overridden on the request; if not, we use
// company_members count per sub (falls back to biody-placeholder
// clients when there's no roster yet).

export const maxDuration = 60;

type SubOverride = {
  company_id: string;
  quantity?: number;
  unit_price?: number;
  label?: string;
};

type Body = {
  subs?: SubOverride[];           // optional per-sub overrides
  include_parent?: boolean;       // include the parent itself as a line (default: yes, if it has employees)
  notes?: string;
  send_email?: boolean;
  create_claim?: boolean;
  create_electronic_invoice?: boolean;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId: parentId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body: Body = await req.json().catch(() => ({}));

  const { data: parent } = await supabaseAdmin
    .from("companies")
    .select("id, name, kennitala_encrypted, payday_customer_id, parent_company_id, billing_contact_email, billing_contact_name, assessment_unit_price")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) return NextResponse.json({ error: "company_not_found" }, { status: 404 });
  if (parent.parent_company_id) {
    return NextResponse.json({ error: "not_a_parent", detail: "Consolidated invoices are only issued at the parent level." }, { status: 400 });
  }

  const { data: decKt } = await supabaseAdmin.rpc("dec_kennitala", { p_enc: parent.kennitala_encrypted });
  const kennitala = (decKt as string | null) || "";
  if (!kennitala) return NextResponse.json({ error: "company_kennitala_missing" }, { status: 400 });

  // Collect the parent + its active children.
  const { data: children } = await supabaseAdmin
    .from("companies")
    .select("id, name, status, assessment_unit_price")
    .eq("parent_company_id", parentId)
    .neq("status", "archived")
    .order("name", { ascending: true });

  const subIds = [parent.id, ...((children || []).map((c) => c.id))];
  // Count company_members per sub (what we'd normally bill for).
  const counts = new Map<string, number>();
  for (const sid of subIds) {
    const { count } = await supabaseAdmin
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", sid);
    counts.set(sid, count || 0);
    // Fallback for admin-created companies with no roster yet: count
    // clients directly (these are Biody placeholders + self-signups).
    if ((count || 0) === 0) {
      const { count: clientCount } = await supabaseAdmin
        .from("clients_decrypted")
        .select("id", { count: "exact", head: true })
        .eq("company_id", sid);
      if ((clientCount || 0) > 0) counts.set(sid, clientCount || 0);
    }
  }

  const overrideMap = new Map<string, SubOverride>();
  for (const o of body.subs || []) overrideMap.set(o.company_id, o);

  // Build line items.
  const includeParentLine = body.include_parent ?? ((counts.get(parent.id) || 0) > 0);
  const allRows: Array<{ id: string; name: string; unit_price: number }> = [];
  if (includeParentLine) {
    allRows.push({ id: parent.id, name: parent.name, unit_price: parent.assessment_unit_price || 49900 });
  }
  for (const c of children || []) {
    allRows.push({ id: c.id, name: c.name, unit_price: c.assessment_unit_price || parent.assessment_unit_price || 49900 });
  }

  const lines: Array<{ description: string; quantity: number; unitPriceExcludingVat: number; vatPercentage: number; sub_id: string }> = [];
  let subtotal = 0;
  for (const row of allRows) {
    const override = overrideMap.get(row.id);
    const quantity = override?.quantity ?? (counts.get(row.id) || 0);
    const unitPrice = override?.unit_price ?? row.unit_price;
    if (quantity <= 0) continue; // skip empty subs
    const label = override?.label || `Lifeline Health Assessment — ${row.name}`;
    lines.push({
      description: label,
      quantity,
      unitPriceExcludingVat: unitPrice,
      vatPercentage: 0,
      sub_id: row.id,
    });
    subtotal += quantity * unitPrice;
  }

  if (lines.length === 0) {
    return NextResponse.json({ error: "nothing_to_invoice", detail: "No subs with employees to bill." }, { status: 400 });
  }

  // Step 1: PayDay customer on the parent (billing email = parent's billing_contact_email).
  const customerRes = await ensurePaydayCustomer({
    companyId: parent.id,
    kennitala,
    name: parent.name,
    email: parent.billing_contact_email || null,
    existingPaydayCustomerId: parent.payday_customer_id,
  });
  if (!customerRes.ok || !customerRes.customer_id) {
    return NextResponse.json({
      error: "payday_customer_failed",
      detail: customerRes.error,
      raw: customerRes.raw,
    }, { status: 502 });
  }

  // Step 2: one invoice, many lines.
  // Keep the reference in the same format the single-invoice flow uses
  // (which we know PayDay accepts): `ll:<uuid>`. We don't need a
  // "consolidated" marker in the reference — the invoice is identified
  // as consolidated by having multiple line_items in company_invoices.
  const invoiceRes = await createPaydayInvoice({
    customerId: customerRes.customer_id,
    description: `Lifeline Health samheildarreikningur - ${parent.name}${body.notes ? ` (${body.notes})` : ""}`,
    currencyCode: "ISK",
    createClaim: body.create_claim ?? true,
    createElectronicInvoice: body.create_electronic_invoice ?? false,
    sendEmail: body.send_email ?? true,
    reference: `ll:${parent.id}`,
    lines: lines.map(({ sub_id: _sub, ...rest }) => rest),
  });
  if (!invoiceRes.ok) {
    return NextResponse.json({
      error: "payday_invoice_failed",
      detail: invoiceRes.error,
      raw: invoiceRes.raw,
    }, { status: 502 });
  }

  // Record on the parent row — keeps the consolidated invoice discoverable
  // under the parent in the admin UI.
  const amountTotal = subtotal;
  const { error } = await supabaseAdmin
    .from("company_invoices")
    .insert({
      company_id: parent.id,
      payday_invoice_id: invoiceRes.invoice_id || null,
      payday_invoice_number: invoiceRes.invoice_number || null,
      status: "sent",
      currency: "ISK",
      unit_price: 0,          // multi-line — no single unit price
      quantity: lines.reduce((sum, l) => sum + l.quantity, 0),
      amount_net: amountTotal,
      amount_total: amountTotal,
      vat_rate: 0,
      line_items: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPriceExcludingVat: l.unitPriceExcludingVat,
        vatPercentage: l.vatPercentage,
        sub_id: l.sub_id,
      })),
      issued_at: invoiceRes.issued_at || new Date().toISOString(),
      due_at: invoiceRes.due_at || new Date(Date.now() + 14 * 86_400_000).toISOString(),
      pdf_url: invoiceRes.invoice_id ? paydayPdfUrl(invoiceRes.invoice_id) : null,
      created_by: user.id,
    });

  if (error) {
    console.error("[consolidated-invoice] DB insert failed:", error);
  }

  // Mirror into the unified payments ledger. The single-invoice route
  // already does this; keep them symmetric so every invoice — single
  // or consolidated — surfaces on /admin/business Payments.
  try {
    await supabaseAdmin.from("payments").insert({
      owner_type: "company",
      owner_id: parent.id,
      owner_company_id: parent.id,
      owner_company_name: parent.name,
      amount_isk: amountTotal,
      currency: "ISK",
      description: `Samheildarreikningur · ${lines.length} línur · ${lines.reduce((s, l) => s + l.quantity, 0)} mælingar`,
      provider: "payday",
      provider_reference: invoiceRes.invoice_number || invoiceRes.invoice_id || null,
      status: "pending",
      related_type: "company_invoice",
      related_id: null,
      pdf_url: invoiceRes.invoice_id ? paydayPdfUrl(invoiceRes.invoice_id) : null,
    });
  } catch (e) {
    console.error("[consolidated-invoice] payments ledger mirror failed:", e);
  }

  await logAdminAction(req, {
    actor: { id: user.id, email: user.email },
    action: "company.consolidated_invoice.create",
    target_type: "company",
    target_id: parent.id,
    detail: {
      amount_total: amountTotal,
      lines: lines.length,
      payday_invoice_number: invoiceRes.invoice_number || null,
    },
  });

  return NextResponse.json({
    ok: true,
    invoice_id: invoiceRes.invoice_id,
    invoice_number: invoiceRes.invoice_number,
    pdf_url: invoiceRes.invoice_id ? paydayPdfUrl(invoiceRes.invoice_id) : null,
    amount_total: amountTotal,
    lines: lines.map((l) => ({
      sub_id: l.sub_id,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unitPriceExcludingVat,
      total: l.quantity * l.unitPriceExcludingVat,
    })),
  });
}
