// Straumur Hosted Checkout sessions and what happens when one is paid.
//
// Flow: a route prices the purchase on the server, calls
// startStraumurCheckout (one straumur_checkouts row + a Straumur session)
// and hands the browser the payment page URL. Nothing is created yet. When
// Straumur reports the session paid — the verified webhook
// (api/straumur/webhook), or our own server-to-server status check
// (api/hc/payment-status) — settleStraumurCheckout marks the row paid
// once and runs the same fulfilment the free path runs (src/lib/hc/fulfil.ts),
// plus a payments row so accounting sees the income.
//
// Server only. Schema: supabase/migration-test-codes-straumur.sql

import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createHostedCheckout, getHostedCheckoutStatus } from "@/lib/straumur-server";
import {
  activateSubscription, DOCTOR_ADDON_DESCRIPTION, fulfilOrder, markCheckinAddonPaid, recordStraumurPayment,
  type OrderContext, type SubscriptionContext,
} from "@/lib/hc/fulfil";
import { hcAudit } from "@/lib/hc/server";

export type CheckoutKind = "hc_order" | "subscription" | "checkin_addon";

export interface StraumurCheckoutRow {
  id: string;
  reference: string;
  kind: CheckoutKind;
  client_id: string;
  amount_isk: number;
  checkout_reference: string | null;
  payfac_reference: string | null;
  status: "pending" | "paid" | "expired" | "failed";
  payload: Record<string, unknown>;
  paid_at: string | null;
  fulfil_started_at: string | null;
  fulfilled_at: string | null;
  order_id: string | null;
  subscription_id: string | null;
  created_at: string;
}

/** Where the person lands back on our site, with the reference to look up. */
export function returnUrlFor(origin: string, path: string, reference: string): string {
  const u = new URL(path, origin);
  u.searchParams.set("greidsla", reference);
  return u.toString();
}

