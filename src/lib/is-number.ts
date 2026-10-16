// Icelandic number input.
//
// Staff type amounts the Icelandic way: "12.500" is twelve thousand five
// hundred, "12,5" is twelve and a half, "1.250.000 kr" is a million and a
// quarter. The old prompt() handlers stripped every non-digit, so "12,5"
// became 125. parseIsNumber reads all of these, and the English "138.5"
// an FX rate is often pasted as, and returns null for anything it cannot
// read with confidence instead of guessing.

export interface ParseIsNumberOptions {
  /** Allow a leading minus (adjustments). Default false. */
  allowNegative?: boolean;
  /** Only whole numbers (headcounts, quantities). Default false. */
  integer?: boolean;
}

export function parseIsNumber(input: string, opts: ParseIsNumberOptions = {}): number | null {
  let s = (input ?? "").replace(/[\s  ]/g, "").replace(/(kr\.?|isk)$/i, "");
  if (!s) return null;
  let neg = false;
  if (s.startsWith("-") || s.startsWith("−")) { neg = true; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  let normal: string;
  if (dots && commas) {
    // Whichever comes last is the decimal mark: "1.250,5" (IS) or "1,250.5" (EN).
    const decIsComma = s.lastIndexOf(",") > s.lastIndexOf(".");
    const [thou, dec] = decIsComma ? [".", ","] : [",", "."];
    if ((decIsComma ? commas : dots) > 1) return null;
    const [whole, frac] = s.split(dec);
    if (!new RegExp(`^\\d{1,3}(\\${thou}\\d{3})*$`).test(whole) || !/^\d+$/.test(frac)) return null;
    normal = `${whole.split(thou).join("")}.${frac}`;
  } else if (commas) {
    if (commas > 1) return null;
    normal = s.replace(",", ".");
  } else if (dots) {
    // "12.500" / "1.250.000" are thousands; "138.5" / "0.25" are decimals.
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) normal = s.replace(/\./g, "");
    else if (dots === 1) normal = s;
    else return null;
  } else {
    normal = s;
  }
  if (normal.startsWith(".") || normal.endsWith(".")) return null;
  const n = Number(normal);
  if (!Number.isFinite(n)) return null;
  if (neg && !opts.allowNegative) return null;
  if (opts.integer && !Number.isInteger(n)) return null;
  return neg ? -n : n;
}

/** For pre-filling an input: 12500 → "12.500", 12.5 → "12,5". */
export function formatIsNumber(n: number | null | undefined, maxFrac = 4): string {
  if (n == null || !Number.isFinite(n)) return "";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: maxFrac, useGrouping: true }).format(n);
}
