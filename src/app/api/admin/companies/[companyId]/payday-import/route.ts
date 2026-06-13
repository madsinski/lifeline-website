// Import one company's invoices from PayDay (incl. ones created directly
// in PayDay). Upserts into company_invoices + mirrors into the payments
// ledger. See importCompanyInvoicesFromPayday in src/lib/payday.ts.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAAL2 } from "@/lib/auth-helpers";
import { importCompanyInvoicesFromPayday } from "@/lib/payday";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  if (!UUID_RE.test(companyId)) return NextResponse.json({ error: "bad_company" }, { status: 400 });

  const r = await importCompanyInvoicesFromPayday(companyId, auth.id);
  if (!r.ok) {
    const message = r.reason === "no_customer"
      ? "This company has no PayDay customer linked yet. Generate one invoice from the admin first, or attach the PDF manually."
      : undefined;
    return NextResponse.json({ error: r.reason, message }, { status: r.reason === "no_customer" ? 400 : 502 });
  }
  return NextResponse.json({ ok: true, imported: r.imported, updated: r.updated, total: r.total });
}
