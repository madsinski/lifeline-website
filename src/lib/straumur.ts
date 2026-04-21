// Straumur.is payment provider — integration stub.
// The Straumur API is still pending; this module exposes the shape we need
// from the rest of the app so we can wire the real calls in one place when
// credentials + docs arrive.

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
 * Mock charge that returns success after a short delay. Swap the internals
 * for a real Straumur call (fetch to their checkout / payment-intent
 * endpoint) once the API is available.
 */
export async function createStraumurCharge(args: StraumurChargeArgs): Promise<StraumurChargeResult> {
  // Simulate network latency
  await new Promise((r) => setTimeout(r, 900));
  return {
    ok: true,
    providerReference: `stub_${args.reference.slice(0, 8)}_${Date.now().toString(36)}`,
  };
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

export async function saveStraumurPaymentMethod(): Promise<SaveStraumurMethodResult> {
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
