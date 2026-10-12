// Discount codes: looking one up, and what it is worth.
//
// Server only. A code must never be validated in the browser and a
// discounted amount must never arrive from one — the server looks the code
// up, computes the price, and charges that. Everything here runs with the
// service role behind an API route.
//
// Failures are deliberately all the same to the caller. Expired, spent,
// wrong product, never existed: one answer, so the endpoint cannot be used
// to find out which codes are real. The `reason` below is for our own logs,
// not for the response body.

import { supabaseAdmin } from "@/lib/supabase-admin";

export type DiscountTarget = "subscription" | "health_check";

export interface DiscountCode {
  code: string;
  kind: "percent" | "amount" | "free_months";
  value: number;
  applies_to: "subscription" | "health_check" | "both";
  max_uses: number | null;
  used_count: number;
  max_per_client: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
}

export interface DiscountResult {
  ok: boolean;
  /** For our logs. Never put this in a response. */
  reason?: "unknown" | "inactive" | "not_started" | "expired" | "spent" | "already_used" | "wrong_product";
  code?: DiscountCode;
  /** What the customer pays after it. */
  priceIsk?: number;
  /** What came off. */
  amountOffIsk?: number;
  /** Periods at no charge, for free_months. */
  monthsFree?: number;
  /** A line to show, e.g. "30% afsláttur" — safe to display. */
  label?: string;
}

/** Codes are typed by humans: upper-case, trimmed, inner spaces dropped. */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "").slice(0, 40);
}

/**
 * Look up a code and work out what it does to a price.
 *
 * Does not redeem anything: this is what the checkout shows before anybody
 * agrees to pay. Redemption is a separate, single write at charge time, so a
 * customer who looks at a code ten times has not spent it.
 */
export async function priceWithCode(
  rawCode: string,
  target: DiscountTarget,
  listPriceIsk: number,
  clientId: string,
): Promise<DiscountResult> {
  const code = normaliseCode(rawCode);
  if (!code) return { ok: false, reason: "unknown" };

  const { data } = await supabaseAdmin.from("hc_discount_codes")
    .select("code, kind, value, applies_to, max_uses, used_count, max_per_client, starts_at, expires_at, active")
    .eq("code", code).maybeSingle<DiscountCode>();

  if (!data) return { ok: false, reason: "unknown" };
  if (!data.active) return { ok: false, reason: "inactive" };

  const now = Date.now();
  if (data.starts_at && new Date(data.starts_at).getTime() > now) return { ok: false, reason: "not_started" };
  if (data.expires_at && new Date(data.expires_at).getTime() <= now) return { ok: false, reason: "expired" };
  if (data.max_uses != null && data.used_count >= data.max_uses) return { ok: false, reason: "spent" };
  if (data.applies_to !== "both" && data.applies_to !== target) return { ok: false, reason: "wrong_product" };

  // Per person, which used_count cannot answer: without this one launch code
  // becomes a permanent price cut for anybody willing to re-subscribe.
  const { count } = await supabaseAdmin.from("hc_discount_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("code", code).eq("client_id", clientId);
  if ((count ?? 0) >= data.max_per_client) return { ok: false, reason: "already_used" };

  if (data.kind === "percent") {
    const off = Math.round((listPriceIsk * Number(data.value)) / 100);
    return {
      ok: true, code: data, amountOffIsk: off,
      priceIsk: Math.max(0, listPriceIsk - off), monthsFree: 0,
      label: `${Math.round(Number(data.value))}% afsláttur`,
    };
  }

  if (data.kind === "amount") {
    const off = Math.min(listPriceIsk, Math.round(Number(data.value)));
    return {
      ok: true, code: data, amountOffIsk: off,
      priceIsk: Math.max(0, listPriceIsk - off), monthsFree: 0,
      label: `${off.toLocaleString("is-IS")} kr. afsláttur`,
    };
  }

  // free_months: nothing comes off this period's price — the period itself is
  // free, which is a different thing and is why monthsFree is separate.
  const months = Math.max(1, Math.round(Number(data.value)));
  return {
    ok: true, code: data, amountOffIsk: listPriceIsk, priceIsk: 0, monthsFree: months,
    label: months === 1 ? "Fyrsti mánuður frír" : `${months} mánuðir fríir`,
  };
}

/**
 * Spend it.
 *
 * Called once, after the charge has gone through, in the same request. The
 * increment is a read-modify-write and two people redeeming the last use of
 * a code at the same moment could both get it — which is a rounding error on
 * a marketing code, and far better than holding a transaction open across a
 * payment call.
 */
export async function redeem(
  code: string,
  clientId: string,
  target: DiscountTarget,
  amountOffIsk: number,
  monthsFree: number,
): Promise<void> {
  await supabaseAdmin.from("hc_discount_redemptions").insert({
    code, client_id: clientId, applied_to: target,
    amount_off_isk: Math.round(amountOffIsk), months_free: monthsFree,
  });
  const { data } = await supabaseAdmin.from("hc_discount_codes")
    .select("used_count").eq("code", code).maybeSingle<{ used_count: number }>();
  await supabaseAdmin.from("hc_discount_codes")
    .update({ used_count: (data?.used_count ?? 0) + 1 }).eq("code", code);
}
