// GET /api/admin/accounting/totals — all-time business overview:
// income invoiced vs received, costs recorded, and accrued outstanding
// costs (per-health-check fixed cost not yet invoiced, manual
// liabilities, out-of-pocket reimbursements). See computeTotalsOverview
// in src/lib/accounting.ts.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAnyActiveStaff } from "@/lib/auth-helpers";
import { computeTotalsOverview } from "@/lib/accounting";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const totals = await computeTotalsOverview();
    return NextResponse.json({ totals });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
