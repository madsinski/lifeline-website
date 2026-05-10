// POST /api/ai/recommend-mode
//
// Picks a mode (vacation/normal/beast/sick/tired) for the user given
// their recent metrics + attestations + current mode. Writes to
// ai_recommendation_log unless dryRun=true.
//
// Auth: either a user JWT (clientId is derived from auth.uid) OR an
// admin staff JWT with explicit clientId in the body (dryRun=true is
// then required so test runs don't pollute production logs).

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  AI_MODEL,
  attestationsBlock,
  callRecommender,
  logRecommendation,
  metricsBlock,
  modeRecSchema,
  type Attestations,
  type UserMetrics,
} from "@/lib/ai-recommender";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  clientId: z.string().uuid().optional(),
  metrics: z.object({
    sleep_hours_last_night: z.number().nullable(),
    sleep_hours_3day_avg: z.number().nullable(),
    hrv_today_ms: z.number().nullable(),
    hrv_baseline_ms: z.number().nullable(),
    rhr_today_bpm: z.number().nullable(),
    rhr_baseline_bpm: z.number().nullable(),
    soreness_self_rating: z.number().nullable(),
  }),
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
  current_mode: z.enum(["vacation", "normal", "beast", "sick", "tired"]).optional(),
  schedule_hint: z.string().nullable().optional(),
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

  // Admin path: caller is staff with admin role + dryRun + explicit
  // clientId. The bench is for evaluation, not production logging,
  // so we hard-require dryRun on this code path.
  if (userData.user.email) {
    const { data: staff } = await supabaseAdmin
      .from("staff")
      .select("role, active")
      .eq("email", userData.user.email)
      .maybeSingle();
    if (staff?.active && staff.role === "admin") {
      if (!requestedClientId) {
        return { ok: true, clientId: userData.user.id, isAdmin: true };
      }
      if (!dryRun) {
        return { ok: false, status: 400, error: "Admin runs against arbitrary clientId require dryRun=true" };
      }
      return { ok: true, clientId: requestedClientId, isAdmin: true };
    }
  }

  // Client path: caller is the client themselves.
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
  const { metrics, attestations, current_mode, schedule_hint, dryRun = false } = parsed.data;

  const auth = await resolveAuth(req, parsed.data.clientId, dryRun);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const userPrompt = `TASK: Pick the most appropriate mode for the user today.

CURRENT MODE: ${current_mode || "(unknown)"}
SCHEDULE HINT: ${schedule_hint || "(none)"}

RECENT METRICS:
${metricsBlock(metrics as UserMetrics)}

USER ATTESTATIONS:
${attestationsBlock(attestations as Attestations | null)}

Decide one of: vacation, normal, beast, sick, tired. Provide a one-line rationale grounded in the data above. Provide a runner-up only if it was a close call (otherwise null).

Apply the high-yield policy: only suggest beast when the data clearly supports it. Default to normal when ambiguous.`;

  let rec;
  try {
    rec = await callRecommender(modeRecSchema, userPrompt, 800);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  let logId: string | null = null;
  try {
    logId = await logRecommendation({
      clientId: auth.clientId,
      type: "mode",
      inputSnapshot: { metrics, attestations, current_mode, schedule_hint },
      output: { mode: rec.mode, runner_up: rec.runner_up?.mode || null, confidence: rec.confidence },
      reasonText: rec.rationale,
      dryRun,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Log write failed: ${(e as Error).message}`, recommendation: rec }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    recommendation: rec,
    log_id: logId,
    model: AI_MODEL,
    dry_run: dryRun,
  });
}
