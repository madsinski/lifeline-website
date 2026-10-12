// The week's shopping, from the meals that are actually planned.
//
// ── What it does and does not try to do ─────────────────────────────
//
// Ingredient lines are free text written for a cook — "200 g kjúklingur",
// "1 laukur", "salt". Adding two of them up is only safe when they name the
// same thing in the same unit, so that is the only case this merges. A
// "1 laukur" and a "½ laukur" become "1½ laukur"; a "200 g spínat" and a
// "1 poki spínat" stay two lines, because guessing how many grams are in a
// bag would be inventing a number.
//
// Everything unmergeable is still listed. A shopping list that quietly
// dropped what it could not parse would send somebody home without the
// olive oil.
//
// ── Portions ─────────────────────────────────────────────────────────
//
// The amounts are the recipe's own, and a recipe that serves two yields two
// portions. The list does not divide by servings: you cannot buy a third of
// a tin, and halving a recipe is a decision for the person cooking it. The
// UI says which meals a line came from so that is visible rather than
// implied.

import { mealText, SLOTS, type Meal, type MealSlot } from "./meals";

export interface ShoppingLine {
  /** What to buy, as the recipes name it. */
  text: string;
  /** Summed where the unit and the food agree; null when it is unquantified. */
  qty: number | null;
  unit: string | null;
  /** Which meals asked for it, for the "úr" line. */
  from: string[];
}

const FRACTIONS: Record<string, number> = {
  "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125,
};

/** Units that mean the same thing however they are spelled. */
const UNIT_ALIASES: Record<string, string> = {
  g: "g", gr: "g", gröm: "g", grömm: "g",
  kg: "kg", ml: "ml", dl: "dl", l: "l", cl: "cl",
  msk: "msk", tsk: "tsk",
  stk: "stk", sneið: "sneið", sneiðar: "sneið", sneiðum: "sneið",
  dós: "dós", dósir: "dós", búnt: "búnt", poki: "poki", pakki: "pakki",
  /* 40 of 156 meals have no Icelandic ingredient lines and fall back to
     the English column, which measures in cups and spoons. Recognising
     those keeps their amounts addable instead of landing in the
     unquantified pile. */
  cup: "cup", cups: "cup", tbsp: "msk", tsp: "tsk",
  clove: "stk", cloves: "stk", slice: "sneið", slices: "sneið",
  can: "dós", cans: "dós", tin: "dós", tins: "dós", handful: "búnt",
};

/**
 * Split "200 g kjúklingur" into its parts.
 *
 * Deliberately conservative: anything it is not sure about comes back as a
 * whole line with no quantity, which the caller lists verbatim. A wrong
 * amount on a shopping list is worse than an unparsed one.
 */
export function parseLine(raw: string): { qty: number | null; unit: string | null; food: string } {
  const s = raw.trim();
  if (!s) return { qty: null, unit: null, food: "" };

  /*
   * "1/2" before anything else.
   *
   * Written as two digits round a slash it would otherwise read as the
   * number 1 followed by the food "/2 cup mixed berries" — which is what
   * the first version put on screen. Rewritten to a glyph so the rest of
   * the parse is the same either way.
   */
  const ascii = s.match(/^(\d+)\s*\/\s*(\d+)\s+(.*)$/);
  if (ascii) {
    const [, a, bb, rest] = ascii;
    const v = Number(a) / Number(bb);
    if (Number.isFinite(v) && v > 0 && v < 1) return withUnit(v, rest);
  }

  // Leading quantity: a number, a fraction glyph, or both ("1½").
  const m = s.match(/^(\d+(?:[.,]\d+)?)?\s*([½¼¾⅓⅔⅛])?\s*(.*)$/u);
  if (!m) return { qty: null, unit: null, food: s };
  const [, numRaw, fracRaw, rest0] = m;
  if (!numRaw && !fracRaw) return { qty: null, unit: null, food: s };

  const qty = (numRaw ? parseFloat(numRaw.replace(",", ".")) : 0) + (fracRaw ? FRACTIONS[fracRaw] : 0);
  if (!Number.isFinite(qty) || qty <= 0) return { qty: null, unit: null, food: s };

  return withUnit(qty, (rest0 ?? "").trim());
}

/** Peel a unit off the front of the remainder, if the next word is one. */
function withUnit(qty: number, rest: string): { qty: number; unit: string | null; food: string } {
  const um = rest.match(/^([a-záðéíóúýþæö]+)\.?\s+(.*)$/iu);
  const maybe = um?.[1]?.toLowerCase();
  if (maybe && UNIT_ALIASES[maybe]) {
    return { qty, unit: UNIT_ALIASES[maybe], food: (um?.[2] ?? "").trim() };
  }
  // No unit: "1 laukur", "2 egg", "½ avókadó".
  return { qty, unit: null, food: rest };
}

/** A food name that two lines can be compared on. */
function foodKey(food: string): string {
  return food.toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/,.*$/, "")                       // "laukur, smátt saxaður" → "laukur"
    .replace(/[^a-záðéíóúýþæö\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The list for a set of days.
 *
 * `days` holds the chosen weekdays; each is the meal in every slot for that
 * day, which is exactly what dayFor returns.
 */
export function shoppingList(days: Record<MealSlot, Meal | null>[]): ShoppingLine[] {
  const merged = new Map<string, ShoppingLine>();

  for (const day of days) {
    for (const slot of SLOTS) {
      const meal = day[slot];
      if (!meal) continue;
      const name = meal.name_is || meal.name;
      /*
       * Through mealText, which is the one place that knows ingredients_is
       * is the Icelandic column and `ingredients` the English one. Reading
       * meal.ingredients directly put "1/2 cup mixed berries" on an
       * Icelandic shopping list — the English rows are where the cups and
       * the ASCII fractions live, which is also why a SQL check that
       * preferred Icelandic found none of them.
       */
      for (const raw of mealText(meal).ingredients) {
        const { qty, unit, food } = parseLine(raw);
        const key = qty == null ? `raw:${raw.toLowerCase().trim()}` : `${foodKey(food)}|${unit ?? ""}`;
        const prev = merged.get(key);
        if (prev) {
          if (prev.qty != null && qty != null) prev.qty += qty;
          if (!prev.from.includes(name)) prev.from.push(name);
        } else {
          merged.set(key, {
            text: qty == null ? raw.trim() : food,
            qty, unit, from: [name],
          });
        }
      }
    }
  }

  /* Quantified things first — they are what you count into a trolley —
     then the standing items like salt and olive oil. */
  return [...merged.values()].sort((a, b) => {
    if ((a.qty == null) !== (b.qty == null)) return a.qty == null ? 1 : -1;
    return a.text.localeCompare(b.text, "is");
  });
}

/** "1½ dl" / "350 g" / "2" — trailing zeroes dropped. */
export function formatQty(qty: number | null, unit: string | null): string {
  if (qty == null) return "";
  const whole = Math.floor(qty);
  const frac = qty - whole;
  let n: string;
  if (Math.abs(frac - 0.5) < 0.01) n = `${whole || ""}½`;
  else if (Math.abs(frac - 0.25) < 0.01) n = `${whole || ""}¼`;
  else if (Math.abs(frac - 0.75) < 0.01) n = `${whole || ""}¾`;
  else n = String(Math.round(qty * 100) / 100);
  return unit ? `${n} ${unit}` : n;
}
