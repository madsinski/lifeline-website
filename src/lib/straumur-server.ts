// Straumur, server side: Hosted Checkout, its status, webhook verification,
// token payments and refunds. Never import this from a "use client" file —
// it reads the API key. Client-safe constants stay in src/lib/straumur.ts.
//
// Built from Straumur's public docs (docs.straumur.is, read 2026-10-17):
//   POST {base}/api/v1/hostedcheckout            create a session → { url, checkoutReference }
//   GET  {base}/api/v1/hostedcheckout/status/{checkoutReference}
//                                                 → { status: New|Completed|Expired, payfacReference }
//   POST {base}/api/v1/payment                    pay with a saved token (Payment Gateway terminal)
//   POST {base}/api/v1/modification/refund        refund by payfacReference
//   Auth: header `X-API-Key: <key>`. Amounts in minor units (ISK × 100,
//   must end in 00). Test base https://checkout-api.staging.straumur.is,
//   live https://greidslugatt.straumur.is.
//
// Webhooks: POST JSON with `Authorization: <webhook API key>` (raw, no
// Bearer) and `hmacSignature` in the body = base64(HMAC-SHA256(hexKey,
// "checkoutReference:payfacReference:merchantReference:amount:currency:reason:success")),
// nulls as "". Answer 200 within 15 s; anything else is retried (5 tries).
// A successful Authorization event (auto-capture, the default) is the
// fulfilment signal. A declined attempt sends success "false" and the
// session stays open. Session expiry sends nothing: check the status.
//
// Env (all required for live payments; with any missing, isStraumurConfigured()
// is false and every caller fails closed):
//   STRAUMUR_ENV                       "live" or "test" (default test)
//   STRAUMUR_API_KEY                   Merchant Portal → API Keys
//   STRAUMUR_TERMINAL_IDENTIFIER       12-char id of the Hosted Checkout terminal
//   STRAUMUR_WEBHOOK_API_KEY           the webhook's "API key" (Authorization header)
//   STRAUMUR_HMAC_KEY                  the webhook's "HMAC value" (hex)
// Optional:
//   STRAUMUR_GATEWAY_TERMINAL_IDENTIFIER  Payment Gateway terminal, for charging
//                                         saved tokens (subscription renewals)

import crypto from "node:crypto";

const env = () => ({
  live: process.env.STRAUMUR_ENV === "live",
  apiKey: process.env.STRAUMUR_API_KEY?.trim() || "",
  terminal: process.env.STRAUMUR_TERMINAL_IDENTIFIER?.trim() || "",
  gatewayTerminal: process.env.STRAUMUR_GATEWAY_TERMINAL_IDENTIFIER?.trim() || "",
  webhookKey: process.env.STRAUMUR_WEBHOOK_API_KEY?.trim() || "",
  hmacKey: process.env.STRAUMUR_HMAC_KEY?.trim() || "",
});

const apiBase = () => (env().live ? "https://greidslugatt.straumur.is" : "https://checkout-api.staging.straumur.is");

/** The message every caller shows while payments are not connected. */
export const PAYMENTS_CLOSED_MESSAGE =
  "Kortagreiðslur opna fljótlega. Hafðu samband á contact@lifelinehealth.is ef þú vilt ganga frá kaupum strax.";

/** Everything a hosted checkout and its webhook need is set. */
export function isStraumurConfigured(): boolean {
  const e = env();
  return !!(e.apiKey && /^[A-Za-z0-9]{12}$/.test(e.terminal) && e.webhookKey && e.hmacKey);
}

/** Token payments (renewals) additionally need the Payment Gateway terminal. */
export function isStraumurTokenPaymentConfigured(): boolean {
  return isStraumurConfigured() && /^[A-Za-z0-9]{12}$/.test(env().gatewayTerminal);
}

