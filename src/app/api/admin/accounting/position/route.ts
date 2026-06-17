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
import { computeTotalsOverview, computeCompanyOverview, computeHealthCheckDebt } from "@/lib/accounting";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const [settingsRes, totals, overview, hcDebt] = await Promise.all([
      supabaseAdmin.from("accounting_settings").select("key, value_numeric"),
      computeTotalsOverview(),
      computeCompanyOverview(),
      computeHealthCheckDebt(),
    ]);
    const s: Record<string, number> = {};
    for (const r of settingsRes.data || []) s[r.key as string] = Number(r.value_numeric) || 0;

    // Actual supplier invoices behind the derived health-check cost, shown
    // alongside the expected per-company figure. `status` is the paid/
    // outstanding overlay (net position still runs off the derived cost).
    // Tolerate the status column not being migrated yet → no invoices shown.
    const hcInvRes = await supabaseAdmin
      .from("accounting_expense_invoices")
      .select("id, company_id, vendor, invoice_number, invoice_date, amount_isk, currency, status, category")
      .in("category", ["blood_tests", "measurements"])
      .eq("direction", "cost")
      .order("invoice_date", { ascending: false });
    const hcInvoices = (hcInvRes.error ? [] : (hcInvRes.data || [])) as Array<{
      id: string; company_id: string | null; vendor: string | null; invoice_number: string | null;
      invoice_date: string | null; amount_isk: number | null; currency: string | null; status: string | null; category: string;
    }>;

    const cash = Math.round(s.cash_balance_isk || 0);
    const biody = Math.round(s.other_liabilities_isk || 0);
    // Manual internal line: an invoice Victor covered out of pocket
    // (transferred cash to the Lifeline account so we could pay it). Stored
    // under the legacy `internal_debt_thorvaldur_isk` key — it is the
    // Þorvaldur Arnarsson invoice, but the money is owed to Victor.
    const victorManual = Math.round(s.internal_debt_thorvaldur_isk || 0);
    const revenue = totals.income.total_received_isk;
    // External health-check debt is now the per-company sum of UNPAID
    // measurement + blood-test lines (head count × rate), not the old
    // global per-check accrual.
    const healthChecksOutstanding = hcDebt.unpaid_total_isk;
    const healthCheckBreakdown = hcDebt.lines
      .filter((l) => l.unpaid_isk > 0)
      .map((l) => ({
        member_id: l.member_id,
        client_name: l.client_name,
        company_id: l.company_id,
        company_name: l.company_name,
        category: l.category,
        label: l.label,
        provider: l.provider,
        rate_isk: l.rate_isk,
        outstanding_isk: l.unpaid_isk,
      }));

    // Defer flags — a deferred line is a debt we're in no hurry to settle;
    // it sits in its own column and drops out of net position. Internal
    // buckets + Biody use numeric settings; per-company health-check lines
    // carry their own `deferred` flag (computed in computeHealthCheckDebt).
    const reimbDeferred = (s.internal_reimb_deferred || 0) >= 1;
    const manualDeferred = (s.internal_manual_deferred || 0) >= 1;
    const biodyDeferred = (s.external_biody_deferred || 0) >= 1;

    // Founders/staff who fronted costs (out-of-pocket cost invoices not
    // yet reimbursed) — Victor's Future Medical Systems invoices land here.
    const reimbursements = overview.reimbursements; // [{ staff_name, total_isk }]
    const reimbTotal = reimbursements.reduce((a, r) => a + r.total_isk, 0);

    const internalTotal = reimbTotal + victorManual;
    const internalDeferred = (reimbDeferred ? reimbTotal : 0) + (manualDeferred ? victorManual : 0);
    const internalActive = internalTotal - internalDeferred;

    // External: per-company health-check lines (each individually deferrable)
    // + the Biody liability (its own defer flag).
    const externalTotal = healthChecksOutstanding + biody;
    const externalDeferred = hcDebt.unpaid_deferred_isk + (biodyDeferred ? biody : 0);
    const externalActive = externalTotal - externalDeferred;

    const totalDeferred = internalDeferred + externalDeferred;
    const totalOwedNow = internalActive + externalActive;

    return NextResponse.json({
      cash,
      revenue,
      internal: {
        reimbursements: reimbursements.map((r) => ({ name: r.staff_name, amount_isk: r.total_isk })),
        reimb_total_isk: reimbTotal,
        reimb_deferred: reimbDeferred,
        // Manual line — owed to Victor (covered the Þorvaldur Arnarsson invoice).
        manual_isk: victorManual,
        manual_label: "Þorvaldur Arnarsson",
        manual_deferred: manualDeferred,
        total_isk: internalTotal,
        active_isk: internalActive,
        deferred_isk: internalDeferred,
      },
      external: {
        health_checks_outstanding_isk: healthChecksOutstanding,
        health_check_breakdown: healthCheckBreakdown,
        // Full per-company × cost-line list (paid + unpaid + N/A) so the
        // panel can show and edit each company's status / head count / defer.
        health_check_lines: hcDebt.lines.map((l) => ({
          member_id: l.member_id,
          client_id: l.client_id,
          client_name: l.client_name,
          client_href: l.client_href,
          company_id: l.company_id,
          company_name: l.company_name,
          member_company_id: l.member_company_id,
          category: l.category,
          label: l.label,
          provider: l.provider,
          rate_isk: l.rate_isk,
          expected_isk: l.expected_isk,
          status: l.status,
          paid: l.paid,
          applicable: l.applicable,
          deferred: l.deferred,
          note: l.note,
          sort_order: l.sort_order,
          unpaid_isk: l.unpaid_isk,
        })),
        health_check_company_subtotals: hcDebt.company_subtotals,
        health_check_categories: hcDebt.company_categories,
        // Actual invoices behind the expected cost (grouped per company in the UI).
        health_check_invoices: hcInvoices.map((v) => ({
          id: v.id,
          company_id: v.company_id,
          vendor: v.vendor,
          invoice_number: v.invoice_number,
          invoice_date: v.invoice_date,
          amount_isk: v.amount_isk,
          currency: v.currency,
          status: v.status || "outstanding",
          category: v.category,
        })),
        health_check_expected_isk: hcDebt.expected_total_isk,
        health_check_paid_isk: hcDebt.paid_total_isk,
        biody_isk: biody,
        biody_deferred: biodyDeferred,
        total_isk: externalTotal,
        active_isk: externalActive,
        deferred_isk: externalDeferred,
      },
      total_owed_now_isk: totalOwedNow,
      total_deferred_isk: totalDeferred,
      net_position_isk: cash - totalOwedNow,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
