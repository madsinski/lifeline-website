// The nutrition programme: one core, with the emphasis the report asks for
// and the food the person actually eats.
//
// There were eight nutrition templates — Jafnvægi, Blóðsykur og efnaskipti,
// Trefjar, Prótein í fókus, Þyngdarstjórnun, Hjarta og blóðþrýstingur, Lifur
// og áfengi, Matarhegðun — and like the eight exercise programmes before
// them they are not eight different ways to eat. They are one way to eat
// (whole food, enough protein, enough fibre, little ultra-processed) with a
// different dial turned up, and which dial is a question the report already
// answers. So the emphasis is derived, not chosen from a menu.
//
// What the participant does choose is what they will actually eat, which
// nothing in the system asked before: a plan that serves a vegetarian a lamb
// casserole is not a plan.
//
// Client-safe: no server imports.

import type { Signal } from "./grunnheilsa";

/** The dial the report asks us to turn up. */
export type Emphasis = "sugar" | "fibre" | "protein" | "salt" | "alcohol" | "portions" | "structure";

export const EMPHASIS_IS: Record<Emphasis, { label: string; why: string; tags: string[]; avoid?: RegExp }> = {
  sugar: { label: "Jafnari blóðsykur", why: "Blóðsykur eða insúlín yfir viðmiðum", tags: ["low-carb", "high-protein"] },
  fibre: { label: "Meiri trefjar", why: "Trefjar undir viðmiðum eða kólesteról hátt", tags: ["vegetarian", "vegan"] },
  protein: { label: "Meira prótein", why: "Prótein undir viðmiðum eða vöðvamassi lágur", tags: ["high-protein"] },
  salt: { label: "Minna salt", why: "Blóðþrýstingur yfir viðmiðum", tags: ["vegetarian"] },
  alcohol: { label: "Hvíld fyrir lifrina", why: "Lifrargildi eða þríglýseríð yfir viðmiðum", tags: ["high-protein"] },
  portions: { label: "Hóflegri skammtar", why: "Þyngd eða fitumassi yfir viðmiðum", tags: ["high-protein", "low-carb"] },
  structure: { label: "Fastari máltíðir", why: "Matarhegðun ábótavant — kvöldát eða óreglulegar máltíðir", tags: ["meal-prep", "no-cook"] },
};

/** hc_knowledge slug → the dial it argues for. Worst signal wins. */
const TRIGGERS: { slug: string; emphasis: Emphasis }[] = [
  { slug: "fastandi-blodsykur", emphasis: "sugar" },
  { slug: "hba1c", emphasis: "sugar" },
  { slug: "insulin", emphasis: "sugar" },
  { slug: "homa-ir", emphasis: "sugar" },
  { slug: "efnaskiptaheilsa", emphasis: "sugar" },
  { slug: "trefjar", emphasis: "fibre" },
  { slug: "heildarkolesterol", emphasis: "fibre" },
  { slug: "ldl", emphasis: "fibre" },
  { slug: "protein", emphasis: "protein" },
  { slug: "vodvamassi", emphasis: "protein" },
  { slug: "blodthrystingur", emphasis: "salt" },
  { slug: "blodthrystingur-nedri", emphasis: "salt" },
  { slug: "alt", emphasis: "alcohol" },
  { slug: "ast", emphasis: "alcohol" },
  { slug: "ggt", emphasis: "alcohol" },
  { slug: "thriglyserid", emphasis: "alcohol" },
  { slug: "skor-afengi", emphasis: "alcohol" },
  { slug: "bmi", emphasis: "portions" },
  { slug: "fitumassi", emphasis: "portions" },
  { slug: "thyngd", emphasis: "portions" },
  { slug: "skor-matarhegdun", emphasis: "structure" },
  { slug: "skor-naering-venjur", emphasis: "structure" },
];

/**
 * Which dials this person's report asks for, most urgent first.
 *
 * Takes the PLANNING lights (actionSignals), so a domain that scores well
 * overall but carries flagged components still counts — the same reason the
 * action plan uses them.
 */
