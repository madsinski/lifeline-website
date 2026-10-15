// The app subscription.
//
// GET  → the package, and where this person stands with it
// POST { accept_terms, withdrawal_waiver } → start it (paid now)
// POST { start_trial, accept_terms, withdrawal_waiver } → save a card and
//        start the 14-day trial that converts to the paid tier when it ends
//        (only while STRAUMUR_CARDS_LIVE; see src/lib/hc/subscription.ts)
// DELETE → cancel at the end of the paid period (or trial: no conversion)
//
// ── The withdrawal waiver (§18(1)(d), söluskilmálar gr. 8) ────────────
//
// Recorded on the row (subscriptions.withdrawal_waiver_at, server time;
// supabase/migration-withdrawal-waiver.sql) and in hc_audit. A request from
// the website — the web Paywall sends `x-lifeline-client: web` — is refused
// without it. The mobile app (fhir-health-dashboard) calls this same route and
// does not send the flag yet, so requests without the header are let through
// and recorded as not waived. Once the app sends withdrawal_waiver, drop the
// header test in requireWaiver() so every request needs it.
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
import { createStraumurCharge, saveStraumurPaymentMethod, STRAUMUR_CARDS_LIVE } from "@/lib/straumur";
import { priceWithCode, redeem } from "@/lib/hc/discount";
import { cancelledButRunning, pickCurrent } from "@/lib/hc/subscription-state";
import { isMissingSchema, TRIAL_DAYS, TRIAL_TIER, warnOnce } from "@/lib/hc/subscription";
import { recordWaiver, requireWaiver } from "@/lib/hc/waiver";

export const runtime = "nodejs";

const PACKAGE_KEY = "app-monthly";

/** The tier a paying subscriber is on. 'free-trial' is the period before that. */
const PAID_TIER = "premium";

