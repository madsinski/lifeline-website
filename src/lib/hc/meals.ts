// Real meals from the meal library (`meals`, /admin/content) for a nutrition
// programme: which meals fit each programme, ranked per slot of the day.
// Pure and client-safe; the Næring tab and "Í dag" share it.

import { COOKING_IS, mealAllowed, type NutritionPrefs } from "./nutrition";

export type MealSlot = "breakfast" | "lunch" | "snack" | "dinner";
export const SLOTS: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
export const SLOT_IS: Record<MealSlot, string> = { breakfast: "Morgunmatur", lunch: "Hádegi", snack: "Millimál", dinner: "Kvöldmatur" };

export interface Meal {
  id: string;
  name: string;
  name_is: string | null;
  description: string | null;
  description_is: string | null;
  category: string | null;
  ingredients: string[] | null;
  ingredients_is: string[] | null;
  instructions: string[] | null;
  instructions_is: string[] | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  dietary_tags: string[] | null;
  illustration_url: string | null;
}

export const mealName = (m: Pick<Meal, "name" | "name_is">) => m.name_is || m.name;
export const mealText = (m: Meal) => ({
  description: m.description_is || m.description,
  ingredients: (m.ingredients_is?.length ? m.ingredients_is : m.ingredients) ?? [],
  instructions: (m.instructions_is?.length ? m.instructions_is : m.instructions) ?? [],
});

interface Rule { prefer: string[]; avoid: string[]; nameBoost?: RegExp; nameAvoid?: RegExp; maxKcal?: Partial<Record<MealSlot, number>> }
const FISH = /salmon|cod|trout|tuna|lax|þorsk|silung|túnfisk/i;
const PLANTS = /lentil|chickpea|bean|quinoa|oat|rye|wholewheat|vegetable|veggie|tofu|edamame|hummus/i;
const SWEET = /pancake|honey|granola|bar\b|chips|bagel/i;

/** How each nutrition programme (hc_nutrition_templates.key) picks from the library. */
const RULES: Record<string, Rule> = {
  jafnvaegi: { prefer: [], avoid: ["protein-shake"], nameAvoid: /protein bar|protein chips/i },
  efnaskipti: { prefer: ["low-carb", "high-protein"], avoid: ["protein-shake"], nameBoost: PLANTS, nameAvoid: SWEET },
  blodthrystingur: { prefer: ["vegetarian", "vegan"], avoid: ["protein-shake"], nameBoost: FISH, nameAvoid: /bacon|jerky|chips|bagel/i },
  "protein-fokus": { prefer: ["high-protein"], avoid: [] },
  trefjar: { prefer: ["vegetarian", "vegan"], avoid: ["protein-shake"], nameBoost: PLANTS, nameAvoid: /protein bar|chips|shake/i },
  thyngdarstjornun: { prefer: ["high-protein", "low-carb"], avoid: ["protein-shake"], nameAvoid: SWEET, maxKcal: { breakfast: 480, lunch: 520, dinner: 600, snack: 250 } },
  "lifur-afengi": { prefer: ["high-protein"], avoid: [], nameBoost: new RegExp(`${FISH.source}|${PLANTS.source}`, "i"), nameAvoid: SWEET },
  matarhegdun: { prefer: ["meal-prep", "no-cook"], avoid: ["protein-shake"] },
};

function score(m: Meal, r: Rule, slot: MealSlot): number {
  const tags = m.dietary_tags ?? [];
  let s = 0;
  for (const t of r.prefer) if (tags.includes(t)) s += 2;
  for (const t of r.avoid) if (tags.includes(t)) s -= 6;
  if (r.nameBoost?.test(m.name)) s += 3;
  if (r.nameAvoid?.test(m.name)) s -= 5;
  const max = r.maxKcal?.[slot];
  if (max && m.calories && m.calories > max) s -= 4;
  // A snack slot wants a real snack, not a single egg or half a tuna pouch.
  if (slot === "snack" && m.calories != null && m.calories < 120) s -= 3;
  if (m.illustration_url) s += 1;
  return s;
}

/**
 * Library meals for a slot, best fit first, near-duplicate names dropped.
 *
 * `prefs` is what the person will actually eat. Restrictions are a hard
 * filter — a vegetarian is not served a lamb casserole ranked low, they are
 * not served it — while the cooking style only nudges the order, because
 * someone who would rather not cook can still cook.
 */
