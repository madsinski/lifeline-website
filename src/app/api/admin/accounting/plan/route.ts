// GET  /api/admin/accounting/plan — business-plan attainment + valuation
// POST /api/admin/accounting/plan — update a setting { key, value }
//
// Compares actuals against the encoded business plan
// (src/lib/business-plan.ts, from the Excel workbook v1.0):
//   health checks  = PayDay-invoiced assessment quantities this year
//                  + paid B2C foundational bookings + manual offset
//   subscribers    = manual offset only for now — there is no
//                    subscription/tier column in the database yet (the
//                    app hasn't launched billing); wire a real count in
//                    when subscriptions land
// and derives pacing: YTD target, gap ("lacking"), required per month.
//
// Valuation card: DCF pre-money, EBITDA×10 EV milestones, and a live
// attainment-adjusted EV (plan EV for the current year × health-check
// attainment). Investing capacity: cash setting + outstanding
// receivables − known liabilities − accrued unpaid doctor pay; runway
// = capacity / current monthly overhead burn.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { computeCompanyOverview, computeMonthlyReport } from "@/lib/accounting";
import {
  PLAN_VERSION, HEALTH_CHECK_PLAN, SUBSCRIBER_PLAN, SELF_MAINTAINED_PLAN,
  TOTAL_EBITDA_PLAN, ENTERPRISE_VALUE_PLAN, EBITDA_MULTIPLE,
  DCF_VALUATION, PLANNED_RAISE, planFor,
} from "@/lib/business-plan";

export const maxDuration = 60;

const SETTING_KEYS = [
  "cash_balance_isk", "other_liabilities_isk", "total_shares",
  "healthchecks_offset", "subscribers_offset",
] as const;

async function getSettings(): Promise<Record<string, number>> {
  const { data } = await supabaseAdmin
    .from("accounting_settings")
    .select("key, value_numeric");
  const out: Record<string, number> = {};
  for (const k of SETTING_KEYS) out[k] = 0;
  for (const r of data || []) out[r.key as string] = Number(r.value_numeric) || 0;
  return out;
}

