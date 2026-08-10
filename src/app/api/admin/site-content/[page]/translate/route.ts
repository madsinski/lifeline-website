// AI-translate a page's draft content between Icelandic and English, in place.
// Admin + AAL2. Reads the draft's `from` locale (falling back to that locale's
// built-in defaults), translates each field into `to`, writes the results into
// draft[to], saves, and returns the updated draft.
//
// Mirrors the app's other AI routes (ai v6 generateText + Output.object, openai
// gpt-5.4; direct OPENAI_API_KEY — AI Gateway migration deferred for this stack).

import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";
import { getSitePage } from "@/lib/site-content/registry";
import type { Locale, LocaleContent, SiteContentBlob } from "@/lib/site-content/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = "gpt-5.4";

const outSchema = z.object({
  translations: z.array(z.object({ i: z.number(), text: z.string() })),
});

const SYSTEM = `You are a professional translator for Lifeline Health, an Icelandic health & wellness company. You translate marketing website copy between Icelandic ("is") and English ("en").

Rules:
- Translate naturally and concisely for a healthcare marketing website — clear, trustworthy, warm, motivational.
- PRESERVE formatting exactly: any phrase wrapped in ==double equals== must stay wrapped in == on the translated phrase; keep numbers, units and em dashes intact.
- Do NOT translate brand/product names: "Lifeline", "Lifeline Health", "Medalia", "Sameind", "Lyfja", "Apple Health".
- Do NOT translate proper names of people or clinics (e.g. "Læknastofur Akureyrar").
- Use correct Icelandic health terminology. Return ONLY the translation for each item, no notes.`;

export async function POST(req: NextRequest, ctx: { params: Promise<{ page: string }> }) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ ok: false, error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const { page } = await ctx.params;
  const sitePage = getSitePage(page);
  if (!sitePage) return NextResponse.json({ ok: false, error: "Unsupported page" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY er ekki uppsett" }, { status: 400 });
  }

  let body: { from?: string; to?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const from: Locale = body.from === "en" ? "en" : "is";
  const to: Locale = body.to === "en" ? "en" : "is";
  if (from === to) return NextResponse.json({ ok: false, error: "from og to eru eins" }, { status: 400 });

  const { data: row } = await supabaseAdmin.from("site_content").select("draft").eq("page", page).maybeSingle();
  const draft = (row?.draft as SiteContentBlob) ?? {};
  const fromMap = draft[from] ?? {};
  const defaults: LocaleContent = from === "is" ? sitePage.defaultsIs : sitePage.defaultsEn;

  // Flatten every translatable string into a numbered list; `slots` records
  // where each translation is written back. For list fields, only text columns
  // are translated — asset paths and URLs are locale-independent machine values.
  const items: { i: number; text: string }[] = [];
  type Slot = { key: string } | { key: string; line: number; col: number };
  const slots: Slot[] = [];
  // For list fields we keep the parsed grid so we can re-join after writing.
  const grids = new Map<string, string[][]>();

  const push = (text: string, slot: Slot) => {
    if (text.trim()) {
      items.push({ i: items.length, text });
      slots.push(slot);
    }
  };

  for (const f of sitePage.fields) {
    if (f.type === "image" || f.type === "link" || f.type === "select" || f.type === "internal") continue;
    const src = (fromMap[f.key]?.trim() || defaults[f.key] || "").toString();
    if (f.type === "list") {
      const rows = src.split("\n").map((l) => l.split("|").map((c) => c.trim()));
      grids.set(f.key, rows);
      rows.forEach((cells, line) => {
        (f.columns ?? []).forEach((col, ci) => {
          if ((col.kind ?? "text") === "text" && cells[ci]) push(cells[ci], { key: f.key, line, col: ci });
        });
      });
    } else {
      if (src) push(src, { key: f.key });
    }
  }

  if (items.length === 0) return NextResponse.json({ ok: false, error: "Ekkert efni til að þýða" }, { status: 400 });

  let translated: Map<number, string>;
  try {
    const result = await generateText({
      model: openai(MODEL),
      output: Output.object({ schema: outSchema }),
      system: SYSTEM,
      prompt: `Translate each item's "text" from ${from} to ${to}. Return a translation for every item, keyed by the same "i".\n\n${JSON.stringify(
        items,
      )}`,
      maxOutputTokens: 8000,
    });
    const out = result.experimental_output as z.infer<typeof outSchema> | undefined;
    if (!out) return NextResponse.json({ ok: false, error: "Engin svör frá þýðingavél" }, { status: 502 });
    translated = new Map(out.translations.map((t) => [t.i, t.text]));
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "translate_failed" }, { status: 500 });
  }

  const nextTo: LocaleContent = { ...(draft[to] ?? {}) };
  slots.forEach((slot, i) => {
    const t = translated.get(i);
    if (t === undefined) return;
    if ("line" in slot) {
      const grid = grids.get(slot.key);
      if (grid) grid[slot.line][slot.col] = t;
    } else {
      nextTo[slot.key] = t;
    }
  });
  // Re-join every list field (whether or not any cell changed, so untranslated
  // asset/url columns are preserved verbatim).
  for (const [key, grid] of grids) {
    nextTo[key] = grid.map((cells) => cells.join(" | ")).join("\n");
  }

  const nextDraft: SiteContentBlob = { ...draft, [to]: nextTo };

  const { error: saveErr } = await supabaseAdmin
    .from("site_content")
    .upsert(
      { page, draft: nextDraft, updated_at: new Date().toISOString(), updated_by: auth.id },
      { onConflict: "page" },
    );
  if (saveErr) return NextResponse.json({ ok: false, error: saveErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, draft: nextDraft, count: items.length });
}
