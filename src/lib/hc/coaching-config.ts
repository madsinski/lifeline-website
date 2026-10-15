// The two consumer tiers, and the knobs that make the coaching one pay.
//
// Mads, 2026-10-15:
//   1. "Lifeline appið"   3.490 kr./mán. — the whole app, self-service. No
//      person on the other end: no coach messaging, no bookings.
//   2. "Lifeline þjálfun" 7.990 kr./mán. — the app plus a nurse / health
//      coach (heilsuþjálfi/hjúkrunarfræðingur): messaging, ONE 20-minute
//      video check-in a month, ONE on-site measurement every two months,
//      booked by the user. Vestmannaeyjar only to start. The coach works ONE
//      day a week and answers messages, takes the calls and does the
//      measurements on that day — so nothing here may promise a quick reply.
//
// ── Where the numbers live ───────────────────────────────────────────
//
// The price is hc_packages.price_isk (row 'coaching-monthly'). The quotas,
// the service day and the region are hc_packages.quota (jsonb) on the same
// row, so they can be changed with one UPDATE in the SQL editor and no
// deploy. COACHING_DEFAULTS below is what the code falls back to when the
// row or the column is not there yet (migration not run) — keep the two in
// step. See supabase/migration-coaching-tier.sql.
//
// No server imports here: the browser reads the labels and the fallbacks.

export const APP_PACKAGE_KEY = "app-monthly";
/** subscriptions.tier for the app tier (what the RN app and the cron call it). */
export const APP_TIER = "premium";

export const COACHING_PACKAGE_KEY = "coaching-monthly";
/** subscriptions.tier for the coaching tier. */
export const COACHING_TIER = "coaching";

export type SubscriptionPackageKey = typeof APP_PACKAGE_KEY | typeof COACHING_PACKAGE_KEY;

export const tierForPackage = (key: SubscriptionPackageKey): string =>
  key === COACHING_PACKAGE_KEY ? COACHING_TIER : APP_TIER;

export interface CoachingQuota {
  /** Video check-ins per calendar month. */
  video_per_month: number;
  /** Length of one video check-in, minutes. */
  video_minutes: number;
  /** One on-site measurement per this many months (rolling, from the last one). */
  measurement_every_months: number;
  /** The coach's service day, 0 = sunnudagur … 6 = laugardagur (Iceland = UTC). */
  service_weekday: number;
  /** hc_locations.slug / hc_packages.region where coaching is sold. */
  region: string;
  /** Postcodes that count as living in the region (from the profile address). */
  postcodes: string[];
}

/**
 * Fallbacks, used only where hc_packages.quota is missing or partial.
 *
 * service_weekday 3 (miðvikudagur) is a placeholder: Mads has not named the
 * day yet. Set it in hc_packages.quota, not here, once he has.
 */
export const COACHING_DEFAULTS: CoachingQuota & { price_isk: number } = {
  price_isk: 7990,
  video_per_month: 1,
  video_minutes: 20,
  measurement_every_months: 2,
  service_weekday: 3,
  region: "vestmannaeyjar",
  postcodes: ["900", "902"],
};

/** Merge a quota jsonb from the database over the defaults, keeping only sane values. */
export function readQuota(raw: unknown): CoachingQuota {
  const q = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const int = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : d;
  return {
    video_per_month: int(q.video_per_month, 0, 10, COACHING_DEFAULTS.video_per_month),
    video_minutes: int(q.video_minutes, 10, 90, COACHING_DEFAULTS.video_minutes),
    measurement_every_months: int(q.measurement_every_months, 1, 24, COACHING_DEFAULTS.measurement_every_months),
    service_weekday: int(q.service_weekday, 0, 6, COACHING_DEFAULTS.service_weekday),
    region: typeof q.region === "string" && q.region ? q.region : COACHING_DEFAULTS.region,
    postcodes: Array.isArray(q.postcodes) && q.postcodes.every((p) => typeof p === "string") && q.postcodes.length
      ? (q.postcodes as string[]) : COACHING_DEFAULTS.postcodes,
  };
}

/**
 * Coaching-track users who were already talking to a coach before the tier
 * existed keep messaging and booking as before (the journey's own allowance,
 * any weekday) instead of meeting a paywall mid-conversation.
 *
 * Grandfathered = the journey has a coach AND at least one hc_chat message
 * from before COACHING_GRANDFATHER_BEFORE. It lasts until
 * COACHING_GRANDFATHER_UNTIL, after which they see the coaching offer like
 * everybody else. Move BEFORE to the deploy date if this ships later than
 * written; set UNTIL to null to grandfather for good.
 */
export const COACHING_GRANDFATHER_BEFORE = "2026-10-16T00:00:00Z";
export const COACHING_GRANDFATHER_UNTIL: string | null = "2026-12-31T23:59:59Z";

/** The one sentence about response times. Never promise faster. */
export const SERVICE_DAY_COPY = "Skilaboðum er svarað á þjónustudegi vikunnar.";

export const NOT_IN_REGION_COPY = "Í boði í Vestmannaeyjum – fleiri staðir síðar.";

/** Weekday names, plural dative, for "á miðvikudögum". */
export const WEEKDAY_DAT_PL = ["sunnudögum", "mánudögum", "þriðjudögum", "miðvikudögum", "fimmtudögum", "föstudögum", "laugardögum"];
