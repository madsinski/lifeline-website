// Number formatting for the health-check journey, by hand.
//
// Same reason as account/ui/dates.ts: browsers ship patchy "is" locale data,
// so toLocaleString("is-IS") gave "72.5" on one device and "72,5" on another.
// Icelandic writes a decimal comma and groups thousands with a dot.
// Client-safe, no React. Dates: use fmtDate / fmtTime / fmtDateTime from
// "@/app/components/account/ui/dates".

/** 1234.56 → "1.234,6" (at most `digits` decimals, trailing zeros dropped). */
export function fmtNum(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "";
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(digits);
  const [int, frac = ""] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const dec = frac.replace(/0+$/, "");
  const out = dec ? `${grouped},${dec}` : grouped;
  return neg && out !== "0" ? `-${out}` : out;
}

const WEEKDAYS_SHORT = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];

/** "mið." — the short weekday alone (account/ui/dates only has it with the date).
 *  Iceland is on UTC all year, so the UTC day IS the Icelandic day. */
export function fmtWeekdayShort(input: string | number | Date): string {
  const d = typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input) ? new Date(`${input}T00:00:00Z`) : new Date(input);
  return Number.isNaN(d.getTime()) ? "" : WEEKDAYS_SHORT[d.getUTCDay()];
}