export function emphasisFor(signals: Record<string, Signal | null>): { emphasis: Emphasis; why: string; urgent: boolean }[] {
  const worst = new Map<Emphasis, Signal>();
  for (const t of TRIGGERS) {
    const s = signals[t.slug];
    if (!s || s === "green") continue;
    const had = worst.get(t.emphasis);
    if (!had || (s === "red" && had !== "red")) worst.set(t.emphasis, s);
  }
  return [...worst.entries()]
    .sort((a, b) => Number(b[1] === "red") - Number(a[1] === "red"))
    .map(([emphasis, sig]) => ({ emphasis, why: EMPHASIS_IS[emphasis].why, urgent: sig === "red" }));
}

// ── what the person will actually eat ─────────────────────────────────────

/**
 * Restrictions, as dietary tags rather than ingredient names.
 *
 * Deliberately NOT matched against ingredient text. "Kjúklingabaunir" is the
 * Icelandic for chickpeas and contains "kjúkling" — a name-matching filter
 * would throw the chickpea curry out of a vegetarian's plan, which is both
 * wrong and exactly backwards. The tags on `meals` are curated; the names
 * are not a reliable signal in Icelandic.
 */
export interface DietOption {
  key: string;
  label: string;
  /** A meal must carry one of these tags to survive this restriction. */
  requires: string[];
  hint?: string;
}

export const DIET_OPTIONS: DietOption[] = [
  { key: "vegetarian", label: "Ég borða ekki kjöt eða fisk", requires: ["vegetarian", "vegan"] },
  { key: "vegan", label: "Ég borða ekkert úr dýraríkinu", requires: ["vegan"] },
  { key: "gluten-free", label: "Glútenlaust", requires: ["gluten-free"] },
  { key: "dairy-free", label: "Mjólkurlaust", requires: ["dairy-free"] },
];

export interface NutritionPrefs {
  /** DIET_OPTIONS keys. */
  diet: string[];
  /** 3 meals, or 3 plus a snack. */
  snack: boolean;
  /** How much cooking is realistic. */
  cooking: "quick" | "normal" | "prep";
}

export const DEFAULT_NUTRITION: NutritionPrefs = { diet: [], snack: true, cooking: "normal" };

export const COOKING_IS: Record<NutritionPrefs["cooking"], { label: string; hint: string; tags: string[] }> = {
  quick: { label: "Sem minnst eldamennska", hint: "Helst ekkert eldað — samsett úr því sem er til.", tags: ["no-cook"] },
  normal: { label: "Ég elda á virkum dögum", hint: "Venjuleg eldamennska, 20–40 mínútur.", tags: [] },
  prep: { label: "Ég elda í skömmtum", hint: "Stærri skammtar sem endast í nokkra daga.", tags: ["meal-prep"] },
};

export function sanitizeNutrition(b: unknown): NutritionPrefs {
  const o = (b ?? {}) as Record<string, unknown>;
  const keys = new Set(DIET_OPTIONS.map((d) => d.key));
  const diet = [...new Set((Array.isArray(o.diet) ? o.diet : []).filter((d): d is string => typeof d === "string" && keys.has(d)))];
  const cooking = o.cooking === "quick" || o.cooking === "prep" ? o.cooking : "normal";
  return { diet, snack: o.snack !== false, cooking };
}

/** Every tag a meal must carry to clear this person's restrictions. */
export function requiredTags(prefs: NutritionPrefs): string[][] {
  return prefs.diet
    .map((k) => DIET_OPTIONS.find((d) => d.key === k)?.requires ?? [])
    .filter((r) => r.length > 0);
}

/** True when the meal clears every restriction. */
export function mealAllowed(tags: string[] | null | undefined, prefs: NutritionPrefs): boolean {
  const have = new Set(tags ?? []);
  return requiredTags(prefs).every((any) => any.some((t) => have.has(t)));
}
