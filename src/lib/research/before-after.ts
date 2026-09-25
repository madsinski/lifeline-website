// Before / after — per-patient first vs last measurement BY DATE within one
// Medalia export. A Medalia export carries each patient's full history, so a
// single export is enough: for every patient × feature we take the earliest
// and the latest observation (same-day repeats averaged) and require the two
// to be at least MIN_GAP_DAYS apart. This is independent of the timepoint
// model used by the Longitudinal tab (which compares separate uploads).
//
// Subgroups are defined on BASELINE values (e.g. high blood pressure at the
// first visit), so the split can't be driven by the follow-up itself.
//
// Pure functions — the route loads rows from research_observations /
// research_patients and passes them in.

import { pairedTTest, wilcoxonSignedRank } from "./stats";
import { featureDirection, canonicalUnit } from "./clinical";

export const MIN_GAP_DAYS = 14;

export interface ObsRow {
  medalia_patient_id: string;
  feature: string;
  observed_at: string | null;
  value_num: number | null;
}
export interface PatientRow {
  medalia_patient_id: string;
  gender: string | null;
  latest_age: number | null;
  group_name: string | null;
}

// Icelandic labels for the report + tab. Anything not listed falls back to
// the observation's display text.
export const LABEL_IS: Record<string, string> = {
  weight: "Þyngd",
  bmi: "Líkamsþyngdarstuðull (BMI)",
  bp_systolic_avg: "Blóðþrýstingur, efri mörk",
  bp_diastolic_avg: "Blóðþrýstingur, neðri mörk",
  fat_mass_percent: "Fituhlutfall",
  fat_mass_kg: "Fitumassi",
  skeletal_muscle_mass_kg: "Vöðvamassi",
  skeletal_muscle_mass_percent: "Vöðvahlutfall",
  hba1c: "Langtímablóðsykur (HbA1c)",
  glucose: "Blóðsykur",
  insulin: "Insúlín",
  homa_ir: "Insúlínviðnám (HOMA-IR)",
  total_cholesterol: "Heildarkólesteról",
  hdl_cholesterol: "HDL-kólesteról",
  triglycerides: "Þríglýseríð",
  alt: "Lifrarensím (ALAT)",
  ast: "Lifrarensím (ASAT)",
  heart_health_score_2: "Hjartaáhætta (SCORE2)",
  lifstilseinkunn: "Lífsstílseinkunn",
  pwi: "Almenn vellíðan (PWI)",
  phq9: "Þunglyndiseinkenni (PHQ-9)",
  phq2: "Þunglyndiseinkenni, skimun (PHQ-2)",
  lifeline_health_anxiety_gad_2: "Kvíðaeinkenni, skimun (GAD-2)",
  lifeline_health_depression_score_1_10: "Andleg heilsa (0–10)",
  lifeline_health_anxiety_score_1_10: "Streita (0–10)",
  lifeline_health_caffine_score: "Koffín (0–10)",
  lifeline_health_sleep_behaviour_score: "Svefnvenjur", lifeline_health_sleep_medical_score: "Svefn, læknisfræðilegir þættir",
  lifeline_health_exercise_behavioural_score: "Hreyfivenjur", lifeline_health_exercise_medical_score: "Hreyfing, læknisfræðilegir þættir",
  lifeline_health_nutrition_behavioural_score: "Matarvenjur", lifeline_health_nutrition_medical_score: "Næring, læknisfræðilegir þættir",
  lifeline_health_alcohol_addiction_1_10: "Áfengi (0–10)", lifeline_health_nicotine_use_1_10: "Nikótín (0–10)",
  lifeline_health_food_addiction_1_10: "Matarhegðun (0–10)", lifeline_health_screen_use_1_10: "Skjánotkun (0–10)",
  lifeline_health_screen_use_cius_5: "Skjánotkun, skimun (CIUS-5)", lifeline_health_screen_use_cius_14: "Skjánotkun (CIUS-14)",
  lifeline_health_other_substance_addiction_1_10: "Önnur efni (0–10)", lifeline_health_assist_other_substances: "Önnur efni (ASSIST)",
  lifeline_health_gambling_1_10: "Fjárhættuspil (0–10)", lifeline_health_gambling_pgsi: "Fjárhættuspil (PGSI)",
  lifeline_health_audit_c: "Áfengi, skimun (AUDIT-C)", lifeline_health_audit_10: "Áfengi (AUDIT-10)", lifeline_health_beds_7: "Átröskunareinkenni (BEDS-7)",
  lifeline_health_cudq_5_score: "Koffínnotkun (CUDQ-5)",
  lifeline_health_anxiety_gad_7: "Kvíðaeinkenni (GAD-7)",
};
const UNIT_IS: Record<string, string> = { weight: "kg", bp_systolic_avg: "mmHg", bp_diastolic_avg: "mmHg", fat_mass_kg: "kg", skeletal_muscle_mass_kg: "kg", fat_mass_percent: "%", skeletal_muscle_mass_percent: "%" };

