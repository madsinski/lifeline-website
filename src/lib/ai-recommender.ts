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
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "./supabase-admin";

// Per-task model defaults. Mode picks need a touch more reasoning
// than ranking; meal/action ranking + swap can use the lighter
// model. Falls back to AI_MODEL if a task is missing. Override via
// OPENAI_MODEL_<TASK> env if you need to A/B without a redeploy
// (e.g. OPENAI_MODEL_MODE=gpt-5.4 to test with the bigger model).
export const AI_MODEL = "gpt-5.4-mini";
export const MODELS: Record<string, string> = {
  mode: process.env.OPENAI_MODEL_MODE || "gpt-5.4",            // small data, reasoning-heavier
  actions: process.env.OPENAI_MODEL_ACTIONS || AI_MODEL,        // ranking
  meals: process.env.OPENAI_MODEL_MEALS || AI_MODEL,            // ranking
  swap: process.env.OPENAI_MODEL_SWAP || AI_MODEL,              // narrow output
};
export type AiTask = "mode" | "actions" | "meals" | "swap";

// Compressed system prompt (~600 tokens vs ~1500 originally).
// Every clause earns its place — verbose policy framing was
// burning input tokens on every call.
export const SYSTEM_PROMPT = `You are the recommendation engine for Lifeline Health (Icelandic medical-grade digital health, four pillars: Exercise/Nutrition/Sleep/Mental, clinician-led, no medical-record data at boot).

HIGH-YIELD POLICY (lens for every choice):
- Max behavior change for min time/effort. Consistency > intensity.
- Priority order applies WHEN FORCED TO DROP items: sleep > nutrition > movement > supplements. It is NOT a directive to stack a day with one pillar — most days should touch all four pillars present in the candidate set.
- Drop a recommendation when marginal gain ≤ time cost.
- KEYSTONE-tagged items are clinically pre-vetted as highest yield in their pillar — strongly prefer them; only drop for safety or mode mismatch.

PILLAR BALANCE (when ranking a day plan):
- A daily plan should be balanced across pillars, NOT stacked on one. Aim for roughly even distribution: if target_count is 6 and 3 pillars have candidates, target ~2 per pillar (not 4-1-1 or 3-2-1).
- Cover breadth before depth: the FIRST keystone in every available pillar must appear before any pillar gets a second pick.
- The single best sleep item beats the third-best sleep item AND a missing exercise/mental keystone.
- Don't add a fourth sleep item when no exercise or mental items are picked yet.
- If the candidate set is single-pillar (e.g. user filtered to "sleep only"), ignore this rule.

SAFETY RULES (non-negotiable):
- Never recommend against a stated limitation. Knee → no high-impact / deep flexion. Back → no heavy spinal load. Shoulder → no overhead. Wrist → no push-ups/planks. Cardio → cap at moderate.
- Never recommend a flagged allergen.
- Sick: only sleep + hydration + breathwork.
- Tired: cap exercise at gentle (light strength/cardio/mobility OK; moderate sessions not).
- When in doubt, drop the item. Empty > unsafe.

OUTPUT:
- Per-item rationale ≤ 15 words, grounded in the data you saw. No filler.
- Yield 1-5 (5 = highest-yield for this user today).
- English (internal logging).`;

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
//
// task lets callers opt into the per-task model default (gpt-5.4 for
// "mode", mini for everything else — see MODELS). Caller can also
// pass an explicit modelOverride to force a model at the call site.
//
// On failure, the exception is captured to Sentry with structured
// context so /admin/errors picks it up — wraps the AI calls with
// the same observability the rest of the app routes get.
export async function callRecommender<T>(
  schema: z.ZodSchema<T>,
  userPrompt: string,
  maxOutputTokens = 1500,
  task: AiTask = "actions",
  modelOverride?: string,
): Promise<T> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set");
  }
  const model = modelOverride || MODELS[task] || AI_MODEL;
  try {
    const result = await generateText({
      model: openai(model),
      output: Output.object({ schema }),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens,
    });
    if (!result.experimental_output) {
      throw new Error("Model returned no structured output");
    }
    return result.experimental_output as T;
  } catch (e) {
    Sentry.captureException(e, {
      tags: { component: "ai-recommender", task, model },
      contexts: { ai: { promptLength: userPrompt.length, maxOutputTokens } },
    });
    throw e;
  }
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

