// Comprehensive report — four A4 pages, Icelandic, print-to-PDF HTML.
// Lifestyle ("upstream": sleep, exercise, nutrition, mental wellbeing) and
// outcomes ("downstream": body, blood pressure, blood markers) together.
// Wording for the five areas comes from insight-areas.ts, shared with the
// Clinical overview cards. Aggregate-only.

import type { CohortInsights, MatrixCell } from "./lifestyle";
import { HABIT_PILLAR_LABEL, SUBSCORES } from "./lifestyle";
import { buildInsightAreas, buildContinuationCase, type InsightArea } from "./insight-areas";
import { featureDomain, isConditional } from "./clinical";
import type { MetricResult } from "./before-after";
import { sigLevel } from "./before-after";

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
const C = { ink: "#1F2937", muted: "#6B7280", faint: "#E5E7EB", brand: "#10B981", dark: "#047857", trend: "#059669", warn: "#F59E0B", bad: "#C2410C" };
// three-level colouring: significant (dark green / red), borderline improvement (green, †), else ink
const lvColor = (p: number | null | undefined, better: boolean) => { const lv = sigLevel(p); return lv === "sig" ? (better ? C.dark : C.bad) : lv === "trend" && better ? C.trend : C.ink; };
const lvMark = (p: number | null | undefined, better: boolean) => { const lv = sigLevel(p); return lv === "sig" ? "*" : lv === "trend" && better ? "†" : ""; };
const toneCol = { good: C.dark, warn: "#B45309", bad: C.bad } as const;

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
function factBars(facts: { label: string; n: number; of: number }[]): string {
  return facts.map((f) => {
    const p = pct(f.n, f.of);
    return `<div class="fact"><div class="fl"><span>${esc(cap(f.label))}</span><b>${p}%</b></div><div class="fb"><i style="width:${Math.max(p, 2)}%"></i></div></div>`;
  }).join("");
}

