// Adaptive training programme ("HIIT og styrkur"): one programme that adapts
// to the participant instead of a fixed list of sessions.
//
//   level     — "beginner" starts with a 4-week adaptation block so muscles
//               and tendons get used to the load; "active" starts at Stig 1.
//   load      — −2…+2, the participant's own plus/minus: sets, how close to
//               failure each set goes, and the number of HIIT rounds.
//   injuries  — shoulder / knee / back: every exercise that loads that area
//               swaps to a variant that spares it, and HIIT drops jumping,
//               running or rowing as needed.
//   stage     — from the start date: one level up every 12 weeks.
//
// Client-safe and pure: the same settings always give the same sessions, so
// the participant page, the workstation and the print layout agree.
// Library links (image / video / muscles) come from adaptive-program-media.ts.

import type { ActionPlan, ExerciseItem, ExercisePhase, ExerciseSession, ExerciseTemplate } from "./types";
import { PROGRAM_MEDIA } from "./adaptive-program-media";

export type Region = "shoulder" | "knee" | "back";
export type TrainingLevel = "beginner" | "active";

export interface TrainingSettings {
  level: TrainingLevel;
  /** −2 … +2 */
  load: number;
  injuries: Region[];
  /** First training day; the stage is counted from here (else the plan start). */
  started_on: string | null;
}

export const DEFAULT_TRAINING: TrainingSettings = { level: "beginner", load: 0, injuries: [], started_on: null };

export const REGION_IS: Record<Region, { label: string; gen: string }> = {
  shoulder: { label: "Öxl", gen: "axlar" },
  knee: { label: "Hné", gen: "hnés" },
  back: { label: "Bak", gen: "baks" },
};
export const REGIONS: Region[] = ["shoulder", "knee", "back"];

export const LOAD_IS: Record<number, string> = {
  [-2]: "Mun léttara",
  [-1]: "Léttara",
  0: "Samkvæmt áætlun",
  1: "Þyngra",
  2: "Mun þyngra",
};

/** Programme keys that are computed here rather than stored as sessions. */
export const ADAPTIVE_KEYS = ["hiit-styrkur"] as const;
export const isAdaptive = (key: string | null | undefined) =>
  !!key && (ADAPTIVE_KEYS as readonly string[]).includes(key.replace(/-custom$/, ""));

// ── stages ─────────────────────────────────────────────────────────
type StageKey = "adapt" | "s1" | "s2" | "s3";
interface Stage {
  key: StageKey;
  title: string;
  /** null = open-ended */
  weeks: number | null;
  text: string;
  sets: number;
  reps: string;
  /** reps left in the tank at the end of each set */
  rir: number;
  tempo: string | null;
  hiit: { rounds: number; work: number; rest: number };
}
const STAGES: Record<StageKey, Stage> = {
  adapt: {
    key: "adapt", title: "Aðlögun", weeks: 4,
    text: "Vöðvar og sinar venjast álaginu. Létt, rólegt og tæknin í forgangi. Sinar aðlagast hægar en vöðvar og því er byrjað svona.",
    sets: 2, reps: "12–15", rir: 4, tempo: "3 sek. niður, 1 sek. upp",
    hiit: { rounds: 6, work: 20, rest: 70 },
  },
  s1: {
    key: "s1", title: "Stig 1 – Grunnur", weeks: 12,
    text: "Þrjú sett af stóru hreyfingunum. Þegar þú nærð efri mörkum endurtekninga í öllum settum máttu þyngja.",
    sets: 3, reps: "10–12", rir: 3, tempo: null,
    hiit: { rounds: 8, work: 30, rest: 60 },
  },
  s2: {
    key: "s2", title: "Stig 2 – Uppbygging", weeks: 12,
    text: "Þyngri útgáfur og færri endurtekningar. Síðustu endurtekningarnar eiga að vera krefjandi.",
    sets: 3, reps: "8–10", rir: 2, tempo: null,
    hiit: { rounds: 10, work: 30, rest: 45 },
  },
  s3: {
    key: "s3", title: "Stig 3 – Styrkur", weeks: null,
    text: "Þungt og krefjandi, með góðri tækni. Haltu áfram að þyngja smám saman.",
    sets: 4, reps: "6–8", rir: 1, tempo: null,
    hiit: { rounds: 8, work: 40, rest: 40 },
  },
};

