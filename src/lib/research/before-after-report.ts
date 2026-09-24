// Before/after report — self-contained, print-to-PDF HTML (two A4 pages),
// Icelandic, written for a lay reader (employer / municipality) while keeping
// the numbers honest: paired n, p-values, and an explicit note that there is
// no control group. Charts are inline SVG so the file prints anywhere.
//
// Data comes from computeBeforeAfter() in ./before-after.ts.

import type { BeforeAfterResult, MetricResult, Subgroup, BpCat } from "./before-after";
import { BP_CAT_LABEL, BP_CAT_RANGE } from "./before-after";

export interface BeforeAfterReportInput {
  cohortName: string;
  exportedAt: string | null;
  logoUrl: string;
  methodsVersion: string;
  result: BeforeAfterResult;
}

const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const dateIs = (iso: string) => { const d = new Date(iso); return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const monthIs = (iso: string) => { const d = new Date(iso); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const range = (r: [string, string] | null) => {
  if (!r) return "";
  const a = new Date(r[0]), b = new Date(r[1]);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return monthIs(r[0]);
  return a.getFullYear() === b.getFullYear() ? `${MONTHS[a.getMonth()]}–${MONTHS[b.getMonth()]} ${b.getFullYear()}` : `${monthIs(r[0])} – ${monthIs(r[1])}`;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (x: number, d: number) => x.toLocaleString("is-IS", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (x: number, d: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${num(Math.abs(x), d)}`;
const decimals = (f: string) => (f.startsWith("bp_") || f === "hba1c" ? 0 : f === "triglycerides" || f === "hdl_cholesterol" || f === "total_cholesterol" || f === "glucose" ? 2 : 1);
const unit = (m: MetricResult) => (m.unit ? ` ${m.unit}` : "");
const pTxt = (p: number | null) => (p === null ? "–" : p < 0.001 ? "<0,001" : num(p, 3));

const C = {
  ink: "#1F2937", muted: "#6B7280", faint: "#E5E7EB", good: "#047857", goodLight: "#34D399",
  bad: "#C2410C", badLight: "#FB923C", neutral: "#D1D5DB", brand: "#10B981",
};

// ── plain-language findings ──────────────────────────────────────
function findings(r: BeforeAfterResult): { title: string; body: string; tone: "good" | "neutral" }[] {
  const out: { title: string; body: string; tone: "good" | "neutral" }[] = [];
  const phrase = (m: MetricResult) => {
    const d = decimals(m.feature);
    const down = m.delta < 0;
    const subject: Record<string, [string, boolean]> = {   // [subject, plural]
      weight: ["Þyngd", false], bmi: ["BMI", false],
      bp_systolic_avg: ["Efri mörk blóðþrýstings", true], bp_diastolic_avg: ["Neðri mörk blóðþrýstings", true],
    };
    const [subj, plural] = subject[m.feature] ?? [m.label, false];
    const verb = down ? (plural ? "lækkuðu" : "lækkaði") : (plural ? "hækkuðu" : "hækkaði");
    return `${subj} ${verb} um ${num(Math.abs(m.delta), Math.max(d, 1))}${unit(m)} (${num(m.before, d)} → ${num(m.after, d)})`;
  };

  // 1) best subgroups: any with ≥1 significant change in the healthy direction
  const wins = r.subgroups
    .map((s) => ({ s, ms: s.metrics.filter((m) => m.significant && m.good === true && m.feature !== "bmi") }))
    .filter((x) => x.ms.length > 0)
    .sort((a, b) => b.ms.length - a.ms.length || a.s.n - b.s.n);
  for (const { s, ms } of wins.slice(0, 2)) {
    out.push({
      title: `${s.label} (${s.n} manns)`,
      body: `${ms.map(phrase).join(". ")}. Breytingin er tölfræðilega marktæk.`,
      tone: "good",
    });
  }

  // 2) whole group
  const sig = r.metrics.filter((m) => m.significant);
  const core = r.metrics.filter((m) => ["weight", "bp_systolic_avg", "bp_diastolic_avg"].includes(m.feature));
  const coreTxt = core.map((m) => `${m.feature === "weight" ? "þyngd" : m.feature === "bp_systolic_avg" ? "efri mörk blóðþrýstings" : "neðri mörk"} ${signed(m.delta, Math.max(decimals(m.feature), 1))}${unit(m)}`).join(", ");
  out.push({
    title: `Hópurinn í heild (${r.nFollowed} manns)`,
    body: sig.length === 0
      ? `Að meðaltali var lítil breyting á hópnum í heild${coreTxt ? `: ${coreTxt}` : ""}. Engin breyting var tölfræðilega marktæk.`
      : `Marktæk breyting á hópnum í heild: ${sig.map(phrase).join("; ")}.`,
    tone: sig.some((m) => m.good) ? "good" : "neutral",
  });

  // 3) weight bands, if there is room
  if (out.length < 3 && r.weightBands.length) {
    const lost = r.weightBands.filter((b) => b.key.startsWith("lost")).reduce((a, b) => a + b.n, 0);
    const lost5 = r.weightBands.find((b) => b.key === "lost5")?.n ?? 0;
    const total = r.weightBands.reduce((a, b) => a + b.n, 0);
    out.push({
      title: "Þyngd einstaklinga",
      body: `${lost} af ${total} léttust um 2% eða meira${lost5 ? `, þar af ${lost5} um 5% eða meira` : ""}.`,
      tone: lost > 0 ? "good" : "neutral",
    });
  }
  return out.slice(0, 3);
}

// ── SVG: subgroup mean change (diverging, direction-aware colour) ─
function subgroupChart(subgroups: Subgroup[], feature: string, title: string, width = 330): string {
  const rows = subgroups
    .map((s) => ({ s, m: s.metrics.find((m) => m.feature === feature) }))
    .filter((x): x is { s: Subgroup; m: MetricResult } => !!x.m);
  if (!rows.length) return "";
  const m0 = rows[0].m;
  const d = Math.max(decimals(feature), 1);
  const labelW = 112, valueW = 44, rowH = 20, top = 6;
  const plotW = width - labelW - valueW;
  const max = Math.max(...rows.map((x) => Math.abs(x.m.delta)), 0.1);
  const zero = labelW + plotW / 2;
  const scale = (plotW / 2 - 4) / max;
  const h = top + rows.length * rowH + 6;
  const bars = rows.map(({ s, m }, i) => {
    const y = top + i * rowH;
    const w = Math.max(Math.abs(m.delta) * scale, 1.5);
    const x = m.delta < 0 ? zero - w : zero;
    const col = m.good === true ? (m.significant ? C.good : C.goodLight) : m.good === false ? (m.significant ? C.bad : C.badLight) : C.neutral;
    const name = s.short;
    return `<text x="0" y="${y + 13}" font-size="8.5" fill="${C.ink}">${esc(name)} <tspan fill="${C.muted}">(${m.n})</tspan></text>
      <rect x="${x}" y="${y + 4}" width="${w}" height="${rowH - 9}" rx="2" fill="${col}"><title>${esc(s.label)}: ${signed(m.delta, d)}${esc(unit(m))}, p=${pTxt(m.p)}</title></rect>
      <text x="${width}" y="${y + 13}" font-size="8.5" text-anchor="end" fill="${C.ink}" font-weight="${m.significant ? 700 : 400}">${signed(m.delta, d)}${m.significant ? "*" : ""}</text>`;
  }).join("");
  return `<div class="chart"><div class="chart-title">${esc(title)} <span class="unit">(meðalbreyting${esc(unit(m0))})</span></div>
    <svg viewBox="0 0 ${width} ${h}" width="100%" role="img" aria-label="${esc(title)}">
      <line x1="${zero}" y1="0" x2="${zero}" y2="${h}" stroke="${C.muted}" stroke-width="0.8"/>
      ${bars}
    </svg></div>`;
}

// ── SVG: weight bands (vertical bars) ────────────────────────────
function weightBandsChart(r: BeforeAfterResult): string {
  if (!r.weightBands.length) return "";
  const cols = [C.good, C.goodLight, C.neutral, C.badLight, C.bad];
  const total = r.weightBands.reduce((a, b) => a + b.n, 0) || 1;
  const W = 330, H = 150, base = 112, barW = 44, gap = (W - 5 * barW) / 6;
  const max = Math.max(...r.weightBands.map((b) => b.n), 1);
  const bars = r.weightBands.map((b, i) => {
    const x = gap + i * (barW + gap);
    const h = (b.n / max) * 90;
    const words = b.label.split(" ");
    const l1 = words.slice(0, 2).join(" "), l2 = words.slice(2).join(" ");
    return `<rect x="${x}" y="${base - h}" width="${barW}" height="${Math.max(h, 1)}" rx="3" fill="${cols[i]}"><title>${esc(b.label)}: ${b.n}</title></rect>
      <text x="${x + barW / 2}" y="${base - h - 4}" font-size="10" font-weight="700" text-anchor="middle" fill="${C.ink}">${b.n}</text>
      <text x="${x + barW / 2}" y="${base - h - 15}" font-size="7.5" text-anchor="middle" fill="${C.muted}">${Math.round((b.n / total) * 100)}%</text>
      <text x="${x + barW / 2}" y="${base + 12}" font-size="7.5" text-anchor="middle" fill="${C.ink}">${esc(l1)}</text>
      <text x="${x + barW / 2}" y="${base + 22}" font-size="7.5" text-anchor="middle" fill="${C.ink}">${esc(l2)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Þyngdarbreytingar einstaklinga">
    <line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="${C.faint}"/>${bars}</svg>`;
}

// ── SVG: BP categories before/after (100% stacked) ────────────────
function bpChart(r: BeforeAfterResult): string {
  const bp = r.bpCategories;
  if (!bp) return "";
  const cats: BpCat[] = ["normal", "elevated", "high"];
  const col: Record<BpCat, string> = { normal: C.brand, elevated: "#F59E0B", high: C.bad };
  const txt: Record<BpCat, string> = { normal: "#fff", elevated: C.ink, high: "#fff" };
  const W = 330, labelW = 40, barH = 24;
  const bar = (label: string, counts: Record<BpCat, number>, y: number) => {
    let x = labelW;
    const segs = cats.map((c) => {
      const w = ((W - labelW) * counts[c]) / bp.n;
      const s = counts[c] ? `<rect x="${x}" y="${y}" width="${Math.max(w - 1.5, 0)}" height="${barH}" fill="${col[c]}"><title>${esc(BP_CAT_LABEL[c])}: ${counts[c]}</title></rect>
        ${w > 22 ? `<text x="${x + w / 2}" y="${y + 15.5}" font-size="9" font-weight="700" text-anchor="middle" fill="${txt[c]}">${counts[c]}</text>` : ""}` : "";
      x += w;
      return s;
    }).join("");
    return `<text x="0" y="${y + 15.5}" font-size="9" fill="${C.ink}" font-weight="600">${label}</text>${segs}`;
  };
  const legend = cats.map((c, i) => `<rect x="${labelW + i * 90}" y="70" width="8" height="8" rx="1.5" fill="${col[c]}"/><text x="${labelW + 11 + i * 90}" y="77.5" font-size="7.5" fill="${C.muted}">${esc(BP_CAT_LABEL[c])}</text>`).join("");
  return `<svg viewBox="0 0 ${W} 84" width="100%" role="img" aria-label="Blóðþrýstingsflokkar fyrir og eftir">
    ${bar("Fyrir", bp.before, 0)}${bar("Eftir", bp.after, 32)}${legend}</svg>`;
}

function metricCard(m: MetricResult): string {
  const d = decimals(m.feature);
  const col = m.significant ? (m.good ? C.good : C.bad) : C.muted;
  const badge = m.significant ? (m.good ? "Marktæk framför" : "Marktæk afturför") : "Ekki marktæk breyting";
  return `<div class="mcard">
    <div class="mlabel">${esc(m.label)}</div>
    <div class="mvals"><span class="before">${num(m.before, d)}</span><span class="arrow">→</span><span class="after">${num(m.after, d)}</span><span class="munit">${esc(m.unit)}</span></div>
    <div class="mfoot"><span class="delta" style="color:${col}">${signed(m.delta, Math.max(d, 1))}${esc(unit(m))}</span><span class="badge" style="color:${col};border-color:${col}">${badge}</span></div>
    <div class="mn">${m.n} manns · ${m.improved} bættu sig, ${m.worsened} versnuðu</div>
  </div>`;
}

function page(inner: string, n: number, input: BeforeAfterReportInput, subtitle: string): string {
  return `<section class="a4">
    <header class="top"><img src="${esc(input.logoUrl)}" alt="Lifeline Health"/><div class="org"><b>${esc(input.cohortName)}</b><span>${esc(subtitle)}</span></div></header>
    ${inner}
    <footer class="foot"><span>Gögn: Medalia-útdráttur${input.exportedAt ? ` ${dateIs(input.exportedAt)}` : ""} · aðferð ${esc(input.methodsVersion)}</span><span>lifelinehealth.is · ${n}/2</span></footer>
  </section>`;
}

export function buildBeforeAfterReport(input: BeforeAfterReportInput): string {
  const r = input.result;
  const months = r.medianDays ? Math.round(r.medianDays / 30.4) : null;
  const followPct = r.nPatients ? Math.round((r.nFollowed / r.nPatients) * 100) : 0;
  const measuredAtFollowup = r.metrics.map((m) => m.label.split(",")[0].split(" (")[0].toLowerCase());
  const uniqMeasured = [...new Set(measuredAtFollowup)];

  const hero = (title: string, sub: string) => `<div class="hero"><div class="eyebrow">Heilsufarsskoðun Lifeline Health</div><h1>${esc(title)}</h1><p>${sub}</p></div>`;

  let p1: string;
  let p2: string;
  if (r.nFollowed === 0) {
    p1 = hero("Fyrir og eftir", "Engar endurmælingar eru enn í gögnunum. Skýrslan fyllist sjálfkrafa þegar þátttakendur hafa verið mældir aftur.");
    p2 = "";
  } else {
    const f = findings(r);
    p1 = `
      ${hero("Hvað breyttist á milli mælinga?", `${r.nFollowed} af ${r.nPatients} þátttakendum (${followPct}%) voru mældir aftur${months ? `, að jafnaði um ${months} mánuðum síðar` : ""}. Fyrsta mæling: ${esc(range(r.baselineRange))}. Endurmæling: ${esc(range(r.followupRange))}.`)}
      <h2>Helstu niðurstöður</h2>
      <div class="findings">${f.map((x) => `<div class="finding ${x.tone}"><div class="ft">${esc(x.title)}</div><div class="fb">${esc(x.body)}</div></div>`).join("")}</div>
      <h2>Hópurinn í heild</h2>
      <p class="lead">Meðaltal fyrstu og síðustu mælingar hjá þeim sem voru mældir tvisvar.${uniqMeasured.length ? ` Í endurmælingu var mælt: ${esc(uniqMeasured.join(", "))}.` : ""}</p>
      <div class="mgrid">${r.metrics.slice(0, 6).map(metricCard).join("")}</div>
      <h2>Hverjir breyttust mest?</h2>
      <p class="lead">Meðalbreyting eftir hópum. Hópar eru skilgreindir út frá fyrstu mælingu. Grænt er breyting í heilsusamlega átt, appelsínugult í óheilsusamlega átt; dökkur litur og * merkja tölfræðilega marktæka breytingu.</p>
      <div class="two">${subgroupChart(r.subgroups, "bp_systolic_avg", "Blóðþrýstingur, efri mörk")}${subgroupChart(r.subgroups, "weight", "Þyngd")}</div>`;

    const rows = r.metrics.map((m) => {
      const d = decimals(m.feature), dd = Math.max(d, 1);
      return `<tr><td>${esc(m.label)}</td><td class="n">${m.n}</td><td class="n">${num(m.before, d)}</td><td class="n">${num(m.after, d)}</td><td class="n"><b>${signed(m.delta, dd)}</b></td><td class="n">${m.ci95 ? `${signed(m.ci95[0], dd)} til ${signed(m.ci95[1], dd)}` : "–"}</td><td class="n">${pTxt(m.p)}</td><td class="n">${m.significant ? "Já" : "Nei"}</td></tr>`;
    }).join("");
    const bp = r.bpCategories;
    p2 = `
      <div class="two">
        <div><h2>Þyngdarbreytingar einstaklinga</h2><p class="lead">Breyting sem hlutfall af upphafsþyngd.</p>${weightBandsChart(r)}</div>
        <div><h2>Blóðþrýstingsflokkar</h2><p class="lead">Fjöldi í hverjum flokki við fyrstu mælingu og endurmælingu.${bp ? ` ${bp.improved} færðust í betri flokk og ${bp.worsened} í verri.` : ""} (${BP_CAT_RANGE}.)</p>${bpChart(r)}</div>
      </div>
      <h2>Allar niðurstöður — hópurinn í heild</h2>
      <table><thead><tr><th>Mæling</th><th class="n">Fjöldi</th><th class="n">Fyrir</th><th class="n">Eftir</th><th class="n">Breyting</th><th class="n">95% öryggisbil</th><th class="n">p-gildi</th><th class="n">Marktækt</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>Niðurstöður eftir hópum</h2>
      <table><thead><tr><th>Hópur</th><th class="n">Fjöldi</th>${["weight", "bp_systolic_avg", "bp_diastolic_avg"].filter((ft) => r.metrics.some((m) => m.feature === ft)).map((ft) => `<th class="n">${ft === "weight" ? "Þyngd (kg)" : ft === "bp_systolic_avg" ? "Efri mörk (mmHg)" : "Neðri mörk (mmHg)"}</th>`).join("")}</tr></thead><tbody>
        ${r.subgroups.map((s) => `<tr><td>${esc(s.label)}</td><td class="n">${s.n}</td>${["weight", "bp_systolic_avg", "bp_diastolic_avg"].filter((ft) => r.metrics.some((m) => m.feature === ft)).map((ft) => {
          const m = s.metrics.find((x) => x.feature === ft);
          return `<td class="n">${m ? `${m.significant ? "<b>" : ""}${signed(m.delta, 1)}${m.significant ? "*</b>" : ""}` : "–"}</td>`;
        }).join("")}</tr>`).join("")}
      </tbody></table>
      <div class="method">
        <div class="ft">Hvernig á að lesa þetta</div>
        <ul>
          <li>Borin er saman fyrsta og síðasta mæling hvers þátttakanda (að minnsta kosti 14 dagar á milli). Aðeins þeir sem voru mældir tvisvar eru taldir með.</li>
          <li><b>Marktækt</b> (*) þýðir að ólíklegt er að breytingin sé tilviljun (p &lt; 0,05, Wilcoxon-próf á pöruðum mælingum). 95% öryggisbil á við meðalbreytinguna.</li>
          <li>Þeir sem mælast hátt í fyrstu mælingu mælast oft lægra næst, óháð inngripi (aðhvarf að meðaltali). Samanburðarhópur er ekki til staðar og því er ekki hægt að fullyrða að breytingarnar séu þjónustunni einni að þakka.</li>
          <li>Skýrslan inniheldur eingöngu samantekin gögn; engar upplýsingar um einstaka þátttakendur.</li>
        </ul>
      </div>`;
  }

  const sub = `Fyrir og eftir${input.exportedAt ? ` · ${monthIs(input.exportedAt)}` : ""}`;
  return `<!doctype html><html lang="is"><head><meta charset="utf-8"/>
<title>${esc(input.cohortName)} — fyrir og eftir</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page{size:A4;margin:0}
  *{box-sizing:border-box}
  body{margin:0;background:#E5E7EB;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:${C.ink};-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .a4{width:210mm;height:297mm;margin:10mm auto;background:#fff;padding:12mm 14mm 10mm;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12)}
  .top{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:3.5mm;margin-bottom:5mm;border-bottom:.6mm solid #059669}
  .top img{height:8mm}
  .org{text-align:right;display:flex;flex-direction:column;font-size:8pt;color:${C.muted}}
  .org b{font-size:9.5pt;color:#047857}
  .hero{border-radius:4mm;padding:5mm 8mm;color:#fff;background:linear-gradient(120deg,#047857,#10B981)}
  .hero .eyebrow{font-size:8pt;letter-spacing:.12em;text-transform:uppercase;opacity:.85}
  .hero h1{margin:1mm 0 1.5mm;font-size:19pt;line-height:1.15}
  .hero p{margin:0;font-size:9.5pt;opacity:.95;line-height:1.45}
  h2{font-size:11pt;margin:4.5mm 0 1.5mm}
  .lead{margin:0 0 2.5mm;font-size:8pt;color:${C.muted};line-height:1.45}
  .findings{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
  .finding{border-radius:3mm;padding:3.5mm 4mm;background:#F3F4F6;border-left:1mm solid ${C.neutral}}
  .finding.good{background:#ECFDF5;border-left-color:${C.brand}}
  .ft{font-weight:700;font-size:9pt;margin-bottom:1mm}
  .fb{font-size:8.5pt;line-height:1.45}
  .mgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:2.5mm}
  .mcard{border:1px solid ${C.faint};border-radius:3mm;padding:3mm 4mm}
  .mlabel{font-size:8.5pt;font-weight:600}
  .mvals{display:flex;align-items:baseline;gap:2mm;margin-top:1mm}
  .before{font-size:13pt;color:${C.muted}}.arrow{color:${C.muted}}.after{font-size:15pt;font-weight:700}.munit{font-size:8pt;color:${C.muted}}
  .mfoot{display:flex;justify-content:space-between;align-items:center;margin-top:1mm}
  .delta{font-weight:700;font-size:9.5pt}
  .badge{font-size:7pt;border:1px solid;border-radius:10px;padding:.4mm 2mm}
  .mn{font-size:7pt;color:${C.muted};margin-top:1mm}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:7mm}
  .chart-title{font-size:9pt;font-weight:600;margin-bottom:1.5mm}.unit{font-weight:400;color:${C.muted};font-size:7.5pt}
  table{width:100%;border-collapse:collapse;font-size:7.8pt}
  th{text-align:left;font-weight:600;color:${C.muted};border-bottom:1px solid ${C.faint};padding:1.2mm 1mm}
  td{border-bottom:1px solid #F3F4F6;padding:1.2mm 1mm}
  .n{text-align:right;white-space:nowrap}
  .method{margin-top:auto;background:#F9FAFB;border-radius:3mm;padding:3.5mm 5mm;font-size:7.8pt;line-height:1.45}
  .method ul{margin:1mm 0 0;padding-left:4mm}.method li{margin:.6mm 0}
  .foot{margin-top:4mm;padding-top:2.5mm;border-top:1px solid ${C.faint};display:flex;justify-content:space-between;font-size:7pt;color:${C.muted}}
  .printbtn{position:fixed;top:14px;right:14px;background:#059669;color:#fff;border:0;border-radius:8px;padding:10px 16px;font:600 13px Inter,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
  @media print{body{background:#fff}.a4{margin:0;box-shadow:none;break-after:page}.a4:last-of-type{break-after:auto}.printbtn{display:none}}
</style></head><body>
<button class="printbtn" onclick="window.print()">Prenta / vista PDF</button>
${page(p1, 1, input, sub)}
${p2 ? page(p2, 2, input, sub) : ""}
</body></html>`;
}
