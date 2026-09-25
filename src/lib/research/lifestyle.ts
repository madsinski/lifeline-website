// Lifestyle ("upstream") analytics for a research cohort, all from the
// BASELINE health check (Heilsumat) — Lifeline's four pillars (sleep,
// exercise, nutrition, mental wellbeing) plus substances:
//
//  - pillarSummary():  0–10 pillar scores (mean, share needing attention <6)
//  - habitFacts():     concrete habits from questionnaire answers, as the
//                      share of all Heilsumat respondents (so conditional
//                      questions read as a share of everyone)
//  - lifestyleRiskMatrix(): age-adjusted (partial) Spearman correlation of
//                      each behavioural pillar with each risk marker. A FIXED
//                      matrix — every cell is shown, not just the "good" ones.
//  - surveyChange():   self-reported change from a follow-up feedback survey
//                      (aggregate only, suppressed below MIN_SURVEY_N).
//
// Pure functions; the route loads the rows.

import type { ObsRow, PatientRow, BeforeAfterResult, ProfileItem } from "./before-after";
import { mcnemar } from "./stats";

export interface AnswerRow {
  medalia_patient_id: string;
  questionnaire_title: string | null;
  question_text: string | null;
  value_text: string | null;
  authored_at: string | null;
}

export const MIN_SURVEY_N = 5;

