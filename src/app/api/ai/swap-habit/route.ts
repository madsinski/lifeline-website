// POST /api/ai/swap-habit
//
// Universal swap for sleep + mental + exercise (session-level) habits.
// Takes a current_action_key + category and returns N alternative
// program_actions in the same pillar, AI-ranked by yield + variety.
//
// For nutrition the caller should route to /api/ai/swap-meal which
// pulls from the meals table (richer per-meal metadata).
//
// Pulls candidates via supabase + applies the same safety filters
// the ranking endpoints use (mode-appropriate, attestation-safe),
// then asks the AI to pick the top N alternatives.

import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  MODELS,
  attestationsBlock,
  callRecommender,
  logRecommendation,
  swapRecSchema,
  type Attestations,
} from "@/lib/ai-recommender";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  clientId: z.string().uuid().optional(),
  current_action_key: z.string(),
  current_label: z.string(),
  category: z.enum(["exercise", "sleep", "mental"]),
  alternatives_count: z.number().int().min(1).max(6).default(3),
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
  dryRun: z.boolean().optional(),
});

interface ActionRow {
  id: string;
  action_key: string;
  label: string;
  category: string;
  intensity: string | null;
  min_recovery_state: string | null;
  appropriate_modes: string[] | null;
  is_keystone: boolean;
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

// Mode safety filter for program_action candidates — mirrors the
// inline logic the test bench uses for the deterministic filter.
function suitableForMode(item: ActionRow, mode: string): boolean {
  if (item.appropriate_modes && item.appropriate_modes.length > 0) {
    return item.appropriate_modes.includes(mode);
  }
  switch (mode) {
    case "normal":
    case "beast":
      return true;
    case "vacation":
      if (item.min_recovery_state === "not_vacation") return false;
      if (item.intensity === "vigorous") return false;
      return true;
    case "sick":
      if (item.min_recovery_state === "not_sick") return false;
      if (item.intensity === "vigorous" || item.intensity === "moderate") return false;
      if (!item.intensity && item.category === "exercise" && item.action_key !== "steps") return false;
      return true;
    case "tired":
      if (item.min_recovery_state === "not_tired") return false;
      if (item.intensity === "vigorous") return false;
      if (item.category === "exercise" && item.intensity === "moderate") return false;
      return true;
    default:
      return true;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: `Invalid body: ${parsed.error.message}` }, { status: 400 });
  }
  const { current_action_key, current_label, category, alternatives_count, mode, attestations, dryRun = false } = parsed.data;

  const auth = await resolveAuth(req, parsed.data.clientId, dryRun);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  // Pull candidate rows from program_actions: same pillar, actionable,
  // not the current item. Dedup by label so multi-program duplicates
  // don't pad the candidate set with the same habit.
  const { data: poolRows, error: poolErr } = await supabaseAdmin
    .from("program_actions")
    .select("id, action_key, label, category, intensity, min_recovery_state, appropriate_modes, is_keystone")
    .eq("category", category)
    .eq("is_actionable", true)
    .neq("label", current_label)
    .limit(400);
  if (poolErr) {
    return NextResponse.json({ ok: false, error: `Pool fetch failed: ${poolErr.message}` }, { status: 500 });
  }
  const pool = (poolRows || []) as ActionRow[];

  // Dedupe by label + apply mode safety.
  const seen = new Set<string>();
  const candidates: ActionRow[] = [];
  for (const r of pool) {
    if (seen.has(r.label)) continue;
    seen.add(r.label);
    if (!suitableForMode(r, mode)) continue;
    candidates.push(r);
  }

  // Sort keystones first so the prompt's top items are pre-vetted.
  candidates.sort((a, b) => {
    if (a.is_keystone !== b.is_keystone) return a.is_keystone ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  // Cap to keep the prompt tight — 20 is plenty for an N-of-3 swap.
  const capped = candidates.slice(0, 20);

  if (capped.length === 0) {
    return NextResponse.json({
      ok: true,
      alternatives: [],
      current: { action_key: current_action_key, label: current_label, category },
      candidate_count: 0,
      log_id: null,
      model: MODELS.swap,
      dry_run: dryRun,
      overall_rationale: `No safe ${category} alternatives in the library for this user's mode + attestations.`,
    });
  }

  const candList = capped.map((c, i) => {
    const tags: string[] = [];
    if (c.is_keystone) tags.push("KEYSTONE");
    if (c.intensity) tags.push(`intensity=${c.intensity}`);
    return `${i + 1}. key=${c.action_key} — ${c.label}${tags.length ? ` (${tags.join(", ")})` : ""}`;
  }).join("\n");

  const userPrompt = `TASK: The user wants to swap this ${category} habit — pick ${alternatives_count} alternatives.

CURRENT:
- ${current_label} (key=${current_action_key})

MODE: ${mode}
USER ATTESTATIONS (informational — mode + safety already filtered):
${attestationsBlock(attestations as Attestations | null)}

CANDIDATE ALTERNATIVES (same pillar, mode-safe):
${candList}

Pick ${alternatives_count} alternatives that:
- Hit the same pillar's purpose but offer real variety (different mechanism, not the same habit reworded).
- Prefer KEYSTONE-tagged candidates when available.
- Match or stay below the current intensity tier (don't escalate during a swap).

For each: rank (1 = best match), one-line rationale (≤ 15 words).
Return overall_rationale (1 sentence, ≤ 25 words) explaining the swap shape.`;

  let rec;
  try {
    rec = await callRecommender(swapRecSchema, userPrompt, 1200, "swap");
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "/api/ai/swap-habit", category } });
    return NextResponse.json({ ok: false, error: `AI generation failed: ${(e as Error).message}` }, { status: 502 });
  }

  let logId: string | null = null;
  try {
    logId = await logRecommendation({
      clientId: auth.clientId,
      type: "program_item",
      inputSnapshot: {
        source: "habit_swap",
        category,
        current_action_key,
        current_label,
        mode,
        attestations,
        candidate_count: capped.length,
      },
      output: { alternative_keys: rec.alternatives.map((a) => a.id) },
      reasonText: rec.overall_rationale,
      dryRun,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Log write failed: ${(e as Error).message}`, recommendation: rec }, { status: 500 });
  }

  // The AI returns "id" but we treat that as the action_key in this
  // endpoint. Hydrate with labels so the RN caller can render them.
  return NextResponse.json({
    ok: true,
    alternatives: rec.alternatives.map((a) => {
      const c = capped.find((x) => x.action_key === a.id);
      return {
        ...a,
        action_key: a.id,
        label: c?.label || a.id,
        is_keystone: !!c?.is_keystone,
        intensity: c?.intensity ?? null,
      };
    }),
    current: { action_key: current_action_key, label: current_label, category },
    overall_rationale: rec.overall_rationale,
    candidate_count: capped.length,
    log_id: logId,
    model: MODELS.swap,
    dry_run: dryRun,
  });
}
