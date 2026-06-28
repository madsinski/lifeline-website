// Clinical configuration for the research module: how raw features map to
// decision-relevant domains, their DIRECTION (is higher or lower better?),
// canonical units, reference ranges, and the threshold-based "flags" whose
// prevalence is worth surfacing and tracking over time.
//
// Direction matters: a drop in HbA1c / BP / PHQ-9 is an improvement, while a
// rise in HDL / muscle mass / a wellness score is an improvement. Directions
// below were verified empirically against the baseline data (e.g. every *_1_10
// wellness score is the inverse of its raw instrument, r≈-1.0; and
// heart_health_score_2 rises with age/BP/HbA1c, so it is a RISK score —
// lower is better — despite its name).
//
// Feature names match the parse engine (src/lib/research/parse.ts): lab/measure
// codes get friendly names (hba1c, bmi, ...); questionnaire scores keep their
// raw code (phq9, lifeline_health_anxiety_gad_7, ...).

// Domains are split into the FOUR HEALTH FOUNDATIONS we actively coach
// (sleep, exercise, nutrition, mental wellness — which includes addiction) and
// the DOWNSTREAM outcomes we expect those lifestyle changes to move (labs,
// cardiovascular, body composition).
export type Domain =
  | "sleep" | "exercise" | "nutrition" | "mental" | "addiction"   // foundations
  | "metabolic" | "cardio" | "body"                               // downstream
  | "other";

export const DOMAIN_LABELS: Record<Domain, string> = {
  sleep: "Sleep",
  exercise: "Exercise",
  nutrition: "Nutrition",
  mental: "Mental wellness",
  addiction: "Addiction",
  metabolic: "Metabolic & labs",
  cardio: "Cardiovascular",
  body: "Body composition",
  other: "Other",
};

// Grouping for the UI: foundations (what we coach) shown first, then the
// downstream measurements we expect them to change.
export interface DomainGroup { key: string; label: string; sublabel: string; domains: Domain[]; }
export const DOMAIN_GROUPS: DomainGroup[] = [
  { key: "foundations", label: "Health foundations", sublabel: "what we coach", domains: ["sleep", "exercise", "nutrition", "mental", "addiction"] },
  { key: "outcomes", label: "Downstream measurements", sublabel: "what we expect coaching to change", domains: ["metabolic", "cardio", "body"] },
  { key: "other", label: "Other", sublabel: "", domains: ["other"] },
];

export const DOMAIN_ORDER: Domain[] = DOMAIN_GROUPS.flatMap((g) => g.domains);

export function featureDomain(feature: string): Domain {
  const f = feature.toLowerCase();
  // foundations
  if (/(sleep|svefn)/.test(f)) return "sleep";
  if (/(exercise|hreyfing)/.test(f)) return "exercise";
  if (/(nutrition|naering)/.test(f)) return "nutrition";
  // caffine_score is mislabelled in the source — it is the cannabis (CUDQ-5) score.
  if (/(audit|alcohol|nicotine|gambling|pgsi|cudq|caffine|beds|food_addiction|other_substance|assist|fikn|screen_use|cius)/.test(f)) return "addiction";
  if (/(phq|gad|anxiety|depression|andlegt|pwi)/.test(f)) return "mental";
  // downstream
  if (/(hba1c|glucose|insulin|homa|cholesterol|triglyc|hdl|\balt\b|\bast\b|metabolic_health|diabetic)/.test(f)) return "metabolic";
  if (/(bp_|blood_pressure|heart_health)/.test(f)) return "cardio";
  if (/(bmi|weight|height|fat_mass|skeletal_muscle)/.test(f)) return "body";
  return "other";
}

// ---------------------------------------------------------------------------
// DIRECTION — is a HIGHER value better ("up"), a LOWER value better ("down"),
// or neither ("neutral", e.g. height/weight on their own)?
// ---------------------------------------------------------------------------
export type Direction = "up" | "down" | "neutral";

