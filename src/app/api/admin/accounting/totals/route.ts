// GET /api/admin/accounting/totals — business overview with itemized
// line items. Filters: ?from=YYYY-MM&to=YYYY-MM (inclusive month range;
// omit both for all time) and ?company_id=… (drops company-agnostic
// lines: overheads, manual liabilities, B2C, offsets). See
// computeTotalsOverview in src/lib/accounting.ts.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAnyActiveStaff } from "@/lib/auth-helpers";
import { computeTotalsOverview, MONTH_RE } from "@/lib/accounting";

export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const from = req.nextUrl.searchParams.get("from") || "";
  const to = req.nextUrl.searchParams.get("to") || "";
  const companyId = req.nextUrl.searchParams.get("company_id") || "";
  if ((from && !MONTH_RE.test(from)) || (to && !MONTH_RE.test(to))) {
    return NextResponse.json({ error: "bad_month" }, { status: 400 });
  }
  if (companyId && !UUID_RE.test(companyId)) {
    return NextResponse.json({ error: "bad_company" }, { status: 400 });
  }
  try {
    const totals = await computeTotalsOverview({
      fromMonth: from || undefined,
      toMonth: to || undefined,
      companyId: companyId || undefined,
    });
    return NextResponse.json({ totals });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
