// Dates on the account pages, written out by hand in Icelandic.
//
// Browsers ship patchy (often no) "is" locale data, so
// toLocaleDateString("is-IS") can come back as "20.10.2026" on one device
// and "October 20" on another — and the account area used "en-GB" outright
// in two dozen places. Iceland is on UTC all year (no DST), so the UTC
// fields ARE Icelandic wall-clock time, whatever timezone the browser is in.
// Same approach as whenIs() in src/lib/hc/events.ts (server-only).
//
// Client-safe, no React. English falls back to Intl with the Reykjavik zone.

const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const MONTHS_SHORT = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ág.", "sep.", "okt.", "nóv.", "des."];
const WEEKDAYS = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];
const WEEKDAYS_SHORT = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];

type DateInput = string | number | Date;
type Locale = "is" | "en" | string;

interface Parts { y: number; m: number; d: number; wd: number; hh: number; mm: number }

/** A bare "YYYY-MM-DD" is a calendar day, not an instant: never shift it. */
function parts(input: DateInput): Parts | null {
  if (typeof input === "string") {
    const day = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00)?$/.exec(input);
    if (day) {
      const y = +day[1], m = +day[2] - 1, d = +day[3];
      return { y, m, d, wd: new Date(Date.UTC(y, m, d)).getUTCDay(), hh: 0, mm: 0 };
    }
  }
  const dt = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dt.getTime())) return null;
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), wd: dt.getUTCDay(), hh: dt.getUTCHours(), mm: dt.getUTCMinutes() };
}

function toDate(input: DateInput): Date {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(`${input}T00:00:00Z`);
  return input instanceof Date ? input : new Date(input);
}

const pad = (n: number) => String(n).padStart(2, "0");

export interface DateOpts {
  weekday?: boolean | "short";
  year?: boolean;
  month?: "long" | "short";
}

/** "mánudagur 20. október 2026" (options decide weekday / year / short month). */
export function fmtDate(input: DateInput, opts: DateOpts = {}, locale: Locale = "is"): string {
  const { weekday = false, year = true, month = "long" } = opts;
  if (locale === "en") {
    return toDate(input).toLocaleDateString("en-GB", {
      timeZone: "Atlantic/Reykjavik",
      ...(weekday ? { weekday: weekday === "short" ? "short" : "long" } : {}),
      day: "numeric", month, ...(year ? { year: "numeric" } : {}),
    });
  }
  const p = parts(input);
  if (!p) return "";
  const wd = weekday ? `${(weekday === "short" ? WEEKDAYS_SHORT : WEEKDAYS)[p.wd]} ` : "";
  const mo = (month === "short" ? MONTHS_SHORT : MONTHS)[p.m];
  return `${wd}${p.d}. ${mo}${year ? ` ${p.y}` : ""}`;
}

/** "14:30" — 24-hour, Icelandic time. */
export function fmtTime(input: DateInput): string {
  const p = parts(input);
  return p ? `${pad(p.hh)}:${pad(p.mm)}` : "";
}

/** "mánudagur 20. október kl. 14:30". */
export function fmtDateTime(input: DateInput, opts: DateOpts = {}, locale: Locale = "is"): string {
  const date = fmtDate(input, { year: false, ...opts }, locale);
  return locale === "en" ? `${date}, ${fmtTime(input)}` : `${date} kl. ${fmtTime(input)}`;
}

/** "20.10.2026" — tables and compact lists. */
export function fmtNumericDate(input: DateInput): string {
  const p = parts(input);
  return p ? `${p.d}.${p.m + 1}.${p.y}` : "";
}

/** "október 2026" — "member since". */
export function fmtMonthYear(input: DateInput, locale: Locale = "is"): string {
  if (locale === "en") return toDate(input).toLocaleDateString("en-GB", { timeZone: "Atlantic/Reykjavik", month: "long", year: "numeric" });
  const p = parts(input);
  return p ? `${MONTHS[p.m]} ${p.y}` : "";
}

/** "49.900 kr." — ISK with Icelandic grouping, done by hand for the same reason as the dates. */
export function fmtIsk(amount: number): string {
  const s = Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${s} kr.`;
}
