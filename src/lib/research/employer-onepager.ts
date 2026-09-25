// Employer one-pager — a single A4 page in Icelandic for the employer
// (e.g. a municipality): participation, what the health check found
// (baseline prevalence against standard clinical thresholds), what changed
// by the follow-up, and suggested next steps. Aggregate-only; no subgroup
// smaller than MIN_GROUP is shown, and workplaces are never split out, so no
// individual can be singled out. Print-to-PDF HTML with inline SVG.

import type { BeforeAfterResult, MetricResult, ProfileItem } from "./before-after";
import type { HabitShift } from "./lifestyle";

export interface EmployerOnePagerInput {
  cohortName: string;
  logoUrl: string;
  result: BeforeAfterResult;
  profile: ProfileItem[];
  habitShift?: HabitShift[];
  generatedAt?: Date;
}

const MIN_GROUP = 5;
const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const monthIs = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const span = (r: [string, string] | null) => {
  if (!r) return "";
  const a = new Date(r[0]), b = new Date(r[1]);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return monthIs(a);
  return a.getFullYear() === b.getFullYear() ? `${MONTHS[a.getMonth()]}–${MONTHS[b.getMonth()]} ${b.getFullYear()}` : `${monthIs(a)} – ${monthIs(b)}`;
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (x: number, d = 0) => x.toLocaleString("is-IS", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

const C = { ink: "#1F2937", muted: "#6B7280", faint: "#E5E7EB", brand: "#10B981", dark: "#047857", light: "#A7F3D0", warn: "#C2410C" };

// Horizontal bars: share of participants over each threshold at baseline.
function profileChart(items: ProfileItem[]): string {
  const W = 360, rowH = 38, labelW = 188, valW = 50;
  const barW = W - labelW - valW;
  const h = items.length * rowH;
  const rows = items.map((it, i) => {
    const y = i * rowH;
    const p = pct(it.n, it.of);
    return `<text x="0" y="${y + 13}" font-size="10.5" font-weight="600" fill="${C.ink}">${esc(it.label)}</text>
      <text x="0" y="${y + 26}" font-size="8" fill="${C.muted}">${esc(it.threshold)}</text>
      <rect x="${labelW}" y="${y + 6}" width="${barW}" height="16" rx="4" fill="#F3F4F6"/>
      <rect x="${labelW}" y="${y + 6}" width="${Math.max((barW * p) / 100, 2)}" height="16" rx="4" fill="${C.brand}"><title>${esc(it.label)}: ${it.n} af ${it.of}</title></rect>
      <text x="${W}" y="${y + 17}" font-size="12.5" font-weight="700" text-anchor="end" fill="${C.ink}">${p}%</text>
      <text x="${W}" y="${y + 29}" font-size="8.5" text-anchor="end" fill="${C.muted}">${it.n} af ${it.of}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${h}" width="100%" role="img" aria-label="Upphafsstaða hópsins">${rows}</svg>`;
}


export function buildEmployerOnePager(input: EmployerOnePagerInput): string {
  const r = input.result;
  const gen = input.generatedAt ?? new Date();
  const months = r.medianDays ? Math.round(r.medianDays / 30.4) : null;
  const profile = input.profile.filter((p) => p.of >= MIN_GROUP);

  // ── "what changed" cards (data-driven, honest) ──
  const cards: string[] = [];
  const minor: string[] = [];
  const M = (f: string) => r.metrics.find((m) => m.feature === f);
  const LIFE: [string, string][] = [
    ["lifeline_health_nutrition_behavioural_score", "Matarvenjur"], ["lifeline_health_sleep_behaviour_score", "Svefnvenjur"],
    ["lifeline_health_exercise_behavioural_score", "Hreyfivenjur"], ["pwi", "Almenn vellíðan"], ["lifstilseinkunn", "Lífsstílseinkunn"],
  ];
  const lifeRows = LIFE.map(([f, label]) => ({ label, m: M(f) })).filter((x): x is { label: string; m: MetricResult } => !!x.m);
  if (lifeRows.some((x) => x.m.significant && x.m.good)) {
    cards.push(`<div class="card hl"><div class="ct">Lífsstíll batnaði mælanlega</div>
      <table class="lt">${lifeRows.map(({ label, m }) => `<tr><td>${esc(label)}</td><td class="bar"><i style="width:${m.before * 10}%;background:#D1D5DB"></i><i style="width:${m.after * 10}%"></i></td><td class="v"${m.significant && m.good ? ` style="color:${C.dark}"` : ""}>${num(m.before, 1)} → <b>${num(m.after, 1)}</b>${m.significant ? "*" : ""}</td></tr>`).join("")}</table>
      <p class="fn">Einkunn af 10 hjá sömu ${Math.max(...lifeRows.map((x) => x.m.n))} einstaklingum í fyrra og seinna heilsumati. * tölfræðilega marktækt.</p></div>`);
  }
  const shifts = (input.habitShift ?? []).filter((h) => h.p < 0.05 && h.after < h.before).sort((a, b) => a.p - b.p).slice(0, 3);
  if (shifts.length) {
    cards.push(`<div class="card"><div class="ct">Venjur sem breyttust</div>
      ${shifts.map((h) => `<div class="hs"><span>${esc(h.label.charAt(0).toUpperCase() + h.label.slice(1))}</span><b>${pct(h.before, h.of)}% → ${pct(h.after, h.of)}%</b></div>`).join("")}
      <p class="fn">Hlutfall þátttakenda; allar breytingarnar eru tölfræðilega marktækar.</p></div>`);
  }
  const fp = M("fat_mass_percent"), mm = M("skeletal_muscle_mass_kg");
  if (fp?.significant && fp.good) minor.push(`<div class="card"><div class="ct">Líkamssamsetning</div><div class="big sm">${num(fp.before, 1)}% → ${num(fp.after, 1)}%</div><p>Fituhlutfall lækkaði${mm?.significant && mm.good ? ` og vöðvamassi jókst um ${num(mm.delta, 1)} kg` : ""}.</p></div>`);
  const bpHigh = r.subgroups.find((s) => s.key === "bp_high" && s.n >= MIN_GROUP);
  const bpSys = bpHigh?.metrics.find((m) => m.feature === "bp_systolic_avg");
  if (bpHigh && bpSys?.significant && bpSys.good) minor.push(`<div class="card"><div class="ct">Þau sem voru með háþrýsting</div><div class="big sm">${num(bpSys.before)} → ${num(bpSys.after)}</div><p>efri mörk blóðþrýstings (mmHg) hjá þeim ${bpHigh.n} sem mældust með háþrýsting.</p></div>`);
  const w = M("weight");
  minor.push(`<div class="card muted"><p>${w && !w.significant && fp?.significant && fp.good
    ? "Meðalþyngd hópsins breyttist lítið, en samsetningin batnaði: fita vék fyrir vöðvum. Þess vegna segir þyngd ein og sér ekki alla söguna."
    : "Að meðaltali var lítil breyting á þyngd og blóðþrýstingi hópsins í heild. Árangurinn var mestur hjá þeim sem voru í mestri áhættu."}</p></div>`);

  // ── next steps (data-driven) ──
  const steps: string[] = [];
  const reMeasured = new Set(r.metrics.map((m) => m.feature));
  if (!reMeasured.has("hba1c") && !reMeasured.has("homa_ir")) {
    steps.push("<b>Endurmæling með blóðprufum</b> eftir 12 mánuði. Í eftirfylgninni voru ekki teknar blóðprufur; þær sýna hvort bættar venjur skili sér í blóðsykri, insúlínviðnámi og blóðfitum.");
  } else {
    steps.push("<b>Endurmæling eftir 12 mánuði</b> til að staðfesta hvort árangurinn helst.");
  }
  if (bpHigh) steps.push("<b>Áframhaldandi eftirfylgni</b> með þeim sem mældust með háþrýsting, þar sem árangurinn var mestur.");
  const top = [...profile].filter((p) => p.key !== "overweight").sort((a, b) => b.n / b.of - a.n / a.of)[0];
  if (top) steps.push(`<b>Markviss fræðsla og stuðningur</b> þar sem þörfin er mest: ${esc(top.label.toLowerCase())} (${pct(top.n, top.of)}% þátttakenda).`);
  if (r.nPatients && r.nFollowed / r.nPatients < 0.9) steps.push(`<b>Hvetja fleiri til endurmælingar</b>: ${r.nPatients - r.nFollowed} af ${r.nPatients} mættu ekki í endurmælingu.`);

  const followPct = pct(r.nFollowed, r.nPatients);

  return `<!doctype html><html lang="is"><head><meta charset="utf-8"/>
<title>${esc(input.cohortName)} — samantekt fyrir vinnuveitanda</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page{size:A4;margin:0}
  *{box-sizing:border-box}
  body{margin:0;background:#E5E7EB;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:${C.ink};-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .a4{width:210mm;height:297mm;margin:10mm auto;background:#fff;padding:11mm 13mm 9mm;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12)}
  .top{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:3mm;margin-bottom:4mm;border-bottom:.6mm solid #059669}
  .top img{height:7.5mm}.org{text-align:right;font-size:8pt;color:${C.muted};display:flex;flex-direction:column}.org b{color:${C.dark};font-size:9.5pt}
  .hero{border-radius:4mm;padding:4mm 7mm;color:#fff;background:linear-gradient(120deg,#047857,#10B981);display:flex;justify-content:space-between;gap:6mm;align-items:center}
  .hero h1{margin:0;font-size:18pt;line-height:1.15}.hero p{margin:1.5mm 0 0;font-size:9pt;opacity:.92;line-height:1.4}
  .kpis{display:flex;gap:5mm}.kpi{text-align:center;min-width:22mm}.kpi b{display:block;font-size:20pt;font-weight:800;line-height:1}.kpi span{font-size:7pt;opacity:.9}
  h2{font-size:11pt;margin:4.5mm 0 1mm}.lead{font-size:7.8pt;color:${C.muted};margin:0 0 2.5mm;line-height:1.4}
  .grid{display:grid;grid-template-columns:1.05fr 1fr;gap:7mm}
  .card{border:1px solid ${C.faint};border-radius:3mm;padding:3mm 4mm;font-size:8.3pt;line-height:1.4}
  .card p{margin:1mm 0 0}.card.hl{border-color:#A7F3D0;background:#ECFDF5}.card.muted{background:#F9FAFB}
  .ct{font-weight:700;font-size:9pt}.big{font-size:17pt;font-weight:800;color:${C.dark};line-height:1.05}.big small{font-size:8.5pt;font-weight:600;color:${C.muted}}
  .pair{display:grid;grid-template-columns:38mm 1fr;gap:3mm;align-items:center;margin-top:1mm}
  .tag{display:inline-block;margin-top:1.5mm;font-size:6.8pt;font-weight:600;color:${C.dark};border:1px solid ${C.brand};border-radius:10px;padding:.3mm 2mm}
  .stack{display:flex;flex-direction:column;gap:2.5mm}
  .lt{width:100%;border-collapse:collapse;margin-top:1.5mm;font-size:8.2pt}.lt td{padding:.8mm 0}.lt td.v{text-align:right;white-space:nowrap;padding-left:2mm}
  .lt td.bar{width:34%;padding:0 2mm}.lt td.bar i{display:block;height:1.6mm;border-radius:1mm;background:${C.brand};margin:.4mm 0}
  .big.sm{font-size:13pt;white-space:nowrap}.fn{font-size:6.8pt;color:${C.muted};margin-top:1.2mm}.hs{display:flex;justify-content:space-between;gap:3mm;font-size:8.2pt;padding:.7mm 0;border-bottom:1px solid #F3F4F6}.hs b{white-space:nowrap;color:${C.dark}}.row2{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm}
  ol{margin:0;padding-left:4.5mm;font-size:8.3pt;line-height:1.45}ol li{margin:0 0 1.3mm}
  .steps{background:#F0FDF4;border-radius:3mm;padding:3mm 5mm}
  .foot{margin-top:auto;padding-top:2.5mm;border-top:1px solid ${C.faint};font-size:6.8pt;color:${C.muted};line-height:1.45;display:flex;justify-content:space-between;gap:6mm}
  .printbtn{position:fixed;top:14px;right:14px;background:#059669;color:#fff;border:0;border-radius:8px;padding:10px 16px;font:600 13px Inter,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
  @media print{body{background:#fff}.a4{margin:0;box-shadow:none}.printbtn{display:none}}
</style></head><body>
<button class="printbtn" onclick="window.print()">Prenta / vista PDF</button>
<section class="a4">
  <header class="top"><img src="${esc(input.logoUrl)}" alt="Lifeline Health"/><div class="org"><b>${esc(input.cohortName)}</b><span>Samantekt fyrir vinnuveitanda · ${monthIs(gen)}</span></div></header>

  <div class="hero">
    <div><h1>Heilsuverkefni starfsfólks</h1>
      <p>Heilsufarsskoðun ${esc(span(r.baselineRange))}${r.followupRange ? ` · endurmæling ${esc(span(r.followupRange))}` : ""}.<br/>Hér eru eingöngu samantekin gögn. Engar upplýsingar koma fram um einstaka starfsmenn.</p></div>
    <div class="kpis">
      <div class="kpi"><b>${r.nPatients}</b><span>þátttakendur</span></div>
      <div class="kpi"><b>${followPct}%</b><span>mættu í endurmælingu</span></div>
      ${months ? `<div class="kpi"><b>${months}</b><span>mánuðir á milli</span></div>` : ""}
    </div>
  </div>

  <div class="grid">
    <div>
      <h2>Hvað kom í ljós í heilsufarsskoðuninni?</h2>
      <p class="lead">Hlutfall þátttakenda yfir viðurkenndum mörkum við fyrstu mælingu.</p>
      ${profileChart(profile)}
    </div>
    <div>
      <h2>Hvað breyttist?</h2>
      <p class="lead">Fyrsta mæling borin saman við endurmælingu hjá sömu einstaklingum (${r.nFollowed} manns).</p>
      <div class="stack">${cards.join("")}<div class="row2">${minor.slice(0, 2).join("")}</div>${minor.slice(2).join("")}</div>
    </div>
  </div>

  <h2>Næstu skref</h2>
  <div class="steps"><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol></div>

  <footer class="foot">
    <span>Samanburðarhópur er ekki til staðar og því er ekki hægt að fullyrða að allar breytingar séu þjónustunni að þakka. Þeir sem mælast hátt einu sinni mælast oft lægra næst. „Tölfræðilega marktækt“ merkir að ólíklegt er að breytingin sé tilviljun (p &lt; 0,05).</span>
    <span style="white-space:nowrap">Lifeline Health · lifelinehealth.is</span>
  </footer>
</section>
</body></html>`;
}