// ─── Meals (nutrition recommendation source) ────────────────
// Nutrition-pillar recommendations come from the dedicated `meals`
// table, not from program_actions (which only has educational topics
// for nutrition). The AI receives a server-pre-filtered candidate
// list — allergens dropped before the model ever sees them.

export interface CandidateMeal {
  id: string;
  name: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  difficulty: "easy" | "medium" | "hard";
  prep_min: number;
  cook_min: number;
  protein_g: number | null;
  calories: number | null;
  dietary_tags: string[];
  ingredients: string[];
  is_high_protein_keystone: boolean;
}

// Allergen → ingredient-name patterns. Case-insensitive substring
// match. Conservative on purpose: better to drop a safe meal than
// surface a risky one. The user's notes_other field (free-text) is
// passed to the model separately so it can apply context-specific
// caution that we can't pattern-match here.
const ALLERGEN_PATTERNS: Record<string, RegExp> = {
  nuts: /\b(nuts?|peanuts?|almonds?|cashews?|walnuts?|pecans?|pistachios?|macadamias?|hazelnuts?|brazil[ -]nuts?|pine[ -]nuts?|nut[ -]butter)\b/i,
  dairy: /\b(milk|cheese|cheddar|mozzarella|parmesan|feta|butter|cream|yog[h]?urt|whey|casein|kefir|ricotta|cottage[ -]cheese)\b/i,
  gluten: /\b(wheat|flour|bread|pasta|noodles?|couscous|bulgur|seitan|barley|rye|spelt|farro|soy[ -]sauce|panko|breadcrumb|croutons?)\b/i,
  shellfish: /\b(shrimp|prawn|crab|lobster|oyster|mussel|clam|scallop|crayfish|squid|calamari|crawfish)\b/i,
};

// Returns the list of allergens that match this ingredient set, or
// an empty array if the meal is safe. Pass the result to the caller
// to decide whether to drop the meal or surface it with a warning
// (we drop, server-side).
export function detectAllergenConflicts(ingredients: string[], allergies: { nuts: boolean; dairy: boolean; gluten: boolean; shellfish: boolean }): string[] {
  const conflicts: string[] = [];
  const blob = ingredients.join(" | ");
  for (const [key, pattern] of Object.entries(ALLERGEN_PATTERNS)) {
    if (allergies[key as keyof typeof allergies] && pattern.test(blob)) {
      conflicts.push(key);
    }
  }
  return conflicts;
}

// Mode-appropriateness for meals. Mirrors the philosophy of
// applyModeFilter for program_actions but tuned to the meal shape.
export function mealAppropriateForMode(meal: CandidateMeal, mode: string): { ok: true } | { ok: false; reason: string } {
  if (mode === "sick") {
    // Sick → only easy + no-cook OR very short cook times. The body
    // shouldn't be standing over a stove for 40 min when it should
    // be sleeping.
    const isNoCook = meal.dietary_tags.includes("no-cook");
    const totalMin = (meal.prep_min || 0) + (meal.cook_min || 0);
    if (!isNoCook && totalMin > 15) return { ok: false, reason: "Sick mode: total time > 15 min (need no-cook or very short)" };
    if (meal.difficulty === "hard") return { ok: false, reason: "Sick mode: difficulty too high" };
  }
  if (mode === "tired") {
    if (meal.difficulty === "hard") return { ok: false, reason: "Tired mode: difficulty too high" };
    const totalMin = (meal.prep_min || 0) + (meal.cook_min || 0);
    if (totalMin > 30) return { ok: false, reason: "Tired mode: total time > 30 min" };
  }
  if (mode === "vacation") {
    // Vacation → kitchen access uncertain. Prefer no-cook + easy.
    if (meal.difficulty === "hard") return { ok: false, reason: "Vacation mode: difficulty too high (kitchen access uncertain)" };
  }
  return { ok: true };
}

