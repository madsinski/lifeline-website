import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

// AI batch translator for presentation copy. Mirrors the app's other AI
// routes (ai v6 generateText + Output.object, openai gpt-5.4). Stateless —
// it just translates the strings it's given; the editor computes what needs
// translating (see src/lib/presentations/i18n.ts planSync) and applies the
// results. Gated to admin + AAL2 since it spends API budget.

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gpt-5.4";

const bodySchema = z.object({
  items: z.array(z.object({
    from: z.enum(["en", "is"]),
    to: z.enum(["en", "is"]),
    text: z.string(),
  })).max(400),
});

const outSchema = z.object({
  translations: z.array(z.object({ i: z.number(), text: z.string() })),
});

const SYSTEM = `You are a professional translator for Lifeline Health, an Icelandic health & wellness company. You translate slide-deck copy between English ("en") and Icelandic ("is").

Rules:
- Translate naturally and concisely for a presentation slide — keep the confident, warm, motivational tone.
- PRESERVE formatting exactly: any phrase wrapped in ==double equals== must remain wrapped in == on the translated phrase; keep line breaks (\\n) in the same places; keep leading/trailing punctuation and em dashes.
- Do NOT translate brand or product names: "Lifeline", "Lífstílseinkunn", "Apple Health", "Wellness Pulse", "Health Coach".
- Use correct Icelandic health terminology. Return ONLY the translation for each item, no notes.`;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }
  await ctx.params; // id not needed beyond auth, but await per route contract

  let parsed: z.infer<typeof bodySchema>;
  try { parsed = bodySchema.parse(await req.json()); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const items = parsed.items.filter((it) => it.text.trim() && it.from !== it.to);
  if (items.length === 0) return NextResponse.json({ translations: [] });

  const payload = items.map((it, i) => ({ i, from: it.from, to: it.to, text: it.text }));

  try {
    const result = await generateText({
      model: openai(MODEL),
      output: Output.object({ schema: outSchema }),
      system: SYSTEM,
      prompt: `Translate each item from its "from" language to its "to" language. Return a translation for every item, keyed by the same "i".\n\n${JSON.stringify(payload)}`,
      maxOutputTokens: 8000,
    });
    const out = result.experimental_output as z.infer<typeof outSchema> | undefined;
    if (!out) return NextResponse.json({ error: "no_output" }, { status: 502 });

    const byI = new Map<number, string>();
    for (const t of out.translations) byI.set(t.i, t.text);
    // Preserve input order; fall back to the source text if the model skipped one.
    const translations = items.map((it, i) => byI.get(i) ?? it.text);
    return NextResponse.json({ translations });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "translate_failed" }, { status: 500 });
  }
}
