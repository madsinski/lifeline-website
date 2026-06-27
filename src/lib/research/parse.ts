// Flatten a Medalia pathway JSON export into normalized research rows.
//
// The Medalia export nests data under each patient as calculatedScores[],
// labResults[], measurements[] (some with components[]), and
// questionnaireResponses[]. This module turns that into flat observation /
// answer rows that map 1:1 onto the research_observations / research_answers
// tables, plus reconciliation counts so ingestion can prove nothing was lost.
//
// Mirrors the standalone converters used to build the research CSV/Excel files.

export interface MedaliaExport {
  exportedAt?: string;
  client?: string;
  pathway?: string;
  patientCount?: number;
  patients?: MedaliaPatient[];
}

interface MedaliaPatient {
  patientId: string;
  age?: number | null;
  gender?: string | null;
  groups?: string[] | null;
  measurements?: MedaliaMeasurement[];
  labResults?: MedaliaValue[];
  calculatedScores?: MedaliaValue[];
  questionnaireResponses?: MedaliaQuestionnaire[];
}

interface MedaliaValue {
  code?: string;
  display?: string;
  date?: string;
  value?: number | string | boolean | null;
  unit?: string;
}

interface MedaliaMeasurement extends MedaliaValue {
  components?: { code?: string; value?: number | string | boolean | null; unit?: string }[];
}

interface MedaliaQuestionnaire {
  questionnaireId?: string;
  questionnaireTitle?: string;
  authored?: string;
  answers?: { linkId?: string; text?: string; value?: unknown }[];
}

export type ObsType = "score" | "lab" | "measurement";

export interface ParsedObservation {
  medalia_patient_id: string;
  obs_type: ObsType;
  code: string;
  feature: string;
  display: string | null;
  observed_at: string | null;
  value_num: number | null;
  value_text: string | null;
  value_bool: boolean | null;
  unit: string | null;
}

export interface ParsedAnswer {
  medalia_patient_id: string;
  questionnaire_id: string | null;
  questionnaire_title: string | null;
  authored_at: string | null;
  link_id: string | null;
  question_text: string | null;
  value_text: string | null;
}

export interface ParsedPatient {
  medalia_patient_id: string;
  gender: string | null;
  age: number | null;
  group_name: string | null;
}

export interface ParsedExport {
  meta: { exportedAt: string | null; client: string | null; pathway: string | null; patientCount: number };
  patients: ParsedPatient[];
  observations: ParsedObservation[];
  answers: ParsedAnswer[];
  reconciliation: {
    patients: number;
    scores: number;
    labs: number;
    measurements: number; // expanded (BP panels split into components)
    answers: number;
    total: number;
  };
}

// Friendly names for LOINC / panel codes (fall back to the raw code).
const FRIENDLY: Record<string, string> = {
  "4548-4": "hba1c", "15074-8": "glucose", "2484-4": "insulin", "47214-2": "homa_ir",
  "2093-3": "total_cholesterol", "2085-9": "hdl_cholesterol", "2571-8": "triglycerides",
  "1742-6": "alt", "1920-8": "ast", metabolic_health: "metabolic_health",
  bmi: "bmi", "39156-5": "bmi_ratio", "8302-2": "height", "29463-7": "weight",
  blood_pressure_systolic_average: "bp_systolic_avg",
  blood_pressure_diastolic_average: "bp_diastolic_avg",
  "85354-9": "blood_pressure_panel", "8480-6": "bp_systolic", "8462-4": "bp_diastolic",
};
const COMP_DISPLAY: Record<string, string> = {
  "8480-6": "Systolic blood pressure", "8462-4": "Diastolic blood pressure",
};
const friendly = (code: string): string => FRIENDLY[code] ?? code;

function splitValue(v: unknown): { num: number | null; text: string | null; bool: boolean | null } {
  if (v === null || v === undefined) return { num: null, text: null, bool: null };
  if (typeof v === "boolean") return { num: null, text: null, bool: v };
  if (typeof v === "number") return { num: Number.isFinite(v) ? v : null, text: null, bool: null };
  if (typeof v === "string") {
    const n = Number(v);
    if (v.trim() !== "" && Number.isFinite(n)) return { num: n, text: v, bool: null };
    return { num: null, text: v, bool: null };
  }
  return { num: null, text: JSON.stringify(v), bool: null };
}

const iso = (d?: string): string | null => (d ? d : null);

export function parseMedaliaExport(data: MedaliaExport): ParsedExport {
  const patients = data.patients ?? [];
  const outPatients: ParsedPatient[] = [];
  const observations: ParsedObservation[] = [];
  const answers: ParsedAnswer[] = [];
  let scores = 0, labs = 0, measurements = 0, answerCount = 0;

  for (const p of patients) {
    const pid = p.patientId;
    outPatients.push({
      medalia_patient_id: pid,
      gender: p.gender ?? null,
      age: typeof p.age === "number" ? p.age : null,
      group_name: (p.groups ?? []).join("; ") || null,
    });

    const push = (type: ObsType, code: string, display: string | undefined, date: string | undefined, value: unknown, unit: string | undefined) => {
      const s = splitValue(value);
      observations.push({
        medalia_patient_id: pid, obs_type: type, code, feature: friendly(code),
        display: display ?? null, observed_at: iso(date),
        value_num: s.num, value_text: s.text, value_bool: s.bool, unit: unit ?? null,
      });
    };

    for (const s of p.calculatedScores ?? []) { push("score", s.code ?? "", s.display, s.date, s.value, s.unit); scores++; }
    for (const l of p.labResults ?? []) { push("lab", l.code ?? "", l.display, l.date, l.value, l.unit); labs++; }
    for (const m of p.measurements ?? []) {
      if (Array.isArray(m.components) && m.components.length) {
        for (const c of m.components) {
          push("measurement", c.code ?? "", COMP_DISPLAY[c.code ?? ""] ?? m.display, m.date, c.value, c.unit);
          measurements++;
        }
      } else {
        push("measurement", m.code ?? "", m.display, m.date, m.value, m.unit);
        measurements++;
      }
    }

    for (const q of p.questionnaireResponses ?? []) {
      for (const a of q.answers ?? []) {
        const val = a.value;
        const text = val === null || val === undefined ? null
          : typeof val === "object" ? JSON.stringify(val)
          : String(val);
        answers.push({
          medalia_patient_id: pid,
          questionnaire_id: q.questionnaireId ?? null,
          questionnaire_title: q.questionnaireTitle ?? null,
          authored_at: iso(q.authored),
          link_id: a.linkId ?? null,
          question_text: a.text ?? null,
          value_text: text,
        });
        answerCount++;
      }
    }
  }

  return {
    meta: {
      exportedAt: iso(data.exportedAt),
      client: data.client ?? null,
      pathway: data.pathway ?? null,
      patientCount: typeof data.patientCount === "number" ? data.patientCount : patients.length,
    },
    patients: outPatients,
    observations,
    answers,
    reconciliation: {
      patients: patients.length,
      scores, labs, measurements, answers: answerCount,
      total: scores + labs + measurements + answerCount,
    },
  };
}
