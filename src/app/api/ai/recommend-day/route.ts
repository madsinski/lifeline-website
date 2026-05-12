// POST /api/ai/recommend-day
//
// Unified daily plan ranker. Replaces the split between
// /api/ai/recommend-actions (exercise/sleep/mental) and
// /api/ai/recommend-meals (nutrition) for the HomeScreen day plan.
// Returns ONE ranked list with pillar balance enforced + per-item
// rationale, so the user sees a coherent day across all four pillars.
//
// Pipeline:
//   1. Server resolves the nutrition candidates from `meals` table
//      with allergen + mode pre-filter (defence in depth — same
//      logic as /api/ai/recommend-meals).
//   2. Caller supplies the non-nutrition candidates (exercise +
//      sleep + mental) already deterministic-filtered from the
//      RN app's actionGroups via applyModeFilter.
//   3. Single AI pass ranks both streams together with explicit
//      pillar-balance + safety rules.
//   4. Logs to ai_recommendation_log type='program_item' with
//      source='day_plan' for telemetry distinguishability.
//
// Auth: same model as the other AI endpoints — user JWT for own
// data, admin JWT + dryRun=true for the test bench.

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  MODELS,
  attestationsBlock,
  callRecommender,
  detectAllergenConflicts,
  logRecommendation,
  mealAppropriateForMode,
  metricsBlock,
  type Attestations,
  type CandidateMeal,
  type UserMetrics,
} from "@/lib/ai-recommender";

export const runtime = "nodejs";
export const maxDuration = 60;

const actionSchema = z.object({
  key: z.string(),
  label: z.string(),
  category: z.string(),
  intensity: z.enum(["gentle", "moderate", "vigorous"]).nullable(),
  min_recovery_state: z.string().nullable(),
  appropriate_modes: z.array(z.string()).nullable(),
  equipment_needed: z.array(z.string()).nullable(),
  estimated_minutes: z.number().nullable(),
  is_priority: z.boolean().optional(),
  is_keystone: z.boolean().optional(),
});

const requestSchema = z.object({
  clientId: z.string().uuid().optional(),
  mode: z.enum(["vacation", "normal", "beast", "sick", "tired"]),
  metrics: z.object({
    sleep_hours_last_night: z.number().nullable(),
    sleep_hours_3day_avg: z.number().nullable(),
    hrv_today_ms: z.number().nullable(),
    hrv_baseline_ms: z.number().nullable(),
    rhr_today_bpm: z.number().nullable(),
    rhr_baseline_bpm: z.number().nullable(),
    soreness_self_rating: z.number().nullable(),
  }).optional(),
  attestations: z.object({
    limitations: z.object({
      knee: z.boolean(), back: z.boolean(), shoulder: z.boolean(),
      wrist: z.boolean(), cardio: z.boolean(),
      other_notes: z.string().nullable(),
    }),
    allergies: z.object({
      nuts: z.boolean(), dairy: z.boolean(), gluten: z.boolean(), shellfish: z.boolean(),
      other_notes: z.string().nullable(),
    }),
  }).nullable(),
  candidate_actions: z.array(actionSchema).max(80),
  target_count: z.number().int().min(1).max(12).default(6),
  // Whether to include meals in the candidate set. Defaults true.
  // RN callers can flip false if they only want non-nutrition ranking.
  include_meals: z.boolean().default(true),
  dryRun: z.boolean().optional(),
});

interface MealRow {
  id: string;
  name: string;
  category: "breakfast" | "lunch" | "dinner" | "snack";
  ingredients: string[] | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: "easy" | "medium" | "hard";
  calories: number | null;
  protein: number | null;
  dietary_tags: string[] | null;
}

// Output schema is the same shape as recommend-actions but each item
// now carries its `category` so the RN renderer can route per pillar.
const dayRecSchema = z.object({
  ordered_items: z.array(z.object({
    key: z.string(),
    category: z.string(),
    source: z.enum(["program_action", "meal"]),
    rank: z.number().int(),
    yield_score: z.number().int().min(1).max(5),
    rationale: z.string(),
  })),
  dropped_items: z.array(z.object({
    key: z.string(),
    reason: z.string(),
  })),
  overall_rationale: z.string(),
});

function authToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length);
}

async function resolveAuth(req: Request, requestedClientId: string | undefined, dryRun: boolean): Promise<
  | { ok: true; clientId: string; isAdmin: boolean }
  | { ok: false; status: number; error: string }