async function call<T>(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const r = await fetch(`${apiBase()}/api/v1${path}`, {
      method: init.method,
      headers: {
        "X-API-Key": env().apiKey,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const text = await r.text();
    let j: unknown = null;
    try { j = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!r.ok) {
      console.error("[straumur]", init.method, path, r.status, text.slice(0, 500));
      return { ok: false, status: r.status, error: `straumur_${r.status}` };
    }
    return { ok: true, data: j as T };
  } catch (e) {
    console.error("[straumur]", init.method, path, e instanceof Error ? e.message : e);
    return { ok: false, status: 0, error: "straumur_unreachable" };
  }
}

/** ISK → Straumur minor units (×100; ISK must end in 00). */
const minor = (isk: number) => Math.round(isk) * 100;

export type HostedCheckoutResult =
  | { ok: true; url: string; checkoutReference: string }
  | { ok: false; error: string };

export async function createHostedCheckout(args: {
  amountIsk: number;
  reference: string;
  returnUrl: string;
  abandonUrl?: string;
  email?: string | null;
  items?: { name: string; amountIsk: number }[];
  /** Save the card for a subscription: Straumur sends a Tokenization event. */
  recurring?: "Subscription" | "CardOnFile";
  /** Opaque shopper id (never PII) — required for the token to be tied to a shopper. */
  shopperReference?: string;
}): Promise<HostedCheckoutResult> {
  if (!isStraumurConfigured()) return { ok: false, error: PAYMENTS_CLOSED_MESSAGE };
  if (!(args.amountIsk > 0)) return { ok: false, error: "amount_must_be_positive" };
  const body: Record<string, unknown> = {
    amount: minor(args.amountIsk),
    currency: "ISK",
    returnUrl: args.returnUrl,
    reference: args.reference,
    terminalIdentifier: env().terminal,
    culture: "is",
    // One hour is the default; say it so the status poller knows.
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  };
  if (args.abandonUrl) body.abandonUrl = args.abandonUrl;
  if (args.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args.email)) body.shopperContact = args.email;
  if (args.recurring) body.recurringProcessingModel = args.recurring;
  if (args.shopperReference) body.merchantShopperReference = args.shopperReference;
  const r = await call<{ url?: string; checkoutReference?: string }>("/hostedcheckout", { method: "POST", body });
  if (!r.ok || !r.data?.url || !r.data.checkoutReference) {
    return { ok: false, error: "Ekki náðist samband við greiðslugáttina. Reyndu aftur eftir smástund." };
  }
  return { ok: true, url: r.data.url, checkoutReference: r.data.checkoutReference };
}

export type CheckoutStatus = "New" | "Completed" | "Expired" | "Unknown";

export async function getHostedCheckoutStatus(checkoutReference: string): Promise<{ status: CheckoutStatus; payfacReference: string | null }> {
  if (!isStraumurConfigured()) return { status: "Unknown", payfacReference: null };
  const r = await call<{ status?: string; payfacReference?: string | null }>(
    `/hostedcheckout/status/${encodeURIComponent(checkoutReference)}`, { method: "GET" });
  if (!r.ok) return { status: "Unknown", payfacReference: null };
  const s = r.data?.status;
  return {
    status: s === "New" || s === "Completed" || s === "Expired" ? s : "Unknown",
    payfacReference: r.data?.payfacReference ?? null,
  };
}

// ── Webhooks ──────────────────────────────────────────────────────────

export interface StraumurWebhook {
  checkoutReference: string | null;
  payfacReference: string;
  merchantReference: string | null;
  amount: string;
  currency: string;
  reason: string | null;
  success: string;
  hmacSignature: string;
  additionalData?: Record<string, string | null | undefined> | null;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** base64(HMAC-SHA256) over the seven fields, colon-joined — Straumur's own sample. */
export function straumurSignature(hexKey: string, m: Pick<StraumurWebhook, "checkoutReference" | "payfacReference" | "merchantReference" | "amount" | "currency" | "reason" | "success">): string {
  const key = Buffer.from(hexKey.length % 2 ? `${hexKey}0` : hexKey, "hex");
  const payload = [m.checkoutReference, m.payfacReference, m.merchantReference, m.amount, m.currency, m.reason, m.success]
    .map((v) => v ?? "").join(":");
  return crypto.createHmac("sha256", key).update(Buffer.from(payload, "utf8")).digest("base64");
}

/** Both checks the docs ask for: the Authorization header and the HMAC. */
export function verifyStraumurWebhook(authorization: string | null, body: StraumurWebhook): boolean {
  const e = env();
  if (!e.webhookKey || !e.hmacKey) return false;
  if (!authorization || !safeEqual(authorization.trim(), e.webhookKey)) return false;
  if (typeof body?.hmacSignature !== "string") return false;
  return safeEqual(straumurSignature(e.hmacKey, body), body.hmacSignature);
}

// ── Saved cards and refunds ───────────────────────────────────────────

export async function chargeStraumurToken(args: {
  token: string; amountIsk: number; reference: string; origin: string;
}): Promise<{ ok: true; payfacReference: string } | { ok: false; error: string; tokenGone?: boolean }> {
  if (!isStraumurTokenPaymentConfigured()) return { ok: false, error: "token_payments_not_configured" };
  const r = await call<{ resultCode?: string; payfacReference?: string | null }>("/payment", {
    method: "POST",
    body: {
      terminalIdentifier: env().gatewayTerminal,
      amount: minor(args.amountIsk),
      currency: "ISK",
      reference: args.reference,
      origin: args.origin,
      channel: "Web",
      returnUrl: `${args.origin}/app`,
      tokenDetails: { tokenValue: args.token, recurringProcessingModel: "Subscription" },
    },
  });
  if (!r.ok) return { ok: false, error: r.error };
  if (r.data?.resultCode === "Authorised" && r.data.payfacReference) return { ok: true, payfacReference: r.data.payfacReference };
  return { ok: false, error: r.data?.resultCode || "refused" };
}

export async function refundStraumurPayment(args: { payfacReference: string; amountIsk: number; reference: string }): Promise<{ ok: boolean; error?: string }> {
  if (!isStraumurConfigured()) return { ok: false, error: "not_configured" };
  const r = await call<{ status?: string }>("/modification/refund", {
    method: "POST",
    body: { reference: args.reference, payfacReference: args.payfacReference, amount: minor(args.amountIsk), currency: "ISK" },
  });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
