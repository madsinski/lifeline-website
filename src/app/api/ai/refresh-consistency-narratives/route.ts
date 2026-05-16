// POST /api/ai/refresh-consistency-narratives
//
// Iterates active clients (had a completion in the last 14 days) and
// writes a one-line consistency narrative + tomorrow nudge to
// clients.consistency_narrative. Cached for 24h via
// consistency_narrative_at — if the row is already fresh we skip the
// AI call and save tokens.
//
// Auth (two modes):
//   * Vercel cron — request carries x-vercel-cron header (no token).
//   * Manual admin trigger — Authorization: Bearer <staff JWT>, staff
//     role must be admin.
//
// Failures fall back to a deterministic rule-based line so the user
// always has something to read.

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { callRecommender } from "@/lib/ai-recommender";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — bulk job over many users

const FRESHNESS_HOURS = 20;
const ACTIVE_WINDOW_DAYS = 14;

// Tight schema: one short observation + one tomorrow nudge.
// Bias the model toward concrete patterns ("evening slot", "weekend gap")
// and lightweight nudges ("start with a 5-minute one").
const narrativeSchema = z.object({
  observation: z.string().min(8).max(160),
  nudge: z.string().min(8).max(120),
});

function ruleFallback(input: {
  consistencyScore: number | null;
  depthScore: number | null;
  daysCompleted28: number;
  peakDay: number;
  weekendShare: number;       // share of last-14d completions on Sat/Sun
}): { observation: string; nudge: string } {
  const { consistencyScore: c, depthScore: d, daysCompleted28, peakDay, weekendShare } = input;
  if (daysCompleted28 === 0) {
    return {
      observation: "No completions in the last 28 days.",
      nudge: "Start with one small action tomorrow — even a 5-minute one counts.",
    };
  }
  if (c !== null && c < 30) {
    return {
      observation: `You've shown up on ${daysCompleted28} of the last 28 days.`,
      nudge: "Make tomorrow's first action your easiest one to keep the streak alive.",
    };
  }
  if (c !== null && c >= 75) {
    return {
      observation: `Strong rhythm — ${daysCompleted28}/28 days completed.`,
      nudge: "You're ready for a step up; consider the next program tier.",
    };
  }
  if (d !== null && d < 40 && peakDay > 0) {
    return {
      observation: `Showing up often but lighter than your best day (${peakDay} actions).`,
      nudge: "Tomorrow, match your peak by ticking one extra action.",
    };
  }
  if (weekendShare < 0.15 && daysCompleted28 >= 10) {
    return {
      observation: "Weekdays are your strong zone; weekends are quieter.",
      nudge: "Try one short Saturday action this weekend to widen the rhythm.",
    };
  }
  return {
    observation: `Steady — ${daysCompleted28} of the last 28 days touched.`,
    nudge: "Keep the rhythm; one anchor action tomorrow is enough.",
  };
}

function isVercelCron(req: Request): boolean {
  // Vercel cron requests pass x-vercel-cron / x-vercel-id; in addition
  // they include Authorization with the CRON_SECRET when configured.
  if (req.headers.get("x-vercel-cron")) return true;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  return false;
}