export function mealsFor(all: Meal[], programKey: string | null | undefined, slot: MealSlot, prefs?: NutritionPrefs): Meal[] {
  const r = RULES[programKey ?? ""] ?? RULES.jafnvaegi;
  const cook = prefs ? COOKING_IS[prefs.cooking].tags : [];
  const seen = new Set<string>();
  return all
    .filter((m) => m.category === slot)
    .filter((m) => !prefs || mealAllowed(m.dietary_tags, prefs))
    .map((m) => (cook.length && (m.dietary_tags ?? []).some((t) => cook.includes(t)) ? { ...m, _cook: true } as Meal & { _cook?: boolean } : m))
    .map((m) => ({ m, s: score(m, r, slot) + ((m as Meal & { _cook?: boolean })._cook ? 3 : 0) }))
    .sort((a, b) => b.s - a.s || (b.m.protein ?? 0) - (a.m.protein ?? 0))
    .map((x) => x.m)
    .filter((m) => { const k = m.name.toLowerCase().replace(/[^a-z]/g, ""); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** A pick is stored per weekday and slot: "2:dinner". */
export const pickKey = (weekday: number, slot: MealSlot) => `${weekday}:${slot}`;

/**
 * The meals for one day.
 *
 * `weekday` is what makes this a week rather than a single day on a loop.
 * Without it every day returned the top-ranked meal in each slot, so the
 * plan was the same four meals every day of the year — chicken for breakfast
 * and lunch, seven days a week.
 *
 * Each day now takes a different one of the seven best fits in each slot,
 * deterministically and with nothing new to store, so the week is seven
 * different days that are all good fits rather than a list walked from best
 * to seventh-best. A restriction that leaves only two dinners will still
 * repeat; that is the library's limit and the setup says so.
 *
 * An explicit pick always wins, and a pick made before the week existed —
 * keyed by slot alone — still applies to every day, so nobody's choice is
 * lost.
 */
export function dayFor(
  all: Meal[],
  programKey: string | null | undefined,
  picks: Record<string, string>,
  prefs?: NutritionPrefs,
  weekday = 0,
): Record<MealSlot, Meal | null> {
  const byId = new Map(all.map((m) => [m.id, m]));
  return Object.fromEntries(SLOTS.map((slot) => {
    const chosen = picks[pickKey(weekday, slot)] ?? picks[slot];
    if (chosen && byId.get(chosen)) return [slot, byId.get(chosen)!];
    const ranked = mealsFor(all, programKey, slot, prefs);
    if (!ranked.length) return [slot, null];
    // Rotate within the best fits rather than walking the whole list. Walking
    // it meant Sunday ate the seventh choice in every slot and the week's
    // protein slid downhill as it went; a pool of seven means every day is
    // one of the seven best in each slot, and the offsets pair them so no
    // single day collects all the lowest.
    const pool = ranked.slice(0, 7);
    const offset = SLOTS.indexOf(slot) * 2;
    return [slot, pool[(weekday + offset) % pool.length]];
  })) as Record<MealSlot, Meal | null>;
}

/** The whole week, for the calendar strip. */
export function weekFor(
  all: Meal[],
  programKey: string | null | undefined,
  picks: Record<string, string>,
  prefs?: NutritionPrefs,
): Record<MealSlot, Meal | null>[] {
  return Array.from({ length: 7 }, (_, d) => dayFor(all, programKey, picks, prefs, d));
}

/**
 * How much of the library survives this person's restrictions, per slot.
 *
 * Worth knowing and worth saying: the library is 110 meals but only two
 * dinners are vegetarian and none of the breakfasts are vegan, so a
 * restriction can leave someone eating the same thing every day. Better to
 * show that than to serve it silently.
 */
export function libraryDepth(all: Meal[], prefs: NutritionPrefs): { slot: MealSlot; have: number; total: number }[] {
  return SLOTS.map((slot) => {
    const inSlot = all.filter((m) => m.category === slot);
    return { slot, have: inSlot.filter((m) => mealAllowed(m.dietary_tags, prefs)).length, total: inSlot.length };
  });
}
