// The three assessment packages as the account page names them.
//
// Names, descriptions and contents come from the /assessment page's own
// content (ASSESSMENT_DEFAULTS_*, editable on /admin/website), prices from
// the booking flow's PACKAGES — so the page behind the login can never sell
// "Foundational Health" while the public page says "Grunnstoð heilsu".

import { ASSESSMENT_DEFAULTS_EN, ASSESSMENT_DEFAULTS_IS } from "@/lib/site-content/assessment";
import { PACKAGES } from "@/lib/assessment-packages";
import type { PackageKey } from "./types";

const SLOT: Record<PackageKey, 1 | 2 | 3> = { foundational: 1, checkin: 2, "self-checkin": 3 };

export interface PackageView {
  key: PackageKey;
  name: string;
  desc: string;
  includes: string[];
  priceIsk: number;
}

export function packageView(key: PackageKey, locale: string): PackageView {
  const c = locale === "en" ? ASSESSMENT_DEFAULTS_EN : ASSESSMENT_DEFAULTS_IS;
  const n = SLOT[key];
  return {
    key,
    name: String(c[`pkg${n}_name`] ?? key),
    desc: String(c[`pkg${n}_desc`] ?? ""),
    includes: String(c[`pkg${n}_includes`] ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    priceIsk: PACKAGES.find((p) => p.key === key)?.priceIsk ?? 0,
  };
}

export const PACKAGE_KEYS: PackageKey[] = ["foundational", "checkin", "self-checkin"];

export function packageName(key: string | null | undefined, locale: string): string | null {
  return key === "foundational" || key === "checkin" || key === "self-checkin" ? packageView(key, locale).name : null;
}
