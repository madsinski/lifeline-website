// POST /api/health-coach/chat
//
// User types a free-form request ("less impact please", "swap me to
// vegetarian", "I'm travelling next week") or picks a preset prompt
// from the in-app sheet. We reply with:
//   • text — a one-paragraph human-readable reply
//   • proposed_action — a structured intent the app can render as
//     a confirm-or-cancel button. Currently three intents:
//       'swap_program'   { pillar, from_key, to_key, to_name }
//       'swap_action'    { lib_key, to_lib_key, to_label }
//       'change_level'   { pillar, to_level }
//     plus 'none' when no action is proposed (e.g. just a clarifying
//     reply).
//
// We pull the user's current programs + active pillar levels +
// limitations server-side so the prompt has the same context the
// app has. The model is constrained by zod schema (Output.object).

import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const MODEL = "gpt-5.4";

const requestSchema = z.object({
  message: z.string().min(2).max(500),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

const intentSchema = z.union([
  z.object({
    kind: z.literal('swap_program'),
    pillar: z.enum(['exercise', 'nutrition', 'sleep', 'mental']),
    from_key: z.string(),
    to_key: z.string(),
    to_name: z.string(),
    rationale: z.string(),
  }),
  z.object({
    kind: z.literal('swap_action'),
    lib_key: z.string(),
    to_lib_key: z.string(),
    to_label: z.string(),
    rationale: z.string(),
  }),
  z.object({
    kind: z.literal('change_level'),
    pillar: z.enum(['exercise', 'nutrition', 'sleep', 'mental']),
    to_level: z.enum(['beginner', 'intermediate', 'advanced']),
    rationale: z.string(),
  }),
  // Move an action from one weekday to another. dow uses 0=Mon..6=Sun.
  // scope='this_week' bounds the override to the current calendar week;
  // 'recurring' makes it the user's new default for that slot.
  z.object({
    kind: z.literal('move_action_day'),
    lib_key: z.string(),
    original_dow: z.number().int().min(0).max(6),
    new_dow: z.number().int().min(0).max(6),
    scope: z.enum(['this_week', 'recurring']),
    rationale: z.string(),
  }),
  // Replace a scheduled action with a user-defined custom item
  // ("Group class at the gym"). original_lib_key + original_dow
  // identify the slot being replaced.
  z.object({
    kind: z.literal('add_custom_action'),
    original_lib_key: z.string(),
    original_dow: z.number().int().min(0).max(6),
    title: z.string().min(1),
    details: z.array(z.string()).default([]),
    pillar: z.enum(['exercise', 'nutrition', 'sleep', 'mental']).nullable(),
    duration_min: z.number().int().nullable(),
    scope: z.enum(['this_week', 'recurring']),
    rationale: z.string(),
  }),
  z.object({
    kind: z.literal('none'),
  }),
]);

const responseSchema = z.object({
  reply: z.string(),
  proposed_action: intentSchema,
});

async function requireUser(req: Request) {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return null;
  const { data } = await supabaseAdmin.auth.getUser(h.slice('Bearer '.length));
  return data.user ?? null;
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: `Bad body: ${parsed.error.message}` }, { status: 400 });
  }

  // Pull user context in parallel
  const [currentProgsRes, levelsRes, catalogRes, categoriesRes, clientRes, dismissalsRes] = await Promise.all([
    supabaseAdmin.from('client_programs').select('category_key, program_key').eq('client_id', user.id),
    supabaseAdmin.from('client_pillar_levels').select('pillar, level').eq('client_id', user.id),
    supabaseAdmin.from('programs').select('key, name, description, category_id, level'),
    supabaseAdmin.from('program_categories').select('id, key'),
    supabaseAdmin.from('clients').select('onboarding_data').eq('id', user.id).maybeSingle(),
    // Phase 3 dismissals — soft signal so the coach doesn't propose
    // a swap_action with a to_lib_key the user has already rejected.
    // Wrapped via .then so a missing table doesn't fail Promise.all.
    supabaseAdmin.from('client_action_dismissals').select('lib_key, reason_category').eq('client_id', user.id).then(
      (r) => r,
      () => ({ data: [] as Array<{ lib_key: string; reason_category: string }>, error: null as any }),
    ),
  ]);

  const currentPrograms = (currentProgsRes.data ?? []) as Array<{ category_key: string; program_key: string }>;
  const levels = (levelsRes.data ?? []) as Array<{ pillar: string; level: string }>;
  const categories = (categoriesRes.data ?? []) as Array<{ id: string; key: string }>;
  const catIdToPillar = new Map(categories.map((c) => [c.id, c.key]));
  const catalog = (catalogRes.data ?? []) as Array<{ key: string; name: string; description: string | null; category_id: string; level: string | null }>;
  const limitations = (clientRes.data as any)?.onboarding_data?.limitations ?? null;
  const preferences = (clientRes.data as any)?.onboarding_data?.preferences ?? null;
  const dismissalRows = (dismissalsRes.data ?? []) as Array<{ lib_key: string; reason_category: string }>;
  const dismissedKeys = new Set(dismissalRows.map((r) => r.lib_key));

  // Resolve dismissal lib_keys to human-readable labels for the prompt.
  let dismissedSummary: Array<{ label: string; reason: string }> = [];
  if (dismissalRows.length > 0) {
    try {
      const { data: libRows } = await supabaseAdmin
        .from('action_library')
        .select('lib_key, label')
        .in('lib_key', dismissalRows.map((r) => r.lib_key));
      const labelByKey: Record<string, string> = {};
      for (const r of libRows ?? []) labelByKey[r.lib_key as string] = (r.label as string) ?? (r.lib_key as string);
      dismissedSummary = dismissalRows.map((r) => ({
        label: labelByKey[r.lib_key] ?? r.lib_key,
        reason: r.reason_category,
      }));
    } catch { /* no-op */ }
  }

  const validKeys = new Set(catalog.map((c) => c.key));

  // Format catalog grouped by pillar for the prompt
  const catalogByPillar: Record<string, typeof catalog> = {};
  for (const p of catalog) {
    const pillar = catIdToPillar.get(p.category_id) ?? 'unknown';
    (catalogByPillar[pillar] ??= []).push(p);
  }
  const catalogText = Object.entries(catalogByPillar).map(([pillar, items]) =>
    `${pillar.toUpperCase()}:\n` + items.map((i) => `  ${i.key} — ${i.name} [${i.level || 'any'}]`).join('\n')
  ).join('\n\n');

  // Resolve the user's current week's schedule so the model can refer
  // to actions by lib_key + original day. Without this, move_action_day
  // and add_custom_action have nothing concrete to target.
  // Mon=0..Sun=6 to match the app's convention.
  const todayJsDow = new Date().getDay();
  const todayMonIdx = (todayJsDow + 6) % 7;
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let scheduleText = '(no active programs)';
  const programKeys = currentPrograms.map((cp) => cp.program_key);
  if (programKeys.length > 0) {
    const { data: progRows } = await supabaseAdmin
      .from('programs')
      .select('id, key')
      .in('key', programKeys);
    const progIds = (progRows ?? []).map((r: any) => r.id as string);
    if (progIds.length > 0) {
      const { data: scheduleRows } = await supabaseAdmin
        .from('program_actions_resolved')
        .select('lib_key, label, day_of_week, time_group')
        .in('program_id', progIds)
        .eq('week_range', 0); // week 1 is a representative slice
      const byDow = new Map<number, Array<{ lib_key: string; label: string; time_group: string }>>();
      for (const r of scheduleRows ?? []) {
        const dow = r.day_of_week as number;
        const bucket = byDow.get(dow) ?? [];
        bucket.push({ lib_key: r.lib_key as string, label: r.label as string, time_group: r.time_group as string });
        byDow.set(dow, bucket);
      }
      const lines: string[] = [];
      for (let d = 0; d < 7; d++) {
        const items = byDow.get(d) ?? [];
        if (items.length === 0) continue;
        lines.push(`  ${dayLabels[d]} (dow=${d}):`);
        for (const it of items) lines.push(`    - [${it.lib_key}] "${it.label}" (${it.time_group})`);
      }
      if (lines.length > 0) scheduleText = lines.join('\n');
    }
  }

  const system = `You are the Lifeline AI health coach. The user is asking to adjust their wellness coaching plan. You can propose ONE concrete action per response:

  • swap_program — replace the active program in a pillar with another from the catalog
  • swap_action — replace a recurring action within their current programs (use only when the user named a specific action they dislike)
  • change_level — promote or demote the user's pillar level
  • move_action_day — reschedule an action from one weekday to another (e.g. "move leg day to Tuesday"). Use original_dow + new_dow with Mon=0..Sun=6. Pick scope='this_week' for one-off ("I'm travelling Thursday") or 'recurring' for a permanent move.
  • add_custom_action — replace a slot with a user-defined activity (e.g. "I'm doing a group class Tuesdays instead of cardio"). original_lib_key + original_dow identify the slot being replaced; title is the new activity. scope works the same way.
  • none — clarifying question, or no action needed

RULES
  • Always use program_keys that appear in the CATALOG below. Never invent keys.
  • Respect the user's limitations (MSK / chronic conditions / allergies). Surface a one-sentence rationale referencing the user's request.
  • Stay in wellness register: never diagnose, never prescribe medications, never claim clinical outcomes. If the request is medical ("what should I take for my back pain"), redirect to GP and return kind='none'.
  • If you can't propose a clean swap, ask a short clarifying question in 'reply' and return kind='none'.
  • Reply is ONE paragraph (≤60 words), warm and direct, never marketing-speak.

USER CONTEXT
  Current programs:
${currentPrograms.map((cp) => `    ${cp.category_key}: ${cp.program_key}`).join('\n') || '    (none active)'}

  Pillar levels:
${levels.map((l) => `    ${l.pillar}: ${l.level}`).join('\n') || '    (defaults)'}

  Limitations: ${limitations ? JSON.stringify(limitations) : '(none recorded)'}

  Preferences: ${preferences ? JSON.stringify(preferences) : '(none recorded)'}

${dismissedSummary.length > 0 ? `  Previously dismissed actions (DO NOT propose a swap_action whose to_lib_key reintroduces any of these; for swap_program, avoid programs built around them):
${dismissedSummary.map((d) => `    - "${d.label}" (reason: ${d.reason})`).join('\n')}

