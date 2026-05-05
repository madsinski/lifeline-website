// Shared types for the feedback-survey system. The DB schema is in
// supabase/migration-feedback-surveys.sql; these mirror it.

export type SurveyStatus = "draft" | "pending_approval" | "approved" | "archived";

export type QuestionType =
  | "likert5"           // 5-point Likert (positive→negative)
  | "singleselect"      // single-choice radio
  | "multiselect"       // multi-choice checkboxes
  | "nps10"             // 0-10 numeric scale
  | "open"              // free-text textarea
  | "consent_optional"; // checkbox + optional textarea

export interface QuestionOption {
  value: string;
  label_is: string;
  label_en?: string;
}

export interface FeedbackSurvey {
  id: string;
  key: string;
  version: number;
  title_is: string;
  title_en: string | null;
  intro_is: string | null;
  intro_en: string | null;
  outro_is: string | null;
  outro_en: string | null;
  estimated_minutes: number;
  status: SurveyStatus;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  approval_note: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackQuestion {
  id: string;
  survey_id: string;
  order_index: number;
  question_type: QuestionType;
  label_is: string;
  label_en: string | null;
  helper_is: string | null;
  helper_en: string | null;
  options_jsonb: QuestionOption[] | null;
  required: boolean;
  allow_skip: boolean;
  skip_label_is: string | null;
  skip_label_en: string | null;
  created_at: string;
  updated_at: string;
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  likert5: "5-point scale",
  singleselect: "Single choice",
  multiselect: "Multiple choice",
  nps10: "NPS (0–10)",
  open: "Open text",
  consent_optional: "Consent + optional text",
};

export const STATUS_LABEL: Record<SurveyStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending medical-advisor approval",
  approved: "Approved",
  archived: "Archived",
};

export const STATUS_BADGE_CLASS: Record<SurveyStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_approval: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  archived: "bg-gray-100 text-gray-500",
};
