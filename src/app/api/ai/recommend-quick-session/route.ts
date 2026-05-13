// POST /api/ai/recommend-quick-session
//
// User taps "Quick Session" and picks a session type. We pull
// candidate exercises from the exercises library filtered by the
// session intent + their available equipment + their attestations,
// fold in the last 2 days of accepted picks so the AI doesn't pair
// today's strength session with yesterday's same-muscle group, then
// ask gpt-5.4-mini to compose an ordered session.
//
// Session types map roughly to:
//   strength_gym       — barbell + machine + cable exercises
//   strength_home      — dumbbells / kettlebell / bands / bodyweight
//   cardio_run         — outdoor / treadmill running
//   cardio_bike        — outdoor / stationary cycling
//   cardio_other       — rowing, swimming, elliptical, etc.
//   zone2              — sustained low/medium intensity (any modality)
//   hiit_run           — interval running
//   hiit_bike          — interval cycling
//   hiit_other         — interval rowing / mixed conditioning
//   mobility           — light recovery / stretching / yoga-style
//
// Auth: same as the rest of the AI endpoints. dryRun=true for the
// bench / admin clients with arbitrary clientId.

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  MODELS,
  attestationsBlock,
  callRecommender,
  EQUIPMENT_GROUPS,
  type Attestations,
} from "@/lib/ai-recommender";

export const runtime = "nodejs";
export const maxDuration = 45;

export type QuickSessionType =
  | "strength_gym"
  | "strength_home"
  | "cardio_run"
  | "cardio_bike"
  | "cardio_other"
  | "zone2"
  | "hiit_run"
  | "hiit_bike"
  | "hiit_other"
  | "mobility";

