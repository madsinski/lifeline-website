// What a participant actually did, day by day: workouts (including the
// "Gera annað" substitutions), meals (planned or described instead) and
// habit ticks, merged into one list. Client-safe types and wording; the
// loader is src/lib/hc/activity-server.ts. Read by the workstation
// (/api/vinnustod/journeys/[id]/activity) and the participant
// (/api/hc/activity), so both sides see the same record.

export type ActivityKind = "workout" | "meal" | "habit";

export interface ActivityEntry {
  kind: ActivityKind;
  /** yyyy-mm-dd. */
  date: string;
  /** Sort key within the day (ISO timestamp when known). */
  at: string | null;
  /** What was done: the session or activity, the meal, the habit. */
  label: string;
  /** Workouts. */
  modality?: string | null;
  minutes?: number | null;
  rpe?: number | null;
  substituted?: boolean;
  /** The prescribed session a substitution replaced, when it is known. */
  replaced?: string | null;
  /** Meals. */
  slot?: string | null;
  described?: boolean;
  kcal?: number | null;
  protein?: number | null;
}

export interface ActivityDay { date: string; entries: ActivityEntry[] }

/** RPE ↔ the three words the participant picks from. */
export const EFFORTS = [
  { key: "easy", label: "Létt", rpe: 3 },
  { key: "moderate", label: "Hóflegt", rpe: 5 },
  { key: "hard", label: "Erfitt", rpe: 8 },
] as const;

export function effortLabel(rpe: number | null | undefined): string | null {
  if (rpe == null) return null;
  if (rpe <= 3) return "Létt";
  if (rpe <= 6) return "Hóflegt";
  return "Erfitt";
}

/** Genitive, for "í stað …" when the replaced session's title was not stored. */
export const MODALITY_GEN_IS: Record<string, string> = {
  strength: "styrktaræfingar",
  hiit: "HIIT-æfingar",
  cardio: "þolæfingar",
};

/** Entries grouped by date, newest day first, entries in time order. */
export function groupByDay(entries: ActivityEntry[]): ActivityDay[] {
  const map = new Map<string, ActivityEntry[]>();
  for (const e of entries) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }
  const order: Record<ActivityKind, number> = { workout: 0, meal: 1, habit: 2 };
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, list]) => ({
      date,
      entries: list.sort((a, b) => order[a.kind] - order[b.kind] || (a.at ?? "").localeCompare(b.at ?? "")),
    }));
}

const DAYS_SHORT = ["Sun.", "Mán.", "Þri.", "Mið.", "Fim.", "Fös.", "Lau."];
const MONTHS_SHORT = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];

/** "Fim. 15. okt." — hand-formatted (Intl lacks is-IS on Vercel). */
export function dayHeading(iso: string, today: string): string {
  if (iso === today) return "Í dag";
  const t = new Date(`${today}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  if (iso === t.toISOString().slice(0, 10)) return "Í gær";
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS_SHORT[d.getUTCDay()]} ${d.getUTCDate()}. ${MONTHS_SHORT[d.getUTCMonth()]}`;
}
