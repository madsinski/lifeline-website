// Medalia's own recommendations → Lifeline's action library.
//
// The Grunnheilsa report carries a "Ráðleggingar" column: things to address,
// each with the priority the doctor set — red = Forgangur 1, yellow =
// Forgangur 2. That is the clinical plan, made and recorded in Medalia, the
// licensed sjúkraskrá system.
//
// Measured across the reports we hold: 26 and 29 prioritised recommendations
// each, and 24 of the 30 distinct ones name something that already exists in
// hc_plan_modules — the library was extended as they appeared, which is why
// "Próteinríkur morgunmatur" and "Birta" are both report components and
// library titles. The other 6 are not actions; they say to see a doctor.
//
// What this buys: the plan becomes a RENDERING of a decision already recorded
// in Medalia rather than a second decision taken here. That is what keeps
// Lifeline out of sjúkraskrá territory and out of the MDR conversation, so it
// has to be demonstrable from the data — hence the source trace on every
// action and a checker that fails on anything unmapped.

import type { Signal } from "./grunnheilsa";

/**
 * Lower-case, accents folded, punctuation collapsed.
 *
 * Accents fold because "svefntími" and "svefntimi" are the same word to
 * everyone except a string comparison. þ, ð, æ and ö are letters in their own
 * right in Icelandic and are left alone.
 */
export const norm = (s: string | null | undefined): string =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Recommendations that are not actions.
 *
 * "Ræddu við lækni um næstu skref" is an instruction to seek medical
 * assessment. Turning it into a tickable habit would be the system quietly
 * swallowing a referral, so these go to the referral lane instead.
 */
const REFERRAL_PHRASES = [
  "ræddu við lækni",
  "þurft meðhondlunar",
  "þarf frekara mat",
  "frekara mat a ahættuþattum",
];

/** Too general to act on: the plan as a whole is the answer. */
const GENERIC_PHRASES = ["bæta grunnstoðirnar"];

/** component → action key. The stable label Medalia prints. */
const BY_COMPONENT: Record<string, string> = {
  "reglubundinn svefntimi": "svefn-fastur-timi",
  "svefn lengd": "svefn-lengd",
  "koffin fyrir svefn": "svefn-koffin",
  "skjanotkun fyrir svefn": "svefn-skjalaust",
  "seinustu maltið fyrir svefn": "svefn-kvoldmatur",
  "birta": "svefn-birta",
  "hitastig": "svefn-hitastig",
  "loftgæði": "svefn-loftgaedi",
  "styrktarþjalfun": "hreyfing-styrkur",
  "lett þolþjalfun": "hreyfing-thol",
  "erfið þolþjalfun": "hreyfing-erfid-thol",
  "almenn hreyfing": "hreyfing-almenn",
};

/**
 * text → action key, for the rows Medalia emits with no component — the whole
 * nutrition block. Matched on a contained phrase, not equality: "Bæta inntöku
 * af vökva yfir daginn" and "Bæta inntöku af vökva" are one instruction and
 * the tail is what gets edited.
 */
const BY_TEXT: [string, string][] = [
  ["proteinrikur morgunmatur", "naering-protein-morgunmatur"],
  ["protein i fokus", "naering-protein"],
  ["snarli seint", "naering-snarl-kvold"],
  ["bæta inntoku af vokva", "naering-vokvi"],
  ["borða undir alagi", "naering-borda-undir-alagi"],
  ["viðbættan sykur", "naering-vidbaettur-sykur"],
  ["minna magn i hverri maltið", "naering-magn"],
  ["drykkjum sem innihalda sykur", "naering-sykradir-drykkir"],
  ["gjorunnum matvælum", "naering-unnin"],
  ["bæta inntoku af plontufæði", "naering-plontufaedi"],
  ["notkun a fræolium", "naering-fraeoliur"],
  ["bæta inntoku af trefjarikum mat", "naering-trefjar"],
];

export type RecKind =
  | { kind: "action"; moduleKey: string }
  | { kind: "referral" }
  | { kind: "generic" }
  | { kind: "unmapped" };

export interface ReportRec {
  component: string;
  text: string;
  priority: Signal;
}

/**
 * What one recommendation is.
 *
 * Referral and generic are tested first: a line telling someone to see a
 * doctor must never also become a lifestyle habit.
 */
export function classifyRecommendation(rec: ReportRec): RecKind {
  const t = norm(rec.text);
  const c = norm(rec.component);
  if (REFERRAL_PHRASES.some((p) => t.includes(p))) return { kind: "referral" };
  if (GENERIC_PHRASES.some((p) => t.includes(p))) return { kind: "generic" };
  if (c && BY_COMPONENT[c]) return { kind: "action", moduleKey: BY_COMPONENT[c] };
  const hit = BY_TEXT.find(([phrase]) => t.includes(phrase));
  return hit ? { kind: "action", moduleKey: hit[1] } : { kind: "unmapped" };
}

/** Every action key the map can produce — checked against the live library. */
export const MAPPED_KEYS: string[] = [
  ...new Set([...Object.values(BY_COMPONENT), ...BY_TEXT.map(([, k]) => k)]),
];
