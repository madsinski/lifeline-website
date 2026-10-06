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


/**
 * Food that has to come off the table — intolerances and allergies.
 *
 * These work the opposite way round from DIET_OPTIONS. A diet is an allowlist:
 * a meal must carry the "vegan" tag to be served to a vegan. An allergen
 * cannot work that way, because it would mean tagging all hundred-odd meals
 * as free from each of fourteen things before any of them could be served.
 * So an allergen is a denylist read off the ingredients, and it fails safe:
 * a word that might mean the allergen excludes the meal. Over-excluding
 * costs someone a dinner suggestion; under-excluding is a hospital visit.
 *
 * It is still not a safety guarantee and the UI must not imply one. The
 * ingredient lists are a content library, not a manufacturer's declaration,
 * and traces are invisible to it. Anyone with a real allergy reads the packet.
 */
export type Allergen =
  | "milk" | "lactose" | "gluten" | "egg" | "fish" | "shellfish" | "mollusc"
  | "treenut" | "peanut" | "soy" | "sesame" | "mustard" | "celery" | "sulphite" | "lupin";

export interface AllergenOption {
  key: Allergen;
  label: string;
  /** Ingredient and name words that mean the meal contains it. Icelandic first. */
  words: string[];
  /** Shown when the restriction is unusual enough to need a word of care. */
  note?: string;
}

/**
 * The EU's fourteen declarable allergens, plus lactose, which is an
 * intolerance rather than an allergy and is the common one here: it rules out
 * milk and skyr but not the lactose-free versions of them, so it is kept
 * separate from a milk allergy.
 */
export const ALLERGEN_OPTIONS: AllergenOption[] = [
  { key: "lactose", label: "Laktósaóþol", words: ["mjólk", "rjómi", "rjóma", "ís ", "mysa", "milk", "cream", "whey"], note: "Laktósafríar útgáfur af skyri og mjólk eru í lagi — við sleppum þó öllu sem inniheldur mjólkursykur." },
  { key: "milk", label: "Mjólkurprótein (ofnæmi)", words: ["mjólk", "rjómi", "rjóma", "smjör", "ostur", "ost", "skyr", "jógúrt", "kotasæla", "mysa", "milk", "cream", "butter", "cheese", "yogurt", "yoghurt", "cottage", "whey", "ghee"] },
  { key: "gluten", label: "Glúten (sjúkdómur eða óþol)", words: ["hveiti", "brauð", "pasta", "núðlur", "kúskús", "bygg", "rúgur", "rúgbrauð", "hafrar", "haframjöl", "hrökkbrauð", "tortilla", "vefja", "semolina", "bulgur", "wheat", "bread", "noodle", "couscous", "barley", "rye", "oat", "cracker", "flour", "panko", "soy sauce", "sojasósa"], note: "Hafrar eru glútenlausir í sjálfu sér en nær alltaf mengaðir hér — við sleppum þeim nema merktir glútenlausir." },
  { key: "egg", label: "Egg", words: ["egg", "eggja", "majónes", "mayonnaise", "aioli", "omelette", "ommelett"] },
  { key: "fish", label: "Fiskur", words: ["fiskur", "fisk", "lax", "laxi", "þorskur", "þorsk", "ýsa", "ýsu", "silungur", "silung", "túnfiskur", "túnfisk", "sardín", "ansjósu", "fish", "salmon", "cod", "haddock", "trout", "tuna", "sardine", "anchov", "fish sauce"] },
  { key: "shellfish", label: "Skelfiskur og krabbadýr", words: ["rækja", "rækjur", "humar", "krabbi", "krabba", "shrimp", "prawn", "lobster", "crab", "langoustine"] },
  { key: "mollusc", label: "Lindýr (kræklingur, hörpuskel)", words: ["kræklingur", "kræklinga", "hörpuskel", "smokkfisk", "mussel", "scallop", "squid", "calamari", "oyster"] },
  { key: "treenut", label: "Trjáhnetur", words: ["hneta", "hnetur", "hnetum", "mandla", "möndlur", "möndlu", "valhnetur", "valhnetu", "kasjú", "pekan", "pistasíu", "heslihnetur", "nut", "almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut"] },
  { key: "peanut", label: "Jarðhnetur", words: ["jarðhnetur", "jarðhnetu", "hnetusmjör", "peanut"] },
  { key: "soy", label: "Soja", words: ["soja", "sojasósa", "tófú", "tofu", "edamame", "miso", "soy", "tempeh"] },
  { key: "sesame", label: "Sesam", words: ["sesam", "tahini", "sesame", "hummus", "hómus"] },
  { key: "mustard", label: "Sinnep", words: ["sinnep", "mustard"] },
  { key: "celery", label: "Sellerí", words: ["sellerí", "selleri", "celery", "celeriac"] },
  { key: "sulphite", label: "Súlfít", words: ["súlfít", "sulphite", "sulfite", "þurrkaðir ávextir", "vín ", "wine"] },
  { key: "lupin", label: "Lúpína", words: ["lúpína", "lupin"] },
];