/** card_saved_at for a row; null when the column is not there yet. */
async function cardSavedAt(subId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from("subscriptions")
    .select("card_saved_at").eq("id", subId).maybeSingle<{ card_saved_at: string | null }>();
  if (error) {
    if (isMissingSchema(error)) warnOnce("card_saved_at", "subscriptions.card_saved_at missing — run supabase/migration-hc-trial.sql.");
    return null;
  }
  return data?.card_saved_at ?? null;
}

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
  const [p, sub, { count }] = await Promise.all([
    pkg(), shown(user.id),
    supabaseAdmin.from("subscriptions").select("id", { count: "exact", head: true }).eq("client_id", user.id),
  ]);
  const trial = sub?.tier === TRIAL_TIER;
  return NextResponse.json({
    package: p,
    subscription: sub ? { ...sub, trial, card_saved_at: trial ? await cardSavedAt(sub.id) : null } : null,
    /* Whether a card can be saved yet; while false the trial runs without one. */
    cards_live: STRAUMUR_CARDS_LIVE,
    /* Never had a subscription row: a card-backed trial can be offered. */
    trial_available: STRAUMUR_CARDS_LIVE && !count,
    trial_days: TRIAL_DAYS,
  });
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
  const noWaiver = requireWaiver(req, body);
  if (noWaiver) return noWaiver;
  const waiverAt = body?.withdrawal_waiver === true ? new Date().toISOString() : null;

  const [p, existing] = await Promise.all([pkg(), current(user.id)]);
  if (!p) return NextResponse.json({ error: "package_not_found" }, { status: 404 });

  if (body?.start_trial === true) return startCardTrial(user.id, p, existing, waiverAt);

  /*
   * A running free trial is not a subscription: paying now replaces it (the
   * trial row is closed below once the paid row exists). Before this, an
   * active trial row — even one long past its end date — answered
   * "already", so somebody whose trial ran out could never subscribe.
   */
  const trialRow = existing?.tier === TRIAL_TIER ? existing : null;
  if (existing && !trialRow) return NextResponse.json({ ok: true, subscription: existing, already: true });

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
  if (trialRow) {
    await supabaseAdmin.from("subscriptions").update({ status: "expired" }).eq("id", trialRow.id).eq("tier", TRIAL_TIER);
  }
  if (waiverAt) await recordWaiver("subscriptions", sub.id, waiverAt);

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
   * laga nr. 16/2016): on the row above (withdrawal_waiver_at) and here in
   * hc_audit.detail as well, which works whether or not the column exists.
   */
  await hcAudit(`self:${user.id}`, "subscription_started", null, {
    tier: PAID_TIER, price: p.price_isk, charged: chargeIsk,
    code: discount?.ok ? discount.code?.code : null, months_free: monthsFree,
    withdrawal_waiver: !!waiverAt,
    withdrawal_waiver_at: waiverAt,
    withdrawal_waiver_recorded_at: waiverAt,
    replaced_trial: trialRow?.id ?? null,
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

/**
 * Save a card and start the 14-day trial that becomes the paid tier when it
 * ends (api/cron/hc-trial-reminders does the conversion).
 *
 * Only while STRAUMUR_CARDS_LIVE: before that, saveStraumurPaymentMethod is a
 * stub that invents a card, and the trial starts without one (ensureTrial).
 *
 * An active trial that already exists (started before cards went live, or
 * by building a plan) keeps its end date and gets the card; nobody gets a
 * second trial by saving a card.
 */
async function startCardTrial(
  clientId: string,
  p: { price_isk: number; name: string },
  existing: { id: string; tier: string | null } | null,
  waiverAt: string | null,
) {
  if (!STRAUMUR_CARDS_LIVE) {
    return NextResponse.json({ error: "Kortaskráning opnar fljótlega." }, { status: 409 });
  }
  if (existing && existing.tier !== TRIAL_TIER) {
    return NextResponse.json({ ok: true, subscription: existing, already: true });
  }
  if (!existing) {
    // A cancelled or expired row means a trial was had already.
    const { count } = await supabaseAdmin.from("subscriptions")
      .select("id", { count: "exact", head: true }).eq("client_id", clientId);
    if (count) return NextResponse.json({ error: "Prufutíminn hefur þegar verið notaður." }, { status: 409 });
  }

  /*
   * FLAG-FLIP: saveStraumurPaymentMethod takes no card details today because
   * it is a stub. Real tokenisation will almost certainly happen in Straumur's
   * hosted fields in the browser, with only a token posted here — when it
   * does, take that token from the body and verify it with Straumur instead.
   */
  const saved = await saveStraumurPaymentMethod();
  if (!saved.ok) return NextResponse.json({ error: saved.error || "Ekki tókst að skrá kortið." }, { status: 402 });

  await supabaseAdmin.from("payment_methods").update({ is_default: false })
    .eq("owner_type", "client").eq("owner_id", clientId);
  const { data: pm, error: pmErr } = await supabaseAdmin.from("payment_methods").insert({
    owner_type: "client", owner_id: clientId, provider: "straumur",
    provider_token: saved.method.token, brand: saved.method.brand, last4: saved.method.last4,
    exp_month: saved.method.expMonth, exp_year: saved.method.expYear, is_default: true,
  }).select("id").single();
  if (pmErr || !pm) return NextResponse.json({ error: "Ekki tókst að skrá kortið." }, { status: 500 });

  let subId = existing?.id ?? null;
  if (!subId) {
    const now = new Date();
    const ends = new Date(now.getTime() + TRIAL_DAYS * 86400_000).toISOString();
    const { data, error } = await supabaseAdmin.from("subscriptions").insert({
      client_id: clientId, tier: TRIAL_TIER, status: "active",
      trial_ends_at: ends, current_period_start: now.toISOString(), current_period_end: ends,
    }).select("id").single();
    if (error || !data) return NextResponse.json({ error: "Tókst ekki að hefja prufutímann." }, { status: 500 });
    subId = data.id as string;
  }

  const cardAt = new Date().toISOString();
  const { error: cErr } = await supabaseAdmin.from("subscriptions").update({ card_saved_at: cardAt }).eq("id", subId);
  if (cErr) {
    /* Without card_saved_at the cron will not convert this trial — it just
       ends, which is the safe direction. Say so loudly. */
    console.error("[hc] card_saved_at not written — run supabase/migration-hc-trial.sql; this trial will not convert.", cErr.message);
  }
  if (waiverAt) await recordWaiver("subscriptions", subId, waiverAt);

  await hcAudit(`self:${clientId}`, "trial_card_saved", null, {
    subscription_id: subId, payment_method_id: pm.id, price: p.price_isk,
    converts_at_trial_end: !cErr,
    withdrawal_waiver: !!waiverAt, withdrawal_waiver_at: waiverAt,
  });
  const { data: sub } = await supabaseAdmin.from("subscriptions")
    .select("id, tier, status, trial_ends_at, current_period_start, current_period_end")
    .eq("id", subId).single();
  return NextResponse.json({ ok: true, subscription: sub, trial: true });
}
