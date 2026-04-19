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
