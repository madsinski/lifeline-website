// GET /api/admin/accounting/report?month=YYYY-MM
//
// Derives the month's full P&L (income, COGS, expense invoices,
// overheads, adjustments) — see src/lib/accounting.ts for the model.
// Also returns the send-log so the UI can show whether this month's
// report already went to the accounting firm.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff } from "@/lib/auth-helpers";
import { MONTH_RE, monthBounds, computeMonthlyReport } from "@/lib/accounting";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const month = req.nextUrl.searchParams.get("month") || "";
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "bad_month" }, { status: 400 });

  try {
    const [report, runsRes] = await Promise.all([
      computeMonthlyReport(month),
      supabaseAdmin
        .from("accounting_report_runs")
        .select("id, sent_to, status, error, triggered_by, created_at")
        .eq("month", monthBounds(month).monthDate)
        .order("created_at", { ascending: false }),
    ]);
    return NextResponse.json({ report, runs: runsRes.data || [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
