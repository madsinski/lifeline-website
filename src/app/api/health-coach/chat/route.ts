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
  const [currentProgsRes, levelsRes, catalogRes, categoriesRes, clientRes] = await Promise.all([
    supabaseAdmin.from('client_programs').select('category_key, program_key').eq('client_id', user.id),
    supabaseAdmin.from('client_pillar_levels').select('pillar, level').eq('client_id', user.id),
    supabaseAdmin.from('programs').select('key, name, description, category_id, level'),
    supabaseAdmin.from('program_categories').select('id, key'),
    supabaseAdmin.from('clients').select('onboarding_data').eq('id', user.id).maybeSingle(),
  ]);

  const currentPrograms = (currentProgsRes.data ?? []) as Array<{ category_key: string; program_key: string }>;
  const levels = (levelsRes.data ?? []) as Array<{ pillar: string; level: string }>;
  const categories = (categoriesRes.data ?? []) as Array<{ id: string; key: string }>;
  const catIdToPillar = new Map(categories.map((c) => [c.id, c.key]));
  const catalog = (catalogRes.data ?? []) as Array<{ key: string; name: string; description: string | null; category_id: string; level: string | null }>;
  const limitations = (clientRes.data as any)?.onboarding_data?.limitations ?? null;

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

  const system = `You are the Lifeline AI health coach. The user is asking to adjust their wellness coaching plan. You can propose ONE concrete action per response:

  • swap_program — replace the active program in a pillar with another from the catalog
  • swap_action — replace a recurring action within their current programs (use only when the user named a specific action they dislike)
  • change_level — promote or demote the user's pillar level
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

CATALOG
${catalogText}`;

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

  return NextResponse.json({ ok: true, ...out });
}
