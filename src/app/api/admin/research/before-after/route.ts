// GET /api/admin/research/before-after?cohortId=…[&exportId=…][&format=html]
//
// Per-patient first-vs-last comparison BY DATE within ONE uploaded data set
// (a Medalia export carries each patient's full history). Defaults to the
// most recent data set whose export date isn't in the future, so synthetic
// "TEST" uploads dated ahead never become the default.
//
// format=html → print-to-PDF Icelandic report (src/lib/research/before-after-report.ts);
// otherwise JSON for the "Before / after" tab. Read-gated like the rest of
// the research module; aggregate-only output.
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireResearchRead } from "@/lib/research/access";
import { METHODS_VERSION } from "@/lib/research/clinical";
import { computeBeforeAfter, type ObsRow, type PatientRow } from "@/lib/research/before-after";
import { buildBeforeAfterReport } from "@/lib/research/before-after-report";

export const maxDuration = 60;

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
  if (!cohortId) return NextResponse.json({ error: "bad_request", detail: "cohortId required" }, { status: 400 });

  const { data: cohort } = await supabaseAdmin
    .from("research_cohorts").select("name, excluded_patients, excluded_features").eq("id", cohortId).single();
  if (!cohort) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: exportsRaw } = await supabaseAdmin
    .from("research_exports").select("id, timepoint_label, exported_at, patient_count, source_filename")
    .eq("cohort_id", cohortId).order("exported_at", { ascending: false });
  const exports = exportsRaw || [];
  if (!exports.length) return NextResponse.json({ error: "no_data", detail: "Upload a data set first." }, { status: 400 });

  const now = Date.now();
  const wanted = req.nextUrl.searchParams.get("exportId");
  const chosen = (wanted && exports.find((e) => e.id === wanted))
    || exports.find((e) => !e.exported_at || Date.parse(e.exported_at) <= now)
    || exports[0];

  const exPatients = new Set<string>((cohort.excluded_patients as string[] | null) ?? []);
  const exFeatures = new Set<string>((cohort.excluded_features as string[] | null) ?? []);

  const obsRaw = await pageAll<ObsRow & { display: string | null }>((from, to) =>
    supabaseAdmin.from("research_observations")
      .select("medalia_patient_id, feature, observed_at, value_num, display")
      .eq("export_id", chosen.id).not("value_num", "is", null)
      .order("id", { ascending: true }).range(from, to));
  const obs = obsRaw.filter((o) => !exPatients.has(o.medalia_patient_id) && !exFeatures.has(o.feature));
  const displayOf: Record<string, string> = {};
  for (const o of obsRaw) if (o.display && !displayOf[o.feature]) displayOf[o.feature] = o.display;

  // Patients present in the chosen data set (not the whole cohort history).
  const inExport = new Set(obs.map((o) => o.medalia_patient_id));
  const patientsAll = await pageAll<PatientRow>((from, to) =>
    supabaseAdmin.from("research_patients").select("medalia_patient_id, gender, latest_age, group_name")
      .eq("cohort_id", cohortId).range(from, to));
  const patients = patientsAll.filter((p) => inExport.has(p.medalia_patient_id));

  const result = computeBeforeAfter(obs, patients, displayOf);

  await supabaseAdmin.from("research_access_log").insert({
    actor_id: user.id, actor_email: user.email ?? null,
    action: req.nextUrl.searchParams.get("format") === "html" ? "before_after_report" : "before_after_view",
    cohort_id: cohortId, export_id: chosen.id, detail: { nFollowed: result.nFollowed },
  });

  if (req.nextUrl.searchParams.get("format") === "html") {
    const html = buildBeforeAfterReport({
      cohortName: cohort.name,
      exportedAt: chosen.exported_at,
      logoUrl: `${req.nextUrl.origin}/lifeline-logo-rebrand.svg`,
      methodsVersion: METHODS_VERSION,
      result,
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    exports: exports.map((e) => ({ id: e.id, label: e.timepoint_label, exported_at: e.exported_at, patient_count: e.patient_count, filename: e.source_filename })),
    exportId: chosen.id,
    result,
  });
}
