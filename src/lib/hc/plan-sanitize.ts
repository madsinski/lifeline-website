// Shape-checks an action plan coming from the builder before it is stored.
// Client-safe. Strings are trimmed and length-capped; unknown pillars drop.

import { PILLARS, type ActionPlan, type ExerciseItem, type ExercisePhase, type ExerciseSession, type Pillar, type PlanGoal, type PlanItem } from "./types";

const str = (v: unknown, max = 2000): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const isPillar = (v: unknown): v is Pillar => typeof v === "string" && (PILLARS as string[]).includes(v);
const url = (v: unknown): string | null => {
  const t = str(v, 1000);
  return t && /^https:\/\//.test(t) ? t : null;
};
const strs = (v: unknown, n: number, max: number): string[] =>
  (Array.isArray(v) ? v : []).map((x) => str(x, max)).filter((x): x is string => !!x).slice(0, n);
const uuid = (v: unknown): string | null => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

function exerciseItem(it: Record<string, unknown>): ExerciseItem {
  return {
    name: str(it.name, 120) || "",
    prescription: str(it.prescription, 80) || "",
    note: str(it.note, 300),
    exercise_id: uuid(it.exercise_id),
    image: url(it.image),
    video: url(it.video),
    muscles: strs(it.muscles, 6, 40),
    equipment: str(it.equipment, 40),
    cues: strs(it.cues, 5, 240),
    rest: str(it.rest, 40),
    block: it.block === "warmup" || it.block === "finisher" ? it.block : "main",
  };
}

const date = (v: unknown): string | null => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export type PlanDraft = Pick<ActionPlan,
  "template_key" | "headline" | "summary" | "goals" | "modules" | "exercise" | "nutrition" | "nurse_note" | "start_date" | "review_date">;

export function sanitizePlan(b: Record<string, unknown>): PlanDraft {
  const goals: PlanGoal[] = (Array.isArray(b.goals) ? b.goals : [])
    .filter((g): g is Record<string, unknown> => !!g && typeof g === "object")
    .map((g) => ({ pillar: g.pillar, text: str(g.text, 300) }))
    .filter((g): g is PlanGoal => isPillar(g.pillar) && !!g.text)
    .slice(0, 8);

  const modules: PlanItem[] = (Array.isArray(b.modules) ? b.modules : [])
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .filter((m) => isPillar(m.pillar) && !!str(m.title, 200))
    .slice(0, 40)
    .map((m, i) => ({
      uid: str(m.uid, 64) || `m${i}-${Date.now()}`,
      key: str(m.key, 100),
      pillar: m.pillar as Pillar,
      title: str(m.title, 200)!,
      summary: str(m.summary, 500) || "",
      details: str(m.details, 3000),
      frequency: str(m.frequency, 100),
      note: str(m.note, 2000),
    }));

  let exercise: PlanDraft["exercise"] = null;
  if (b.exercise && typeof b.exercise === "object") {
    const e = b.exercise as Record<string, unknown>;
    const sessions: ExerciseSession[] = (Array.isArray(e.sessions) ? e.sessions : [])
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .slice(0, 7)
      .map((s) => ({
        day: str(s.day, 40) || "",
        title: str(s.title, 120) || "",
        focus: str(s.focus, 120),
        minutes: s.minutes ? Math.max(5, Math.min(240, Number(s.minutes) || 0)) || null : null,
        items: (Array.isArray(s.items) ? s.items : [])
          .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
          .slice(0, 15)
          .map(exerciseItem)
          .filter((it) => it.name),
      }));
    exercise = {
      key: str(e.key, 100) || "custom",
      name: str(e.name, 120) || "Æfingaáætlun",
      level: e.level === "intermediate" || e.level === "advanced" ? e.level : "beginner",
      goal: str(e.goal, 200),
      days_per_week: Math.max(1, Math.min(7, Number(e.days_per_week) || sessions.length || 3)),
      session_minutes: e.session_minutes ? Math.max(5, Math.min(240, Number(e.session_minutes) || 30)) : null,
      description: str(e.description, 1000),
      sessions,
      principles: strs(e.principles, 8, 300),
      progression: (Array.isArray(e.progression) ? e.progression : [])
        .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
        .map((p): ExercisePhase => ({ weeks: str(p.weeks, 30) || "", title: str(p.title, 80) || "", text: str(p.text, 400) || "" }))
        .filter((p) => p.title || p.text)
        .slice(0, 4),
    };
  }

  let nutrition: PlanDraft["nutrition"] = null;
  if (b.nutrition && typeof b.nutrition === "object") {
    const n = b.nutrition as Record<string, unknown>;
    nutrition = {
      key: str(n.key, 100) || "custom",
      name: str(n.name, 120) || "Næringaráætlun",
      goal: str(n.goal, 200),
      description: str(n.description, 1000),
      principles: (Array.isArray(n.principles) ? n.principles : []).map((p) => str(p, 300)).filter((p): p is string => !!p).slice(0, 12),
      day_example: (Array.isArray(n.day_example) ? n.day_example : [])
        .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
        .map((d) => ({
          meal: str(d.meal, 60) || "",
          example: str(d.example, 300) || "",
          meal_id: uuid(d.meal_id),
          image: url(d.image),
          kcal: d.kcal == null || d.kcal === "" ? null : Math.max(0, Math.min(5000, Number(d.kcal) || 0)),
          protein: d.protein == null || d.protein === "" ? null : Math.max(0, Math.min(500, Number(d.protein) || 0)),
          tags: strs(d.tags, 6, 40),
        }))
        .filter((d) => d.meal && d.example)
        .slice(0, 8),
    };
  }

  return {
    template_key: str(b.template_key, 100),
    headline: str(b.headline, 200),
    summary: str(b.summary, 2000),
    goals,
    modules,
    exercise,
    nutrition,
    nurse_note: str(b.nurse_note, 4000),
    start_date: date(b.start_date),
    review_date: date(b.review_date),
  };
}
