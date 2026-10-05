// What the health report already knows about how hard this person can train.
//
// The wizard asks four practical questions, and two of them the report can
// half-answer by itself: whether hard intervals are safe yet, and whether
// there is something musculoskeletal to work around. Asking someone to
// retype what they already told Medalia is how a form gets abandoned.
//
// A suggestion, never a decision. The report can say "your cardiovascular
// risk is flagged" but not "your left knee hurts", so what comes back is a
// starting point the person confirms or overrides, with the reason shown so
// they can see why it was proposed. Nothing here diagnoses or restricts:
// a red marker lowers the starting intensity and says to check with the
// doctor, which is what the clinic would say anyway.
//
// Client-safe: no server imports.

import type { Signal } from "./grunnheilsa";
import type { CardioLimit } from "./adaptive-program";

export interface TrainingHints {
  cardio: CardioLimit;
  /** Why that was proposed, in the participant's own report's words. */
  cardioWhy: string | null;
  /** The report says to ask about joints and pain, but not which ones. */
  askLimitations: boolean;
  askWhy: string | null;
}

/** The rows that argue for taking the intensity down a notch. */
const CARDIO_ROWS: { slug: string; label: string; redLimits: boolean }[] = [
  { slug: "hjartaheilsa", label: "hjartaheilsu", redLimits: true },
  { slug: "blodthrystingur", label: "blóðþrýstingi", redLimits: false },
  { slug: "blodthrystingur-nedri", label: "blóðþrýstingi", redLimits: false },
  { slug: "efnaskiptaheilsa", label: "efnaskiptaheilsu", redLimits: false },
];

const MOVEMENT_ROWS = ["skor-hreyfing-vandamal", "skor-hreyfing-venjur"];

export function trainingHints(
  signals: Record<string, Signal | null>,
  titles: Record<string, string> = {},
): TrainingHints {
  let cardio: CardioLimit = "full";
  let cardioWhy: string | null = null;
  const name = (slug: string, fallback: string) => titles[slug]?.toLowerCase() ?? fallback;

  for (const row of CARDIO_ROWS) {
    const sig = signals[row.slug];
    if (!sig || sig === "green") continue;
    if (sig === "red" && row.redLimits) {
      cardio = "limited";
      cardioWhy = `Skýrslan þín merkir ${name(row.slug, row.label)} sem „þarfnast athygli“.`;
      break; // the strongest reason wins; no need to keep looking
    }
    if (cardio === "full") {
      cardio = "easy";
      cardioWhy = `Skýrslan þín merkir ${name(row.slug, row.label)}, svo við byrjum mildar.`;
    }
  }

  const flaggedMovement = MOVEMENT_ROWS.find((s) => signals[s] && signals[s] !== "green");
  return {
    cardio,
    cardioWhy,
    askLimitations: !!flaggedMovement,
    askWhy: flaggedMovement
      ? `Skýrslan þín merkir ${name(flaggedMovement, "hreyfingu")} — segðu okkur hvar það er, svo við sníðum æfingarnar að því.`
      : null,
  };
}

/** True when nothing in the report speaks to training at all. */
export const noTrainingData = (signals: Record<string, Signal | null>) =>
  ![...CARDIO_ROWS.map((r) => r.slug), ...MOVEMENT_ROWS].some((s) => !!signals[s]);