const sequence = (level: TrainingLevel): StageKey[] => (level === "beginner" ? ["adapt", "s1", "s2", "s3"] : ["s1", "s2", "s3"]);

const DAY = 86_400_000;
export interface StageInfo {
  key: StageKey;
  index: number;
  count: number;
  title: string;
  text: string;
  week: number;
  /** weeks until the next level, null at the last one */
  weeksToNext: number | null;
  nextTitle: string | null;
}

export function stageAt(s: TrainingSettings, planStart: string | null, now = new Date()): StageInfo {
  const start = s.started_on || planStart;
  const t0 = start ? Date.parse(start) : NaN;
  const weeksIn = Number.isNaN(t0) ? 0 : Math.max(0, Math.floor((now.getTime() - t0) / (7 * DAY)));
  const seq = sequence(s.level);
  let from = 0;
  for (let i = 0; i < seq.length; i++) {
    const st = STAGES[seq[i]];
    if (st.weeks === null || weeksIn < from + st.weeks) {
      const next = seq[i + 1] ? STAGES[seq[i + 1]] : null;
      return {
        key: st.key, index: i, count: seq.length, title: st.title, text: st.text,
        week: weeksIn - from + 1,
        weeksToNext: st.weeks === null ? null : from + st.weeks - weeksIn,
        nextTitle: next?.title ?? null,
      };
    }
    from += st.weeks;
  }
  const last = STAGES[seq[seq.length - 1]];
  return { key: last.key, index: seq.length - 1, count: seq.length, title: last.title, text: last.text, week: 1, weeksToNext: null, nextTitle: null };
}

/** The stages as the plan's progression timeline. */
export function stagePhases(level: TrainingLevel): ExercisePhase[] {
  let from = 1;
  return sequence(level).map((k) => {
    const st = STAGES[k];
    const weeks = st.weeks === null ? `Frá viku ${from}` : `Vika ${from}–${from + st.weeks - 1}`;
    if (st.weeks) from += st.weeks;
    return { weeks, title: st.title, text: st.text };
  });
}

// ── exercises ──────────────────────────────────────────────────────
interface Variant { name: string; lib?: string; note?: string }
interface Slot {
  /** areas the movement loads */
  loads: Region[];
  byStage: Record<StageKey, Variant>;
  /** the variant that spares an injured area */
  spare: Partial<Record<Region, Variant>>;
  /** timed hold instead of reps, e.g. plank */
  hold?: boolean;
  cues: string[];
}