const HIGHER_BETTER = new Set<string>([
  "hdl_cholesterol", "metabolic_health",
  "skeletal_muscle_mass_kg", "skeletal_muscle_mass_percent",
  "pwi", "lifstilseinkunn",
  "svefn_total", "naering_total", "andlegt_total", "fikn_total", "hreyfing_total",
  "lifeline_health_caffine_score",
]);
const LOWER_BETTER = new Set<string>([
  "phq9", "phq2", "lifeline_health_anxiety_gad_7", "lifeline_health_anxiety_gad_2",
  "lifeline_health_audit_c", "lifeline_health_audit_10", "lifeline_health_gambling_pgsi",
  "lifeline_health_cudq_5_score", "lifeline_health_screen_use_cius_5", "lifeline_health_screen_use_cius_14",
  "lifeline_health_beds_7", "lifeline_health_assist_other_substances",
  "hba1c", "glucose", "insulin", "homa_ir", "total_cholesterol", "triglycerides", "alt", "ast",
  "bmi", "bmi_ratio", "fat_mass_kg", "fat_mass_percent",
  "bp_systolic", "bp_diastolic", "bp_systolic_avg", "bp_diastolic_avg",
  "heart_health_score_2",           // verified: a cardiovascular RISK score → lower is better
  "lifeline_health_nicotine_use", "lifeline_health_diabetic",
]);
const NEUTRAL = new Set<string>(["height", "weight"]);

export function featureDirection(feature: string): Direction {
  if (LOWER_BETTER.has(feature)) return "down";
  if (HIGHER_BETTER.has(feature)) return "up";
  if (NEUTRAL.has(feature)) return "neutral";
  // heuristics for uncatalogued variants
  if (/_1_10$/.test(feature)) return "up";                       // lifeline wellness scores (10 = best)
  if (/_(medical|behaviour(al)?)_score$/.test(feature)) return "up"; // health sub-scores (note: sleep uses "behaviour", others "behavioural")
  if (/_total$/.test(feature)) return "up";
  if (/(phq|gad|audit|pgsi|cudq|cius|beds|assist)/.test(feature)) return "down";
  return "neutral";
}

/** Is a baseline→latest delta an improvement? null when direction is neutral/unknown or delta≈0. */
export function changeIsGood(feature: string, delta: number | null): boolean | null {
  if (delta === null || delta === 0) return null;
  const dir = featureDirection(feature);
  if (dir === "neutral") return null;
  return dir === "up" ? delta > 0 : delta < 0;
}

// ---------------------------------------------------------------------------
// CANONICAL UNITS — authoritative, correct units for measured features. Used
// for display so source inconsistencies (e.g. "mmol/l" vs "mmol/L", missing
// BMI unit on some rows) never surface. Questionnaire scores are dimensionless
// indices and intentionally have no unit.
// ---------------------------------------------------------------------------
export const CANONICAL_UNIT: Record<string, string> = {
  hba1c: "mmol/mol", glucose: "mmol/L", insulin: "mIU/L", homa_ir: "index",
  total_cholesterol: "mmol/L", hdl_cholesterol: "mmol/L", triglycerides: "mmol/L",
  alt: "U/L", ast: "U/L",
  bmi: "kg/m²", bmi_ratio: "kg/m²", height: "cm", weight: "kg",
  bp_systolic: "mmHg", bp_diastolic: "mmHg", bp_systolic_avg: "mmHg", bp_diastolic_avg: "mmHg",
  fat_mass_kg: "kg", fat_mass_percent: "%", skeletal_muscle_mass_kg: "kg", skeletal_muscle_mass_percent: "%",
};

export function canonicalUnit(feature: string, fallback?: string | null): string {
  return CANONICAL_UNIT[feature] ?? (fallback || "");
}