// Display order: body & blood pressure first, then bloods, then scores.
const ORDER = Object.keys(LABEL_IS);
// Features that make no sense as before/after on their own.
const SKIP = new Set(["height", "bp_systolic", "bp_diastolic", "blood_pressure_panel"]);

// Weight is "neutral" clinically (depends on the person), but for a cohort
// whose aim is lifestyle change a loss is the intended direction. Shown with
// that caveat in the report.
function dir(feature: string): "up" | "down" | "neutral" {
  if (feature === "weight") return "down";
  return featureDirection(feature);
}

export interface Pair { pid: string; before: number; after: number; beforeAt: string; afterAt: string; days: number }

export interface MetricResult {
  feature: string;
  label: string;
  unit: string;
  direction: "up" | "down" | "neutral";
  n: number;
  before: number;
  after: number;
  delta: number;
  ci95: [number, number] | null;
  p: number | null;          // headline p: Wilcoxon signed-rank, t-test when n is too small for it
  pT: number | null;         // paired t-test (goes with ci95)
  pWilcoxon: number | null;
  improved: number;
  worsened: number;
  unchanged: number;
  significant: boolean;      // headline p < 0.05
  good: boolean | null;      // mean change in the healthy direction?
}

export interface Subgroup {
  key: string;
  label: string;
  short: string;             // compact label for charts
  n: number;
  metrics: MetricResult[];
}

export interface BeforeAfterResult {
  nPatients: number;
  nFollowed: number;
  medianDays: number | null;
  baselineRange: [string, string] | null;
  followupRange: [string, string] | null;
  metrics: MetricResult[];
  subgroups: Subgroup[];
  weightBands: { key: string; label: string; n: number }[];
  bpCategories: { before: Record<BpCat, number>; after: Record<BpCat, number>; improved: number; worsened: number; n: number } | null;
  excluded: { feature: string; label: string; reason: string }[];   // measured twice but NOT comparable
}

export type BpCat = "normal" | "elevated" | "high";
export const BP_CAT_LABEL: Record<BpCat, string> = { normal: "Eðlilegur", elevated: "Hækkaður", high: "Hár" };
export const BP_CAT_RANGE = "Eðlilegur: undir 130/85 · hækkaður: 130–139/85–89 · hár: 140/90 eða hærri";
const bpCat = (s: number, d: number): BpCat => (s >= 140 || d >= 90 ? "high" : s >= 130 || d >= 85 ? "elevated" : "normal");

const day = (iso: string) => iso.slice(0, 10);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

