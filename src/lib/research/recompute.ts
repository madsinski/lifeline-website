// Recompute cached trend aggregates for a cohort from its observations.
// Called after every ingest and whenever exclusions change. Respects the
// cohort's excluded patients (rows) and excluded features (columns).
// Server-only (uses the service-role client).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeTrendStats, type TrendInputObs } from "@/lib/research/trends";

export async function recomputeCohortTrends(cohortId: string): Promise<number> {
  const { data: cohort } = await supabaseAdmin
    .from("research_cohorts").select("excluded_patients, excluded_features").eq("id", cohortId).single();
  const exPatients = new Set<string>((cohort?.excluded_patients as string[] | null) ?? []);
  const exFeatures = new Set<string>((cohort?.excluded_features as string[] | null) ?? []);

  // pull numeric-capable observations (paged to avoid the 1000-row default cap)
  type Row = TrendInputObs & { medalia_patient_id: string };
  const obs: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("research_observations")
      .select("medalia_patient_id, feature, obs_type, display, unit, timepoint_label, timepoint_order, value_num, value_bool")
      .eq("cohort_id", cohortId)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    obs.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }

  // drop excluded patients (rows) and excluded features (columns)
  const included = obs.filter((o) => !exPatients.has(o.medalia_patient_id) && !exFeatures.has(o.feature));

  // denominator for missing % = distinct INCLUDED patients per timepoint
  const patientsByTp = new Map<string, Set<string>>();
  for (const o of included) {
    if (!patientsByTp.has(o.timepoint_label)) patientsByTp.set(o.timepoint_label, new Set());
    patientsByTp.get(o.timepoint_label)!.add(o.medalia_patient_id);
  }
  const patientsAtTp: Record<string, number> = {};
  for (const [tp, set] of patientsByTp) patientsAtTp[tp] = set.size;

  const stats = computeTrendStats(included, patientsAtTp);

  // replace cached trends for this cohort
  await supabaseAdmin.from("research_trends").delete().eq("cohort_id", cohortId);
  if (stats.length) {
    const rows = stats.map((s) => ({
      cohort_id: cohortId,
      feature: s.feature, obs_type: s.obs_type, display: s.display, unit: s.unit,
      timepoint_label: s.timepoint_label, timepoint_order: s.timepoint_order,
      n: s.n, n_missing: s.n_missing,
      mean: s.mean, median: s.median, sd: s.sd, min: s.min, max: s.max,
    }));
    for (let i = 0; i < rows.length; i += 1000) {
      await supabaseAdmin.from("research_trends").insert(rows.slice(i, i + 1000));
    }
  }
  return stats.length;
}
