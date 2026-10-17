// Who has a person on the other end, and on what terms.
//
// The app tier ("Lifeline appið", subscriptions.tier 'premium') is the app
// and nothing else: no messages, no bookings — nobody's time. Somebody else
// on the other end comes three ways:
//
//   coaching       an active "Lifeline þjálfun" subscription (tier 'coaching').
//                  Quotas from hc_packages.quota: video check-ins per calendar
//                  month, one measurement per N months, bookings only on the
//                  coach's service day.
//   care           the health check they bought, an employer (B2B) or a
//                  referral. The nurse contact is part of what was paid for and
//                  stays exactly as it was: the journey's own video allowance,
//                  any weekday, no measurement quota.
//   grandfathered  on a coaching track with an assigned coach and a
//                  conversation from before the tier existed — kept on the old
//                  rules until COACHING_GRANDFATHER_UNTIL so nobody is cut off
//                  mid-conversation (coaching-config.ts).
//
// Everybody else gets the offer instead of the thread.
//
// ── Eligibility (Vestmannaeyjar only) ────────────────────────────────
//
// The signal is the postcode in the person's own address (clients.address,
// encrypted, read through clients_decrypted — format "Gata 1, 900 Bær" from
// /api/hc/profile). hc_journeys.location_id is NOT used: every journey is
// created with DEFAULT_LOCATION = vestmannaeyjar whatever the person chose,
// so it would say "Vestmannaeyjar" for everyone. No address → not eligible
// yet, with a reason the UI turns into "skráðu heimilisfang".
//
// Server only (supabase-admin).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { postcodeFromAddress } from "@/lib/hc/address";
import { isRunning } from "@/lib/hc/subscription-state";
import { healthAccess, isMissingSchema, warnOnce } from "@/lib/hc/subscription";
import type { HcJourney } from "@/lib/hc/types";
import {
  COACHING_DEFAULTS, COACHING_GRANDFATHER_BEFORE, COACHING_GRANDFATHER_UNTIL,
  COACHING_PACKAGE_KEY, COACHING_TIER, readQuota, type CoachingQuota,
} from "@/lib/hc/coaching-config";

export interface CoachingPackage {
  key: string;
  kind: string;
  name: string;
  tagline: string | null;
  description: string | null;
  includes: string[] | null;
  price_isk: number;
  interval_months: number | null;
  quota: CoachingQuota;
  /** False when the row is not in the database yet (migration not run). */
  in_catalogue: boolean;
}

const FALLBACK_PACKAGE: Omit<CoachingPackage, "quota" | "in_catalogue"> = {
  key: COACHING_PACKAGE_KEY,
  kind: "subscription",
  name: "Lifeline þjálfun",
  tagline: "Appið og heilsuþjálfi í Vestmannaeyjum",
  description: "Allt appið, auk hjúkrunarfræðings sem heilsuþjálfa: skilaboð, mánaðarlegt myndsamtal og mælingar á staðnum.",
  includes: null,
  price_isk: COACHING_DEFAULTS.price_isk,
  interval_months: 1,
};

/**
 * The coaching package with its quota.
 *
 * Falls back to COACHING_DEFAULTS when the row or the quota column is
 * missing, so the page still describes the product — but `in_catalogue`
 * false stops anything from being sold off a fallback (subscribe refuses).
 */
