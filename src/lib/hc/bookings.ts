// What a booking is, for both the people who make them.
//
// A participant books from the Þjálfari page (/api/hc/coach) and a coach
// books from the workstation (/api/vinnustod/journeys/[id]/bookings). Both
// write hc_bookings, so both have to agree about what the kinds are, what
// the measurements are called, and how long each one takes — and the
// duration cannot come from whichever page sent the request.
//
// This was one private table inside /api/hc/coach. Moved here when the
// coach side needed the same answers, rather than copied, because the copy
// that drifts is the one nobody is looking at.

/**
 * How long each measurement takes, and the only place that says so.
 *
 * A measurement visit is a list, and its length is its duration: the page
 * adds these up to show a total, and the endpoint adds them up again to
 * decide what actually goes in the diary. Two readings of one table rather
 * than the server trusting a number a page sent.
 */
export const MEASURE_MINUTES: Record<string, number> = {
  bloodpressure: 10,
  bodycomp: 5,
  vo2max: 30,
  strength: 20,
};

/** Icelandic for each measurement, for anything that lists them. */
export const MEASURE_IS: Record<string, string> = {
  bloodpressure: "Blóðþrýstingur",
  bodycomp: "Líkamssamsetning",
  vo2max: "Þrekpróf",
  strength: "Styrkur",
};

export type BookingKind = "video" | "measurement";

/** A video call is half an hour; a measurement visit is the sum of its parts. */
export const VIDEO_MINUTES = 30;

export const isBookingKind = (x: unknown): x is BookingKind =>
  x === "video" || x === "measurement";

/**
 * The measurement keys out of whatever arrived, deduped and known-only.
 *
 * Returns an empty list for anything unrecognised, so a caller can treat
 * "no valid items" as the error it is rather than booking a nought-minute
 * visit.
 */
export function bookingItems(kind: BookingKind, raw: unknown): string[] {
  if (kind !== "measurement") return [];
  const list = Array.isArray(raw) ? (raw as unknown[]) : [];
  return [...new Set(list.map((x) => String(x)))].filter((x) => Object.hasOwn(MEASURE_MINUTES, x));
}

/** Minutes for a booking, from the items rather than from the request. */
export const bookingMinutes = (kind: BookingKind, items: string[]): number =>
  kind === "video" ? VIDEO_MINUTES : items.reduce((n, k) => n + (MEASURE_MINUTES[k] ?? 0), 0);

/** First and last instant of the month a date falls in, in UTC. */
export function monthBounds(now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

/** A booking's own label, for a diary or a list. */
export function bookingLabel(kind: string, items: unknown): string {
  if (kind === "video") return "Myndsamtal";
  const list = Array.isArray(items) ? (items as string[]) : [];
  if (!list.length) return "Mælingar";
  return list.map((k) => MEASURE_IS[k] ?? k).join(" · ");
}