/** True when anything in the meal's name or ingredients matches the allergen. */
export function mealContains(
  m: { name?: string | null; name_is?: string | null; ingredients?: string[] | null; ingredients_is?: string[] | null; dietary_tags?: string[] | null },
  key: Allergen,
): boolean {
  const opt = ALLERGEN_OPTIONS.find((a) => a.key === key);
  if (!opt) return false;
  const tags = m.dietary_tags ?? [];
  // An explicit free-from tag is the one thing that can clear a word match:
  // a gluten-free bread is still called bread.
  if (key === "gluten" && tags.includes("gluten-free")) return false;
  if ((key === "milk" || key === "lactose") && tags.includes("dairy-free")) return false;
  if (key === "lactose" && tags.includes("lactose-free")) return false;
  const hay = [m.name_is, m.name, ...(m.ingredients_is ?? []), ...(m.ingredients ?? [])]
    .filter(Boolean).join(" · ").toLowerCase();
  return opt.words.some((w) => hay.includes(w.toLowerCase()));
}

export interface NutritionPrefs {
  /** DIET_OPTIONS keys. */
  diet: string[];
  /** ALLERGEN_OPTIONS keys — excluded on ingredients, not on a tag. */
  avoid?: Allergen[];
  /** 3 meals, or 3 plus a snack. */
  snack: boolean;
  /** How much cooking is realistic. */
  cooking: "quick" | "normal" | "prep";
}

export const DEFAULT_NUTRITION: NutritionPrefs = { diet: [], avoid: [], snack: true, cooking: "normal" };

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
  const allergens = new Set(ALLERGEN_OPTIONS.map((a) => a.key as string));
  const avoid = [...new Set((Array.isArray(o.avoid) ? o.avoid : [])
    .filter((a): a is Allergen => typeof a === "string" && allergens.has(a)))];
  return { diet, avoid, snack: o.snack !== false, cooking };
}

/** Every tag a meal must carry to clear this person's restrictions. */
export function requiredTags(prefs: NutritionPrefs): string[][] {
  return prefs.diet
    .map((k) => DIET_OPTIONS.find((d) => d.key === k)?.requires ?? [])
    .filter((r) => r.length > 0);
}

/**
 * True when the meal clears every restriction.
 *
 * Takes the whole meal rather than its tags alone, because an allergen is
 * matched on the ingredients. Callers that only have tags may still pass an
 * object with just dietary_tags; no allergen will match, which is why the
 * setup says the ingredient list is the thing to read.
 */
export function mealAllowed(
  meal: string[] | null | undefined | Parameters<typeof mealContains>[0],
  prefs: NutritionPrefs,
): boolean {
  const m = Array.isArray(meal) || meal == null ? { dietary_tags: meal ?? [] } : meal;
  const have = new Set(m.dietary_tags ?? []);
  if (!requiredTags(prefs).every((any) => any.some((t) => have.has(t)))) return false;
  return !(prefs.avoid ?? []).some((a) => mealContains(m, a));
}
