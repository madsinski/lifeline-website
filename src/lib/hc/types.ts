// Shared types for the heilsuferð (health-check journey). Client-safe: no
// server imports. Schema: supabase/migration-health-journey.sql.

export type Pillar = "sleep" | "exercise" | "nutrition" | "mental";
export type PackageKind = "health_check" | "followup_3m" | "reevaluation" | "extra_followup";
export type PaymentRoute = "self" | "union" | "company" | "company_union";

export const PILLARS: Pillar[] = ["sleep", "exercise", "nutrition", "mental"];

export const PILLAR_META: Record<Pillar, { label: string; color: string; soft: string; ring: string }> = {
  sleep: { label: "Svefn", color: "#767194", soft: "#F1F0F6", ring: "#C9C6DA" },
  exercise: { label: "Hreyfing", color: "#EA580C", soft: "#FFF4ED", ring: "#FBC9A6" },
  nutrition: { label: "Næring", color: "#65A30D", soft: "#F4FAE9", ring: "#C8E39A" },
  mental: { label: "Andleg líðan", color: "#0EA5E9", soft: "#EAF7FD", ring: "#A5DDF5" },
};

export interface HcLocation {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  blood_test_site: string | null;
  blood_test_address: string | null;
  blood_test_info: string | null;
  measurement_site: string | null;
  measurement_address: string | null;
  measurement_info: string | null;
  interview_site: string | null;
  interview_address: string | null;
  patient_portal_url: string | null;
}

export interface HcPackage {
  key: string;
  kind: PackageKind;
  name: string;
  tagline: string | null;
  description: string | null;
  includes: string[];
  price_isk: number;
  union_category: string;
  sort: number;
}

