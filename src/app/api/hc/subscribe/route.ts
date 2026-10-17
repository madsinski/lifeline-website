// The app subscription, in two tiers.
//
// GET  → both packages, where this person stands, and whether coaching can
//        be bought where they live
// POST { accept_terms, withdrawal_waiver, package?, code?, test_code?, return_to? }
//        → free (test code / free-months code): started now. Otherwise
//        { pending, checkout_url }: Straumur's payment page; it starts when
//        the payment is confirmed.
//        package 'app-monthly' (default — what the RN app sends by omission)
//        or 'coaching-monthly' (src/lib/hc/coaching-config.ts).
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
// A paid period starts only when Straumur confirms the payment (Hosted
// Checkout → verified webhook; src/lib/straumur-checkouts.ts) or when a
// test code makes it free. Without Straumur configured, POST with something
// to pay answers 402 and nothing starts. The start itself — closing a trial,
// replacing the app tier with coaching, the coach — is activateSubscription
// in src/lib/hc/fulfil.ts, shared with the webhook.
//
// Schema: supabase/migration-hc-subscription-package.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hcAudit, requireUser, siteOrigin } from "@/lib/hc/server";
import { saveStraumurPaymentMethod, STRAUMUR_CARDS_LIVE } from "@/lib/straumur";
import { isStraumurConfigured, PAYMENTS_CLOSED_MESSAGE } from "@/lib/straumur-server";
import { startStraumurCheckout } from "@/lib/straumur-checkouts";
import { activateSubscription, type SubscriptionContext } from "@/lib/hc/fulfil";
import {
  attachTestCode, claimTestCode, normaliseTestCode, releaseTestCode, TEST_CODE_INVALID, TEST_CODE_PROVIDER,
  testCodeRateLimited, type TestCodeClaim,
} from "@/lib/hc/test-codes";
import { priceWithCode } from "@/lib/hc/discount";
import { cancelledButRunning, pickCurrent } from "@/lib/hc/subscription-state";
import { isMissingSchema, TRIAL_DAYS, TRIAL_TIER, warnOnce } from "@/lib/hc/subscription";
import { recordWaiver, requireWaiver } from "@/lib/hc/waiver";
import {
  APP_PACKAGE_KEY, COACHING_PACKAGE_KEY, COACHING_TIER, NOT_APPROVED_COPY, NOT_IN_REGION_COPY,
  tierForPackage, type SubscriptionPackageKey,
} from "@/lib/hc/coaching-config";
import { coachingEligibility, coachingPackage } from "@/lib/hc/coaching";
import { approvedRequest, requestView } from "@/lib/hc/coaching-requests";

export const runtime = "nodejs";

/*
 * ── The coaching tier ────────────────────────────────────────────────
 *
 * "Lifeline þjálfun" is bought here too, with package 'coaching-monthly'.
 * No free trial: it is the coach's time that costs, and a trial would spend
 * it on people who have not paid. The 14-day trial unlocks the app tier only.
 *
 * Moving between tiers never leaves two live rows:
 *   app / trial → coaching   the old row is closed (status 'expired', period
 *                            ended now) and the coaching row starts today at
 *                            the full price. No proration while charging is
 *                            a stub; revisit when Straumur is real.
 *   coaching → app           refused while coaching runs (409, with the date):
 *                            "Segja upp" keeps coaching to the end of the
 *                            paid month, and the app tier is bought after.
 *                            Switching mid-month would either lose the month
 *                            paid for or overlap two subscriptions.
 *   cancelled, same tier     resumed (status back to 'active'), no charge —
 *                            the period was already paid for.
 */
const isPackageKey = (x: unknown): x is SubscriptionPackageKey =>
  x === APP_PACKAGE_KEY || x === COACHING_PACKAGE_KEY;

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

