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
    dietaryPreferences: z.array(z.string()).optional(),
    mskIssues: z.array(z.string()).optional(),
    chronicConditions: z.array(z.string()).optional(),
    notes: z.string().optional(),
  }).optional(),
  preferences: z.object({
    activityStyles: z.array(z.string()).optional(),
    recoveryStyles: z.array(z.string()).optional(),
    foodStyles: z.array(z.string()).optional(),
  }).optional(),
  // Granular equipment owned at home — drives exercise filtering.
  // Without this the AI was defaulting to barbell-heavy programs
  // for home users.
  homeEquipment: z.array(z.string()).optional(),
  exercise_preferences: z.object({
    cardio_baseline: z.string().nullable().optional(),
    cardio_picks: z.array(z.string()).optional(),
    hiit_picks: z.array(z.string()).optional(),
    regular_classes: z.array(z.string()).optional(),
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

  // Pull the user's "Not for me" dismissals (Phase 3 AI awareness).
  // The model uses these as a soft preference signal — programs that
  // would re-introduce a dismissed action are ranked down with a
  // rationale that references the user's stated reason.
  // Wrap in try/catch so the route still works before the migration
  // is applied to every env.
  let dismissedSummary: { label: string; reason: string }[] = [];
  try {
    const { data: dRows } = await supabaseAdmin
      .from('client_action_dismissals')
      .select('lib_key, reason_category')
      .eq('client_id', user.id);
    if (dRows && dRows.length > 0) {
      const keys = Array.from(new Set(dRows.map((r) => r.lib_key as string)));
      const { data: libRows } = await supabaseAdmin
        .from('action_library')
        .select('lib_key, label')
        .in('lib_key', keys);
      const labelByKey: Record<string, string> = {};
      for (const r of libRows ?? []) labelByKey[r.lib_key as string] = (r.label as string) ?? r.lib_key as string;
      dismissedSummary = dRows.map((r) => ({
        label: labelByKey[r.lib_key as string] ?? (r.lib_key as string),
        reason: r.reason_category as string,
      }));
    }
  } catch { /* table not yet created — no-op */ }

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

  // Pull a sample of action labels per program so the model can do
  // content-aware matching ("this program contains running → bad for
  // knee user") instead of name-guessing. Capped at 8 distinct labels
  // per program to keep prompt size sane. Falls through silently if
  // the program_actions query fails — model still gets program metadata.
  const programKeys = catalog.map((c) => (c as any).key as string);
  const actionLabelsByProgram = new Map<string, string[]>();
  if (programKeys.length > 0) {
    try {
      const { data: actionRows } = await supabaseAdmin
        .from('program_actions')
        .select('program_key, label')
        .in('program_key', programKeys);
      for (const row of (actionRows ?? []) as Array<{ program_key: string; label: string | null }>) {
        if (!row.label) continue;
        const arr = actionLabelsByProgram.get(row.program_key) ?? [];
        if (arr.length < 8 && !arr.includes(row.label)) arr.push(row.label);
        actionLabelsByProgram.set(row.program_key, arr);
      }
    } catch { /* no-op — program_actions optional for the prompt */ }
  }

  // Compact catalog text for the prompt. Each program lists key, name,
  // level, description, plus a sample of actions inside the program
  // (when available) so the model picks content-aware.
  const catalogText = PILLARS.map((p) => {
    const items = (catalogByPillar.get(p) ?? []).filter((x) => x);
    if (!items.length) return `${p.toUpperCase()}: (no programs available)`;
    return `${p.toUpperCase()}:\n` + items.map((x: any) => {
      const sample = actionLabelsByProgram.get(x.key);
      const sampleLine = sample && sample.length > 0
        ? `\n    sample_actions: ${sample.join(' · ')}`
        : '';
      return `  - key: ${x.key}\n    name: ${x.name}\n    level: ${x.level || 'unspecified'}\n    description: ${x.description ?? ''}${sampleLine}`;
    }).join('\n');
  }).join('\n\n');

  const systemPrompt = `You recommend ONE program per health pillar (exercise, nutrition, sleep, mental) for a new Lifeline Health user, based on their onboarding answers. You also list two alternative programs per pillar so the user can override.

RULES
  • Use only program_key values that appear in the CATALOG below. Never invent a key.
  • The program_name must match the catalog exactly.
  • Use sample_actions (when present) to verify content fit BEFORE picking. The program name and description can be misleading — sample_actions is the source of truth for what the user will actually do day-to-day:
      - User has mskIssues:"Knees" and a program's sample_actions include "Running intervals" → pick a different program even if the name says "low-impact"
      - User picked dietaryPreferences:"Vegan" and a program's sample_actions include "Grilled chicken" → pick a plant-forward alternative
      - User picked recoveryStyles:"Breathwork" and a program's sample_actions are all sleep-hygiene tips with zero breathwork → pick a different mental program
  • Match level to the user's signal:
      activityLevel:beginner / sleepQuality:<6 / stressScore:<4 / eatingPattern:fast_food → prefer "beginner" programs
      activityLevel:advanced / sleepQuality:>8 / stressScore:>7 / eatingPattern:tracks_macros → may suggest "intermediate"
  • Respect limitations:
      mskIssues with "Knees" / "Lower back" → prefer low-impact / mobility programs over running
      chronicConditions with "Pregnancy" / "Recent surgery" → flag in rationale and prefer gentlest option
      allergies → only affects nutrition (suggest broader plans that the user can adapt rather than specific cuisines)
      dietaryPreferences (Vegan / Vegetarian / Pescatarian / Halal / Kosher) → HARD constraint for nutrition:
        - Vegan → pick a plant-forward / plant-based program. NEVER suggest a meat-centric program (e.g. "performance-fuel-pro" if it leans high-meat). If only meat-centric plans exist in the catalog, prefer the most adaptable one and CALL OUT the constraint in the rationale.
        - Vegetarian / Pescatarian → avoid programs whose name or description leans heavily on red meat / poultry.
        - Halal / Kosher → no pork-centric plans; otherwise broad nutrition plans are fine.
  • Respect setting + days + minutes + homeEquipment:
      home setting → home-equipment-friendly exercise programs
      gym setting → gym-based
      hybrid → either is fine
      homeEquipment is the GRANULAR truth: when present, NEVER pick a
        program that needs equipment NOT in the list. If only
        'dumbbells' is listed, do NOT pick a barbell-required program;
        prefer dumbbell / bodyweight / kettlebell-friendly options.
        If 'cardio-machine' is absent, do NOT pick a program built
        around treadmill / bike intervals; prefer outdoor or
        bodyweight-cardio alternatives.
        If the catalog has NO matching home-equipment program, pick
        the closest bodyweight-friendly option and CALL OUT the
        constraint in the rationale.
  • Respect exercise_preferences (cardio_picks, hiit_picks,
    regular_classes) as soft signals — bias toward programs that
    match what the user has said they enjoy doing.
  • Respect preferences (input.preferences). These are soft signals:
      activityStyles → bias exercise pick toward matching modalities
        (e.g. "Yoga / pilates" → prefer mobility/flexibility plans;
         "Strength training" → resistance-based plans;
         "Walking"/"Hiking" → low-impact aerobic plans)
      recoveryStyles → bias mental pick toward matching practices
        (e.g. "Meditation" → meditation-based plans;
         "Breathwork" → breath-led plans; "Journaling" → reflection plans)
      foodStyles → bias nutrition pick toward matching approach
        (e.g. "Mediterranean" → Mediterranean plan if available;
         "High-protein" → protein-forward plan;
         "Plant-forward" → plant-based plan;
         "Quick / easy meals" → simpler/lower-prep plan)
      An empty preferences array means "no signal" — fall back to the
      level-based default. Reference the matching preference in the
      rationale when one is the load-bearing reason for the pick.
  • Rationale is ONE sentence (≤ 22 words), plain language, references the user's answer that drove the pick.
      Good: "Beginner home plan that fits your 30-min, 3-day budget — no jumping given your knees."
      Bad:  "Based on your selected preferences and lifestyle factors this represents an appropriate starting point."

CATALOG
${catalogText}

${dismissedSummary.length > 0 ? `USER HAS PREVIOUSLY DISMISSED THESE ACTIONS — DO NOT pick programs that lean heavily on them. Mention the swap in the rationale only if it's the load-bearing reason.
${dismissedSummary.map((d) => `  - "${d.label}" (reason: ${d.reason})`).join('\n')}

` : ''}USER ANSWERS
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
