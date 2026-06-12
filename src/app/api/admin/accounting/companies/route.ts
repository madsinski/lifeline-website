// GET /api/admin/accounting/companies
//
// All-time per-company financial overview: invoiced vs paid vs
// outstanding (receivables) vs attributed costs vs net. Also returns
// the plain company list for the tag pickers in the Accounting tab.
// See computeCompanyOverview in src/lib/accounting.ts.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAnyActiveStaff } from "@/lib/auth-helpers";
import { computeCompanyOverview } from "@/lib/accounting";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const overview = await computeCompanyOverview();
    return NextResponse.json(overview);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
