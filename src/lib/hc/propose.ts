// Building a plan proposal for a journey.
//
// Lifted out of the analyze route so it can run two ways: on demand when the
// nurse asks, and on its own in the background the moment a report lands, so
// the proposal is already waiting by the time she has finished reading the
// results. Same code either way — there is no second, cheaper version that
// could drift from the real one.
//
// The traffic lights are computed here from Lifeline's reference bands. The
// model never decides whether a value is out of range; it only proposes which
// actions to put in front of this client, and what might need a referral.
//
// Server-only: needs OPENAI_API_KEY and the service role.

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getClientProfile } from "@/lib/hc/server";
import { ANALYZE_MODEL, proposePlan, trafficLights, type FlaggedValue, type Proposal, type ReportLine } from "@/lib/hc/analyze";
import { loadReport } from "@/lib/hc/report-store";
import { planFromReport } from "@/lib/hc/plan-from-report";
import { sexOf } from "@/lib/hc/sex";
import type { KnowledgeEntry } from "@/lib/hc/knowledge";
import type { InterviewNotes, PlanModule } from "@/lib/hc/types";

export function ageOf(dob: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const a = Math.floor((Date.now() - d.getTime()) / (365.25 * 86400_000));
  return a > 0 && a < 120 ? `${a} ára` : null;
}

/** The nurse's interview notes as a short brief for the model. */
export function notesText(n: InterviewNotes | null): string | null {
  if (!n) return null;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(n as unknown as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) parts.push(`${k}: ${v.trim()}`);
  }
  return parts.length ? parts.join("\n").slice(0, 4000) : null;
}

export type ProposeOutcome =
  | {
      ok: true;
      proposal: Proposal;
      flagged: FlaggedValue[];
      other: { title: string; value: number; unit: string | null }[];
      /** Report recommendations the map does not know — shown, never guessed at. */
      unmapped: import("./plan-from-report").ActionSource[];
    }
  | { ok: false; reason: "no_key" | "no_values" | "failed"; message: string };

/**
 * Propose a plan and store it in hc_ai_proposals.
 *
 * Never throws: the background caller has no one to report to, and the
 * on-demand caller wants a message rather than a stack trace.
 */
export async function buildProposal(journeyId: string, actorLabel: string): Promise<ProposeOutcome> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, reason: "no_key", message: "AI-tillaga er ekki uppsett." };
  }

  const { data: journey } = await supabaseAdmin
    .from("hc_journeys")
    .select("id, client_id, interview_notes")
    .eq("id", journeyId)
    .maybeSingle();
  if (!journey) return { ok: false, reason: "failed", message: "Heilsuferð fannst ekki." };

  const [{ data: results }, { data: entries }, { data: modules }, profile] = await Promise.all([
    supabaseAdmin.from("hc_results_decrypted").select("marker, value, unit, note").eq("journey_id", journeyId),
    supabaseAdmin.from("hc_knowledge").select("slug, category, title, aliases, unit, summary, body_md, bands, higher_better, sources, tags, sort").eq("active", true),
    supabaseAdmin.from("hc_plan_modules").select("*").eq("active", true).order("pillar").order("sort"),
    getClientProfile(journey.client_id),
  ]);

  let unmapped: import("./plan-from-report").ActionSource[] = [];
  const rows = (results || []).map((r) => ({ marker: r.marker, value: Number(r.value), unit: r.unit, note: r.note }));
  const stored = await loadReport(journeyId, journey.client_id);
  if (!rows.length && !stored) {
    return { ok: false, reason: "no_values", message: "Engin mæligildi skráð — skráðu eða lestu inn niðurstöður fyrst." };
  }

  // The report's scores and pillars matter as much as the blood panel.
  const reportLines: ReportLine[] = (stored?.report.items ?? [])
    .filter((i) => i.kind === "score" || i.kind === "risk")
    .map((i) => ({
      title: i.title,
      value: i.value,
      unit: i.unit,
      // The planning light (see actionSignalForItem): a good composite with
      // red components under it is a need, and the model has to see that.
      signal: stored?.actionSignals[i.key] ?? null,
      advice: i.advice,
      previous: i.trend.at(-1)?.value ?? null,
    }));

  const sex = sexOf(profile?.sex);
  const flagged = trafficLights(rows, (entries || []) as KnowledgeEntry[], sex);
  const known = new Set(flagged.map((f) => f.slug));
  const other = rows
    .filter((r) => !known.has(r.marker))
    .map((r) => ({ title: r.note || r.marker.replace(/^x:/, ""), value: r.value, unit: r.unit }));

  try {
    const input = {
      flagged,
      reportLines,
      otherValues: other,
      modules: (modules || []) as PlanModule[],
      age: ageOf(profile?.date_of_birth ?? null),
      sex,
      interviewNotes: notesText(journey.interview_notes as InterviewNotes | null),
    };
    const proposal = await proposePlan(input);

    /**
     * The report decides which actions, not the model.
     *
     * Medalia's Ráðleggingar column is a clinical plan a doctor already made
     * and recorded in the sjúkraskrá. Where a report exists, the actions are
     * read off it (plan-from-report.ts) and the model's own list is replaced.
     * The model keeps what it is good at and entitled to do: the headline,
     * the summary, and the sentence saying why an action matters to this
     * person. Phrasing, not selection.
     *
     * Referrals likewise come from the report's own "ræddu við lækni" lines.
     * Inferring one from a measurement would be a new clinical decision taken
     * outside the record system.
     */
    if (stored?.report) {
      const fromReport = planFromReport(stored.report, (modules || []) as PlanModule[]);
      const whyFor = new Map(proposal.actions.map((a) => [a.module_key, a.why]));
      proposal.actions = fromReport.actions.map((a) => ({
        module_key: a.module.key,
        title: a.module.title,
        pillar: a.module.pillar,
        frequency: a.module.frequency ?? "",
        detail: a.module.details ?? a.module.summary,
        // Forgangur 1 is what must happen; Forgangur 2 is the recommended
        // addition. The tiers already mean exactly that.
        tier: a.source.priority === "red" ? "core" : "standard",
        why: whyFor.get(a.module.key) ?? a.source.text,
        source: a.source,
      }));
      proposal.referrals = [];
      unmapped = fromReport.unmapped;
    }

    await supabaseAdmin.from("hc_ai_proposals").insert({
      journey_id: journeyId,
      client_id: journey.client_id,
      // The snapshot holds values and bands, never the uploaded document.
      input: { flagged, other, age: input.age, sex, hasNotes: !!input.interviewNotes },
      output: proposal,
      model: ANALYZE_MODEL,
      created_by: actorLabel,
    });
    return { ok: true, proposal, flagged, other, unmapped };
  } catch (e) {
    return { ok: false, reason: "failed", message: e instanceof Error ? e.message : "unknown" };
  }
}