export async function coachingPackage(): Promise<CoachingPackage> {
  const cols = "key, kind, name, tagline, description, includes, price_isk, interval_months";
  let { data, error } = await supabaseAdmin.from("hc_packages")
    .select(`${cols}, quota`).eq("key", COACHING_PACKAGE_KEY).eq("active", true).maybeSingle();
  if (error && isMissingSchema(error)) {
    warnOnce("hc_packages.quota", "hc_packages.quota missing — run supabase/migration-coaching-tier.sql; using COACHING_DEFAULTS.");
    ({ data, error } = await supabaseAdmin.from("hc_packages")
      .select(cols).eq("key", COACHING_PACKAGE_KEY).eq("active", true).maybeSingle());
  }
  if (!data) {
    return { ...FALLBACK_PACKAGE, includes: coachingIncludes(readQuota(null)), quota: readQuota(null), in_catalogue: false };
  }
  const row = data as Record<string, unknown>;
  const quota = readQuota(row.quota);
  return {
    key: String(row.key), kind: String(row.kind), name: String(row.name),
    tagline: (row.tagline as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    includes: Array.isArray(row.includes) ? (row.includes as string[]) : coachingIncludes(quota),
    price_isk: Number(row.price_isk), interval_months: (row.interval_months as number | null) ?? 1,
    quota, in_catalogue: true,
  };
}

/** What the tier includes, worded from the quota — the fallback for `includes`. */
export function coachingIncludes(q: CoachingQuota): string[] {
  return [
    "Allt sem fylgir Lifeline appinu",
    "Skilaboð við heilsuþjálfa (hjúkrunarfræðing)",
    `${q.video_per_month === 1 ? "Eitt" : q.video_per_month} ${q.video_minutes} mínútna myndsamtal á mánuði`,
    `Mæling á staðnum ${q.measurement_every_months === 1 ? "einu sinni í mánuði" : `á ${q.measurement_every_months} mánaða fresti`}`,
    "Skilaboðum er svarað á þjónustudegi vikunnar",
  ];
}

// ── Eligibility ──────────────────────────────────────────────────────

export interface Eligibility {
  eligible: boolean;
  /** no_address: nothing to go on yet; outside_region: an address elsewhere. */
  reason: "no_address" | "outside_region" | null;
  postcode: string | null;
}

/**
 * The postcode in the person's address, or null.
 *
 * Read through postcodeFromAddress (src/lib/hc/address.ts), which only
 * returns codes in Pósturinn's list: the validated "Gata 1, 900 Staður" form
 * that /api/hc/profile writes since the address became postcode-first, and,
 * for older free-text rows, a real three-digit postcode anywhere in it or a
 * known place name ("Vestmannaeyjar" → 900).
 */
export function postcodeOf(address: string | null | undefined): string | null {
  return postcodeFromAddress(address)?.postcode ?? null;
}

export async function coachingEligibility(clientId: string, quota?: CoachingQuota): Promise<Eligibility> {
  const q = quota ?? (await coachingPackage()).quota;
  const { data } = await supabaseAdmin.from("clients_decrypted")
    .select("address").eq("id", clientId).maybeSingle<{ address: string | null }>();
  const postcode = postcodeOf(data?.address);
  if (!postcode) return { eligible: false, reason: "no_address", postcode: null };
  return q.postcodes.includes(postcode)
    ? { eligible: true, reason: null, postcode }
    : { eligible: false, reason: "outside_region", postcode };
}

// ── Access ───────────────────────────────────────────────────────────

export type CoachingMode = "coaching" | "care" | "grandfathered" | "none";

export interface CoachingAccess {
  /** May they message and book? */
  ok: boolean;
  mode: CoachingMode;
  quota: CoachingQuota;
  /** The coaching subscription, when that is what grants it. */
  subscription: { id: string; current_period_end: string | null; cancelled: boolean } | null;
}

interface SubRow { id: string; tier: string | null; status: string | null; current_period_end: string | null; created_at?: string | null }

/** A running (active, or cancelled with time left) coaching subscription. */
export async function coachingSubscription(clientId: string): Promise<SubRow | null> {
  const { data } = await supabaseAdmin.from("subscriptions")
    .select("id, tier, status, current_period_end, created_at")
    .eq("client_id", clientId).eq("tier", COACHING_TIER).in("status", ["active", "cancelled"])
    .order("created_at", { ascending: false }).limit(5);
  return ((data ?? []) as SubRow[]).find((r) => isRunning(r)) ?? null;
}

/** Talking to a coach before the tier existed, and still inside the grace. */
async function grandfathered(journey: Pick<HcJourney, "id" | "coach_id"> | null): Promise<boolean> {
  if (!journey?.coach_id) return false;
  if (COACHING_GRANDFATHER_UNTIL && Date.now() > Date.parse(COACHING_GRANDFATHER_UNTIL)) return false;
  const { data } = await supabaseAdmin.from("hc_chat").select("id")
    .eq("journey_id", journey.id).lt("created_at", COACHING_GRANDFATHER_BEFORE).limit(1);
  return !!data?.length;
}

/**
 * Whether this person has somebody on the other end, and on which rules.
 *
 * Care before coaching: somebody who bought the health check AND coaching
 * keeps the check's terms (which are the more generous), so buying more never
 * gets them less.
 */
export async function coachingAccess(clientId: string, journey: HcJourney | null): Promise<CoachingAccess> {
  const [pkg, sub] = await Promise.all([coachingPackage(), coachingSubscription(clientId)]);
  const quota = pkg.quota;
  const subscription = sub
    ? { id: sub.id, current_period_end: sub.current_period_end, cancelled: sub.status === "cancelled" }
    : null;

  /* Care = a health check that is paid, an employer (B2B), or a referral.
     NOT the bare entry: 'b2c' is every new journey's default and anyone can
     choose the check track, so trusting it would hand out the coach for free
     (security review 2026-10-15). healthAccess checks paid_at, paid orders,
     B2B and staff-written plans. Questions before buying go to contact@. */
  const care = journey?.entry === "heilsugaesla" || await healthAccess(clientId, journey
    ? { id: journey.id, entry: journey.entry, paid_at: journey.paid_at, plan_published_at: journey.plan_published_at }
    : null);
  if (care) return { ok: true, mode: "care", quota, subscription };
  if (sub) return { ok: true, mode: "coaching", quota, subscription };
  if (await grandfathered(journey)) return { ok: true, mode: "grandfathered", quota, subscription };
  return { ok: false, mode: "none", quota, subscription };
}

/** The short answer: a coaching subscription, or the nurse contact a health check / employer includes. */
export async function hasCoaching(clientId: string, journey: HcJourney | null): Promise<boolean> {
  return (await coachingAccess(clientId, journey)).ok;
}

// ── Quotas (coaching mode only) ──────────────────────────────────────

/** Add calendar months in UTC, clamping to the month's last day. */
export function addMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes()));
}

