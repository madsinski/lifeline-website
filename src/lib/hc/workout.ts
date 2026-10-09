// Doing the workout, as opposed to reading it.
//
// Ported from the app's WorkoutAdaptSheet / ExerciseSetTracker: one exercise
// on screen at a time, log each set as you finish it, a rest countdown, and
// an RPE question at the end. The app's own notes explain why it is focus
// mode — expo-video runs out of native players if every exercise mounts one —
// and the web has no such limit, but the shape is kept because standing in a
// gym looking at one thing is the right UX anyway.
//
// Three things are deliberately NOT ported as they are:
//
//   • the date. The app computes it as toISOString().slice(0,10), which is
//     UTC, so a late-evening set east of UTC lands on tomorrow and the
//     "sets today" count resets mid-session. Iceland is UTC+0 so it never
//     bit, but it is wrong, and localDate() is the same cost.
//   • the rest timer. The app chains setTimeout(…, 1000) per tick, which a
//     background browser tab throttles to a crawl and then stalls. Here the
//     deadline is the state and the remaining time is derived from the
//     clock, so backgrounding the tab cannot make the timer wrong.
//   • the wheels. ScrollView momentum-snap has no honest web equivalent;
//     steppers with a text input are better with a keyboard anyway.
//
// Pure and client-safe.

import type { ExerciseItem } from "./types";

/** Today in the browser's own timezone, not UTC. */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "60 sek." · "2 mín." · "90" → seconds. Null when the exercise has no rest. */
export function parseRestSeconds(rest: string | null | undefined): number | null {
  if (!rest) return null;
  const t = rest.toLowerCase();
  const n = parseFloat(t.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return null;
  return /mín|min/.test(t) ? Math.round(n * 60) : Math.round(n);
}

/** "3 × 10–12" → 10. "4 × 8" → 8. Falls back to 8, as the app does. */
export function parseReps(prescription: string | null | undefined): number {
  const m = /(\d+)\s*[–-]\s*(\d+)\s*$/.exec((prescription ?? "").trim());
  if (m) return Number(m[1]);
  const all = [...(prescription ?? "").matchAll(/(\d+)/g)].map((x) => Number(x[1]));
  return all.length > 1 ? all[all.length - 1] : 8;
}

/** "3 × 45 sek." → 45. Null when the exercise is counted in reps. */
export function parseHoldSeconds(prescription: string | null | undefined): number | null {
  const m = /(\d+)\s*sek/i.exec(prescription ?? "");
  return m ? Number(m[1]) : null;
}

/** How many sets the prescription asks for ("3 × 10–12" → 3). */
export function parseSets(prescription: string | null | undefined): number {
  const m = /^\s*(\d+)\s*[×x]/.exec(prescription ?? "");
  return m ? Math.min(10, Math.max(1, Number(m[1]))) : 3;
}

/** Held for time (planki, bændaganga) rather than counted in reps. */
export const isTimed = (it: ExerciseItem) => parseHoldSeconds(it.prescription) !== null;

/** No external load to record — bodyweight or a machine-free movement. */
export function isBodyweight(it: ExerciseItem): boolean {
  const eq = (it.equipment ?? "").toLowerCase();
  if (eq === "bodyweight" || eq === "none" || eq === "bands") return true;
  return /armbeygj|planki|dauða pöddan|mjaðmalyfta|afturstig|uppstig|pike|öfugur róður/i.test(it.name);
}

/** Warm-ups, HIIT blocks and the "má skipta út fyrir" note are not logged. */
export const isLoggable = (it: ExerciseItem) =>
  !!it.exercise_id && (it.block ?? "main") === "main" && !/^hiit/i.test(it.name);

export interface LoggedSet {
  /** Present on rows read back from the database; needed to delete one. */
  id?: string;
  date: string;
  set_index: number;
  weight: number | null;
  reps: number | null;
}

/**
 * The next set number for today.
 *
 * The app derives this from a client-side count, which collides if two
 * devices log at once. Taking the max of what is already stored is no worse
 * on a single device and does not renumber an existing set when it races.
 */
export const nextSetIndex = (todays: LoggedSet[]) =>
  todays.reduce((n, s) => Math.max(n, s.set_index), 0) + 1;

export const RPE_IS: Record<number, string> = {
  1: "Mjög létt", 2: "Létt", 3: "Létt", 4: "Nokkuð létt", 5: "Miðlungs",
  6: "Nokkuð erfitt", 7: "Erfitt", 8: "Mjög erfitt", 9: "Nálægt hámarki", 10: "Hámark",
};

/**
 * Does this session want the runner, or just a tick?
 *
 * The runner counts sets, loads and rest. That is the right tool for
 * "4 × 6–8" and for "8 × 40 sek. hratt / 40 sek. rólega", and the wrong one
 * for "45 mín. á jöfnum, rólegum hraða" — nobody wants a set tracker for a
 * bike ride. A session with nothing to count gets "Ég gerði þetta" instead.
 */
export function needsRunner(items: { prescription?: string | null; block?: string | null }[]): boolean {
  return items.some((it) => (it.block ?? "main") === "main" && /^\s*\d+\s*[×x]/.test(it.prescription ?? ""));
}