export const mealRecSchema = z.object({
  ordered_meals: z.array(z.object({
    id: z.string(),
    rank: z.number().int(),
    yield_score: z.number().int().min(1).max(5),
    rationale: z.string(),
  })),
  dropped_meals: z.array(z.object({
    id: z.string(),
    reason: z.string(),
  })),
  overall_rationale: z.string(),
});

export type MealRecommendation = z.infer<typeof mealRecSchema>;

export function mealsBlock(meals: CandidateMeal[]): string {
  if (meals.length === 0) return "(no candidate meals — likely all dropped by allergen filter)";
  return meals.map((m, i) => {
    const tags: string[] = [];
    if (m.is_high_protein_keystone) tags.push("KEYSTONE-PROTEIN");
    tags.push(`slot=${m.slot}`);
    tags.push(`difficulty=${m.difficulty}`);
    tags.push(`time=${(m.prep_min || 0) + (m.cook_min || 0)}min`);
    if (m.protein_g !== null) tags.push(`protein=${m.protein_g}g`);
    if (m.calories !== null) tags.push(`kcal=${m.calories}`);
    if (m.dietary_tags.length > 0) tags.push(`tags=[${m.dietary_tags.join(",")}]`);
    return `${i + 1}. id=${m.id} — ${m.name} (${tags.join(", ")})\n   ingredients: ${m.ingredients.slice(0, 8).join(", ")}${m.ingredients.length > 8 ? `, +${m.ingredients.length - 8} more` : ""}`;
  }).join("\n");
}

// ─── Exercises (exercise library swap source) ───────────────
// The 869-entry `exercises` table (free-exercise-db with MP4 loops).
// Used for swap recommendations — when the user wants to replace
// a single move within a session, we surface N alternatives that
// match equipment + muscle group + difficulty.

export interface CandidateExercise {
  id: string;
  name: string;
  category: string;             // chest / back / legs / core / etc.
  equipment: string;
  difficulty: string;           // beginner / intermediate / advanced
  muscles_targeted: string[];
  has_video: boolean;
}

// Equipment groups for swap matching: bodyweight, free-weights,
// cables/machines, accessories. The AI gets the explicit equipment
// string; this constant is here for server-side filtering when the
// caller wants a strict equipment match.
export const EQUIPMENT_GROUPS: Record<string, string[]> = {
  none: ["none", "bodyweight"],
  bodyweight: ["none", "bodyweight"],
  dumbbells: ["dumbbells", "kettlebell"],
  kettlebell: ["kettlebell", "dumbbells"],
  barbell: ["barbell"],
  machine: ["machine", "cables"],
  cables: ["cables", "machine"],
  bands: ["bands"],
  other: [],
};

export const swapRecSchema = z.object({
  alternatives: z.array(z.object({
    id: z.string(),
    rank: z.number().int(),
    rationale: z.string(),
  })),
  overall_rationale: z.string(),
});

export type SwapRecommendation = z.infer<typeof swapRecSchema>;

export function exerciseListBlock(exercises: CandidateExercise[]): string {
  if (exercises.length === 0) return "(no candidate exercises)";
  return exercises.map((e, i) => {
    const tags: string[] = [];
    tags.push(`equipment=${e.equipment}`);
    tags.push(`difficulty=${e.difficulty}`);
    tags.push(`muscles=[${e.muscles_targeted.slice(0, 4).join(",")}]`);
    if (e.has_video) tags.push("video");
    return `${i + 1}. id=${e.id} — ${e.name} (${e.category}, ${tags.join(", ")})`;
  }).join("\n");
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
