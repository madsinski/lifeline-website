// One address format, read and written in one place.
//
// clients.address is a single encrypted string, "Gata 1, 900 Vestmannaeyjum"
// since /api/hc/profile started writing it, but older rows are whatever
// somebody typed: "Vestmannaeyjar", "Heiðarvegur 5 900", "900". Everything
// that needs the postcode (coaching eligibility above all) reads it through
// postcodeFromAddress(), which only ever returns a code that exists in
// Pósturinn's list (src/lib/is-postcodes.ts).
//
// Client-safe: no server imports.

import { IS_POSTCODES, isValidPostcode, normalizeIsText, placeForPostcode } from "@/lib/is-postcodes";

export interface AddressParts { street: string; postcode: string; town: string }

/** "Gata 1, 900 Vestmannaeyjum" → parts. Anything else lands in street. */
export function splitAddress(a: string | null | undefined): AddressParts {
  const m = /^(.*),\s*(\d{3})\s+(.+)$/.exec((a || "").trim());
  return m ? { street: m[1].trim(), postcode: m[2], town: m[3].trim() } : { street: (a || "").trim(), postcode: "", town: "" };
}

/** The stored form, with the official place name for the postcode. */
export function formatAddress(street: string, postcode: string): string {
  return `${street.trim()}, ${postcode} ${placeForPostcode(postcode) ?? ""}`.trim();
}

/** Place names in the list, normalised, longest first so "Reykjavík" never beats a longer match. */
const PLACES = Array.from(new Set(IS_POSTCODES.map((p) => p.place)))
  .map((place) => ({ place, n: normalizeIsText(place) }))
  .sort((a, b) => b.n.length - a.n.length);

/* Nominative forms people actually type, for the places Pósturinn names in
   the dative. Only where the stem is not already a prefix of the dative
   ("Akureyri" is both). */
const NOMINATIVE: Record<string, string> = {
  vestmannaeyjar: "Vestmannaeyjum",
  hafnarfjordur: "Hafnarfirði",
  selfoss: "Selfossi",
  seltjarnarnes: "Seltjarnarnesi",
  isafjordur: "Ísafirði",
  egilsstadir: "Egilsstöðum",
  hvolsvollur: "Hvolsvelli",
  borgarnes: "Borgarnesi",
};

/**
 * The postcode in an address, or null — never a code Pósturinn does not have.
 *
 * Three tries, most reliable first: the stored "…, NNN Staður" form; any
 * three-digit group that is a real postcode (the last one, since a house
 * number comes first); and finally a known place name with no number at all,
 * which gives that place's first postcode (`inferred: true`).
 */
export function postcodeFromAddress(address: string | null | undefined): { postcode: string; inferred: boolean } | null {
  const a = (address || "").trim();
  if (!a) return null;
  const parts = splitAddress(a);
  if (parts.postcode && isValidPostcode(parts.postcode)) return { postcode: parts.postcode, inferred: false };
  const groups = a.match(/(?:^|[,\s])(\d{3})(?=[\s,]|$)/g)?.map((g) => g.replace(/\D/g, "")).filter(isValidPostcode) ?? [];
  if (groups.length) return { postcode: groups[groups.length - 1], inferred: false };
  const n = normalizeIsText(a);
  for (const [nom, place] of Object.entries(NOMINATIVE)) {
    if (new RegExp(`(^|[^a-z])${nom}([^a-z]|$)`).test(n)) {
      const code = IS_POSTCODES.find((p) => p.place === place && p.kind !== "box")?.code;
      if (code) return { postcode: code, inferred: true };
    }
  }
  for (const { place, n: pn } of PLACES) {
    if (pn.length >= 3 && new RegExp(`(^|[^a-z])${pn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(n)) {
      const code = IS_POSTCODES.find((p) => p.place === place && p.kind !== "box")?.code
        ?? IS_POSTCODES.find((p) => p.place === place)?.code;
      if (code) return { postcode: code, inferred: true };
    }
  }
  return null;
}
