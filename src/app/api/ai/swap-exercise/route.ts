// POST /api/ai/swap-exercise
//
// User wants to swap an exercise within a session. Pulls candidates
// from the `exercises` library (free-exercise-db, 869 entries with
// MP4 loops), filters by:
//   - Same primary muscle group (or caller-overridden category).
//   - Compatible equipment (caller passes available equipment, e.g.
//     from onboarding ExerciseProfile.homeEquipment, OR we accept
//     the same equipment the current exercise uses).
//   - Limitations from user attestations (knee → drop high-impact
//     leg moves; wrist → drop push-ups + planks; etc.).
//
// Then asks the AI to rank N alternatives by movement-pattern fit
// + variety + difficulty match.

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  MODELS,
  attestationsBlock,
  callRecommender,
  EQUIPMENT_GROUPS,
  exerciseListBlock,
  logRecommendation,
  swapRecSchema,
  type Attestations,
  type CandidateExercise,
} from "@/lib/ai-recommender";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  clientId: z.string().uuid().optional(),
  current_exercise_id: z.string().uuid(),
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
  // Equipment available to the user. When omitted, we use whatever
  // the current exercise uses (matches "I have what they're already
  // doing" assumption).
  available_equipment: z.array(z.string()).optional(),
  // When false, also surface alternatives from neighbouring muscle
  // categories (e.g. swap a chest move for a shoulders move). Default
  // true — same category.
  same_category: z.boolean().default(true),
  dryRun: z.boolean().optional(),
});

interface ExerciseRow {
  id: string;
  name: string;
  category: string;
  equipment: string;
  difficulty: string;
  muscles_targeted: string[] | null;
  video_url: string | null;
}

