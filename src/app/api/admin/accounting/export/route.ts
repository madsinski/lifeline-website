// GET /api/admin/accounting/export?month=YYYY-MM
//
// The month's P&L as a flat semicolon-separated CSV ledger (UTF-8 BOM,
// DK-importable) — same file the monthly email attaches.

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAnyActiveStaff } from "@/lib/auth-helpers";
import { MONTH_RE, computeMonthlyReport, reportToCsv } from "@/lib/accounting";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const month = req.nextUrl.searchParams.get("month") || "";
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "bad_month" }, { status: 400 });

  try {
    const report = await computeMonthlyReport(month);
    const csv = reportToCsv(report);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="lifeline-bokhald-${month}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
