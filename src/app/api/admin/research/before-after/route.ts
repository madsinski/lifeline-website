// GET /api/admin/research/before-after?cohortId=…[&format=html|employer]
//
// Per-patient first-vs-last comparison BY MEASUREMENT DATE across all of the
// cohort's data sets (data sets dated in the future — TEST uploads — are
// ignored).
//
// format=html     → two-page Icelandic before/after report (before-after-report.ts)
// format=employer → one-page Icelandic employer summary (employer-onepager.ts)
// otherwise JSON for the "Before / after" tab. Read-gated like the rest of
// the research module; aggregate-only output.
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireResearchRead } from "@/lib/research/access";
import { METHODS_VERSION } from "@/lib/research/clinical";
import { computeBeforeAfter, baselineProfile, type ObsRow, type PatientRow } from "@/lib/research/before-after";
import { buildEmployerOnePager } from "@/lib/research/employer-onepager";
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

  // Use every real data set of the cohort. Data sets dated in the future
  // (synthetic TEST uploads) are ignored. Duplicate rows across data sets
  // collapse in buildPairs (same patient/feature/day → averaged).
  const now = Date.now();
  const used = exports.filter((e) => !e.exported_at || Date.parse(e.exported_at) <= now);
  const usedIds = used.map((e) => e.id);
  const exPatients = new Set<string>((cohort.excluded_patients as string[] | null) ?? []);
  const exFeatures = new Set<string>((cohort.excluded_features as string[] | null) ?? []);

  const obsRaw = await pageAll<ObsRow & { display: string | null }>((from, to) =>
    supabaseAdmin.from("research_observations")
      .select("medalia_patient_id, feature, observed_at, value_num, display")
      .in("export_id", usedIds).not("value_num", "is", null)
      .order("id", { ascending: true }).range(from, to));
  const obs = obsRaw.filter((o) => !exPatients.has(o.medalia_patient_id) && !exFeatures.has(o.feature));
  const displayOf: Record<string, string> = {};
  for (const o of obsRaw) if (o.display && !displayOf[o.feature]) displayOf[o.feature] = o.display;

  // Patients present in the data (after exclusions).
  const inExport = new Set(obs.map((o) => o.medalia_patient_id));
  const patientsAll = await pageAll<PatientRow>((from, to) =>
    supabaseAdmin.from("research_patients").select("medalia_patient_id, gender, latest_age, group_name")
      .eq("cohort_id", cohortId).range(from, to));
  const patients = patientsAll.filter((p) => inExport.has(p.medalia_patient_id));

  const result = computeBeforeAfter(obs, patients, displayOf);

  await supabaseAdmin.from("research_access_log").insert({
    actor_id: user.id, actor_email: user.email ?? null,
    action: `before_after_${req.nextUrl.searchParams.get("format") || "view"}`,
    cohort_id: cohortId, detail: { nFollowed: result.nFollowed, exports: usedIds },
  });

  const format = req.nextUrl.searchParams.get("format");
  if (format === "employer") {
    const html = buildEmployerOnePager({
      cohortName: cohort.name,
      logoUrl: `${req.nextUrl.origin}/lifeline-logo-rebrand.svg`,
      result,
      profile: baselineProfile(obs),
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }

  if (format === "html") {
    const html = buildBeforeAfterReport({
      cohortName: cohort.name,
      exportedAt: used[0]?.exported_at ?? null,
      logoUrl: `${req.nextUrl.origin}/lifeline-logo-rebrand.svg`,
      methodsVersion: METHODS_VERSION,
      result,
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    exports: exports.map((e) => ({ id: e.id, label: e.timepoint_label, exported_at: e.exported_at, patient_count: e.patient_count, filename: e.source_filename })),
    used: usedIds,
    result,
  });
}
