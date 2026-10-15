// Dates, names and small strings for the workstation. Pure and client-safe.
//
// Dates go through the account/ui helpers, which write Icelandic out by hand
// (a browser without Icelandic ICU data prints "Wed, Sep 23, 01:24 PM") and
// read the UTC fields — Iceland is on UTC all year, so those ARE wall-clock
// time here whatever timezone the laptop is set to.

import { fmtDate, fmtDateTime, fmtTime } from "@/app/components/account/ui/dates";
import { hcBtn } from "@/app/components/hc/ui";

/** "20. september 2026" */
export const isDate = (iso: string | null) => (iso ? fmtDate(iso) || iso : "");
/** "miðvikudagur 23. september" */
export const longDate = (d: Date) => fmtDate(d, { weekday: true, year: false });
/** "14:30" */
export const time = (iso: string | null) => (iso ? fmtTime(iso) : "");
/** "mið. 14. okt. kl. 10:30" */
export const dayTime = (iso: string | null) => (iso ? fmtDateTime(iso, { weekday: "short", month: "short" }) : "—");
/** "14. okt." */
export const day = (iso: string | null) => (iso ? fmtDate(iso, { year: false, month: "short" }) : "");

const utcDay = (d: Date) => d.toISOString().slice(0, 10);
export const isToday = (iso: string | null) => !!iso && utcDay(new Date(iso)) === utcDay(new Date());
export const daysSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000) : 0);
export const minutesSince = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 60000) : 0);

export function age(dob: string | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a > 0 && a < 120 ? `${a} ára` : "";
}

export const cleanName = (n: string | null) => (n || "—").replace(/^Prufa\s*[–-]\s*/, "");
export const isTest = (n: string | null) => /^Prufa\s*[–-]/.test(n || "");
/** A Date as the value a datetime-local input wants, in the browser's zone. */
export const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/*
 * The shared buttons at a 44px touch target.
 *
 * hcBtn is min-h-10 (40px). A workstation is used on a tablet at the
 * bedside as often as on a laptop, and the min-h-8/min-h-9 overrides this
 * page used to add made it worse. Swapping the class rather than appending
 * one keeps the result independent of stylesheet order.
 */
const tall = (c: string) => c.replace("min-h-10", "min-h-11");
export const wsBtn = {
  base: tall(hcBtn.base),
  primary: tall(hcBtn.primary),
  secondary: tall(hcBtn.secondary),
  ghost: tall(hcBtn.ghost),
};
