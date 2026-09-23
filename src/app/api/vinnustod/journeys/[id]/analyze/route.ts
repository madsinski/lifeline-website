// Propose an action plan from the client's results.
//
// The traffic lights are computed here from Lifeline's reference bands — the
// model never decides whether a value is out of range. It only proposes which
// actions to put in front of this client, ranked and tiered, drawn from our
// own action library. The nurse edits the result before publishing.
//
// POST → { flagged, other, proposal }
// Actor: workstation session or Lifeline staff, limited to their locations.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { getClientProfile, hcAudit } from "@/lib/hc/server";
import { ANALYZE_MODEL, proposePlan, trafficLights, type ReportLine } from "@/lib/hc/analyze";
import { loadReport } from "@/lib/hc/report-store";
import { sexOf } from "@/lib/hc/sex";
import type { KnowledgeEntry } from "@/lib/hc/knowledge";
import type { InterviewNotes, PlanModule } from "@/lib/hc/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function ageOf(dob: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const a = Math.floor((Date.now() - d.getTime()) / (365.25 * 86400_000));
  return a > 0 && a < 120 ? `${a} ára` : null;
}

/** The nurse's interview notes as a short brief for the model. */
function notesText(n: InterviewNotes | null): string | null {
  if (!n) return null;
  const parts: string[] = [];
  const rec = n as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === "string" && v.trim()) parts.push(`${k}: ${v.trim()}`);
  }
  return parts.length ? parts.join("\n").slice(0, 4000) : null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const { data: journey } = await supabaseAdmin
    .from("hc_journeys")
    .select("id, client_id, location_id, interview_notes")
    .eq("id", id)
    .maybeSingle();
  const locs = actorLocationFilter(actor);
  if (!journey || (locs && (!journey.location_id || !locs.includes(journey.location_id)))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI-tillaga er ekki uppsett." }, { status: 503 });

  const [{ data: results }, { data: entries }, { data: modules }, profile] = await Promise.all([
    supabaseAdmin.from("hc_results").select("marker, value, unit, note").eq("journey_id", id),
    supabaseAdmin.from("hc_knowledge").select("slug, category, title, aliases, unit, summary, body_md, bands, higher_better, sources, tags, sort").eq("active", true),
    supabaseAdmin.from("hc_plan_modules").select("*").eq("active", true).order("pillar").order("sort"),
    getClientProfile(journey.client_id),
  ]);

  const rows = (results || []).map((r) => ({ marker: r.marker, value: Number(r.value), unit: r.unit, note: r.note }));
  const stored = await loadReport(id, journey.client_id);
  if (!rows.length && !stored) return NextResponse.json({ error: "Engin mæligildi skráð — skráðu eða lestu inn niðurstöður fyrst." }, { status: 409 });

  // The report's scores and pillars matter as much as the blood panel.
  const reportLines: ReportLine[] = (stored?.report.items ?? [])
    .filter((i) => i.kind === "score" || i.kind === "risk")
    .map((i) => ({
      title: i.title,
      value: i.value,
      unit: i.unit,
      signal: stored?.signals[i.key] ?? null,
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

    await supabaseAdmin.from("hc_ai_proposals").insert({
      journey_id: id,
      client_id: journey.client_id,
      // The snapshot holds values and bands, never the uploaded document.
      input: { flagged, other, age: input.age, sex, hasNotes: !!input.interviewNotes },
      output: proposal,
      model: ANALYZE_MODEL,
      created_by: actor.label,
    });
    await hcAudit(actor.label, "plan_proposed", id, { actions: proposal.actions.length });

    return NextResponse.json({ flagged, other, proposal });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: `Tillagan mistókst: ${message}` }, { status: 502 });
  }
}
