// POST /api/onboarding/recommend-programs
//
// Returns one recommended program per pillar + a short list of
// alternatives, based on the user's onboarding answers. Used by
// OnboardingScreen Step 5; user reviews + confirms before any
// programs activate.
//
// Request body (no image, no PII beyond what's already in clients):
//   { country, exerciseSetting, daysPerWeek, sessionMinutes,
//     primaryGoals, sleepQuality, eatingPattern, stressScore,
//     limitations: { allergies, mskIssues, chronicConditions } }
//
// Response:
//   { ok: true, recommendations: [
//       { pillar, program_key, program_name, rationale,
//         alternatives: [...] },
//   ] }
//
// We read the catalog from public.programs server-side so the
// model only ever proposes program_keys we actually have.

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
  country: z.string().nullable().optional(),
  exerciseSetting: z.enum(['gym', 'home', 'hybrid']).nullable().optional(),
  daysPerWeek: z.number().int().min(1).max(7).optional(),
  sessionMinutes: z.number().int().min(5).max(180).optional(),
  primaryGoals: z.array(z.string()).optional(),
  activityLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  sleepQuality: z.number().int().min(1).max(10).nullable().optional(),
  shiftWork: z.boolean().optional(),
  eatingPattern: z.string().nullable().optional(),
  stressScore: z.number().int().min(1).max(10).nullable().optional(),
  existingPractice: z.boolean().optional(),
  limitations: z.object({
    allergies: z.array(z.string()).optional(),
    mskIssues: z.array(z.string()).optional(),
    chronicConditions: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }).optional(),
});

const PILLARS = ['exercise', 'nutrition', 'sleep', 'mental'] as const;
type Pillar = typeof PILLARS[number];

const recSchema = z.object({
  recommendations: z.array(z.object({
    pillar: z.enum(PILLARS),
    program_key: z.string(),
    program_name: z.string(),
    rationale: z.string(),
    alternatives: z.array(z.object({
      program_key: z.string(),
      program_name: z.string(),
      rationale: z.string(),
    })),
  })),
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
  const input = parsed.data;

  // Pull the program catalog so the model can only propose valid keys.
  const { data: catalog, error: catErr } = await supabaseAdmin
    .from('programs')
    .select('key, name, description, category_id, level, target_audience')
    .order('sort_order', { ascending: true });
  if (catErr || !catalog) {
    return NextResponse.json({ ok: false, error: `Catalog load failed: ${catErr?.message}` }, { status: 500 });
  }
  const { data: categories } = await supabaseAdmin
    .from('program_categories')
    .select('id, key, label');
  const catIdToPillar = new Map<string, string>(
    (categories ?? []).map((c) => [c.id as string, c.key as string])
  );
  const catalogByPillar = new Map<string, typeof catalog>();
  for (const p of catalog) {
    const pillar = catIdToPillar.get((p as any).category_id) || 'unknown';
    const arr = catalogByPillar.get(pillar) ?? [];
    arr.push(p);
    catalogByPillar.set(pillar, arr as any);
  }

  // Compact catalog text for the prompt.
  const catalogText = PILLARS.map((p) => {
    const items = (catalogByPillar.get(p) ?? []).filter((x) => x);
    if (!items.length) return `${p.toUpperCase()}: (no programs available)`;
    return `${p.toUpperCase()}:\n` + items.map((x: any) =>
      `  - key: ${x.key}\n    name: ${x.name}\n    level: ${x.level || 'unspecified'}\n    description: ${x.description ?? ''}`
    ).join('\n');
  }).join('\n\n');

  const systemPrompt = `You recommend ONE program per health pillar (exercise, nutrition, sleep, mental) for a new Lifeline Health user, based on their onboarding answers. You also list two alternative programs per pillar so the user can override.

RULES
  • Use only program_key values that appear in the CATALOG below. Never invent a key.
  • The program_name must match the catalog exactly.
  • Match level to the user's signal:
      activityLevel:beginner / sleepQuality:<6 / stressScore:<4 / eatingPattern:fast_food → prefer "beginner" programs
      activityLevel:advanced / sleepQuality:>8 / stressScore:>7 / eatingPattern:tracks_macros → may suggest "intermediate"
  • Respect limitations:
      mskIssues with "Knees" / "Lower back" → prefer low-impact / mobility programs over running
      chronicConditions with "Pregnancy" / "Recent surgery" → flag in rationale and prefer gentlest option
      allergies → only affects nutrition (suggest broader plans that the user can adapt rather than specific cuisines)
  • Respect setting + days + minutes:
      home setting → home-equipment-friendly exercise programs
      gym setting → gym-based
      hybrid → either is fine
  • Rationale is ONE sentence (≤ 22 words), plain language, references the user's answer that drove the pick.
      Good: "Beginner home plan that fits your 30-min, 3-day budget — no jumping given your knees."
      Bad:  "Based on your selected preferences and lifestyle factors this represents an appropriate starting point."

CATALOG
${catalogText}

USER ANSWERS
${JSON.stringify(input, null, 2)}`;

  let result;
  try {
    result = await generateText({
      model: openai(MODEL),
      output: Output.object({ schema: recSchema }),
      system: systemPrompt,
      prompt: 'Recommend one program per pillar plus two alternatives each.',
      maxOutputTokens: 2500,
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { route: '/api/onboarding/recommend-programs', user_id: user.id } });
    return NextResponse.json({ ok: false, error: `Model call failed: ${(e as Error).message}` }, { status: 502 });
  }

  if (!result.experimental_output) {
    return NextResponse.json({ ok: false, error: 'Model returned no structured output' }, { status: 502 });
  }
  const out = result.experimental_output as z.infer<typeof recSchema>;

  // Defensive: drop any picks whose key isn't actually in the catalog.
  const validKeys = new Set(catalog.map((c) => (c as any).key as string));
  const safe = out.recommendations.map((r) => ({
    ...r,
    program_key: validKeys.has(r.program_key) ? r.program_key : (catalogByPillar.get(r.pillar)?.[0] as any)?.key ?? null,
    alternatives: r.alternatives.filter((a) => validKeys.has(a.program_key)).slice(0, 3),
  })).filter((r) => !!r.program_key);

  return NextResponse.json({ ok: true, recommendations: safe });
}