const SQUAT: Slot = {
  loads: ["knee", "back"],
  byStage: {
    adapt: { name: "Hnébeygja niður á kassa eða stól", lib: "Box Squat" },
    s1: { name: "Bikarhnébeygja með ketilbjöllu", lib: "Goblet Squat" },
    s2: { name: "Bikarhnébeygja, þyngri ketilbjalla", lib: "Goblet Squat" },
    s3: { name: "Hnébeygja með stöng", lib: "Barbell Full Squat" },
  },
  spare: {
    knee: { name: "Hnébeygja niður á háan kassa", lib: "Box Squat", note: "Styttri hreyfiferill sem minnkar álag á hnén. Hærri kassi, minna álag." },
    back: { name: "Fótapressa í tæki", lib: "Leg Press", note: "Bakið er stutt. Í stað hnébeygju vegna baks." },
  },
  cues: ["Brjóstið upp og þyngdin á hælunum.", "Hnén fylgja tánum."],
};
const HINGE: Slot = {
  loads: ["back"],
  byStage: {
    adapt: { name: "Mjaðmalyfta á gólfi", lib: "Glute Bridges" },
    s1: { name: "Rúmensk réttstöðulyfta með handlóðum", lib: "Romanian Deadlift" },
    s2: { name: "Réttstöðulyfta með ketilbjöllu eða hex-stöng", lib: "Conventional Deadlift" },
    s3: { name: "Réttstöðulyfta með stöng", lib: "Barbell Deadlift" },
  },
  spare: {
    back: { name: "Mjaðmalyfta með lóð", lib: "Hip Thrust", note: "Í stað réttstöðulyftu vegna baks." },
  },
  cues: ["Beint bak, hreyfingin kemur frá mjöðmunum.", "Lóðið nálægt líkamanum."],
};
const LUNGE: Slot = {
  loads: ["knee"],
  byStage: {
    adapt: { name: "Afturstig með stuðningi", lib: "Reverse Lunge" },
    s1: { name: "Afturstig", lib: "Reverse Lunge" },
    s2: { name: "Afturstig með handlóðum", lib: "Reverse Lunge" },
    s3: { name: "Búlgörsk hnébeygja", lib: "Bulgarian Split Squat" },
  },
  spare: {
    knee: { name: "Mjaðmalyfta á öðrum fæti", lib: "Single Leg Glute Bridge", note: "Í stað framstigs vegna hnés." },
  },
  cues: ["Stutt, stjórnað skref.", "Framhnéð yfir miðjum fæti."],
};
const PUSH: Slot = {
  loads: ["shoulder"],
  byStage: {
    adapt: { name: "Armbeygjur upp við vegg eða borð", lib: "Standard Push-Up", note: "Því hærra sem hendurnar eru, því léttara." },
    s1: { name: "Armbeygjur á bekk eða hnjám", lib: "Standard Push-Up" },
    s2: { name: "Bekkpressa með handlóðum", lib: "Dumbbell Bench Press" },
    s3: { name: "Bekkpressa með stöng", lib: "Barbell Bench Press - Medium Grip" },
  },
  spare: {
    shoulder: { name: "Gólfpressa með handlóðum, hlutlaust grip", lib: "Dumbbell Floor Press", note: "Styttri hreyfiferill sem hlífir öxlinni." },
  },
  cues: ["Olnbogar um 45° frá líkamanum.", "Spenntur kviður, beinn líkami."],
};
const PULL: Slot = {
  loads: ["back"],
  byStage: {
    adapt: { name: "Róður með teygju", lib: "Seated Cable Row" },
    s1: { name: "Róður með handlóð á bekk", lib: "Dumbbell Single-Arm Row" },
    s2: { name: "Sitjandi róður í kapli", lib: "Seated Cable Row" },
    s3: { name: "Róður með stöng", lib: "Pendlay Row" },
  },
  spare: {
    back: { name: "Sitjandi róður í tæki með brjóststuðningi", lib: "Seated Cable Row", note: "Bakið er stutt. Í stað frambeygðs róðurs vegna baks." },
  },
  cues: ["Dragðu herðablöðin saman og niður.", "Olnbogar nálægt líkamanum."],
};
const PRESS: Slot = {
  loads: ["shoulder", "back"],
  byStage: {
    adapt: { name: "Axlapressa sitjandi, létt handlóð", lib: "Seated Dumbbell Shoulder Press" },
    s1: { name: "Axlapressa sitjandi með handlóðum", lib: "Seated Dumbbell Shoulder Press" },
    s2: { name: "Axlapressa standandi með handlóðum", lib: "Dumbbell One-Arm Shoulder Press" },
    s3: { name: "Axlapressa með stöng", lib: "Barbell Overhead Press" },
  },
  spare: {
    shoulder: { name: "Teygjusundurdráttur", lib: "Band Pull-Aparts", note: "Styrkir aftanverða öxlina án þess að lyfta yfir höfuð." },
    back: { name: "Axlapressa sitjandi með bakstuðningi", lib: "Seated Dumbbell Shoulder Press", note: "Bakið er stutt." },
  },
  cues: ["Spenntur kviður, ekki fetta bakið.", "Lóðin upp í beinni línu."],
};
const CORE: Slot = {
  loads: ["shoulder", "back"],
  hold: true,
  byStage: {
    adapt: { name: "Planki á hnjám", lib: "Front Plank" },
    s1: { name: "Planki", lib: "Plank" },
    s2: { name: "Hliðarplanki", lib: "Side Plank" },
    s3: { name: "Planki með axlasnertingu", lib: "Plank" },
  },
  spare: {
    shoulder: { name: "Dauða pöddan", lib: "Dead Bug", note: "Engin þyngd á öxlunum." },
    back: { name: "Dauða pöddan", lib: "Dead Bug", note: "Mjóbakið helst í gólfinu." },
  },
  cues: ["Andaðu rólega.", "Beinn líkami frá höfði til hæla."],
};
const CARRY: Slot = {
  loads: ["back", "shoulder"],
  hold: true,
  byStage: {
    adapt: { name: "Bændaganga með létt lóð", lib: "Farmer's Walk" },
    s1: { name: "Bændaganga", lib: "Farmer's Walk" },
    s2: { name: "Bændaganga, þyngri", lib: "Farmer's Walk" },
    s3: { name: "Bændaganga, þung", lib: "Farmer's Walk" },
  },
  spare: {
    back: { name: "Pallof-pressa með teygju", lib: "Pallof Press", note: "Styrkir kviðinn án þyngdar á hryggnum." },
    shoulder: { name: "Pallof-pressa með teygju", lib: "Pallof Press", note: "Létt fyrir axlirnar." },
  },
  cues: ["Uppréttur, axlirnar niður.", "Stutt og örugg skref."],
};

