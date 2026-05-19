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
// Catalog includes Icelandic aliases — Lifeline's primary market.
// Lab.is, Klínikin, and Hjartavernd reports use these spellings. The
// model is told to strip p-/s-/b- prefixes (plasma/serum/blood) before
// matching, and to look past accents.
const KNOWN_MARKERS = [
  { code: 'LDL-C',  aliases: ['ldl', 'ldl-c', 'ldl cholesterol', 'ldl-kolesteról'] },
  { code: 'HDL-C',  aliases: ['hdl', 'hdl-c', 'hdl cholesterol', 'hdl-kolesteról'] },
  { code: 'TC',     aliases: ['total cholesterol', 'cholesterol', 'tc', 'kolesteról', 'heildarkolesteról'] },
  { code: 'TG',     aliases: ['triglycerides', 'tg', 'triglycerid', 'thríglyseríd', 'thríglýseríðar'] },
  { code: 'APO-B',  aliases: ['apo b', 'apolipoprotein b', 'apo-b', 'apó-b', 'apolípóprótín b'] },
  { code: 'LP(a)',  aliases: ['lp(a)', 'lipoprotein a', 'lipoprotein(a)', 'lp-a', 'lípóprótín a'] },
  { code: 'GLU-F',  aliases: ['fasting glucose', 'glucose', 'fbg', 'glu', 'glúkósi', 'blóðsykur', 'fastandi glúkósi'] },
  { code: 'HBA1C',  aliases: ['hba1c', 'a1c', 'glycated hemoglobin'] },
  { code: 'INS-F',  aliases: ['fasting insulin', 'insulin', 'insúlín'] },
  { code: 'HOMA-IR',aliases: ['homa-ir', 'homa ir'] },
  { code: 'ALT',    aliases: ['alt', 'sgpt', 'alat'] },
  { code: 'AST',    aliases: ['ast', 'sgot', 'asat'] },
  { code: 'GGT',    aliases: ['ggt', 'gamma gt', 'gt', 'gamma-gt'] },
  { code: 'ALP',    aliases: ['alp', 'alkaline phosphatase', 'alkalískur fosfatasi'] },
  { code: 'BILT',   aliases: ['total bilirubin', 'bilirubin', 'bilirubin total', 'bílirúbín'] },
  { code: 'ALB',    aliases: ['albumin', 'albúmín'] },
  { code: 'CREA',   aliases: ['creatinine', 'creat', 'kreatinin', 'kreatínín'] },
  { code: 'EGFR',   aliases: ['egfr', 'estimated gfr', 'gfr'] },
  { code: 'BUN',    aliases: ['urea', 'bun', 'blood urea nitrogen', 'þvagefni'] },
  { code: 'URIC',   aliases: ['uric acid', 'urate', 'þvagsýra'] },
  { code: 'TSH',    aliases: ['tsh', 'thyroid stimulating hormone'] },
  { code: 'FT4',    aliases: ['free t4', 'ft4', 'thyroxine free', 'frítt t4'] },
  { code: 'FT3',    aliases: ['free t3', 'ft3', 'frítt t3'] },
  { code: 'HGB',    aliases: ['hemoglobin', 'hgb', 'haemoglobin', 'hb', 'hemóglóbín', 'blóðrauði'] },
  { code: 'HCT',    aliases: ['hematocrit', 'hct', 'hkr', 'hematókrít'] },
  { code: 'RBC',    aliases: ['rbc', 'red blood cells', 'red cell count'] },
  { code: 'WBC',    aliases: ['wbc', 'white blood cells', 'white cell count', 'leukocytes'] },
  { code: 'PLT',    aliases: ['plt', 'platelets', 'platelet count', 'blóðflögur'] },
  { code: 'MCV',    aliases: ['mcv', 'mean cell volume'] },
  { code: 'HSCRP',  aliases: ['hscrp', 'hs-crp', 'high sensitivity crp', 'crp'] },
  { code: 'ESR',    aliases: ['esr', 'erythrocyte sedimentation rate', 'sökk'] },
  { code: '25OHD',  aliases: ['25-oh d', 'vitamin d', '25(oh)d', 'd-vítamín', 'd vítamín'] },
  { code: 'B12',    aliases: ['b12', 'vitamin b12', 'cobalamin', 'kóbalamín', 'b12-vítamín'] },
  { code: 'FOL',    aliases: ['folate', 'folic acid', 'folate serum', 'fólat'] },
  { code: 'FERR',   aliases: ['ferritin', 'ferrítín'] },
  { code: 'FE',     aliases: ['iron', 'serum iron', 'járn'] },
  { code: 'TIBC',   aliases: ['tibc', 'total iron binding capacity'] },
  { code: 'MG',     aliases: ['magnesium', 'mg', 'magnesíum'] },
  { code: 'ZN',     aliases: ['zinc', 'zn', 'sink'] },
  { code: 'TST-T',  aliases: ['total testosterone', 'testosterone total', 'testósterón'] },
  { code: 'TST-F',  aliases: ['free testosterone'] },
  { code: 'SHBG',   aliases: ['shbg', 'sex hormone binding globulin'] },
  { code: 'CORT',   aliases: ['cortisol', 'morning cortisol', 'kortísól'] },
  { code: 'EST',    aliases: ['estradiol', 'e2'] },
  { code: 'HCY',    aliases: ['homocysteine', 'hómócystein', 'homocystein'] },
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

// Accept either:
//   • Legacy single-image form { image_base64, mime_type }
//   • New multi-page form { images: [{ image_base64, mime_type }, ...] }
//
// Multi-page is preferred for typical clinical lab reports that span
// 2-4 pages — the model receives all pages in one message and can
// correlate values across them (e.g. a TC/HDL ratio printed on page 1
// using values listed on page 2).
const imagePartSchema = z.object({
  image_base64: z.string().min(100).max(20_000_000),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
});
const requestSchema = z.union([
  imagePartSchema,
  z.object({
    images: z.array(imagePartSchema).min(1).max(8),
  }),
]);

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
  // Normalize legacy single-image and new multi-image shapes into one
  // array. Every downstream step deals only with `images`.
  const images: Array<{ image_base64: string; mime_type: string }> =
    'images' in parsed.data
      ? parsed.data.images
      : [{ image_base64: parsed.data.image_base64, mime_type: parsed.data.mime_type }];

  // 10 MB cap per page — multi-page requests can exceed this in
  // aggregate but no single page should.
  for (const img of images) {
    const approxBytes = (img.image_base64.length * 3) / 4;
    if (approxBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({ ok: false, error: 'One of the images is too large (10 MB per page max)' }, { status: 413 });
    }
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
  • COMPLETENESS IS THE TOP PRIORITY. Return EVERY measurable row you can read on the report. Do not skip a row because the label is unfamiliar, the unit is missing, the reference range is absent, or the mapping is uncertain. A row with matched_code=null, missing unit, and missing range is still useful — the user can edit it before save.
  • If a numeric value is not visible or you can't read it confidently, only then omit the row. Never invent numeric values.
  • Reference ranges: extract the low/high pair when shown. If only one bound is shown (e.g. "< 5.0"), set the unspecified side to null. If no range is shown, return null for both.
  • Units: extract verbatim from the report (e.g. "mg/dL", "mmol/L", "ng/mL"). Do not convert. If a row has no unit visible, return an empty string.
  • Confidence per marker:
      "high"   — clear value + unit + label, no ambiguity
      "medium" — value clear, unit slightly cropped or label abbreviated
      "low"    — value barely readable, multiple possible interpretations

MAPPING
  • Map each row's label to a Lifeline marker code from the catalog below, using the alias list. Case-insensitive. Partial matches OK.
  • IMPORTANT: strip plasma/serum/blood prefixes ("P-", "S-", "B-") before matching. "P-Glúkósi" → match against "glúkósi" → GLU-F. "S-Kreatínín" → match against "kreatinín" → CREA. "p-hómócystein" → match against "hómócystein" → HCY.
  • Be aggressive about matching Icelandic labels — most aliases include Icelandic spellings (with and without accents). If the label is clearly the Icelandic form of a marker in the catalog, MATCH it, don't return null.
  • If you can't map confidently, set matched_code = null and PREFER an English raw_label. Examples:
      "p-hómócystein"   → raw_label: "Homocysteine"
      "blóðrauði"       → raw_label: "Hemoglobin"
      "járn í blóði"    → raw_label: "Serum iron"
    If you can't translate confidently, return the Icelandic label verbatim or transliterated — DON'T DROP THE ROW. A user can re-label in the next step, but they can't recover a row you didn't return.

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
          {
            type: 'text',
            text: images.length > 1
              ? `Extract ALL blood-test markers from this ${images.length}-page lab report (pages attached in order). Be exhaustive — do not skip rows you can read. If the SAME marker (same lab code/name + same value) appears on more than one page, keep just one copy using the clearest reading. But DIFFERENT markers across pages must each have their own row. Follow the rules in the system prompt.`
              : 'Extract ALL blood-test markers from this report image. Be exhaustive — do not skip rows you can read. Follow the rules in the system prompt.',
          },
          ...images.map((img) => ({
            type: 'image' as const,
            image: `data:${img.mime_type};base64,${img.image_base64}`,
          })),
        ],
      }],
      // Bumped from 4000 — a 3-page lab report can carry 40+ markers
      // with units, ranges, and labels, and we want to be sure the
      // model never truncates a row mid-response.
      maxOutputTokens: 8000,
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
