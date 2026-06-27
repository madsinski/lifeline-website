// GET /api/admin/research/cohort?id=… — full dashboard payload for one cohort:
// timepoints/exports, demographics, per-feature trend series, baseline->latest
// movements (top movers), completeness, and group breakdown.
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { computeMovements, type TrendStat } from "@/lib/research/trends";
import { featureDomain, FLAGS, flagCrosses } from "@/lib/research/clinical";
import { pairedTTest, benjaminiHochberg } from "@/lib/research/stats";

async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = []; const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

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
    domain: featureDomain(feature),
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

  const minOrder = Math.min(0, ...(exports || []).map((e) => e.timepoint_order));
  const orders = [...new Set((exports || []).map((e) => e.timepoint_order))].sort((a, b) => a - b);
  const labelByOrder: Record<number, string> = {};
  for (const e of exports || []) labelByOrder[e.timepoint_order] = e.timepoint_label;
  const genderById: Record<string, string | null> = {};
  for (const p of patients || []) genderById[p.medalia_patient_id] = p.gender;

  // ---- clinical flag prevalence at EVERY timepoint (trend), per-patient + gender ----
  const flagFeatures = [...new Set(FLAGS.map((f) => f.feature))];
  const flagObs = await pageAll<{ medalia_patient_id: string; feature: string; value_num: number | null; value_bool: boolean | null; timepoint_order: number }>(
    (from, to) => supabaseAdmin
      .from("research_observations")
      .select("medalia_patient_id, feature, value_num, value_bool, timepoint_order")
      .eq("cohort_id", id).in("feature", flagFeatures).range(from, to),
  );
  // timepoint_order -> patient -> feature -> value
  const valsByTpPatient = new Map<number, Map<string, Record<string, number | boolean | null>>>();
  for (const o of flagObs) {
    if (!valsByTpPatient.has(o.timepoint_order)) valsByTpPatient.set(o.timepoint_order, new Map());
    const pm = valsByTpPatient.get(o.timepoint_order)!;
    if (!pm.has(o.medalia_patient_id)) pm.set(o.medalia_patient_id, {});
    pm.get(o.medalia_patient_id)![o.feature] = o.value_num ?? o.value_bool ?? null;
  }
  const prevalenceAt = (def: typeof FLAGS[number], order: number) => {
    const pm = valsByTpPatient.get(order);
    let eligible = 0, hits = 0;
    if (pm) for (const [pid, fv] of pm) {
      if (def.feature in fv && fv[def.feature] !== null) {
        eligible++;
        if (flagCrosses(def, fv[def.feature], genderById[pid] ?? null)) hits++;
      }
    }
    return { eligible, hits, pct: eligible ? Math.round((100 * hits) / eligible) : 0 };
  };
  const flags = FLAGS.map((def) => {
    const trend = orders.map((order) => ({ timepoint_label: labelByOrder[order], order, ...prevalenceAt(def, order) }));
    const latest = prevalenceAt(def, latestOrder);
    const base = minOrder !== latestOrder ? prevalenceAt(def, minOrder) : null;
    return {
      key: def.key, label: def.label, domain: def.domain,
      hits: latest.hits, eligible: latest.eligible, pct: latest.pct,
      baseline_pct: base && base.eligible ? base.pct : null,
      delta_pct: base && base.eligible ? latest.pct - base.pct : null,
      trend,
    };
  }).filter((f) => f.eligible > 0).sort((a, b) => b.pct - a.pct);

  // ---- per-feature paired significance (baseline -> latest), only with 2+ timepoints ----
  const significance: Record<string, { n: number; p: number; q: number; meanDelta: number }> = {};
  if (minOrder !== latestOrder) {
    const pairObs = await pageAll<{ medalia_patient_id: string; feature: string; timepoint_order: number; value_num: number | null }>(
      (from, to) => supabaseAdmin
        .from("research_observations")
        .select("medalia_patient_id, feature, timepoint_order, value_num")
        .eq("cohort_id", id).in("timepoint_order", [minOrder, latestOrder]).range(from, to),
    );
    const byFeat = new Map<string, Map<string, { b?: number; l?: number }>>();
    for (const o of pairObs) {
      if (o.value_num === null || o.value_num === undefined) continue;
      if (!byFeat.has(o.feature)) byFeat.set(o.feature, new Map());
      const pm = byFeat.get(o.feature)!;
      if (!pm.has(o.medalia_patient_id)) pm.set(o.medalia_patient_id, {});
      const slot = pm.get(o.medalia_patient_id)!;
      if (o.timepoint_order === minOrder) slot.b = o.value_num; else if (o.timepoint_order === latestOrder) slot.l = o.value_num;
    }
    const feats: string[] = []; const pv: number[] = []; const tmp: Record<string, { n: number; p: number; meanDelta: number }> = {};
    for (const [feat, pm] of byFeat) {
      const deltas: number[] = [];
      for (const slot of pm.values()) if (slot.b !== undefined && slot.l !== undefined) deltas.push(slot.l - slot.b);
      const res = pairedTTest(deltas);
      if (res) { feats.push(feat); pv.push(res.p); tmp[feat] = { n: res.n, p: res.p, meanDelta: Math.round(res.meanDelta * 100) / 100 }; }
    }
    const q = benjaminiHochberg(pv);
    feats.forEach((f, i) => { significance[f] = { ...tmp[f], q: Math.round(q[i] * 1000) / 1000 }; });
  }
  const movementsOut = movements.map((m) => ({
    ...m,
    p: significance[m.feature]?.p ?? null,
    q: significance[m.feature]?.q ?? null,
    n_pairs: significance[m.feature]?.n ?? null,
  }));

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
    flags,
    movements: movementsOut,
    completeness,
    aiAnalyses: aiAnalyses || [],
  });
}
