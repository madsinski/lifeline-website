// Deterministic trend computation for a research cohort.
//
// Given the cohort's observations across all timepoints, compute per
// feature x timepoint aggregates (n, missing, mean, median, sd, min, max)
// and the longitudinal movement of each feature (baseline -> latest delta and
// a simple standardized effect size). This is the reproducible numeric layer
// that feeds both the dashboard and the AI narrative.

export interface TrendInputObs {
  feature: string;
  obs_type: string;
  display: string | null;
  unit: string | null;
  timepoint_label: string;
  timepoint_order: number;
  value_num: number | null;
  value_bool: boolean | null;
}

export interface TrendStat {
  cohort_feature: string;
  feature: string;
  obs_type: string;
  display: string | null;
  unit: string | null;
  timepoint_label: string;
  timepoint_order: number;
  n: number;
  n_missing: number;
  mean: number | null;
  median: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
}

// numeric series value: prefer value_num, fall back to boolean prevalence (1/0)
function numeric(o: TrendInputObs): number | null {
  if (o.value_num !== null && o.value_num !== undefined) return o.value_num;
  if (o.value_bool !== null && o.value_bool !== undefined) return o.value_bool ? 1 : 0;
  return null;
}

function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function sd(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const mu = mean(xs)!;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1));
}
const round = (v: number | null, d = 2): number | null =>
  v === null ? null : Math.round(v * 10 ** d) / 10 ** d;

/**
 * @param obs            all numeric-capable observations for the cohort
 * @param patientsAtTp   patient count per timepoint_label (for missing %)
 */
export function computeTrendStats(
  obs: TrendInputObs[],
  patientsAtTp: Record<string, number>,
): TrendStat[] {
  // group by feature + timepoint
  const groups = new Map<string, TrendInputObs[]>();
  for (const o of obs) {
    const k = `${o.feature}@@${o.timepoint_label}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(o);
  }

  const out: TrendStat[] = [];
  for (const [k, rows] of groups) {
    const [feature, tp] = k.split("@@");
    const vals = rows.map(numeric).filter((v): v is number => v !== null);
    const first = rows[0];
    const denom = patientsAtTp[tp] ?? rows.length;
    out.push({
      cohort_feature: feature,
      feature,
      obs_type: first.obs_type,
      display: first.display,
      unit: first.unit,
      timepoint_label: tp,
      timepoint_order: first.timepoint_order,
      n: vals.length,
      n_missing: Math.max(0, denom - vals.length),
      mean: round(mean(vals)),
      median: round(median(vals)),
      sd: round(sd(vals)),
      min: vals.length ? Math.min(...vals) : null,
      max: vals.length ? Math.max(...vals) : null,
    });
  }
  out.sort((a, b) =>
    a.feature === b.feature ? a.timepoint_order - b.timepoint_order : a.feature.localeCompare(b.feature),
  );
  return out;
}

export interface FeatureMovement {
  feature: string;
  display: string | null;
  unit: string | null;
  obs_type: string;
  baseline_label: string;
  latest_label: string;
  baseline_mean: number | null;
  latest_mean: number | null;
  delta: number | null;
  pct_change: number | null;
  effect_size: number | null; // (latest-baseline)/pooled_sd, Cohen's d-like
  n_baseline: number;
  n_latest: number;
}

/** Baseline -> latest movement per feature, ranked by |effect_size|. */
export function computeMovements(stats: TrendStat[]): FeatureMovement[] {
  const byFeature = new Map<string, TrendStat[]>();
  for (const s of stats) (byFeature.get(s.feature) ?? byFeature.set(s.feature, []).get(s.feature)!).push(s);

  const movements: FeatureMovement[] = [];
  for (const [feature, arr] of byFeature) {
    if (arr.length < 2) continue;
    const sorted = [...arr].sort((a, b) => a.timepoint_order - b.timepoint_order);
    const base = sorted[0];
    const latest = sorted[sorted.length - 1];
    if (base.mean === null || latest.mean === null) continue;
    const delta = latest.mean - base.mean;
    const pooledSd =
      base.sd !== null && latest.sd !== null ? Math.sqrt((base.sd ** 2 + latest.sd ** 2) / 2) : null;
    movements.push({
      feature,
      display: latest.display,
      unit: latest.unit,
      obs_type: latest.obs_type,
      baseline_label: base.timepoint_label,
      latest_label: latest.timepoint_label,
      baseline_mean: base.mean,
      latest_mean: latest.mean,
      delta: round(delta),
      pct_change: base.mean !== 0 ? round((delta / Math.abs(base.mean)) * 100, 1) : null,
      effect_size: pooledSd && pooledSd > 0 ? round(delta / pooledSd) : null,
      n_baseline: base.n,
      n_latest: latest.n,
    });
  }
  movements.sort((a, b) => Math.abs(b.effect_size ?? 0) - Math.abs(a.effect_size ?? 0));
  return movements;
}
