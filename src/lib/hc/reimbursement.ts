// Union (stéttarfélag / sjúkrasjóður) reimbursement maths. Client-safe.
//
// Every fund has its own rules. They are uploaded as a PDF/DOCX in
// /admin/unions, extracted by AI into the UnionRules shape below, and then
// reviewed by a human before the fund is approved. Only approved funds with
// a signed agreement on file are offered at checkout (enforced server-side
// in src/lib/hc/server.ts → approvedUnions()).
//
// Two settlement models:
//   reimbursement — the member pays in full and claims the grant back with
//                   the PDF we generate (emailed from the account).
//   direct        — the grant is subtracted at checkout and Lifeline invoices
//                   the fund. Only once a beingreiðslusamningur is signed.

export interface UnionCategoryRule {
  /** Share of the price the fund covers, 0–100. */
  percent?: number | null;
  /** Ceiling per claim. */
  max_isk?: number | null;
  /** A fixed grant instead of a percentage. */
  fixed_isk?: number | null;
  /** One grant per this many months. */
  period_months?: number | null;
  /** Membership seniority required. */
  min_membership_months?: number | null;
  notes?: string | null;
}

export interface UnionRules {
  categories?: Record<string, UnionCategoryRule>;
  requires_receipt?: boolean;
  application_notes?: string | null;
}

export const UNION_CATEGORIES: { key: string; label: string }[] = [
  { key: "health_check", label: "Heilsufarsskoðun / heilsumat" },
  { key: "followup", label: "Eftirfylgd / viðtal" },
];

export interface ReimbursementResult {
  amountIsk: number;
  rule: UnionCategoryRule | null;
  explanation: string;
}

export function computeReimbursement(
  rules: UnionRules | null | undefined,
  category: string,
  priceIsk: number,
): ReimbursementResult {
  const rule = rules?.categories?.[category] ?? null;
  if (!rule || priceIsk <= 0) {
    return { amountIsk: 0, rule, explanation: "Félagið endurgreiðir ekki þennan lið samkvæmt skráðum reglum." };
  }
  let amount = 0;
  const parts: string[] = [];
  if (rule.fixed_isk != null && rule.fixed_isk > 0) {
    amount = rule.fixed_isk;
    parts.push(`fastur styrkur ${rule.fixed_isk.toLocaleString("is-IS")} kr.`);
  } else if (rule.percent != null && rule.percent > 0) {
    amount = Math.round((priceIsk * Math.min(rule.percent, 100)) / 100);
    parts.push(`${rule.percent}% af verði`);
  }
  if (rule.max_isk != null && rule.max_isk > 0 && amount > rule.max_isk) {
    amount = rule.max_isk;
    parts.push(`að hámarki ${rule.max_isk.toLocaleString("is-IS")} kr.`);
  }
  amount = Math.max(0, Math.min(amount, priceIsk));
  if (rule.period_months) parts.push(`einu sinni á ${rule.period_months} mánaða fresti`);
  if (rule.min_membership_months) parts.push(`krefst ${rule.min_membership_months} mánaða aðildar`);
  return { amountIsk: amount, rule, explanation: parts.length ? capitalize(parts.join(", ")) + "." : "" };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface EmployerContribution {
  /** 0–100, used when fixed_isk is not set. */
  percent: number;
  fixed_isk: number | null;
}

/** What the employer pays of a price. */
export function employerShare(c: EmployerContribution | null | undefined, priceIsk: number): number {
  if (!c) return 0;
  const raw = c.fixed_isk != null ? c.fixed_isk : Math.round((priceIsk * Math.max(0, Math.min(100, c.percent))) / 100);
  return Math.max(0, Math.min(raw, priceIsk));
}

export interface QuoteInput {
  priceIsk: number;
  /** Employer contribution (company code), if used. */
  employer?: EmployerContribution | null;
  /** Union, if used. Reimbursement is computed on what the member pays after the employer. */
  union?: { settlement: "reimbursement" | "direct"; rules: UnionRules } | null;
  unionCategory: string;
}

export interface Quote {
  priceIsk: number;
  employerIsk: number;
  chargedIsk: number;
  directGrantIsk: number;
  reimbursementIsk: number;
  netCostIsk: number;
  explanation: string;
}

/**
 * Price → employer pays its share → the member's share → the union
 * reimburses (or, with direct settlement, discounts) according to its rules,
 * applied to what the member actually pays.
 */
export function quote(input: QuoteInput): Quote {
  const { priceIsk } = input;
  const employerIsk = employerShare(input.employer, priceIsk);
  const memberShare = priceIsk - employerIsk;
  if (input.union && memberShare > 0) {
    const r = computeReimbursement(input.union.rules, input.unionCategory, memberShare);
    if (input.union.settlement === "direct") {
      return {
        priceIsk, employerIsk, chargedIsk: memberShare - r.amountIsk, directGrantIsk: r.amountIsk, reimbursementIsk: 0,
        netCostIsk: memberShare - r.amountIsk, explanation: r.explanation,
      };
    }
    return {
      priceIsk, employerIsk, chargedIsk: memberShare, directGrantIsk: 0, reimbursementIsk: r.amountIsk,
      netCostIsk: memberShare - r.amountIsk, explanation: r.explanation,
    };
  }
  return {
    priceIsk, employerIsk, chargedIsk: memberShare, directGrantIsk: 0, reimbursementIsk: 0, netCostIsk: memberShare,
    explanation: employerIsk >= priceIsk ? "Vinnuveitandi greiðir." : "",
  };
}
