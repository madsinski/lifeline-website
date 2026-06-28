// POST /api/admin/research/analyze — AI narrative over a cohort's COMPUTED
// aggregate trends. Only aggregate statistics (means, deltas, effect sizes,
// missingness, demographics) are sent to the model — never per-patient rows.
//
// Mirrors the repo AI pattern (src/lib/ai-recommender.ts): generateText +
// Output.object + openai(model). Result cached in research_ai_analyses and
// the call recorded in research_access_log.
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireResearchWrite } from "@/lib/research/access";
import { computeMovements, type TrendStat } from "@/lib/research/trends";
import { featureDirection, changeIsGood, METHODS_VERSION } from "@/lib/research/clinical";

export const maxDuration = 120;

const MODEL = process.env.OPENAI_MODEL_RESEARCH || process.env.OPENAI_MODEL_MODE || "gpt-5.4";

const schema = z.object({
  headline: z.string().describe("One-sentence summary of the cohort's overall trajectory."),
  improved: z.array(z.object({ feature: z.string(), note: z.string() }))
    .describe("Features that meaningfully improved over time."),
  worsened: z.array(z.object({ feature: z.string(), note: z.string() }))
    .describe("Features that meaningfully worsened over time."),
  subgroup_notes: z.array(z.string()).describe("Notable signals by group, gender, or age where visible."),
  hypotheses: z.array(z.string()).describe("Plausible explanations worth investigating; clearly framed as hypotheses."),
  caveats: z.array(z.string()).describe("Statistical caveats: small n, conditional instruments, missing data, multiple comparisons."),
  recommendations: z.array(z.string()).describe("Concrete next steps for the research team."),
});

const SYSTEM = `You are a careful health-research data analyst for Lifeline Health, an Icelandic preventive-health company.
You are given ONLY aggregate, de-identified statistics for a longitudinal cohort (means, medians, SD, baseline->latest deltas, standardized effect sizes, missingness, demographics). You never see individual patient records.
Each movement carries a "better_when" field (higher/lower/n/a) and an "improved" boolean — USE THESE for direction; do not infer good/bad from the sign of the delta (a lower HbA1c, BP, or PHQ-9 is an improvement; a higher HDL or wellness score is an improvement). Interpret the trends conservatively and honestly. A standardized effect size (|d|) below ~0.2 is trivial, 0.2-0.5 small, 0.5-0.8 moderate, >0.8 large. Always weight conclusions by n and missingness — many instruments are conditional screeners (BEDS-7, AUDIT, CUDQ, CIUS) so high missingness is by-design, not data loss. Flag multiple-comparison risk when many features are scanned. Do not invent clinical claims beyond what the numbers support. Be specific and use the feature names given.`;

export async function POST(req: NextRequest) {
  const auth = await requireResearchWrite(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "ai_unavailable", detail: "OPENAI_API_KEY not set" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const cohortId = String(body?.cohortId || "");
  if (!cohortId) return NextResponse.json({ error: "bad_request", detail: "cohortId required" }, { status: 400 });

  const { data: cohort } = await supabaseAdmin
    .from("research_cohorts").select("name, pathway").eq("id", cohortId).single();
  const { data: trends } = await supabaseAdmin
    .from("research_trends")
    .select("feature, obs_type, display, unit, timepoint_label, timepoint_order, n, n_missing, mean, median, sd, min, max")
    .eq("cohort_id", cohortId);
  if (!trends || trends.length === 0) {
    return NextResponse.json({ error: "no_data", detail: "no trends computed for this cohort yet" }, { status: 400 });
  }
  const { data: patients } = await supabaseAdmin
    .from("research_patients").select("gender, latest_age, group_name").eq("cohort_id", cohortId);

  const movements = computeMovements(trends as unknown as TrendStat[]);
  const genders: Record<string, number> = {};
  const groups: Record<string, number> = {};
  for (const p of patients || []) {
    genders[p.gender || "unknown"] = (genders[p.gender || "unknown"] || 0) + 1;
    groups[p.group_name || "(none)"] = (groups[p.group_name || "(none)"] || 0) + 1;
  }

  const payload = {
    cohort: cohort?.name, pathway: cohort?.pathway,
    methods_version: METHODS_VERSION,
    n_patients: (patients || []).length,
    genders, groups,
    timepoints: [...new Set(trends.map((t) => t.timepoint_label))],
    // only timepoints with >=2 points produce a movement; cap the list for the prompt.
    // direction/improved are pre-computed so the model never misreads a drop
    // (e.g. lower HbA1c/BP/PHQ-9 is GOOD; higher HDL/sleep is GOOD).
    movements: movements.slice(0, 40).map((m) => {
      const dir = featureDirection(m.feature);
      const good = changeIsGood(m.feature, m.delta);
      return { ...m, better_when: dir === "up" ? "higher" : dir === "down" ? "lower" : "n/a", improved: good };
    }),
  };

  let parsed: z.infer<typeof schema>;
  try {
    const result = await generateText({
      model: openai(MODEL),
      output: Output.object({ schema }),
      system: SYSTEM,
      prompt: `Analyze the longitudinal trends for this cohort. Aggregate data follows as JSON:\n\n${JSON.stringify(payload, null, 2)}`,
      maxOutputTokens: 2200,
    });
    if (!result.experimental_output) throw new Error("Model returned no structured output");
    parsed = result.experimental_output;
  } catch (e) {
    return NextResponse.json({ error: "ai_error", detail: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  const md = renderMarkdown(parsed);
  const { data: saved } = await supabaseAdmin
    .from("research_ai_analyses")
    .insert({ cohort_id: cohortId, scope: "cohort", model: MODEL, summary_md: md, payload, created_by: auth.id })
    .select("id, created_at").single();

  await supabaseAdmin.from("research_access_log").insert({
    actor_id: auth.id, actor_email: auth.email ?? null, action: "ai_analyze", cohort_id: cohortId,
    detail: { model: MODEL, movements: payload.movements.length },
  });

  return NextResponse.json({ ok: true, analysis: parsed, summary_md: md, id: saved?.id, created_at: saved?.created_at });
}

function renderMarkdown(a: z.infer<typeof schema>): string {
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
  const pairs = (xs: { feature: string; note: string }[]) =>
    xs.map((x) => `- **${x.feature}** — ${x.note}`).join("\n");
  return [
    `**${a.headline}**`,
    a.improved.length ? `\n### Improved\n${pairs(a.improved)}` : "",
    a.worsened.length ? `\n### Worsened\n${pairs(a.worsened)}` : "",
    a.subgroup_notes.length ? `\n### Subgroup signals\n${list(a.subgroup_notes)}` : "",
    a.hypotheses.length ? `\n### Hypotheses\n${list(a.hypotheses)}` : "",
    a.caveats.length ? `\n### Caveats\n${list(a.caveats)}` : "",
    a.recommendations.length ? `\n### Recommended next steps\n${list(a.recommendations)}` : "",
  ].filter(Boolean).join("\n");
}