async function pkg(key: SubscriptionPackageKey = APP_PACKAGE_KEY) {
  if (key === COACHING_PACKAGE_KEY) {
    const c = await coachingPackage();
    // Never sell off the code fallback: the row has to be in the catalogue.
    return c.in_catalogue ? c : null;
  }
  const { data } = await supabaseAdmin.from("hc_packages")
    .select("key, kind, name, tagline, description, includes, price_isk, interval_months")
    .eq("key", APP_PACKAGE_KEY).eq("active", true).maybeSingle();
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
  const [p, coaching, sub, { count }] = await Promise.all([
    pkg(), coachingPackage(), shown(user.id),
    supabaseAdmin.from("subscriptions").select("id", { count: "exact", head: true }).eq("client_id", user.id),
  ]);
  const [eligibility, request] = await Promise.all([coachingEligibility(user.id, coaching.quota), requestView(user.id)]);
  const trial = sub?.tier === TRIAL_TIER;
  return NextResponse.json({
    /* `package` stays the app tier: the RN app reads it as "the" package. */
    package: p,
    /* Both tiers, for the side-by-side offer on the web. */
    packages: { app: p, coaching },
    coaching: {
      /* Sold only where there is a coach; see src/lib/hc/coaching.ts. */
      available: coaching.in_catalogue && eligibility.eligible,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      in_catalogue: coaching.in_catalogue,
      service_weekday: coaching.quota.service_weekday,
      /* Approved by Lifeline before payment (src/lib/hc/coaching-requests.ts):
         `available` says it may be asked for; `request.state === "approved"`
         says it may be paid for. */
      request,
    },
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

  /*
   * Attempt cap, from the audit trail (as /api/hc/discount does). Once
   * Straumur is live every POST can be a real charge, so a loop must not be.
   */
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count: tries } = await supabaseAdmin.from("hc_audit").select("id", { count: "exact", head: true })
    .eq("actor", `self:${user.id}`).eq("action", "subscribe_try").gte("at", since);
  if ((tries ?? 0) >= 10) return NextResponse.json({ error: "Of margar tilraunir. Reyndu aftur eftir smástund." }, { status: 429 });
  await supabaseAdmin.from("hc_audit").insert({ actor: `self:${user.id}`, action: "subscribe_try", journey_id: null, detail: {} });

  const key: SubscriptionPackageKey = isPackageKey(body?.package) ? body.package : APP_PACKAGE_KEY;
  if (key === COACHING_PACKAGE_KEY && typeof body?.code === "string" && body.code.trim()) {
    return NextResponse.json({ error: "Afsláttarkóðar gilda ekki fyrir þjálfun að svo stöddu." }, { status: 400 });
  }
  const tier = tierForPackage(key);
  const [p, existing, running] = await Promise.all([pkg(key), current(user.id), shown(user.id)]);
  if (!p) return NextResponse.json({ error: "package_not_found" }, { status: 404 });

  if (body?.start_trial === true) {
    // The trial is the app tier's. Coaching is bought outright (header).
    if (key !== APP_PACKAGE_KEY) return NextResponse.json({ error: "Enginn prufutími er í boði fyrir þjálfun." }, { status: 400 });
    return startCardTrial(user.id, p, existing, waiverAt);
  }

  if (key === COACHING_PACKAGE_KEY) {
    const el = await coachingEligibility(user.id);
    if (!el.eligible) {
      return NextResponse.json({
        error: el.reason === "no_address"
          ? "Skráðu heimilisfangið þitt með póstnúmeri til að kaupa þjálfun."
          : `Þjálfun er ${NOT_IN_REGION_COPY.charAt(0).toLowerCase()}${NOT_IN_REGION_COPY.slice(1)}`,
      }, { status: 403 });
    }
  }

  /* Cancelled but still inside its paid period. */
  const runningCancelled = running?.cancelled ? running : null;

  /*
   * Approved before paid (Mads, 2026-10-17). Every path that can start
   * coaching — Straumur, a test code, a free-months code — goes through here.
   * Exempt only what starts nothing new: resuming a coaching month already
   * paid for, or answering "already" for a running one.
   */
  if (key === COACHING_PACKAGE_KEY) {
    const ongoing = (runningCancelled?.tier === COACHING_TIER) || (existing?.tier === COACHING_TIER);
    if (!ongoing && !(await approvedRequest(user.id))) {
      return NextResponse.json({ error: NOT_APPROVED_COPY, code: "coaching_not_approved" }, { status: 403 });
    }
  }
  if (runningCancelled && runningCancelled.tier === tier) {
    // Same tier again: undo "Segja upp" rather than charge for a month paid.
    await supabaseAdmin.from("subscriptions").update({ status: "active" }).eq("id", runningCancelled.id);
    await hcAudit(`self:${user.id}`, "subscription_resumed", null, { tier, subscription_id: runningCancelled.id });
    return NextResponse.json({ ok: true, resumed: true, subscription: { ...runningCancelled, status: "active", cancelled: false } });
  }

  /*
   * A running free trial is not a subscription: paying now replaces it
   * (activateSubscription closes the trial row once the paid row exists).
   * Before this, an active trial row — even one long past its end date —
   * answered "already", so somebody whose trial ran out could never subscribe.
   */
  if (existing && existing.tier === tier) return NextResponse.json({ ok: true, subscription: existing, already: true });

  const live = existing ?? runningCancelled;
  if (live && live.tier === COACHING_TIER && tier !== COACHING_TIER) {
    const until = live.current_period_end ? new Date(live.current_period_end) : null;
    return NextResponse.json({
      error: until
        ? `Þjálfunin gildir til ${until.getUTCDate()}.${until.getUTCMonth() + 1}.${until.getUTCFullYear()}. Segðu henni upp og veldu appið þegar tímabilinu lýkur.`
        : "Segðu þjálfuninni upp og veldu appið þegar tímabilinu lýkur.",
      code: "downgrade_at_period_end",
    }, { status: 409 });
  }
  /* App tier (or a legacy paid tier) → coaching: this row is replaced below. */
  const upgradeRow = live && live.tier !== TRIAL_TIER && live.tier !== tier ? live : null;
  if (upgradeRow && tier !== COACHING_TIER) {
    // Some other paid tier (self-maintained) and asking for the app: keep what they have.
    return NextResponse.json({ ok: true, subscription: upgradeRow, already: true });
  }

  /*
   * The code, priced on the server.
   *
   * The browser sends a string and nothing else. It never sends a price, a
   * discount or an amount — the catalogue price and the code's effect are
   * both looked up here, so a tampered request can only ask for a code that
   * exists and get what that code actually does.
   */
  /*
   * A test code (admin → Heilsuferð → Prófunarkóðar): one period free, no
   * card, no trial that charges later. Recorded as provider 'test_code'.
   */
  const rawTest = normaliseTestCode(body?.test_code);
  let testClaim: TestCodeClaim | null = null;
  if (rawTest) {
    if (await testCodeRateLimited(user.id)) return NextResponse.json({ error: "Of margar tilraunir. Reyndu aftur eftir smástund." }, { status: 429 });
    testClaim = await claimTestCode(rawTest, user.id, "subscription", key);
    if (!testClaim) return NextResponse.json({ error: TEST_CODE_INVALID }, { status: 400 });
  }

  const rawCode = !testClaim && typeof body?.code === "string" ? body.code : "";
  const discount = rawCode.trim()
    ? await priceWithCode(rawCode, "subscription", p.price_isk, user.id)
    : null;
  // A code that does not apply is not a reason to refuse the subscription;
  // it just does not come off. Saying so beats a dead end at the till.
  const chargeIsk = testClaim ? 0 : discount?.ok ? (discount.priceIsk ?? p.price_isk) : p.price_isk;
  const monthsFree = !testClaim && discount?.ok ? (discount.monthsFree ?? 0) : 0;

  const ctx: SubscriptionContext = {
    clientId: user.id,
    packageKey: key,
    priceIsk: p.price_isk,
    intervalMonths: p.interval_months ?? 1,
    chargedIsk: chargeIsk,
    monthsFree,
    discountCode: discount?.ok && discount.code ? { code: discount.code.code, amountOffIsk: discount.amountOffIsk ?? 0 } : null,
    waiverAt,
    provider: testClaim ? TEST_CODE_PROVIDER : chargeIsk > 0 ? "straumur" : null,
    providerReference: testClaim ? testClaim.codeId : null,
    coachingRegion: (p as { quota?: { region: string } }).quota?.region ?? null,
  };

  /*
   * Something to pay: Straumur's hosted payment page, with the card saved
   * for renewals (recurringProcessingModel Subscription; the token arrives
   * in a Tokenization webhook). The subscription starts when Straumur
   * confirms the payment — never here. Until Straumur is configured this
   * refuses, so nothing starts unpaid.
   *
   * Nothing is charged for a free period — there is no zero-krónur card
   * transaction.
   */
  if (chargeIsk > 0) {
    if (!isStraumurConfigured()) return NextResponse.json({ error: PAYMENTS_CLOSED_MESSAGE }, { status: 402 });
    /* The mobile app does not follow a payment-page redirect yet: it would
       read { ok: true } as done. Card payments start from the website only. */
    if (req.headers.get("x-lifeline-client") !== "web") {
      return NextResponse.json({ error: "Greiðsla með korti fer fram á vefnum, lifelinehealth.is." }, { status: 402 });
    }
    const s = await startStraumurCheckout({
      kind: "subscription", clientId: user.id, email: user.email ?? null, amountIsk: chargeIsk,
      description: p.name, payload: { ctx }, origin: siteOrigin(req),
      /* Back to the focused flow when it started there (its last screen
         polls payment-status itself); /app otherwise. A fixed allowlist,
         never a path from the body. */
      returnPath: body?.return_to === "askrift" ? "/app/askrift" : "/app", recurring: true,
    });
    if (!s.ok) return NextResponse.json({ error: s.error }, { status: 402 });
    await hcAudit(`self:${user.id}`, "subscription_checkout_started", null, { package: key, amount: chargeIsk, reference: s.reference });
    return NextResponse.json({ ok: true, pending: true, checkout_url: s.url, reference: s.reference });
  }

  try {
    const sub = await activateSubscription(ctx);
    if (testClaim) await attachTestCode(testClaim, { subscriptionId: sub.id as string });
    return NextResponse.json({ ok: true, subscription: sub, charged_isk: chargeIsk, months_free: monthsFree, test_code: !!testClaim });
  } catch (e) {
    await releaseTestCode(testClaim);
    console.error("[hc] subscription start failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Tókst ekki að hefja áskrift." }, { status: 500 });
  }
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
