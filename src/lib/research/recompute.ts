// Recompute cached trend aggregates for a cohort from its observations.
// Called after every ingest. Server-only (uses the service-role client).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeTrendStats, type TrendInputObs } from "@/lib/research/trends";

export async function recomputeCohortTrends(cohortId: string): Promise<number> {
  // patient count per timepoint (denominator for missing %)
  const { data: exports } = await supabaseAdmin
    .from("research_exports")
    .select("timepoint_label, patient_count")
    .eq("cohort_id", cohortId);
  const patientsAtTp: Record<string, number> = {};
  for (const e of exports ?? []) patientsAtTp[e.timepoint_label] = e.patient_count ?? 0;

  // pull numeric-capable observations (paged to avoid the 1000-row default cap)
  const obs: TrendInputObs[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("research_observations")
      .select("feature, obs_type, display, unit, timepoint_label, timepoint_order, value_num, value_bool")
      .eq("cohort_id", cohortId)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    obs.push(...(data as TrendInputObs[]));
    if (data.length < PAGE) break;
  }

  const stats = computeTrendStats(obs, patientsAtTp);

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