> {
  const token = authToken(req);
  if (!token) return { ok: false, status: 401, error: "Not authenticated" };
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!userData.user) return { ok: false, status: 401, error: "Invalid token" };
  if (userData.user.email) {
    const { data: staff } = await supabaseAdmin.from("staff").select("role, active").eq("email", userData.user.email).maybeSingle();
    if (staff?.active && staff.role === "admin") {
      if (!requestedClientId) return { ok: true, clientId: userData.user.id, isAdmin: true };
      if (!dryRun) return { ok: false, status: 400, error: "Admin runs against arbitrary clientId require dryRun=true" };
      return { ok: true, clientId: requestedClientId, isAdmin: true };
    }
  }
  if (requestedClientId && requestedClientId !== userData.user.id) {
    return { ok: false, status: 403, error: "Client can only recommend for their own user id" };
  }
  return { ok: true, clientId: userData.user.id, isAdmin: false };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: `Invalid body: ${parsed.error.message}` }, { status: 400 });
  }
  const { mode, metrics, attestations, candidate_actions, target_count, include_meals, dryRun = false } = parsed.data;

  const auth = await resolveAuth(req, parsed.data.clientId, dryRun);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  // ─── Pull meal candidates if requested ──────────────────────
  // Server-side allergen + mode filter — never let the model see a
  // meal that conflicts with the user's attestations.
  const mealCandidates: CandidateMeal[] = [];
  const droppedServerSide: { key: string; reason: string }[] = [];
  if (include_meals) {
    const { data: mealRows } = await supabaseAdmin
      .from("meals")
      .select("id, name, category, ingredients, prep_time_min, cook_time_min, difficulty, calories, protein, dietary_tags")
      .order("name");
    for (const m of (mealRows || []) as MealRow[]) {
      const ingredients = m.ingredients || [];
      const allergens = attestations?.allergies
        ? detectAllergenConflicts(ingredients, attestations.allergies)
        : [];
      if (allergens.length > 0) continue; // silently drop, not user-visible
      const c: CandidateMeal = {
        id: m.id,
        name: m.name,
        slot: m.category,
        difficulty: m.difficulty,
        prep_min: m.prep_time_min || 0,
        cook_min: m.cook_time_min || 0,
        protein_g: m.protein,
        calories: m.calories,
        dietary_tags: m.dietary_tags || [],
        ingredients,
        is_high_protein_keystone: ((m.dietary_tags || []).includes("high-protein"))
          || (m.protein !== null && m.protein >= (m.category === "snack" ? 20 : 35)),
      };
      if (!mealAppropriateForMode(c, mode).ok) continue;
      mealCandidates.push(c);
    }
  }

  if (candidate_actions.length === 0 && mealCandidates.length === 0) {
    return NextResponse.json({
      ok: true,
      recommendation: { ordered_items: [], dropped_items: [], overall_rationale: "No candidates available." },
      log_id: null,
      model: MODELS.actions,
      dry_run: dryRun,
    });
  }

  // ─── Build the prompt ───────────────────────────────────────
  // Cap meal candidates at 12 — but interleave by slot so each of
  // breakfast/lunch/dinner/snack gets ~3 candidates in the pool.
  // Earlier sort-by-keystone-then-alphabetical biased toward
  // breakfast/lunch/snack labels and starved dinner candidates,
  // so the AI rarely had a dinner option to pick.
  const mealCap = 12;
  const slotBuckets = new Map<string, CandidateMeal[]>();
  for (const m of mealCandidates) {
    const arr = slotBuckets.get(m.slot) || [];
    arr.push(m);
    slotBuckets.set(m.slot, arr);
  }
  // Within each slot, keystone-first then leave natural order.
  for (const arr of slotBuckets.values()) {
    arr.sort((a, b) => (b.is_high_protein_keystone ? 1 : 0) - (a.is_high_protein_keystone ? 1 : 0));
  }
  const slotOrder: Array<"breakfast" | "lunch" | "dinner" | "snack"> = ["breakfast", "lunch", "dinner", "snack"];
  const mealsForPrompt: CandidateMeal[] = [];
  let pulled = true;
  while (mealsForPrompt.length < mealCap && pulled) {
    pulled = false;
    for (const slot of slotOrder) {
      const arr = slotBuckets.get(slot);
      if (arr && arr.length > 0) {
        mealsForPrompt.push(arr.shift()!);
        pulled = true;
        if (mealsForPrompt.length >= mealCap) break;
      }
    }
  }

  const actionLines = candidate_actions.map((a, i) => {
    const tags: string[] = [];
    if (a.is_keystone) tags.push("KEYSTONE");
    if (a.intensity) tags.push(`intensity=${a.intensity}`);
    if (a.is_priority) tags.push("PRIORITY");
    return `${i + 1}. source=program_action category=${a.category} key=${a.key} — ${a.label}${tags.length ? ` (${tags.join(", ")})` : ""}`;
  }).join("\n");

  const mealLines = mealsForPrompt.map((m, i) => {
    const tags: string[] = [];
    if (m.is_high_protein_keystone) tags.push("KEYSTONE-PROTEIN");
    tags.push(`slot=${m.slot}`);
    if (m.protein_g !== null) tags.push(`protein=${m.protein_g}g`);
    tags.push(`time=${(m.prep_min || 0) + (m.cook_min || 0)}min`);
    return `${candidate_actions.length + i + 1}. source=meal category=nutrition key=${m.id} — ${m.name} (${tags.join(", ")})`;
  }).join("\n");

  const userPrompt = `TASK: Build a balanced daily plan from candidate items across four pillars.

USER MODE: ${mode}
TARGET COUNT: ${target_count} items

USER METRICS:
${metricsBlock((metrics as UserMetrics) || {
  sleep_hours_last_night: null, sleep_hours_3day_avg: null, hrv_today_ms: null,
  hrv_baseline_ms: null, rhr_today_bpm: null, rhr_baseline_bpm: null, soreness_self_rating: null,
})}

USER ATTESTATIONS (HARD SAFETY CONSTRAINTS):
${attestationsBlock(attestations as Attestations | null)}

CANDIDATE ITEMS (mix of program actions + meals):
${actionLines}
${mealLines ? `\n${mealLines}` : ""}

Build a daily plan with these rules:
- Pillar balance is the primary directive. Across exercise / nutrition / sleep / mental, distribute roughly evenly. With target_count=6 spanning 4 pillars, aim for ~1-2 per pillar.
- Cover breadth before depth: the FIRST keystone in every available pillar must appear before any pillar gets a second pick.
- Keystone-tagged items are clinically pre-vetted as highest yield — prefer them.
- MEAL SLOT COVERAGE: when nutrition has 2+ picks, cover different slots — pick one breakfast + one lunch OR dinner + optionally one snack. Never pick two breakfasts or two snacks on the same day.
- EXERCISE MUSCLE BALANCE: when 2+ exercise items are picked, vary the muscle group focus. Don't pick two push (chest/shoulders/triceps) sessions or two pull (back/biceps) sessions on the same day. A push session pairs with legs or a conditioning session, never with another push. Same for pull. Full-body sessions are flexible — pair freely.
- Honor safety: never recommend against limitations or allergies. Sick → only sleep + hydration + breathwork. Tired → cap exercise at gentle.

For each kept item return: key (echo exactly), category, source ('program_action' or 'meal'), rank (1 = highest), yield_score 1-5, one-line rationale (≤ 15 words).
For each dropped item: key + one-word reason ('low_yield', 'redundant', 'safety', 'mode_mismatch', 'over_budget').
Return overall_rationale (1 sentence, ≤ 25 words) summarising the day's shape.`;

  let rec;
  try {
    rec = await callRecommender(dayRecSchema, userPrompt, 6000, "actions");
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "/api/ai/recommend-day" } });
    return NextResponse.json({ ok: false, error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  // Hydrate the response with meal labels + macros so the RN
  // renderer doesn't need a second round-trip.
  const enrichedOrdered = rec.ordered_items.map((item) => {
    if (item.source === "meal") {
      const meal = mealCandidates.find((c) => c.id === item.key);
      return {
        ...item,
        meal: meal
          ? {
              name: meal.name,
              slot: meal.slot,
              protein_g: meal.protein_g,
              calories: meal.calories,
              is_high_protein_keystone: meal.is_high_protein_keystone,
            }
          : null,
      };
    }
    return item;
  });

  const allDropped = [...droppedServerSide, ...rec.dropped_items];

  let logId: string | null = null;
  try {
    logId = await logRecommendation({
      clientId: auth.clientId,
      type: "program_item",
      inputSnapshot: {
        source: "day_plan",
        mode,
        metrics,
        attestations,
        action_candidate_count: candidate_actions.length,
        meal_candidate_count: mealCandidates.length,
        target_count,
      },
      output: {
        ordered_keys: rec.ordered_items.map((i) => ({ key: i.key, source: i.source })),
        dropped_keys: rec.dropped_items.map((i) => i.key),
      },
      reasonText: rec.overall_rationale,
      dryRun,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Log write failed: ${(e as Error).message}`, recommendation: rec }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    recommendation: {
      ordered_items: enrichedOrdered,
      dropped_items: allDropped,
      overall_rationale: rec.overall_rationale,
    },
    log_id: logId,
    model: MODELS.actions,
    dry_run: dryRun,
  });
}