/** Per patient × feature: earliest and latest day-averaged value, ≥ MIN_GAP_DAYS apart. */
export function buildPairs(obs: ObsRow[]): Map<string, Map<string, Pair>> {
  const acc = new Map<string, Map<string, Map<string, number[]>>>(); // feature → pid → day → values
  for (const o of obs) {
    if (o.value_num === null || !o.observed_at || SKIP.has(o.feature)) continue;
    if (!acc.has(o.feature)) acc.set(o.feature, new Map());
    const byP = acc.get(o.feature)!;
    if (!byP.has(o.medalia_patient_id)) byP.set(o.medalia_patient_id, new Map());
    const byD = byP.get(o.medalia_patient_id)!;
    const k = day(o.observed_at);
    if (!byD.has(k)) byD.set(k, []);
    byD.get(k)!.push(o.value_num);
  }
  const out = new Map<string, Map<string, Pair>>();
  for (const [feature, byP] of acc) {
    const pairs = new Map<string, Pair>();
    for (const [pid, byD] of byP) {
      const days = [...byD.keys()].sort();
      if (days.length < 2) continue;
      const first = days[0], last = days[days.length - 1];
      const gap = Math.round((Date.parse(last) - Date.parse(first)) / 86400000);
      if (gap < MIN_GAP_DAYS) continue;
      pairs.set(pid, { pid, before: mean(byD.get(first)!), after: mean(byD.get(last)!), beforeAt: first, afterAt: last, days: gap });
    }
    if (pairs.size) out.set(feature, pairs);
  }
  return out;
}

function summarise(feature: string, pairs: Pair[], displayFallback?: string): MetricResult | null {
  if (pairs.length < 3) return null;
  const deltas = pairs.map((p) => p.after - p.before);
  const t = pairedTTest(deltas);
  const w = wilcoxonSignedRank(deltas);
  const d = dir(feature);
  const isGood = (x: number) => (d === "up" ? x > 0 : d === "down" ? x < 0 : false);
  const isBad = (x: number) => (d === "up" ? x < 0 : d === "down" ? x > 0 : false);
  const delta = mean(deltas);
  return {
    feature,
    label: LABEL_IS[feature] ?? displayFallback ?? feature,
    unit: UNIT_IS[feature] ?? canonicalUnit(feature) ?? "",
    direction: d,
    n: pairs.length,
    before: mean(pairs.map((p) => p.before)),
    after: mean(pairs.map((p) => p.after)),
    delta,
    ci95: t ? t.ci95 : null,
    // Small, skewed subgroups (a few large losses) → the rank test is the
    // primary test; the t-test only backs the confidence interval.
    p: w ? w.p : t ? t.p : null,
    pT: t ? t.p : null,
    pWilcoxon: w ? w.p : null,
    improved: deltas.filter(isGood).length,
    worsened: deltas.filter(isBad).length,
    unchanged: deltas.filter((x) => !isGood(x) && !isBad(x)).length,
    significant: (w ? w.p : t ? t.p : 1) < 0.05,
    good: d === "neutral" || delta === 0 ? null : isGood(delta),
  };
}

const sortFeatures = (a: string, b: string) => {
  const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
  return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
};

// ---------------------------------------------------------------------------
// Comparability. A score measured at both time points is only comparable if
// the SAME questions produced it both times.
//  - Invariant check (data-driven): PHQ-9 contains the PHQ-2 items and GAD-7
//    the GAD-2 items, so a follow-up PHQ-9 < PHQ-2 (or GAD-7 < GAD-2) on the
//    same day proves the full instrument was not administered and the value
//    is a default. Then PHQ-9/GAD-7 and the 0–10 scores derived from them
//    (depression / stress) are not comparable; PHQ-2/GAD-2 still are.
//    (Seen in the Vestmannaeyjabær follow-up, 2026-06: only PHQ-2/GAD-2 asked.)
//  - Known questionnaire revisions: the caffeine section was rewritten in the
//    2026-06 Heilsumat version ("3–4 daga í viku" → "Neytir þú koffíns?" +
//    drinks/day), so the caffeine/CUDQ scores changed meaning.
// ---------------------------------------------------------------------------
const INSTRUMENT_PAIRS: { short: string; full: string; derived: string[]; reason: string }[] = [
  { short: "phq2", full: "phq9", derived: ["lifeline_health_depression_score_1_10"], reason: "Í eftirfylgni var aðeins spurt PHQ-2 en ekki allra PHQ-9 spurninganna; notið PHQ-2 til samanburðar." },
  { short: "lifeline_health_anxiety_gad_2", full: "lifeline_health_anxiety_gad_7", derived: ["lifeline_health_anxiety_score_1_10"], reason: "Í eftirfylgni var aðeins spurt GAD-2 en ekki allra GAD-7 spurninganna; notið GAD-2 til samanburðar." },
];
const QUESTIONNAIRE_REVISED: Record<string, string> = {
  lifeline_health_caffine_score: "Spurningum um koffín var breytt á milli mælinga.",
  lifeline_health_cudq_5_score: "Spurningum um koffín var breytt á milli mælinga.",
};

