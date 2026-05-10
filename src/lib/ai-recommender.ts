// Shared recommendation engine for Lifeline.
//
// This module owns the system prompt (Lifeline mission + high-yield
// policy), zod schemas for structured output, and the helper that
// calls OpenAI and writes to ai_recommendation_log. Two consumers:
//
//   POST /api/ai/recommend-mode      — picks today's mode given metrics
//   POST /api/ai/recommend-actions   — ranks today's candidate actions
//
// Both endpoints + the admin test bench share the same prompt + writer.
//
// Logging policy: every non-dry-run call writes a row to
// ai_recommendation_log so the admin viewer at /admin/ai-feedback can
// later review what the model picked. Dry-runs (admin test bench) do
// NOT log — that surface is for evaluation, not production data.

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { supabaseAdmin } from "./supabase-admin";

export const AI_MODEL = "gpt-5.4";

export const SYSTEM_PROMPT = `You are the recommendation engine for Lifeline Health, an Icelandic medical-grade digital health app. Lifeline runs evidence-based programs across four pillars (Exercise, Nutrition, Sleep, Mental wellness) — clinician-led, coach-delivered, free of medical-record data at boot (we pull from Medalia case-by-case six months in).

OUR HIGH-YIELD POLICY (this is the lens for every choice):
- Every recommendation must produce maximum behavior change for minimum time and effort.
- Prefer one keystone habit that compounds over five small ones that fragment attention.
- First-order health levers in priority: sleep > nutrition > movement > supplements.
- Skip the recommendation when the marginal gain doesn't justify the time cost.
- Consistency beats intensity. A 10-minute habit done 6x a week beats a 60-minute session done once.
- When a candidate carries the KEYSTONE tag, it has been pre-vetted by the clinical team as the highest-yield item in its pillar. Strongly prefer keystones — only drop one when a safety rule forces it or when the user's mode genuinely makes it inappropriate.

USER CONTEXT YOU RECEIVE:
- Mode: vacation / normal / beast / sick / tired (the user's declared state today)
- Attestations: self-declared physical limitations + dietary allergies. These are HARD CONSTRAINTS — you must never recommend against them.
- Recent metrics (when available): sleep hours, HRV trend, RHR baseline + today, soreness self-rating
- Available action library, each tagged with intensity, recovery requirements, mode-appropriateness, equipment, and pillar (exercise/nutrition/sleep/mental)

SAFETY RULES (non-negotiable):
- Never recommend an action that conflicts with a stated limitation. Knee flagged → no high-impact / deep flexion. Back flagged → no heavy spinal loading. Cardio flagged → cap at moderate.
- Never recommend foods containing a flagged allergen.
- Never recommend Beast or vigorous exercise when sick or tired.
- When sick, only sleep + hydration + breathwork.
- When tired, cap exercise at gentle intensity (light strength / cardio / mobility OK; moderate sessions are not).
- When in doubt about safety, drop the item. Empty list is better than unsafe list.

OUTPUT REQUIREMENTS:
- One short rationale per recommendation (≤ 20 words), grounded in the data you saw. No filler.
- Yield score 1-5 where 5 = highest-yield given user's state.
- English (this is internal logging).`;

// ─── Mode recommendation ─────────────────────────────────────

export const modeRecSchema = z.object({
  mode: z.enum(["vacation", "normal", "beast", "sick", "tired"]),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string(),
  runner_up: z.object({
    mode: z.enum(["vacation", "normal", "beast", "sick", "tired"]),
    rationale: z.string(),
  }).nullable(),
});

export type ModeRecommendation = z.infer<typeof modeRecSchema>;

// ─── Action recommendation ───────────────────────────────────

export const actionRecSchema = z.object({
  ordered_actions: z.array(z.object({
    key: z.string(),
    rank: z.number().int(),
    yield_score: z.number().int().min(1).max(5),
    rationale: z.string(),
  })),
  dropped_actions: z.array(z.object({
    key: z.string(),
    reason: z.string(),
  })),
  overall_rationale: z.string(),
});

export type ActionRecommendation = z.infer<typeof actionRecSchema>;

// ─── Shared input shapes ─────────────────────────────────────

export interface UserMetrics {
  sleep_hours_last_night: number | null;       // 0-12
  sleep_hours_3day_avg: number | null;
  hrv_today_ms: number | null;                  // typical 20-100
  hrv_baseline_ms: number | null;
  rhr_today_bpm: number | null;                 // typical 50-90
  rhr_baseline_bpm: number | null;
  soreness_self_rating: number | null;          // 1-5
}

export interface Attestations {
  limitations: {
    knee: boolean; back: boolean; shoulder: boolean; wrist: boolean; cardio: boolean;
    other_notes: string | null;
  };
  allergies: {
    nuts: boolean; dairy: boolean; gluten: boolean; shellfish: boolean;
    other_notes: string | null;
  };
}