/**
 * The measurement booked closest to `when` that blocks it: any non-cancelled
 * measurement less than N months before or after. Returns when the next one
 * may be booked, or null if `when` is free.
 */
export async function measurementBlockedUntil(clientId: string, when: Date, everyMonths: number): Promise<Date | null> {
  const from = addMonths(when, -everyMonths).toISOString();
  const to = addMonths(when, everyMonths).toISOString();
  const { data } = await supabaseAdmin.from("hc_bookings").select("starts_at")
    .eq("client_id", clientId).eq("kind", "measurement").neq("status", "cancelled")
    /* A measurement bought on its own in the shop is not the tier's. */
    .is("order_id", null)
    .gt("starts_at", from).lt("starts_at", to).order("starts_at", { ascending: false });
  const rows = (data ?? []) as { starts_at: string }[];
  if (!rows.length) return null;
  // Strictly inside the window → blocked until N months after the latest.
  return addMonths(new Date(rows[0].starts_at), everyMonths);
}

/** The first day of the next calendar month (UTC), for "next video from". */
export function nextMonthStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

/** "3. nóvember" — hand-formatted, the runtime has no Icelandic locale data. */
const MO_GEN = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
export const isDate = (d: Date) => `${d.getUTCDate()}. ${MO_GEN[d.getUTCMonth()]}`;

/**
 * Remaining quota for a coaching-tier client, for the workstation badge and
 * the participant's Bóka tab. Cheap: two count queries.
 */
export async function coachingRemaining(clientId: string, quota: CoachingQuota, now = new Date()) {
  const monthFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const monthTo = nextMonthStart(now).toISOString();
  const [{ count: videos }, blocked] = await Promise.all([
    supabaseAdmin.from("hc_bookings").select("id", { count: "exact", head: true })
      .eq("client_id", clientId).eq("kind", "video").neq("status", "cancelled")
      .gte("starts_at", monthFrom).lt("starts_at", monthTo),
    measurementBlockedUntil(clientId, now, quota.measurement_every_months),
  ]);
  return {
    video_left: Math.max(0, quota.video_per_month - (videos ?? 0)),
    video_allowance: quota.video_per_month,
    /** Null = a measurement can be booked now. */
    measurement_next_at: blocked && blocked.getTime() > now.getTime() ? blocked.toISOString() : null,
  };
}

/**
 * Give a new coaching subscriber a coach if they have none, so they appear in
 * somebody's caseload and their messages have an addressee.
 *
 * Picks an active worker taking clients who covers the coaching region's
 * location (or covers every location), nurses first. Does nothing if nobody
 * qualifies — the thread still reaches the workstation inbox, which lists
 * every journey at the worker's locations.
 */
export async function assignCoachIfNone(journey: HcJourney, region: string): Promise<string | null> {
  if (journey.coach_id) return journey.coach_id;
  const { data: loc } = await supabaseAdmin.from("hc_locations").select("id").eq("slug", region).maybeSingle();
  const { data: workers } = await supabaseAdmin.from("hc_workers")
    .select("id, role, location_ids").eq("active", true).eq("accepting_clients", true);
  const fits = ((workers ?? []) as { id: string; role: string | null; location_ids: string[] | null }[])
    .filter((w) => !w.location_ids?.length || (loc?.id && w.location_ids.includes(loc.id)))
    .sort((a, b) => Number(b.role === "nurse") - Number(a.role === "nurse"));
  const pick = fits[0]?.id ?? null;
  if (!pick) return null;
  await supabaseAdmin.from("hc_journeys")
    .update({ coach_id: pick, coach_changed_at: new Date().toISOString() }).eq("id", journey.id).is("coach_id", null);
  return pick;
}