function notComparable(obs: ObsRow[], pairs: Map<string, Map<string, Pair>>): Map<string, string> {
  const out = new Map<string, string>(Object.entries(QUESTIONNAIRE_REVISED).filter(([f]) => pairs.has(f)));
  const onDay = new Map<string, number>(); // `${pid}|${feature}|${day}` → value
  for (const o of obs) if (o.value_num !== null && o.observed_at) onDay.set(`${o.medalia_patient_id}|${o.feature}|${day(o.observed_at)}`, o.value_num);
  for (const ip of INSTRUMENT_PAIRS) {
    const full = pairs.get(ip.full);
    if (!full) continue;
    const broken = [...full.values()].some((p) => {
      const short = onDay.get(`${p.pid}|${ip.short}|${p.afterAt}`);
      return short !== undefined && p.after < short;
    });
    if (broken) for (const f of [ip.full, ...ip.derived]) if (pairs.has(f)) out.set(f, ip.reason);
  }
  return out;
}

export function computeBeforeAfter(obs: ObsRow[], patients: PatientRow[], displayOf: Record<string, string> = {}): BeforeAfterResult {
  const pairs = buildPairs(obs);
  const invalid = notComparable(obs, pairs);
  const features = [...pairs.keys()].filter((f) => dir(f) !== "neutral" && !invalid.has(f)).sort(sortFeatures);

  const metricsFor = (pids: Set<string> | null) =>
    features
      .map((f) => summarise(f, [...pairs.get(f)!.values()].filter((p) => !pids || pids.has(p.pid)), displayOf[f]))
      .filter((m): m is MetricResult => !!m);

  const metrics = metricsFor(null);

  const followed = new Set<string>();
  const allDays: number[] = [];
  const firstDates: string[] = [], lastDates: string[] = [];
  for (const f of features) for (const p of pairs.get(f)!.values()) {
    followed.add(p.pid);
  }
  // one gap per patient: their widest pair
  const widest = new Map<string, Pair>();
  for (const f of features) for (const p of pairs.get(f)!.values()) {
    const cur = widest.get(p.pid);
    if (!cur || p.days > cur.days) widest.set(p.pid, p);
  }
  for (const p of widest.values()) { allDays.push(p.days); firstDates.push(p.beforeAt); lastDates.push(p.afterAt); }
  firstDates.sort(); lastDates.sort();

  // ---- subgroups (defined on baseline values) ----
  const base = (f: string, pid: string) => pairs.get(f)?.get(pid)?.before ?? null;
  const pidsWhere = (pred: (pid: string) => boolean | null) => new Set([...followed].filter((pid) => pred(pid) === true));
  const defs: { key: string; label: string; short: string; pids: Set<string> }[] = [];
  const hasBp = (pid: string) => base("bp_systolic_avg", pid) !== null && base("bp_diastolic_avg", pid) !== null;
  if (pairs.has("bp_systolic_avg")) {
    defs.push({ key: "bp_high", label: "Háþrýstingur við upphaf (≥140/90)", short: "Háþrýstingur", pids: pidsWhere((pid) => hasBp(pid) && (base("bp_systolic_avg", pid)! >= 140 || base("bp_diastolic_avg", pid)! >= 90)) });
    defs.push({ key: "bp_ok", label: "Blóðþrýstingur undir 140/90 við upphaf", short: "BÞ undir 140/90", pids: pidsWhere((pid) => hasBp(pid) && base("bp_systolic_avg", pid)! < 140 && base("bp_diastolic_avg", pid)! < 90) });
  }
  if (pairs.has("bmi")) {
    defs.push({ key: "bmi_30", label: "Offita við upphaf (BMI ≥30)", short: "BMI ≥30", pids: pidsWhere((pid) => base("bmi", pid) !== null && base("bmi", pid)! >= 30) });
    defs.push({ key: "bmi_25", label: "Ofþyngd við upphaf (BMI 25–30)", short: "BMI 25–30", pids: pidsWhere((pid) => base("bmi", pid) !== null && base("bmi", pid)! >= 25 && base("bmi", pid)! < 30) });
    defs.push({ key: "bmi_lt25", label: "Kjörþyngd við upphaf (BMI <25)", short: "BMI undir 25", pids: pidsWhere((pid) => base("bmi", pid) !== null && base("bmi", pid)! < 25) });
  }
  const pById = new Map(patients.map((p) => [p.medalia_patient_id, p]));
  const groups = [...new Set(patients.map((p) => p.group_name).filter((g): g is string => !!g))];
  if (groups.length > 1) for (const g of groups) {
    defs.push({ key: `group:${g}`, label: g.split(" - ")[0], short: g.split(" - ")[0], pids: pidsWhere((pid) => pById.get(pid)?.group_name === g) });
  }
  const genders = [...new Set(patients.map((p) => p.gender).filter((g): g is string => !!g))];
  if (genders.length > 1) for (const g of genders) {
    defs.push({ key: `gender:${g}`, label: g === "female" ? "Konur" : g === "male" ? "Karlar" : g, short: g === "female" ? "Konur" : g === "male" ? "Karlar" : g, pids: pidsWhere((pid) => pById.get(pid)?.gender === g) });
  }
  const subgroups = defs
    .filter((d) => d.pids.size >= 3)
    .map((d) => ({ key: d.key, label: d.label, short: d.short, n: d.pids.size, metrics: metricsFor(d.pids) }));

  // ---- weight-change bands (percent of starting weight) ----
  const wPairs = [...(pairs.get("weight")?.values() ?? [])];
  const pct = wPairs.map((p) => ((p.after - p.before) / p.before) * 100);
  const weightBands = wPairs.length
    ? [
        { key: "lost5", label: "Léttust um 5% eða meira", n: pct.filter((x) => x <= -5).length },
        { key: "lost2", label: "Léttust um 2–5%", n: pct.filter((x) => x > -5 && x <= -2).length },
        { key: "stable", label: "Stöðug þyngd (±2%)", n: pct.filter((x) => x > -2 && x < 2).length },
        { key: "gain2", label: "Þyngdust um 2–5%", n: pct.filter((x) => x >= 2 && x < 5).length },
        { key: "gain5", label: "Þyngdust um 5% eða meira", n: pct.filter((x) => x >= 5).length },
      ]
    : [];

  // ---- blood-pressure category shift ----
  let bpCategories: BeforeAfterResult["bpCategories"] = null;
  const sys = pairs.get("bp_systolic_avg"), dia = pairs.get("bp_diastolic_avg");
  if (sys && dia) {
    const before: Record<BpCat, number> = { normal: 0, elevated: 0, high: 0 };
    const after: Record<BpCat, number> = { normal: 0, elevated: 0, high: 0 };
    const rank: Record<BpCat, number> = { normal: 0, elevated: 1, high: 2 };
    let improved = 0, worsened = 0, n = 0;
    for (const [pid, s] of sys) {
      const d = dia.get(pid);
      if (!d) continue;
      const b = bpCat(s.before, d.before), a = bpCat(s.after, d.after);
      before[b]++; after[a]++; n++;
      if (rank[a] < rank[b]) improved++; else if (rank[a] > rank[b]) worsened++;
    }
    if (n) bpCategories = { before, after, improved, worsened, n };
  }

  return {
    nPatients: patients.length,
    nFollowed: followed.size,
    medianDays: median(allDays),
    baselineRange: firstDates.length ? [firstDates[0], firstDates[firstDates.length - 1]] : null,
    followupRange: lastDates.length ? [lastDates[0], lastDates[lastDates.length - 1]] : null,
    metrics,
    subgroups,
    weightBands,
    bpCategories,
    excluded: [...invalid].map(([feature, reason]) => ({ feature, label: LABEL_IS[feature] ?? displayOf[feature] ?? feature, reason })),
  };
}

