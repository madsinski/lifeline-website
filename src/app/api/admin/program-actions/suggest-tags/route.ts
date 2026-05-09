// AI-suggested tags for program_actions rows.
//
// POST { action_ids: string[] }
// Returns: { ok, suggestions: [{ id, intensity, min_recovery_state, equipment_needed, appropriate_modes }, ...] }
//
// Reads each action's label / category / details, batches them into
// chunks for OpenAI gpt-5.4 with a strict output schema, and returns
// proposed tags. The admin UI presents these as drafts for review
// before they hit the DB — AI never writes directly.
//
// Admin-only (write surface for catalog metadata). Reuses the same
// OPENAI_API_KEY + AI SDK pattern as the survey AI summary.

import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "gpt-5.4";
const BATCH_SIZE = 25; // actions per OpenAI call

const tagItemSchema = z.object({
  id: z.string(),
  intensity: z.enum(["gentle", "moderate", "vigorous"]),
  min_recovery_state: z.enum(["any", "not_sick", "not_tired", "not_vacation"]),
  equipment_needed: z.array(z.string()),
  // Optional override — null/undefined = "derive from intensity + recovery floor"
  appropriate_modes: z
    .array(z.enum(["vacation", "normal", "beast", "sick", "tired"]))
    .nullable(),
  // One-line rationale so Mads can sanity-check at a glance.
  rationale: z.string(),
});

const batchSchema = z.object({
  tags: z.array(tagItemSchema),
});

interface ActionRow {
  id: string;
  label: string;
  category: "exercise" | "nutrition" | "sleep" | "mental" | "general";
  details: string[] | null;
}

const SYSTEM_PROMPT = `You are tagging actions in a clinical health-coaching action library for Lifeline Health (Iceland). For each action, choose:

intensity: gentle | moderate | vigorous
  - gentle:    walking, stretching, breathing, meditation, journaling, hydration, light yoga, sleep rituals
  - moderate:  jogging, cycling at conversation pace, weight training at sub-maximal load, brisk walks, balanced meals to plan, focus blocks
  - vigorous:  HIIT, heavy lifting (>80% 1RM), sprints, plyometrics, long endurance pieces, intense competition

min_recovery_state: any | not_sick | not_tired | not_vacation
  - any:           no recovery floor — show always
  - not_sick:      contraindicated when sick (most vigorous exercise, big meals, intense mental work)
  - not_tired:     should not be done when energy is low (heavy lifting, complex cognitive challenges)
  - not_vacation:  not feasible while traveling (equipment-heavy work, scheduled clinic visits)
  Default to 'any'. Use a stricter floor only when there's a real reason.

equipment_needed: array of strings — list ONLY items specific to the action (e.g. ["dumbbells"], ["yoga mat"], ["foam roller"]). Empty array if no specific equipment. Do NOT list generic items (clothes, water bottle).

appropriate_modes: optional override array — leave NULL for almost everything. Only set when an action has unusual mode behaviour the rules above can't capture (e.g. a "phone a friend" action that is uniquely good for Sick + Tired but not Beast). Otherwise null.

rationale: ONE sentence (≤ 18 words) explaining your call.

Be conservative. The defaults are "moderate / any / [] / null" — only deviate from defaults when the data clearly justifies it.`;

interface AdminCheckOk { ok: true; staffId: string; staffName: string | null; email: string }
interface AdminCheckErr { ok: false; status: number; error: string }
async function requireAdmin(req: Request): Promise<AdminCheckOk | AdminCheckErr> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { ok: false, status: 401, error: "Not authenticated" };
  const token = auth.slice("Bearer ".length);
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!userData.user?.email) return { ok: false, status: 401, error: "Invalid session" };
  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, role, name, active")
    .eq("email", userData.user.email)
    .maybeSingle();
  if (!staff || !staff.active || staff.role !== "admin") {
    return { ok: false, status: 403, error: "Admin role required" };
  }
  return { ok: true, staffId: staff.id, staffName: staff.name, email: userData.user.email };
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin(req);
  if (!adminCheck.ok) return NextResponse.json({ ok: false, error: adminCheck.error }, { status: adminCheck.status });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ok: false,
      error: "OPENAI_API_KEY not set in env.",
    }, { status: 500 });
  }

  let body: { action_ids?: string[] } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const ids = Array.isArray(body.action_ids) ? body.action_ids.filter((x) => typeof x === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "action_ids required" }, { status: 400 });
  }
  if (ids.length > 500) {
    return NextResponse.json({
      ok: false,
      error: "Max 500 actions per call. Batch in smaller groups.",
    }, { status: 400 });
  }

  // Load the action data we'll send to the model.
  const { data: rowsRaw, error: loadErr } = await supabaseAdmin
    .from("program_actions")
    .select("id, label, category, details")
    .in("id", ids);
  if (loadErr || !rowsRaw) {
    return NextResponse.json({ ok: false, error: `Load failed: ${loadErr?.message}` }, { status: 500 });
  }
  const rows = (rowsRaw as ActionRow[]).map((r) => ({
    ...r,
    details: Array.isArray(r.details) ? r.details : [],
  }));

  // Batch into chunks so a model timeout / rate limit doesn't lose the
  // whole job. Process sequentially to be polite to the API.
  const chunks: ActionRow[][] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    chunks.push(rows.slice(i, i + BATCH_SIZE));
  }

  const all: z.infer<typeof tagItemSchema>[] = [];
  for (const chunk of chunks) {
    const userPrompt = `Tag these ${chunk.length} actions. Return tags in the SAME ORDER as input.

${chunk.map((r, i) => {
  const det = r.details && r.details.length > 0
    ? `\n  details: ${r.details.slice(0, 8).map((d) => `- ${d}`).join("\n           ")}`
    : "";
  return `${i + 1}. id: ${r.id}
   label: "${r.label}"
   category: ${r.category}${det}`;
}).join("\n\n")}`;

    try {
      const result = await generateText({
        model: openai(MODEL),
        output: Output.object({ schema: batchSchema }),
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        maxOutputTokens: 4000,
      });
      if (!result.experimental_output) throw new Error("No structured output returned");
      const parsed = result.experimental_output as z.infer<typeof batchSchema>;
      // Filter only tags whose id matches a row we sent — defensive
      // against the model inventing IDs.
      const validIds = new Set(chunk.map((r) => r.id));
      for (const t of parsed.tags) {
        if (validIds.has(t.id)) all.push(t);
      }
    } catch (e) {
      // One chunk failing shouldn't kill the whole job — return what we
      // have plus a warning so the admin can retry just the missing ids.
      console.error("[suggest-tags] chunk failed:", (e as Error).message);
    }
  }

  return NextResponse.json({
    ok: true,
    suggestions: all,
    requested: ids.length,
    returned: all.length,
    missing: ids.filter((id) => !all.find((s) => s.id === id)),
    model: MODEL,
  });
}