function pace(annualTarget: number, actual: number, monthsElapsed: number) {
  const ytdTarget = Math.round(annualTarget * (monthsElapsed / 12));
  const monthlyTarget = annualTarget / 12;
  const gap = ytdTarget - actual; // positive = lacking
  const monthsLeft = Math.max(12 - monthsElapsed, 1);
  const requiredPerMonth = Math.max(annualTarget - actual, 0) / monthsLeft;
  return {
    annual_target: annualTarget,
    monthly_target: Math.round(monthlyTarget * 10) / 10,
    months_elapsed: monthsElapsed,
    ytd_target: ytdTarget,
    actual,
    lacking: gap,
    attainment_pct: ytdTarget > 0 ? Math.round((actual / ytdTarget) * 100) : null,
    required_per_month_rest_of_year: Math.round(requiredPerMonth * 10) / 10,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const now = new Date();
    const year = now.getUTCFullYear();
    const monthsElapsed = now.getUTCMonth() + 1; // June = 6
    const yearStart = `${year}-01-01T00:00:00Z`;
    const yearEnd = `${year + 1}-01-01T00:00:00Z`;
    const currentMonth = now.toISOString().slice(0, 7);

    const [settings, invQtyRes, b2cRes, overview, monthReport] = await Promise.all([
      getSettings(),
      supabaseAdmin
        .from("company_invoices")
        .select("quantity")
        .neq("status", "cancelled")
        .gte("issued_at", yearStart)
        .lt("issued_at", yearEnd),
      supabaseAdmin
        .from("body_comp_bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed")
        .eq("payment_status", "paid")
        .eq("package", "foundational")
        .gte("scheduled_at", yearStart)
        .lt("scheduled_at", yearEnd),
      computeCompanyOverview(),
      computeMonthlyReport(currentMonth),
    ]);

    const invoicedQty = (invQtyRes.data || []).reduce((s, r) => s + ((r.quantity as number) || 0), 0);
    const b2cCount = b2cRes.count ?? 0;
    const healthChecksActual = invoicedQty + b2cCount + Math.round(settings.healthchecks_offset);
    const subscribersActual = Math.round(settings.subscribers_offset);

    const healthChecks = {
      ...pace(planFor(HEALTH_CHECK_PLAN, year), healthChecksActual, monthsElapsed),
      breakdown: { invoiced_b2b: invoicedQty, b2c_paid: b2cCount, manual_offset: Math.round(settings.healthchecks_offset) },
    };
    const subscribers = {
      ...pace(planFor(SUBSCRIBER_PLAN, year), subscribersActual, monthsElapsed),
      breakdown: { in_system: 0, manual_offset: Math.round(settings.subscribers_offset) },
      self_maintained_plan: planFor(SELF_MAINTAINED_PLAN, year),
    };

    // Valuation — plan EV for this year scaled by health-check
    // attainment (capped 0–200% so one good month doesn't claim a
    // 10× company). Clearly a heuristic; DCF and milestones shown raw.
    const planEvThisYear = planFor(ENTERPRISE_VALUE_PLAN, year);
    const attainment = healthChecks.attainment_pct != null
      ? Math.min(Math.max(healthChecks.attainment_pct, 0), 200) / 100
      : 0;
    const liveEv = Math.round(planEvThisYear * attainment);
    const shares = Math.round(settings.total_shares);
    const valuation = {
      plan_version: PLAN_VERSION,
      dcf: DCF_VALUATION,
      planned_raise: PLANNED_RAISE,
      ebitda_multiple: EBITDA_MULTIPLE,
      ev_milestones: Object.entries(ENTERPRISE_VALUE_PLAN).map(([y, ev]) => ({
        year: Number(y), ev_isk: ev, ebitda_isk: TOTAL_EBITDA_PLAN[Number(y)],
      })),
      plan_ev_this_year: planEvThisYear,
      attainment_pct: healthChecks.attainment_pct,
      live_ev_isk: liveEv,
      total_shares: shares,
      price_per_share_dcf: shares > 0 ? Math.round(DCF_VALUATION.pre_money_isk / shares) : null,
      price_per_share_live: shares > 0 ? Math.round(liveEv / shares) : null,
      one_percent_dcf_isk: Math.round(DCF_VALUATION.pre_money_isk / 100),
      one_percent_live_isk: Math.round(liveEv / 100),
    };

    // Investing capacity
    const receivables = overview.rows.reduce((s, r) => s + (r.outstanding_isk || 0), 0);
    const doctorAccrued = Math.max(overview.doctor_pool.performed_isk - overview.doctor_pool.paid_isk, 0);
    const reimbursementsOwed = overview.reimbursements.reduce((s, r) => s + r.total_isk, 0);
    const burn = monthReport.totals.overheads_isk || 0;
    const capacity = Math.round(
      settings.cash_balance_isk + receivables - settings.other_liabilities_isk - doctorAccrued - reimbursementsOwed,
    );
    const investing = {
      cash_balance_isk: Math.round(settings.cash_balance_isk),
      receivables_isk: receivables,
      other_liabilities_isk: Math.round(settings.other_liabilities_isk),
      doctor_accrued_isk: doctorAccrued,
      reimbursements_owed_isk: reimbursementsOwed,
      capacity_isk: capacity,
      monthly_overhead_burn_isk: burn,
      runway_months: burn > 0 ? Math.round((capacity / burn) * 10) / 10 : null,
    };

    return NextResponse.json({
      year, plan_version: PLAN_VERSION,
      health_checks: healthChecks,
      subscribers,
      valuation,
      investing,
      settings,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const key = String(body?.key || "");
  const value = Number(body?.value);
  if (!(SETTING_KEYS as readonly string[]).includes(key) || !Number.isFinite(value)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("accounting_settings")
    .upsert({ key, value_numeric: value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, key, value });
}
