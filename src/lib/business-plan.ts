// Business plan targets — encoded from "Lifeline Health ehf - Business
// plan.xlsx" (version 1.0, last update 7.8.2025; sheets: 1. Health
// check business plan, 2. Coaching - business Plan, 3. Valuation -
// Snorri 270526, 4. DCF valuation OLD). Update here when the plan
// workbook gets a new version.

export const PLAN_VERSION = "1.0 (workbook 7.8.2025)";

// Sheet 1 row 13/37 — total health checks per year. 2026 is the
// pre-sales year (BBA Fjeldco 80 + Vestmannaeyjar 500).
export const HEALTH_CHECK_PLAN: Record<number, number> = {
  2026: 580,
  2027: 2000,
  2028: 3750,
  2029: 5375,
  2030: 7563,
  2031: 10594,
};

// Sheet 2 row 12 — coaching subscribers (up-sell from health checks +
// primary subscriptions).
export const SUBSCRIBER_PLAN: Record<number, number> = {
  2026: 158,
  2027: 350,
  2028: 619,
  2029: 918,
  2030: 1344,
  2031: 1960,
};

// Sheet 2 row 14 — self-maintained app access (separate, cheaper tier).
export const SELF_MAINTAINED_PLAN: Record<number, number> = {
  2027: 500,
  2028: 2500,
  2029: 7000,
  2030: 12000,
  2031: 20000,
};

// Sheet 3 — total EBITDA (health check + coaching) and the resulting
// enterprise value at the 10× multiple Snorri used. 2026 comes from
// sheet 1 (health check only; coaching is 0 in 2026).
export const EBITDA_MULTIPLE = 10;
export const TOTAL_EBITDA_PLAN: Record<number, number> = {
  2026: 3967360,
  2027: 18808827,
  2028: 60482372,
  2029: 132001490,
  2030: 209313341,
  2031: 322751826,
};
export const ENTERPRISE_VALUE_PLAN: Record<number, number> = Object.fromEntries(
  Object.entries(TOTAL_EBITDA_PLAN).map(([y, e]) => [y, e * EBITDA_MULTIPLE]),
) as Record<number, number>;

// Sheet 4 — DCF valuation (health check + coaching combined).
export const DCF_VALUATION = {
  pre_money_isk: 319183139,
  wacc: 0.35,
  // WACC sensitivity from the sheet (mkr → ISK)
  sensitivity: [
    { wacc: 0.25, pre_money_isk: 648_000_000 },
    { wacc: 0.30, pre_money_isk: 474_000_000 },
    { wacc: 0.35, pre_money_isk: 364_000_000 },
    { wacc: 0.40, pre_money_isk: 292_000_000 },
  ],
};

// Sheet 2 rows 65–72 — the planned raise.
export const PLANNED_RAISE = {
  seek_isk: 26_000_000,
  post_money_isk: 189_117_243,
  equity_offering_pct: 13.75,
};

/** Plan value for a year, falling back to the nearest planned year. */
export function planFor(plan: Record<number, number>, year: number): number {
  if (plan[year] != null) return plan[year];
  const years = Object.keys(plan).map(Number).sort((a, b) => a - b);
  if (year < years[0]) return 0;
  return plan[years[years.length - 1]] || 0;
}
