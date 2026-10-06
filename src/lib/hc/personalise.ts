// The participant's own version of their exercise programme: which day each
// session falls on, HIIT on its own days, and exercises swapped for others
// from the library. Applied on top of any programme (adaptive or stored), so
// the Æfingar tab, "Í dag" and print all agree.
//
// Pure and client-safe. Stored in hc_training_settings (migration-hc-personalise.sql).

import type { ActionPlan, ExerciseItem, ExerciseSession } from "./types";

export const WEEKDAYS = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"] as const;
export const WEEKDAYS_SHORT = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"] as const;

/** Monday-first index (0–6) of a session day such as "Miðvikudagur"; -1 if unknown. */
export function weekdayIndex(day: string | null | undefined): number {
  const d = (day ?? "").toLowerCase();
  return WEEKDAYS.findIndex((w) => d.startsWith(w.slice(0, 3).toLowerCase()));
}
/** Monday-first index of a date. */
export const weekdayOf = (date: Date) => (date.getDay() + 6) % 7;

export interface SwapSnapshot {
  exercise_id: string;
  name: string;
  image: string | null;
  video: string | null;
  muscles: string[];
  equipment: string | null;
  cues: string[];
}

export interface Personal {
  program_key: string | null;
  /** session id → weekday 0–6 */
  days: Record<string, number>;
  hiit_split: boolean;
  /** "<session id>:<item index>" → exercise from the library */
  swaps: Record<string, SwapSnapshot>;
  /** meal slot → meals.id */
  meal_picks: Record<string, string>;
}

export const DEFAULT_PERSONAL: Personal = { program_key: null, days: {}, hiit_split: false, swaps: {}, meal_picks: {} };

export type Modality = "strength" | "hiit" | "cardio" | "other";
export const MODALITY_IS: Record<Modality, { label: string; short: string; cls: string; dot: string }> = {
  strength: { label: "Styrkur", short: "Styrk", cls: "bg-orange-100 text-orange-900 ring-orange-200", dot: "bg-orange-500" },
  hiit: { label: "HIIT", short: "HIIT", cls: "bg-rose-100 text-rose-900 ring-rose-200", dot: "bg-rose-500" },
  cardio: { label: "Þol", short: "Þol", cls: "bg-sky-100 text-sky-900 ring-sky-200", dot: "bg-sky-500" },
  other: { label: "Hreyfing", short: "Hreyf.", cls: "bg-slate-100 text-slate-800 ring-slate-200", dot: "bg-slate-400" },
};

export interface PSession extends ExerciseSession {
  id: string;
  modality: Modality;
  weekday: number;
}

/**
 * A hard interval block.
 *
 * Matched on the name because that is all a stored programme carries. The
 * adaptive core used to call these "HIIT: þrekhjól"; they are named after the
 * activity now ("Þrekhjól — lotur") because that is what you actually go and
 * do, so the suffix is matched too.
 */
const isHiitItem = (it: ExerciseItem) => /^hiit|—\s*lotur$/i.test(it.name);

export function modalityOf(s: Pick<ExerciseSession, "title" | "focus" | "items">): Modality {
  const main = s.items.filter((i) => (i.block ?? "main") === "main");
  const text = `${s.title} ${s.focus ?? ""}`.toLowerCase();
  if (main.length === 0 && s.items.some(isHiitItem)) return "hiit";
  if (/hiit|lotu|interval|sprett|4 ?x ?4/.test(text) && main.length <= 1) return "hiit";
  if (/styrk|strength/.test(text) || main.length >= 3) return "strength";
  if (/zone|þol|jöfn|gang|hjól|sund|skokk|cardio|ganga/.test(text)) return "cardio";
  return "other";
}

type PlanExercise = NonNullable<ActionPlan["exercise"]>;

/** Does the programme carry HIIT inside other sessions (so it can be split out)? */
export const canSplitHiit = (e: PlanExercise) => e.sessions.some((s) => s.items.some(isHiitItem) && s.items.some((i) => !isHiitItem(i) && (i.block ?? "main") === "main"));

/** Keep only the load/tempo guidance from an item's note when the exercise is swapped. */
const keepGuidance = (note: string | null | undefined) =>
  (note ?? "").split(/(?<=\.)\s+/).filter((x) => /^(Veldu þyngd|Taktur)/.test(x)).join(" ") || null;

/**
 * The programme as this participant has arranged it. Customisations made for
 * another programme are ignored (a new programme starts clean).
 */
