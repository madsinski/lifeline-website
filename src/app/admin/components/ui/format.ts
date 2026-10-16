// Plain numbers for admin screens, with Icelandic grouping done by hand
// (same reason as fmtIsk in account/ui/dates.ts: browsers ship patchy "is"
// locale data, so toLocaleString("is-IS") can come back as "1,234" on one
// device and "1.234" on another). Króna amounts use fmtIsk instead.

/** 1234567.8 → "1.234.567,8". `max`/`min` fraction digits, like Intl. */
export function fmtNum(n: number, opts: { max?: number; min?: number } = {}): string {
  if (!Number.isFinite(n)) return String(n);
  const { min = 0 } = opts;
  const max = Math.max(opts.max ?? 0, min);
  let s = Math.abs(n).toFixed(max);
  if (max > min) s = s.replace(new RegExp(`(\\.\\d{${min}}\\d*?)0+$`), "$1").replace(/\.$/, "");
  const [int, frac] = s.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = n < 0 && Number(s) !== 0 ? "-" : "";
  return `${sign}${grouped}${frac ? `,${frac}` : ""}`;
}
