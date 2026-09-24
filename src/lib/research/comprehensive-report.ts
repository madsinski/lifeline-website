// Comprehensive report — four A4 pages, Icelandic, print-to-PDF HTML.
// Lifestyle ("upstream": sleep, exercise, nutrition, mental wellbeing) and
// outcomes ("downstream": body, blood pressure, blood markers) together.
// Wording for the five areas comes from insight-areas.ts, shared with the
// Clinical overview cards. Aggregate-only.

import type { CohortInsights, MatrixCell } from "./lifestyle";
import { HABIT_PILLAR_LABEL } from "./lifestyle";
import { buildInsightAreas, type InsightArea } from "./insight-areas";

const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const monthIs = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const span = (r: [string, string] | null) => {
  if (!r) return "";
  const a = new Date(r[0]), b = new Date(r[1]);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return monthIs(a);
  return a.getFullYear() === b.getFullYear() ? `${MONTHS[a.getMonth()]}–${MONTHS[b.getMonth()]} ${b.getFullYear()}` : `${monthIs(a)} – ${monthIs(b)}`;
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (x: number, d = 1) => x.toLocaleString("is-IS", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const C = { ink: "#1F2937", muted: "#6B7280", faint: "#E5E7EB", brand: "#10B981", dark: "#047857", warn: "#F59E0B", bad: "#C2410C" };
const toneCol = { good: C.dark, warn: "#B45309", bad: C.bad } as const;

function factBars(facts: { label: string; n: number; of: number }[]): string {
  return facts.map((f) => {
    const p = pct(f.n, f.of);
    return `<div class="fact"><div class="fl"><span>${esc(f.label)}</span><b>${p}%</b></div><div class="fb"><i style="width:${Math.max(p, 2)}%"></i></div></div>`;
  }).join("");
}

function pillarChart(ins: CohortInsights): string {
  const rows = ins.pillars.filter((p) => p.mean !== null);
  const W = 520, rowH = 24, labelW = 150;
  const bw = W - labelW - 92;
  return `<svg viewBox="0 0 ${W} ${rows.length * rowH}" width="100%" role="img" aria-label="Stoðir lífsstíls">${rows.map((p, i) => {
    const y = i * rowH, v = p.mean!;
    const col = v >= 7 ? C.brand : v >= 5 ? C.warn : C.bad;
    return `<text x="0" y="${y + 11}" font-size="10" font-weight="600" fill="${C.ink}">${esc(p.label)}</text>
      <text x="0" y="${y + 21}" font-size="7.5" fill="${C.muted}">${esc(p.sub)}</text>
      <rect x="${labelW}" y="${y + 5}" width="${bw}" height="12" rx="3" fill="#F3F4F6"/>
      <line x1="${labelW + bw * 0.6}" y1="${y + 2}" x2="${labelW + bw * 0.6}" y2="${y + 20}" stroke="${C.muted}" stroke-dasharray="2 2" stroke-width=".8"/>
      <rect x="${labelW}" y="${y + 5}" width="${(bw * v) / 10}" height="12" rx="3" fill="${col}"/>
      <text x="${W}" y="${y + 14.5}" font-size="10.5" font-weight="700" text-anchor="end" fill="${C.ink}">${num(v)}</text>
      <text x="${W - 34}" y="${y + 14.5}" font-size="7.5" text-anchor="end" fill="${C.muted}">${pct(p.below6, p.n)}% &lt;6</text>`;
  }).join("")}</svg>`;
}

function heatmap(ins: CohortInsights): string {
  const m = ins.matrix;
  const cell = (c: MatrixCell | null) => {
    if (!c) return `<td class="hm na">–</td>`;
    const healthy = c.rho < 0, sig = c.p < 0.05, a = Math.min(1, Math.abs(c.rho) / 0.5);
    const bg = healthy ? `rgba(16,185,129,${sig ? 0.25 + 0.6 * a : 0.08 + 0.15 * a})` : `rgba(245,158,11,${sig ? 0.25 + 0.6 * a : 0.08 + 0.15 * a})`;
    return `<td class="hm" style="background:${bg};font-weight:${sig ? 700 : 400}">${c.rho > 0 ? "+" : "−"}${num(Math.abs(c.rho), 2)}${sig ? "*" : ""}</td>`;
  };
  return `<table class="heat"><thead><tr><th></th>${m.cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>
    ${m.rows.map((r, i) => `<tr><th class="rl">${esc(r.label)}</th>${m.cells[i].map(cell).join("")}</tr>`).join("")}</tbody></table>`;
}

function surveySection(ins: CohortInsights): string {
  const s = ins.survey;
  if (!s) return `<div class="note">Engin eftirfylgnikönnun er tengd hópnum. Upplifun þátttakenda af breytingum á lífsstíl er ekki mæld.</div>`;
  if (!s.enough) return `<div class="note"><b>Svör berast.</b> Eftirfylgnikönnunin „${esc(s.title)}“ var send ${s.sent} þátttakendum og ${s.completed} hafa svarað. Niðurstöður birtast hér þegar að minnsta kosti 5 hafa svarað, svo ekki sé hægt að rekja svör til einstaklinga.</div>`;
  const cols = ["#047857", "#34D399", "#D1D5DB", "#FB923C", "#C2410C"];
  const bars = s.change.map((c) => `<div class="sv"><span class="svl">${esc(c.label)}</span><div class="svb">${c.dist.map((d, i) => d ? `<i style="width:${(d / c.n) * 100}%;background:${cols[i]};color:${i === 1 || i === 2 ? "#1F2937" : "#fff"}" title="${esc(c.optionLabels[i])}: ${d}">${(d / c.n) >= 0.1 ? Math.round((d / c.n) * 100) + "%" : ""}</i>` : "").join("")}</div><b>${Math.round(c.better * 100)}%</b></div>`).join("");
  const legend = (s.change[0]?.optionLabels ?? []).map((l, i) => `<span><i style="background:${cols[i]}"></i>${esc(l)}</span>`).join("");
  return `<p class="lead">${s.completed} af ${s.sent} svöruðu. Hlutfall sem segir hvert svið hafa batnað síðan í heilsufarsskoðuninni (hægri dálkur = betri).</p>
    <div class="legend">${legend}</div>${bars}
    <div class="two" style="margin-top:4mm">
      ${s.lifeline ? `<div class="card"><div class="big">${Math.round(s.lifeline.top2 * 100)}%</div><p>telja Lifeline hafa átt mikinn eða mjög mikinn þátt í breytingunum (${s.lifeline.n} svör).</p></div>` : ""}
      ${s.nps !== null ? `<div class="card"><div class="big">${s.nps > 0 ? "+" : ""}${s.nps}</div><p>meðmælaskor (NPS, á kvarðanum −100 til +100).</p></div>` : ""}
    </div>
    ${s.madeChanges.length ? `<h3>Breytingar sem þátttakendur segjast hafa gert</h3>${factBars(s.madeChanges)}` : ""}`;
}

const HC_LABEL: Record<string, string> = { exercise: "Hreyfivenjur", nutrition: "Matarvenjur", sleep: "Svefnvenjur", mental: "Streitueinkunn" };
function habitChangeTable(ins: CohortInsights): string {
  const hc = ins.habitChange ?? {};
  const keys = ["exercise", "nutrition", "sleep", "mental"].filter((k) => hc[k]?.length);
  if (!keys.length) return "";
  const cell = (v: { delta: number; p: number | null } | null, unit: string) => {
    if (!v) return "<td class=\"n\">–</td>";
    const sig = v.p !== null && v.p < 0.05;
    return `<td class="n" style="font-weight:${sig ? 700 : 400};color:${sig ? (v.delta < 0 ? C.dark : C.bad) : C.ink}">${v.delta > 0 ? "+" : v.delta < 0 ? "−" : ""}${num(Math.abs(v.delta))} ${unit}${sig ? "*" : ""}</td>`;
  };
  return `<h2>Mæld breyting eftir lífsstíl við upphaf</h2>
    <p class="lead">Lífsstíll var aðeins metinn við heilsufarsskoðun. Hér er mæld breyting á blóðþrýstingi og þyngd borin saman eftir því hvort einkunn á hverju sviði var undir 6 eða 6 og hærri við upphaf. Könnunarleg greining: hóparnir byrjuðu ekki á sama blóðþrýstingi og margir samanburðir auka líkur á tilviljun. * = p &lt; 0,05.</p>
    <table class="tbl"><thead><tr><th>Svið og hópur</th><th class="n">Fjöldi</th><th class="n">BÞ við upphaf</th><th class="n">Breyting BÞ</th><th class="n">Breyting þyngdar</th></tr></thead><tbody>
    ${keys.flatMap((k) => hc[k].map((g) => `<tr><td>${esc(HC_LABEL[k])}: ${esc(g.label.toLowerCase())}</td><td class="n">${g.n}</td><td class="n">${g.sbp ? num(g.sbp.baseline, 0) + " mmHg" : "–"}</td>${cell(g.sbp, "mmHg")}${cell(g.weight, "kg")}</tr>`)).join("")}
    </tbody></table>`;
}

function page(inner: string, n: number, total: number, cohort: string, sub: string, logo: string): string {
  return `<section class="a4"><header class="top"><img src="${esc(logo)}" alt="Lifeline Health"/><div class="org"><b>${esc(cohort)}</b><span>${esc(sub)}</span></div></header>
    ${inner}<footer class="foot"><span>Samantekin gögn; engar upplýsingar um einstaka þátttakendur.</span><span>lifelinehealth.is · ${n}/${total}</span></footer></section>`;
}

export function buildComprehensiveReport(ins: CohortInsights, logoUrl: string, methodsVersion: string): string {
  const r = ins.result;
  const areas = buildInsightAreas(ins);
  const A = (k: InsightArea["key"]) => areas.find((a) => a.key === k)!;
  const months = r.medianDays ? Math.round(r.medianDays / 30.4) : null;
  const sub = `Heildarskýrsla · ${monthIs(new Date())}`;

  const p1 = `
    <div class="hero"><div><div class="eyebrow">Heilsuverkefni Lifeline Health</div><h1>Lífsstíll, heilsa og breytingar</h1>
      <p>Heilsufarsskoðun ${esc(span(r.baselineRange))}${r.followupRange ? ` · endurmæling ${esc(span(r.followupRange))}` : ""}. Skýrslan skoðar bæði daglegar venjur (svefn, hreyfingu, næringu og andlega líðan) og mælanlega heilsu (líkamsmælingar, blóðþrýsting og blóðgildi).</p></div>
      <div class="kpis"><div class="kpi"><b>${r.nPatients}</b><span>þátttakendur</span></div><div class="kpi"><b>${pct(r.nFollowed, r.nPatients)}%</b><span>endurmældir</span></div>${months ? `<div class="kpi"><b>${months}</b><span>mánuðir á milli</span></div>` : ""}</div></div>
    <h2>Helstu niðurstöður eftir sviðum</h2>
    <div class="areas">${areas.map((a) => `<div class="area"><div class="at">${esc(a.title)}</div><div class="as" style="color:${toneCol[a.scoreTone]}">${esc(a.scoreLabel)}</div><div class="ac">${esc(a.scoreCaption)}</div><p>${esc(a.headline)}</p></div>`).join("")}</div>
    <h2>Stoðir lífsstíls við heilsufarsskoðun</h2>
    <p class="lead">Meðaleinkunn hópsins á kvarðanum 0–10 þar sem 10 er best. Brotalínan markar einkunnina 6; einkunn undir henni bendir til að huga þurfi að þættinum. Hægra megin er hlutfall þátttakenda með einkunn undir 6.</p>
    ${pillarChart(ins)}`;

  const pillars: InsightArea["key"][] = ["exercise", "nutrition", "sleep", "mental"];
  const subst = ins.habits.filter((h) => h.pillar === "substances");
  const p2 = `
    <h2 style="margin-top:0">Lífsstíll við heilsufarsskoðun</h2>
    <p class="lead">Hlutfall af þeim ${ins.habits[0]?.of ?? "–"} sem svöruðu heilsumatinu.</p>
    <div class="grid2">${pillars.map((k) => {
      const a = A(k);
      const subs = a.subScores.length ? `<div class="subs">${a.subScores.map((sc) => `<span>${esc(sc.label.split(" (")[0])} <b style="color:${sc.mean >= 7 ? C.dark : sc.mean >= 5 ? "#B45309" : C.bad}">${num(sc.mean)}</b></span>`).join("")}</div>` : "";
      return `<div class="pill"><div class="ph"><span>${esc(a.title)}</span><b style="color:${toneCol[a.scoreTone]}">${esc(a.scoreLabel)}</b></div>${subs}${a.factGroups.map((g) => factBars(g.facts)).join("")}</div>`;
    }).join("")}</div>
    ${subst.length ? `<div class="pill" style="margin-top:4mm"><div class="ph"><span>${esc(HABIT_PILLAR_LABEL.substances)}</span></div><div class="grid3">${factBars(subst)}</div></div>` : ""}`;

  const links = areas.flatMap((a) => a.links.map((l) => l)).filter((l, i, arr) => arr.findIndex((x) => x.text === l.text) === i);
  const body = A("body");
  const p3 = `
    <h2 style="margin-top:0">Tengsl lífsstíls og áhættu</h2>
    <p class="lead">Fylgni (Spearman) milli venja og áhættuþátta við heilsufarsskoðun, leiðrétt fyrir aldri. Grænt: betri venjur tengjast lægri áhættu. Gult: öfugt samband. Dökkur litur og * merkja tölfræðilega marktæk tengsl (p &lt; 0,05). Tengsl sýna ekki orsök.</p>
    ${heatmap(ins)}
    <ul class="links">${links.map((l) => `<li class="${l.expected ? "" : "unexp"}">${esc(l.text)}</li>`).join("")}</ul>
    <h2>Líkami og áhætta</h2>
    <div class="two"><div>${body.factGroups.filter((g) => g.title === "Við heilsufarsskoðun").map((g) => factBars(g.facts)).join("")}</div>
      <div>${body.change.map((c) => `<div class="card"><div class="cl">${esc(c.label)}</div><div class="big" style="color:${c.tone === "good" ? C.dark : c.tone === "bad" ? C.bad : C.ink}">${esc(c.value)}</div>${c.note ? `<p>${esc(c.note)}</p>` : ""}</div>`).join("")}</div></div>
    ${habitChangeTable(ins)}`;

  const reMeasured = new Set(r.metrics.map((m) => m.feature));
  const steps: string[] = [];
  steps.push(reMeasured.has("hba1c") ? "<b>Endurmæling eftir 12 mánuði</b> til að staðfesta hvort árangurinn helst." : "<b>Endurmæling eftir 12 mánuði með blóðprufum og heilsumati</b>. Í eftirfylgninni voru aðeins þyngd og blóðþrýstingur mæld. Endurtekið heilsumat sýnir hvort venjur hafa í raun breyst.");
  const weakest = [...ins.pillars].filter((p) => ["sleep", "exercise", "nutrition"].includes(p.key)).sort((a, b) => (a.mean ?? 99) - (b.mean ?? 99))[0];
  if (weakest) steps.push(`<b>Setja ${esc(weakest.label.toLowerCase())} í forgang</b>: veikasta stoð hópsins (${num(weakest.mean!)} af 10).`);
  if (r.subgroups.some((s) => s.key === "bp_high")) steps.push("<b>Áframhaldandi eftirfylgni</b> með þeim sem mældust með háþrýsting, þar sem árangurinn var mestur.");
  const sleepy = ins.habits.find((h) => h.label.includes("úthvíld"));
  if (sleepy && pct(sleepy.n, sleepy.of) >= 50) steps.push(`<b>Fræðsla um svefn</b>: ${pct(sleepy.n, sleepy.of)}% vakna ekki úthvíld flesta daga.`);
  const p4 = `
    <h2 style="margin-top:0">Upplifun þátttakenda af breytingum</h2>
    ${surveySection(ins)}
    <h2>Næstu skref</h2><div class="steps"><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol></div>
    <div class="method"><div class="mt">Aðferð</div><ul>
      <li>Lífsstíll byggir á heilsumati Lifeline Health við heilsufarsskoðun; einkunnir á kvarðanum 0–10 þar sem 10 er best.</li>
      <li>Áhættuþættir miðast við viðurkennd klínísk mörk sem tilgreind eru við hvern þátt.</li>
      <li>Breytingar: fyrsta og síðasta mæling hvers þátttakanda bornar saman (að minnsta kosti 14 dagar á milli); Wilcoxon-próf.</li>
      <li>Upplifun þátttakenda kemur úr eftirfylgnikönnun og er aðeins birt þegar að minnsta kosti 5 hafa svarað.</li>
      <li>Samanburðarhópur er ekki til staðar og því er ekki hægt að fullyrða að breytingar séu þjónustunni einni að þakka. Aðferð ${esc(methodsVersion)}.</li>
    </ul></div>`;

  const pages = [p1, p2, p3, p4];
  return `<!doctype html><html lang="is"><head><meta charset="utf-8"/><title>${esc(ins.cohortName)} — heildarskýrsla</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page{size:A4;margin:0}*{box-sizing:border-box}
  body{margin:0;background:#E5E7EB;font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .a4{width:210mm;height:297mm;margin:10mm auto;background:#fff;padding:11mm 13mm 9mm;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12)}
  .top{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:3mm;margin-bottom:4.5mm;border-bottom:.6mm solid #059669}
  .top img{height:7.5mm}.org{text-align:right;font-size:8pt;color:${C.muted};display:flex;flex-direction:column}.org b{color:${C.dark};font-size:9.5pt}
  .hero{border-radius:4mm;padding:5mm 7mm;color:#fff;background:linear-gradient(120deg,#047857,#10B981);display:flex;gap:6mm;align-items:center;justify-content:space-between}
  .eyebrow{font-size:7.5pt;letter-spacing:.12em;text-transform:uppercase;opacity:.85}.hero h1{margin:1mm 0 1.5mm;font-size:18pt}.hero p{margin:0;font-size:8.8pt;line-height:1.45;opacity:.95}
  .kpis{display:flex;gap:4mm}.kpi{text-align:center;min-width:19mm}.kpi b{display:block;font-size:19pt;font-weight:800;line-height:1}.kpi span{font-size:7pt;opacity:.9}
  h2{font-size:11.5pt;margin:5mm 0 1.5mm}h3{font-size:9.5pt;margin:4mm 0 1.5mm}.lead{font-size:8pt;color:${C.muted};margin:0 0 2.5mm;line-height:1.45}
  .areas{display:grid;grid-template-columns:repeat(5,1fr);gap:2.5mm}
  .area{border:1px solid ${C.faint};border-radius:3mm;padding:3mm}.at{font-size:8.5pt;font-weight:700}.as{font-size:14pt;font-weight:800;margin-top:1mm}.ac{font-size:6.8pt;color:${C.muted}}.area p{font-size:7.4pt;line-height:1.4;margin:1.5mm 0 0}
  .fact{margin-bottom:2mm}.fl{display:flex;justify-content:space-between;gap:2mm;font-size:8.2pt}.fl b{white-space:nowrap}.fb{height:2.2mm;background:#F3F4F6;border-radius:1mm;margin-top:.6mm}.fb i{display:block;height:100%;background:${C.brand};border-radius:1mm}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:0 5mm}
  .pill{border:1px solid ${C.faint};border-radius:3mm;padding:3.5mm 4mm}.ph{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2.5mm}.ph span{font-weight:700;font-size:10pt}.ph b{font-size:11pt}
  .heat{width:100%;border-collapse:separate;border-spacing:1.2mm;font-size:8.5pt}.heat th{font-size:7.8pt;font-weight:600;color:${C.muted};text-align:center}.heat th.rl{text-align:left;color:${C.ink}}
  .hm{text-align:center;padding:1.5mm 0;border-radius:1.5mm}.hm.na{color:${C.muted}}
  .links{margin:1.5mm 0 0;padding-left:4.5mm;font-size:8pt;line-height:1.4}.links li.unexp{color:#92400E}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:5mm}
  .subs{display:flex;flex-wrap:wrap;gap:1mm 4mm;font-size:7.6pt;color:${C.muted};margin:-1mm 0 2.5mm}.subs b{font-size:8.5pt}
  .tbl{width:100%;border-collapse:collapse;font-size:8pt}.tbl th{text-align:left;font-weight:600;color:${C.muted};border-bottom:1px solid ${C.faint};padding:1.2mm 1mm}.tbl td{border-bottom:1px solid #F3F4F6;padding:1.2mm 1mm}.tbl .n{text-align:right;white-space:nowrap}
  .card{border:1px solid ${C.faint};border-radius:3mm;padding:2.5mm 3.5mm;margin-bottom:2.5mm;font-size:8pt}.card p{margin:.8mm 0 0;color:${C.muted};line-height:1.4}.cl{font-size:7.8pt;color:${C.muted}}.big{font-size:14pt;font-weight:800;color:${C.dark}}
  .note{background:#F9FAFB;border:1px dashed #D1D5DB;border-radius:3mm;padding:4mm 5mm;font-size:8.8pt;line-height:1.5}
  .legend{display:flex;gap:3mm;font-size:7pt;color:${C.muted};margin-bottom:2mm}.legend i{display:inline-block;width:2.5mm;height:2.5mm;border-radius:.5mm;margin-right:1mm;vertical-align:middle}
  .sv{display:grid;grid-template-columns:28mm 1fr 12mm;align-items:center;gap:2mm;margin-bottom:1.8mm;font-size:8.2pt}.svb{display:flex;height:5mm;gap:.4mm}.svb i{display:flex;align-items:center;justify-content:center;font-style:normal;font-size:6.5pt;color:#fff;font-weight:600}.sv b{text-align:right}
  .steps{background:#F0FDF4;border-radius:3mm;padding:3.5mm 5mm}.steps ol{margin:0;padding-left:4.5mm;font-size:8.4pt;line-height:1.5}.steps li{margin-bottom:1.2mm}
  .method{margin-top:auto;background:#F9FAFB;border-radius:3mm;padding:3.5mm 5mm;font-size:7.6pt;line-height:1.45}.mt{font-weight:700;font-size:8.5pt}.method ul{margin:1mm 0 0;padding-left:4mm}
  .foot{margin-top:auto;padding-top:2.5mm;border-top:1px solid ${C.faint};display:flex;justify-content:space-between;font-size:6.8pt;color:${C.muted}}
  .method + .foot{margin-top:4mm}
  .printbtn{position:fixed;top:14px;right:14px;background:#059669;color:#fff;border:0;border-radius:8px;padding:10px 16px;font:600 13px Inter,sans-serif;cursor:pointer}
  @media print{body{background:#fff}.a4{margin:0;box-shadow:none;break-after:page}.a4:last-of-type{break-after:auto}.printbtn{display:none}}
</style></head><body>
<button class="printbtn" onclick="window.print()">Prenta / vista PDF</button>
${pages.map((p, i) => page(p, i + 1, pages.length, ins.cohortName, sub, logoUrl)).join("\n")}
</body></html>`;
}
