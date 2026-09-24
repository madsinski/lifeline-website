// GET /api/admin/research/before-after?cohortId=…[&format=html|employer]
//
// Per-patient first-vs-last comparison BY MEASUREMENT DATE across all of the
// cohort's data sets (data sets dated in the future — TEST uploads — are
// ignored).
//
// format=html     → two-page Icelandic before/after report (before-after-report.ts)
// format=employer → one-page Icelandic employer summary (employer-onepager.ts)
// format=insights → JSON for the Clinical overview insight cards
// format=full     → comprehensive Icelandic report incl. lifestyle (comprehensive-report.ts)
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
import { buildComprehensiveReport } from "@/lib/research/comprehensive-report";
import {
  pillarSummary, habitFacts, lifestyleRiskMatrix, surveyChange,
  type AnswerRow, type CohortInsights, type SurveyQ, type SurveyResp,
} from "@/lib/research/lifestyle";
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

  // ---- insights (Clinical overview cards) & comprehensive report ----
  if (format === "insights" || format === "full") {
    const answers = (await pageAll<AnswerRow>((from, to) =>
      supabaseAdmin.from("research_answers")
        .select("medalia_patient_id, questionnaire_title, question_text, value_text, authored_at")
        .in("export_id", usedIds).order("id", { ascending: true }).range(from, to)))
      .filter((a) => !exPatients.has(a.medalia_patient_id));

    // Follow-up feedback survey: ?surveyId=… or the newest approved survey
    // whose title names the cohort (e.g. "Eftirfylgni – Vestmannaeyjabær").
    // Aggregate only; suppressed below MIN_SURVEY_N responses.
    let survey: CohortInsights["survey"] = null;
    const surveyParam = req.nextUrl.searchParams.get("surveyId");
    const { data: sv } = surveyParam
      ? await supabaseAdmin.from("feedback_surveys").select("id, title_is").eq("id", surveyParam).maybeSingle()
      : await supabaseAdmin.from("feedback_surveys").select("id, title_is").eq("status", "approved")
          .ilike("title_is", `%${cohort.name}%`).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (sv) {
      const [{ data: qs }, { data: asg }] = await Promise.all([
        supabaseAdmin.from("feedback_questions").select("id, section_index, order_index, question_type, label_is, options_jsonb")
          .eq("survey_id", sv.id).order("order_index"),
        supabaseAdmin.from("feedback_assignments").select("id, completed_at").eq("survey_id", sv.id),
      ]);
      const done = (asg || []).filter((a) => a.completed_at).map((a) => a.id);
      const resp = done.length
        ? await pageAll<SurveyResp>((from, to) => supabaseAdmin.from("feedback_responses")
            .select("assignment_id, question_id, value, values_array, skipped").in("assignment_id", done).range(from, to))
        : [];
      survey = surveyChange(sv.title_is, (asg || []).length, (qs || []) as SurveyQ[], resp);
    }

    const insights: CohortInsights = {
      cohortName: cohort.name,
      exportedAt: used[0]?.exported_at ?? null,
      result,
      profile: baselineProfile(obs),
      pillars: pillarSummary(obs),
      habits: habitFacts(obs, answers),
      matrix: lifestyleRiskMatrix(obs, patients),
      survey,
    };
    if (format === "insights") return NextResponse.json(insights);
    const html = buildComprehensiveReport(insights, `${req.nextUrl.origin}/lifeline-logo-rebrand.svg`, METHODS_VERSION);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }

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
