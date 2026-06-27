// GET /api/admin/research/employer-report?cohortId=…  → layman, aggregate-only
// HTML summary for the cohort's employer. Needs 2+ timepoints. Gated on isStaff
// (staff generate it, then share with the employer).
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { featureDirection, changeIsGood, canonicalUnit, FLAGS, flagCrosses } from "@/lib/research/clinical";
import { buildEmployerReport, type MetricChange, type RiskChange } from "@/lib/research/employer-report";

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

const pctChange = (b: number | null, l: number | null) =>
  b === null || l === null || b === 0 ? null : Math.round(((l - b) / Math.abs(b)) * 1000) / 10;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("cohortId");
  if (!id) return NextResponse.json({ error: "bad_request", detail: "cohortId required" }, { status: 400 });

  const { data: cohort } = await supabaseAdmin
    .from("research_cohorts").select("name, slug, pathway").eq("id", id).single();
  if (!cohort) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: exports } = await supabaseAdmin
    .from("research_exports").select("timepoint_label, timepoint_order, exported_at, patient_count")
    .eq("cohort_id", id).order("timepoint_order", { ascending: true });
  const orders = [...new Set((exports || []).map((e) => e.timepoint_order))].sort((a, b) => a - b);
  if (orders.length < 2) {
    return NextResponse.json({ error: "needs_two_timepoints", detail: "An employer summary needs a baseline and at least one follow-up timepoint." }, { status: 400 });
  }
  const minOrder = orders[0], latestOrder = orders[orders.length - 1];
  const expByOrder = new Map((exports || []).map((e) => [e.timepoint_order, e]));
  const baseExp = expByOrder.get(minOrder)!, lastExp = expByOrder.get(latestOrder)!;

  // ---- trend means (baseline & latest) ----
  const { data: trends } = await supabaseAdmin
    .from("research_trends").select("feature, timepoint_order, mean").eq("cohort_id", id);
  const meanOf = new Map<string, Map<number, number | null>>();
  for (const t of trends || []) {
    if (!meanOf.has(t.feature)) meanOf.set(t.feature, new Map());
    meanOf.get(t.feature)!.set(t.timepoint_order, t.mean);
  }
  const base = (f: string) => meanOf.get(f)?.get(minOrder) ?? null;
  const last = (f: string) => meanOf.get(f)?.get(latestOrder) ?? null;
  const avg = (fs: string[], at: (f: string) => number | null) => {
    const vs = fs.map(at).filter((v): v is number => v !== null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  };

  // ---- foundations (averaged sub-scores, 0-10, higher better) ----
  const FOUND: { label: string; feats: string[] }[] = [
    { label: "Sleep quality", feats: ["lifeline_health_sleep_medical_score", "lifeline_health_sleep_behaviour_score"] },
    { label: "Physical activity", feats: ["lifeline_health_exercise_medical_score", "lifeline_health_exercise_behavioural_score"] },
    { label: "Nutrition", feats: ["lifeline_health_nutrition_medical_score", "lifeline_health_nutrition_behavioural_score"] },
    { label: "Mental wellbeing", feats: ["pwi", "lifeline_health_depression_score_1_10", "lifeline_health_anxiety_score_1_10"] },
  ];
  const foundations: MetricChange[] = FOUND.map(({ label, feats }) => {
    const b = avg(feats, base), l = avg(feats, last);
    const pc = pctChange(b, l);
    return { label, baseline: b, latest: l, unit: "/10", scaleMax: 10, pctChange: pc, improved: b === null || l === null ? null : l === b ? null : l > b };
  }).filter((m) => m.baseline !== null && m.latest !== null);

  // ---- downstream outcomes (layman labels) ----
  const OUT: { label: string; feat: string }[] = [
    { label: "Body weight", feat: "weight" },
    { label: "Body fat", feat: "fat_mass_percent" },
    { label: "Blood sugar (HbA1c)", feat: "hba1c" },
    { label: "Insulin resistance (HOMA-IR)", feat: "homa_ir" },
    { label: "Blood pressure (systolic)", feat: "bp_systolic_avg" },
    { label: "Cholesterol (total)", feat: "total_cholesterol" },
  ];
  const outcomes: MetricChange[] = OUT.map(({ label, feat }) => {
    const b = base(feat), l = last(feat), pc = pctChange(b, l);
    return { label, baseline: b, latest: l, unit: canonicalUnit(feat) || undefined, pctChange: pc, improved: changeIsGood(feat, b !== null && l !== null ? l - b : null) };
  }).filter((m) => m.baseline !== null && m.latest !== null);
  void featureDirection;

  // ---- risk reduction (flag prevalence baseline vs latest) ----
  const { data: patients } = await supabaseAdmin
    .from("research_patients").select("medalia_patient_id, gender").eq("cohort_id", id);
  const genderById: Record<string, string | null> = {};
  for (const p of patients || []) genderById[p.medalia_patient_id] = p.gender;
  const flagFeatures = [...new Set(FLAGS.map((f) => f.feature))];
  const flagObs = await pageAll<{ medalia_patient_id: string; feature: string; value_num: number | null; value_bool: boolean | null; timepoint_order: number }>(
    (from, to) => supabaseAdmin.from("research_observations")
      .select("medalia_patient_id, feature, value_num, value_bool, timepoint_order")
      .eq("cohort_id", id).in("feature", flagFeatures).in("timepoint_order", [minOrder, latestOrder]).range(from, to),
  );
  const valsTp = new Map<number, Map<string, Record<string, number | boolean | null>>>();
  for (const o of flagObs) {
    if (!valsTp.has(o.timepoint_order)) valsTp.set(o.timepoint_order, new Map());
    const pm = valsTp.get(o.timepoint_order)!;
    if (!pm.has(o.medalia_patient_id)) pm.set(o.medalia_patient_id, {});
    pm.get(o.medalia_patient_id)![o.feature] = o.value_num ?? o.value_bool ?? null;
  }
  const prevalence = (key: string, order: number): number | null => {
    const def = FLAGS.find((f) => f.key === key); if (!def) return null;
    const pm = valsTp.get(order); if (!pm) return null;
    let e = 0, h = 0;
    for (const [pid, fv] of pm) if (def.feature in fv && fv[def.feature] !== null) { e++; if (flagCrosses(def, fv[def.feature], genderById[pid] ?? null)) h++; }
    return e ? Math.round((100 * h) / e) : null;
  };
  const RISK: { key: string; label: string }[] = [
    { key: "bp_sys_high", label: "Raised blood pressure" },
    { key: "homa_ir", label: "Insulin resistance" },
    { key: "bodyfat_high", label: "High body fat" },
    { key: "chol_high", label: "High cholesterol" },
    { key: "phq9_mod", label: "Low mood (depression screen)" },
    { key: "gad7_mod", label: "Anxiety (screen)" },
    { key: "nicotine", label: "Nicotine use" },
  ];
  const risks: RiskChange[] = RISK.map(({ key, label }) => {
    const b = prevalence(key, minOrder), l = prevalence(key, latestOrder);
    return { label, baselinePct: b, latestPct: l, deltaPp: b === null || l === null ? null : l - b, improved: b === null || l === null ? null : l < b ? true : l > b ? false : null };
  }).filter((r) => r.baselinePct !== null && r.latestPct !== null);

  const all = [...foundations, ...outcomes];
  const measuresImproved = all.filter((m) => m.improved === true).length;
  const measuresTotal = all.filter((m) => m.improved !== null).length;

  const html = buildEmployerReport({
    cohortName: cohort.name,
    employerName: cohort.pathway,
    baselineLabel: baseExp.timepoint_label,
    latestLabel: lastExp.timepoint_label,
    baselineDate: baseExp.exported_at ? String(baseExp.exported_at).slice(0, 10) : null,
    latestDate: lastExp.exported_at ? String(lastExp.exported_at).slice(0, 10) : null,
    participants: lastExp.patient_count,
    timepoints: orders.length,
    measuresImproved, measuresTotal,
    foundations, outcomes, risks,
    generatedOn: new Date().toISOString().slice(0, 10),
  });

  await supabaseAdmin.from("research_access_log").insert({
    actor_id: user.id, actor_email: user.email ?? null, action: "export", cohort_id: id,
    detail: { kind: "employer_report" },
  });

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