export interface HcJourney {
  id: string;
  client_id: string;
  location_id: string | null;
  stage: string;
  entry: "b2c" | "b2b" | "heilsugaesla";
  company_id: string | null;
  profile_completed_at: string | null;
  welcome_seen_at: string | null;
  paid_at: string | null;
  protocol_activated_at: string | null;
  blood_test_booked_for: string | null;
  blood_test_done_at: string | null;
  measurements_booked_for: string | null;
  measurements_done_at: string | null;
  blood_results_at: string | null;
  report_generated_at: string | null;
  report_generated_by: string | null;
  report_sms_sent_at: string | null;
  interview_booked_for: string | null;
  interview_mode: "in_person" | "video" | null;
  interviewer_id: string | null;
  interview_done_at: string | null;
  referral_to_heilsugaesla: boolean;
  referral_note: string | null;
  referred_at: string | null;
  plan_published_at: string | null;
  followup_booked_for: string | null;
  followup_done_at: string | null;
  reevaluation_due_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  interview_notes?: InterviewNotes | null;
  doctor_review_requested_at?: string | null;
  doctor_review_note?: string | null;
  doctor_reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Nurse's structured interview notes (workstation), one free-text field per topic. */
export interface InterviewNotes {
  sleep?: string;
  exercise?: string;
  nutrition?: string;
  mental?: string;
  measurements?: string;
  goals?: string;
  other?: string;
}

export interface HcOrder {
  id: string;
  journey_id: string;
  package_key: string;
  kind: PackageKind;
  price_isk: number;
  payment_route: PaymentRoute;
  union_id: string | null;
  union_reimbursement_isk: number;
  union_direct_grant_isk: number;
  company_id: string | null;
  amount_charged_isk: number;
  status: "pending" | "paid" | "cancelled" | "refunded";
  paid_at: string | null;
  activation_code: string | null;
  activation_redeemed_at: string | null;
  created_at: string;
}

/** Layout of one lecture slide. Missing = "text" (or "image" when image_url is set) for older slides. */
export type SlideLayout = "text" | "image" | "fullimage" | "video" | "quote" | "bullets" | "stat" | "tip";

export const SLIDE_LAYOUTS: { key: SlideLayout; label: string; hint: string }[] = [
  { key: "text", label: "Texti", hint: "Fyrirsögn og texti" },
  { key: "image", label: "Mynd og texti", hint: "Mynd eða skýringarmynd við hlið texta" },
  { key: "fullimage", label: "Heil mynd", hint: "Mynd yfir alla glæruna með myndatexta" },
  { key: "video", label: "Myndband", hint: "YouTube, Vimeo eða mp4" },
  { key: "quote", label: "Tilvitnun", hint: "Stór tilvitnun og höfundur" },
  { key: "bullets", label: "Listi", hint: "Fyrirsögn og punktar" },
  { key: "stat", label: "Tala", hint: "Stór tala með skýringu" },
  { key: "tip", label: "Ráð", hint: "Hagnýtt ráð í áberandi kassa" },
];

export interface LectureSlide {
  layout?: SlideLayout;
  title: string;
  body: string;
  image_url?: string | null;
  video_url?: string | null;
  /** bullets */
  items?: string[];
  /** stat: the big number, e.g. "7–9" */
  stat?: string | null;
  /** fullimage / video caption, quote attribution */
  caption?: string | null;
}

export function slideLayout(s: LectureSlide): SlideLayout {
  return s.layout ?? (s.image_url ? "image" : "text");
}

export interface HcLecture {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  kind: "video" | "slides" | "article";
  video_url: string | null;
  slides: LectureSlide[];
  article_md: string | null;
  duration_min: number | null;
  pillar: Pillar | "general" | null;
  is_welcome: boolean;
  sort: number;
  published: boolean;
}

export interface PlanModule {
  key: string;
  pillar: Pillar;
  title: string;
  summary: string;
  details: string | null;
  frequency: string | null;
  tags: string[];
  sort: number;
  active: boolean;
}

export interface ExerciseItem {
  name: string;
  prescription: string;
  note?: string | null;
}

export interface ExerciseSession {
  day: string;
  title: string;
  focus?: string | null;
  items: ExerciseItem[];
}

export interface ExerciseTemplate {
  key: string;
  name: string;
  level: "beginner" | "intermediate" | "advanced";
  goal: string | null;
  days_per_week: number;
  session_minutes: number | null;
  description: string | null;
  sessions: ExerciseSession[];
  active: boolean;
}

export interface NutritionTemplate {
  key: string;
  name: string;
  goal: string | null;
  description: string | null;
  principles: string[];
  day_example: { meal: string; example: string }[];
  active: boolean;
}

export interface PlanTemplate {
  key: string;
  name: string;
  scenario: string | null;
  description: string | null;
  module_keys: string[];
  exercise_template_key: string | null;
  nutrition_template_key: string | null;
  focus_pillars: Pillar[];
  sort: number;
  active: boolean;
}

/** A module instance inside a client's plan: copied from the library, then editable. */
export interface PlanItem {
  uid: string;
  key: string | null;
  pillar: Pillar;
  title: string;
  summary: string;
  details: string | null;
  frequency: string | null;
  note: string | null;
}

export interface PlanGoal {
  pillar: Pillar;
  text: string;
}

export interface ActionPlan {
  id: string;
  journey_id: string;
  client_id: string;
  template_key: string | null;
  headline: string | null;
  summary: string | null;
  goals: PlanGoal[];
  modules: PlanItem[];
  exercise: Omit<ExerciseTemplate, "active"> | null;
  nutrition: Omit<NutritionTemplate, "active"> | null;
  nurse_note: string | null;
  start_date: string | null;
  review_date: string | null;
  status: "draft" | "published";
  published_at: string | null;
  version: number;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface PlanLibrary {
  modules: PlanModule[];
  templates: PlanTemplate[];
  exercise: ExerciseTemplate[];
  nutrition: NutritionTemplate[];
}

export const formatIsk = (n: number) => `${Math.round(n).toLocaleString("is-IS")} kr.`;
