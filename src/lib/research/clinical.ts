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

export type Domain = "mental" | "metabolic" | "body" | "cardio" | "substance" | "lifestyle" | "other";

export const DOMAIN_LABELS: Record<Domain, string> = {
  mental: "Mental health",
  metabolic: "Metabolic & labs",
  body: "Body composition",
  cardio: "Cardiovascular",
  substance: "Substance & addiction",
  lifestyle: "Lifestyle & behaviour",
  other: "Other",
};

export const DOMAIN_ORDER: Domain[] = ["mental", "metabolic", "cardio", "body", "substance", "lifestyle", "other"];

export function featureDomain(feature: string): Domain {
  const f = feature.toLowerCase();
  if (/(phq|gad|anxiety|depression|andlegt|sleep|svefn|pwi)/.test(f)) return "mental";
  if (/(hba1c|glucose|insulin|homa|cholesterol|triglyc|hdl|\balt\b|\bast\b|metabolic_health|diabetic)/.test(f)) return "metabolic";
  if (/(bp_|blood_pressure|heart_health)/.test(f)) return "cardio";
  if (/(bmi|weight|height|fat_mass|skeletal_muscle)/.test(f)) return "body";
  if (/(audit|alcohol|nicotine|gambling|pgsi|cudq|food_addiction|other_substance|assist|fikn|caffine|caffeine)/.test(f)) return "substance";
  if (/(screen_use|cius|exercise|hreyfing|nutrition|naering|lifstil)/.test(f)) return "lifestyle";
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
  if (/_(medical|behavioural)_score$/.test(feature)) return "up"; // health sub-scores
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
export const REFERENCE_NOTE: Record<string, string> = {
  hba1c: "normal <42, prediabetes 42-47, diabetes ≥48 mmol/mol",
  glucose: "fasting normal <5.6, impaired 5.6-6.9, diabetes ≥7.0 mmol/L",
  insulin: "fasting typical ~2-25 mIU/L",
  homa_ir: "insulin resistance ≥2.5 (lower better)",
  total_cholesterol: "desirable <5.0 mmol/L (lower better)",
  hdl_cholesterol: "low if <1.0 (M) / <1.3 (F) mmol/L — higher better",
  triglycerides: "normal <1.7 mmol/L (lower better)",
  alt: "elevated ≥45 U/L (lower better)",
  ast: "elevated ≥40 U/L (lower better)",
  metabolic_health: "composite score — higher is better",
  bmi: "normal 18.5-24.9, overweight 25-29.9, obese ≥30 (lower better)",
  fat_mass_percent: "high if ≥25% (M) / ≥32% (F) — lower better",
  skeletal_muscle_mass_percent: "higher is better",
  bp_systolic_avg: "normal <120, elevated 120-139, hypertension ≥140 mmHg",
  bp_diastolic_avg: "normal <80, hypertension ≥90 mmHg",
  heart_health_score_2: "cardiovascular RISK score — lower is better",
  phq9: "0-4 none, 5-9 mild, 10-14 moderate, 15+ mod-severe (lower better)",
  phq2: "≥3 positive depression screen",
  lifeline_health_anxiety_gad_7: "0-4 none, 5-9 mild, 10-14 moderate, 15+ severe (lower better)",
  lifeline_health_anxiety_gad_2: "≥3 positive anxiety screen",
  lifeline_health_audit_c: "hazardous ≥4 (M) / ≥3 (F) — lower better",
  lifeline_health_audit_10: "hazardous ≥8, likely dependence ≥15 (lower better)",
  lifeline_health_gambling_pgsi: "low 1-2, moderate 3-7, problem ≥8 (lower better)",
  lifeline_health_cudq_5_score: "higher = more cannabis-use risk (lower better)",
  lifeline_health_screen_use_cius_5: "higher = more compulsive use (lower better)",
  lifeline_health_screen_use_cius_14: "higher = more compulsive use (lower better)",
  pwi: "Personal Wellness Index 0-10 — higher is better",
  lifstilseinkunn: "lifestyle grade 0-10 — higher is better",
};

/** Reference note with sensible fallbacks for the lifeline 0-10 wellness scores. */
export function referenceNote(feature: string): string {
  if (REFERENCE_NOTE[feature]) return REFERENCE_NOTE[feature];
  if (/_1_10$/.test(feature)) return "0-10 wellness scale — higher is better";
  if (/_(medical|behavioural)_score$/.test(feature) || /_total$/.test(feature)) return "0-10 sub-score — higher is better";
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
  { key: "phq9_mod", label: "Moderate+ depression (PHQ-9 ≥10)", domain: "mental", feature: "phq9", cutoff: 10 },
  { key: "gad7_mod", label: "Moderate+ anxiety (GAD-7 ≥10)", domain: "mental", feature: "lifeline_health_anxiety_gad_7", cutoff: 10 },
  { key: "hba1c_pre", label: "Prediabetes+ (HbA1c ≥42)", domain: "metabolic", feature: "hba1c", cutoff: 42 },
  { key: "glucose_imp", label: "Impaired fasting glucose (≥5.6)", domain: "metabolic", feature: "glucose", cutoff: 5.6 },
  { key: "homa_ir", label: "Insulin resistance (HOMA-IR ≥2.5)", domain: "metabolic", feature: "homa_ir", cutoff: 2.5 },
  { key: "chol_high", label: "High total cholesterol (≥5.0)", domain: "metabolic", feature: "total_cholesterol", cutoff: 5.0 },
  { key: "tg_high", label: "High triglycerides (≥1.7)", domain: "metabolic", feature: "triglycerides", cutoff: 1.7 },
  { key: "hdl_low", label: "Low HDL (<1.0 M / <1.3 F)", domain: "metabolic", feature: "hdl_cholesterol", genderCutoff: { male: 1.0, female: 1.3 }, lowIsBad: true },
  { key: "bmi_obese", label: "Obese (BMI ≥30)", domain: "body", feature: "bmi", cutoff: 30 },
  { key: "bodyfat_high", label: "High body fat (≥30%)", domain: "body", feature: "fat_mass_percent", cutoff: 30 },
  { key: "bp_sys_high", label: "Elevated systolic BP (≥140)", domain: "cardio", feature: "bp_systolic_avg", cutoff: 140 },
  { key: "audit_c_pos", label: "Hazardous drinking (AUDIT-C ≥4 M / ≥3 F)", domain: "substance", feature: "lifeline_health_audit_c", genderCutoff: { male: 4, female: 3 } },
  { key: "nicotine", label: "Nicotine use", domain: "substance", feature: "lifeline_health_nicotine_use", boolTrue: true },
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
