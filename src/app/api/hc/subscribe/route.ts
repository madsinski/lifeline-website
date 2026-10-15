// The app subscription.
//
// GET  → the package, and where this person stands with it
// POST { accept_terms } → start it
// DELETE → cancel at the end of the paid period
//
// ── Why this is separate from /api/hc/checkout ────────────────────────
//
// That route settles a bill: it writes an hc_orders row, a payment route, a
// union reimbursement, an activation code for the clinic. This one starts a
// period. The two share a catalogue (hc_packages) and nothing else, and
// forcing a recurring product through a one-off order would leave a paid
// order that nothing renews and a subscription nothing records.
//
// ── What is real and what is not ─────────────────────────────────────
//
// createStraumurCharge is still a stub: it waits 900ms and returns a made-up
// reference. The health-check checkout is in exactly the same position, so
// this is built to the same shape and becomes real when Straumur does. It
// means no money moves here yet, which is why the first period is written as
// a trial rather than as something paid for.
//
// Schema: supabase/migration-hc-subscription-package.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hcAudit, requireUser, siteOrigin } from "@/lib/hc/server";
import { createStraumurCharge } from "@/lib/straumur";
import { priceWithCode, redeem } from "@/lib/hc/discount";
import { cancelledButRunning, pickCurrent } from "@/lib/hc/subscription-state";

export const runtime = "nodejs";

const PACKAGE_KEY = "app-monthly";

/** The tier a paying subscriber is on. 'free-trial' is the period before that. */
const PAID_TIER = "premium";

async function pkg() {
  const { data } = await supabaseAdmin.from("hc_packages")
    .select("key, kind, name, tagline, description, includes, price_isk, interval_months")
    .eq("key", PACKAGE_KEY).eq("active", true).maybeSingle();
  return data;
}

/**
 * The one that counts.
 *
 * The table has cancelled rows alongside live ones — six free trials and
 * four premiums are cancelled already — so "do they have a subscription" is
 * a question about status, not about existence.
 */
async function current(clientId: string) {
  const { data } = await supabaseAdmin.from("subscriptions")
    .select("id, tier, status, trial_ends_at, current_period_start, current_period_end")
    .eq("client_id", clientId).eq("status", "active")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

/**
 * What the person should be shown: the active row, or — after "Segja upp" —
 * the cancelled one whose paid period is still running.
 *
 * current() above is active-only on purpose (it is what POST and DELETE act
 * on). GET used to return it too, so the moment somebody cancelled, the
 * panel offered to sell them the month they had already paid for.
 */
async function shown(clientId: string) {
  const { data } = await supabaseAdmin.from("subscriptions")
    .select("id, tier, status, trial_ends_at, current_period_start, current_period_end")
    .eq("client_id", clientId).in("status", ["active", "cancelled"])
    .order("created_at", { ascending: false }).limit(10);
  const row = pickCurrent(data ?? []);
  if (!row) return null;
  const cancelled = cancelledButRunning(row);
  return { ...row, cancelled, ends_at: cancelled ? row.current_period_end : null };
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const [p, sub] = await Promise.all([pkg(), shown(user.id)]);
  return NextResponse.json({ package: p, subscription: sub });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => ({}));
  // Same gate the health-check checkout applies: the sales terms are binding
  // and somebody has to have agreed to them.
  if (!body?.accept_terms) {
    return NextResponse.json({ error: "Samþykkja þarf söluskilmála." }, { status: 400 });
  }

  const [p, existing] = await Promise.all([pkg(), current(user.id)]);
  if (!p) return NextResponse.json({ error: "package_not_found" }, { status: 404 });
  if (existing) return NextResponse.json({ ok: true, subscription: existing, already: true });

  /*
   * The code, priced on the server.
   *
   * The browser sends a string and nothing else. It never sends a price, a
   * discount or an amount — the catalogue price and the code's effect are
   * both looked up here, so a tampered request can only ask for a code that
   * exists and get what that code actually does.
   */
  const rawCode = typeof body?.code === "string" ? body.code : "";
  const discount = rawCode.trim()
    ? await priceWithCode(rawCode, "subscription", p.price_isk, user.id)
    : null;
  // A code that does not apply is not a reason to refuse the subscription;
  // it just does not come off. Saying so beats a dead end at the till.
  const chargeIsk = discount?.ok ? (discount.priceIsk ?? p.price_isk) : p.price_isk;
  const monthsFree = discount?.ok ? (discount.monthsFree ?? 0) : 0;

  /*
   * Charged through the same stub the rest of the site uses, so that when it
   * becomes a real charge this becomes a real subscription without the flow
   * changing shape. A failure here must not leave a row behind.
   *
   * Nothing is charged for a free period — there is no zero-krónur card
   * transaction, and asking for one would fail on a real provider.
   */
  if (chargeIsk > 0) {
    const charge = await createStraumurCharge({
      amountIsk: chargeIsk,
      reference: `sub_${user.id.slice(0, 8)}`,
      description: p.name,
      customer: { name: user.email || "", email: user.email || "", phone: null },
      returnUrl: `${siteOrigin(req)}/app`,
    });
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error || "Greiðsla tókst ekki." }, { status: 402 });
    }
  }

  const now = new Date();
  // free_months extends the first period rather than discounting it: the
  // customer gets that many months before anything is due.
  const months = (p.interval_months ?? 1) + monthsFree;
  const end = new Date(now);
  end.setMonth(end.getMonth() + months);

  const { data: sub, error } = await supabaseAdmin.from("subscriptions")
    .insert({
      client_id: user.id,
      tier: PAID_TIER,
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
    })
    .select("id, tier, status, trial_ends_at, current_period_start, current_period_end")
    .single();
  if (error || !sub) return NextResponse.json({ error: "Tókst ekki að hefja áskrift." }, { status: 500 });

  /*
   * Spent only now, after the row exists. A code redeemed before the
   * subscription was written would be gone if the write failed.
   */
  if (discount?.ok && discount.code) {
    await redeem(discount.code.code, user.id, "subscription",
      discount.amountOffIsk ?? 0, monthsFree);
  }

  /*
   * The withdrawal-right waiver (söluskilmálar gr. 8, d-liður 1. mgr. 18. gr.
   * laga nr. 16/2016), recorded with the start in hc_audit.detail (jsonb):
   * subscriptions has no metadata column and this needed no migration. The
   * paywall will not submit without it.
   */
  await hcAudit(`self:${user.id}`, "subscription_started", null, {
    tier: PAID_TIER, price: p.price_isk, charged: chargeIsk,
    code: discount?.ok ? discount.code?.code : null, months_free: monthsFree,
    withdrawal_waiver: body?.withdrawal_waiver === true,
    withdrawal_waiver_at: body?.withdrawal_waiver === true ? new Date().toISOString() : null,
    withdrawal_waiver_recorded_at: body?.withdrawal_waiver === true ? new Date().toISOString() : null,
  });
  return NextResponse.json({ ok: true, subscription: sub, charged_isk: chargeIsk, months_free: monthsFree });
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const sub = await current(user.id);
  if (!sub) return NextResponse.json({ ok: true, subscription: null });

  /*
   * Cancelled, not deleted, and the period that was paid for still runs.
   * Taking the app away the moment somebody cancels would be charging for a
   * month and delivering part of it.
   */
  await supabaseAdmin.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
  await hcAudit(`self:${user.id}`, "subscription_cancelled", null, { until: sub.current_period_end });
  return NextResponse.json({ ok: true, cancelled_at_period_end: sub.current_period_end });
}