export async function startStraumurCheckout(args: {
  kind: CheckoutKind;
  clientId: string;
  email: string | null;
  amountIsk: number;
  description: string;
  payload: Record<string, unknown>;
  origin: string;
  returnPath: string;
  recurring?: boolean;
}): Promise<{ ok: true; url: string; reference: string } | { ok: false; error: string }> {
  // Our merchant reference: short, unique, no PII.
  const reference = `LL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const { data: row, error } = await supabaseAdmin.from("straumur_checkouts").insert({
    reference, kind: args.kind, client_id: args.clientId, amount_isk: args.amountIsk,
    payload: { ...args.payload, description: args.description },
  }).select("id").single();
  if (error || !row) return { ok: false, error: "Ekki tókst að hefja greiðslu. Reyndu aftur." };

  const returnUrl = returnUrlFor(args.origin, args.returnPath, reference);
  const s = await createHostedCheckout({
    amountIsk: args.amountIsk,
    reference,
    returnUrl,
    abandonUrl: returnUrl,
    email: args.email,
    ...(args.recurring ? { recurring: "Subscription" as const, shopperReference: args.clientId } : {}),
  });
  if (!s.ok) {
    await supabaseAdmin.from("straumur_checkouts").update({ status: "failed", fulfil_error: s.error }).eq("id", row.id);
    return { ok: false, error: s.error };
  }
  await supabaseAdmin.from("straumur_checkouts").update({ checkout_reference: s.checkoutReference }).eq("id", row.id);
  return { ok: true, url: s.url, reference };
}

/**
 * Mark paid (once) and fulfil (once). Safe to call again and again: a
 * second call for a fulfilled row is a no-op, and a call while another is
 * mid-way backs off unless that one stalled for five minutes.
 * Returns false when fulfilment failed, so the webhook answers non-200 and
 * Straumur retries.
 */
export async function settleStraumurCheckout(row: StraumurCheckoutRow, payfacReference: string | null): Promise<boolean> {
  if (row.fulfilled_at) return true;
  if (row.status === "pending") {
    await supabaseAdmin.from("straumur_checkouts")
      .update({ status: "paid", paid_at: new Date().toISOString(), payfac_reference: payfacReference })
      .eq("id", row.id).eq("status", "pending");
  }
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: claimed } = await supabaseAdmin.from("straumur_checkouts")
    .update({ fulfil_started_at: new Date().toISOString() })
    .eq("id", row.id).is("fulfilled_at", null)
    .or(`fulfil_started_at.is.null,fulfil_started_at.lt.${staleBefore}`)
    .select("*").maybeSingle<StraumurCheckoutRow>();
  if (!claimed) return true; // someone else is on it, or it is done
  const ref = claimed.payfac_reference ?? payfacReference ?? claimed.checkout_reference ?? claimed.reference;
  const description = String(claimed.payload.description ?? "Lifeline Health");

  try {
    if (claimed.kind === "hc_order") {
      const ctx = claimed.payload.ctx as OrderContext;
      const { order } = await fulfilOrder({ ...ctx, provider: "straumur", providerReference: ref });
      await recordStraumurPayment({ clientId: claimed.client_id, amountIsk: claimed.amount_isk, description, payfacReference: ref, relatedType: "hc_order", relatedId: order.id as string });
      await supabaseAdmin.from("straumur_checkouts").update({ fulfilled_at: new Date().toISOString(), order_id: order.id, fulfil_error: null }).eq("id", claimed.id);
    } else if (claimed.kind === "subscription") {
      const ctx = claimed.payload.ctx as SubscriptionContext;
      const sub = await activateSubscription({ ...ctx, provider: "straumur", providerReference: ref });
      await recordStraumurPayment({ clientId: claimed.client_id, amountIsk: claimed.amount_isk, description, payfacReference: ref, relatedType: "subscription", relatedId: sub.id as string });
      await supabaseAdmin.from("straumur_checkouts").update({ fulfilled_at: new Date().toISOString(), subscription_id: sub.id, fulfil_error: null }).eq("id", claimed.id);
    } else {
      await markCheckinAddonPaid(claimed.client_id);
      await recordStraumurPayment({ clientId: claimed.client_id, amountIsk: claimed.amount_isk, description: DOCTOR_ADDON_DESCRIPTION, payfacReference: ref, relatedType: "checkin_doctor_addon", relatedId: claimed.id });
      await supabaseAdmin.from("straumur_checkouts").update({ fulfilled_at: new Date().toISOString(), fulfil_error: null }).eq("id", claimed.id);
    }
    await hcAudit(`client:${claimed.client_id}`, "straumur_paid", null, { checkout_id: claimed.id, kind: claimed.kind, amount: claimed.amount_isk });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[straumur] fulfilment failed", claimed.id, msg);
    await supabaseAdmin.from("straumur_checkouts").update({ fulfil_started_at: null, fulfil_error: msg.slice(0, 500) }).eq("id", claimed.id);
    await hcAudit(`client:${claimed.client_id}`, "straumur_fulfil_failed", null, { checkout_id: claimed.id, error: msg.slice(0, 300) });
    return false;
  }
}

/**
 * The status check behind the return page: ask Straumur directly (with our
 * API key — a server-to-server answer, not anything the browser says) and
 * settle a session that has been paid but whose webhook has not arrived.
 */
export async function refreshStraumurCheckout(row: StraumurCheckoutRow): Promise<StraumurCheckoutRow> {
  if (row.status !== "pending" || !row.checkout_reference) {
    if (row.status === "paid" && !row.fulfilled_at) await settleStraumurCheckout(row, row.payfac_reference);
    return row;
  }
  const s = await getHostedCheckoutStatus(row.checkout_reference);
  if (s.status === "Completed") {
    await settleStraumurCheckout(row, s.payfacReference);
  } else if (s.status === "Expired") {
    await supabaseAdmin.from("straumur_checkouts").update({ status: "expired" }).eq("id", row.id).eq("status", "pending");
    await releaseHeldCompanyCode(row);
  }
  const { data } = await supabaseAdmin.from("straumur_checkouts").select("*").eq("id", row.id).single<StraumurCheckoutRow>();
  return data ?? row;
}

/** A company code held for a session that was never paid goes back. */
async function releaseHeldCompanyCode(row: StraumurCheckoutRow) {
  const ctx = row.payload?.ctx as OrderContext | undefined;
  if (row.kind !== "hc_order" || !ctx?.company?.codeId) return;
  const { count } = await supabaseAdmin.from("hc_orders").select("id", { count: "exact", head: true }).eq("company_code_id", ctx.company.codeId);
  if (count) return;
  await supabaseAdmin.from("company_hc_codes").update({ redeemed_by: null, redeemed_at: null })
    .eq("id", ctx.company.codeId).eq("redeemed_by", row.client_id);
}