// ── HIIT ───────────────────────────────────────────────────────────
function hiitMode(injuries: Region[]): { mode: string; note: string | null } {
  const k = injuries.includes("knee"), b = injuries.includes("back"), s = injuries.includes("shoulder");
  if (k && (b || s)) return { mode: "Þrekhjól með hóflegri mótstöðu", note: "Engin hlaup, stökk eða róðravél vegna meiðsla." };
  if (k) return { mode: "Þrekhjól, sund eða skíðavél", note: "Engin hlaup eða stökk vegna hnés." };
  if (b) return { mode: "Þrekhjól eða rösk ganga upp brekku", note: "Ekki róðravél eða stökk vegna baks." };
  if (s) return { mode: "Þrekhjól, rösk ganga upp brekku eða sprettir", note: "Ekki róðravél eða burpees vegna axlar." };
  return { mode: "Þrekhjól, róðravél, sprettir eða rösk ganga upp brekku", note: null };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function rirText(rir: number): string {
  if (rir >= 4) return "hættu þegar 4 eða fleiri endurtekningar eru eftir";
  if (rir === 3) return "hættu þegar 3 endurtekningar eru eftir";
  if (rir === 2) return "hættu þegar 2 endurtekningar eru eftir";
  if (rir === 1) return "hættu þegar 1 endurtekning er eftir";
  return "síðasta endurtekningin er erfið, en tæknin helst góð";
}

function strengthItem(slot: Slot, st: Stage, s: TrainingSettings): ExerciseItem {
  const injured = slot.loads.find((r) => s.injuries.includes(r) && slot.spare[r]);
  const v = injured ? slot.spare[injured]! : slot.byStage[st.key];
  // An injury swap also takes the load down a notch for that exercise.
  const load = clamp(s.load - (injured ? 1 : 0), -2, 2);
  const sets = clamp(st.sets + (load >= 2 ? 1 : 0) - (load <= -2 ? 1 : 0), 1, 5);
  const rir = clamp(st.rir - load, 0, 5);
  const media = v.lib ? PROGRAM_MEDIA[v.lib] : undefined;
  const holdSec = clamp((st.key === "adapt" ? 20 : st.key === "s1" ? 30 : 40) + load * 5, 10, 60);
  return {
    name: v.name,
    prescription: slot.hold ? `${sets} × ${holdSec} sek.` : `${sets} × ${st.reps}`,
    note: [slot.hold ? null : `Veldu þyngd svo að þú ${rirText(rir)}.`, st.tempo && !slot.hold ? `Taktur: ${st.tempo}.` : null, v.note ?? null].filter(Boolean).join(" ") || null,
    exercise_id: media?.id ?? null,
    image: media?.image ?? null,
    video: media?.video ?? null,
    muscles: media?.muscles ?? [],
    equipment: media?.equipment ?? null,
    cues: slot.cues,
    rest: st.key === "s3" ? "2 mín." : st.key === "adapt" ? "60 sek." : "90 sek.",
    block: "main",
  };
}

function hiitItem(st: Stage, s: TrainingSettings, extra = 0): ExerciseItem {
  // 10–20 minutes: never more than 20 minutes of intervals.
  const rounds = clamp(st.hiit.rounds + extra + s.load * 2, 4, Math.floor((20 * 60) / (st.hiit.work + st.hiit.rest)));
  const { mode, note } = hiitMode(s.injuries);
  const min = Math.round((rounds * (st.hiit.work + st.hiit.rest)) / 60);
  return {
    name: `HIIT: ${mode}`,
    prescription: `${rounds} × ${st.hiit.work} sek. hratt / ${st.hiit.rest} sek. rólega`,
    note: [
      `Um ${min} mín.`,
      st.key === "adapt" ? "„Hratt“ þýðir rösklega: þú getur sagt nokkur orð en ekki heila setningu." : "„Hratt“ þýðir nálægt hámarki í hverri lotu.",
      note,
    ].filter(Boolean).join(" "),
    muscles: [],
    cues: ["Byrjaðu rólega og auktu hraðann í hverri lotu.", "Rólegu kaflarnir eru hluti af æfingunni."],
    rest: null,
    block: "finisher",
  };
}

const WARMUP: ExerciseItem = {
  name: "Upphitun",
  prescription: "5 mín.",
  note: "Rólegt á hjóli eða í göngu, svo nokkrar hnébeygjur, mjaðmahringir og handahringir.",
  muscles: [],
  cues: [],
  rest: null,
  block: "warmup",
};

export function buildSessions(s: TrainingSettings, st: Stage): ExerciseSession[] {
  const it = (slot: Slot) => strengthItem(slot, st, s);
  const hiitMin = (extra: number) => Math.min(20, ((st.hiit.rounds + extra + s.load * 2) * (st.hiit.work + st.hiit.rest)) / 60);
  const minutes = (n: number, extra = 0) => Math.round(5 + n * st.sets * 2.5 + hiitMin(extra));
  return [
    { day: "Mánudagur", title: "Fætur og kviður", focus: "Styrkur og HIIT", minutes: minutes(4), items: [WARMUP, it(SQUAT), it(HINGE), it(LUNGE), it(CORE), hiitItem(st, s)] },
    { day: "Miðvikudagur", title: "Efri líkami", focus: "Styrkur og HIIT", minutes: minutes(4), items: [WARMUP, it(PUSH), it(PULL), it(PRESS), it(CARRY), hiitItem(st, s)] },
    { day: "Föstudagur", title: "Allur líkaminn", focus: "Styrkur og lengri HIIT", minutes: minutes(4, 2), items: [WARMUP, it(HINGE), it(SQUAT), it(PUSH), it(PULL), hiitItem(st, s, 2)] },
  ];
}

/** Which exercises were swapped for an injury, for the "adapted for you" note. */
export function injuryNotes(s: TrainingSettings): string[] {
  return s.injuries.map((r) => {
    const n = [SQUAT, HINGE, LUNGE, PUSH, PULL, PRESS, CORE, CARRY].filter((x) => x.loads.includes(r) && x.spare[r]).length;
    return `${REGION_IS[r].label}: ${n} æfingum skipt út fyrir mildari útgáfu og HIIT aðlagað.`;
  });
}

type PlanExercise = NonNullable<ActionPlan["exercise"]>;

/** The stored template (name, goal, principles) with sessions and timeline for these settings. */
export function adaptExercise(e: PlanExercise, s: TrainingSettings, planStart: string | null, now = new Date()): PlanExercise {
  const info = stageAt(s, planStart, now);
  const st = STAGES[info.key];
  const sessions = buildSessions(s, st);
  const level: ExerciseTemplate["level"] = info.key === "adapt" || info.key === "s1" ? "beginner" : info.key === "s2" ? "intermediate" : "advanced";
  return {
    ...e,
    level,
    days_per_week: 3,
    session_minutes: Math.round(sessions.reduce((n, x) => n + (x.minutes ?? 0), 0) / sessions.length),
    sessions,
    progression: stagePhases(s.level),
  };
}

export function sanitizeTraining(b: Record<string, unknown>): Omit<TrainingSettings, "started_on"> & { started_on: string | null } {
  const level: TrainingLevel = b.level === "active" ? "active" : "beginner";
  const load = clamp(Math.round(Number(b.load) || 0), -2, 2);
  const injuries = (Array.isArray(b.injuries) ? b.injuries : []).filter((r): r is Region => (REGIONS as unknown[]).includes(r));
  const started_on = typeof b.started_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.started_on) ? b.started_on : null;
  return { level, load, injuries: [...new Set(injuries)], started_on };
}
