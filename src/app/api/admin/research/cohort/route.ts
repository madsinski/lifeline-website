// GET /api/admin/research/cohort?id=… — full dashboard payload for one cohort:
// timepoints/exports, demographics, per-feature trend series, baseline->latest
// movements (top movers), completeness, and group breakdown.
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { computeMovements, type TrendStat } from "@/lib/research/trends";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad_request", detail: "id required" }, { status: 400 });

  const { data: cohort, error: cErr } = await supabaseAdmin
    .from("research_cohorts").select("id, name, slug, description, pathway, created_at").eq("id", id).single();
  if (cErr || !cohort) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: exports } = await supabaseAdmin
    .from("research_exports")
    .select("id, timepoint_label, timepoint_order, export_type, exported_at, patient_count, observation_count, answer_count, source_filename, created_at")
    .eq("cohort_id", id)
    .order("timepoint_order", { ascending: true });

  const { data: patients } = await supabaseAdmin
    .from("research_patients")
    .select("medalia_patient_id, gender, latest_age, group_name")
    .eq("cohort_id", id);

  const { data: trends } = await supabaseAdmin
    .from("research_trends")
    .select("feature, obs_type, display, unit, timepoint_label, timepoint_order, n, n_missing, mean, median, sd, min, max")
    .eq("cohort_id", id)
    .order("feature", { ascending: true })
    .order("timepoint_order", { ascending: true });

  // group trend rows into per-feature series
  const seriesMap = new Map<string, TrendStat[]>();
  for (const t of (trends || []) as unknown as TrendStat[]) {
    (seriesMap.get(t.feature) ?? seriesMap.set(t.feature, []).get(t.feature)!).push(t);
  }
  const series = [...seriesMap.entries()].map(([feature, points]) => ({
    feature,
    obs_type: points[0].obs_type,
    display: points[0].display,
    unit: points[0].unit,
    points,
  }));

  const movements = computeMovements((trends || []) as unknown as TrendStat[]);

  // demographics
  const genders: Record<string, number> = {};
  const groups: Record<string, number> = {};
  const ages: number[] = [];
  for (const p of patients || []) {
    genders[p.gender || "unknown"] = (genders[p.gender || "unknown"] || 0) + 1;
    groups[p.group_name || "(none)"] = (groups[p.group_name || "(none)"] || 0) + 1;
    if (typeof p.latest_age === "number") ages.push(p.latest_age);
  }
  ages.sort((a, b) => a - b);

  // completeness: missing % per feature at the latest timepoint
  const latestOrder = Math.max(0, ...(exports || []).map((e) => e.timepoint_order));
  const completeness = ((trends || []) as unknown as TrendStat[])
    .filter((t) => t.timepoint_order === latestOrder)
    .map((t) => ({
      feature: t.feature,
      obs_type: t.obs_type,
      n: t.n,
      n_missing: t.n_missing,
      pct_missing: t.n + t.n_missing > 0 ? Math.round((100 * t.n_missing) / (t.n + t.n_missing)) : 0,
    }))
    .sort((a, b) => b.pct_missing - a.pct_missing);

  const { data: aiAnalyses } = await supabaseAdmin
    .from("research_ai_analyses")
    .select("id, scope, model, summary_md, created_at")
    .eq("cohort_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    cohort,
    exports: exports || [],
    demographics: {
      n: (patients || []).length,
      genders,
      groups,
      age: ages.length
        ? { min: ages[0], median: ages[Math.floor(ages.length / 2)], max: ages[ages.length - 1] }
        : null,
    },
    series,
    movements,
    completeness,
    aiAnalyses: aiAnalyses || [],
  });
}
