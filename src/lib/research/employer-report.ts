// Build a layman-friendly, aggregate-only HTML summary report for the EMPLOYER
// of a cohort: headline changes, foundations, measured health changes, risk
// reduction, and simple inline-SVG charts. Self-contained HTML (inline CSS +
// SVG) so it prints cleanly to PDF and needs no chart/PDF dependency.
//
// Privacy: aggregate figures only — no individual employee data. Compliance:
// describes MEASURED change, never diagnosis/treatment/prevention or ROI.

export interface MetricChange {
  label: string;
  baseline: number | null;
  latest: number | null;
  unit?: string;
  pctChange: number | null;   // signed raw % change
  improved: boolean | null;   // direction-aware
  scaleMax?: number;          // for the bar (e.g. 10 for scores)
}
export interface RiskChange {
  label: string;
  baselinePct: number | null;
  latestPct: number | null;
  deltaPp: number | null;     // latest - baseline, percentage points
  improved: boolean | null;
}
export interface EmployerReportData {
  cohortName: string;
  employerName?: string | null;
  baselineLabel: string;
  latestLabel: string;
  baselineDate: string | null;
  latestDate: string | null;
  participants: number;
  timepoints: number;
  measuresImproved: number;
  measuresTotal: number;
  foundations: MetricChange[];
  outcomes: MetricChange[];
  risks: RiskChange[];
  generatedOn: string;        // pass in (no Date.now in libs)
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const fmt = (n: number | null, d = 1) => (n === null || n === undefined ? "—" : (Math.round(n * 10 ** d) / 10 ** d).toString());
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${Math.round(n)}%`);
const GREEN = "#10B981", RED = "#EF4444", GREY = "#CBD5E1", INK = "#0F2E2E";

// improvement magnitude as a positive-is-better signed percentage
function improvementPct(m: MetricChange): number {
  if (m.pctChange === null || m.improved === null) return 0;
  return (m.improved ? 1 : -1) * Math.abs(m.pctChange);
}

// two-bar baseline→latest comparison on a shared scale
function comparisonBars(m: MetricChange): string {
  const max = (m.scaleMax ?? (Math.max(m.baseline ?? 0, m.latest ?? 0) * 1.15)) || 1;
  const w = (v: number | null) => `${Math.max(0, Math.min(100, ((v ?? 0) / max) * 100))}%`;
  const col = m.improved === false ? RED : m.improved === true ? GREEN : GREY;
  return `
    <div class="bars">
      <div class="barrow"><span class="bl">Baseline</span><div class="track"><div class="bar" style="width:${w(m.baseline)};background:${GREY}"></div></div><span class="bv">${fmt(m.baseline)}${m.unit ? " " + esc(m.unit) : ""}</span></div>
      <div class="barrow"><span class="bl">Latest</span><div class="track"><div class="bar" style="width:${w(m.latest)};background:${col}"></div></div><span class="bv">${fmt(m.latest)}${m.unit ? " " + esc(m.unit) : ""}</span></div>
    </div>`;
}

function metricCard(m: MetricChange): string {
  const badge = m.improved === null ? `<span class="badge grey">no change</span>`
    : `<span class="badge ${m.improved ? "good" : "bad"}">${m.improved ? "▲ improved" : "▼ worse"} ${pct(m.pctChange)}</span>`;
  return `<div class="card"><div class="cardhead"><span class="clabel">${esc(m.label)}</span>${badge}</div>${comparisonBars(m)}</div>`;
}

function riskRow(r: RiskChange): string {
  const w = (v: number | null) => `${Math.max(0, Math.min(100, v ?? 0))}%`;
  const col = r.improved === false ? RED : r.improved === true ? GREEN : GREY;
  const badge = r.deltaPp === null ? "" : `<span class="badge ${r.improved ? "good" : r.improved === false ? "bad" : "grey"}">${r.deltaPp > 0 ? "+" : ""}${r.deltaPp} pts</span>`;
  return `
    <div class="card">
      <div class="cardhead"><span class="clabel">${esc(r.label)}</span>${badge}</div>
      <div class="bars">
        <div class="barrow"><span class="bl">Baseline</span><div class="track"><div class="bar" style="width:${w(r.baselinePct)};background:${GREY}"></div></div><span class="bv">${fmt(r.baselinePct, 0)}%</span></div>
        <div class="barrow"><span class="bl">Latest</span><div class="track"><div class="bar" style="width:${w(r.latestPct)};background:${col}"></div></div><span class="bv">${fmt(r.latestPct, 0)}%</span></div>
      </div>
    </div>`;
}

// diverging bar chart of % improvement (right = better, left = worse)
function improvementChart(metrics: MetricChange[]): string {
  const rows = metrics.filter((m) => m.improved !== null);
  if (!rows.length) return "";
  const maxAbs = Math.max(10, ...rows.map((m) => Math.abs(improvementPct(m))));
  const bars = rows.map((m) => {
    const v = improvementPct(m);
    const half = (Math.abs(v) / maxAbs) * 50;
    const left = v >= 0 ? 50 : 50 - half;
    return `
      <div class="ichart-row">
        <span class="ichart-label">${esc(m.label)}</span>
        <div class="ichart-track">
          <div class="ichart-mid"></div>
          <div class="ichart-bar" style="left:${left}%;width:${half}%;background:${v >= 0 ? GREEN : RED}"></div>
        </div>
        <span class="ichart-val" style="color:${v >= 0 ? GREEN : RED}">${v > 0 ? "+" : ""}${Math.round(v)}%</span>
      </div>`;
  }).join("");
  return `<div class="ichart">${bars}</div>`;
}

export function buildEmployerReport(d: EmployerReportData): string {
  const period = `${esc(d.baselineLabel)}${d.baselineDate ? ` (${esc(d.baselineDate)})` : ""} → ${esc(d.latestLabel)}${d.latestDate ? ` (${esc(d.latestDate)})` : ""}`;
  const allImprov = [...d.foundations, ...d.outcomes];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.cohortName)} — Health Programme Summary</title>
<style>
  :root{--ink:${INK};--green:${GREEN}}
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1f2937;background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{max-width:880px;margin:0 auto;padding:28px}
  .hero{background:linear-gradient(135deg,#0F2E2E,#10B981);color:#fff;border-radius:18px;padding:28px 30px}
  .hero h1{margin:0 0 4px;font-size:24px}
  .hero .sub{opacity:.9;font-size:14px}
  .hero .meta{margin-top:14px;display:flex;flex-wrap:wrap;gap:18px;font-size:13px;opacity:.95}
  .hero .meta b{display:block;font-size:20px;font-weight:700}
  .conf{margin-top:10px;font-size:11px;opacity:.8}
  h2{font-size:16px;color:var(--ink);margin:28px 0 4px}
  .lead{color:#64748b;font-size:13px;margin:0 0 12px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .card{background:#fff;border:1px solid #eef2f6;border-radius:12px;padding:12px 14px}
  .cardhead{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}
  .clabel{font-weight:600;font-size:13px;color:#111827}
  .badge{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}
  .badge.good{background:#ecfdf5;color:#047857}.badge.bad{background:#fef2f2;color:#b91c1c}.badge.grey{background:#f1f5f9;color:#64748b}
  .bars{display:flex;flex-direction:column;gap:5px}
  .barrow{display:flex;align-items:center;gap:8px;font-size:11px}
  .bl{width:54px;color:#94a3b8}.bv{width:78px;text-align:right;color:#334155;font-variant-numeric:tabular-nums}
  .track{flex:1;height:9px;background:#f1f5f9;border-radius:999px;overflow:hidden}
  .bar{height:100%;border-radius:999px}
  .ichart{background:#fff;border:1px solid #eef2f6;border-radius:12px;padding:14px 16px}
  .ichart-row{display:flex;align-items:center;gap:10px;margin:6px 0;font-size:12px}
  .ichart-label{width:190px;color:#334155}
  .ichart-track{position:relative;flex:1;height:14px;background:#f8fafc;border-radius:6px}
  .ichart-mid{position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:#cbd5e1}
  .ichart-bar{position:absolute;top:2px;height:10px;border-radius:4px}
  .ichart-val{width:48px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
  .foot{margin-top:26px;padding-top:14px;border-top:1px solid #e5e7eb;color:#94a3b8;font-size:11px;line-height:1.5}
  @media print{body{background:#fff}.page{padding:0}.card,.ichart{break-inside:avoid}}
  @media(max-width:680px){.grid{grid-template-columns:1fr}.ichart-label{width:120px}}
</style></head>
<body><div class="page">
  <div class="hero">
    <h1>${esc(d.cohortName)}</h1>
    <div class="sub">Workplace Health Programme — results summary${d.employerName ? ` for ${esc(d.employerName)}` : ""}</div>
    <div class="meta">
      <div><b>${d.participants}</b>participants</div>
      <div><b>${d.timepoints}</b>check-ins</div>
      <div><b>${d.measuresImproved}/${d.measuresTotal}</b>measures improved</div>
      <div><b>${period}</b></div>
    </div>
    <div class="conf">Confidential · aggregate results only — no individual employee data is shown or identifiable.</div>
  </div>

  <h2>The headline</h2>
  <p class="lead">Change in each measured area from baseline to the latest check-in. Bars to the right (green) are improvements; to the left (red) are areas that moved the wrong way.</p>
  ${improvementChart(allImprov)}

  <h2>Health foundations — what we coach</h2>
  <p class="lead">The everyday habits the programme works on directly. Scored 0–10; higher is better.</p>
  <div class="grid">${d.foundations.map(metricCard).join("")}</div>

  <h2>Measured health changes — what we expect coaching to move</h2>
  <p class="lead">Objective measurements and blood markers that lifestyle change tends to improve over time.</p>
  <div class="grid">${d.outcomes.map(metricCard).join("")}</div>

  <h2>Risk reduction across the workforce</h2>
  <p class="lead">Share of participants flagged on each screening measure. A lower percentage means fewer people affected.</p>
  <div class="grid">${d.risks.map(riskRow).join("")}</div>

  <div class="foot">
    Prepared by Lifeline Health · ${esc(d.generatedOn)}. These are aggregate, de-identified results for a group of employees and describe measured change over the period shown; they are not a medical diagnosis and individual results vary. The programme measures and supports lifestyle change — it does not diagnose, treat, or prevent disease, and no specific health or financial outcome is guaranteed. Screening measures (e.g. mood, alcohol) indicate where a supportive conversation may help; they are not clinical diagnoses. Figures with small numbers of participants should be read with caution.
  </div>
</div></body></html>`;
}