` : ''}CATALOG
${catalogText}

THIS WEEK'S SCHEDULE (use these lib_keys + dow values for move_action_day / add_custom_action; today is ${dayLabels[todayMonIdx]} dow=${todayMonIdx})
${scheduleText}`;

  const userMessages = [
    ...(parsed.data.history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: parsed.data.message },
  ];

  let result;
  try {
    result = await generateText({
      model: openai(MODEL),
      output: Output.object({ schema: responseSchema }),
      system,
      messages: userMessages as any,
      maxOutputTokens: 1500,
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { route: '/api/health-coach/chat', user_id: user.id } });
    return NextResponse.json({ ok: false, error: `Model call failed: ${(e as Error).message}` }, { status: 502 });
  }

  if (!result.experimental_output) {
    return NextResponse.json({ ok: false, error: 'Model returned no structured output' }, { status: 502 });
  }
  const out = result.experimental_output as z.infer<typeof responseSchema>;

  // Defensive: drop invalid program keys; coerce to 'none' if the
  // proposed action references something we can't actually do.
  if (out.proposed_action.kind === 'swap_program') {
    if (!validKeys.has(out.proposed_action.to_key) || !validKeys.has(out.proposed_action.from_key)) {
      out.proposed_action = { kind: 'none' };
    }
  }
  // Block a swap_action that would re-introduce a previously dismissed
  // lib_key. The prompt already nudges against this, but enforcement
  // belongs at the boundary regardless of model output.
  if (out.proposed_action.kind === 'swap_action' && dismissedKeys.has(out.proposed_action.to_lib_key)) {
    out.proposed_action = { kind: 'none' };
  }
  // Defensive: a no-op move (original_dow === new_dow) is invalid.
  if (out.proposed_action.kind === 'move_action_day' && out.proposed_action.original_dow === out.proposed_action.new_dow) {
    out.proposed_action = { kind: 'none' };
  }

  return NextResponse.json({ ok: true, ...out });
}