// Limitation → category/equipment patterns to drop. Mirrors the
// "never recommend against" safety rule. Conservative: better to
// drop a safe alternative than surface a risky one.
function violatesLimitation(ex: ExerciseRow, limits: { knee: boolean; back: boolean; shoulder: boolean; wrist: boolean; cardio: boolean }): string | null {
  const name = (ex.name || "").toLowerCase();
  const muscles = (ex.muscles_targeted || []).map((m) => m.toLowerCase());
  if (limits.knee) {
    // Drop deep flexion + high-impact for knees.
    if (/squat|lunge|jump|box jump|burpee|step.?up|sprint/.test(name)) return "knee: high-impact / deep-flexion";
  }
  if (limits.back) {
    // Drop heavy spinal-loaded moves.
    if (/deadlift|good morning|barbell row|barbell squat|barbell bench|barbell press/.test(name)) return "back: heavy spinal load";
    if (muscles.includes("lower back") && /heavy|barbell/.test(name)) return "back: heavy lower-back load";
  }
  if (limits.shoulder) {
    if (/overhead|press|snatch|clean|jerk|pull.?up|chin.?up|dip/.test(name)) return "shoulder: overhead / loaded shoulder";
  }
  if (limits.wrist) {
    if (/push.?up|plank|handstand|burpee|front squat/.test(name)) return "wrist: weighted grip / impact";
  }
  if (limits.cardio) {
    if (ex.category === "cardio" || /sprint|hiit|burpee|jump|jog|run/.test(name)) return "cardio: capped at moderate";
  }
  return null;
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
  const { current_exercise_id, alternatives_count, mode, attestations, available_equipment, same_category, dryRun = false } = parsed.data;

  const auth = await resolveAuth(req, parsed.data.clientId, dryRun);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { data: currentRow } = await supabaseAdmin
    .from("exercises")
    .select("id, name, category, equipment, difficulty, muscles_targeted, video_url")
    .eq("id", current_exercise_id)
    .maybeSingle();
  if (!currentRow) return NextResponse.json({ ok: false, error: "current_exercise_id not found" }, { status: 404 });
  const current = currentRow as ExerciseRow;

  // Equipment compatibility set: if caller passed available_equipment,
  // expand each entry through EQUIPMENT_GROUPS so e.g. "dumbbells"
  // also accepts "kettlebell". Otherwise fall back to the current
  // exercise's own equipment + bodyweight.
  const equipmentSet = new Set<string>();
  if (available_equipment && available_equipment.length > 0) {
    for (const e of available_equipment) {
      const group = EQUIPMENT_GROUPS[e] || [e];
      for (const g of group) equipmentSet.add(g);
    }
    equipmentSet.add("bodyweight");
    equipmentSet.add("none");
  } else {
    const group = EQUIPMENT_GROUPS[current.equipment] || [current.equipment];
    for (const g of group) equipmentSet.add(g);
  }

  let q = supabaseAdmin
    .from("exercises")
    .select("id, name, category, equipment, difficulty, muscles_targeted, video_url")
    .neq("id", current_exercise_id);
  if (same_category) q = q.eq("category", current.category);
  // Cap server-side so we never load all 869 into memory.
  q = q.limit(120);
  const { data: poolRows, error: poolErr } = await q;
  if (poolErr) return NextResponse.json({ ok: false, error: `exercises fetch failed: ${poolErr.message}` }, { status: 500 });
  const pool = (poolRows || []) as ExerciseRow[];

  // Server-side filters: equipment compat + limitation safety.
  // Vigorous-mode caps live here too: sick + tired drop everything
  // that smells like cardio sprint or HIIT.
  const candidates: CandidateExercise[] = [];
  for (const ex of pool) {
    if (!equipmentSet.has(ex.equipment)) continue;
    if (attestations?.limitations && violatesLimitation(ex, attestations.limitations)) continue;
    if ((mode === "sick" || mode === "tired") && /sprint|hiit|jump|burpee/i.test(ex.name)) continue;
    candidates.push({
      id: ex.id,
      name: ex.name,
      category: ex.category,
      equipment: ex.equipment,
      difficulty: ex.difficulty,
      muscles_targeted: ex.muscles_targeted || [],
      has_video: !!ex.video_url,
    });
  }

  // Cap candidates fed to AI (prompt + output budget). Prefer
  // beginner/intermediate first to align with the high-yield default.
  const ordered = [...candidates].sort((a, b) => {
    const order = { beginner: 0, intermediate: 1, advanced: 2 } as Record<string, number>;
    return (order[a.difficulty] ?? 3) - (order[b.difficulty] ?? 3);
  }).slice(0, 30);

  if (ordered.length === 0) {
    return NextResponse.json({
      ok: true,
      alternatives: [],
      current_exercise: { id: current.id, name: current.name, category: current.category, equipment: current.equipment, difficulty: current.difficulty, has_video: !!current.video_url },
      candidate_count: 0,
      log_id: null,
      model: MODELS.swap,
      dry_run: dryRun,
      message: "No safe alternatives — equipment + limitation filter dropped everything in this category.",
    });
  }

  const userPrompt = `TASK: The user wants to swap this exercise — pick ${alternatives_count} alternatives from the library.

CURRENT EXERCISE:
- ${current.name} (${current.category}, equipment=${current.equipment}, difficulty=${current.difficulty}, muscles=[${(current.muscles_targeted || []).join(", ")}])

MODE: ${mode}
USER ATTESTATIONS (informational — limitations + cardio caps already applied):
${attestationsBlock(attestations as Attestations | null)}

CANDIDATE ALTERNATIVES (equipment + limitation safe):
${exerciseListBlock(ordered)}

Pick ${alternatives_count} alternatives that:
- Hit the same primary muscle group (or close — same movement pattern).
- Match the difficulty within one tier.
- Offer real variety (different movement, not the same exercise renamed).
- Prefer items with video.

For each alternative:
- rank (1 = closest match)
- One-line rationale (max 15 words) — say WHY this is a good swap.

Return overall_rationale (1 sentence, max 25 words) explaining the swap shape.`;

  let rec;
  try {
    rec = await callRecommender(swapRecSchema, userPrompt, 1200, "swap");
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "/api/ai/swap-exercise" } });
    return NextResponse.json({ ok: false, error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  let logId: string | null = null;
  try {
    logId = await logRecommendation({
      clientId: auth.clientId,
      type: "program_item",
      inputSnapshot: {
        source: "exercises_swap",
        current_exercise_id,
        alternatives_count,
        mode,
        attestations,
        candidate_count: ordered.length,
        same_category,
        equipment_set: Array.from(equipmentSet),
      },
      output: {
        alternative_exercise_ids: rec.alternatives.map((a) => a.id),
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
      const ex = ordered.find((c) => c.id === a.id);
      return {
        ...a,
        name: ex?.name,
        category: ex?.category,
        equipment: ex?.equipment,
        difficulty: ex?.difficulty,
        muscles_targeted: ex?.muscles_targeted,
        has_video: ex?.has_video,
      };
    }),
    overall_rationale: rec.overall_rationale,
    current_exercise: { id: current.id, name: current.name, category: current.category, equipment: current.equipment, difficulty: current.difficulty, has_video: !!current.video_url },
    candidate_count: ordered.length,
    log_id: logId,
    model: MODELS.swap,
    dry_run: dryRun,
  });
}
