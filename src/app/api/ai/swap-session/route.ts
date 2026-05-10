// POST /api/ai/swap-session
//
// Session/program-level environment swap. Take a workout session
// (e.g. "Full Body A — Push focus" with barbell bench, pull-ups,
// dumbbell rows) and rebuild it for a different environment
// (e.g. "home" → push-ups, inverted rows, towel rows).
//
// Pulls the session's exercises from action_exercises, then for
// each exercise asks the AI to pick the best home/gym/hybrid
// alternative from the exercise library that matches movement
// pattern + difficulty. Server-side filters: equipment compat
// (target_environment expanded via EQUIPMENT_GROUPS) + limitation
// safety + mode caps.
//
// Returns: original session metadata + per-exercise substitutions
// (each carrying current + alternative + rationale). The caller
// can render this as a side-by-side or accept-all to commit a
// swapped day plan.

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  MODELS,
  attestationsBlock,
  callRecommender,
  EQUIPMENT_GROUPS,
  type Attestations,
  type CandidateExercise,
} from "@/lib/ai-recommender";

export const runtime = "nodejs";
export const maxDuration = 60;

const ENV_TO_EQUIPMENT: Record<string, string[]> = {
  home: ["bodyweight", "none", "dumbbells", "kettlebell", "bands"],
  gym: ["barbell", "machine", "cables", "dumbbells", "kettlebell", "bodyweight"],
  hybrid: ["barbell", "machine", "cables", "dumbbells", "kettlebell", "bands", "bodyweight", "none"],
};

