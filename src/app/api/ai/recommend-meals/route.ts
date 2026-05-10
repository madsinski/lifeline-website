// POST /api/ai/recommend-meals
//
// Nutrition-pillar recommender. Pulls candidates from the `meals`
// table (separate library from program_actions), drops allergen-
// conflicting + mode-inappropriate meals server-side BEFORE the
// model sees them (defence in depth — never let the AI surface a
// peanut snack to a flagged nut allergy), then asks the model to
// rank the safe survivors by yield + meal-slot coverage.
//
// Allergen filter is conservative: ingredient-name pattern matching
// (see ALLERGEN_PATTERNS in ai-recommender.ts). Better to drop a
// safe meal than surface a risky one.
//
// Auth model identical to recommend-mode + recommend-actions: user
// JWT for own data; admin JWT + dryRun=true for the test bench.

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  AI_MODEL,
  attestationsBlock,
  callRecommender,
  detectAllergenConflicts,
  logRecommendation,
  mealAppropriateForMode,
  mealRecSchema,
  mealsBlock,
  type Attestations,
  type CandidateMeal,
} from "@/lib/ai-recommender";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  clientId: z.string().uuid().optional(),
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
  meal_slot: z.enum(["breakfast", "lunch", "dinner", "snack", "all"]).default("all"),
  target_count: z.number().int().min(1).max(10).default(4),
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
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("role, active")
      .eq("email", userData.user.email)
      .maybeSingle();
    if (staff?.active && staff.role === "admin") {
      if (!requestedClientId) return { ok: true, clientId: userData.user.id, isAdmin: true };
      if (!dryRun) {
        return { ok: false, status: 400, error: "Admin runs against arbitrary clientId require dryRun=true" };
      }
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
  const { mode, attestations, meal_slot, target_count, dryRun = false } = parsed.data;

  const auth = await resolveAuth(req, parsed.data.clientId, dryRun);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  // Pull candidate meals (server-side, service role bypasses RLS).
  let q = supabaseAdmin
    .from("meals")
    .select("id, name, category, ingredients, prep_time_min, cook_time_min, difficulty, calories, protein, dietary_tags")
    .order("name");
  if (meal_slot !== "all") q = q.eq("category", meal_slot);
  const { data: mealRows, error: mealErr } = await q;
  if (mealErr) {
    return NextResponse.json({ ok: false, error: `meals fetch failed: ${mealErr.message}` }, { status: 500 });
  }
  const allMeals = (mealRows || []) as MealRow[];

  // Allergen + mode filter happens here, BEFORE the model sees
  // anything. Track drops so the response can show them in the
  // "dropped" panel for transparency.
  const droppedServerSide: { id: string; name: string; reason: string }[] = [];
  const candidates: CandidateMeal[] = [];
  for (const m of allMeals) {
    const ingredients = m.ingredients || [];
    const allergens = attestations?.allergies
      ? detectAllergenConflicts(ingredients, attestations.allergies)
      : [];
    if (allergens.length > 0) {
      droppedServerSide.push({ id: m.id, name: m.name, reason: `Allergen conflict: ${allergens.join(", ")}` });
      continue;
    }
    const candidate: CandidateMeal = {
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
    const modeCheck = mealAppropriateForMode(candidate, mode);
    if (!modeCheck.ok) {
      droppedServerSide.push({ id: m.id, name: m.name, reason: modeCheck.reason });
      continue;
    }
    candidates.push(candidate);
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      recommendation: {
        ordered_meals: [],
        dropped_meals: droppedServerSide,
        overall_rationale: `All ${allMeals.length} candidate meals were dropped by allergen/mode filter — review attestations or seed more meals.`,
      },
      candidate_count: 0,
      total_count: allMeals.length,
      log_id: null,
      model: AI_MODEL,
      dry_run: dryRun,
    });
  }

  const userPrompt = `TASK: Pick the highest-yield meals for the user today. The candidate list has already been pre-filtered server-side for allergen safety and mode appropriateness — you don't need to re-check those.

MODE: ${mode}
SLOT FOCUS: ${meal_slot === "all" ? "any (cover slots)" : meal_slot}
TARGET COUNT: ${target_count}

USER ATTESTATIONS (informational only — allergens already filtered):
${attestationsBlock(attestations as Attestations | null)}

CANDIDATE MEALS:
${mealsBlock(candidates)}

For each meal you keep:
- rank (1 = highest priority)
- yield_score 1-5 (high-protein keystone meals start at 4 unless mode demotes them; allergen-clean low-protein snacks default to 2-3)
- One-line rationale (max 20 words) — say WHY this meal for THIS user TODAY

For each meal you drop:
- Reason (low yield, redundant, time/effort doesn't justify)

Return overall_rationale (1-2 sentences) summarising the day's nutrition shape.`;

  let rec;
  try {
    rec = await callRecommender(mealRecSchema, userPrompt, 2000);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  // Merge AI drops with server-side drops so the caller sees the full
  // picture. Server drops take precedence (they're the safety layer).
  const combinedDropped = [
    ...droppedServerSide,
    ...rec.dropped_meals.map((d) => {
      const meal = candidates.find((c) => c.id === d.id);
      return { id: d.id, name: meal?.name || d.id, reason: d.reason };
    }),
  ];

  let logId: string | null = null;
  try {
    logId = await logRecommendation({
      clientId: auth.clientId,
      type: "program_item",
      inputSnapshot: {
        source: "meals",
        mode,
        meal_slot,
        attestations,
        candidate_count: candidates.length,
        dropped_server_side: droppedServerSide.length,
        target_count,
      },
      output: {
        ordered_meal_ids: rec.ordered_meals.map((m) => m.id),
        dropped_meal_ids: combinedDropped.map((d) => d.id),
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
      ordered_meals: rec.ordered_meals.map((m) => {
        const meal = candidates.find((c) => c.id === m.id);
        return {
          ...m,
          name: meal?.name,
          slot: meal?.slot,
          protein_g: meal?.protein_g,
          calories: meal?.calories,
          is_high_protein_keystone: meal?.is_high_protein_keystone,
        };
      }),
      dropped_meals: combinedDropped,
      overall_rationale: rec.overall_rationale,
    },
    candidate_count: candidates.length,
    total_count: allMeals.length,
    log_id: logId,
    model: AI_MODEL,
    dry_run: dryRun,
  });
}
