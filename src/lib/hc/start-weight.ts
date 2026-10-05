// A starting weight to put on the bar, instead of a box that says 0.
//
// Asking someone new to training "how many kg?" is asking the one question
// they came here unable to answer. A suggestion they can adjust is far more
// use than a blank — so long as it is honest about being an estimate, which
// the prescription's own "stilltu þyngdina svo að þú hættir þegar N
// endurtekningar eru eftir" already makes it.
//
// Method, in the order the data allows:
//
//   1. Lean mass. Strength tracks lean body mass, not scale weight, so when
//      the report has a body-fat percentage we use LBM = weight × (1 − fat),
//      normalised to a 20%-fat reference body (LBM / 0.8) so the published
//      bodyweight multipliers still apply. Someone at 30% fat and someone at
//      15% at the same scale weight get different suggestions, which is the
//      whole point.
//   2. Scale weight, when there is no body-fat reading. Rougher, and the
//      caller is told so via `basis`.
//   3. Nothing. With no weight on file there is no suggestion — a number
//      invented out of nothing would be worse than an empty box.
//
// The multipliers are novice one-rep-max standards as a multiple of body
// mass (ExRx / Strength Level consensus ranges, taken at the conservative
// end). They are deliberately not per-person precise: the set itself
// corrects them within one session.
//
// Pure and client-safe.

export type LiftPattern = "squat" | "hinge" | "push" | "pull" | "press" | "lunge" | "carry";

/** Novice 1RM as a multiple of effective body mass, for a man. */
const MALE_1RM: Record<LiftPattern, number> = {
  squat: 1.0,
  hinge: 1.25,
  push: 0.75,
  pull: 0.7,
  press: 0.55,
  lunge: 0.5, // per hand / per side
  carry: 0.5, // per hand
};

/**
 * Women's standards relative to men's, which differ by region: the gap is
 * much smaller in the lower body than the upper. One blended number would
 * over-prescribe presses and under-prescribe squats.
 */
const FEMALE_FACTOR: Record<LiftPattern, number> = {
  squat: 0.75, hinge: 0.75, lunge: 0.75,
  push: 0.62, pull: 0.65, press: 0.6, carry: 0.65,
};

/** Where the programme is: the standards describe a trained novice. */
const STAGE_FACTOR: Record<string, number> = { adapt: 0.6, s1: 0.8, s2: 1.0, s3: 1.15 };

export interface BodyData {
  weightKg: number | null;
  /** From the report's fitumassi row, when it has one. */
  bodyFatPct?: number | null;
  sex?: "m" | "f" | null;
}

export interface WeightSuggestion {
  /** Kilograms, rounded to the nearest 2,5 — the smallest plate pair. */
  kg: number;
  /** What the estimate rests on, so the UI can say. */
  basis: "lean" | "weight";
}

/** Epley, inverted: the share of a 1RM you can lift for this many reps. */
const repShare = (reps: number) => 1 / (1 + Math.max(1, reps) / 30);

const round2_5 = (n: number) => Math.max(2.5, Math.round(n / 2.5) * 2.5);

export function suggestStartWeight(
  pattern: LiftPattern,
  reps: number,
  stage: string,
  body: BodyData,
): WeightSuggestion | null {
  const w = Number(body.weightKg);
  if (!Number.isFinite(w) || w <= 0) return null;

  const fat = Number(body.bodyFatPct);
  const usable = Number.isFinite(fat) && fat > 3 && fat < 60;
  // Normalised to a 20%-fat reference so the published multipliers still hold.
  const effective = usable ? (w * (1 - fat / 100)) / 0.8 : w;

  const base = MALE_1RM[pattern] * (body.sex === "f" ? FEMALE_FACTOR[pattern] : 1);
  const oneRm = effective * base * (STAGE_FACTOR[stage] ?? 0.8);
  return { kg: round2_5(oneRm * repShare(reps)), basis: usable ? "lean" : "weight" };
}

export const BASIS_IS: Record<WeightSuggestion["basis"], string> = {
  lean: "út frá vöðvamassa þínum",
  weight: "út frá þyngd þinni",
};
