// POST /api/ai/swap-meal
//
// User wants to swap a meal that was recommended (or a meal in their
// day plan). Return N alternatives that:
//   - Same slot (breakfast for breakfast) unless caller overrides.
//   - Pass the user's allergen filter (server-side, before model).
//   - Pass mode-appropriateness (sick / tired / vacation gates).
//   - Approximate the macros of the current meal (within ±25% protein
//     when possible — high-yield policy preserves protein anchoring).
//
// Auth model identical to the other AI endpoints.

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  MODELS,
  attestationsBlock,
  callRecommender,
  detectAllergenConflicts,
  logRecommendation,
  mealAppropriateForMode,
  mealsBlock,
  swapRecSchema,
  type Attestations,
  type CandidateMeal,
} from "@/lib/ai-recommender";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  clientId: z.string().uuid().optional(),
  current_meal_id: z.string().uuid(),
  alternatives_count: z.number().int().min(1).max(8).default(3),
  mode: z.enum(["vacation", "normal", "beast", "sick", "tired"]),
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
  same_slot: z.boolean().default(true),
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
    return { ok: false, status: 403, error: "Client can only swap for their own user id" };
  }
  return { ok: true, clientId: userData.user.id, isAdmin: false };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: `Invalid body: ${parsed.error.message}` }, { status: 400 });
  const { current_meal_id, alternatives_count, mode, attestations, same_slot, dryRun = false } = parsed.data;

  const auth = await resolveAuth(req, parsed.data.clientId, dryRun);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { data: currentRow } = await supabaseAdmin
    .from("meals")
    .select("id, name, category, ingredients, prep_time_min, cook_time_min, difficulty, calories, protein, dietary_tags")
    .eq("id", current_meal_id)
    .maybeSingle();
  if (!currentRow) return NextResponse.json({ ok: false, error: "current_meal_id not found" }, { status: 404 });
  const current = currentRow as MealRow;

  let q = supabaseAdmin
    .from("meals")
    .select("id, name, category, ingredients, prep_time_min, cook_time_min, difficulty, calories, protein, dietary_tags")
    .neq("id", current_meal_id);
  if (same_slot) q = q.eq("category", current.category);
  const { data: poolRows, error: poolErr } = await q;
  if (poolErr) return NextResponse.json({ ok: false, error: `meals fetch failed: ${poolErr.message}` }, { status: 500 });
  const pool = (poolRows || []) as MealRow[];

  const candidates: CandidateMeal[] = [];
  for (const m of pool) {
    const ingredients = m.ingredients || [];
    const allergens = attestations?.allergies ? detectAllergenConflicts(ingredients, attestations.allergies) : [];
    if (allergens.length > 0) continue;
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
      is_high_protein_keystone: ((m.dietary_tags || []).includes("high-protein")) || (m.protein !== null && m.protein >= 25),
    };
    if (!mealAppropriateForMode(c, mode).ok) continue;
    candidates.push(c);
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      alternatives: [],
      current_meal: { id: current.id, name: current.name, slot: current.category, protein_g: current.protein, calories: current.calories },
      candidate_count: 0,
      log_id: null,
      model: MODELS.swap,
      dry_run: dryRun,
      message: "No safe alternatives in the meals library — try seeding more or adjusting filters.",
    });
  }

  const userPrompt = `TASK: The user wants to swap this meal — pick ${alternatives_count} alternatives.

CURRENT MEAL:
- ${current.name} (${current.category}, protein=${current.protein ?? "?"}g, kcal=${current.calories ?? "?"}, difficulty=${current.difficulty}, time=${(current.prep_time_min || 0) + (current.cook_time_min || 0)}min)

MODE: ${mode}
USER ATTESTATIONS (informational — allergens already filtered):
${attestationsBlock(attestations as Attestations | null)}

CANDIDATE ALTERNATIVES (allergen + mode safe):
${mealsBlock(candidates)}

Pick ${alternatives_count} alternatives that:
- Approximate the current meal's macros (especially protein — within ±25%).
- Offer real variety (different ingredient base, not the same meal renamed).
- Prefer KEYSTONE-PROTEIN candidates when available.

For each alternative:
- rank (1 = closest match by yield + macro fit)
- One-line rationale (max 15 words) — say WHY this is a good swap for the current meal.

Return overall_rationale (1 sentence, max 25 words) explaining the swap shape.`;

  let rec;
  try {
    rec = await callRecommender(swapRecSchema, userPrompt, 1200, "swap");
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "/api/ai/swap-meal" } });
    return NextResponse.json({ ok: false, error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  let logId: string | null = null;
  try {
    logId = await logRecommendation({
      clientId: auth.clientId,
      type: "program_item",
      inputSnapshot: {
        source: "meals_swap",
        current_meal_id,
        alternatives_count,
        mode,
        attestations,
        candidate_count: candidates.length,
        same_slot,
      },
      output: {
        alternative_meal_ids: rec.alternatives.map((a) => a.id),
      },
      reasonText: rec.overall_rationale,
      dryRun,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Log write failed: ${(e as Error).message}`, recommendation: rec }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    alternatives: rec.alternatives.map((a) => {
      const meal = candidates.find((c) => c.id === a.id);
      return {
        ...a,
        name: meal?.name,
        slot: meal?.slot,
        protein_g: meal?.protein_g,
        calories: meal?.calories,
        difficulty: meal?.difficulty,
        is_high_protein_keystone: meal?.is_high_protein_keystone,
      };
    }),
    overall_rationale: rec.overall_rationale,
    current_meal: { id: current.id, name: current.name, slot: current.category, protein_g: current.protein, calories: current.calories },
    candidate_count: candidates.length,
    log_id: logId,
    model: MODELS.swap,
    dry_run: dryRun,
  });
}