// ---------------------------------------------------------------------------
// REFERENCE RANGES — display-only notes (audited against standard cutoffs;
// Iceland uses IFCC HbA1c in mmol/mol and mmol/L lipids).
// ---------------------------------------------------------------------------
// Reference ranges UNIFIED with the Lifeline app (fhir-health-dashboard
// src/lib/bloodMarkers.ts + getBodyCompRange). "optimal" = green band; the
// upper value is the borderline (yellow) band. Sex-specific where the app is.
export const REFERENCE_NOTE: Record<string, string> = {
  hba1c: "Lifeline: optimal 20–39, borderline 39–46 mmol/mol (lower better)",
  glucose: "Lifeline: optimal 3.9–5.6, borderline 5.6–6.9 mmol/L (lower better)",
  insulin: "Lifeline: optimal 2–25 mIU/L (lower within range better)",
  homa_ir: "Lifeline: optimal <1.9, borderline 1.9–2.9 (lower better)",
  total_cholesterol: "Lifeline: optimal <5.2, borderline 5.2–6.2 mmol/L (lower better)",
  hdl_cholesterol: "Lifeline: optimal ≥1.0 (M) / ≥1.3 (F) mmol/L (higher better)",
  triglycerides: "Lifeline: optimal <1.7, borderline 1.7–2.3 mmol/L (lower better)",
  alt: "Lifeline: optimal ≤41 (M) / ≤33 (F) U/L (lower better)",
  ast: "Lifeline: optimal ≤40 (M) / ≤32 (F) U/L (lower better)",
  metabolic_health: "composite score — higher is better",
  bmi: "Lifeline: optimal <25, overweight 25–30, obese >30 (lower better)",
  fat_mass_percent: "Lifeline optimal: M 10–20%, F 18–28% (lower above optimal)",
  fat_mass_kg: "no universal range — track the trend",
  skeletal_muscle_mass_percent: "Lifeline optimal: M 40–44%, F 31–36% (higher better)",
  weight: "no universal range — track the trend",
  height: "reference measure",
  bp_systolic_avg: "Lifeline: optimal <120, borderline 120–139, high ≥140 mmHg",
  bp_diastolic_avg: "Lifeline: optimal <80, borderline 80–89, high ≥90 mmHg",
  bp_systolic: "Lifeline: optimal <120, borderline 120–139, high ≥140 mmHg",
  bp_diastolic: "Lifeline: optimal <80, borderline 80–89, high ≥90 mmHg",
  heart_health_score_2: "cardiovascular RISK score — lower is better",
  phq9: "0-4 none, 5-9 mild, 10-14 moderate, 15+ mod-severe (lower better)",
  phq2: "≥3 positive depression screen",
  lifeline_health_anxiety_gad_7: "0-4 none, 5-9 mild, 10-14 moderate, 15+ severe (lower better)",
  lifeline_health_anxiety_gad_2: "≥3 positive anxiety screen",
  lifeline_health_audit_c: "hazardous ≥4 (M) / ≥3 (F) — lower better",
  lifeline_health_audit_10: "hazardous ≥8, likely dependence ≥15 (lower better)",
  lifeline_health_gambling_pgsi: "low 1-2, moderate 3-7, problem ≥8 (lower better)",
  lifeline_health_cudq_5_score: "CUDQ-5 cannabis instrument — higher = more risk (lower better)",
  lifeline_health_caffine_score: "Cannabis 0–10 score (from CUDQ-5; source code is mislabelled \"caffine\") — higher is better",
  lifeline_health_other_substance_addiction_1_10: "Other substances 0–10 (from ASSIST) — higher is better",
  lifeline_health_depression_score_1_10: "Depression 0–10 (from PHQ-2 / PHQ-9) — higher is better",
  lifeline_health_anxiety_score_1_10: "Anxiety 0–10 (from GAD-2 / GAD-7) — higher is better",
  lifeline_health_screen_use_cius_5: "higher = more compulsive use (lower better)",
  lifeline_health_screen_use_cius_14: "higher = more compulsive use (lower better)",
  lifeline_health_beds_7: "BEDS-7 binge-eating screen — higher = more symptoms (lower better)",
  pwi: "Personal Wellness Index 0-10 — higher is better",
  lifstilseinkunn: "Lífstílseinkunn (Wellness Pulse) 0–10: good ≥7.5, fair 5–7.5, low <5 — summary of the four foundations",
};