const firstValues = (obs: ObsRow[], feature: string): Map<string, number> => {
  const best = new Map<string, { at: string; v: number }>();
  for (const o of obs) {
    if (o.feature !== feature || o.value_num === null || !o.observed_at) continue;
    const cur = best.get(o.medalia_patient_id);
    if (!cur || o.observed_at < cur.at) best.set(o.medalia_patient_id, { at: o.observed_at, v: o.value_num });
  }
  return new Map([...best].map(([k, v]) => [k, v.v]));
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// ── pillars ───────────────────────────────────────────────────────
export interface PillarScore { key: string; label: string; sub: string; mean: number | null; below6: number; n: number }

const PILLARS: { key: string; label: string; sub: string; feature: string }[] = [
  { key: "sleep", label: "Svefn", sub: "venjur", feature: "lifeline_health_sleep_behaviour_score" },
  { key: "exercise", label: "Hreyfing", sub: "venjur", feature: "lifeline_health_exercise_behavioural_score" },
  { key: "nutrition", label: "Næring", sub: "venjur", feature: "lifeline_health_nutrition_behavioural_score" },
  { key: "mental", label: "Andleg heilsa", sub: "einkenni þunglyndis", feature: "lifeline_health_depression_score_1_10" },
  { key: "stress", label: "Streita", sub: "einkenni kvíða", feature: "lifeline_health_anxiety_score_1_10" },
  { key: "wellbeing", label: "Almenn vellíðan", sub: "PWI", feature: "pwi" },
  { key: "overall", label: "Lífsstílseinkunn", sub: "heildarmat", feature: "lifstilseinkunn" },
];

export function pillarSummary(obs: ObsRow[]): PillarScore[] {
  return PILLARS.map((p) => {
    const vals = [...firstValues(obs, p.feature).values()];
    return { key: p.key, label: p.label, sub: p.sub, mean: mean(vals), below6: vals.filter((v) => v < 6).length, n: vals.length };
  }).filter((p) => p.n >= MIN_SURVEY_N);
}

// ── habits from answers ──────────────────────────────────────────
export interface HabitFact { pillar: string; label: string; n: number; of: number }

type HabitDef =
  | { pillar: string; label: string; q: string; bad: (v: string) => boolean; revised?: boolean }
  | { pillar: string; label: string; score: string; bad: (v: number) => boolean };

const eq = (...xs: string[]) => (v: string) => xs.includes(v);
const starts = (x: string) => (v: string) => v.startsWith(x);

const HABITS: HabitDef[] = [
  // svefn
  { pillar: "sleep", label: "sofa minna en 7 klukkustundir", q: "Hversu mikinn svefn færðu", bad: eq("Minna en 6 klukkustundir", "6-7 klukkustundir") },
  { pillar: "sleep", label: "finna fyrir syfju yfir daginn", q: "óhóflegri syfju yfir daginn", bad: starts("Já") },
  { pillar: "sleep", label: "vakna ekki úthvíld flesta daga", q: "vel úthvíld", bad: eq("Stundum", "Sjaldan eða aldrei") },
  { pillar: "sleep", label: "nota skjá alveg fram að svefni", q: "hættir þú yfirleitt að nota sjónvarp", bad: eq("Rétt fyrir svefn") },
  { pillar: "sleep", label: "hrjóta hátt eða eiga erfitt með andardrátt í svefni", q: "hrjótir hátt", bad: starts("Já") },
  // hreyfing
  { pillar: "exercise", label: "stunda enga styrktarþjálfun", q: "stundar þú styrktarþjálfun", bad: eq("Ekkert") },
  { pillar: "exercise", label: "stunda þolþjálfun 0–1 dag í viku", q: "létta eða meðalerfiða þolþjálfun", bad: eq("0-1 dag") },
  { pillar: "exercise", label: "segja eitthvað hindra reglulega hreyfingu", q: "kemur í veg fyrir að þú hreyfir þig", bad: eq("Já") },
  { pillar: "exercise", label: "hafa verki eða meiðsli sem takmarka hreyfingu", q: "verk eða meiðsli", bad: eq("Stundum", "Oft") },
  // næring
  { pillar: "nutrition", label: "borða undir álagi eða í flýti flesta daga", q: "undir álagi, í flýti", bad: eq("Flesta daga") },
  { pillar: "nutrition", label: "upplifa stjórnleysi gagnvart mat", q: "stjórnleysi gagnvart", bad: eq("Já") },
  { pillar: "nutrition", label: "borða oft mat með miklum viðbættum sykri", q: "mikinn viðbættan sykur", bad: eq("Oft") },
  { pillar: "nutrition", label: "borða lítið af trefjum", q: "neysla þín á trefjum", bad: starts("Lítil") },
  { pillar: "nutrition", label: "borða seint á kvöldin flesta daga", q: "seint á kvöldin", bad: eq("Flesta daga") },
  // andleg heilsa
  { pillar: "mental", label: "eru með einkenni þunglyndis (PHQ-9 10 eða hærra)", score: "phq9", bad: (v: number) => v >= 10 },
  { pillar: "mental", label: "eru með einkenni kvíða (GAD-7 10 eða hærra)", score: "lifeline_health_anxiety_gad_7", bad: (v: number) => v >= 10 },
  { pillar: "mental", label: "finna oft fyrir kvíða eða óróleika", q: "Fundið fyrir kvíða eða óróleika", bad: eq("Oftar en helming daganna", "Næstum daglega") },
  { pillar: "mental", label: "búa við litla almenna vellíðan (undir 6 af 10)", score: "pwi", bad: (v: number) => v < 6 },
  // efni
  { pillar: "substances", label: "nota nikótín daglega eða flesta daga", q: "notkun þinni á nikótín", bad: starts("Ég nota nikótín/tóbak reglulega") },
  // revised: the caffeine section was rewritten in the 2026-06 Heilsumat → not comparable over time
  { pillar: "substances", label: "drekka orkudrykki reglulega", q: "Hvaða koffíndrykki", bad: eq("Orkudrykki"), revised: true },
  { pillar: "substances", label: "drekka meira en 6 drykki í einu mánaðarlega eða oftar", q: "meira en 6 drykki", bad: eq("Mánaðarlega", "Vikulega", "Daglega eða næstum daglega") },
];

export const HABIT_PILLAR_LABEL: Record<string, string> = {
  sleep: "Svefn", exercise: "Hreyfing", nutrition: "Næring", mental: "Andleg heilsa", substances: "Nikótín, koffín og áfengi",
};

// Heilsumat forms per patient: distinct answer days, sorted. The first is the
// baseline form; the last (≥14 days later) is the follow-up form.
function heilsumatDays(answers: AnswerRow[]): Map<string, string[]> {
  const m = new Map<string, Set<string>>();
  for (const a of answers) {
    if (!(a.questionnaire_title || "").toLowerCase().startsWith("heilsumat") || !a.authored_at) continue;
    if (!m.has(a.medalia_patient_id)) m.set(a.medalia_patient_id, new Set());
    m.get(a.medalia_patient_id)!.add(a.authored_at.slice(0, 10));
  }
  return new Map([...m].map(([k, v]) => [k, [...v].sort()]));
}
function hitsOnDay(answers: AnswerRow[], h: Extract<HabitDef, { q: string }>, dayOf: Map<string, string>): Set<string> {
  const hit = new Set<string>();
  for (const a of answers) {
    if (!a.question_text || !a.value_text || !a.authored_at || !a.question_text.includes(h.q)) continue;
    if (dayOf.get(a.medalia_patient_id) !== a.authored_at.slice(0, 10)) continue;
    if (h.bad(a.value_text.trim())) hit.add(a.medalia_patient_id);
  }
  return hit;
}

/** Habits at BASELINE (each patient's first Heilsumat). */
export function habitFacts(obs: ObsRow[], answers: AnswerRow[]): HabitFact[] {
  const days = heilsumatDays(answers);
  const of = days.size;
  if (of < MIN_SURVEY_N) return [];
  const firstDay = new Map([...days].map(([pid, d]) => [pid, d[0]]));
  return HABITS.map((h) => {
    const n = "q" in h
      ? hitsOnDay(answers, h, firstDay).size
      : [...firstValues(obs, h.score)].filter(([pid, v]) => days.has(pid) && h.bad(v)).length;
    return { pillar: h.pillar, label: h.label, n, of };
  });
}

/** Same habits for the SAME people at their first vs latest Heilsumat
 *  (≥14 days apart). Question-based habits only — the mental-health score
 *  habits depend on instruments that may not be re-administered. */
export interface HabitShift { pillar: string; label: string; before: number; after: number; of: number; p: number }
export function habitShift(answers: AnswerRow[]): HabitShift[] {
  const days = heilsumatDays(answers);
  const both = [...days].filter(([, d]) => d.length >= 2 && (Date.parse(d[d.length - 1]) - Date.parse(d[0])) / 86400000 >= 14);
  if (both.length < MIN_SURVEY_N) return [];
  const firstDay = new Map(both.map(([pid, d]) => [pid, d[0]]));
  const lastDay = new Map(both.map(([pid, d]) => [pid, d[d.length - 1]]));
  const out: HabitShift[] = [];
  for (const h of HABITS) {
    if (!("q" in h) || h.revised) continue;
    const b = hitsOnDay(answers, h, firstDay), a = hitsOnDay(answers, h, lastDay);
    // only people who answered the question at both forms
    const answeredAt = (dayOf: Map<string, string>) => new Set(answers.filter((x) => x.question_text?.includes(h.q) && x.authored_at && dayOf.get(x.medalia_patient_id) === x.authored_at.slice(0, 10)).map((x) => x.medalia_patient_id));
    const ab = answeredAt(firstDay), aa = answeredAt(lastDay);
    const ids = [...ab].filter((id) => aa.has(id));
    if (ids.length < MIN_SURVEY_N) continue;
    // McNemar on the discordant pairs (stopped vs started the habit)
    const stopped = ids.filter((id) => b.has(id) && !a.has(id)).length, started = ids.filter((id) => !b.has(id) && a.has(id)).length;
    out.push({ pillar: h.pillar, label: h.label, before: ids.filter((id) => b.has(id)).length, after: ids.filter((id) => a.has(id)).length, of: ids.length, p: mcnemar(stopped, started).p });
  }
  return out;
}

// ── lifestyle × risk (age-adjusted partial Spearman) ──────────────
export interface MatrixCell { rho: number; p: number; n: number }
export interface RiskMatrix {
  rows: { key: string; label: string }[];
  cols: { key: string; label: string }[];
  cells: (MatrixCell | null)[][];
}

const M_ROWS = [
  { key: "lifeline_health_exercise_behavioural_score", label: "Hreyfivenjur" },
  { key: "lifeline_health_nutrition_behavioural_score", label: "Matarvenjur" },
  { key: "lifeline_health_sleep_behaviour_score", label: "Svefnvenjur" },
  { key: "lifstilseinkunn", label: "Lífsstílseinkunn" },
];
const M_COLS = [
  { key: "bmi", label: "BMI" },
  { key: "fat_mass_percent", label: "Fituhlutfall" },
  { key: "bp_systolic_avg", label: "Blóðþrýstingur" },
  { key: "homa_ir", label: "Insúlínviðnám" },
  { key: "triglycerides", label: "Þríglýseríð" },
  { key: "phq9", label: "Einkenni þunglyndis" },
];

function ranks(x: number[]): number[] {
  const idx = x.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const r = new Array(x.length).fill(0);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function pearson(a: number[], b: number[]): number {
  const n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let c = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return va && vb ? c / Math.sqrt(va * vb) : 0;
}
const normP = (z: number) => {
  // two-sided p from |z| (Abramowitz–Stegun)
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const one = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return Math.min(1, 2 * one);
};

export function lifestyleRiskMatrix(obs: ObsRow[], patients: PatientRow[]): RiskMatrix {
  const age = new Map(patients.filter((p) => p.latest_age !== null).map((p) => [p.medalia_patient_id, p.latest_age as number]));
  const cache = new Map<string, Map<string, number>>();
  const vals = (f: string) => { if (!cache.has(f)) cache.set(f, firstValues(obs, f)); return cache.get(f)!; };
  const cells = M_ROWS.map((r) => M_COLS.map((c): MatrixCell | null => {
    const a = vals(r.key), b = vals(c.key);
    const ids = [...a.keys()].filter((id) => b.has(id) && age.has(id));
    const n = ids.length;
    if (n < 10) return null;
    const ra = ranks(ids.map((id) => a.get(id)!)), rb = ranks(ids.map((id) => b.get(id)!)), rz = ranks(ids.map((id) => age.get(id)!));
    const rab = pearson(ra, rb), raz = pearson(ra, rz), rbz = pearson(rb, rz);
    const den = Math.sqrt((1 - raz ** 2) * (1 - rbz ** 2));
    const rho = den ? (rab - raz * rbz) / den : rab;
    const t = rho * Math.sqrt((n - 3) / Math.max(1e-9, 1 - rho * rho));
    return { rho, p: normP(t), n };
  }));
  return { rows: M_ROWS, cols: M_COLS, cells };
}

// ── self-reported change (feedback survey) ────────────────────────
export interface SurveyQ { id: string; section_index: number; order_index: number; question_type: string; label_is: string; options_jsonb: { value: string; label_is: string }[] | null }
export interface SurveyResp { assignment_id: string; question_id: string; value: string | null; values_array: string[] | null; skipped: boolean }

export interface SurveyChange {
  title: string;
  sent: number;
  completed: number;
  enough: boolean;
  change: { label: string; n: number; dist: number[]; optionLabels: string[]; better: number }[]; // dist index 0 = value 5
  lifeline: { label: string; n: number; dist: number[]; optionLabels: string[]; top2: number } | null;
  madeChanges: { label: string; n: number; of: number }[];
  nps: number | null;
}

const SHORT: [RegExp, string][] = [
  [/heilsu þína/i, "Heilsa almennt"], [/hreyfi/i, "Hreyfing"], [/matar/i, "Mataræði"],
  [/svefn/i, "Svefn"], [/andleg/i, "Andleg líðan"], [/orka/i, "Orka"],
];

export function surveyChange(title: string, sent: number, questions: SurveyQ[], responses: SurveyResp[]): SurveyChange {
  const completedIds = new Set(responses.map((r) => r.assignment_id));
  const completed = completedIds.size;
  const enough = completed >= MIN_SURVEY_N;
  const out: SurveyChange = { title, sent, completed, enough, change: [], lifeline: null, madeChanges: [], nps: null };
  if (!enough) return out;
  const answered = (qid: string) => responses.filter((r) => r.question_id === qid && !r.skipped && (r.value || r.values_array?.length));
  const firstSection = Math.min(...questions.map((q) => q.section_index));
  for (const q of questions) {
    const rs = answered(q.id);
    if (q.question_type === "likert5") {
      const dist = [5, 4, 3, 2, 1].map((v) => rs.filter((r) => Number(r.value) === v).length);
      const optionLabels = [5, 4, 3, 2, 1].map((v) => q.options_jsonb?.find((o) => o.value === String(v))?.label_is ?? String(v));
      if (/lifeline/i.test(q.label_is)) {
        out.lifeline = { label: q.label_is, n: rs.length, dist, optionLabels, top2: rs.length ? (dist[0] + dist[1]) / rs.length : 0 };
      } else if (q.section_index === firstSection) {
        const short = SHORT.find(([re]) => re.test(q.label_is))?.[1] ?? q.label_is;
        out.change.push({ label: short, n: rs.length, dist, optionLabels, better: rs.length ? (dist[0] + dist[1]) / rs.length : 0 });
      }
    } else if (q.question_type === "multiselect" && q.section_index === firstSection && out.madeChanges.length === 0) {
      const counts = new Map<string, number>();
      for (const r of rs) for (const v of r.values_array || []) counts.set(v, (counts.get(v) || 0) + 1);
      out.madeChanges = (q.options_jsonb || [])
        .map((o) => ({ label: o.label_is, n: counts.get(o.value) || 0, of: completed }))
        .filter((x) => !/ekki gert breytingar/i.test(x.label))
        .sort((a, b) => b.n - a.n);
    } else if (q.question_type === "nps10" && out.nps === null) {
      const v = rs.map((r) => Number(r.value)).filter((x) => !Number.isNaN(x));
      if (v.length) out.nps = Math.round(((v.filter((x) => x >= 9).length - v.filter((x) => x <= 6).length) / v.length) * 100);
    }
  }
  return out;
}

// Everything the Clinical overview cards + the comprehensive report need.
export interface CohortInsights {
  cohortName: string;
  exportedAt: string | null;
  result: BeforeAfterResult;
  profile: ProfileItem[];
  pillars: PillarScore[];
  habits: HabitFact[];
  matrix: RiskMatrix;
  survey: SurveyChange | null;
  subScores: Record<string, SubScore[]>;
  comparison: DatasetComparison;
  habitShift: HabitShift[];
}

// ── sub-scores (all 0–10, higher is better) ───────────────────────
export interface SubScore { label: string; mean: number; n: number; below6: number }
export const SUBSCORES: Record<string, { label: string; feature: string }[]> = {
  sleep: [
    { label: "Svefnvenjur", feature: "lifeline_health_sleep_behaviour_score" },
    { label: "Læknisfræðilegir þættir (til dæmis kæfisvefn og verkir)", feature: "lifeline_health_sleep_medical_score" },
  ],
  exercise: [
    { label: "Hreyfivenjur", feature: "lifeline_health_exercise_behavioural_score" },
    { label: "Læknisfræðilegir þættir (verkir, sjúkdómar)", feature: "lifeline_health_exercise_medical_score" },
  ],
  nutrition: [
    { label: "Matarvenjur", feature: "lifeline_health_nutrition_behavioural_score" },
    { label: "Læknisfræðilegir þættir (melting, óþol)", feature: "lifeline_health_nutrition_medical_score" },
    { label: "Matarhegðun", feature: "lifeline_health_food_addiction_1_10" },
  ],
  mental: [
    { label: "Andleg heilsa (einkenni þunglyndis)", feature: "lifeline_health_depression_score_1_10" },
    { label: "Streita (einkenni kvíða)", feature: "lifeline_health_anxiety_score_1_10" },
    { label: "Almenn vellíðan", feature: "pwi" },
    { label: "Skjánotkun", feature: "lifeline_health_screen_use_1_10" },
  ],
  body: [
    { label: "Lífsstílseinkunn", feature: "lifstilseinkunn" },
    { label: "Nikótín", feature: "lifeline_health_nicotine_use_1_10" },
    { label: "Áfengi", feature: "lifeline_health_alcohol_addiction_1_10" },
    { label: "Koffín", feature: "lifeline_health_caffine_score" },
  ],
};
export function subScores(obs: ObsRow[]): Record<string, SubScore[]> {
  const out: Record<string, SubScore[]> = {};
  for (const [area, defs] of Object.entries(SUBSCORES)) {
    out[area] = defs.map((d) => {
      const v = [...firstValues(obs, d.feature).values()];
      return { label: d.label, mean: mean(v) ?? 0, n: v.length, below6: v.filter((x) => x < 6).length };
    }).filter((s) => s.n >= MIN_SURVEY_N);
  }
  return out;
}

// Which reported lifestyle changes (follow-up survey multiselect) belong to
// which foundation — matched on the option text.
export const CHANGE_PILLAR: [RegExp, string][] = [
  [/hreyfi|styrktar/i, "exercise"],
  [/borða|mat|prótein|sykri/i, "nutrition"],
  [/sef |svefn/i, "sleep"],
  [/andleg/i, "mental"],
  [/áfengi|nikótín/i, "substances"],
];

// ── dataset comparison (what each uploaded data set actually contains) ──
export interface DatasetInfo { id: string; label: string; timepoint: string; from: string | null; to: string | null; patients: number; variables: number }
export interface CoverageRow { key: string; label: string; counts: number[]; examples: string[]; names: string[][] }   // names[i] = variables in data set i
export interface DatasetComparison { datasets: DatasetInfo[]; coverage: CoverageRow[]; inBoth: number }

const DOMAIN_IS: [string, string][] = [
  ["body", "Líkamsmælingar og samsetning"], ["cardio", "Blóðþrýstingur og hjartaáhætta"], ["metabolic", "Blóðprufur"],
  ["sleep", "Svefn"], ["exercise", "Hreyfing"], ["nutrition", "Næring"], ["mental", "Andleg líðan"],
  ["addiction", "Nikótín, áfengi, koffín og skjár"],
];
const FEATURE_IS: Record<string, string> = {
  weight: "þyngd", bmi: "BMI", height: "hæð", bp_systolic_avg: "efri mörk blóðþrýstings", bp_diastolic_avg: "neðri mörk blóðþrýstings",
  fat_mass_percent: "fituhlutfall", fat_mass_kg: "fitumassi", skeletal_muscle_mass_kg: "vöðvamassi", skeletal_muscle_mass_percent: "vöðvahlutfall",
  hba1c: "HbA1c", homa_ir: "insúlínviðnám", glucose: "blóðsykur", insulin: "insúlín", total_cholesterol: "kólesteról", hdl_cholesterol: "HDL",
  triglycerides: "þríglýseríð", alt: "ALAT", ast: "ASAT", metabolic_health: "efnaskiptaheilsa", heart_health_score_2: "SCORE2", lifeline_health_diabetic: "sykursýki",
  // foundations — the row already names the area, so only the compartment
  lifeline_health_sleep_behaviour_score: "venjur", lifeline_health_sleep_medical_score: "læknisfræðilegir þættir",
  lifeline_health_exercise_behavioural_score: "venjur", lifeline_health_exercise_medical_score: "læknisfræðilegir þættir",
  lifeline_health_nutrition_behavioural_score: "venjur", lifeline_health_nutrition_medical_score: "læknisfræðilegir þættir",
  phq9: "PHQ-9", phq2: "PHQ-2", lifeline_health_anxiety_gad_7: "GAD-7", lifeline_health_anxiety_gad_2: "GAD-2", pwi: "almenn vellíðan",
  lifeline_health_depression_score_1_10: "andleg heilsa", lifeline_health_anxiety_score_1_10: "streita", lifstilseinkunn: "lífsstílseinkunn",
  lifeline_health_nicotine_use_1_10: "nikótín", lifeline_health_nicotine_use: "nikótínnotkun (já/nei)", lifeline_health_alcohol_addiction_1_10: "áfengi", lifeline_health_audit_10: "AUDIT-10", lifeline_health_audit_c: "AUDIT-C",
  lifeline_health_caffine_score: "koffín", lifeline_health_cudq_5_score: "CUDQ-5", lifeline_health_food_addiction_1_10: "matarhegðun", lifeline_health_beds_7: "BEDS-7",
  lifeline_health_screen_use_1_10: "skjánotkun", lifeline_health_screen_use_cius_5: "CIUS-5", lifeline_health_screen_use_cius_14: "CIUS-14",
  svefn_total: "heildareinkunn", hreyfing_total: "heildareinkunn", naering_total: "heildareinkunn", andlegt_total: "heildareinkunn", fikn_total: "heildareinkunn",
  lifeline_health_gambling_1_10: "fjárhættuspil", lifeline_health_gambling_pgsi: "PGSI", lifeline_health_other_substance_addiction_1_10: "önnur efni", lifeline_health_assist_other_substances: "ASSIST",
};

export function datasetComparison(
  obs: (ObsRow & { export_id: string })[],
  exports: { id: string; timepoint_label: string; timepoint_order?: number | null }[],
  domainOf: (feature: string) => string,
): DatasetComparison {
  const ordered = [...exports].sort((a, b) => (a.timepoint_order ?? 0) - (b.timepoint_order ?? 0));
  const IGNORE = new Set(["bp_systolic", "bp_diastolic", "blood_pressure_panel"]); // panel components duplicate the averages
  const datasets = ordered.map((e, i) => {
    const rows = obs.filter((o) => o.export_id === e.id && o.value_num !== null);   // yes/no answers are not measurements
    const dates = rows.map((o) => o.observed_at).filter((d): d is string => !!d).sort();
    const feats = new Set(rows.filter((o) => !IGNORE.has(o.feature)).map((o) => o.feature));
    return { id: e.id, label: `Gagnasett ${i + 1}`, timepoint: e.timepoint_label, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null, patients: new Set(rows.map((o) => o.medalia_patient_id)).size, variables: feats.size, feats };
  });
  const coverage = DOMAIN_IS.map(([key, label]) => {
    const counts = datasets.map((d) => [...d.feats].filter((f) => domainOf(f) === key).length);
    const last = datasets[datasets.length - 1];
    const examples = last ? [...last.feats].filter((f) => domainOf(f) === key).filter((f) => f !== "height").map((f) => FEATURE_IS[f] ?? f).filter((x) => !x.includes("_")) : [];
    const names = datasets.map((d) => [...d.feats].filter((f) => domainOf(f) === key).map((f) => FEATURE_IS[f] ?? f.replace(/^lifeline_health_/, "").replace(/_/g, " ")).sort());
    return { key, label, counts, examples, names };
  }).filter((r) => r.counts.some((c) => c > 0));
  const sets = datasets.map((d) => new Set(obs.filter((o) => o.export_id === d.id).map((o) => o.medalia_patient_id)));
  const inBoth = sets.length >= 2 ? [...sets[0]].filter((p) => sets.slice(1).some((s) => s.has(p))).length : 0;
  return { datasets: datasets.map(({ feats: _f, ...d }) => { void _f; return d; }), coverage, inBoth };
}
