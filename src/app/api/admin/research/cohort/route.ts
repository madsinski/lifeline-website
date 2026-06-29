// GET /api/admin/research/cohort?id=… — full dashboard payload for one cohort:
// timepoints/exports, demographics, per-feature trend series, baseline->latest
// movements (top movers), completeness, and group breakdown.
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireResearchRead } from "@/lib/research/access";
import { computeMovements, type TrendStat } from "@/lib/research/trends";
import { featureDomain, FLAGS, flagCrosses, isConditional, benchmarkFor } from "@/lib/research/clinical";
import { pairedTTest, benjaminiHochberg, wilcoxonSignedRank, mcnemar } from "@/lib/research/stats";
import { featureDirection } from "@/lib/research/clinical";

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
  const user = await requireResearchRead(req);
  if (!user) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad_request", detail: "id required" }, { status: 400 });

  const { data: cohort, error: cErr } = await supabaseAdmin
    .from("research_cohorts").select("id, name, slug, description, pathway, created_at, excluded_patients, excluded_features").eq("id", id).single();
  if (cErr || !cohort) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const exPatients = new Set<string>((cohort.excluded_patients as string[] | null) ?? []);
  const exFeatures = new Set<string>((cohort.excluded_features as string[] | null) ?? []);

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
  const series = [...seriesMap.entries()].filter(([feature]) => !exFeatures.has(feature)).map(([feature, points]) => ({
    feature,
    obs_type: points[0].obs_type,
    display: points[0].display,
    unit: points[0].unit,
    domain: featureDomain(feature),
    points,
  }));

  const movements = computeMovements(((trends || []) as unknown as TrendStat[]).filter((t) => !exFeatures.has(t.feature)));
  const includedPatients = (patients || []).filter((p) => !exPatients.has(p.medalia_patient_id));

  // demographics
  const genders: Record<string, number> = {};
  const groups: Record<string, number> = {};
  const ages: number[] = [];
  for (const p of includedPatients) {
    genders[p.gender || "unknown"] = (genders[p.gender || "unknown"] || 0) + 1;
    groups[p.group_name || "(none)"] = (groups[p.group_name || "(none)"] || 0) + 1;
    if (typeof p.latest_age === "number") ages.push(p.latest_age);
  }
  ages.sort((a, b) => a - b);

  // completeness: missing % per feature at the latest timepoint
  const latestOrder = Math.max(0, ...(exports || []).map((e) => e.timepoint_order));
  const completeness = ((trends || []) as unknown as TrendStat[])
    .filter((t) => t.timepoint_order === latestOrder && !exFeatures.has(t.feature))
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
    if (exPatients.has(o.medalia_patient_id)) continue;
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
  const multiTimepoint = minOrder !== latestOrder;
  // paired flag transitions (band-shift) + McNemar test over patients present at both timepoints
  const transitionsFor = (def: typeof FLAGS[number]) => {
    const pmB = valsByTpPatient.get(minOrder), pmL = valsByTpPatient.get(latestOrder);
    if (!multiTimepoint || !pmB || !pmL) return null;
    let improved = 0, worsened = 0, stableFlagged = 0, paired = 0;
    for (const [pid, fvB] of pmB) {
      const fvL = pmL.get(pid);
      if (!fvL) continue;
      if (!(def.feature in fvB) || fvB[def.feature] === null) continue;
      if (!(def.feature in fvL) || fvL[def.feature] === null) continue;
      paired++;
      const posB = flagCrosses(def, fvB[def.feature], genderById[pid] ?? null);
      const posL = flagCrosses(def, fvL[def.feature], genderById[pid] ?? null);
      if (posB && !posL) improved++; else if (!posB && posL) worsened++; else if (posB && posL) stableFlagged++;
    }
    const m = mcnemar(improved, worsened);
    return { improved, worsened, stableFlagged, paired, p: Math.round(m.p * 1000) / 1000 };
  };
  const flags = FLAGS.filter((def) => !exFeatures.has(def.feature)).map((def) => {
    const trend = orders.map((order) => ({ timepoint_label: labelByOrder[order], order, ...prevalenceAt(def, order) }));
    const latest = prevalenceAt(def, latestOrder);
    const base = multiTimepoint ? prevalenceAt(def, minOrder) : null;
    return {
      key: def.key, label: def.label, domain: def.domain,
      hits: latest.hits, eligible: latest.eligible, pct: latest.pct,
      baseline_pct: base && base.eligible ? base.pct : null,
      delta_pct: base && base.eligible ? latest.pct - base.pct : null,
      transitions: transitionsFor(def),
      benchmark: benchmarkFor(def.key),
      trend,
    };
  }).filter((f) => f.eligible > 0).sort((a, b) => b.pct - a.pct);

  // ---- per-feature paired significance (baseline -> latest), only with 2+ timepoints ----
  type Sig = { n: number; p: number; q: number; meanDelta: number; ci: [number, number]; wilcoxonP: number | null; responderPct: number | null };
  const significance: Record<string, Sig> = {};
  const r2 = (x: number) => Math.round(x * 100) / 100;
  if (multiTimepoint) {
    const pairObs = await pageAll<{ medalia_patient_id: string; feature: string; timepoint_order: number; value_num: number | null }>(
      (from, to) => supabaseAdmin
        .from("research_observations")
        .select("medalia_patient_id, feature, timepoint_order, value_num")
        .eq("cohort_id", id).in("timepoint_order", [minOrder, latestOrder]).range(from, to),
    );
    const byFeat = new Map<string, Map<string, { b?: number; l?: number }>>();
    for (const o of pairObs) {
      if (o.value_num === null || o.value_num === undefined) continue;
      if (exPatients.has(o.medalia_patient_id) || exFeatures.has(o.feature)) continue;
      if (!byFeat.has(o.feature)) byFeat.set(o.feature, new Map());
      const pm = byFeat.get(o.feature)!;
      if (!pm.has(o.medalia_patient_id)) pm.set(o.medalia_patient_id, {});
      const slot = pm.get(o.medalia_patient_id)!;
      if (o.timepoint_order === minOrder) slot.b = o.value_num; else if (o.timepoint_order === latestOrder) slot.l = o.value_num;
    }
    const feats: string[] = []; const pv: number[] = []; const tmp: Record<string, Omit<Sig, "q">> = {};
    for (const [feat, pm] of byFeat) {
      const baseVals: number[] = []; const deltas: number[] = [];
      for (const slot of pm.values()) if (slot.b !== undefined && slot.l !== undefined) { baseVals.push(slot.b); deltas.push(slot.l - slot.b); }
      const res = pairedTTest(deltas);
      if (!res) continue;
      // responder rate: % whose change is beneficial AND ≥ 0.5 × baseline SD (a half-SD MCID proxy)
      const bMean = baseVals.reduce((a, b) => a + b, 0) / baseVals.length;
      const bSd = Math.sqrt(baseVals.reduce((a, b) => a + (b - bMean) ** 2, 0) / Math.max(1, baseVals.length - 1));
      const dir = featureDirection(feat); const thr = 0.5 * bSd;
      let responders = 0, evaluable = 0;
      if (dir !== "neutral" && thr > 0) for (const dlt of deltas) { evaluable++; const good = dir === "up" ? dlt > 0 : dlt < 0; if (good && Math.abs(dlt) >= thr) responders++; }
      const wil = wilcoxonSignedRank(deltas);
      feats.push(feat); pv.push(res.p);
      tmp[feat] = { n: res.n, p: res.p, meanDelta: r2(res.meanDelta), ci: [r2(res.ci95[0]), r2(res.ci95[1])],
        wilcoxonP: wil ? Math.round(wil.p * 1000) / 1000 : null, responderPct: evaluable ? Math.round((100 * responders) / evaluable) : null };
    }
    const q = benjaminiHochberg(pv);
    feats.forEach((f, i) => { significance[f] = { ...tmp[f], q: Math.round(q[i] * 1000) / 1000 }; });
  }
  const movementsOut = movements.map((m) => ({
    ...m,
    p: significance[m.feature]?.p ?? null,
    q: significance[m.feature]?.q ?? null,
    n_pairs: significance[m.feature]?.n ?? null,
    ci: significance[m.feature]?.ci ?? null,
    wilcoxon_p: significance[m.feature]?.wilcoxonP ?? null,
    responder_pct: significance[m.feature]?.responderPct ?? null,
  }));

  // ---- data quality: per-patient completeness & per-feature missingness at the
  //      latest timepoint (computed over ALL data so the user can review what to
  //      include/exclude; suggestions flag the obvious cases) ----
  const dqObs = await pageAll<{ medalia_patient_id: string; feature: string; value_num: number | null; value_text: string | null; value_bool: boolean | null }>(
    (from, to) => supabaseAdmin
      .from("research_observations")
      .select("medalia_patient_id, feature, value_num, value_text, value_bool")
      .eq("cohort_id", id).eq("timepoint_order", latestOrder).range(from, to),
  );
  const presentByPatient = new Map<string, Set<string>>();
  const presentByFeature = new Map<string, Set<string>>();
  const dqPatients = new Set<string>();
  const dqFeatures = new Set<string>();
  for (const o of dqObs) {
    dqPatients.add(o.medalia_patient_id);
    dqFeatures.add(o.feature);
    const has = o.value_num !== null || o.value_text !== null || o.value_bool !== null;
    if (!has) continue;
    if (!presentByPatient.has(o.medalia_patient_id)) presentByPatient.set(o.medalia_patient_id, new Set());
    presentByPatient.get(o.medalia_patient_id)!.add(o.feature);
    if (!presentByFeature.has(o.feature)) presentByFeature.set(o.feature, new Set());
    presentByFeature.get(o.feature)!.add(o.medalia_patient_id);
  }
  const totalFeatures = dqFeatures.size || 1;
  const totalDqPatients = dqPatients.size || 1;
  const genderByIdAll: Record<string, string | null> = {};
  for (const p of patients || []) genderByIdAll[p.medalia_patient_id] = p.gender;
  const allDqFeatures = [...dqFeatures].sort();
  const dqPatientRows = [...dqPatients].map((pid) => {
    const presentSet = presentByPatient.get(pid) ?? new Set<string>();
    const present = presentSet.size;
    const completenessPct = Math.round((100 * present) / totalFeatures);
    const missing = allDqFeatures.filter((f) => !presentSet.has(f));
    return { patient: pid, gender: genderByIdAll[pid] ?? null, present, total: totalFeatures, completenessPct, missing,
      excluded: exPatients.has(pid), suggested: completenessPct < 50 };
  }).sort((a, b) => a.completenessPct - b.completenessPct);
  const dqFeatureRows = [...dqFeatures].map((feature) => {
    const present = presentByFeature.get(feature)?.size ?? 0;
    const missingPct = Math.round((100 * (totalDqPatients - present)) / totalDqPatients);
    const conditional = isConditional(feature);
    // Don't suggest excluding conditional instruments — their missingness is by
    // design (screened negative), not a data problem.
    return { feature, present, total: totalDqPatients, missingPct, conditional,
      excluded: exFeatures.has(feature), suggested: missingPct > 50 && !conditional };
  }).sort((a, b) => b.missingPct - a.missingPct);

  // ---- retention across timepoints (patient sets via near-universal flag features) ----
  const retention = orders.map((order) => ({ timepoint_label: labelByOrder[order], order, n: valsByTpPatient.get(order)?.size ?? 0 }));
  let retainedPct: number | null = null, retainedN: number | null = null, baselineN: number | null = null;
  if (multiTimepoint) {
    const bSet = valsByTpPatient.get(minOrder), lSet = valsByTpPatient.get(latestOrder);
    if (bSet && lSet) {
      let retained = 0; for (const pid of bSet.keys()) if (lSet.has(pid)) retained++;
      retainedN = retained; baselineN = bSet.size; retainedPct = bSet.size ? Math.round((100 * retained) / bSet.size) : null;
    }
  }

  // ---- Workforce Health Index (0-100) = lífstílseinkunn ×10, else mean of foundation 0-10 scores ----
  const tArr = (trends || []) as unknown as TrendStat[];
  const meanAt = (feat: string, order: number) => tArr.find((t) => t.feature === feat && t.timepoint_order === order)?.mean ?? null;
  const FOUND10 = ["svefn_total", "hreyfing_total", "naering_total", "andlegt_total", "fikn_total", "lifeline_health_sleep_medical_score", "lifeline_health_sleep_behaviour_score", "lifeline_health_exercise_medical_score", "lifeline_health_exercise_behavioural_score", "lifeline_health_nutrition_medical_score", "lifeline_health_nutrition_behavioural_score"];  // domain summaries (compose Lífstílseinkunn) then sub-scores; PWI excluded
  const indexAt = (order: number): number | null => {
    const life = meanAt("lifstilseinkunn", order);
    if (life !== null) return Math.round(life * 10);
    const ms = FOUND10.map((f) => meanAt(f, order)).filter((v): v is number => v !== null);
    return ms.length ? Math.round((ms.reduce((a, b) => a + b, 0) / ms.length) * 10) : null;
  };
  const healthIndex = { baseline: indexAt(minOrder), latest: indexAt(latestOrder) };

  const { data: aiAnalyses } = await supabaseAdmin
    .from("research_ai_analyses")
    .select("id, scope, model, summary_md, created_at")
    .eq("cohort_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    cohort,
    exports: exports || [],
    dataQuality: {
      excludedPatients: [...exPatients],
      excludedFeatures: [...exFeatures],
      patients: dqPatientRows,
      features: dqFeatureRows,
    },
    demographics: {
      n: includedPatients.length,
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
    retention: { byTimepoint: retention, retainedN, baselineN, retainedPct },
    healthIndex,
    aiAnalyses: aiAnalyses || [],
  });
}
