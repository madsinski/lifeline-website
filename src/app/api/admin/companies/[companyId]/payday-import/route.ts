// Import all of a company's invoices from PayDay — including invoices
// created directly in PayDay (outside the website admin). Lists the
// company's PayDay customer invoices and upserts them into
// company_invoices by payday_invoice_id (insert new, refresh status /
// amounts on existing). PDFs open via the existing PayDay proxy.
//
// POST → { imported, updated, total } | { error: 'no_customer' }
//
// Requires companies.payday_customer_id (set when the website first
// created an invoice/customer). Status maps: PAID→paid, CANCELLED &
// CREDIT→cancelled (excluded from income), DRAFT→draft, else→sent.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";
import { getToken, paydayPdfUrl } from "@/lib/payday";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE = process.env.PAYDAY_BASE_URL || "https://api.payday.is";

type PaydayInvoice = {
  id: string; number?: string | number; status?: string;
  invoiceDate?: string; dueDate?: string; paidDate?: string;
  amountIncludingVat?: number; amountExcludingVat?: number; currencyCode?: string;
  customer?: { id?: string };
};

function mapStatus(s: string | undefined): string {
  const u = (s || "").toUpperCase();
  if (u === "PAID") return "paid";
  if (u === "CANCELLED" || u === "CREDIT" || u === "DELETED") return "cancelled";
  if (u === "DRAFT") return "draft";
  return "sent";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  if (!UUID_RE.test(companyId)) return NextResponse.json({ error: "bad_company" }, { status: 400 });

  const { data: company } = await supabaseAdmin
    .from("companies").select("payday_customer_id").eq("id", companyId).maybeSingle();
  const customerId = company?.payday_customer_id as string | null;
  if (!customerId) {
    return NextResponse.json({ error: "no_customer", message: "This company has no PayDay customer linked yet. Generate one invoice from the admin first, or attach the PDF manually." }, { status: 400 });
  }

  const token = await getToken();
  if (!token) return NextResponse.json({ error: "payday_auth_failed" }, { status: 502 });
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  // Page through this customer's invoices.
  const invoices: PaydayInvoice[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${BASE}/invoices?customerId=${customerId}&perPage=100&page=${page}`, { headers });
    if (!res.ok) return NextResponse.json({ error: `payday_list_http_${res.status}` }, { status: 502 });
    const json = await res.json().catch(() => null) as { invoices?: PaydayInvoice[]; pages?: number } | null;
    const batch = (json?.invoices || []).filter((x) => x.customer?.id === customerId);
    invoices.push(...batch);
    if (!json?.pages || page >= json.pages) break;
  }

  // Existing local rows by payday id.
  const { data: existing } = await supabaseAdmin
    .from("company_invoices").select("id, payday_invoice_id").eq("company_id", companyId).not("payday_invoice_id", "is", null);
  const byPayday = new Map((existing || []).map((r) => [r.payday_invoice_id as string, r.id as string]));

  let imported = 0, updated = 0;
  for (const inv of invoices) {
    const total = Math.round(inv.amountIncludingVat ?? 0);
    const net = Math.round(inv.amountExcludingVat ?? inv.amountIncludingVat ?? 0);
    const row = {
      status: mapStatus(inv.status),
      currency: inv.currencyCode || "ISK",
      amount_net: net,
      amount_total: total,
      issued_at: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString() : new Date().toISOString(),
      due_at: inv.dueDate ? new Date(inv.dueDate).toISOString() : null,
      paid_at: inv.paidDate ? new Date(inv.paidDate).toISOString() : null,
      payday_invoice_number: inv.number != null ? String(inv.number) : null,
      pdf_url: paydayPdfUrl(inv.id),
    };
    const localId = byPayday.get(inv.id);
    if (localId) {
      await supabaseAdmin.from("company_invoices").update(row).eq("id", localId);
      updated++;
    } else {
      const { error } = await supabaseAdmin.from("company_invoices").insert({
        company_id: companyId,
        payday_invoice_id: inv.id,
        created_by: auth.id,
        ...row,
      });
      if (!error) imported++;
    }
  }

  return NextResponse.json({ ok: true, imported, updated, total: invoices.length });
}
