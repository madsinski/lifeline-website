// B2B assessment pricing — per-employee, per-assessment, in ISK.
//
// Tier is chosen automatically from headcount + number of assessment
// rounds (1× or 2×). Larger teams and the 2× commitment both lower the
// per-assessment unit price. The 3-month follow-up doctor interview is a
// flat per-employee add-on.
//
// Source of truth for the numbers the company sees on the purchase order.

import type { PurchaseOrderLineItem } from "./agreement-templates";

export const FOLLOWUP_DOCTOR_PRICE_ISK = 12900;

const SMALL_TEAM_MAX = 14; // 0–14 = small tier, 15+ = large tier

/** Per-assessment unit price (ISK) for one employee. */
export function assessmentUnitPriceIsk(employeeCount: number, rounds: 1 | 2): number {
  const smallTeam = employeeCount <= SMALL_TEAM_MAX;
  if (smallTeam) return rounds >= 2 ? 52100 : 54900;
  return rounds >= 2 ? 49900 : 52100;
}

export interface PricingInput {
  employeeCount: number;
  rounds: 1 | 2;
  /** Include the 3-month follow-up doctor interview (12 900 ISK / employee). */
  includeFollowup: boolean;
}

export interface PricingResult {
  unitPriceIsk: number;
  lineItems: PurchaseOrderLineItem[];
  subtotalIsk: number;
}

/**
 * Build the purchase-order line items for a B2B assessment order.
 * Assessment line: employeeCount × rounds units at the tier unit price.
 * Optional follow-up line: employeeCount units at the flat follow-up price.
 */
export function buildAssessmentPricing(input: PricingInput): PricingResult {
  const { employeeCount, rounds, includeFollowup } = input;
  const unitPriceIsk = assessmentUnitPriceIsk(employeeCount, rounds);

  const lineItems: PurchaseOrderLineItem[] = [];

  const assessmentQty = employeeCount * rounds;
  lineItems.push({
    description:
      rounds === 2
        ? `Heilsumat starfsmanns — ${employeeCount} starfsmenn × 2 skipti`
        : `Heilsumat starfsmanns — ${employeeCount} starfsmenn`,
    qty: assessmentQty,
    unit_price_isk: unitPriceIsk,
    total_isk: assessmentQty * unitPriceIsk,
  });

  if (includeFollowup) {
    lineItems.push({
      description: `Eftirfylgni læknis — 15 mín viðtal eftir 3 mánuði (${employeeCount} starfsmenn)`,
      qty: employeeCount,
      unit_price_isk: FOLLOWUP_DOCTOR_PRICE_ISK,
      total_isk: employeeCount * FOLLOWUP_DOCTOR_PRICE_ISK,
    });
  }

  const subtotalIsk = lineItems.reduce((sum, li) => sum + li.total_isk, 0);
  return { unitPriceIsk, lineItems, subtotalIsk };
}

/** Static tier table for display on the marketing/business pages. */
export const PRICING_TIERS = [
  { team: "0–14 starfsmenn", rounds: "1× heilsumat", unitIsk: 54900 },
  { team: "0–14 starfsmenn", rounds: "2× heilsumat", unitIsk: 52100 },
  { team: "15+ starfsmenn", rounds: "1× heilsumat", unitIsk: 52100 },
  { team: "15+ starfsmenn", rounds: "2× heilsumat", unitIsk: 49900 },
] as const;
