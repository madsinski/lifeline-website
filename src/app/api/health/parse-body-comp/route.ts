// POST /api/health/parse-body-comp
//
// ─────────────────────────────────────────────────────────────────
// SPEC
// ─────────────────────────────────────────────────────────────────
// Purpose
//   Mirror of /api/health/parse-lab-report, but for body-composition
//   results: InBody / Tanita scale printouts, DEXA scans, Bod Pod
//   reports, smart-scale screenshots, and gym-clinic printouts.
//   Image transits server-side memory only — never persisted, logged
//   to Supabase, or written anywhere except the JSON response. The
//   extracted DATA lands in the user's local encrypted SQLite
//   (international) or Supabase row (Iceland) via the existing save
//   path in BodyCompEntryScreen.
//
// Request
//   Authorization: Bearer <Supabase JWT>
//   Content-Type:  application/json
//   Body: {
//     image_base64: string          // base64 image bytes (no data: prefix)
//     mime_type: 'image/jpeg' | 'image/png' | 'image/heic' | 'image/webp'
//   }
//
// Response (200)
//   {
//     ok: true,
//     measurement: {
//       date_iso: string | null,         // ISO date if found
//       source: 'scale_bia' | 'dexa' | 'bodpod' | 'manual' | null,
//       weight_kg: number | null,
//       body_fat_pct: number | null,
//       lean_mass_kg: number | null,
//       fat_mass_kg: number | null,
//       bone_mass_kg: number | null,
//       total_body_water_pct: number | null,
//       height_cm: number | null,
//       waist_cm: number | null,
//       hip_cm: number | null,
//       neck_cm: number | null,
//       notes: string | null,
//       confidence: 'high' | 'medium' | 'low',
//     },
//     warnings: string[],           // anything the AI couldn't confirm
//   }
//
// Rate limit: same as parse-lab-report (5/day free, unlimited paid)
// using the same lab_import_log table so users can't combine the
// two endpoints to bypass the cap.
//
// Privacy: image bytes never leave this function's call stack.

import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import * as Sentry from "@/lib/error-reporter";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gpt-5.4";
const FREE_DAILY_LIMIT = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB after base64 decode

// Reasonable physiological bounds — anything outside these is almost
// certainly a misread, so we drop it back to null and add a warning.
// Tuned to be permissive (we'd rather show the user a value to verify
// than silently hide an unusual-but-real measurement).
const BOUNDS = {
  weight_kg:             { min: 25,  max: 300 },
  body_fat_pct:          { min: 2,   max: 70  },
  lean_mass_kg:          { min: 15,  max: 200 },
  fat_mass_kg:           { min: 1,   max: 200 },
  bone_mass_kg:          { min: 0.5, max: 10  },
  total_body_water_pct:  { min: 25,  max: 75  },
  height_cm:             { min: 120, max: 230 },
  waist_cm:              { min: 40,  max: 200 },
  hip_cm:                { min: 50,  max: 200 },
  neck_cm:               { min: 20,  max: 70  },
};

const responseSchema = z.object({
  measurement: z.object({
    date_iso: z.string().nullable(),
    source: z.enum(['scale_bia', 'dexa', 'bodpod', 'manual']).nullable(),
    weight_kg: z.number().nullable(),
    body_fat_pct: z.number().nullable(),
    lean_mass_kg: z.number().nullable(),
    fat_mass_kg: z.number().nullable(),
    bone_mass_kg: z.number().nullable(),
    total_body_water_pct: z.number().nullable(),
    height_cm: z.number().nullable(),
    waist_cm: z.number().nullable(),
    hip_cm: z.number().nullable(),
    neck_cm: z.number().nullable(),
    notes: z.string().nullable(),
    confidence: z.enum(['high', 'medium', 'low']),
  }),
  warnings: z.array(z.string()),
});

const requestSchema = z.object({
  image_base64: z.string().min(100).max(20_000_000),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
});

async function checkRateLimit(clientId: string, tier: string | null): Promise<boolean> {
  if (tier === 'premium' || tier === 'self-maintained') return true;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Shared cap with parse-lab-report — both write to lab_import_log
  // so a free user can't pull both an AI lab + an AI body-comp every
  // day past the combined limit.
  const { count } = await supabaseAdmin
    .from('lab_import_log')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('created_at', since);
  return (count ?? 0) < FREE_DAILY_LIMIT;
}

