// Straumur payment webhooks. Register in the Straumur Merchant Portal as
//   https://www.lifelinehealth.is/api/straumur/webhook
// and put the webhook's API key and HMAC value in STRAUMUR_WEBHOOK_API_KEY
// and STRAUMUR_HMAC_KEY.
//
// Every delivery is checked twice, as Straumur's docs ask: the raw
// Authorization header must equal the webhook API key, and hmacSignature
// must match HMAC-SHA256 over the seven payment fields with the HMAC key
// (src/lib/straumur-server.ts). Anything that fails is logged and refused
// with 401 — never acted on.
//
// What we act on:
//   Authorization success "true"  → the session is paid (auto-capture):
//                                   settle it — order / subscription / add-on
//                                   created once (straumur_checkouts claim),
//                                   payments row for accounting.
//   Authorization success "false" → a declined attempt; the session stays
//                                   open for another card. Noted, nothing else.
//   Tokenization                  → the card saved for the subscription:
//                                   stored in payment_methods for renewals.
// Everything else is logged and answered 200.
//
// Straumur treats only HTTP 200 as delivered and retries anything else (five
// tries). A fulfilment failure answers 500 so it is retried; settling is
// idempotent, so a retry of a delivered event changes nothing.
//
// Schema: supabase/migration-test-codes-straumur.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyStraumurWebhook, type StraumurWebhook } from "@/lib/straumur-server";
import { settleStraumurCheckout, type StraumurCheckoutRow } from "@/lib/straumur-checkouts";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  let body: StraumurWebhook;
  try { body = JSON.parse(raw) as StraumurWebhook; } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  const verified = verifyStraumurWebhook(req.headers.get("authorization"), body);
  const ad = body?.additionalData ?? {};
  const eventType = typeof ad.eventType === "string" ? ad.eventType : null;

  // Kept for tracing; card details beyond the last four are dropped.
  await supabaseAdmin.from("straumur_webhook_events").insert({
    correlation_id: req.headers.get("x-webhook-correlationid"),
    event_type: eventType,
    checkout_reference: body?.checkoutReference ?? null,
    payfac_reference: body?.payfacReference ?? null,
    merchant_reference: body?.merchantReference ?? null,
    success: body?.success ?? null,
    verified,
    body: { ...body, reason: null, additionalData: { ...ad, cardNumber: undefined, token: ad.token ? "(stored)" : undefined } },
  }).then(() => {}, () => {});

  if (!verified) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  /* Our session row: by Straumur's checkout reference, else our own reference. */
  const findRow = async () => {
    if (body.checkoutReference) {
      const { data } = await supabaseAdmin.from("straumur_checkouts").select("*").eq("checkout_reference", body.checkoutReference).maybeSingle<StraumurCheckoutRow>();
      if (data) return data;
    }
    if (body.merchantReference) {
      const { data } = await supabaseAdmin.from("straumur_checkouts").select("*").eq("reference", body.merchantReference).maybeSingle<StraumurCheckoutRow>();
      if (data) return data;
    }
    return null;
  };

  if (eventType === "Authorization") {
    const row = await findRow();
    if (!row) return NextResponse.json({ ok: true, ignored: "unknown_session" });
    if (body.success !== "true") {
      await supabaseAdmin.from("straumur_checkouts").update({ last_decline: (body.reason ?? "").slice(0, 200) }).eq("id", row.id);
      return NextResponse.json({ ok: true });
    }
    /* The amount and currency must be what we asked for. */
    if (body.currency !== "ISK" || Number(body.amount) !== row.amount_isk * 100) {
      console.error("[straumur] amount mismatch", row.id, body.amount, body.currency, row.amount_isk);
      await supabaseAdmin.from("straumur_checkouts").update({ fulfil_error: `amount_mismatch ${body.amount} ${body.currency}` }).eq("id", row.id);
      return NextResponse.json({ ok: true, ignored: "amount_mismatch" });
    }
    const ok = await settleStraumurCheckout(row, body.payfacReference);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "fulfil_failed" }, { status: 500 });
  }

  if (eventType === "Tokenization" && body.success === "true" && typeof ad.token === "string" && ad.token) {
    const row = await findRow();
    if (!row) return NextResponse.json({ ok: true, ignored: "unknown_session" });
    const [mm, yyyy] = String(ad.cardExpiryDate ?? "").split("/");
    const brand = ad.paymentMethod === "VI" ? "Visa" : ad.paymentMethod === "MC" ? "Mastercard" : ad.paymentMethod === "AMEX" ? "AMEX" : (ad.paymentMethod || "Kort");
    const { data: existing } = await supabaseAdmin.from("payment_methods").select("id")
      .eq("owner_type", "client").eq("owner_id", row.client_id).eq("provider_token", ad.token).maybeSingle();
    if (!existing) {
      await supabaseAdmin.from("payment_methods").update({ is_default: false }).eq("owner_type", "client").eq("owner_id", row.client_id);
      const { error } = await supabaseAdmin.from("payment_methods").insert({
        owner_type: "client", owner_id: row.client_id, provider: "straumur", provider_token: ad.token,
        brand, last4: String(ad.cardSummary ?? "").slice(-4) || null,
        exp_month: Number(mm) >= 1 && Number(mm) <= 12 ? Number(mm) : null,
        exp_year: Number(yyyy) >= 2020 ? Number(yyyy) : null,
        is_default: true,
      });
      if (error) {
        console.error("[straumur] token not stored", error.message);
        return NextResponse.json({ error: "token_store_failed" }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