// ---------------------------------------------------------------------------
// GATED QUESTIONNAIRES. Each family has a short GATE screener (asked of
// everyone), a longer FULL instrument (only administered when the screen is
// positive — so it is sparse BY DESIGN, "missing" = screened negative), and a
// unified 0–10 SCORE computed from whichever applies (gate or full). The 0–10
// score is the complete, analysis-ready measure for the whole cohort; the full
// instrument is for sub-analysis of the screen-positive subset only.
// ---------------------------------------------------------------------------
export interface GatedFamily { label: string; gate: string; full: string; score: string; }
// NOTE (verified against the data): PHQ-9 and GAD-7 are NOT gated by PHQ-2/GAD-2
// in the Lifeline questionnaire — the full instrument is administered to
// everyone (patients scoring PHQ-2/GAD-2 < 3 still completed PHQ-9/GAD-7), and
// PHQ-2/GAD-2 are just the first-2-item sub-scores. Only the substance/behaviour
// families and screen-use are actually gated.
export const GATED_FAMILIES: GatedFamily[] = [
  { label: "Alcohol", gate: "lifeline_health_audit_c", full: "lifeline_health_audit_10", score: "lifeline_health_alcohol_addiction_1_10" },
  { label: "Screen use", gate: "lifeline_health_screen_use_cius_5", full: "lifeline_health_screen_use_cius_14", score: "lifeline_health_screen_use_1_10" },
  // caffine_score is the cannabis (CUDQ-5) unified 0–10 score (source mislabel);
  // other_substance_addiction_1_10 is the ASSIST other-substances 0–10 score.
  { label: "Cannabis", gate: "lifeline_health_cudq_5_score", full: "lifeline_health_cudq_5_score", score: "lifeline_health_caffine_score" },
  { label: "Other substances", gate: "lifeline_health_assist_other_substances", full: "lifeline_health_assist_other_substances", score: "lifeline_health_other_substance_addiction_1_10" },
];
// Instruments that are conditional (sparse BY DESIGN, not data loss):
//  - full instruments asked only when their short screen is positive, and
//  - gate screeners themselves skipped by a "do you use X at all?" pre-gate.
//    Confirmed for alcohol: the pre-gate "Hversu oft færð þú þér áfengan drykk?"
//    answered "Aldrei" (Never) skips AUDIT-C entirely; the unified 0–10
//    "Áfengi - venjur" score is 10 (no problem) for those non-drinkers.
// NOTE: PHQ-9 and GAD-7 are deliberately NOT here — they are administered to
// everyone (verified: patients with PHQ-2/GAD-2 < 3 still completed the full
// instrument), so their coverage is complete, not conditional.
// Only the genuinely-sparse, gated full instruments (verified by coverage).
// PGSI and ASSIST are computed for everyone (=0 for non-users), so NOT here.
export const CONDITIONAL_FEATURES = new Set<string>([
  "lifeline_health_audit_c",                       // 43/51 — pre-gated: non-drinkers skip it
  "lifeline_health_audit_10",                      // 32/51 — gated by AUDIT-C
  "lifeline_health_cudq_5_score",                  // 41/51 — gated: cannabis non-users skip it
  "lifeline_health_screen_use_cius_14",            // 25/51 — gated by CIUS-5
  "lifeline_health_beds_7",                        // 21/51 — gated: non-bingers skip it
]);
export const isConditional = (feature: string): boolean => CONDITIONAL_FEATURES.has(feature);