const requestSchema = z.object({
  clientId: z.string().uuid().optional(),
  session_type: z.enum([
    "strength_gym",
    "strength_home",
    "cardio_run",
    "cardio_bike",
    "cardio_other",
    "zone2",
    "hiit_run",
    "hiit_bike",
    "hiit_other",
    "mobility",
  ]),
  duration_minutes: z.number().int().min(5).max(120).default(30),
  mode: z.enum(["vacation", "normal", "beast", "sick", "tired"]).default("normal"),
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
  available_equipment: z.array(z.string()).optional(),
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
  illustration_url: string | null;
}

// Maps each session type to:
//   categoryFilter: which exercises.category values are eligible
//   equipmentFilter: which equipment values to allow
//   sets/reps profile: prompted to the AI as the expected shape
const SESSION_PROFILES: Record<QuickSessionType, {
  categoryFilter: string[] | "any";
  equipmentFilter: string[] | "any";
  shape: string; // human-readable rep/duration prescription for the prompt
  nameRegexInclude?: RegExp;
  nameRegexExclude?: RegExp;
}> = {
  strength_gym: {
    categoryFilter: ["chest", "back", "shoulders", "arms", "legs", "core", "full-body"],
    equipmentFilter: ["barbell", "machine", "cables", "dumbbells", "kettlebell"],
    shape: "3-4 compound lifts at 3-5 sets of 5-8 reps; 60-120s rest.",
  },
  strength_home: {
    categoryFilter: ["chest", "back", "shoulders", "arms", "legs", "core", "full-body"],
    equipmentFilter: ["bodyweight", "none", "dumbbells", "kettlebell", "bands"],
    shape: "4-5 movements at 3 sets of 8-15 reps; minimal equipment.",
  },
  cardio_run: {
    categoryFilter: ["cardio"],
    equipmentFilter: "any",
    nameRegexInclude: /run|jog|sprint|treadmill/i,
    shape: "Outdoor or treadmill running, sustained pace within duration budget.",
  },
  cardio_bike: {
    categoryFilter: ["cardio"],
    equipmentFilter: "any",
    nameRegexInclude: /bike|cycl|spin|stationary/i,
    shape: "Outdoor or stationary cycling, sustained pace within duration budget.",
  },
  cardio_other: {
    categoryFilter: ["cardio"],
    equipmentFilter: "any",
    nameRegexExclude: /sprint|hiit|tabata/i,
    shape: "Steady cardio of the user's choice (row / swim / elliptical / brisk walk).",
  },
  zone2: {
    categoryFilter: ["cardio"],
    equipmentFilter: "any",
    nameRegexExclude: /sprint|hiit|tabata|interval/i,
    shape: "Sustained low/medium intensity (~Zone 2, conversation pace) for the duration.",
  },
  hiit_run: {
    categoryFilter: ["cardio"],
    equipmentFilter: "any",
    nameRegexInclude: /sprint|interval|hiit|run|jog/i,
    shape: "30-60s hard run / 60-90s easy walk-jog. Total duration = budget; quality > quantity.",
  },
  hiit_bike: {
    categoryFilter: ["cardio"],
    equipmentFilter: "any",
    nameRegexInclude: /bike|cycl|spin|interval|hiit/i,
    shape: "30-60s hard cycle / 60-90s easy spin. Total duration = budget.",
  },
  hiit_other: {
    categoryFilter: ["cardio", "full-body"],
    equipmentFilter: "any",
    nameRegexInclude: /interval|hiit|tabata|circuit|burpee|metabolic/i,
    shape: "Mixed conditioning. 30-45s on / 30-45s off, repeat to budget.",
  },
  mobility: {
    categoryFilter: ["flexibility", "core", "full-body"],
    equipmentFilter: "any",
    shape: "Light stretching + mobility flow. 30-60s holds, no equipment needed.",
  },
};

const quickSessionSchema = z.object({
  session_summary: z.string(),
  ordered_exercises: z.array(z.object({
    exercise_id: z.string(),
    rank: z.number().int(),
    sets: z.number().int().nullable(),
    reps: z.string().nullable(),
    duration_seconds: z.number().int().nullable(),
    rest_seconds: z.number().int().nullable(),
    note: z.string(),
  })),
  warm_up_note: z.string(),
  cool_down_note: z.string(),
  estimated_total_minutes: z.number().int(),
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
    return { ok: false, status: 403, error: "Client can only request a session for their own user id" };
  }
  return { ok: true, clientId: userData.user.id, isAdmin: false };
}

// Same limitation check pattern as the swap endpoints — pulled
// inline to keep this route self-contained.
function violatesLimitation(ex: ExerciseRow, limits: { knee: boolean; back: boolean; shoulder: boolean; wrist: boolean; cardio: boolean }): string | null {
  const name = (ex.name || "").toLowerCase();
  const muscles = (ex.muscles_targeted || []).map((m) => m.toLowerCase());
  if (limits.knee && /squat|lunge|jump|box jump|burpee|step.?up|sprint/.test(name)) return "knee";
  if (limits.back && /deadlift|good morning|barbell row|barbell squat|barbell bench|barbell press/.test(name)) return "back";
  if (limits.back && muscles.includes("lower back") && /heavy|barbell/.test(name)) return "back";
  if (limits.shoulder && /overhead|press|snatch|clean|jerk|pull.?up|chin.?up|dip/.test(name)) return "shoulder";
  if (limits.wrist && /push.?up|plank|handstand|burpee|front squat/.test(name)) return "wrist";
  if (limits.cardio && /sprint|hiit/.test(name)) return "cardio";
  return null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: `Invalid body: ${parsed.error.message}` }, { status: 400 });
  const { session_type, duration_minutes, mode, attestations, available_equipment, dryRun = false } = parsed.data;

  const auth = await resolveAuth(req, parsed.data.clientId, dryRun);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const profile = SESSION_PROFILES[session_type];

  // Expand the equipment filter via EQUIPMENT_GROUPS so e.g.
  // "dumbbells" also unlocks "kettlebell". When the caller passes
  // available_equipment, that takes precedence over the session
  // profile's default.
  const equipmentSet = new Set<string>();
  const expandFrom = (available_equipment && available_equipment.length > 0)
    ? available_equipment
    : (profile.equipmentFilter === "any" ? [] : profile.equipmentFilter);
  for (const e of expandFrom) {
    const group = EQUIPMENT_GROUPS[e] || [e];
    for (const g of group) equipmentSet.add(g);
  }
  if (profile.equipmentFilter === "any") {
    // Cardio profiles ignore equipment filtering — running outside
    // is "no equipment", treadmill is "machine", etc. We pass anything.
    equipmentSet.add("*");
  }
  equipmentSet.add("bodyweight");
  equipmentSet.add("none");

  // Build the candidate query.
  let q = supabaseAdmin
    .from("exercises")
    .select("id, name, category, equipment, difficulty, muscles_targeted, video_url, illustration_url");
  if (profile.categoryFilter !== "any") {
    q = q.in("category", profile.categoryFilter);
  }
  q = q.limit(200);
  const { data: poolRows, error: poolErr } = await q;
  if (poolErr) return NextResponse.json({ ok: false, error: `exercises fetch failed: ${poolErr.message}` }, { status: 500 });

  // Filter pool by equipment + name pattern + limitations + mode.
  // We apply filters progressively: start strict, then drop the
  // optional name regex (cosmetic — "run/jog/sprint" etc.) if 0 rows
  // come back. Limitations + mode (sick/tired safety) are NEVER
  // dropped — those reflect real safety constraints.
  const acceptAnyEquipment = equipmentSet.has("*");

  const filterCandidates = (relaxed: { dropNameRegex: boolean; dropEquipment: boolean }): ExerciseRow[] => {
    const out: ExerciseRow[] = [];
    for (const ex of (poolRows || []) as ExerciseRow[]) {
      if (!relaxed.dropEquipment && !acceptAnyEquipment && !equipmentSet.has(ex.equipment)) continue;
      if (!relaxed.dropNameRegex) {
        if (profile.nameRegexInclude && !profile.nameRegexInclude.test(ex.name)) continue;
        if (profile.nameRegexExclude && profile.nameRegexExclude.test(ex.name)) continue;
      }
      if (attestations?.limitations && violatesLimitation(ex, attestations.limitations)) continue;
      if ((mode === "sick" || mode === "tired") && /sprint|hiit|burpee|jump/i.test(ex.name)) continue;
      out.push(ex);
    }
    return out;
  };

  let filtered = filterCandidates({ dropNameRegex: false, dropEquipment: false });
  let relaxedReason: string | null = null;
  if (filtered.length === 0 && (profile.nameRegexInclude || profile.nameRegexExclude)) {
    filtered = filterCandidates({ dropNameRegex: true, dropEquipment: false });
    if (filtered.length > 0) relaxedReason = "Widened beyond strict name match";
  }
  if (filtered.length === 0 && !acceptAnyEquipment) {
    filtered = filterCandidates({ dropNameRegex: true, dropEquipment: true });
    if (filtered.length > 0) relaxedReason = "Widened beyond strict equipment match";
  }

  // Cap candidates for the prompt — 25 keeps the prompt + structured
  // output budget comfortable. Sort beginner-first so easier options
  // surface to early-tier sessions.
  const ordered = [...filtered].sort((a, b) => {
    const order = { beginner: 0, intermediate: 1, advanced: 2 } as Record<string, number>;
    return (order[a.difficulty] ?? 3) - (order[b.difficulty] ?? 3);
  }).slice(0, 25);

  if (ordered.length === 0) {
    // Diagnostic: count what's in the table for this category so the
    // client error message tells the user the actual problem rather
    // than the generic "no safe session".
    const totalInPool = (poolRows || []).length;
    return NextResponse.json({
      ok: true,
      session: null,
      candidate_count: 0,
      reason: totalInPool === 0
        ? `No exercises in library for ${session_type} (categories: ${profile.categoryFilter === "any" ? "any" : profile.categoryFilter.join(", ")}). Seed more exercises in the admin.`
        : `No safe ${session_type} exercises matched your filters — ${totalInPool} candidates in category but none passed equipment + limitations + mode.`,
      log_id: null,
      model: MODELS.actions,
      dry_run: dryRun,
    });
  }

  // Pull last 2 days of accepted picks so the AI can avoid
  // back-to-back muscle groups.
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRows } = await supabaseAdmin
    .from("ai_recommendation_log")
    .select("created_at, input_snapshot, output, user_action")
    .eq("client_id", auth.clientId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(10);
  const recentLines = ((recentRows || []) as Array<{ created_at: string; input_snapshot: Record<string, unknown> | null; output: Record<string, unknown> | null; user_action: string | null }>)
    .filter((r) => r.user_action !== "overridden" && r.user_action !== "dismissed")
    .map((r) => `- ${r.created_at.slice(0, 10)}: ${JSON.stringify(r.output).slice(0, 200)}`)
    .slice(0, 6);

  const candList = ordered.map((c, i) => {
    const tags: string[] = [`category=${c.category}`, `equipment=${c.equipment}`, `difficulty=${c.difficulty}`];
    if (c.muscles_targeted && c.muscles_targeted.length > 0) tags.push(`muscles=[${c.muscles_targeted.slice(0, 4).join(",")}]`);
    if (c.video_url) tags.push("video");
    return `${i + 1}. id=${c.id} — ${c.name} (${tags.join(", ")})`;
  }).join("\n");

  const userPrompt = `TASK: Compose a balanced quick session.

SESSION TYPE: ${session_type}
DURATION BUDGET: ${duration_minutes} minutes
MODE: ${mode}
SHAPE: ${profile.shape}

USER ATTESTATIONS (informational — limitations + mode caps already filtered):
${attestationsBlock(attestations as Attestations | null)}

${recentLines.length > 0 ? `RECENT PICKS (last 2 days):\n${recentLines.join("\n")}\n` : ""}
CANDIDATE EXERCISES:
${candList}

Rules:
- The session must fit within DURATION BUDGET total time including 3-5 min warm-up + cool-down.
- Avoid back-to-back muscle groups. If RECENT PICKS shows yesterday hit push/legs/back, today should target something different.
- For strength sessions: pick 3-5 exercises that cover different movement patterns (push / pull / hinge / squat / carry). Don't pick 3 chest exercises in a row.
- For cardio: usually a single primary exercise with stated duration + intensity. Pick one main piece, not five.
- For zone2: keep intensity low; reject anything tagged as sprint/HIIT.
- Difficulty within one tier of the user's apparent level (default intermediate). Easier OK; harder requires good RECENT PICKS history.

Return:
- session_summary (1 sentence, ≤ 20 words)
- ordered_exercises with exercise_id (echo EXACTLY from candidate list), rank (1 = first to do), sets/reps OR duration_seconds, rest_seconds, one-line note
- warm_up_note (≤ 15 words)
- cool_down_note (≤ 15 words)
- estimated_total_minutes`;

  let rec;
  try {
    rec = await callRecommender(quickSessionSchema, userPrompt, 2500, "actions");
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "/api/ai/recommend-quick-session", session_type } });
    return NextResponse.json({ ok: false, error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  // Hydrate response with exercise metadata so the RN side can render
  // without a second round-trip.
  const enrichedExercises = rec.ordered_exercises.map((e) => {
    const ex = ordered.find((c) => c.id === e.exercise_id);
    return {
      ...e,
      name: ex?.name,
      category: ex?.category,
      equipment: ex?.equipment,
      difficulty: ex?.difficulty,
      muscles_targeted: ex?.muscles_targeted,
      video_url: ex?.video_url || null,
      illustration_url: ex?.illustration_url || null,
      has_video: !!ex?.video_url,
    };
  });

  let logId: string | null = null;
  try {
    if (!dryRun) {
      const { data: inserted } = await supabaseAdmin
        .from("ai_recommendation_log")
        .insert({
          client_id: auth.clientId,
          type: "program_item",
          input_snapshot: {
            source: "quick_session",
            session_type,
            duration_minutes,
            mode,
            attestations,
            candidate_count: ordered.length,
            available_equipment,
          },
          output: {
            ordered_exercise_ids: rec.ordered_exercises.map((e) => e.exercise_id),
            session_summary: rec.session_summary,
          },
          reason_text: rec.session_summary,
          model: MODELS.actions,
        })
        .select("id")
        .single();
      logId = (inserted as { id: string } | null)?.id || null;
    }
  } catch { /* log write best-effort */ }

  return NextResponse.json({
    ok: true,
    session: {
      summary: rec.session_summary,
      ordered_exercises: enrichedExercises,
      warm_up_note: rec.warm_up_note,
      cool_down_note: rec.cool_down_note,
      estimated_total_minutes: rec.estimated_total_minutes,
    },
    candidate_count: ordered.length,
    relaxed: relaxedReason,
    log_id: logId,
    model: MODELS.actions,
    dry_run: dryRun,
  });
}
