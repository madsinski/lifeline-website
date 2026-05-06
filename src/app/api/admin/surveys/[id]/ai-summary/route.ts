// AI-powered survey summarisation.
//
// GET  /api/admin/surveys/[id]/ai-summary
//      → return the cached summary if any
//
// POST /api/admin/surveys/[id]/ai-summary
//      → regenerate from the current completed responses, cache,
//        and return.
//
// Admin + medical_advisor only.
//
// Uses the Vercel AI SDK v6 with the @ai-sdk/anthropic provider
// directly (no gateway). Requires ANTHROPIC_API_KEY in env — set it
// in Vercel → Project → Settings → Environment Variables. We
// deliberately bypass the AI Gateway to reuse the Anthropic billing
// account already in place; gateway would require a separate
// payment method.

import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

const insightSchema = z.object({
  summary_md: z.string(),
  themes: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })),
  praise: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })),
  concerns: z.array(z.object({
    title: z.string(),
    description: z.string(),
    severity: z.enum(["low", "medium", "high"]),
  })),
  action_items: z.array(z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(["low", "medium", "high"]),
  })),
});

interface QuestionRow {
  id: string;
  order_index: number;
  section_index: number;
  section_title_is: string | null;
  question_type: string;
  label_is: string;
  options_jsonb: { value: string; label_is: string }[] | null;
  required: boolean;
}

interface ResponseRow {
  question_id: string;
  value: string | null;
  values_array: string[] | null;
  text_value: string | null;
  skipped: boolean;
}

interface AnswerSummaryItem {
  type: string;
  label: string;
  chapter: string | null;
  total_answered: number;
  total_skipped: number;
  distribution?: Record<string, number>;
  mean?: number | null;
  texts?: string[];
}

async function loadStaff(token: string): Promise<{ id: string; role: string; name: string | null; email: string } | null> {
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!userData.user?.email) return null;
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, role, name, active")
    .eq("email", userData.user.email)
    .maybeSingle();
  if (!staffRow || !staffRow.active) return null;
  if (staffRow.role !== "admin" && staffRow.role !== "medical_advisor") return null;
  return { id: staffRow.id, role: staffRow.role, name: staffRow.name, email: userData.user.email };
}

function authToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await ctx.params;
  const token = authToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  const staff = await loadStaff(token);
  if (!staff) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { data: row } = await supabaseAdmin
    .from("feedback_ai_summaries")
    .select("*")
    .eq("survey_id", surveyId)
    .maybeSingle();
  return NextResponse.json({ ok: true, summary: row || null });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await ctx.params;
  const token = authToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  const staff = await loadStaff(token);
  if (!staff) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      ok: false,
      error: "ANTHROPIC_API_KEY not set in the environment. Add it in Vercel → Project → Settings → Environment Variables.",
    }, { status: 500 });
  }

  const { data: surveyRow } = await supabaseAdmin
    .from("feedback_surveys")
    .select("id, key, version, title_is, intro_is")
    .eq("id", surveyId)
    .maybeSingle();
  if (!surveyRow) {
    return NextResponse.json({ ok: false, error: "Survey not found" }, { status: 404 });
  }

  const { data: qRows } = await supabaseAdmin
    .from("feedback_questions")
    .select("id, order_index, section_index, section_title_is, question_type, label_is, options_jsonb, required")
    .eq("survey_id", surveyId)
    .order("section_index", { ascending: true })
    .order("order_index", { ascending: true });
  const questions = (qRows || []) as QuestionRow[];

  const { data: aRows } = await supabaseAdmin
    .from("feedback_assignments")
    .select("id, completed_at")
    .eq("survey_id", surveyId)
    .not("completed_at", "is", null);
  const completedIds = ((aRows || []) as { id: string }[]).map((a) => a.id);
  if (completedIds.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "No completed responses yet — nothing to summarise.",
    }, { status: 400 });
  }

  // Read from the decrypted view — text_value is encrypted at rest
  // (migration-encrypt-feedback-responses.sql) and the view exposes
  // plaintext via decrypt_text(). Service role bypasses RLS.
  const { data: rRows } = await supabaseAdmin
    .from("feedback_responses_decrypted")
    .select("question_id, value, values_array, text_value, skipped")
    .in("assignment_id", completedIds);
  const responses = (rRows || []) as ResponseRow[];

  const responsesByQ = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    const arr = responsesByQ.get(r.question_id) || [];
    arr.push(r);
    responsesByQ.set(r.question_id, arr);
  }

  const aggregated: AnswerSummaryItem[] = questions.map((q) => {
    const list = responsesByQ.get(q.id) || [];
    const answered = list.filter((r) => !r.skipped);
    const skipped = list.filter((r) => r.skipped).length;
    const item: AnswerSummaryItem = {
      type: q.question_type,
      label: q.label_is,
      chapter: q.section_title_is,
      total_answered: answered.length,
      total_skipped: skipped,
    };
    const optionLabel = (val: string) => {
      const opt = (q.options_jsonb || []).find((o) => o.value === val);
      return opt?.label_is || val;
    };

    if (q.question_type === "likert5" || q.question_type === "singleselect") {
      const dist: Record<string, number> = {};
      for (const r of answered) {
        if (!r.value) continue;
        const lbl = optionLabel(r.value);
        dist[lbl] = (dist[lbl] || 0) + 1;
      }
      item.distribution = dist;
      const numeric = answered
        .map((r) => parseInt(r.value || "", 10))
        .filter((n) => Number.isFinite(n));
      if (numeric.length > 0 && numeric.length === answered.length) {
        const sum = numeric.reduce((a, b) => a + b, 0);
        item.mean = Math.round((sum / numeric.length) * 100) / 100;
      }
    } else if (q.question_type === "multiselect") {
      const dist: Record<string, number> = {};
      for (const r of answered) {
        for (const v of r.values_array || []) {
          dist[optionLabel(v)] = (dist[optionLabel(v)] || 0) + 1;
        }
      }
      item.distribution = dist;
    } else if (q.question_type === "nps10") {
      let promoters = 0, passives = 0, detractors = 0;
      for (const r of answered) {
        const n = parseInt(r.value || "", 10);
        if (!Number.isFinite(n)) continue;
        if (n >= 9) promoters++;
        else if (n >= 7) passives++;
        else detractors++;
      }
      item.distribution = { Promoters: promoters, Passives: passives, Detractors: detractors };
      const total = promoters + passives + detractors;
      item.mean = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null;
    } else if (q.question_type === "open") {
      item.texts = answered.map((r) => r.text_value || "").filter(Boolean);
    } else if (q.question_type === "consent_optional") {
      const yes = answered.filter((r) => r.value === "yes").length;
      const no = answered.filter((r) => r.value === "no").length;
      item.distribution = { agreed: yes, declined: no };
      item.texts = answered
        .filter((r) => r.value === "yes" && r.text_value)
        .map((r) => r.text_value || "");
    }

    return item;
  });

  const dataBlock = aggregated.map((q, i) => {
    const lines: string[] = [];
    lines.push(`## Q${i + 1} [${q.type}]${q.chapter ? ` — ${q.chapter}` : ""}`);
    lines.push(`**${q.label}**`);
    lines.push(`Answered: ${q.total_answered}${q.total_skipped > 0 ? `, skipped: ${q.total_skipped}` : ""}`);
    if (q.mean !== undefined && q.mean !== null) {
      const suffix = q.type === "nps10" ? " (NPS)" : " (mean, 1-5 scale)";
      lines.push(`Score: ${q.mean}${suffix}`);
    }
    if (q.distribution && Object.keys(q.distribution).length > 0) {
      lines.push(`Distribution: ${Object.entries(q.distribution).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }
    if (q.texts && q.texts.length > 0) {
      lines.push(`Free-text answers (${q.texts.length}):`);
      for (const t of q.texts) {
        const trimmed = t.replace(/\s+/g, " ").slice(0, 600);
        lines.push(`- "${trimmed}"`);
      }
    }
    return lines.join("\n");
  }).join("\n\n");

  const systemPrompt = `You are an expert customer-experience analyst at Lifeline Health, a medical-grade health-assessment company in Iceland. You analyse client feedback surveys and produce concise, actionable insights for the founders and clinical team.

Tone: clinical, direct, business-savvy. Reply in Icelandic where the survey was answered in Icelandic. Avoid filler.

Rules:
- Base every claim on the data; cite the chapter title or numeric trend when useful.
- Do NOT invent quotes. If you reference a quote, it must come from the data.
- Severity / priority must reflect the data (high = many people affected OR safety / clinical concern).
- summary_md should be ~80-150 words and tell the team what the data actually says, in Icelandic markdown.
- Provide 3-6 themes, 0-5 praise items, 0-6 concerns, 3-8 action_items.`;

  const userPrompt = `Survey: "${surveyRow.title_is}" (${surveyRow.key} v${surveyRow.version})
Total completed responses: ${completedIds.length}

Aggregated answers below. Open-text answers are direct quotes from clients.

---
${dataBlock}
---`;

  let parsed: z.infer<typeof insightSchema>;
  try {
    const result = await generateText({
      model: anthropic(MODEL),
      output: Output.object({ schema: insightSchema }),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 2500,
    });
    if (!result.experimental_output) {
      throw new Error("Model returned no structured output");
    }
    parsed = result.experimental_output;
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: `AI generation failed: ${(e as Error).message}`,
    }, { status: 502 });
  }

  const { data: saved, error: saveErr } = await supabaseAdmin
    .from("feedback_ai_summaries")
    .upsert({
      survey_id: surveyId,
      summary_md: parsed.summary_md,
      themes_jsonb: parsed.themes,
      praise_jsonb: parsed.praise,
      concerns_jsonb: parsed.concerns,
      action_items_jsonb: parsed.action_items,
      responses_count: completedIds.length,
      model: MODEL,
      generated_by: staff.id,
      generated_by_name: staff.name || staff.email,
      generated_at: new Date().toISOString(),
    }, { onConflict: "survey_id" })
    .select("*")
    .single();
  if (saveErr) {
    return NextResponse.json({ ok: false, error: `Save failed: ${saveErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summary: saved });
}
