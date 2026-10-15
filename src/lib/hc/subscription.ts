// Who may use the app, and until when.
//
// ── The two things being sold ────────────────────────────────────────
//
// The health check is a single fee: measurements, blood, a report, an
// interview, and a plan written with a nurse. The app — Æfingar, Næring, the
// daily checklist — is a monthly subscription. They are separate purchases
// and either works without the other.
//
// That distinction is the whole design of this file, because it decides who
// a paywall must not catch. Somebody who paid 49.900 kr for a health check
// bought a plan, and the plan is delivered through these screens. Locking
// them out because an app trial lapsed would be taking away what they paid
// for. So a paid check, or a plan a nurse published, grants app access on
// its own and for good.
//
// ── The trial ────────────────────────────────────────────────────────
//
// 14 days. Created server side: the signup page used to insert this row from
// the browser with the anon key, which is also how anybody could have
// inserted themselves a premium one — see supabase/migration-subscriptions-rls.sql.
//
// While STRAUMUR_CARDS_LIVE is false (no real card storage yet) the trial is
// created lazily the first time we see somebody, and again topped up to 14
// days when they put their own plan together (startPlanTrial) — Mads,
// 2026-10-15: "a self-made plan unlocks all features in a 14-day trial".
// Once cards are live, a trial only starts when a card is saved for it
// (POST /api/hc/subscribe { start_trial }), and the cron in
// api/cron/hc-trial-reminders turns it into the paid tier at trial_ends_at.
//
// ── What "health" means (the self-made-plan loophole) ────────────────
//
// hc_journeys.plan_published_at is also set when somebody builds their own
// plan (api/hc/my-plan). This file used to read any plan_published_at as "a
// nurse wrote them a plan", so building your own plan unlocked the app for
// good. Health access now needs a paid health check (journey paid_at, or a
// paid hc_orders row for a check), a B2B journey, or a plan that staff wrote
// or published (hc_action_plans.created_by not "self:…", or a staff row in
// hc_plan_versions).
//
// People who had built their own plan before that change are not cut off on
// the spot: the first time we see them after it, their trial is set to end
// 14 days from then (SELF_PLAN_GRACE_BEFORE, applied once — see grace()).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { isRunning } from "@/lib/hc/subscription-state";
import { STRAUMUR_CARDS_LIVE } from "@/lib/straumur";

export const TRIAL_DAYS = 14;
export const TRIAL_TIER = "free-trial";

/**
 * Self-made plans published before this moment relied on the old rule and get
 * one fresh 14-day trial from the first time we see them afterwards. Set to
 * the day the change was written; if it ships much later, move it to the
 * deploy date so plans made in between are covered too.
 */
const SELF_PLAN_GRACE_BEFORE = Date.parse("2026-10-20T00:00:00Z");

/** Tiers that mean somebody is paying. */
export const PAID_TIERS = new Set(["premium", "self-maintained"]);

// ── Schema that may not exist yet ────────────────────────────────────
// Migrations are run by hand, so code can reach production before its
// columns do. These recognise "column/table missing" so a caller can carry on
// without it, and say so in the log once rather than on every request.

