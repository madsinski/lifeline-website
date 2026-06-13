// Global PayDay invoice import for the Payments page. Discovers every
// PayDay customer that has invoices, links each to a company (by stored
// payday_customer_id, else by kennitala via find_company_by_kennitala,
// backfilling the link), and imports + reconciles its invoices into
// company_invoices + the payments ledger. Customers it can't match are
// reported so they can be linked. See lib/payday.ts.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";
import { importCompanyInvoicesFromPayday, listPaydayCustomers, getPaydayCustomerSsn } from "@/lib/payday";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }

  const cust = await listPaydayCustomers();
  if (!cust.ok) return NextResponse.json({ error: cust.reason }, { status: 502 });

  // Map each PayDay customer to a company.
  const { data: linked } = await supabaseAdmin
    .from("companies").select("id, payday_customer_id").not("payday_customer_id", "is", null);
  const byCustomer = new Map((linked || []).map((c) => [c.payday_customer_id as string, c.id as string]));

  let imported = 0, updated = 0, companiesDone = 0;
  const unmatched: string[] = [];
  const errors: string[] = [];

  for (const c of cust.customers) {
    let companyId = byCustomer.get(c.id) || null;
    if (!companyId) {
      // Try to link by kennitala, then backfill payday_customer_id.
      const ssn = await getPaydayCustomerSsn(c.id);
      if (ssn) {
        const { data: match } = await supabaseAdmin.rpc("find_company_by_kennitala", { p_kt: ssn });
        const matchedId = typeof match === "string" ? match : null;
        if (matchedId) {
          await supabaseAdmin.from("companies").update({ payday_customer_id: c.id }).eq("id", matchedId);
          companyId = matchedId;
        }
      }
    }
    if (!companyId) { unmatched.push(c.name || c.id); continue; }
    const r = await importCompanyInvoicesFromPayday(companyId, auth.id);
    if (r.ok) { imported += r.imported; updated += r.updated; companiesDone++; }
    else if (r.reason !== "no_customer") errors.push(`${c.name}: ${r.reason}`);
  }

  return NextResponse.json({ ok: true, imported, updated, companies: companiesDone, unmatched, errors });
}
