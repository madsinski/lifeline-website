// Clinical configuration for the research module: how raw features map to
// decision-relevant domains, their reference ranges, and the threshold-based
// "flags" whose prevalence is worth surfacing and tracking over time.
//
// Feature names match the parse engine (src/lib/research/parse.ts): lab/measure
// codes are given friendly names (hba1c, bmi, ...); questionnaire scores keep
// their raw code (phq9, lifeline_health_anxiety_gad_7, ...).

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

// feature -> domain (substring/prefix rules keep this compact and forgiving)
export function featureDomain(feature: string): Domain {
  const f = feature.toLowerCase();
  if (/(phq|gad|anxiety|depression|andlegt|sleep|svefn|pwi)/.test(f)) return "mental";
  if (/(hba1c|glucose|insulin|homa|cholesterol|triglyc|hdl|\balt\b|\bast\b|metabolic_health)/.test(f)) return "metabolic";
  if (/(bp_|blood_pressure|heart_health)/.test(f)) return "cardio";
  if (/(bmi|weight|height|fat_mass|skeletal_muscle)/.test(f)) return "body";
  if (/(audit|alcohol|nicotine|gambling|pgsi|cudq|food_addiction|other_substance|assist|fikn|caffine|caffeine)/.test(f)) return "substance";
  if (/(screen_use|cius|exercise|hreyfing|nutrition|naering|lifstil)/.test(f)) return "lifestyle";
  return "other";
}

// Human reference range note shown next to a feature (display only).
export const REFERENCE_NOTE: Record<string, string> = {
  hba1c: "normal <42, prediabetes 42-47, diabetes ≥48 mmol/mol",
  glucose: "fasting impaired ≥5.6, diabetes ≥7.0 mmol/l",
  homa_ir: "insulin resistance ≥2.5",
  total_cholesterol: "desirable <5.0 mmol/L",
  hdl_cholesterol: "low <1.0 (M) / <1.3 (F) mmol/L",
  triglycerides: "elevated ≥1.7 mmol/L",
  alt: "elevated ≥45 U/L",
  bmi: "normal 18.5-24.9, overweight 25-29.9, obese ≥30",
  fat_mass_percent: "high ≥30%",
  bp_systolic_avg: "elevated ≥140 mmHg",
  bp_diastolic_avg: "elevated ≥90 mmHg",
  phq9: "≥5 mild, ≥10 moderate, ≥15 mod-severe (depression)",
  phq2: "≥3 positive screen",
  lifeline_health_anxiety_gad_7: "≥5 mild, ≥10 moderate (anxiety)",
  lifeline_health_anxiety_gad_2: "≥3 positive screen",
  lifeline_health_audit_c: "hazardous ≥4 (M) / ≥3 (F)",
  lifeline_health_audit_10: "hazardous ≥8",
  lifeline_health_gambling_pgsi: "moderate risk ≥3, problem ≥8",
};

// Threshold flags whose cohort prevalence we compute & track.
export interface FlagDef {
  key: string;
  label: string;
  domain: Domain;
  feature: string;
  // a value "crosses" the flag if cmp(value, gender) is true
  cutoff?: number;            // simple numeric >= cutoff
  genderCutoff?: { male: number; female: number }; // gender-specific >=
  lowIsBad?: boolean;         // flag when value <= cutoff/genderCutoff instead of >=
  boolTrue?: boolean;         // flag when value is truthy (e.g. nicotine_use)
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
