// AI feedback summariser.
//
// POST /api/admin/ai-feedback/summary
//   → reads all open + reviewed ai_recommendation_feedback rows from
//     the last 30 days, joins them to ai_recommendation_log, sends
//     the digest to OpenAI, returns structured insights.
//
// No caching — admin tool used at most weekly. Keeping it
// regenerate-on-demand avoids a third schema table for one consumer.
//
// Admin only. Same OpenAI integration pattern as
// /api/admin/surveys/[id]/ai-summary (gpt-5.4 + Vercel AI SDK + Output.object).

import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gpt-5.4";

const insightSchema = z.object({
  summary_md: z.string(),
  themes: z.array(z.object({
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

interface FeedbackRow {
  id: string;
  recommendation_id: string | null;
  client_id: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
}

interface RecRow {
  id: string;
  type: string;
  output: Record<string, unknown> | null;
  reason_text: string | null;
  input_snapshot: Record<string, unknown> | null;
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
  if (staffRow.role !== "admin") return null;
  return { id: staffRow.id, role: staffRow.role, name: staffRow.name, email: userData.user.email };
}

function authToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length);
}

export async function POST(req: Request) {
  const token = authToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  const staff = await loadStaff(token);
  if (!staff) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      ok: false,
      error: "OPENAI_API_KEY not set in the environment.",
    }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: fbRows } = await supabaseAdmin
    .from("ai_recommendation_feedback")
    .select("id, recommendation_id, client_id, reason, notes, status, created_at")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(500);
  const feedback = (fbRows || []) as FeedbackRow[];

  if (feedback.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "No feedback in the last 30 days — nothing to summarise.",
    }, { status: 400 });
  }

  const recIds = Array.from(new Set(feedback.map((r) => r.recommendation_id).filter((x): x is string => !!x)));
  const recsById = new Map<string, RecRow>();
  if (recIds.length > 0) {
    const { data: recRows } = await supabaseAdmin
      .from("ai_recommendation_log")
      .select("id, type, output, reason_text, input_snapshot")
      .in("id", recIds);
    for (const r of (recRows || []) as RecRow[]) recsById.set(r.id, r);
  }

  // Group by reason + recommendation output signature so the prompt
  // sees patterns, not raw rows. Each pattern carries count +
  // unique-client count so the model can rank by impact.
  type Pattern = {
    reason: string;
    rec_type: string | null;
    output: Record<string, unknown> | null;
    rationale: string | null;
    count: number;
    unique_clients: number;
    notes: string[];
    clientSet: Set<string>;
  };
  const patterns = new Map<string, Pattern>();
  for (const f of feedback) {
    const rec = f.recommendation_id ? recsById.get(f.recommendation_id) : null;
    const outputSig = rec?.output ? JSON.stringify(rec.output) : "";
    const key = `${f.reason}::${rec?.type || "unknown"}::${outputSig.slice(0, 200)}`;
    const existing = patterns.get(key);
    if (!existing) {
      patterns.set(key, {
        reason: f.reason,
        rec_type: rec?.type || null,
        output: rec?.output || null,
        rationale: rec?.reason_text || null,
        count: 1,
        unique_clients: 1,
        notes: f.notes ? [f.notes] : [],
        clientSet: new Set([f.client_id]),
      });
    } else {
      existing.count += 1;
      existing.clientSet.add(f.client_id);
      existing.unique_clients = existing.clientSet.size;
      if (f.notes) existing.notes.push(f.notes);
    }
  }
  const sortedPatterns = Array.from(patterns.values()).sort((a, b) => b.count - a.count);

  const dataBlock = sortedPatterns.map((p, i) => {
    const lines: string[] = [];
    lines.push(`## Pattern ${i + 1} [${p.reason}] · ${p.count} report(s) from ${p.unique_clients} client(s)${p.count >= 3 ? " ⚠️ ESCALATED" : ""}`);
    if (p.rec_type) lines.push(`Recommendation type: ${p.rec_type}`);
    if (p.output) lines.push(`Recommended: ${JSON.stringify(p.output).slice(0, 400)}`);
    if (p.rationale) lines.push(`Model rationale: ${p.rationale}`);
    if (p.notes.length > 0) {
      lines.push(`User notes (${p.notes.length}):`);
      for (const n of p.notes.slice(0, 8)) {
        lines.push(`- "${n.replace(/\s+/g, " ").slice(0, 400)}"`);
      }
    }
    return lines.join("\n");
  }).join("\n\n");

  const systemPrompt = `You are reviewing user-reported feedback on AI-generated health recommendations at Lifeline Health, an Icelandic medical-grade digital health company. Users report when a recommendation feels wrong (allergen, unsafe, too intense, too easy, not for me today, other). Your job is to find patterns and recommend prompt/filter tweaks the founder (also a doctor) can apply.

Tone: clinical, direct, no filler. Reply in English (this is for internal engineering use).

Rules:
- Base every claim on the data. Cite pattern numbers when useful.
- Severity: high = safety concern (unsafe / allergen) or ≥3 reports of the same recommendation; medium = repeated dissatisfaction; low = isolated reports.
- Action items should be concrete prompt or filter changes (e.g., "Add allergen check before recommending nut-based snacks", "Tighten min_recovery_state on cardio for tired mode").
- summary_md: 60-100 words, plain markdown, focused on the top 2-3 issues.
- Provide 2-5 themes, 1-5 concerns, 2-6 action_items.`;

  const userPrompt = `Total feedback rows in last 30 days: ${feedback.length}
Distinct patterns (grouped by reason + recommendation signature): ${sortedPatterns.length}

---
${dataBlock}
---`;

  let parsed: z.infer<typeof insightSchema>;
  try {
    const result = await generateText({
      model: openai(MODEL),
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

  return NextResponse.json({
    ok: true,
    summary: {
      summary_md: parsed.summary_md,
      themes: parsed.themes,
      concerns: parsed.concerns,
      action_items: parsed.action_items,
      responses_count: feedback.length,
      model: MODEL,
      generated_at: new Date().toISOString(),
    },
  });
}