export type PersonalExercise = Omit<PlanExercise, "sessions"> & { sessions: PSession[] };
export function personalise(e: PlanExercise, p: Personal, blockedDays: number[] = []): PersonalExercise {
  const mine = !p.program_key || p.program_key === e.key;
  /**
   * A saved arrangement must not drop a session onto a day that is already
   * hard.
   *
   * `days` is keyed by position — s0, s1, s2 — which was fine when the week
   * was a fixed three sessions. It is not fine now: the week is built around
   * the person's own commitments, their available days, their stage and what
   * is already covered, so the session at index 0 today is not the session
   * that was at index 0 when the arrangement was saved. A stale mapping
   * therefore moves the WRONG session, and the one it moved onto a football
   * day was exactly the Zone 2 that had been placed away from it.
   *
   * Honouring a move only when the destination is free fixes the symptom
   * whatever the mapping meant, and the builder's own placement — which does
   * know about the commitments — stands when it does not.
   */
  const blocked = new Set(blockedDays);
  const days = mine
    ? Object.fromEntries(Object.entries(p.days).filter(([, d]) => !blocked.has(d)))
    : {};
  const swaps = mine ? p.swaps : {};

  let sessions: PSession[] = e.sessions.map((s, i) => {
    const id = `s${i}`;
    const items = s.items.map((it, j): ExerciseItem => {
      const slot = `${id}:${j}`;
      const sw = swaps[slot];
      if (!sw) return { ...it, slot };
      return {
        ...it, slot, swapped: true, name: sw.name, exercise_id: sw.exercise_id, image: sw.image, video: sw.video,
        muscles: sw.muscles, equipment: sw.equipment, cues: sw.cues.slice(0, 6), note: keepGuidance(it.note),
      };
    });
    return { ...s, items, id, modality: modalityOf({ ...s, items }), weekday: weekdayIndex(s.day) };
  });

  if (mine && p.hiit_split && canSplitHiit(e)) {
    const hiit: PSession[] = [];
    sessions = sessions.map((s) => {
      const h = s.items.find(isHiitItem);
      if (!h || s.items.every(isHiitItem)) return s;
      const mins = Number(/Um (\d+) mín/.exec(h.note ?? "")?.[1] ?? 0);
      const id = `h${s.id.slice(1)}`;
      hiit.push({
        id, day: WEEKDAYS[(Math.max(0, s.weekday) + 1) % 7], title: "HIIT", focus: "Stutt og ákaft",
        minutes: mins ? mins + 5 : null, modality: "hiit", weekday: (Math.max(0, s.weekday) + 1) % 7,
        items: [{ name: "Upphitun", prescription: "5 mín.", note: "Rólegt á hjóli eða í göngu.", muscles: [], cues: [], rest: null, block: "warmup" }, { ...h, block: "main" }],
      });
      const items = s.items.filter((i) => !isHiitItem(i));
      return { ...s, items, focus: "Styrkur", minutes: s.minutes && mins ? s.minutes - mins : s.minutes, modality: "strength" };
    });
    sessions = [...sessions, ...hiit];
  }

  sessions = sessions.map((s) => {
    const d = days[s.id];
    return d != null && d >= 0 && d <= 6 ? { ...s, weekday: d, day: WEEKDAYS[d] } : s;
  }).sort((a, b) => (a.weekday < 0 ? 9 : a.weekday) - (b.weekday < 0 ? 9 : b.weekday) || a.id.localeCompare(b.id));

  return { ...e, sessions, days_per_week: new Set(sessions.map((s) => s.weekday)).size };
}

/** The sessions that fall on a date. */
export function sessionsOn(e: { sessions: PSession[] }, date: Date): PSession[] {
  const d = weekdayOf(date);
  return e.sessions.filter((s) => s.weekday === d);
}

/** Validate what the client sends. Swaps arrive as exercise ids and are snapshotted server-side. */
export function sanitizePersonal(b: Record<string, unknown>): { program_key: string | null; days: Record<string, number>; hiit_split: boolean; swapIds: Record<string, string | null>; meal_picks: Record<string, string> } {
  const days: Record<string, number> = {};
  if (b.days && typeof b.days === "object") {
    for (const [k, v] of Object.entries(b.days as Record<string, unknown>)) {
      const n = Number(v);
      if (/^[sh]\d{1,2}$/.test(k) && Number.isInteger(n) && n >= 0 && n <= 6) days[k] = n;
    }
  }
  const swapIds: Record<string, string | null> = {};
  if (b.swaps && typeof b.swaps === "object") {
    for (const [k, v] of Object.entries(b.swaps as Record<string, unknown>)) {
      if (!/^s\d{1,2}:\d{1,2}$/.test(k)) continue;
      const id = typeof v === "string" ? v : v && typeof v === "object" ? (v as { exercise_id?: unknown }).exercise_id : null;
      swapIds[k] = typeof id === "string" && /^[0-9a-f-]{36}$/.test(id) ? id : null;
    }
  }
  const meal_picks: Record<string, string> = {};
  if (b.meal_picks && typeof b.meal_picks === "object") {
    for (const [k, v] of Object.entries(b.meal_picks as Record<string, unknown>)) {
      if (/^(breakfast|lunch|snack|dinner)$/.test(k) && typeof v === "string" && /^[0-9a-f-]{36}$/.test(v)) meal_picks[k] = v;
    }
  }
  const program_key = typeof b.program_key === "string" ? b.program_key.slice(0, 60) : null;
  return { program_key, days, hiit_split: b.hiit_split === true, swapIds, meal_picks };
}