const PILLAR_FEATURE: Record<string, string> = {
  sleep: "lifeline_health_sleep_behaviour_score", exercise: "lifeline_health_exercise_behavioural_score", nutrition: "lifeline_health_nutrition_behavioural_score",
  mental: "lifeline_health_depression_score_1_10", stress: "lifeline_health_anxiety_score_1_10", wellbeing: "pwi", overall: "lifstilseinkunn",
};
function pillarChart(ins: CohortInsights): string {
  const rows = ins.pillars.filter((p) => p.mean !== null);
  const W = 520, rowH = 30, labelW = 150;
  const bw = W - labelW - 110;
  const col = (v: number) => (v >= 7 ? C.brand : v >= 5 ? C.warn : C.bad);
  return `<svg viewBox="0 0 ${W} ${rows.length * rowH}" width="100%" role="img" aria-label="Stoðir lífsstíls fyrir og eftir">${rows.map((p, i) => {
    const y = i * rowH, f = PILLAR_FEATURE[p.key];
    const m = ins.result.metrics.find((x) => x.feature === f);
    const excluded = ins.result.excluded?.some((e) => e.feature === f);
    const before = m ? m.before : p.mean!;
    const sig = m ? lvMark(m.p, m.good === true) : "";
    return `<text x="0" y="${y + 12}" font-size="10" font-weight="600" fill="${C.ink}">${esc(p.label)}</text>
      <text x="0" y="${y + 22}" font-size="7.5" fill="${C.muted}">${esc(p.sub)}</text>
      <line x1="${labelW + bw * 0.6}" y1="${y + 1}" x2="${labelW + bw * 0.6}" y2="${y + 26}" stroke="${C.muted}" stroke-dasharray="2 2" stroke-width=".8"/>
      <rect x="${labelW}" y="${y + 3}" width="${bw}" height="${m ? 9 : 12}" rx="2" fill="#F3F4F6"/>
      <rect x="${labelW}" y="${y + 3}" width="${(bw * before) / 10}" height="${m ? 9 : 12}" rx="2" fill="${m ? "#D1D5DB" : col(before)}"/>
      ${m ? `<rect x="${labelW}" y="${y + 14}" width="${bw}" height="9" rx="2" fill="#F3F4F6"/><rect x="${labelW}" y="${y + 14}" width="${(bw * m.after) / 10}" height="9" rx="2" fill="${col(m.after)}"/>` : ""}
      <text x="${W}" y="${y + 15}" font-size="10.5" font-weight="700" text-anchor="end" fill="${m ? lvColor(m.p, m.good === true) : C.ink}">${m ? `${num(m.before)} → ${num(m.after)}${sig}` : num(before)}</text>
      <text x="${W}" y="${y + 25}" font-size="7" text-anchor="end" fill="${C.muted}">${m ? `${m.n} manns${ins.result.gatedDropped?.some((g) => g.feature === f) ? " ‡" : ""}` : excluded ? "ekki borið saman" : "aðeins við upphaf"}</text>`;
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
  if (!s.enough) return `<div class="note"><b>Svör berast.</b> Eftirfylgnikönnunin „${esc(s.title)}“ hefur verið send út og svör hafa borist frá ${s.completed} af ${s.sent}. Niðurstöður birtast hér þegar að minnsta kosti fimm hafa svarað, svo ekki sé hægt að rekja svör til einstaklinga.</div>`;
  const cols = ["#047857", "#34D399", "#D1D5DB", "#FB923C", "#C2410C"];
  const bars = s.change.map((c) => `<div class="sv"><span class="svl">${esc(c.label)}</span><div class="svb">${c.dist.map((d, i) => d ? `<i style="width:${(d / c.n) * 100}%;background:${cols[i]};color:${i === 1 || i === 2 ? "#1F2937" : "#fff"}" title="${esc(c.optionLabels[i])}: ${d}">${(d / c.n) >= 0.1 ? Math.round((d / c.n) * 100) + "%" : ""}</i>` : "").join("")}</div><b>${Math.round(c.better * 100)}%</b></div>`).join("");
  const legend = (s.change[0]?.optionLabels ?? []).map((l, i) => `<span><i style="background:${cols[i]}"></i>${esc(l)}</span>`).join("");
  return `<p class="lead">Svör bárust frá ${s.completed} af ${s.sent}. Hægri dálkur sýnir hlutfall þeirra sem telja sviðið hafa batnað frá heilsufarsskoðun.</p>
    <div class="legend">${legend}</div>${bars}
    <div class="two" style="margin-top:4mm">
      ${s.lifeline ? `<div class="card"><div class="big">${Math.round(s.lifeline.top2 * 100)}%</div><p>telja Lifeline hafa átt mikinn eða mjög mikinn þátt í breytingunum (${s.lifeline.n} svör).</p></div>` : ""}
      ${s.nps !== null ? `<div class="card"><div class="big">${s.nps > 0 ? "+" : ""}${s.nps}</div><p>meðmælaskor (NPS, á kvarðanum −100 til +100).</p></div>` : ""}
    </div>
    ${s.madeChanges.some((m) => m.n > 0) ? `<h3>Breytingar sem þátttakendur segjast hafa gert</h3><div class="grid2" style="row-gap:0">${factBars(s.madeChanges.filter((m) => m.n > 0).slice(0, 6))}</div>` : ""}`;
}


// sub-score label → feature (to find its paired change)
const SUBSCORE_FEATURE: Record<string, string> = Object.fromEntries(
  Object.values(SUBSCORES).flat().map((d) => [d.label, d.feature]),
);
const dIs = (iso: string | null) => { if (!iso) return "–"; const d = new Date(iso); return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
function comparisonPage(ins: CohortInsights): string {
  const cmp = ins.comparison;
  if (!cmp || cmp.datasets.length < 2) return "";
  const cs = buildContinuationCase(ins);
  return `
    <h2 style="margin-top:0">Samanburður gagnasetta</h2>
    <div class="dsrow">${cmp.datasets.map((d, i) => `${i ? `<div class="dsarrow">→<span>${cmp.inBoth} mældir í báðum</span></div>` : ""}<div class="ds"><div class="dsl">${esc(d.label)}</div><div class="dsd">${dIs(d.from)} – ${dIs(d.to)}</div><div class="dsn"><b>${d.patients}</b> þátttakendur · <b>${d.variables}</b> breytur</div></div>`).join("")}</div>
    <h3>Hvað var mælt í hvoru gagnasetti</h3>
    <table class="tbl"><thead><tr><th>Svið</th>${cmp.datasets.map((d) => `<th class="c" style="white-space:nowrap">${esc(d.label)}</th>`).join("")}</tr></thead><tbody>
      ${cmp.coverage.map((c) => `<tr><td>${esc(c.label)}${c.names?.[0]?.length ? `<div style="font-size:6.8pt;color:${C.muted}">${esc(c.names[0].join(", "))}</div>` : ""}</td>${c.counts.map((n) => `<td class="c">${n ? `<span style="color:${C.dark};font-weight:700">✓</span> <span style="color:${C.muted}">${n}</span>` : `<span style="color:${C.muted}">ekki mælt</span>`}</td>`).join("")}</tr>`).join("")}
    </tbody></table>
    <h2>Af hverju að halda áfram?</h2>
    <div class="cases">${cs.map((c) => `<div class="case"><div class="ct">${esc(c.title)}</div><p>${esc(c.body)}</p></div>`).join("")}</div>`;
}

export function groupExcluded(ex: { label: string; reason: string }[]): { labels: string; reason: string }[] {
  const by = new Map<string, string[]>();
  for (const e of ex) by.set(e.reason, [...(by.get(e.reason) ?? []), e.label]);
  return [...by].map(([reason, ls]) => ({ reason, labels: cap(ls.length > 1 ? `${ls.slice(0, -1).join(", ")} og ${ls[ls.length - 1]}` : ls[0]) }));
}

const GROUPS: [string, string][] = [["body", "Líkamsmælingar og samsetning"], ["cardio", "Blóðþrýstingur"], ["nutrition", "Næring"], ["sleep", "Svefn"], ["exercise", "Hreyfing"], ["mental", "Andleg líðan"], ["other", "Heildarmat"], ["addiction", "Nikótín, áfengi og skjánotkun"], ["metabolic", "Blóðprufur"]];
// PDF grouping differs from the clinical domain for readability.
const PDF_GROUP: Record<string, string> = { lifeline_health_food_addiction_1_10: "nutrition" };
// Raw screening instruments (lower = better) are confusing next to the unified
// 0–10 scores (higher = better); the PDF shows the unified score only.
const PDF_SKIP = new Set(["fat_mass_kg", "skeletal_muscle_mass_percent", "lifeline_health_screen_use_cius_5", "lifeline_health_screen_use_cius_14", "lifeline_health_assist_other_substances", "lifeline_health_gambling_pgsi", "lifeline_health_audit_c", "lifeline_health_audit_10", "lifeline_health_beds_7"]);
function changesPage(ins: CohortInsights): string {
  const r = ins.result;
  if (!r.metrics.length) return "";
  const dec = (m: MetricResult) => (m.feature.startsWith("bp_") ? 0 : 1);
  const pTxt = (p: number | null) => (p === null ? "–" : p < 0.001 ? "&lt;0,001" : num(p, 3));
  const colr = (m: MetricResult) => lvColor(m.p, m.good === true);
  const gated = new Set((r.gatedDropped ?? []).map((g) => g.feature));
  const row = (m: MetricResult, extra = "") => `<tr${extra ? ' class="hl"' : ""}><td>${esc(cap(m.label))}${gated.has(m.feature) ? " ‡" : ""}${extra}</td><td class="n">${m.n}</td><td class="n" style="color:${colr(m)}">${num(m.before, dec(m))} → <b>${num(m.after, dec(m))}</b>${m.unit === "%" ? "%" : m.unit ? ` ${esc(m.unit)}` : ""}</td><td class="n">${m.improved}</td><td class="n">${m.worsened}</td><td class="n" style="font-weight:${m.significant ? 700 : 400};color:${colr(m)}">${pTxt(m.p)}${m.borderline && m.good ? " †" : ""}</td></tr>`;
  // concrete habit (same people, first vs latest Heilsumat): stopped = improved
  const habitRow = (h: NonNullable<CohortInsights["habitShift"]>[number], total: number) => {
    const sig = h.p < 0.05, c = lvColor(h.p, h.after < h.before);
    return `<tr><td>${esc(cap(h.label))}${h.of < total ? ` <span style="color:${C.muted}">(af ${h.of} sem svöruðu)</span>` : ""}</td><td class="n">${h.of}</td><td class="n" style="color:${c}">${pct(h.before, h.of)}% → <b>${pct(h.after, h.of)}%</b></td><td class="n">${h.stopped}</td><td class="n">${h.started}</td><td class="n" style="font-weight:${sig ? 700 : 400};color:${c}">${pTxt(h.p)}${lvMark(h.p, h.after < h.before) === "†" ? " †" : ""}</td></tr>`;
  };
  const hb = r.subgroups.find((s) => s.key === "bp_high");
  const shifts = ins.habitShift ?? [];
  const exRow = (e: NonNullable<CohortInsights["exerciseShift"]>[number]) => {
    const sig = e.p < 0.05, c = lvColor(e.p, e.after > e.before);
    // improved = started this kind of exercise; worsened = stopped
    return `<tr><td>Stunda: ${esc(e.label.charAt(0).toLowerCase() + e.label.slice(1))}</td><td class="n">${e.of}</td><td class="n" style="color:${c}">${pct(e.before, e.of)}% → <b>${pct(e.after, e.of)}%</b></td><td class="n">${e.improved}</td><td class="n">${e.worsened}</td><td class="n" style="font-weight:${sig ? 700 : 400};color:${c}">${pTxt(e.p)}</td></tr>`;
  };
  const itRow = (it: NonNullable<CohortInsights["itemChanges"]>[number]) => {
    const sig = it.p !== null && it.p < 0.05, c = lvColor(it.p, it.after > it.before);
    return `<tr><td>${esc(it.label)} (sjálfsmat)</td><td class="n">${it.n}</td><td class="n" style="color:${c}">${num(it.before)} → <b>${num(it.after)}</b></td><td class="n">${it.improved}</td><td class="n">${it.worsened}</td><td class="n" style="font-weight:${sig ? 700 : 400};color:${c}">${pTxt(it.p)}</td></tr>`;
  };
  const total = Math.max(0, ...shifts.map((h) => h.of));
  const body = GROUPS.map(([key, label]) => {
    // PDF only: skip rows where fewer than five people moved at all.
    const rows = r.metrics.filter((m) => (PDF_GROUP[m.feature] ?? featureDomain(m.feature)) === key && (m.improved + m.worsened) >= 5 && !isConditional(m.feature) && !PDF_SKIP.has(m.feature));
    const habits = key === "addiction" ? shifts.filter((h) => h.pillar === "substances") : [];
    if (!rows.length && !habits.length && !(key === "exercise" && ins.exerciseShift?.length) && !(key === "mental" && ins.itemChanges?.length)) return "";
    const tail = key === "mental" && gated.size ? `<tr><td colspan="6" class="gnote">‡ Heildarlista vantaði eftir jákvæða skimun hjá ${(r.gatedDropped ?? []).map((g) => `${g.n} af ${g.n + g.nCompared} (${g.label.split(" (")[0]})`).join(" og ")}; breytingin er í sömu átt þótt gert sé ráð fyrir versta tilviki (sjá aðferð).</td></tr>` : "";
    const note = key === "addiction" ? `<tr><td colspan="6" class="gnote">Einkunn 0–10: hærri einkunn merkir minni notkun eða minni vanda. Prósentur: hlutfall þátttakenda sem hafa vanann.</td></tr>` : "";
    const extra = key === "exercise" ? (ins.exerciseShift ?? []).map(exRow).join("") : key === "mental" ? (ins.itemChanges ?? []).map(itRow).join("") : "";
    return `<tr><td colspan="6" class="grp">${esc(label)}</td></tr>${note}${rows.map((m) => row(m)).join("")}${extra}${tail}${habits.map((h) => habitRow(h, total)).join("")}${key === "cardio" && hb ? hb.metrics.filter((m) => ["bp_systolic_avg", "weight"].includes(m.feature)).map((m) => row(m, " — hópur með háþrýsting við upphaf")).join("") : ""}`;
  }).join("");
  return `
    <h2 style="margin-top:0">Mældar breytingar milli gagnasetta</h2>
    <p class="lead">Fyrsta og síðasta mæling hvers þátttakanda eru bornar saman. <b>Bættu sig</b> og <b>versnuðu</b> sýna hve margir færðust í heilsusamlega eða óheilsusamlega átt; aðrir stóðu í stað. Á kvarðanum 0–10 er hærri einkunn betri. Dökkgrænt = marktæk framför, rautt = marktæk afturför (p &lt; 0,05); † = á mörkum marktækni (p &lt; 0,10). Aðferð og þættir sem ekki eru bornir saman: sjá síðustu síðu.</p>
    <table class="tbl compact"><thead><tr><th>Mæling</th><th class="n">Fjöldi</th><th class="n">Fyrir → eftir</th><th class="n">Bættu sig</th><th class="n">Versnuðu</th><th class="n">p-gildi</th></tr></thead><tbody>${body}</tbody></table>
`;
}
function excludedNote(ins: CohortInsights): string {
  const r = ins.result;
  return r.excluded?.length ? `<li><b>Mælt tvisvar en ekki borið saman:</b> ${groupExcluded(r.excluded).map((g) => `${esc(g.labels)}: ${esc(g.reason.split(/\. | og því /)[0].replace(/\.$/, ""))}`).join(". ")}.</li>` : "";
}
/** Gated 0–10 mental scores: who is missing and why the change may be overstated. */
export function gatedNote(r: CohortInsights["result"]): string | null {
  const g = r.gatedDropped ?? [];
  if (!g.length) return null;
  const nm = (x: (typeof g)[number]) => x.label.split(" (")[0];
  const pw = (p: number | null) => (p === null ? "–" : p < 0.001 ? "< 0,001" : num(p, 3));
  const worst = g.map((x) => `${nm(x)} ${num(x.worstBefore)} → ${num(x.worstAfter)} (p = ${pw(x.worstP)})`).join(", ");
  return `Andleg heilsa og streita (‡) byggja á heildarlista (PHQ-9/GAD-7) þegar skimun er jákvæð. Heildartölur voru endurreiknaðar úr svörum við einstökum spurningum. Í eftirfylgni vantaði heildarlistann eftir jákvæða skimun hjá ${g.map((x) => `${x.n} þátttakendum (${nm(x)})`).join(" og ")}; þeir eru ekki með í samanburðinum. Ef þeim er gefin lægsta einkunn sem skimunin leyfir verður niðurstaðan: ${worst}.`;
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
    <h2>Stoðir lífsstíls: fyrir og eftir</h2>
    <p class="lead">Meðaleinkunn á kvarðanum 0–10 þar sem 10 er best. Grá stika: fyrsta mæling; lituð stika: endurmæling hjá sömu einstaklingum. Litur sýnir stöðuna eftir á: grænt 7 eða hærra, gult 5–7, rautt undir 5. Brotalínan markar einkunnina 6. * = tölfræðilega marktæk breyting; † = á mörkum marktækni (0,05 ≤ p &lt; 0,10).${r.gatedDropped?.length ? " ‡ = nokkra vantaði heildarlista eftir jákvæða skimun; sjá aðferð." : ""}</p>
    ${pillarChart(ins)}`;

  const pillars: InsightArea["key"][] = ["exercise", "nutrition", "sleep", "mental"];
  const subst = ins.habits.filter((h) => h.pillar === "substances");
  const shift = ins.habitShift ?? [];
  const hasShift = shift.length > 0;
  const OVERLAP = ["stunda enga styrktarþjálfun", "stunda þolþjálfun 0–1 dag í viku"];
  const ex = ins.exerciseShift ?? [];
  const items = ins.itemChanges ?? [];
  // healthy behaviour / 0–10 self-report: higher is better
  const upBars = (rows: { label: string; b: number; a: number; p: number | null; up: boolean; unit: string }[]) => rows.map((x) => {
    const c = lvColor(x.p, x.up), mk = lvMark(x.p, x.up);
    const w = (v: number) => (x.unit === "%" ? v : v * 10);
    return `<div class="fact"><div class="fl"><span>${esc(cap(x.label))} <span style="color:${C.muted}">↑</span></span><b style="color:${c}">${x.unit === "%" ? `${x.b}% → ${x.a}%` : `${num(x.b)} → ${num(x.a)}`}${mk}</b></div><div class="fb"><i style="width:${Math.max(w(x.b), 2)}%;background:#D1D5DB"></i></div><div class="fb" style="margin-top:.5mm"><i style="width:${Math.max(w(x.a), 2)}%"></i></div></div>`;
  }).join("");
  const exBars = upBars(ex.map((e) => ({ label: e.label, b: pct(e.before, e.of), a: pct(e.after, e.of), p: e.p, up: e.after > e.before, unit: "%" })));
  const itemBars = upBars(items.map((it) => ({ label: it.label, b: it.before, a: it.after, p: it.p, up: it.after > it.before, unit: "" })));
  const shiftBars = (pillar: string) => shift.filter((h) => h.pillar === pillar && !(pillar === "exercise" && ex.length && OVERLAP.includes(h.label))).map((h) => {
    const b = pct(h.before, h.of), a = pct(h.after, h.of), mk = lvMark(h.p, h.after < h.before);
    const c = lvColor(h.p, h.after < h.before);
    return `<div class="fact"><div class="fl"><span>${esc(cap(h.label))}${h.of < Math.max(...shift.map((x) => x.of)) ? ` <span style="color:${C.muted}">(af ${h.of} sem svöruðu)</span>` : ""}</span><b style="color:${c}">${b}% → ${a}%${mk}</b></div><div class="fb"><i style="width:${Math.max(b, 2)}%;background:#D1D5DB"></i></div><div class="fb" style="margin-top:.5mm"><i style="width:${Math.max(a, 2)}%"></i></div></div>`;
  }).join("");
  const p2 = `
    <h2 style="margin-top:0">${hasShift ? "Lífsstíll: fyrir og eftir" : "Lífsstíll við heilsufarsskoðun"}</h2>
    <p class="lead">${hasShift ? `Hlutfall þátttakenda sem hafa hvern vana, hjá sömu ${Math.max(...shift.map((x) => x.of))} einstaklingum í fyrra og seinna heilsumati. Grá stika: fyrra heilsumat; græn stika: seinna heilsumat. * = tölfræðilega marktæk breyting; † = á mörkum marktækni. Hjá óæskilegum vönum er lægra hlutfall betra; hjá línum merktum ↑ (hreyfing og sjálfsmat 0–10) er hærra betra.` : `Hlutfall af þeim ${ins.habits[0]?.of ?? "–"} sem svöruðu heilsumatinu.`}</p>
    <div class="grid2">${pillars.map((k) => {
      const a = A(k);
      const subs = a.subScores.length ? `<div class="subs">${a.subScores.map((sc) => {
        const m = r.metrics.find((x) => (x.label === sc.label || x.feature === SUBSCORE_FEATURE[sc.label]));
        const notCompared = !m && r.excluded?.some((e) => e.feature === SUBSCORE_FEATURE[sc.label]);
        return `<span>${esc(sc.label.split(" (")[0])} <b style="color:${m ? lvColor(m.p, m.good === true) : sc.mean >= 7 ? C.dark : sc.mean >= 5 ? "#B45309" : C.bad}">${m ? `${num(m.before)} → ${num(m.after)}${lvMark(m.p, m.good === true)}` : num(sc.mean)}</b>${notCompared ? " (aðeins við upphaf)" : ""}</span>`;
      }).join("")}</div>` : "";
      const extra = k === "exercise" ? exBars : k === "mental" ? itemBars : "";
      const bars = extra + (hasShift && shift.some((h) => h.pillar === k) ? shiftBars(k) : a.factGroups.map((g) => factBars(g.facts)).join(""));
      return `<div class="pill"><div class="ph"><span>${esc(a.title)}</span><b style="color:${toneCol[a.scoreTone]}">${esc(a.scoreLabel)}</b></div>${subs}${bars}</div>`;
    }).join("")}</div>
    ${subst.length ? (hasShift && shift.some((h) => h.pillar === "substances")
      ? `<div class="pill" style="margin-top:4mm"><div class="ph"><span>Nikótín og áfengi</span></div><div class="grid2">${shiftBars("substances")}</div>${r.excluded?.some((e) => e.feature === "lifeline_health_caffine_score") ? `<p class="lead" style="margin:2mm 0 0">Koffín er ekki borið saman þar sem spurningum um koffín var breytt á milli heilsumata.</p>` : ""}</div>`
      : `<div class="pill" style="margin-top:4mm"><div class="ph"><span>${esc(HABIT_PILLAR_LABEL.substances)}</span></div><div class="grid3">${factBars(subst)}</div></div>`) : ""}`;

  const links = areas.flatMap((a) => a.links.map((l) => l)).filter((l, i, arr) => arr.findIndex((x) => x.text === l.text) === i);
  const body = A("body");
  const p3 = `
    <h2 style="margin-top:0">Tengsl lífsstíls og áhættu</h2>
    <p class="lead">Fylgni (Spearman) milli venja og áhættuþátta við heilsufarsskoðun, leiðrétt fyrir aldri. Grænt: betri venjur tengjast lægri áhættu. Gult: öfugt samband. Dökkur litur og * merkja tölfræðilega marktæk tengsl (p &lt; 0,05). Tengsl sýna ekki orsök.</p>
    ${heatmap(ins)}
    <ul class="links">${links.map((l) => `<li class="${l.expected ? "" : "unexp"}">${esc(l.text)}</li>`).join("")}</ul>
    <h2>Líkami og áhætta</h2>
    <div class="two"><div>${body.factGroups.filter((g) => g.title === "Við heilsufarsskoðun").map((g) => factBars(g.facts)).join("")}</div>
      <div>${body.change.filter((c) => !c.label.startsWith("Hlutfall þeirra sem")).map((c) => `<div class="card"><div class="cl">${esc(c.label)}</div><div class="big" style="color:${c.tone === "good" ? C.dark : c.tone === "bad" ? C.bad : C.ink}">${esc(c.value)}</div>${c.note ? `<p>${esc(c.note)}</p>` : ""}</div>`).join("")}</div></div>`;

  const reMeasured = new Set(r.metrics.map((m) => m.feature));
  const steps: string[] = [];
  const lifeReMeasured = reMeasured.has("lifeline_health_sleep_behaviour_score") || reMeasured.has("pwi");
  steps.push(reMeasured.has("hba1c")
    ? "<b>Endurmæling eftir 12 mánuði</b> til að staðfesta hvort árangurinn helst."
    : lifeReMeasured
      ? "<b>Endurmæling eftir 12 mánuði, einnig með blóðprufum.</b> Blóðprufur voru ekki teknar í eftirfylgni en þær sýna hvort bættar venjur skili sér í blóðsykri, insúlínviðnámi og blóðfitum."
      : "<b>Endurmæling eftir 12 mánuði með blóðprufum og heilsumati.</b> Í eftirfylgni voru aðeins þyngd og blóðþrýstingur mæld. Endurtekið heilsumat sýnir hvort venjur hafi í raun breyst.");
  if (r.excluded?.length || r.gatedDropped?.length) steps.push("<b>Sömu spurningar í næstu mælingu:</b> heildarlistar PHQ-9 og GAD-7 birtist öllum sem skimast jákvætt (3 eða hærra) og spurningum um koffín verði haldið óbreyttum.");
  const weakest = [...ins.pillars].filter((p) => ["sleep", "exercise", "nutrition"].includes(p.key)).sort((a, b) => (a.mean ?? 99) - (b.mean ?? 99))[0];
  const ACC: Record<string, string> = { sleep: "svefn", exercise: "hreyfingu", nutrition: "næringu" };
  if (weakest) {
    const NOM: Record<string, string> = { sleep: "svefn", exercise: "hreyfing", nutrition: "næring" };
    const wm = r.metrics.find((m) => m.feature === PILLAR_FEATURE[weakest.key]);
    steps.push(wm && wm.good
      ? `<b>Halda áfram að setja ${ACC[weakest.key] ?? esc(weakest.label.toLowerCase())} í forgang:</b> ${NOM[weakest.key]} hefur batnað (${num(wm.before)} → ${num(wm.after)} af 10) en er enn veikasta stoð hópsins.`
      : `<b>Setja ${ACC[weakest.key] ?? esc(weakest.label.toLowerCase())} í forgang:</b> ${NOM[weakest.key]} var veikasta stoð hópsins við upphaf (${num(weakest.mean!)} af 10).`);
  }
  if (r.subgroups.some((s) => s.key === "bp_high")) steps.push("<b>Áframhaldandi eftirfylgni</b> með þeim sem mældust með háþrýsting, en þar var árangurinn mestur.");
  const sleepy = ins.habits.find((h) => h.label.includes("úthvíld"));
  const rested = shift.find((h) => h.label.includes("úthvíld")), drowsy = shift.find((h) => h.label.includes("syfju"));
  if (rested && pct(rested.after, rested.of) >= 50) steps.push(`<b>Fræðsla og stuðningur um svefn:</b> ${pct(rested.after, rested.of)}% vakna enn ekki úthvíld flesta daga${drowsy && drowsy.after > drowsy.before ? ` og hlutfall þeirra sem finna fyrir syfju yfir daginn hækkaði (${pct(drowsy.before, drowsy.of)}% → ${pct(drowsy.after, drowsy.of)}%)` : ""}.`);
  else if (!rested && sleepy && pct(sleepy.n, sleepy.of) >= 50) steps.push(`<b>Fræðsla um svefn:</b> ${pct(sleepy.n, sleepy.of)}% vöknuðu ekki úthvíld flesta daga við upphaf.`);
  const p4 = `
    <h2 style="margin-top:0">Upplifun þátttakenda af breytingum</h2>
    <p class="lead">Sjálfsmat úr eftirfylgnikönnun. Ekki hluti af gagnasettunum; bætir við mælingarnar.</p>
    ${surveySection(ins)}
    <h2>Næstu skref</h2><div class="steps"><ol>${steps.map((s) => `<li>${s}</li>`).join("")}</ol></div>
    <div class="method"><div class="mt">Aðferð</div><ul>
      <li>Lífsstíll byggir á heilsumati Lifeline Health; einkunnir á kvarðanum 0–10 þar sem 10 er best. Áhættuþættir miðast við viðurkennd klínísk mörk.</li>
      <li>Fyrsta og síðasta mæling hvers þátttakanda eru bornar saman (a.m.k. 14 dagar á milli); Wilcoxon-próf fyrir mælingar, McNemar-próf fyrir venjur. Aðeins eru bornar saman spurningar sem voru lagðar eins fyrir í bæði skiptin.</li>
      ${excludedNote(ins)}
      ${gatedNote(r) ? `<li>${esc(gatedNote(r)!)}</li>` : ""}
      <li>Upplifun þátttakenda kemur úr eftirfylgnikönnun og er aðeins birt þegar að minnsta kosti fimm hafa svarað.</li>
      <li>Samanburðarhópur er ekki til staðar og því er ekki hægt að fullyrða að breytingar séu þjónustunni einni að þakka.</li>
      <li>Útgáfa aðferðar: ${esc(methodsVersion)}.</li>
    </ul></div>`;

  const pc = comparisonPage(ins), pch = changesPage(ins);
  // The lifestyle × risk page (p3) is intentionally left out of the PDF; the
  // correlations remain in the admin Clinical overview.
  void p3;
  const pages = [p1, pc, pch, p2, p4].filter(Boolean);
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
  .kpis{display:flex;gap:4mm}.kpi{text-align:center;min-width:19mm}.kpi b{display:block;font-size:19pt;font-weight:800;line-height:1}.kpi span{display:block;font-size:7pt;line-height:1.25;margin-top:1mm;opacity:.9}
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
  .dsrow{display:flex;align-items:stretch;gap:3mm;margin-bottom:2mm}.ds{flex:1;background:#F9FAFB;border:1px solid ${C.faint};border-radius:3mm;padding:3mm 4mm}.dsl{font-size:8.5pt;font-weight:700;color:${C.dark}}.dsd{font-size:8.5pt;margin-top:.5mm}.dsn{font-size:8.5pt;color:${C.muted};margin-top:1mm}.dsn b{color:${C.ink};font-size:11pt}
  .dsarrow{display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:18pt;color:${C.brand}}.dsarrow span{font-size:7pt;color:${C.muted}}
  .tbl .c{text-align:center}.tbl tr.hl td{background:#ECFDF5}.tbl.compact{font-size:7.4pt}.tbl.compact td{padding:.7mm 1mm}.tbl td.gnote{font-size:6.8pt;color:${C.muted};font-style:italic;padding-top:0}.tbl td.grp{padding-top:2mm;font-size:7pt;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};font-weight:700;border-bottom:1px solid ${C.faint}}
  .cases{display:grid;grid-template-columns:1fr 1fr;gap:2.5mm}.case{background:#F0FDF4;border-radius:3mm;padding:2.5mm 4mm}.case .ct{font-weight:700;font-size:9pt;color:${C.dark}}.case p{margin:1mm 0 0;font-size:8.2pt;line-height:1.45}
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
