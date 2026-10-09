// One answer to "what training is on this day".
//
// There were three renderers reading three different subsets of the same
// week. The Æfingar calendar drew prescribed sessions and the person's own
// commitments; the Í dag hero drew both after a fix; the Í dag hreyfing
// checklist drew prescribed sessions only — so a lift or a football match
// the person had put in the week showed up in the calendar and was missing
// from the checklist they tick it off on.
//
// The divergence was structural, not a slip: each surface filtered the week
// itself, so each one could be right on its own and disagree with the other
// two. This module is the single filter they all call.
//
// ── Where training actually lives ────────────────────────────────────────
//
// hc_training_settings is the source of truth for training. It holds the
// parameters (level, load, injuries, days, place, cardio) and the person's
// own activities; the prescribed sessions are GENERATED from it by
// buildSessions() rather than stored, which is why changing a setting
// reshapes the week immediately and why no session has a row of its own.
//
// hc_plans holds the authored ActionPlan — the per-pillar checklist. It
// keeps daily habits only: "10.000 skref", "stattu upp á klukkutímann".
// Anything that happens on particular days, has exercises and can be run is
// a session, and the programme owns it. That split is what
// supersededByProgramme() in MyActions enforces on the other side.

import type { PersonalExercise, PSession } from "./personalise";
import { weekdayOf } from "./personalise";
import type { Activity, TrainingSettings } from "./adaptive-program";

/** One thing to do on a day, whoever put it in the week. */
export interface TrainingToday {
  id: string;
  title: string;
  /** Minutes, when either side knows them. */
  minutes: number | null;
  /** "HH:MM" for a commitment with a fixed hour. */
  at: string | null;
  /** Whether the programme prescribed it or the person added it. */
  source: "programme" | "own";
  /** The prescribed session, when there is one — the runner needs it. */
  session?: PSession;
  /** The person's own row, when it is theirs. */
  activity?: Activity;
}

/**
 * Everything on one day, prescribed and own, in that order.
 *
 * @param day Monday-first 0–6; defaults to today.
 */
export function trainingOn(
  exercise: PersonalExercise | null | undefined,
  training: TrainingSettings | null | undefined,
  day: number = weekdayOf(new Date()),
): TrainingToday[] {
  const sessions = (exercise?.sessions ?? [])
    .filter((s) => s.weekday === day)
    .map((s): TrainingToday => ({
      id: s.id, title: s.title, minutes: s.minutes ?? null, at: null,
      source: "programme", session: s,
    }));
  const own = (training?.activities ?? [])
    .filter((a) => a.day === day)
    .map((a): TrainingToday => ({
      id: a.id, title: a.name, minutes: a.minutes ?? null, at: a.at ?? null,
      source: "own", activity: a,
    }));
  return [...sessions, ...own];
}

/** Titles for a day, for a one-line summary such as the tomorrow pill. */
export const titlesOn = (
  exercise: PersonalExercise | null | undefined,
  training: TrainingSettings | null | undefined,
  day?: number,
): string[] => trainingOn(exercise, training, day).map((x) => x.title);
