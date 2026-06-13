// Global PayDay invoice import for the Payments page — imports invoices
// for every company that has a PayDay customer linked, upserting into
// company_invoices and mirroring into the payments ledger so they all
// appear on the Payments page. See importCompanyInvoicesFromPayday.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";
import { importCompanyInvoicesFromPayday } from "@/lib/payday";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const { data: companies } = await supabaseAdmin
    .from("companies").select("id").not("payday_customer_id", "is", null);

  let imported = 0, updated = 0, companiesDone = 0;
  const errors: string[] = [];
  for (const c of companies || []) {
    const r = await importCompanyInvoicesFromPayday(c.id as string, auth.id);
    if (r.ok) { imported += r.imported; updated += r.updated; companiesDone++; }
    else if (r.reason !== "no_customer") errors.push(`${c.id}: ${r.reason}`);
  }
  return NextResponse.json({ ok: true, imported, updated, companies: companiesDone, errors });
}
