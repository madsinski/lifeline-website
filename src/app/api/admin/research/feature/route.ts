// GET /api/admin/research/feature?cohortId=…&feature=…
// Per-patient values behind one variable (so the medical advisor can audit what
// makes up a score): patient UUID, gender, and the value at each timepoint.
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireResearchRead } from "@/lib/research/access";
import { gatingForFeature } from "@/lib/research/clinical";

async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = []; const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    out.push(...data); if (data.length < PAGE) break;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const user = await requireResearchRead(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cohortId = req.nextUrl.searchParams.get("cohortId");
  const feature = req.nextUrl.searchParams.get("feature");
  if (!cohortId || !feature) {
    return NextResponse.json({ error: "bad_request", detail: "cohortId and feature required" }, { status: 400 });
  }

  // ordered timepoint labels
  const { data: exports } = await supabaseAdmin
    .from("research_exports").select("timepoint_label, timepoint_order")
    .eq("cohort_id", cohortId).order("timepoint_order", { ascending: true });
  const timepoints = [...new Map((exports || []).map((e) => [e.timepoint_order, e.timepoint_label])).values()];

  // gender per patient
  const { data: patients } = await supabaseAdmin
    .from("research_patients").select("medalia_patient_id, gender").eq("cohort_id", cohortId);
  const genderById: Record<string, string | null> = {};
  for (const p of patients || []) genderById[p.medalia_patient_id] = p.gender;

  // observations for this feature
  const obs = await pageAll<{ medalia_patient_id: string; timepoint_label: string; value_num: number | null; value_text: string | null; value_bool: boolean | null; unit: string | null }>(
    (from, to) => supabaseAdmin.from("research_observations")
      .select("medalia_patient_id, timepoint_label, value_num, value_text, value_bool, unit")
      .eq("cohort_id", cohortId).eq("feature", feature).range(from, to),
  );

  let unit: string | null = null;
  const byPatient = new Map<string, Record<string, number | string | boolean | null>>();
  for (const o of obs) {
    if (unit === null && o.unit) unit = o.unit;
    if (!byPatient.has(o.medalia_patient_id)) byPatient.set(o.medalia_patient_id, {});
    byPatient.get(o.medalia_patient_id)![o.timepoint_label] = o.value_num ?? o.value_text ?? o.value_bool ?? null;
  }
  // Gate verification: if this is a gated unified score, attach each patient's
  // pre-gate answer so a full-points score can be confirmed as a real answer
  // (e.g. "Aldrei") rather than a skipped section.
  const rule = gatingForFeature(feature);
  const gateByPatient = new Map<string, string | null>();
  if (rule) {
    const ans = await pageAll<{ medalia_patient_id: string; value_text: string | null; authored_at: string | null }>(
      (from, to) => supabaseAdmin.from("research_answers")
        .select("medalia_patient_id, value_text, authored_at")
        .eq("cohort_id", cohortId).ilike("question_text", `%${rule.gateTextMatch}%`).range(from, to),
    );
    const latest = new Map<string, { v: string | null; t: string }>();
    for (const a of ans) {
      const cur = latest.get(a.medalia_patient_id);
      if (!cur || (a.authored_at ?? "") >= cur.t) latest.set(a.medalia_patient_id, { v: a.value_text, t: a.authored_at ?? "" });
    }
    for (const [pid, v] of latest) gateByPatient.set(pid, v.v);
  }

  const rows = [...byPatient.entries()]
    .map(([patient, values]) => ({
      patient, gender: genderById[patient] ?? null, values,
      gateAnswer: rule ? (gateByPatient.get(patient) ?? null) : undefined,
    }))
    .sort((a, b) => a.patient.localeCompare(b.patient));

  return NextResponse.json({
    feature, unit, timepoints, rows,
    gating: rule ? { label: rule.label, negativeAnswers: rule.negativeAnswers } : null,
  });
}
