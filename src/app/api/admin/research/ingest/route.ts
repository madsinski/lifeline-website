// POST /api/admin/research/ingest — ingest one Medalia JSON export as a cohort timepoint.
//
// Body: {
//   cohortId?: string,                 // existing cohort, OR
//   cohortName?: string, cohortSlug?: string, pathway?: string,  // create new
//   timepointLabel: string,            // 'baseline' | '3mo' | '6mo' | '9mo' | '12mo'
//   timepointOrder?: number,           // months (0,3,6,9,12); inferred from label if absent
//   exportType?: 'full' | 'no_bloods',
//   filename?: string,
//   json: MedaliaExport                // the parsed export object
// }
//
// Re-uploading the same (cohort, timepoint) replaces it (cascade-deletes prior
// observations/answers). Recomputes cohort trends and logs the access.
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireResearchWrite } from "@/lib/research/access";
import { parseMedaliaExport, type MedaliaExport } from "@/lib/research/parse";
import { recomputeCohortTrends } from "@/lib/research/recompute";

export const maxDuration = 300;

const TP_ORDER: Record<string, number> = { baseline: 0, "3mo": 3, "6mo": 6, "9mo": 9, "12mo": 12 };

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "cohort";
}

async function chunkInsert(table: string, rows: Record<string, unknown>[], size = 1000): Promise<string | null> {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabaseAdmin.from(table).insert(rows.slice(i, i + size));
    if (error) return error.message;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireResearchWrite(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }

  const body = await req.json().catch(() => ({}));
  const json = body?.json as MedaliaExport | undefined;
  const timepointLabel = String(body?.timepointLabel || "").trim();
  if (!json || typeof json !== "object" || !Array.isArray(json.patients)) {
    return NextResponse.json({ error: "bad_request", detail: "missing or invalid json export" }, { status: 400 });
  }
  if (!timepointLabel) {
    return NextResponse.json({ error: "bad_request", detail: "timepointLabel required" }, { status: 400 });
  }
  const timepointOrder = Number.isFinite(body?.timepointOrder)
    ? Number(body.timepointOrder)
    : (TP_ORDER[timepointLabel] ?? 0);
  const exportType = body?.exportType === "no_bloods" ? "no_bloods" : "full";
  const filename = body?.filename ? String(body.filename) : null;

  const parsed = parseMedaliaExport(json);

  // ---- resolve cohort ----
  let cohortId: string | null = body?.cohortId ? String(body.cohortId) : null;
  if (!cohortId) {
    const name = String(body?.cohortName || parsed.meta.client || "Cohort").trim();
    const slug = slugify(String(body?.cohortSlug || name));
    const { data: existing } = await supabaseAdmin
      .from("research_cohorts").select("id").eq("slug", slug).maybeSingle();
    if (existing?.id) {
      cohortId = existing.id;
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("research_cohorts")
        .insert({ name, slug, pathway: body?.pathway || parsed.meta.pathway || null, created_by: auth.id })
        .select("id").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      cohortId = created.id;
    }
  }

  // ---- replace any existing export at this timepoint (cascade clears obs/answers) ----
  await supabaseAdmin.from("research_exports")
    .delete().eq("cohort_id", cohortId).eq("timepoint_label", timepointLabel);

  // ---- store raw JSON in the research-exports bucket (best-effort) ----
  let storagePath: string | null = null;
  try {
    const { data: cohort } = await supabaseAdmin
      .from("research_cohorts").select("slug").eq("id", cohortId).single();
    const path = `${cohort?.slug || cohortId}/${timepointLabel}-${Date.now()}.json`;
    const up = await supabaseAdmin.storage.from("research-exports")
      .upload(path, JSON.stringify(json), { contentType: "application/json", upsert: true });
    if (!up.error) storagePath = path;
  } catch { /* storage is best-effort; ingestion proceeds regardless */ }

  // ---- insert export row ----
  const { data: exportRow, error: exErr } = await supabaseAdmin
    .from("research_exports")
    .insert({
      cohort_id: cohortId,
      timepoint_label: timepointLabel,
      timepoint_order: timepointOrder,
      export_type: exportType,
      exported_at: parsed.meta.exportedAt,
      source_filename: filename,
      patient_count: parsed.reconciliation.patients,
      observation_count: parsed.observations.length,
      answer_count: parsed.answers.length,
      raw_storage_path: storagePath,
      uploaded_by: auth.id,
    })
    .select("id").single();
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
  const exportId = exportRow.id;

  // ---- upsert patients (stable identity across timepoints) ----
  const patientRows = parsed.patients.map((p) => ({
    cohort_id: cohortId,
    medalia_patient_id: p.medalia_patient_id,
    gender: p.gender,
    latest_age: p.age,
    group_name: p.group_name,
  }));
  if (patientRows.length) {
    const { error } = await supabaseAdmin.from("research_patients")
      .upsert(patientRows, { onConflict: "cohort_id,medalia_patient_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ---- insert observations ----
  const obsRows = parsed.observations.map((o) => ({
    export_id: exportId, cohort_id: cohortId,
    medalia_patient_id: o.medalia_patient_id,
    timepoint_label: timepointLabel, timepoint_order: timepointOrder,
    obs_type: o.obs_type, code: o.code, feature: o.feature, display: o.display,
    observed_at: o.observed_at, value_num: o.value_num, value_text: o.value_text,
    value_bool: o.value_bool, unit: o.unit,
  }));
  const obsErr = await chunkInsert("research_observations", obsRows);
  if (obsErr) return NextResponse.json({ error: obsErr }, { status: 500 });

  // ---- insert answers ----
  const ansRows = parsed.answers.map((a) => ({
    export_id: exportId, cohort_id: cohortId,
    medalia_patient_id: a.medalia_patient_id,
    questionnaire_id: a.questionnaire_id, questionnaire_title: a.questionnaire_title,
    authored_at: a.authored_at, link_id: a.link_id,
    question_text: a.question_text, value_text: a.value_text,
  }));
  const ansErr = await chunkInsert("research_answers", ansRows);
  if (ansErr) return NextResponse.json({ error: ansErr }, { status: 500 });

  // ---- recompute cohort trends ----
  const trendCount = await recomputeCohortTrends(cohortId!);

  // ---- audit log ----
  await supabaseAdmin.from("research_access_log").insert({
    actor_id: auth.id, actor_email: auth.email ?? null, action: "ingest",
    cohort_id: cohortId, export_id: exportId,
    detail: { timepointLabel, exportType, filename, reconciliation: parsed.reconciliation },
  });

  return NextResponse.json({
    ok: true,
    cohortId,
    exportId,
    timepointLabel,
    reconciliation: {
      ...parsed.reconciliation,
      observations_inserted: obsRows.length,
      answers_inserted: ansRows.length,
      balanced: obsRows.length + ansRows.length === parsed.reconciliation.total,
    },
    trends_computed: trendCount,
  });
}
