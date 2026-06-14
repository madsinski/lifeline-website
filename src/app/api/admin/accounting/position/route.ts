// Financial position panel (Accounting tab):
//   internal debt — owed to founders/staff (Victor for Future Medical
//     Systems via paid-by reimbursements, + a manual line for the invoice
//     Victor covered out of pocket — transferred to the Lifeline account so
//     we could pay it). Either bucket can be DEFERRED (a founder loan we are
//     in no hurry to repay): deferred amounts move to their own column and
//     drop out of the net-position math.
//   external debt — unpaid fixed health-check costs not yet invoiced,
//     itemised by component (blood test / measurement / doctor interview),
//     + the Biody machines liability
//   cash — current bank balance (setting)
//   revenue — total received to date
//   net position = cash − active (non-deferred) internal − external
//
// Settings live in accounting_settings, edited via /api/admin/accounting/plan.
// Defer flags are numeric 0/1 settings: internal_reimb_deferred,
// internal_manual_deferred.

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
    // Manual internal line: an invoice Victor covered out of pocket
    // (transferred cash to the Lifeline account so we could pay it). Stored
    // under the legacy `internal_debt_thorvaldur_isk` key — it is the
    // Þorvaldur Arnarsson invoice, but the money is owed to Victor.
    const victorManual = Math.round(s.internal_debt_thorvaldur_isk || 0);
    const revenue = totals.income.total_received_isk;
    const healthChecksOutstanding = totals.costs.per_check_outstanding_isk;
    const healthCheckBreakdown = totals.costs.per_check_breakdown
      .filter((b) => b.outstanding_isk > 0)
      .map((b) => ({ key: b.key, label: b.label, outstanding_isk: b.outstanding_isk }));

    // Defer flags — a deferred bucket is a founder loan we're in no hurry to
    // repay; it sits in its own column and drops out of net position.
    const reimbDeferred = (s.internal_reimb_deferred || 0) >= 1;
    const manualDeferred = (s.internal_manual_deferred || 0) >= 1;

    // Founders/staff who fronted costs (out-of-pocket cost invoices not
    // yet reimbursed) — Victor's Future Medical Systems invoices land here.
    const reimbursements = overview.reimbursements; // [{ staff_name, total_isk }]
    const reimbTotal = reimbursements.reduce((a, r) => a + r.total_isk, 0);

    const internalTotal = reimbTotal + victorManual;
    const internalDeferred = (reimbDeferred ? reimbTotal : 0) + (manualDeferred ? victorManual : 0);
    const internalActive = internalTotal - internalDeferred;
    const externalTotal = healthChecksOutstanding + biody;

    return NextResponse.json({
      cash,
      revenue,
      internal: {
        reimbursements: reimbursements.map((r) => ({ name: r.staff_name, amount_isk: r.total_isk })),
        reimb_total_isk: reimbTotal,
        reimb_deferred: reimbDeferred,
        // Manual line — owed to Victor (covered the Þorvaldur Arnarsson invoice).
        manual_isk: victorManual,
        manual_label: "Victor — covered Þorvaldur Arnarsson invoice",
        manual_deferred: manualDeferred,
        total_isk: internalTotal,
        active_isk: internalActive,
        deferred_isk: internalDeferred,
      },
      external: {
        health_checks_outstanding_isk: healthChecksOutstanding,
        health_check_breakdown: healthCheckBreakdown,
        biody_isk: biody,
        total_isk: externalTotal,
      },
      net_position_isk: cash - internalActive - externalTotal,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