// Verification that a unified score reflects an ACTUAL pre-gate answer (not a
// skipped section): a full-points score (e.g. alcohol = 10) is only trustworthy
// if the patient answered the pre-gate question. gateTextMatch is matched
// (case-insensitive substring) against the raw questionnaire question text;
// negativeAnswers are the Icelandic values meaning "no use" (→ full points).
export interface GatingRule { label: string; scores: string[]; gateTextMatch: string; negativeAnswers: string[]; }
export const GATING_RULES: GatingRule[] = [
  {
    label: "Alcohol",
    scores: ["lifeline_health_alcohol_addiction_1_10"],
    gateTextMatch: "áfengan drykk",                 // "Hversu oft færð þú þér áfengan drykk?"
    negativeAnswers: ["Aldrei"],
  },
  {
    label: "Nicotine",
    scores: ["lifeline_health_nicotine_use_1_10"],
    gateTextMatch: "notkun þinni á nikótín",        // "...hvað lýsir best notkun þinni á nikótín- eða tóbaksvörum"
    negativeAnswers: ["Ég hef aldrei notað nikótín eða tóbak", "Ég hætti fyrir meira en 12 mánuðum síðan"],
  },
  {
    label: "Gambling",
    scores: ["lifeline_health_gambling_1_10"],
    gateTextMatch: "spilað fjárhættuspil",          // "...hefur þú spilað fjárhættuspil á þann hátt..."
    negativeAnswers: ["Nei"],
  },
  {
    // One broad substance pre-gate covers cannabis (caffine_score) and ASSIST
    // other-substances: "Nei" skips the detailed items → full points.
    label: "Cannabis & other substances",
    scores: ["lifeline_health_caffine_score", "lifeline_health_other_substance_addiction_1_10"],
    gateTextMatch: "notað eitthvað af eftirfarandi til að takast",
    negativeAnswers: ["Nei"],
  },
  {
    label: "Disordered eating",
    scores: ["lifeline_health_food_addiction_1_10"],
    gateTextMatch: "borðir óhóflega mikið",         // "...hefur þú... upplifað að þú borðir óhóflega mikið..."
    negativeAnswers: ["Nei"],
  },
];
export function gatingForFeature(feature: string): GatingRule | null {
  return GATING_RULES.find((g) => g.scores.includes(feature)) ?? null;
}
// feature -> the family whose unified 0–10 score should be used instead
const SCORE_FOR: Record<string, string> = Object.fromEntries(
  GATED_FAMILIES.filter((g) => g.full !== g.score).map((g) => [g.full, g.score]),
);
export const unifiedScoreFor = (feature: string): string | null => SCORE_FOR[feature] ?? null;

/** Reference note with sensible fallbacks for the lifeline 0-10 sub-scores.
 *  "medical" sub-scores quantify medical problems/barriers that prevent optimal
 *  functioning in a category (low = more medical barriers); "behavioural"
 *  sub-scores reflect habits. Both run 0-10, higher = better. */
export function referenceNote(feature: string): string {
  const cond = isConditional(feature) ? " · conditional — skipped by a pre-screen (e.g. non-drinkers skip AUDIT-C); missing = no use. Use the unified 0–10 score" : "";
  if (REFERENCE_NOTE[feature]) return REFERENCE_NOTE[feature] + cond;
  const cat = /sleep|svefn/.test(feature) ? "sleep"
    : /exercise|hreyfing/.test(feature) ? "physical activity"
    : /nutrition|naering/.test(feature) ? "nutrition" : null;
  if (/_medical_score$/.test(feature))
    return cat ? `medical barriers to ${cat} — 0-10, higher = fewer medical issues limiting it` : "medical-barriers sub-score — 0-10, higher = fewer issues";
  if (/_behaviour(al)?_score$/.test(feature))
    return cat ? `${cat} habits & behaviours — 0-10, higher = healthier` : "behavioural sub-score — 0-10, higher is better";
  if (/_1_10$/.test(feature)) return "0-10 wellness scale — higher is better";
  if (/_total$/.test(feature)) return cat ? `${cat} overall — 0-10, higher is better` : "0-10 total — higher is better";
  return "";
}

// ---------------------------------------------------------------------------
// FLAGS — threshold prevalences we compute & track.
// ---------------------------------------------------------------------------
export interface FlagDef {
  key: string;
  label: string;
  domain: Domain;
  feature: string;
  cutoff?: number;
  genderCutoff?: { male: number; female: number };
  lowIsBad?: boolean;
  boolTrue?: boolean;
}