export interface CandidateAction {
  key: string;
  label: string;
  category: "exercise" | "nutrition" | "sleep" | "mental" | string;
  intensity: "gentle" | "moderate" | "vigorous" | null;
  min_recovery_state: string | null;
  appropriate_modes: string[] | null;
  equipment_needed: string[] | null;
  estimated_minutes: number | null;
  is_priority?: boolean;
  // Keystone habits are pre-vetted as the highest-yield items in
  // their pillar (sleep regularity, protein anchoring at breakfast,
  // morning calm/gratitude, daily step count). The model is
  // instructed to strongly prefer keystones — they encode clinical
  // judgement we don't want to keep re-deriving from the prompt.
  is_keystone?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────

// Wraps generateText + Output.object so callers don't repeat the
// boilerplate. Throws on failure with a useful error message.
export async function callRecommender<T>(
  schema: z.ZodSchema<T>,
  userPrompt: string,
  maxOutputTokens = 1500,
): Promise<T> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set");
  }
  const result = await generateText({
    model: openai(AI_MODEL),
    output: Output.object({ schema }),
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    maxOutputTokens,
  });
  if (!result.experimental_output) {
    throw new Error("Model returned no structured output");
  }
  return result.experimental_output as T;
}

// Writes a row to ai_recommendation_log via service role. Returns the
// new log id so the caller can hand it to the RN app, which surfaces
// it to the user and (when feedback is filed) joins it to
// ai_recommendation_feedback. Pass dryRun=true to skip the write
// entirely — used by the admin test bench.
export async function logRecommendation(args: {
  clientId: string;
  type: "mode" | "priority" | "program_item";
  inputSnapshot: Record<string, unknown>;
  output: Record<string, unknown>;
  reasonText: string;
  dryRun?: boolean;
}): Promise<string | null> {
  if (args.dryRun) return null;
  const { data, error } = await supabaseAdmin
    .from("ai_recommendation_log")
    .insert({
      client_id: args.clientId,
      type: args.type,
      input_snapshot: args.inputSnapshot,
      output: args.output,
      reason_text: args.reasonText,
      model: AI_MODEL,
    })
    .select("id")
    .single();
  if (error) throw new Error(`log write failed: ${error.message}`);
  return (data as { id: string }).id;
}

// Compact metric block for the user prompt — only includes lines for
// fields that are non-null, so the model sees a clean signal vs noise.
export function metricsBlock(m: UserMetrics): string {
  const lines: string[] = [];
  if (m.sleep_hours_last_night !== null) lines.push(`- Sleep last night: ${m.sleep_hours_last_night}h`);
  if (m.sleep_hours_3day_avg !== null) lines.push(`- Sleep 3-day average: ${m.sleep_hours_3day_avg}h`);
  if (m.hrv_today_ms !== null) {
    const baselineNote = m.hrv_baseline_ms !== null
      ? ` (baseline ${m.hrv_baseline_ms}ms, delta ${(m.hrv_today_ms - m.hrv_baseline_ms).toFixed(0)}ms)`
      : "";
    lines.push(`- HRV today: ${m.hrv_today_ms}ms${baselineNote}`);
  }
  if (m.rhr_today_bpm !== null) {
    const baselineNote = m.rhr_baseline_bpm !== null
      ? ` (baseline ${m.rhr_baseline_bpm}bpm, delta ${(m.rhr_today_bpm - m.rhr_baseline_bpm).toFixed(0)}bpm)`
      : "";
    lines.push(`- RHR today: ${m.rhr_today_bpm}bpm${baselineNote}`);
  }
  if (m.soreness_self_rating !== null) lines.push(`- Self-rated soreness: ${m.soreness_self_rating}/5`);
  if (lines.length === 0) return "(no recent metrics available)";
  return lines.join("\n");
}

export function attestationsBlock(a: Attestations | null): string {
  if (!a) return "(no attestations on file — treat as no flags)";
  const limits: string[] = [];
  if (a.limitations.knee) limits.push("knee");
  if (a.limitations.back) limits.push("back");
  if (a.limitations.shoulder) limits.push("shoulder");
  if (a.limitations.wrist) limits.push("wrist");
  if (a.limitations.cardio) limits.push("cardio");
  const allergies: string[] = [];
  if (a.allergies.nuts) allergies.push("nuts");
  if (a.allergies.dairy) allergies.push("dairy");
  if (a.allergies.gluten) allergies.push("gluten");
  if (a.allergies.shellfish) allergies.push("shellfish");
  const lines: string[] = [];
  lines.push(`- Limitations: ${limits.length === 0 ? "none flagged" : limits.join(", ")}${a.limitations.other_notes ? ` (note: ${a.limitations.other_notes})` : ""}`);
  lines.push(`- Allergies: ${allergies.length === 0 ? "none flagged" : allergies.join(", ")}${a.allergies.other_notes ? ` (note: ${a.allergies.other_notes})` : ""}`);
  return lines.join("\n");
}

export function actionListBlock(actions: CandidateAction[]): string {
  if (actions.length === 0) return "(no candidate actions)";
  return actions.map((a, i) => {
    const tags: string[] = [];
    // Keystone first so it's the most visible signal on each line.
    if (a.is_keystone) tags.push("KEYSTONE");
    if (a.intensity) tags.push(`intensity=${a.intensity}`);
    if (a.min_recovery_state) tags.push(`recovery=${a.min_recovery_state}`);
    if (a.appropriate_modes && a.appropriate_modes.length > 0) tags.push(`modes=[${a.appropriate_modes.join(",")}]`);
    if (a.equipment_needed && a.equipment_needed.length > 0) tags.push(`equipment=[${a.equipment_needed.join(",")}]`);
    if (a.estimated_minutes) tags.push(`~${a.estimated_minutes}min`);
    if (a.is_priority) tags.push("PRIORITY");
    return `${i + 1}. [${a.category}] key=${a.key} — ${a.label}${tags.length > 0 ? ` (${tags.join(", ")})` : ""}`;
  }).join("\n");
}
