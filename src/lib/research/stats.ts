// Minimal statistics for longitudinal significance testing.
// Paired t-test on per-patient baseline→latest deltas, with a two-tailed
// p-value from the Student-t distribution (regularized incomplete beta).
// No external dependency.

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

// Continued-fraction expansion for the incomplete beta (Numerical Recipes betacf)
function betacf(a: number, b: number, x: number): number {
  const FPMIN = 1e-30, EPS = 3e-12, MAXIT = 200;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// Regularized incomplete beta I_x(a,b)
function ibeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-tailed p-value for a t statistic with df degrees of freedom. */
export function tTestP(t: number, df: number): number {
  if (!isFinite(t) || df <= 0) return 1;
  return ibeta(df / (df + t * t), df / 2, 0.5);
}

/** Two-tailed critical t value for a given df (alpha default 0.05), via bisection on tTestP. */
export function tCritical(df: number, alpha = 0.05): number {
  if (df <= 0) return NaN;
  let lo = 0, hi = 1000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (tTestP(mid, df) > alpha) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface PairedResult {
  n: number;          // number of paired observations
  meanDelta: number;  // mean of latest - baseline
  sd: number;         // sd of the deltas
  t: number;
  df: number;
  p: number;          // two-tailed
  ci95: [number, number]; // 95% CI of the mean change
}

/** Paired t-test on a list of per-patient deltas (latest - baseline), with 95% CI. */
export function pairedTTest(deltas: number[]): PairedResult | null {
  const n = deltas.length;
  if (n < 3) return null;
  const mean = deltas.reduce((a, b) => a + b, 0) / n;
  const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(n);
  const df = n - 1;
  if (se === 0) return { n, meanDelta: mean, sd, t: mean === 0 ? 0 : Infinity, df, p: mean === 0 ? 1 : 0, ci95: [mean, mean] };
  const t = mean / se;
  const tc = tCritical(df, 0.05);
  return { n, meanDelta: mean, sd, t, df, p: tTestP(t, df), ci95: [mean - tc * se, mean + tc * se] };
}

const normalCdf = (z: number): number => {
  // Abramowitz-Stegun erf approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
};

export interface WilcoxonResult { n: number; W: number; z: number; p: number; }
/** Wilcoxon signed-rank test (normal approximation w/ continuity + tie correction). */
export function wilcoxonSignedRank(deltas: number[]): WilcoxonResult | null {
  const nz = deltas.filter((d) => d !== 0);
  const n = nz.length;
  if (n < 6) return null; // normal approx unreliable below ~6
  const ranked = nz.map((d) => ({ abs: Math.abs(d), sign: Math.sign(d) })).sort((a, b) => a.abs - b.abs);
  // average ranks for ties
  const ranks = new Array(n).fill(0);
  let i = 0; const tieGroups: number[] = [];
  while (i < n) {
    let j = i; while (j < n && ranked[j].abs === ranked[i].abs) j++;
    const avg = (i + 1 + j) / 2; // average of ranks i+1..j
    for (let k = i; k < j; k++) ranks[k] = avg;
    if (j - i > 1) tieGroups.push(j - i);
    i = j;
  }
  let Wplus = 0;
  for (let k = 0; k < n; k++) if (ranked[k].sign > 0) Wplus += ranks[k];
  const meanW = (n * (n + 1)) / 4;
  const tieCorr = tieGroups.reduce((s, t3) => s + (t3 ** 3 - t3), 0);
  const sdW = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieCorr / 48);
  if (sdW === 0) return { n, W: Wplus, z: 0, p: 1 };
  const z = (Wplus - meanW - Math.sign(Wplus - meanW) * 0.5) / sdW; // continuity correction
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { n, W: Wplus, z, p: Math.min(1, p) };
}

export interface McNemarResult { b: number; c: number; chi2: number; p: number; }
/** McNemar's test for paired binary change (b = pos→neg, c = neg→pos). */
export function mcnemar(b: number, c: number): McNemarResult {
  if (b + c === 0) return { b, c, chi2: 0, p: 1 };
  const chi2 = (Math.abs(b - c) - 1) ** 2 / (b + c); // continuity-corrected, df=1
  // chi-square(1) survival = 2*(1 - Phi(sqrt(chi2)))
  const p = 2 * (1 - normalCdf(Math.sqrt(Math.max(0, chi2))));
  return { b, c, chi2, p: Math.min(1, p) };
}

/** Benjamini-Hochberg FDR adjustment; returns q-values aligned to the input order. */
export function benjaminiHochberg(pValues: number[]): number[] {
  const idx = pValues.map((p, i) => [p, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const m = pValues.length;
  const q = new Array(m).fill(1);
  let prev = 1;
  for (let k = m - 1; k >= 0; k--) {
    const [p, i] = idx[k];
    prev = Math.min(prev, (p * m) / (k + 1));
    q[i] = prev;
  }
  return q;
}

export function sigStars(p: number | null | undefined): string {
  if (p == null) return "";
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "";
}
