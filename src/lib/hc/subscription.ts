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
// 14 days from the first time we see them. Created server side: the signup
// page used to insert this row from the browser with the anon key, which is
// also how anybody could have inserted themselves a premium one — see
// supabase/migration-subscriptions-rls.sql. Creating it lazily also covers
// everybody who signed up before any of this existed.

import { supabaseAdmin } from "@/lib/supabase-admin";

export const TRIAL_DAYS = 14;

/** Tiers that mean somebody is paying. */
const PAID_TIERS = new Set(["premium", "self-maintained"]);

export interface AppAccess {
  /** May they use Æfingar, Næring and the daily checklist? */
  ok: boolean;
  /**
   * Why, in a form the UI can act on.
   *
   *   paid        a live subscription
   *   health      they bought the check, or a nurse published their plan
   *   trial       inside the 14 days
   *   expired     the trial has run out and nothing replaced it
   *   none        no subscription row at all (should not happen after ensureTrial)
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

/**
 * The subscription that counts, creating a trial if there is none.
 *
 * The table holds cancelled rows beside live ones, so "do they have one" is
 * a question about status. A cancelled row is left alone — somebody who
 * cancelled should not be handed a fresh trial for turning up again.
 */
export async function ensureTrial(clientId: string): Promise<Row | null> {
  const { data: any_ } = await supabaseAdmin.from("subscriptions")
    .select("id, tier, status, trial_ends_at, current_period_end")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle<Row>();
  if (any_) return any_;

  const now = new Date();
  const ends = new Date(now.getTime() + TRIAL_DAYS * 86400_000);
  const { data } = await supabaseAdmin.from("subscriptions")
    .insert({
      client_id: clientId,
      tier: "free-trial",
      status: "active",
      trial_ends_at: ends.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: ends.toISOString(),
    })
    .select("id, tier, status, trial_ends_at, current_period_end")
    .single<Row>();
  return data ?? null;
}

/**
 * Whether the app is open to this person.
 *
 * Order matters: a paid subscription first, then the health check, then the
 * trial. The health check is checked before the trial so that a customer
 * whose trial lapsed months ago still reaches the plan they paid a nurse to
 * write.
 */
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

export async function appAccess(clientId: string): Promise<AppAccess> {
  const [sub, journeyRes] = await Promise.all([
    ensureTrial(clientId),
    supabaseAdmin.from("hc_journeys")
      .select("paid_at, plan_published_at")
      .eq("client_id", clientId).is("cancelled_at", null)
      .order("created_at", { ascending: false }).limit(1)
      .maybeSingle<{ paid_at: string | null; plan_published_at: string | null }>(),
  ]);
  const journey = journeyRes.data;

  const live = sub?.status === "active";
  if (live && sub && PAID_TIERS.has(sub.tier ?? "")) {
    return { ok: true, reason: "paid", trialEndsAt: null, daysLeft: null };
  }

  // Bought the check, or a nurse published a plan: that is a purchase these
  // screens deliver, and it does not expire with an app trial.
  if (journey?.paid_at || journey?.plan_published_at) {
    return { ok: true, reason: "health", trialEndsAt: null, daysLeft: null };
  }

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
