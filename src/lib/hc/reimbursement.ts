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

export interface QuoteInput {
  priceIsk: number;
  route: "self" | "union" | "company";
  union?: { settlement: "reimbursement" | "direct"; rules: UnionRules } | null;
  unionCategory: string;
}

export interface Quote {
  priceIsk: number;
  chargedIsk: number;
  directGrantIsk: number;
  reimbursementIsk: number;
  netCostIsk: number;
  explanation: string;
}

export function quote(input: QuoteInput): Quote {
  const { priceIsk, route } = input;
  if (route === "company") {
    return { priceIsk, chargedIsk: 0, directGrantIsk: 0, reimbursementIsk: 0, netCostIsk: 0, explanation: "Vinnuveitandi greiðir." };
  }
  if (route === "union" && input.union) {
    const r = computeReimbursement(input.union.rules, input.unionCategory, priceIsk);
    if (input.union.settlement === "direct") {
      return {
        priceIsk, chargedIsk: priceIsk - r.amountIsk, directGrantIsk: r.amountIsk, reimbursementIsk: 0,
        netCostIsk: priceIsk - r.amountIsk, explanation: r.explanation,
      };
    }
    return {
      priceIsk, chargedIsk: priceIsk, directGrantIsk: 0, reimbursementIsk: r.amountIsk,
      netCostIsk: priceIsk - r.amountIsk, explanation: r.explanation,
    };
  }
  return { priceIsk, chargedIsk: priceIsk, directGrantIsk: 0, reimbursementIsk: 0, netCostIsk: priceIsk, explanation: "" };
}