const requestSchema = z.object({
  clientId: z.string().uuid().optional(),
  // Either pass action_key + program_key + week + day to load from
  // action_exercises, OR pass an explicit list of exercise_ids to
  // substitute. The first form is what production callers use; the
  // second form is the bench's quick test path.
  source: z.union([
    z.object({
      mode: z.literal("from_session"),
      action_key: z.string(),
      program_key: z.string(),
      week_range: z.number().int(),
      day_of_week: z.number().int(),
    }),
    z.object({
      mode: z.literal("from_exercise_ids"),
      exercise_ids: z.array(z.string().uuid()).min(1).max(20),
    }),
  ]),
  target_environment: z.enum(["home", "gym", "hybrid"]),
  user_mode: z.enum(["vacation", "normal", "beast", "sick", "tired"]),
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

// Mirror of the limitation check in swap-exercise (kept inline so
// session swap is independent — both could be extracted to a shared
// helper if more endpoints need them).
function violatesLimitation(ex: ExerciseRow, limits: { knee: boolean; back: boolean; shoulder: boolean; wrist: boolean; cardio: boolean }): string | null {
  const name = (ex.name || "").toLowerCase();
  const muscles = (ex.muscles_targeted || []).map((m) => m.toLowerCase());
  if (limits.knee && /squat|lunge|jump|box jump|burpee|step.?up|sprint/.test(name)) return "knee";
  if (limits.back && /deadlift|good morning|barbell row|barbell squat|barbell bench|barbell press/.test(name)) return "back";
  if (limits.back && muscles.includes("lower back") && /heavy|barbell/.test(name)) return "back";
  if (limits.shoulder && /overhead|press|snatch|clean|jerk|pull.?up|chin.?up|dip/.test(name)) return "shoulder";
  if (limits.wrist && /push.?up|plank|handstand|burpee|front squat/.test(name)) return "wrist";
  if (limits.cardio && (ex.category === "cardio" || /sprint|hiit|burpee|jump|jog|run/.test(name))) return "cardio";
  return null;
}

const sessionSwapSchema = z.object({
  substitutions: z.array(z.object({
    current_exercise_id: z.string(),
    chosen_alternative_id: z.string(),
    rationale: z.string(),
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
    return { ok: false, status: 403, error: "Client can only swap for their own user id" };
  }
  return { ok: true, clientId: userData.user.id, isAdmin: false };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: `Invalid body: ${parsed.error.message}` }, { status: 400 });
  const { source, target_environment, user_mode, attestations, dryRun = false } = parsed.data;

  const auth = await resolveAuth(req, parsed.data.clientId, dryRun);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  // Load the source exercises — either via action_exercises join or
  // direct ids.
  let currentExercises: ExerciseRow[] = [];
  let sessionLabel: string | null = null;
  if (source.mode === "from_session") {
    const { data: junctionRows } = await supabaseAdmin
      .from("action_exercises")
      .select("exercise_id, exercise_name, sort_order")
      .eq("action_key", source.action_key)
      .eq("program_key", source.program_key)
      .eq("week_range", source.week_range)
      .eq("day_of_week", source.day_of_week)
      .order("sort_order");
    const exerciseIds = (junctionRows || []).map((r: { exercise_id: string }) => r.exercise_id);
    if (exerciseIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Session has no exercises mapped" }, { status: 404 });
    }
    const { data: exRows } = await supabaseAdmin
      .from("exercises")
      .select("id, name, category, equipment, difficulty, muscles_targeted, video_url")
      .in("id", exerciseIds);
    currentExercises = ((exRows || []) as ExerciseRow[])
      .sort((a, b) => exerciseIds.indexOf(a.id) - exerciseIds.indexOf(b.id));
    // Pull the session label for the response header.
    const { data: actionRow } = await supabaseAdmin
      .from("program_actions")
      .select("label")
      .eq("action_key", source.action_key)
      .limit(1)
      .maybeSingle();
    sessionLabel = (actionRow as { label: string } | null)?.label || source.action_key;
  } else {
    const { data: exRows } = await supabaseAdmin
      .from("exercises")
      .select("id, name, category, equipment, difficulty, muscles_targeted, video_url")
      .in("id", source.exercise_ids);
    currentExercises = ((exRows || []) as ExerciseRow[])
      .sort((a, b) => source.exercise_ids.indexOf(a.id) - source.exercise_ids.indexOf(b.id));
  }

  if (currentExercises.length === 0) {
    return NextResponse.json({ ok: false, error: "No source exercises found" }, { status: 404 });
  }

  // Equipment compatibility set for the target environment.
  const allowedEquipment = new Set<string>();
  for (const e of ENV_TO_EQUIPMENT[target_environment]) {
    const group = EQUIPMENT_GROUPS[e] || [e];
    for (const g of group) allowedEquipment.add(g);
  }

  // For each current exercise, fetch up to 25 same-category candidates
  // from the library + filter by equipment + limitations + mode caps.
  // One DB query per exercise — fine for typical session sizes (4-8
  // exercises) but cap at 12 to keep latency bounded.
  const SESSION_CAP = 12;
  const sessionExercises = currentExercises.slice(0, SESSION_CAP);
  const candidatesByCurrent: { current: ExerciseRow; candidates: CandidateExercise[] }[] = [];
  for (const cur of sessionExercises) {
    const { data: poolRows } = await supabaseAdmin
      .from("exercises")
      .select("id, name, category, equipment, difficulty, muscles_targeted, video_url")
      .eq("category", cur.category)
      .neq("id", cur.id)
      .limit(80);
    const pool = (poolRows || []) as ExerciseRow[];
    const filtered: CandidateExercise[] = [];
    for (const ex of pool) {
      if (!allowedEquipment.has(ex.equipment)) continue;
      if (attestations?.limitations && violatesLimitation(ex, attestations.limitations)) continue;
      if ((user_mode === "sick" || user_mode === "tired") && /sprint|hiit|jump|burpee/i.test(ex.name)) continue;
      filtered.push({
        id: ex.id,
        name: ex.name,
        category: ex.category,
        equipment: ex.equipment,
        difficulty: ex.difficulty,
        muscles_targeted: ex.muscles_targeted || [],
        has_video: !!ex.video_url,
      });
    }
    // Cap per-current candidates to 12 so the prompt stays compact.
    const ordered = filtered.sort((a, b) => {
      const order = { beginner: 0, intermediate: 1, advanced: 2 } as Record<string, number>;
      return (order[a.difficulty] ?? 3) - (order[b.difficulty] ?? 3);
    }).slice(0, 12);
    candidatesByCurrent.push({ current: cur, candidates: ordered });
  }

  // Drop any current exercise that has zero safe candidates (e.g. no
  // home alternative for a heavy barbell move). Surface to the caller
  // so they know the substitution gap.
  const noAltFor = candidatesByCurrent
    .filter((p) => p.candidates.length === 0)
    .map((p) => ({ id: p.current.id, name: p.current.name, reason: `No safe ${target_environment} alternative for ${p.current.equipment}` }));
  const swappable = candidatesByCurrent.filter((p) => p.candidates.length > 0);

  if (swappable.length === 0) {
    return NextResponse.json({
      ok: true,
      session_label: sessionLabel,
      target_environment,
      substitutions: [],
      no_alternative_for: noAltFor,
      log_id: null,
      model: MODELS.swap,
      dry_run: dryRun,
      overall_rationale: `No ${target_environment} alternatives available — try hybrid mode or seed more exercises.`,
    });
  }

  const promptBlocks = swappable.map((p, i) => {
    const candList = p.candidates.map((c, j) => {
      const tags: string[] = [`equipment=${c.equipment}`, `difficulty=${c.difficulty}`];
      if (c.has_video) tags.push("video");
      return `   ${j + 1}. id=${c.id} — ${c.name} (${tags.join(", ")})`;
    }).join("\n");
    return `EXERCISE ${i + 1} (current_exercise_id=${p.current.id}): ${p.current.name} (current equipment: ${p.current.equipment}, difficulty: ${p.current.difficulty})
Candidate alternatives:
${candList}`;
  }).join("\n\n");

  const userPrompt = `TASK: Substitute the exercises in a workout session for a different training environment.

SESSION: ${sessionLabel || "(session swap)"}
TARGET ENVIRONMENT: ${target_environment}
USER MODE: ${user_mode}

USER ATTESTATIONS (informational — limitations + cardio caps already filtered):
${attestationsBlock(attestations as Attestations | null)}

For EACH exercise below, return one substitution object. Echo the current_exercise_id EXACTLY as given (it's in parentheses on the EXERCISE line) and pick exactly one chosen_alternative_id from that exercise's candidate list.

Selection criteria for the alternative:
- Hits the same muscle group / movement pattern.
- Matches the difficulty within one tier.
- Prefers items with video.
- Maintains overall session balance (don't pick all easy variants if the original was harder).

For each substitution provide a one-line rationale (max 15 words).

${promptBlocks}

Return overall_rationale (1-2 sentences) summarising how the session translates to ${target_environment}.`;

  let rec;
  try {
    rec = await callRecommender(sessionSwapSchema, userPrompt, 2500, "swap");
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "/api/ai/swap-session" } });
    return NextResponse.json({ ok: false, error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  // Hydrate the substitutions with names + metadata for the response.
  // Fallback chain for matching the "current" side: exact id match
  // first; if the AI hallucinated an id, fall back to position-based
  // matching against the swappable list (one substitution per current
  // exercise in the prompt order). The "alternative" side has the
  // same fallback against that current's candidate list.
  const substitutions = rec.substitutions.map((s, idx) => {
    let pair = swappable.find((p) => p.current.id === s.current_exercise_id);
    if (!pair && idx < swappable.length) pair = swappable[idx];
    let altMeta = pair?.candidates.find((c) => c.id === s.chosen_alternative_id);
    // If the AI returned an unrecognised alt id, default to the first
    // candidate (the server already pre-sorted by beginner-first).
    if (!altMeta && pair && pair.candidates.length > 0) altMeta = pair.candidates[0];
    return {
      current: pair ? { id: pair.current.id, name: pair.current.name, equipment: pair.current.equipment, difficulty: pair.current.difficulty } : null,
      alternative: altMeta ? { id: altMeta.id, name: altMeta.name, equipment: altMeta.equipment, difficulty: altMeta.difficulty, has_video: altMeta.has_video, muscles_targeted: altMeta.muscles_targeted } : null,
      rationale: s.rationale,
    };
  });

  // Fire-and-forget log entry. Logs even on dryRun=false so the
  // admin viewer can see what session swaps users perform — useful
  // signal for "where does the home library need more variety".
  let logId: string | null = null;
  try {
    const { data, error } = dryRun
      ? { data: null, error: null }
      : await supabaseAdmin
          .from("ai_recommendation_log")
          .insert({
            client_id: auth.clientId,
            type: "program_item",
            input_snapshot: {
              source: "session_swap",
              session_label: sessionLabel,
              target_environment,
              user_mode,
              attestations,
              source_count: currentExercises.length,
              swappable_count: swappable.length,
              no_alternative_count: noAltFor.length,
            },
            output: {
              substituted_pairs: rec.substitutions.map((s) => ({ from: s.current_exercise_id, to: s.chosen_alternative_id })),
            },
            reason_text: rec.overall_rationale,
            model: MODELS.swap,
          })
          .select("id")
          .single();
    if (error) throw new Error(error.message);
    logId = (data as { id: string } | null)?.id || null;
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Log write failed: ${(e as Error).message}`, recommendation: rec }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    session_label: sessionLabel,
    target_environment,
    substitutions,
    no_alternative_for: noAltFor,
    overall_rationale: rec.overall_rationale,
    log_id: logId,
    model: MODELS.swap,
    dry_run: dryRun,
  });
}
