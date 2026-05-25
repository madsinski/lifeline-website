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

// Level the program is calibrated for. Surfaced in the UI so the
// user sees which option matches their experience before they
// commit. We trust the catalog's `level` column — the model is told
// to copy it verbatim, never invent.
const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

const recSchema = z.object({
  recommendations: z.array(z.object({
    pillar: z.enum(PILLARS),
    // Slot is required for the exercise pillar (one rec per slot,
    // 3 in total: strength + zone2 + hiit). Other pillars set slot
    // to null. The model must always emit the field.
    slot: z.enum(['strength','zone2','hiit','mobility']).nullable(),
    program_key: z.string(),
    program_name: z.string(),
    // Catalog level — beginner/intermediate/advanced. May be null
    // when the catalog doesn't tag the program. The server re-derives
    // this from the live catalog after the model returns, so even if
    // the model hallucinates we end up with the truth.
    level: z.enum(LEVELS).nullable(),
    rationale: z.string(),
    alternatives: z.array(z.object({
      program_key: z.string(),
      program_name: z.string(),
      level: z.enum(LEVELS).nullable(),
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
    .select('id, key, name, description, category_id, level, target_audience, weekly_modality_target, slot')
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
  const programIdToKey = new Map<string, string>(
    (catalog ?? []).map((c) => [(c as any).id as string, (c as any).key as string])
  );
  const actionLabelsByProgram = new Map<string, string[]>();
  if (programKeys.length > 0) {
    try {
      // NB: program_actions joins programs by program_id (uuid), not by
      // the program key string. Earlier version used program_key which
      // doesn't exist on this table and silently returned no rows.
      const programIds = Array.from(programIdToKey.keys());
      const { data: actionRows } = await supabaseAdmin
        .from('program_actions')
        .select('program_id, label')
        .in('program_id', programIds);
      for (const row of (actionRows ?? []) as Array<{ program_id: string; label: string | null }>) {
        if (!row.label) continue;
        const key = programIdToKey.get(row.program_id);
        if (!key) continue;
        const arr = actionLabelsByProgram.get(key) ?? [];
        if (arr.length < 8 && !arr.includes(row.label)) arr.push(row.label);
        actionLabelsByProgram.set(key, arr);
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
      const target = x.weekly_modality_target as Record<string, number> | null;
      const mixLine = target && Object.keys(target).length > 0
        ? `\n    weekly_mix: ${Object.entries(target).filter(([, v]) => (v as number) > 0).map(([k, v]) => `${k}=${v}`).join(' · ')}`
        : '';
      // Slot is the load-bearing field for the new multi-pick exercise
      // mix — the model picks ONE program per slot (strength / zone2
      // / hiit) instead of one global program for the pillar.
      const slotLine = x.slot ? `\n    slot: ${x.slot}` : '';
      return `  - key: ${x.key}\n    name: ${x.name}\n    level: ${x.level || 'unspecified'}${slotLine}\n    description: ${x.description ?? ''}${mixLine}${sampleLine}`;
    }).join('\n');
  }).join('\n\n');

  const systemPrompt = `You recommend programs for a new Lifeline Health user, based on their onboarding answers.

OUTPUT SHAPE — read carefully, this is non-negotiable:
  • For the EXERCISE pillar you MUST return THREE recommendations — one per slot:
      - slot: "strength" → pick from programs with slot=strength
      - slot: "zone2"    → pick from programs with slot=zone2
      - slot: "hiit"     → pick from programs with slot=hiit
    Lifeline policy: every user mixes strength + zone 2 + HIIT. There is no
    "skip HIIT" option here — for users who can't do hard intervals yet
    (cardio_baseline = sedentary), still pick the gentlest HIIT program
    (hiit-bodyweight-track) and call out in the rationale that they
    should ease into it.
    DO NOT pick preset slot programs (balanced-* / endurance-priority
    / class-warrior) here — those are legacy multi-program bundles only
    surfaced when the user explicitly opts into a "preset mix".
  • For NUTRITION / SLEEP / MENTAL — return ONE recommendation. Set slot=null.
  • Two alternatives per recommendation so the user can override.

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
  • exercise_preferences are LOAD-BEARING for the exercise pillar pick — read input.exercise_preferences below and apply:
      cardio_baseline = "sedentary" → HARD: prefer a strength-only program
        like essential-strength or a foundation hybrid (balanced-foundation).
        NEVER pick a program with weekly_mix.hiit > 0. Call this out in the rationale.
      cardio_baseline = "recreational" → moderate hybrid (balanced-foundation
        or balanced-athletic). Avoid endurance-priority unless user
        explicitly picked run/cycle/swim in cardio_picks.
      cardio_baseline = "fit" → balanced-athletic, push-pull-legs, upper-lower-split, or endurance-priority all viable.
      cardio_baseline = "athlete" → endurance-priority or push-pull-legs.
      cardio_picks is what the user said they'd actually do for zone 2:
        Empty array AND no regular_classes → user dislikes cardio →
          prefer pure strength programs (essential-strength,
          upper-lower-split, push-pull-legs) over hybrid programs that
          schedule zone 2 days. Call it out in the rationale.
        Includes "run" → ok to suggest endurance-priority.
        Includes only "walk"/"hike" → balanced-foundation; don't
          suggest endurance-priority (it expects bike/run volume).
        Includes "swim" only → balanced-foundation; mention they'll
          need to slot swim into the zone 2 days themselves.
      hiit_picks empty AND cardio_baseline != "sedentary" → suggest a
        program with weekly_mix.hiit = 0 OR call out that the HIIT slot
        is optional. Don't FORCE a HIIT-required program on someone who
        said they wouldn't do HIIT.
      regular_classes non-empty → STRONG signal for class-warrior. If
        user attends kettlebell/F45/HotFit/CrossFit/spin/OTF/bootcamp,
        prefer class-warrior so their classes count toward their plan.
        If only yoga/pilates → soft signal, not strong enough alone.
  • primaryGoals weighting (multi-select, prioritize earliest entries):
      EXERCISE pillar:
        "strength" or "muscle" first → pick essential-strength /
          upper-lower-split / push-pull-legs depending on level. Don't pick
          endurance-priority.
        "stamina" first → endurance-priority or balanced-athletic.
        "fat-loss" first → balanced-athletic or balanced-foundation
          (high training-volume hybrids work well for fat-loss recomp).
        "mobility" first → still pick a strength program but mention in
          rationale that mobility actions are scheduled across all programs.
        "health" or "sport" → match to level + activity profile, no goal-
          specific bias.
      NUTRITION pillar (CRITICAL — primaryGoal directly drives nutrition pick):
        "muscle" or "strength" first → pick performance-fuel-pro (or any
          high-protein, surplus-friendly plan). NEVER pick fat-loss-essentials
          for a muscle-building goal — it's a calorie-deficit plan that will
          actively work against muscle gain.
        "fat-loss" first → pick fat-loss-essentials.
        "sport" or "stamina" first → pick performance-fuel-pro
          (carb-forward, fuels training volume).
        "health" / "mobility" / no clear goal → pick foundational-eating
          (the gentlest broad plan that fits any goal).
        Tie-break by activityLevel only when primaryGoal gives no signal.
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

  // Defensive: drop any picks whose key isn't in the catalog AND
  // enforce slot integrity for the exercise pillar. The model is told
  // to emit slot=strength/zone2/hiit for exercise — if it returns a
  // mismatch (e.g. a strength program in the zone2 slot) we coerce
  // to the first catalog entry matching the requested slot.
  const validKeys = new Set(catalog.map((c) => (c as any).key as string));
  const keyToSlot = new Map<string, string | null>(
    catalog.map((c) => [(c as any).key as string, ((c as any).slot as string | null) ?? null])
  );
  // Catalog-truth level lookup — used to overwrite whatever the model
  // returns so the UI badge always reflects the actual program record,
  // never a hallucinated tag.
  const keyToLevel = new Map<string, 'beginner' | 'intermediate' | 'advanced' | null>(
    catalog.map((c) => {
      const lvl = ((c as any).level as string | null) ?? null;
      const normalized = lvl === 'beginner' || lvl === 'intermediate' || lvl === 'advanced' ? lvl : null;
      return [(c as any).key as string, normalized];
    })
  );
  const programsBySlot = new Map<string, any[]>();
  for (const p of catalog) {
    const s = (p as any).slot as string | null;
    if (!s) continue;
    const arr = programsBySlot.get(s) ?? [];
    arr.push(p);
    programsBySlot.set(s, arr);
  }

  const safe = out.recommendations.map((r) => {
    // 1) Validate the key is in the catalog.
    let chosen = validKeys.has(r.program_key) ? r.program_key : null;

    // 2) Enforce slot integrity for exercise. Non-exercise pillars
    //    don't care about slot.
    if (r.pillar === 'exercise') {
      // Block preset programs from showing up as a slot pick — they
      // belong on the explicit "use a preset mix" path only.
      if (chosen && keyToSlot.get(chosen) === 'preset') chosen = null;
      // If a slot was requested, the picked program's slot must match.
      if (r.slot && chosen && keyToSlot.get(chosen) !== r.slot) chosen = null;
      // Fallback: first catalog program in the requested slot.
      if (!chosen && r.slot) {
        chosen = (programsBySlot.get(r.slot)?.[0] as any)?.key ?? null;
      }
    } else if (!chosen) {
      chosen = (catalogByPillar.get(r.pillar)?.[0] as any)?.key ?? null;
    }

    // Filter alternatives the same way — keep slot-matching ones for
    // exercise, anything-in-pillar for the other pillars.
    const altsValid = r.alternatives.filter((a) => validKeys.has(a.program_key));
    const alts = r.pillar === 'exercise' && r.slot
      ? altsValid.filter((a) => keyToSlot.get(a.program_key) === r.slot)
      : altsValid;

    // Overwrite level on every program with the catalog truth — the
    // model can hallucinate level even when the schema asks for it,
    // and the UI surfaces this as a badge so we cannot trust the
    // model output here.
    const safeAlts = alts.slice(0, 3).map((a) => ({
      ...a,
      level: chosen && a.program_key ? (keyToLevel.get(a.program_key) ?? null) : null,
    }));
    const chosenLevel = chosen ? (keyToLevel.get(chosen) ?? null) : null;

    return { ...r, program_key: chosen, level: chosenLevel, alternatives: safeAlts };
  }).filter((r) => !!r.program_key);

  return NextResponse.json({ ok: true, recommendations: safe });
}
