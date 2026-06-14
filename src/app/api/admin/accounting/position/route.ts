// Financial position panel (Accounting tab):
//   internal debt — owed to founders/staff (Victor for Future Medical
//     Systems via paid-by reimbursements, + a manual line for Þorvaldur
//     Arnarsson)
//   external debt — unpaid fixed health-check costs not yet invoiced +
//     the Biody machines liability
//   cash — current bank balance (setting)
//   revenue — total received to date
//   net position = cash − internal − external
//
// Settings live in accounting_settings, edited via /api/admin/accounting/plan.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff } from "@/lib/auth-helpers";
import { computeTotalsOverview, computeCompanyOverview } from "@/lib/accounting";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const [settingsRes, totals, overview] = await Promise.all([
      supabaseAdmin.from("accounting_settings").select("key, value_numeric"),
      computeTotalsOverview(),
      computeCompanyOverview(),
    ]);
    const s: Record<string, number> = {};
    for (const r of settingsRes.data || []) s[r.key as string] = Number(r.value_numeric) || 0;

    const cash = Math.round(s.cash_balance_isk || 0);
    const biody = Math.round(s.other_liabilities_isk || 0);
    const thorvaldur = Math.round(s.internal_debt_thorvaldur_isk || 0);
    const revenue = totals.income.total_received_isk;
    const healthChecksOutstanding = totals.costs.per_check_outstanding_isk;

    // Founders/staff who fronted costs (out-of-pocket cost invoices not
    // yet reimbursed) — Victor's Future Medical Systems invoices land here.
    const reimbursements = overview.reimbursements; // [{ staff_name, total_isk }]
    const reimbTotal = reimbursements.reduce((a, r) => a + r.total_isk, 0);

    const internalTotal = reimbTotal + thorvaldur;
    const externalTotal = healthChecksOutstanding + biody;

    return NextResponse.json({
      cash,
      revenue,
      internal: {
        reimbursements: reimbursements.map((r) => ({ name: r.staff_name, amount_isk: r.total_isk })),
        thorvaldur_isk: thorvaldur,
        total_isk: internalTotal,
      },
      external: {
        health_checks_outstanding_isk: healthChecksOutstanding,
        biody_isk: biody,
        total_isk: externalTotal,
      },
      net_position_isk: cash - internalTotal - externalTotal,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