async function logImport(clientId: string, ok: boolean, errorMsg?: string) {
  try {
    await supabaseAdmin.from('lab_import_log').insert({
      client_id: clientId,
      ok,
      marker_count: 0,
      error_message: errorMsg ?? null,
    });
  } catch { /* logging failure shouldn't break the response */ }
}

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const token = auth.slice('Bearer '.length);
  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !userData.user) {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }
  const userId = userData.user.id;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not set' }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: `Bad body: ${parsed.error.message}` }, { status: 400 });
  }
  const { image_base64, mime_type } = parsed.data;

  const approxBytes = (image_base64.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json({ ok: false, error: 'Image too large (10 MB max)' }, { status: 413 });
  }

  let tier: string | null = null;
  try {
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('coaching_tier')
      .eq('id', userId)
      .maybeSingle();
    tier = (client as any)?.coaching_tier ?? null;
  } catch { /* default to free */ }
  const allowed = await checkRateLimit(userId, tier);
  if (!allowed) {
    return NextResponse.json({
      ok: false,
      error: `Free tier is limited to ${FREE_DAILY_LIMIT} imports per day. Upgrade to remove the limit.`,
    }, { status: 429 });
  }

  const systemPrompt = `You extract structured body-composition data from an image. The image may be a photo of:
  • An InBody / Tanita / Omron BIA scale printout (gym or clinic)
  • A DEXA-scan body-composition report
  • A Bod Pod report
  • A smart-scale screenshot (Withings, Garmin Index, Renpho, Eufy, Wyze, etc.)
  • A gym-clinic printout
  • A handwritten or printed measurement sheet (tape-measure waist/hip/neck)

OUTPUT RULES
  • Return a single JSON object matching the supplied schema.
  • If a field is not visible or you cannot read it confidently, return null. NEVER invent numeric values.
  • Units: convert to the schema's units (kg for mass, cm for lengths, % for percentages). Many machines report imperial — if you see lbs, convert with lbs ÷ 2.205. If you see inches, convert with in × 2.54. State the conversion in warnings only if it was non-obvious.
  • Source: pick the most specific category visible:
      scale_bia — BIA / smart-scale / InBody / Tanita
      dexa      — DEXA / iDXA / Lunar / Hologic
      bodpod    — Bod Pod air-displacement
      manual    — handwritten measurement, tape-measure log, or unclear instrument
      null      — cannot tell at all
  • Date: ISO date (YYYY-MM-DD) if a measurement / scan date is visible. Today's date is acceptable if explicitly stamped. Otherwise null.
  • Notes: short clinically-relevant note from the report (e.g. "Athlete mode used", "Hydrated 6 hours pre-scan"). Otherwise null.

CONFIDENCE
  Set the overall confidence based on the worst-read primary field:
    "high"   — primary fields (weight + body_fat_pct OR weight + waist) clear and unambiguous
    "medium" — value clear, some fields cropped/missing or unit slightly ambiguous
    "low"    — multiple values barely readable, multiple possible interpretations

WARNINGS
  • Note any value you skipped that LOOKS like a measurement but couldn't be read confidently.
  • Note unit conversions you made.
  • Note if the image quality is low.
  • Keep each warning to one short line.`;

  let result;
  try {
    result = await generateText({
      model: openai(MODEL),
      output: Output.object({ schema: responseSchema }),
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extract body-composition data from this image.' },
          { type: 'image', image: `data:${mime_type};base64,${image_base64}` } as any,
        ],
      } as any],
      maxOutputTokens: 2500,
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { route: '/api/health/parse-body-comp', user_id: userId } });
    await logImport(userId, false, (e as Error).message);
    return NextResponse.json({ ok: false, error: `Vision call failed: ${(e as Error).message}` }, { status: 502 });
  }

  const out = result.experimental_output as z.infer<typeof responseSchema> | undefined;
  if (!out) {
    await logImport(userId, false, 'no structured output');
    return NextResponse.json({ ok: false, error: 'Model returned no structured output' }, { status: 502 });
  }

  // Sanity-bound each numeric field. Values outside the BOUNDS get
  // dropped to null with a warning — better to make the user re-enter
  // by hand than silently save 1500 cm for height.
  const m = { ...out.measurement };
  const warnings = [...(out.warnings ?? [])];
  for (const [key, range] of Object.entries(BOUNDS)) {
    const v = (m as any)[key] as number | null;
    if (v != null && (v < range.min || v > range.max)) {
      warnings.push(`Dropped ${key}=${v} — outside plausible range ${range.min}–${range.max}.`);
      (m as any)[key] = null;
    }
  }

  await logImport(userId, true);

  return NextResponse.json({ ok: true, measurement: m, warnings });
}
