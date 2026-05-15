// POST /api/health/parse-lab-report
//
// ─────────────────────────────────────────────────────────────────
// SPEC
// ─────────────────────────────────────────────────────────────────
// Purpose
//   Take a single image of a blood-test report (photo of paper, lab
//   portal screenshot, or PDF page captured as image) and return the
//   structured data that drives the in-app blood-panel form. The
//   image transits server-side memory only — it is never persisted,
//   logged, or written to Supabase. The extracted DATA lands in
//   whichever store the user normally uses (local SQLite for
//   international users, Supabase for Iceland), via the existing
//   save paths in the app.
//
// Request
//   Authorization: Bearer <Supabase JWT>
//   Content-Type:  application/json
//   Body: {
//     image_base64: string          // base64 image bytes (no data: prefix)
//     mime_type: 'image/jpeg' | 'image/png' | 'image/heic' | 'image/webp'
//     // future: pdf_base64 + page_index for PDF support
//   }
//
// Response (200)
//   {
//     ok: true,
//     panel: {
//       date_iso: string | null,    // ISO date if found, e.g. "2024-08-12"
//       lab_name: string | null,
//       fasting: boolean | null,
//       notes: string | null,
//     },
//     markers: [{
//       matched_code: string | null,    // Lifeline catalog code if mapped
//       raw_label: string,              // What the report says verbatim
//       value: number,
//       unit: string,
//       reference_low: number | null,
//       reference_high: number | null,
//       confidence: 'high' | 'medium' | 'low',
//     }, ...],
//     warnings: string[],           // anything the AI couldn't confirm
//   }
//
// Rate limit: 5 calls / day for free tier, unlimited for paid. Reads
// the user's coaching_tier off the clients row; defaults to free on
// any error.
//
// Privacy: image bytes never leave this function's call stack.
// Anthropic/OpenAI's enterprise terms with @ai-sdk/openai apply
// (no training on data). Logs capture user_id + count only.

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

// ── Lifeline marker catalog (kept in sync with src/lib/bloodMarkers.ts
//    in the RN app). Inlined here so the model can map the lab's free-
//    form label ("LDL-c", "Cholesterol LDL", etc.) to our canonical
//    code. Mismatched markers come back with matched_code=null and
//    raw_label populated — the UI lets the user accept-as-custom.
const KNOWN_MARKERS = [
  { code: 'LDL-C',  aliases: ['ldl', 'ldl-c', 'ldl cholesterol', 'ldl-kolesteról'] },
  { code: 'HDL-C',  aliases: ['hdl', 'hdl-c', 'hdl cholesterol'] },
  { code: 'TC',     aliases: ['total cholesterol', 'cholesterol', 'tc'] },
  { code: 'TG',     aliases: ['triglycerides', 'tg', 'triglycerid'] },
  { code: 'APO-B',  aliases: ['apo b', 'apolipoprotein b', 'apo-b'] },
  { code: 'LP(a)',  aliases: ['lp(a)', 'lipoprotein a', 'lipoprotein(a)'] },
  { code: 'GLU-F',  aliases: ['fasting glucose', 'glucose', 'fbg', 'glu', 'glúkósi'] },
  { code: 'HBA1C',  aliases: ['hba1c', 'a1c', 'glycated hemoglobin'] },
  { code: 'INS-F',  aliases: ['fasting insulin', 'insulin'] },
  { code: 'HOMA-IR',aliases: ['homa-ir', 'homa ir'] },
  { code: 'ALT',    aliases: ['alt', 'sgpt'] },
  { code: 'AST',    aliases: ['ast', 'sgot'] },
  { code: 'GGT',    aliases: ['ggt', 'gamma gt'] },
  { code: 'ALP',    aliases: ['alp', 'alkaline phosphatase'] },
  { code: 'BILT',   aliases: ['total bilirubin', 'bilirubin', 'bilirubin total'] },
  { code: 'ALB',    aliases: ['albumin'] },
  { code: 'CREA',   aliases: ['creatinine', 'creat', 'kreatinin'] },
  { code: 'EGFR',   aliases: ['egfr', 'estimated gfr', 'gfr'] },
  { code: 'BUN',    aliases: ['urea', 'bun', 'blood urea nitrogen'] },
  { code: 'URIC',   aliases: ['uric acid', 'urate', 'þvagsýra'] },
  { code: 'TSH',    aliases: ['tsh', 'thyroid stimulating hormone'] },
  { code: 'FT4',    aliases: ['free t4', 'ft4', 'thyroxine free'] },
  { code: 'FT3',    aliases: ['free t3', 'ft3'] },
  { code: 'HGB',    aliases: ['hemoglobin', 'hgb', 'haemoglobin', 'hb'] },
  { code: 'HCT',    aliases: ['hematocrit', 'hct'] },
  { code: 'RBC',    aliases: ['rbc', 'red blood cells', 'red cell count'] },
  { code: 'WBC',    aliases: ['wbc', 'white blood cells', 'white cell count', 'leukocytes'] },
  { code: 'PLT',    aliases: ['plt', 'platelets', 'platelet count'] },
  { code: 'MCV',    aliases: ['mcv', 'mean cell volume'] },
  { code: 'HSCRP',  aliases: ['hscrp', 'hs-crp', 'high sensitivity crp'] },
  { code: 'ESR',    aliases: ['esr', 'erythrocyte sedimentation rate'] },
  { code: '25OHD',  aliases: ['25-oh d', 'vitamin d', '25(oh)d', 'd-vítamín'] },
  { code: 'B12',    aliases: ['b12', 'vitamin b12', 'cobalamin'] },
  { code: 'FOL',    aliases: ['folate', 'folic acid', 'folate serum'] },
  { code: 'FERR',   aliases: ['ferritin'] },
  { code: 'FE',     aliases: ['iron', 'serum iron'] },
  { code: 'TIBC',   aliases: ['tibc', 'total iron binding capacity'] },
  { code: 'MG',     aliases: ['magnesium', 'mg'] },
  { code: 'ZN',     aliases: ['zinc', 'zn'] },
  { code: 'TST-T',  aliases: ['total testosterone', 'testosterone total'] },
  { code: 'TST-F',  aliases: ['free testosterone'] },
  { code: 'SHBG',   aliases: ['shbg', 'sex hormone binding globulin'] },
  { code: 'CORT',   aliases: ['cortisol', 'morning cortisol'] },
  { code: 'EST',    aliases: ['estradiol', 'e2'] },
];

