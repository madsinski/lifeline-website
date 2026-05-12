// POST /api/ai/recommend-actions
//
// Given a list of candidate actions (already pre-filtered by the
// deterministic applyModeFilter on the client), the user's mode +
// attestations, and an optional pillar focus, returns:
//   - ordered_actions: ranked list with per-item rationale + yield score
//   - dropped_actions: items the model rejected with a reason (safety,
//     low yield, redundancy)
//   - overall_rationale: 1-2 sentence summary of the day's plan
//
// Same auth model as recommend-mode: user JWT for own data, admin JWT
// + dryRun=true for the test bench.

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  MODELS,
  actionListBlock,
  actionRecSchema,
  attestationsBlock,
  callRecommender,
  logRecommendation,
  metricsBlock,
  type Attestations,
  type CandidateAction,
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
  // Optional cap — when present the model also rejects past this many
  // (used to enforce the user's time budget for the day).
  target_count: z.number().int().min(1).max(20).optional(),
  dryRun: z.boolean().optional(),
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
  const { mode, metrics, attestations, candidate_actions, target_count, dryRun = false } = parsed.data;

  const auth = await resolveAuth(req, parsed.data.clientId, dryRun);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  if (candidate_actions.length === 0) {
    return NextResponse.json({
      ok: true,
      recommendation: { ordered_actions: [], dropped_actions: [], overall_rationale: "No candidate actions provided." },
      log_id: null,
      model: MODELS.actions,
      dry_run: dryRun,
    });
  }

  const userPrompt = `TASK: Rank today's actions for the user, applying the high-yield policy. The candidate list has already been pre-filtered by deterministic mode rules — your job is to pick the highest-leverage subset and explain why.

MODE: ${mode}
TARGET COUNT: ${target_count ? `aim for ${target_count} actions` : "no hard cap; prefer fewer if yield drops"}

USER METRICS:
${metricsBlock((metrics as UserMetrics) || {
  sleep_hours_last_night: null, sleep_hours_3day_avg: null, hrv_today_ms: null,
  hrv_baseline_ms: null, rhr_today_bpm: null, rhr_baseline_bpm: null, soreness_self_rating: null,
})}

USER ATTESTATIONS (HARD CONSTRAINTS):
${attestationsBlock(attestations as Attestations | null)}

CANDIDATE ACTIONS:
${actionListBlock(candidate_actions as CandidateAction[])}

For each action you KEEP (return at most ${target_count || 8} in ordered_actions):
- rank (1 = highest priority)
- yield_score 1-5 grounded in the high-yield policy and the user's state
- One-line rationale (max 15 words) — say WHY this matters for THIS user TODAY

For each action you DROP (return ONE WORD reasons to keep output compact):
- reason: one of "low_yield", "redundant", "safety", "mode_mismatch", "over_budget"

Return overall_rationale (1 sentence, max 25 words) summarising the day's shape.`;

  let rec;
  try {
    rec = await callRecommender(actionRecSchema, userPrompt, 5000, "actions");
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "/api/ai/recommend-actions" } });
    return NextResponse.json({ ok: false, error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  let logId: string | null = null;
  try {
    logId = await logRecommendation({
      clientId: auth.clientId,
      type: "program_item",
      inputSnapshot: { mode, metrics, attestations, candidate_count: candidate_actions.length, target_count },
      output: {
        ordered_keys: rec.ordered_actions.map((a) => a.key),
        dropped_keys: rec.dropped_actions.map((a) => a.key),
      },
      reasonText: rec.overall_rationale,
      dryRun,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Log write failed: ${(e as Error).message}`, recommendation: rec }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    recommendation: rec,
    log_id: logId,
    model: MODELS.actions,
    dry_run: dryRun,
  });
}