const warned = new Set<string>();
export function warnOnce(key: string, msg: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[hc] ${msg}`);
}
export function isMissingSchema(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  // 42703 undefined column, 42P01 undefined table, PGRST204/205 not in the schema cache.
  return ["42703", "42P01", "PGRST204", "PGRST205"].includes(err.code ?? "")
    || /column .* does not exist|could not find the .* (column|table)/i.test(err.message ?? "");
}

export interface AppAccess {
  /** May they use Æfingar, Næring and the daily checklist? */
  ok: boolean;
  /**
   * Why, in a form the UI can act on.
   *
   *   paid        a live subscription
   *   health      they bought the check, came through an employer, or staff wrote their plan
   *   trial       inside the 14 days
   *   expired     the trial has run out and nothing replaced it
   *   none        no subscription row at all (before a card-backed trial is started)
   *   open        the paywall is not enforcing; see PAYWALL_ENFORCED
   */
  reason: "paid" | "health" | "trial" | "expired" | "none" | "open";
  /**
   * What the gate WOULD have said, when reason is "open".
   *
   * Null whenever access was genuinely earned, so a caller can tell
   * "subscribed" from "let in because the door is open".
   */
  blocked?: "expired" | "none" | null;
  /** When the trial ends, for the countdown. */
  trialEndsAt: string | null;
  /** Days left, floored, never negative. */
  daysLeft: number | null;
}

interface Row {
  id: string;
  tier: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
}
const ROW = "id, tier, status, trial_ends_at, current_period_end";

async function latest(clientId: string): Promise<Row | null> {
  const { data } = await supabaseAdmin.from("subscriptions")
    .select(ROW)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle<Row>();
  return data ?? null;
}

async function insertTrial(clientId: string): Promise<Row | null> {
  const now = new Date();
  const ends = new Date(now.getTime() + TRIAL_DAYS * 86400_000);
  const { data } = await supabaseAdmin.from("subscriptions")
    .insert({
      client_id: clientId,
      tier: TRIAL_TIER,
      status: "active",
      trial_ends_at: ends.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: ends.toISOString(),
    })
    .select(ROW)
    .single<Row>();
  return data ?? null;
}

/**
 * The subscription that counts, creating a trial if there is none.
 *
 * The table holds cancelled rows beside live ones, so "do they have one" is
 * a question about status. A cancelled row is left alone — somebody who
 * cancelled should not be handed a fresh trial for turning up again.
 *
 * Once cards are live this no longer creates anything: a trial then starts
 * only with a card saved for it (startCardTrial), so the person has agreed
 * to what happens when it ends.
 */
export async function ensureTrial(clientId: string): Promise<Row | null> {
  const any_ = await latest(clientId);
  if (any_) return any_;
  if (STRAUMUR_CARDS_LIVE) return null;
  return insertTrial(clientId);
}

/** When this trial row ends, in ms; old rows carry it only in current_period_end. */
function trialEnd(sub: Row): number {
  const iso = sub.trial_ends_at ?? sub.current_period_end;
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** Set an active free-trial row to end `days` from now, unless it already ends later. */
async function topUpTrial(sub: Row, days = TRIAL_DAYS): Promise<Row> {
  const target = new Date(Date.now() + days * 86400_000);
  const cur = trialEnd(sub);
  if (cur >= target.getTime()) return sub;
  const iso = target.toISOString();
  const { data } = await supabaseAdmin.from("subscriptions")
    .update({ trial_ends_at: iso, current_period_end: iso })
    .eq("id", sub.id).eq("tier", TRIAL_TIER).eq("status", "active")
    .select(ROW).maybeSingle<Row>();
  return data ?? sub;
}

/**
 * Their own plan was just created: 14 days of the whole app from now.
 *
 * No row → the trial starts now (cards not live; once they are, the UI asks
 * for a card instead). An active trial that would end sooner → it now ends
 * 14 days from today. A paid, cancelled or expired row is left alone: this
 * is not a way to get a second trial.
 */
export async function startPlanTrial(clientId: string): Promise<void> {
  const sub = await latest(clientId);
  if (!sub) { await ensureTrial(clientId); return; }
  if (sub.tier === TRIAL_TIER && sub.status === "active") await topUpTrial(sub);
}

/**
 * Health-check access: something was bought, an employer sent them, or staff
 * wrote the plan. Never a plan the person built themselves.
 */
export async function healthAccess(clientId: string, journey?: Journey | null): Promise<boolean> {
  const j = journey === undefined ? await latestJourney(clientId) : journey;
  if (j?.paid_at || j?.entry === "b2b") return true;

  const { data: orders } = await supabaseAdmin.from("hc_orders")
    .select("id").eq("client_id", clientId).eq("status", "paid")
    .in("kind", ["health_check", "reevaluation"]).limit(1);
  if (orders?.length) return true;

  if (j?.plan_published_at) return staffPlan(j.id);
  return false;
}

interface Journey {
  id: string;
  entry: string | null;
  paid_at: string | null;
  plan_published_at: string | null;
}

async function latestJourney(clientId: string): Promise<Journey | null> {
  const { data } = await supabaseAdmin.from("hc_journeys")
    .select("id, entry, paid_at, plan_published_at")
    .eq("client_id", clientId).is("cancelled_at", null)
    .order("created_at", { ascending: false }).limit(1)
    .maybeSingle<Journey>();
  return data ?? null;
}

/** Staff wrote or published this journey's plan. */
async function staffPlan(journeyId: string): Promise<boolean> {
  const [{ data: plan }, { data: staffVersion }] = await Promise.all([
    supabaseAdmin.from("hc_action_plans").select("created_by, status")
      .eq("journey_id", journeyId).maybeSingle<{ created_by: string | null; status: string | null }>(),
    supabaseAdmin.from("hc_plan_versions").select("id")
      .eq("journey_id", journeyId).eq("by_kind", "staff").limit(1),
  ]);
  if (staffVersion?.length) return true;
  if (!plan || plan.status !== "published") return false;
  // Plans made in api/hc/my-plan are created_by "self:<uuid>"; staff plans carry the staff label.
  return !(plan.created_by ?? "").startsWith("self:");
}

/**
 * One fresh trial for people who built their own plan before the loophole
 * closed. Applied at most once: afterwards trial_ends_at is at least 14 days
 * past SELF_PLAN_GRACE_BEFORE, which is what the check looks for.
 */
async function grace(sub: Row | null, journey: Journey | null): Promise<Row | null> {
  if (!sub || sub.tier !== TRIAL_TIER || sub.status !== "active") return sub;
  const planAt = journey?.plan_published_at ? Date.parse(journey.plan_published_at) : NaN;
  if (!(planAt < SELF_PLAN_GRACE_BEFORE)) return sub;
  if (trialEnd(sub) >= SELF_PLAN_GRACE_BEFORE + TRIAL_DAYS * 86400_000) return sub;
  const next = await topUpTrial(sub);
  if (next !== sub) {
    await supabaseAdmin.from("hc_audit").insert({
      actor: "system", action: "trial_grace_self_plan", journey_id: journey?.id ?? null,
      detail: { subscription_id: sub.id, was: sub.trial_ends_at, now: next.trial_ends_at },
    }).then(() => {}, () => {});
  }
  return next;
}

/**
 * Whether the paywall actually turns anybody away.
 *
 * Mads' call, 2026-10-12: keep the real gateway, let everyone through for
 * now. Nothing is stubbed or deleted to achieve that — the Straumur
 * checkout, the trial clock, the tiers and the discount codes all stay
 * exactly where they are, so enforcing again is this one line and not a
 * rebuild.
 *
 * While it is false, appAccess still works out the real answer first and
 * reports it in `blocked`. That matters: without it the honest state would
 * be invisible, and nobody could tell how many people the paywall would be
 * stopping on the day it goes back on.
 */
const PAYWALL_ENFORCED = false;

/**
 * Whether the app is open to this person.
 *
 * Order matters: a paid subscription first, then the health check, then the
 * trial. The health check is checked before the trial so that a customer
 * whose trial lapsed months ago still reaches the plan they paid a nurse to
 * write.
 */
export async function appAccess(clientId: string): Promise<AppAccess> {
  const [first, journey] = await Promise.all([ensureTrial(clientId), latestJourney(clientId)]);

  /* Cancelled but inside the paid period still counts: "Segja upp" stops
     the renewal, not the month already paid for (subscription-state.ts). */
  if (isRunning(first) && first && PAID_TIERS.has(first.tier ?? "")) {
    return { ok: true, reason: "paid", trialEndsAt: null, daysLeft: null };
  }

  // Bought the check, came through an employer, or staff wrote the plan:
  // that is a purchase these screens deliver, and it does not expire with an
  // app trial. A plan they built themselves is not (see the header).
  if (await healthAccess(clientId, journey)) {
    return { ok: true, reason: "health", trialEndsAt: null, daysLeft: null };
  }

  const sub = await grace(first, journey);
  const live = isRunning(sub);

  const ends = sub?.trial_ends_at ?? sub?.current_period_end ?? null;
  if (!sub) return deny("none", null);
  if (!live) return deny("expired", ends);

  if (ends) {
    const ms = new Date(ends).getTime() - Date.now();
    if (ms > 0) {
      return {
        ok: true, reason: "trial", trialEndsAt: ends,
        daysLeft: Math.max(0, Math.floor(ms / 86400_000)),
      };
    }
    return deny("expired", ends);
  }

  /*
   * An active row with no end date. Old free-trial rows were written with a
   * 365-day period and no trial_ends_at, so treating "no date" as expired
   * would lock out people who did nothing wrong. Open, and the next write
   * gives it a date.
   */
  return { ok: true, reason: "trial", trialEndsAt: null, daysLeft: null };
}

/**
 * One exit for every "no", so the switch cannot be honoured in some
 * branches and forgotten in others.
 */
function deny(reason: "expired" | "none", trialEndsAt: string | null): AppAccess {
  if (PAYWALL_ENFORCED) return { ok: false, reason, trialEndsAt, daysLeft: 0 };
  return { ok: true, reason: "open", blocked: reason, trialEndsAt, daysLeft: null };
}
