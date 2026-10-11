// Eating the plan, as opposed to reading it.
//
// The Næring tab could always show the day's meals; nothing could say you had
// eaten one. `meal_log` has existed and been written by the app for months
// while the web wrote nothing to it, so a participant's web day left no trace
// in the history their coach reads.
//
// The targets are not invented here. They are the ones already in
// hc_knowledge and shown on the report: protein 1,6–2,0 g per kg of body
// weight a day for someone training strength, fibre 25–35 g. Protein is the
// one that can be totalled from the meal library, because meals carry
// protein and not fibre.
//
// Pure and client-safe.

export type MealSource = "planned" | "custom";

export interface MealLogRow {
  date: string;
  action_key: string | null;
  source: MealSource;
  description: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DayTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: number;
}

export function totalsOf(rows: { kcal?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null }[]): DayTotals {
  return rows.reduce<DayTotals>((t, r) => ({
    kcal: t.kcal + (Number(r.kcal) || 0),
    protein: t.protein + (Number(r.protein) || 0),
    carbs: t.carbs + (Number(r.carbs) || 0),
    fat: t.fat + (Number(r.fat) || 0),
    meals: t.meals + 1,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0, meals: 0 });
}

/**
 * The day's protein target, in grams.
 *
 * 1,6–2,0 g per kilo of body weight, which is the band for someone training
 * to build or hold muscle rather than the general-population floor. The
 * weight comes from the body-composition measurement, so the number is the
 * person's own and not a guess.
 *
 * It was 1,2–1,6 here and in hc_knowledge. Both moved together, on purpose:
 * the report and the plan are two views of one recommendation and a
 * participant who reads 1,2–1,6 on one screen and is given 1,6–2,0 on the
 * next has been told two different things by the same service.
 *
 * Without a weight on file there is no honest target, so it returns null
 * rather than a guess — a progress bar against a made-up number is worse
 * than no bar.
 */
export function proteinTarget(weightKg: number | null | undefined): { min: number; max: number } | null {
  const w = Number(weightKg);
  if (!Number.isFinite(w) || w <= 0) return null;
  return { min: Math.round(w * 1.6), max: Math.round(w * 2.0) };
}

export const FIBRE_TARGET = { min: 25, max: 35 };

/** Where the day stands against the protein band. */
export function proteinState(got: number, target: { min: number; max: number } | null) {
  if (!target) return { pct: 0, label: "Engin þyngd skráð", tone: "bg-slate-300" as const };
  const pct = Math.min(100, Math.round((got / target.min) * 100));
  if (got >= target.min) return { pct: 100, label: "Markmiði náð", tone: "bg-emerald-500" as const };
  if (pct >= 70) return { pct, label: `${Math.round(target.min - got)} g eftir`, tone: "bg-emerald-400" as const };
  return { pct, label: `${Math.round(target.min - got)} g eftir`, tone: "bg-amber-400" as const };
}
