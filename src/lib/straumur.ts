// Straumur.is — the CLIENT-SAFE half. Imported by "use client" files, so it
// holds no secrets and makes no API calls.
//
// The real integration (Hosted Checkout, webhook verification, token
// payments, refunds) is server-only in src/lib/straumur-server.ts and
// src/lib/straumur-checkouts.ts; /api/hc/checkout, /api/hc/subscribe and
// /api/account/checkin-addon use it. createStraumurCharge below is what the
// legacy browser-side booking flow (/account/book) still calls: it always
// refuses, and the DB refuses browser writes that would mark a booking or a
// payment paid (supabase/migration-test-codes-straumur.sql).

export type StraumurChargeArgs = {
  amountIsk: number;
  reference: string;          // Our internal booking id, surfaced on the statement
  description: string;        // Line-item description
  customer: {
    name: string;
    email: string;
    phone?: string | null;
    kennitala?: string | null;
  };
  returnUrl: string;          // Where Straumur should send the user after payment
};

export type StraumurChargeResult =
  | { ok: true; providerReference: string; checkoutUrl?: string }
  | { ok: false; error: string };

/**
 * Fails closed until the real Straumur integration is connected.
 *
 * This used to be a mock that waited 900 ms and returned success, which on
 * the live site meant every checkout, subscription and booking that reached
 * it was marked paid without a card (closed 2026-10-17). Every caller treats
 * { ok: false } as "not paid". Free purchases for testing go through the
 * admin test-code pool, which brings the price to 0 so no charge is made.
 */
export async function createStraumurCharge(args: StraumurChargeArgs): Promise<StraumurChargeResult> {
  void args;
  return { ok: false, error: "Kortagreiðslur opna fljótlega. Hafðu samband á contact@lifelinehealth.is ef þú vilt ganga frá kaupum strax." };
}

export const STRAUMUR_BRAND = {
  name: "Straumur",
  cardsSupported: ["Visa", "Mastercard", "AMEX"],
};

// ─── Tokenised payment methods ─────────────────────────────────────────────
// Straumur will return a secure token for a card that can be charged again
// without collecting card details a second time. These stubs return the
// shape we'll persist to the payment_methods table.

export type StraumurTokenisedMethod = {
  token: string;
  brand: string;       // "Visa", "Mastercard", "AMEX"
  last4: string;       // "4242"
  expMonth: number;    // 1-12
  expYear: number;     // 4-digit
};

export type SaveStraumurMethodResult =
  | { ok: true; method: StraumurTokenisedMethod }
  | { ok: false; error: string };

/**
 * Whether card registration is real yet.
 *
 * saveStraumurPaymentMethod below is a STUB that invents a random card. With
 * this false, no UI offers "Bæta við korti" (BillingPanel shows "Kortaskráning
 * opnar fljótlega" instead) and the stub refuses to run, so a real customer
 * can never be handed a fake Visa. Flip to true when the stub is replaced by
 * the real Straumur tokenisation call. Existing payment_methods rows are left
 * as they are.
 */
export const STRAUMUR_CARDS_LIVE = false;

/**
 * True while saveStraumurPaymentMethod and chargeSavedStraumurMethod are the
 * stubs below. Both refuse to run while this is true, whatever
 * STRAUMUR_CARDS_LIVE says — flipping only the live flag would otherwise save
 * invented cards and record "succeeded" charges with no money moved. Set to
 * false in the same change that replaces both bodies with real Straumur calls.
 */
export const STRAUMUR_CARD_STUBS = true;

export async function saveStraumurPaymentMethod(): Promise<SaveStraumurMethodResult> {
  if (!STRAUMUR_CARDS_LIVE || STRAUMUR_CARD_STUBS) return { ok: false, error: "Kortaskráning opnar fljótlega." };
  await new Promise((r) => setTimeout(r, 700));
  const brands = ["Visa", "Mastercard", "AMEX"];
  const brand = brands[Math.floor(Math.random() * brands.length)];
  const last4 = String(1000 + Math.floor(Math.random() * 9000));
  const expYear = new Date().getFullYear() + 3 + Math.floor(Math.random() * 3);
  return {
    ok: true,
    method: {
      token: `stub_tok_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      brand,
      last4,
      expMonth: 1 + Math.floor(Math.random() * 12),
      expYear,
    },
  };
}

export async function chargeSavedStraumurMethod(args: {
  token: string;
  amountIsk: number;
  reference: string;
  description: string;
}): Promise<StraumurChargeResult> {
  if (STRAUMUR_CARD_STUBS) return { ok: false, error: "Greiðslur með vistuðu korti eru ekki komnar í gagnið." };
  await new Promise((r) => setTimeout(r, 600));
  return {
    ok: true,
    providerReference: `stub_charge_${args.reference.slice(0, 8)}_${Date.now().toString(36)}`,
  };
}

// ─── Refunds ───────────────────────────────────────────────────────────────
// Stub for now. Straumur's refund endpoint takes the original charge
// reference and an amount (full or partial). Swap the body for the real
// API call once credentials land.

export type StraumurRefundResult =
  | { ok: true; refundReference: string }
  | { ok: false; error: string };

export async function refundStraumurCharge(args: {
  providerReference: string;  // The original charge's providerReference
  amountIsk: number;          // Full amount for now (Foundational = 49900, etc.)
}): Promise<StraumurRefundResult> {
  await new Promise((r) => setTimeout(r, 800));
  // Deterministic refund reference keyed on the charge + amount — a retry
  // (transient network, double-click) sends the same refundReference so
  // Straumur can de-dup server-side. When the real API is wired, pass this
  // as an Idempotency-Key header.
  const seed = `${args.providerReference}_${args.amountIsk}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  const stable = Math.abs(hash).toString(36);
  return {
    ok: true,
    refundReference: `stub_refund_${args.providerReference.slice(0, 16)}_${stable}`,
  };
}