// ── Zod schema for the structured AI output. The model is forced to
// produce JSON matching this shape via the AI SDK's Output.object.
const responseSchema = z.object({
  panel: z.object({
    date_iso: z.string().nullable(),
    lab_name: z.string().nullable(),
    fasting: z.boolean().nullable(),
    notes: z.string().nullable(),
  }),
  markers: z.array(z.object({
    matched_code: z.string().nullable(),
    raw_label: z.string(),
    value: z.number(),
    unit: z.string(),
    reference_low: z.number().nullable(),
    reference_high: z.number().nullable(),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
  warnings: z.array(z.string()),
});

const requestSchema = z.object({
  image_base64: z.string().min(100).max(20_000_000),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
});

async function checkRateLimit(clientId: string, tier: string | null): Promise<boolean> {
  if (tier === 'premium' || tier === 'self-maintained') return true;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('lab_import_log')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('created_at', since);
  return (count ?? 0) < FREE_DAILY_LIMIT;
}

async function logImport(clientId: string, ok: boolean, markerCount: number, errorMsg?: string) {
  try {
    await supabaseAdmin.from('lab_import_log').insert({
      client_id: clientId,
      ok,
      marker_count: markerCount,
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

  // Validate body
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: `Bad body: ${parsed.error.message}` }, { status: 400 });
  }
  const { image_base64, mime_type } = parsed.data;

  // 10 MB cap on the decoded image
  const approxBytes = (image_base64.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json({ ok: false, error: 'Image too large (10 MB max)' }, { status: 413 });
  }

  // Tier + rate limit
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

  // Build the catalog hint for the prompt — short list of (code → aliases).
  const catalogText = KNOWN_MARKERS
    .map((m) => `${m.code}: ${m.aliases.slice(0, 4).join(', ')}`)
    .join('\n');

  const systemPrompt = `You extract structured blood-test data from an image of a lab report. The image may be a photographed paper printout, a screenshot of a patient portal, or a rendered PDF page.

OUTPUT RULES
  • Return a single JSON object matching the supplied schema.
  • If a field is not visible or you cannot read it confidently, return null. Never invent numeric values.
  • Reference ranges: extract the low/high pair when shown. If only one bound is shown (e.g. "< 5.0"), set the unspecified side to null. If no range is shown, return null for both.
  • Units: extract verbatim from the report (e.g. "mg/dL", "mmol/L", "ng/mL"). Do not convert.
  • Confidence per marker:
      "high"   — clear value + unit + label, no ambiguity
      "medium" — value clear, unit slightly cropped or label abbreviated
      "low"    — value barely readable, multiple possible interpretations

MAPPING
  • Map each row's label to a Lifeline marker code from the catalog below, using the alias list. Case-insensitive. Partial matches OK.
  • If you can't map confidently, set matched_code = null and put the report's label verbatim in raw_label. The user gets a chance to map it manually in the next step.

PANEL FIELDS
  • date_iso: ISO date (YYYY-MM-DD) if a collection or report date is shown. Otherwise null.
  • lab_name: the lab's name if printed on the page (e.g. "Quest Diagnostics", "Lab.is", "NHS Health Check"). Strip address details.
  • fasting: true if explicitly noted as fasting, false if explicitly noted as non-fasting, null otherwise.
  • notes: any short clinically-relevant note from the report (e.g. "Patient on statin therapy"). Otherwise null.

WARNINGS
  • Any row you skipped or partially extracted goes into warnings as a one-line note (e.g. "Row 'TC/HDL ratio' not extracted — derived value").
  • Surface ambiguous units or out-of-range-flag mismatches in warnings.

MARKER CATALOG (code: aliases)
${catalogText}`;

  let result;
  try {
    result = await generateText({
      model: openai(MODEL),
      output: Output.object({ schema: responseSchema }),
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extract all blood-test markers from this report image. Follow the rules in the system prompt.' },
          { type: 'image', image: `data:${mime_type};base64,${image_base64}` },
        ],
      }],
      maxOutputTokens: 4000,
    });
  } catch (e) {
    const msg = (e as Error).message || 'model call failed';
    Sentry.captureException(e, { tags: { route: '/api/health/parse-lab-report', user_id: userId } });
    await logImport(userId, false, 0, msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  if (!result.experimental_output) {
    await logImport(userId, false, 0, 'no structured output');
    return NextResponse.json({ ok: false, error: 'Model returned unstructured output' }, { status: 502 });
  }

  const out = result.experimental_output as z.infer<typeof responseSchema>;
  await logImport(userId, true, out.markers.length);

  return NextResponse.json({ ok: true, ...out });
}
