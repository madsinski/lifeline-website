// How an action plan is going: weekly targets read off the plan's own
// frequency text, and completion worked out from the client's tick marks.
// Client-safe — the same numbers drive the client's account and the
// workstation, so both sides always agree.

import type { PlanItem } from "./types";

export interface ActionLog { action_uid: string; done_on: string }
export interface ActionPref {
  action_uid: string;
  hidden: boolean;
  note: string | null;
  /** The participant's own position in their time-of-day section, or null
   *  to keep the order the plan was composed in. */
  sort_index?: number | null;
}

/** ISO date (yyyy-mm-dd) in the viewer's own timezone, not UTC. */
export function isoDay(d: Date = new Date()): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** The last `n` days, oldest first, as ISO dates. */
export function lastDays(n: number, from: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => isoDay(new Date(from.getTime() - (n - 1 - i) * 86400_000)));
}

/**
 * Monday to Sunday of the week a date falls in.
 *
 * The action list used lastDays(7) — a rolling window ending today, so the
 * columns read "Mi Fi Fö La Su Má Þr" and the count beside them said "3 af 3
 * í vikunni" about something that was not a week. The exercise and the meal
 * calendars are both Monday-first, so this is the third one agreeing with
 * them: same seven columns, same order, everywhere.
 */
export function weekDays(from: Date = new Date()): string[] {
  const monday = new Date(from);
  monday.setDate(monday.getDate() - ((from.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => isoDay(new Date(monday.getTime() + i * 86400_000)));
}

/**
 * How many times a week an action is meant to happen, read from the Icelandic
 * frequency text the nurse wrote ("daglega", "3 sinnum í viku", "annan hvern
 * dag"). Unknown phrasing falls back to 7 — better to under-claim progress
 * than to over-claim it.
 */
export function weeklyTarget(frequency: string | null | undefined): number {
  const f = (frequency || "").toLowerCase();
  if (!f) return 7;
  if (/annan hvern dag|aðra hverja/.test(f)) return 3;
  if (/virka daga|vinnudög/.test(f)) return 5;
  if (/dagleg|á hverjum degi|daily/.test(f)) return 7;
  const range = f.match(/(\d)\s*[–-]\s*(\d)\s*(?:sinnum|x)/);
  if (range) return Math.min(7, Number(range[2]));
  const times = f.match(/(\d+)\s*(?:sinnum|x)/);
  if (times) {
    const n = Number(times[1]);
    if (/mánuði|mánaðar/.test(f)) return Math.max(1, Math.round(n / 4));
    return Math.min(7, n);
  }
  if (/viku|vikulega/.test(f)) return 1;
  return 7;
}

export interface Adherence {
  /** 0–100 over the window, capped per action at its weekly target. */
  percent: number;
  done: number;
  target: number;
  /** Consecutive days, ending today or yesterday, with at least one tick. */
  streak: number;
  lastDoneOn: string | null;
}

/** Progress over the last `days` days (7 by default). */
export function adherence(
  actions: PlanItem[],
  logs: ActionLog[],
  prefs: ActionPref[] = [],
  days = 7,
  from: Date = new Date(),
): Adherence {
  const hidden = new Set(prefs.filter((p) => p.hidden).map((p) => p.action_uid));
  const live = actions.filter((a) => !hidden.has(a.uid));
  const window = new Set(lastDays(days, from));
  const weeks = days / 7;

  let done = 0;
  let target = 0;
  for (const a of live) {
    const hits = logs.filter((l) => l.action_uid === a.uid && window.has(l.done_on)).length;
    const t = Math.round(weeklyTarget(a.frequency) * weeks);
    target += t;
    done += Math.min(hits, t);
  }

  const byDay = new Set(logs.map((l) => l.done_on));
  let streak = 0;
  const today = isoDay(from);
  const yesterday = isoDay(new Date(from.getTime() - 86400_000));
  if (byDay.has(today) || byDay.has(yesterday)) {
    for (let i = byDay.has(today) ? 0 : 1; ; i++) {
      const d = isoDay(new Date(from.getTime() - i * 86400_000));
      if (!byDay.has(d)) break;
      streak++;
    }
  }

  const lastDoneOn = logs.length ? logs.map((l) => l.done_on).sort().at(-1)! : null;
  return { percent: target ? Math.round((done / target) * 100) : 0, done, target, streak, lastDoneOn };
}

export type NudgeStatus = "on-track" | "needs-nudge" | "inactive" | "no-plan";

/** The same four states the app's coach view uses, so they read alike. */
export function nudgeStatus(a: Adherence, hasPlan: boolean, from: Date = new Date()): NudgeStatus {
  if (!hasPlan) return "no-plan";
  const days = a.lastDoneOn
    ? Math.floor((new Date(isoDay(from)).getTime() - new Date(a.lastDoneOn).getTime()) / 86400_000)
    : Infinity;
  if (days >= 10) return "inactive";
  if (a.percent >= 60) return "on-track";
  return "needs-nudge";
}

export const NUDGE_IS: Record<NudgeStatus, string> = {
  "on-track": "Á góðri leið",
  "needs-nudge": "Þarf hvatningu",
  inactive: "Óvirkt",
  "no-plan": "Engin áætlun",
};

/**
 * Which habit a finished training session ticks off.
 *
 * The plan carries habits like "Styrktarþjálfun — 2–3 sinnum í viku" and the
 * programme carries the sessions that satisfy them. They were tracked apart,
 * so a workout had to be marked twice: once in the runner and once in the
 * checklist.
 *
 * Matched on the words the nurse wrote, because that is all the link there
 * is. Returns a uid only when exactly one habit matches and it is not already
 * done today: two candidates means the plan is ambiguous about which habit
 * this was, and ticking the wrong one is worse than ticking none.
 */
const MODALITY_WORDS: Record<string, RegExp> = {
  strength: /styrk|lyfting|strength/i,
  hiit: /hiit|lotur?|sprett|ákefð/i,
  cardio: /þol|zone|ganga|göngu|hjól|skokk|hlaup|sund/i,
};

export function actionForSession(
  plan: { modules?: { uid: string; pillar: string; title: string }[] } | null | undefined,
  modality: string,
  logs: { action_uid: string; done_on: string }[],
  day: string = isoDay(),
): string | null {
  const re = MODALITY_WORDS[modality];
  if (!re || !plan?.modules) return null;
  const done = new Set(logs.filter((l) => l.done_on === day).map((l) => l.action_uid));
  const hits = plan.modules.filter((a) => a.pillar === "exercise" && re.test(a.title) && !done.has(a.uid));
  return hits.length === 1 ? hits[0].uid : null;
}

/**
 * "fimmtudagur 8. október" — hand-formatted, because Intl is not reliable here.
 *
 * toLocaleDateString("is-IS") returns English on runtimes without the
 * Icelandic locale data, and Vercel's is one of them: the app home rendered
 * "THURSDAY, OCTOBER 8" on an Icelandic-first surface. Hand-formatting is the
 * only version that cannot quietly fall back.
 */
const DAYS_IS = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];
const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

export const longDayIs = (d: Date = new Date()) =>
  `${DAYS_IS[d.getDay()]} ${d.getDate()}. ${MONTHS_IS[d.getMonth()]}`;