// ---------------------------------------------------------------------------
// Baseline profile — what the health check found, as the share of
// participants over standard clinical thresholds at their FIRST measurement.
// Deliberately clinical (not Lifeline's stricter "optimal" bands in FLAGS) so
// an employer reads "high blood pressure" the way a doctor would.
// ---------------------------------------------------------------------------
export interface ProfileItem { key: string; label: string; threshold: string; n: number; of: number }

export function baselineProfile(obs: ObsRow[]): ProfileItem[] {
  // earliest-day value per patient × feature
  const first = new Map<string, Map<string, { day: string; vals: number[] }>>();
  for (const o of obs) {
    if (o.value_num === null || !o.observed_at) continue;
    if (!first.has(o.feature)) first.set(o.feature, new Map());
    const m = first.get(o.feature)!;
    const d = day(o.observed_at);
    const cur = m.get(o.medalia_patient_id);
    if (!cur || d < cur.day) m.set(o.medalia_patient_id, { day: d, vals: [o.value_num] });
    else if (d === cur.day) cur.vals.push(o.value_num);
  }
  const val = (f: string) => new Map([...(first.get(f) ?? new Map()).entries()].map(([pid, v]) => [pid, mean(v.vals)]));
  const count = (f: string, pred: (v: number) => boolean) => {
    const m = val(f);
    return { n: [...m.values()].filter(pred).length, of: m.size };
  };
  const items: ProfileItem[] = [];
  const push = (key: string, label: string, threshold: string, c: { n: number; of: number }) => { if (c.of >= 5) items.push({ key, label, threshold, ...c }); };

  push("overweight", "Ofþyngd eða offita", "BMI 25 eða hærra", count("bmi", (v) => v >= 25));
  push("obese", "Offita", "BMI 30 eða hærra", count("bmi", (v) => v >= 30));
  // high BP needs both averages
  const sys = val("bp_systolic_avg"), dia = val("bp_diastolic_avg");
  const bpIds = [...sys.keys()].filter((pid) => dia.has(pid));
  if (bpIds.length >= 5) items.push({ key: "bp_high", label: "Háþrýstingur", threshold: "140/90 mmHg eða hærra", n: bpIds.filter((pid) => sys.get(pid)! >= 140 || dia.get(pid)! >= 90).length, of: bpIds.length });
  push("insulin_res", "Insúlínviðnám", "HOMA-IR 2,5 eða hærra", count("homa_ir", (v) => v >= 2.5));
  push("hba1c", "Forstig sykursýki eða hærra", "HbA1c 42 mmól/mól eða hærra", count("hba1c", (v) => v >= 42));
  push("chol", "Hækkað kólesteról", "Heildarkólesteról 5,2 mmól/l eða hærra", count("total_cholesterol", (v) => v >= 5.2));
  // mental: either screen positive
  const phq = val("phq9"), gad = val("lifeline_health_anxiety_gad_7");
  const mIds = [...new Set([...phq.keys(), ...gad.keys()])];
  if (mIds.length >= 5) items.push({ key: "mental", label: "Einkenni þunglyndis eða kvíða", threshold: "PHQ-9 eða GAD-7 10 eða hærra", n: mIds.filter((pid) => (phq.get(pid) ?? 0) >= 10 || (gad.get(pid) ?? 0) >= 10).length, of: mIds.length });
  push("exercise", "Hreyfing undir viðmiðum", "Hreyfivenjur undir 5 af 10", count("lifeline_health_exercise_behavioural_score", (v) => v < 5));
  return items;
}