export const FLAGS: FlagDef[] = [
  // --- foundations (Lifeline 0-10 sub-scores; <6/10 = "needs attention". These
  //     are internal operational thresholds, not validated clinical cutoffs) ---
  { key: "sleep_med_low", label: "Medical issues impairing sleep (<6/10)", domain: "sleep", feature: "lifeline_health_sleep_medical_score", cutoff: 6, lowIsBad: true },
  { key: "sleep_beh_low", label: "Poor sleep habits — behavioural (<6/10)", domain: "sleep", feature: "lifeline_health_sleep_behaviour_score", cutoff: 6, lowIsBad: true },
  { key: "exer_med_low", label: "Medical issues limiting activity (<6/10)", domain: "exercise", feature: "lifeline_health_exercise_medical_score", cutoff: 6, lowIsBad: true },
  { key: "exer_beh_low", label: "Low activity — behavioural (<6/10)", domain: "exercise", feature: "lifeline_health_exercise_behavioural_score", cutoff: 6, lowIsBad: true },
  { key: "nutr_med_low", label: "Medical issues affecting nutrition (<6/10)", domain: "nutrition", feature: "lifeline_health_nutrition_medical_score", cutoff: 6, lowIsBad: true },
  { key: "nutr_beh_low", label: "Poor nutrition habits — behavioural (<6/10)", domain: "nutrition", feature: "lifeline_health_nutrition_behavioural_score", cutoff: 6, lowIsBad: true },
  // --- mental wellness ---
  { key: "phq9_mod", label: "Moderate+ depression (PHQ-9 ≥10)", domain: "mental", feature: "phq9", cutoff: 10 },
  { key: "gad7_mod", label: "Moderate+ anxiety (GAD-7 ≥10)", domain: "mental", feature: "lifeline_health_anxiety_gad_7", cutoff: 10 },
  { key: "pwi_low", label: "Low wellbeing (PWI <6/10)", domain: "mental", feature: "pwi", cutoff: 6, lowIsBad: true },
  // Metabolic / body / cardio flags fire when a value leaves the Lifeline
  // OPTIMAL (green) band — unified with the app's reference ranges.
  { key: "hba1c_pre", label: "HbA1c above optimal (≥39 mmol/mol)", domain: "metabolic", feature: "hba1c", cutoff: 39 },
  { key: "glucose_imp", label: "Glucose above optimal (≥5.6)", domain: "metabolic", feature: "glucose", cutoff: 5.6 },
  { key: "homa_ir", label: "HOMA-IR above optimal (≥1.9)", domain: "metabolic", feature: "homa_ir", cutoff: 1.9 },
  { key: "chol_high", label: "Total cholesterol above optimal (≥5.2)", domain: "metabolic", feature: "total_cholesterol", cutoff: 5.2 },
  { key: "tg_high", label: "Triglycerides above optimal (≥1.7)", domain: "metabolic", feature: "triglycerides", cutoff: 1.7 },
  { key: "hdl_low", label: "HDL below optimal (M <1.0 / F <1.3)", domain: "metabolic", feature: "hdl_cholesterol", genderCutoff: { male: 1.0, female: 1.3 }, lowIsBad: true },
  { key: "bmi_obese", label: "BMI above optimal (≥25)", domain: "body", feature: "bmi", cutoff: 25 },
  { key: "bodyfat_high", label: "Body fat above optimal (M ≥20% / F ≥28%)", domain: "body", feature: "fat_mass_percent", genderCutoff: { male: 20, female: 28 } },
  { key: "bp_sys_high", label: "Systolic BP above optimal (≥120)", domain: "cardio", feature: "bp_systolic_avg", cutoff: 120 },
  { key: "audit_c_pos", label: "Hazardous drinking (AUDIT-C ≥4 M / ≥3 F)", domain: "addiction", feature: "lifeline_health_audit_c", genderCutoff: { male: 4, female: 3 } },
  { key: "nicotine", label: "Nicotine use", domain: "addiction", feature: "lifeline_health_nicotine_use", boolTrue: true },
];

export function flagCrosses(def: FlagDef, value: number | boolean | null, gender: string | null): boolean {
  if (value === null || value === undefined) return false;
  if (def.boolTrue) return value === true || value === 1;
  if (typeof value !== "number") return false;
  const isFemale = (gender || "").toLowerCase() !== "male";
  if (def.genderCutoff) {
    const cut = isFemale ? def.genderCutoff.female : def.genderCutoff.male;
    return def.lowIsBad ? value < cut : value >= cut;
  }
  if (def.cutoff !== undefined) return def.lowIsBad ? value <= def.cutoff : value >= def.cutoff;
  return false;
}