async function authorize(req: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (isVercelCron(req)) return { ok: true };
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { ok: false, status: 401, error: "Not authenticated" };
  const token = auth.slice("Bearer ".length);
  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data.user?.email) return { ok: false, status: 401, error: "Invalid token" };
  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("role, active")
    .eq("email", data.user.email)
    .maybeSingle();
  if (!staff || !staff.active || staff.role !== "admin") {
    return { ok: false, status: 403, error: "Admin only" };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const startedAt = Date.now();
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);

  // Active users: had at least one done completion in the last 14 days.
  const { data: activeRows, error: activeErr } = await supabaseAdmin
    .from("action_completions")
    .select("client_id")
    .eq("status", "done")
    .gte("date", since);
  if (activeErr) {
    Sentry.captureException(activeErr, {
      tags: { component: "refresh-consistency-narratives", stage: "fetch-active" },
    });
    return NextResponse.json({ ok: false, error: activeErr.message }, { status: 500 });
  }
  const activeIds = Array.from(new Set((activeRows ?? []).map((r) => (r as any).client_id as string)));

  const summary = { considered: activeIds.length, ai_calls: 0, fallbacks: 0, skipped_fresh: 0, errors: 0 };

  for (const clientId of activeIds) {
    try {
      // Skip if narrative is fresh (within FRESHNESS_HOURS).
      const { data: existing } = await supabaseAdmin
        .from("clients")
        .select("consistency_score, consistency_depth_score, consistency_narrative_at")
        .eq("id", clientId)
        .maybeSingle();
      const lastAt = (existing as any)?.consistency_narrative_at as string | null;
      if (lastAt && Date.now() - new Date(lastAt).getTime() < FRESHNESS_HOURS * 3600_000) {
        summary.skipped_fresh += 1;
        continue;
      }

      // Gather inputs: grid + scores. Grid call uses the SECURITY DEFINER
      // RPC, so service-role context here is fine.
      const { data: grid } = await supabaseAdmin.rpc("get_consistency_grid", { p_client_id: clientId });
      const gridRows = (grid ?? []) as Array<{ date: string; done_count: number }>;

      const daysCompleted28 = gridRows.filter((r) => r.done_count > 0).length;
      const peakDay = gridRows.reduce((m, r) => Math.max(m, r.done_count), 0);
      const last14 = gridRows.slice(-14);
      const last14Completions = last14.reduce((s, r) => s + r.done_count, 0);
      const last14Weekend = last14
        .filter((r) => {
          const dow = new Date(r.date).getDay();
          return dow === 0 || dow === 6;
        })
        .reduce((s, r) => s + r.done_count, 0);
      const weekendShare = last14Completions > 0 ? last14Weekend / last14Completions : 0;
      const consistencyScore = (existing as any)?.consistency_score ?? null;
      const depthScore = (existing as any)?.consistency_depth_score ?? null;

      // Build a compact prompt.
      const prompt =
        `Generate a one-line OBSERVATION + one-line NUDGE for a user's 28-day consistency.\n\n` +
        `Inputs:\n` +
        `- days_with_completion_28d: ${daysCompleted28}/28\n` +
        `- consistency_days_score: ${consistencyScore ?? "n/a"} (% days with ≥1 action)\n` +
        `- consistency_depth_score: ${depthScore ?? "n/a"} (% of peak-day intensity)\n` +
        `- peak_completions_in_a_day: ${peakDay}\n` +
        `- last_14d_completions_total: ${last14Completions}\n` +
        `- last_14d_weekend_share: ${(weekendShare * 100).toFixed(0)}%\n` +
        `- per_day_grid (oldest first): ${gridRows.map((r) => r.done_count).join(",")}\n\n` +
        `Tone: warm, concrete, no fluff. Reference the data plainly. Don't moralize. ` +
        `Observation: surface ONE notable pattern in <=160 chars. ` +
        `Nudge: ONE actionable tomorrow-suggestion in <=120 chars. ` +
        `If the user has zero completions in the window, encourage starting tiny. ` +
        `If the user is strong (>75% days), suggest leveling up.`;

      let narrative: { observation: string; nudge: string };
      try {
        narrative = await callRecommender(narrativeSchema, prompt, 400, "actions");
        summary.ai_calls += 1;
      } catch {
        narrative = ruleFallback({ consistencyScore, depthScore, daysCompleted28, peakDay, weekendShare });
        summary.fallbacks += 1;
      }

      const combined = `${narrative.observation} ${narrative.nudge}`.slice(0, 280);
      await supabaseAdmin
        .from("clients")
        .update({
          consistency_narrative: combined,
          consistency_narrative_at: new Date().toISOString(),
        })
        .eq("id", clientId);
    } catch (e) {
      console.warn("[refresh-consistency-narratives] user error", clientId, (e as Error).message);
      Sentry.captureException(e, {
        tags: { component: "refresh-consistency-narratives", stage: "per-user" },
        contexts: { user: { clientId } },
      });
      summary.errors += 1;
    }
  }

  console.log("[refresh-consistency-narratives] done", { ...summary, ms: Date.now() - startedAt });
  return NextResponse.json({ ok: true, ms: Date.now() - startedAt, ...summary });
}
