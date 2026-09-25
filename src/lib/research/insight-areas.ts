// Turns CohortInsights into five plain-language focus areas (Icelandic) —
// the single source of wording for the Clinical overview cards and the
// comprehensive report, so both always say the same thing.
//
//   body · exercise · nutrition · sleep · mental
//
// Each area: a headline score, one-sentence takeaway, concrete facts
// (share of participants), links to risk markers (age-adjusted, only
// p < 0.05, any direction), and change (measured or self-reported).

import type { CohortInsights, HabitFact, MatrixCell, SubScore } from "./lifestyle";
import { CHANGE_PILLAR, MIN_SURVEY_N } from "./lifestyle";
import { featureDomain } from "./clinical";
import { LABEL_IS } from "./before-after";
import type { MetricResult } from "./before-after";

export type AreaKey = "body" | "exercise" | "nutrition" | "sleep" | "mental";

export interface AreaFact { label: string; n: number; of: number }
export interface AreaChange {
  label: string; value: string; tone: "good" | "bad" | "neutral"; note?: string;
  dist?: { labels: string[]; counts: number[] };   // 5-point self-report, index 0 = most positive
}
export interface InsightArea {
  key: AreaKey;
  title: string;
  scoreLabel: string;       // e.g. "3,3 / 10" or "68%"
  scoreCaption: string;     // what the score means
  scoreTone: "good" | "warn" | "bad";
  headline: string;         // one relatable sentence
  factGroups: { title: string; facts: AreaFact[] }[];
  links: { text: string; expected: boolean }[];   // "Betri hreyfivenjur tengdust lægra BMI."
  subScores: SubScore[];    // 0–10 component scores for the area
  change: AreaChange[];
  changePending?: string;   // shown when no change data yet
  surveyProgress?: { completed: number; sent: number; needed: number };
}


const num = (x: number, d = 1) => x.toLocaleString("is-IS", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
const toneFor10 = (v: number | null): "good" | "warn" | "bad" => (v === null ? "warn" : v >= 7 ? "good" : v >= 5 ? "warn" : "bad");

// matrix wording (dative after "tengjast")
const ROW_SUBJECT: Record<string, [string, string]> = {            // [subject, verb]
  lifeline_health_exercise_behavioural_score: ["Betri hreyfivenjur", "tengdust"],
  lifeline_health_nutrition_behavioural_score: ["Betri matarvenjur", "tengdust"],
  lifeline_health_sleep_behaviour_score: ["Betri svefnvenjur", "tengdust"],
  lifstilseinkunn: ["Hærri lífsstílseinkunn", "tengdist"],
};
const COL_PHRASE: Record<string, [string, string]> = {             // [lower, higher]
  bmi: ["lægra BMI", "hærra BMI"],
  fat_mass_percent: ["lægra fituhlutfalli", "hærra fituhlutfalli"],
  bp_systolic_avg: ["lægri blóðþrýstingi", "hærri blóðþrýstingi"],
  homa_ir: ["minna insúlínviðnámi", "meira insúlínviðnámi"],
  triglycerides: ["lægri þríglýseríðum", "hærri þríglýseríðum"],
  phq9: ["færri einkennum þunglyndis", "fleiri einkennum þunglyndis"],
};
// expected = the healthy direction (better habit ↔ lower risk marker). Links
// the other way are kept (no cherry-picking) but flagged as unexpected.
function linkSentences(ins: CohortInsights, rowKey: string | null, colKey: string | null): { text: string; expected: boolean }[] {
  const out: { text: string; expected: boolean }[] = [];
  ins.matrix.rows.forEach((r, i) => {
    if (rowKey && r.key !== rowKey) return;
    ins.matrix.cols.forEach((c, j) => {
      if (colKey && c.key !== colKey) return;
      const cell: MatrixCell | null = ins.matrix.cells[i][j];
      if (!cell || cell.p >= 0.05) return;
      const [subj, verb] = ROW_SUBJECT[r.key] ?? [r.label, "tengdist"];
      const [lo, hi] = COL_PHRASE[c.key] ?? [`lægra gildi (${c.label})`, `hærra gildi (${c.label})`];
      const expected = cell.rho < 0;
      out.push({ text: `${subj} ${verb} ${expected ? lo : hi}.${expected ? "" : " Óvænt samband sem gæti átt sér aðrar skýringar."}`, expected });
    });
  });
  return out;
}

const habits = (ins: CohortInsights, pillar: string): AreaFact[] =>
  ins.habits.filter((h: HabitFact) => h.pillar === pillar).map((h) => ({ label: h.label, n: h.n, of: h.of }))
    .sort((a, b) => b.n / b.of - a.n / a.of);

// Self-reported change for one foundation from the follow-up survey: the
// 5-point question for that area + the concrete changes people report making.
function surveyChange(ins: CohortInsights, labels: string[], what: string, pillar: string): { change: AreaChange[]; pending?: string; progress?: InsightArea["surveyProgress"] } {
  const s = ins.survey;
  if (!s) return { change: [], pending: `Engin gögn um breytingar á ${what}: heilsumat var ekki endurtekið og engin eftirfylgnikönnun er tengd hópnum.` };
  if (!s.enough) return {
    change: [],
    pending: `Til viðbótar við mælingarnar: sjálfsmat þátttakenda á breytingum á ${what} úr eftirfylgnikönnun (ekki hluti af gagnasettunum). Birtist þegar að minnsta kosti ${MIN_SURVEY_N} hafa svarað.`,
    progress: { completed: s.completed, sent: s.sent, needed: MIN_SURVEY_N },
  };
  const out: AreaChange[] = [];
  for (const label of labels) {
    const c = s.change.find((x) => x.label === label);
    if (!c || !c.n) continue;
    const worse = c.dist[3] + c.dist[4];
    out.push({
      label: `Sjálfsmat úr könnun: ${label === "Orka" ? "orka í daglegu lífi" : label.toLowerCase()}`,
      value: `${Math.round(c.better * 100)}% betri`,
      tone: c.better >= 0.5 ? "good" : worse > c.dist[0] + c.dist[1] ? "bad" : "neutral",
      note: `${c.dist[0] + c.dist[1]} af ${c.n} segja betri, ${c.dist[2]} svipað, ${worse} verri.`,
      dist: { labels: c.optionLabels, counts: c.dist },
    });
  }
  const made = s.madeChanges.filter((m) => CHANGE_PILLAR.find(([re]) => re.test(m.label))?.[1] === pillar && m.n > 0);
  for (const m of made) out.push({ label: `Sjálfsmat úr könnun: ${m.label}`, value: `${pct(m.n, m.of)}%`, tone: "good", note: `${m.n} af ${m.of} svarendum segjast hafa gert þessa breytingu.` });
  return { change: out };
}


// MEASURED change between the uploaded data sets for one foundation: every
// paired metric (first vs latest by date) whose feature belongs to the domain.
// When the follow-up data set has no variables for the domain, say so
// plainly and list what it did contain.
const SUB_LABEL: Record<string, string> = {
  lifeline_health_sleep_behaviour_score: "Svefnvenjur", lifeline_health_sleep_medical_score: "Svefn, læknisfræðilegir þættir",
  lifeline_health_exercise_behavioural_score: "Hreyfivenjur", lifeline_health_exercise_medical_score: "Hreyfing, læknisfræðilegir þættir",
  lifeline_health_nutrition_behavioural_score: "Matarvenjur", lifeline_health_nutrition_medical_score: "Næring, læknisfræðilegir þættir",
  lifeline_health_depression_score_1_10: "Andleg heilsa", lifeline_health_anxiety_score_1_10: "Streita", pwi: "Almenn vellíðan",
  phq9: "Einkenni þunglyndis (PHQ-9)", lifeline_health_anxiety_gad_7: "Einkenni kvíða (GAD-7)",
  phq2: "Einkenni þunglyndis, skimun (PHQ-2)", lifeline_health_anxiety_gad_2: "Einkenni kvíða, skimun (GAD-2)",
  fat_mass_percent: "Fituhlutfall", skeletal_muscle_mass_kg: "Vöðvamassi", fat_mass_kg: "Fitumassi", skeletal_muscle_mass_percent: "Vöðvahlutfall",
};

// Same habit, same people, first vs latest Heilsumat. Every habit here is an
// unhealthy one, so a lower share is better. McNemar p on discordant pairs.
function habitShiftRows(ins: CohortInsights, pillar: string): AreaChange[] {
  return (ins.habitShift ?? []).filter((h) => h.pillar === pillar).map((h) => {
    const sig = h.p < 0.05, better = h.after < h.before;
    return {
      label: `Hlutfall þeirra sem ${h.label}`,
      value: `${pct(h.before, h.of)}% → ${pct(h.after, h.of)}%`,
      tone: sig ? (better ? "good" : "bad") : "neutral",
      note: `${h.of} manns sem svöruðu báðum heilsumötum.${sig ? " Tölfræðilega marktækt." : ""}`,
    } as AreaChange;
  });
}
const bestShift = (ins: CohortInsights, pillar: string) =>
  (ins.habitShift ?? []).filter((h) => h.pillar === pillar && h.p < 0.05 && h.after < h.before).sort((a, b) => a.p - b.p)[0];
function measuredChange(ins: CohortInsights, domains: string[]): AreaChange[] {
  const ms = ins.result.metrics.filter((m) => domains.includes(featureDomain(m.feature)));
  const cmp = ins.comparison;
  if (ms.length) {
    return ms.map((m) => ({
      label: `${SUB_LABEL[m.feature] ?? LABEL_IS[m.feature] ?? m.label} (${m.n} manns)`,
      value: `${num(m.before)} → ${num(m.after)}${m.unit === "kg" ? " kg" : m.unit === "%" ? "%" : ""}`,
      tone: m.significant ? (m.good ? "good" : "bad") : "neutral",
      note: `${m.improved} bættu sig, ${m.worsened} versnuðu.${m.significant ? " Tölfræðilega marktækt." : " Ekki tölfræðilega marktækt."}`,
    }));
  }
  if (!cmp || cmp.datasets.length < 2) return [{ label: "Samanburður gagnasetta", value: "Aðeins eitt gagnasett", tone: "neutral", note: "Breytingar birtast þegar eftirfylgnigögnum hefur verið hlaðið upp." }];
  const last = cmp.datasets[cmp.datasets.length - 1];
  const measured = cmp.coverage.filter((c) => c.counts[c.counts.length - 1] > 0).flatMap((c) => c.examples);
  return [{
    label: `${last.label} (eftirfylgni)`,
    value: "Ekki mælt",
    tone: "neutral",
    note: `Þetta svið var aðeins metið í gagnasetti 1. Í gagnasetti ${cmp.datasets.length} var eingöngu mælt: ${[...new Set(measured)].join(", ") || "–"}. Til að mæla breytingu þarf heilsumat í næstu eftirfylgni.`,
  }];
}

const metric = (ins: CohortInsights, f: string): MetricResult | undefined => ins.result.metrics.find((m) => m.feature === f);

export function buildInsightAreas(ins: CohortInsights): InsightArea[] {
  const pillar = (k: string) => ins.pillars.find((p) => p.key === k);
  const areas: InsightArea[] = [];

  // ── 1. Body & risk ──
  const prof = (k: string) => ins.profile.find((p) => p.key === k);
  const ow = prof("overweight"), bp = prof("bp_high"), ir = prof("insulin_res");
  const r = ins.result;
  const bodyChange: AreaChange[] = [];
  const bpHigh = r.subgroups.find((s) => s.key === "bp_high");
  const bpHighSys = bpHigh?.metrics.find((m) => m.feature === "bp_systolic_avg");
  const bpHighW = bpHigh?.metrics.find((m) => m.feature === "weight");
  if (bpHigh && bpHighSys) bodyChange.push({
    label: `Efri mörk blóðþrýstings hjá þeim ${bpHigh.n} sem voru með háþrýsting`,
    value: `${num(bpHighSys.before, 0)} → ${num(bpHighSys.after, 0)} mmHg`,
    tone: bpHighSys.good && bpHighSys.significant ? "good" : "neutral",
    note: bpHighSys.significant ? `Tölfræðilega marktæk lækkun.${bpHighW?.significant && bpHighW.good ? ` Sami hópur léttist um ${num(Math.abs(bpHighW.delta))} kg að meðaltali.` : ""}` : "Ekki tölfræðilega marktækt.",
  });
  const w = metric(ins, "weight");
  if (w) bodyChange.push({ label: `Meðalþyngd hópsins (${w.n} manns)`, value: `${num(w.before)} → ${num(w.after)} kg`, tone: w.significant ? (w.good ? "good" : "bad") : "neutral", note: w.significant ? "Tölfræðilega marktæk breyting." : "Lítil breyting að meðaltali." });
  const lost = r.weightBands.filter((b) => b.key.startsWith("lost")).reduce((a, b) => a + b.n, 0);
  const tot = r.weightBands.reduce((a, b) => a + b.n, 0);
  if (tot) bodyChange.push({ label: "Léttust um 2% eða meira", value: `${lost} af ${tot}`, tone: lost ? "good" : "neutral" });
  for (const f of ["fat_mass_percent", "skeletal_muscle_mass_kg"]) {
    const m = metric(ins, f);
    if (m) bodyChange.push({ label: `${SUB_LABEL[f]} (${m.n} manns)`, value: `${num(m.before)} → ${num(m.after)}${m.unit === "%" ? "%" : ` ${m.unit}`}`, tone: m.significant ? (m.good ? "good" : "bad") : "neutral", note: `${m.improved} bættu sig, ${m.worsened} versnuðu.${m.significant ? " Tölfræðilega marktækt." : ""}` });
  }
  bodyChange.push(...habitShiftRows(ins, "substances"));
  const fatP = metric(ins, "fat_mass_percent"), musc = metric(ins, "skeletal_muscle_mass_kg");
  areas.push({
    key: "body",
    title: "Líkami og áhætta",
    scoreLabel: ow ? `${pct(ow.n, ow.of)}%` : "–",
    scoreCaption: "með ofþyngd eða offitu",
    scoreTone: ow && pct(ow.n, ow.of) >= 50 ? "bad" : "warn",
    headline: [
      bp ? `${pct(bp.n, bp.of)}% voru með háþrýsting` : null,
      ir ? `${pct(ir.n, ir.of)}% með insúlínviðnám` : null,
    ].filter(Boolean).join(" og ") + " við heilsufarsskoðunina."
      + (fatP?.significant && fatP.good ? ` Fituhlutfall lækkaði úr ${num(fatP.before)}% í ${num(fatP.after)}%${musc?.significant && musc.good ? ` og vöðvamassi jókst um ${num(musc.delta)} kg` : ""}.` : "")
      + (bpHighSys?.significant && bpHighSys.good ? ` Hjá þeim sem voru með háþrýsting lækkaði blóðþrýstingur um ${num(Math.abs(bpHighSys.delta), 0)} mmHg að meðaltali.` : ""),
    factGroups: [
      { title: "Við heilsufarsskoðun", facts: ins.profile.filter((p) => !["mental", "exercise"].includes(p.key)).map((p) => ({ label: `${p.label.toLowerCase()} (${p.threshold})`, n: p.n, of: p.of })) },
      { title: "Nikótín, koffín og áfengi", facts: habits(ins, "substances") },
    ].filter((g) => g.facts.length),
    links: linkSentences(ins, null, null).filter((l) => !l.text.includes("þunglyndis")),
    subScores: ins.subScores?.body ?? [],
    change: bodyChange,
  });

  // ── 2–4. Lifestyle pillars ──
  const lifestyle: { key: AreaKey; pillarKey: string; title: string; row: string; surveyLabel: string; what: string; lead: (f: AreaFact[]) => string }[] = [
    { key: "exercise", pillarKey: "exercise", title: "Hreyfing", row: "lifeline_health_exercise_behavioural_score", surveyLabel: "Hreyfing", what: "hreyfingu",
      lead: (f) => f[0] ? `${pct(f[0].n, f[0].of)}% ${f[0].label}.` : "" },
    { key: "nutrition", pillarKey: "nutrition", title: "Næring", row: "lifeline_health_nutrition_behavioural_score", surveyLabel: "Mataræði", what: "mataræði",
      lead: (f) => f[0] ? `${pct(f[0].n, f[0].of)}% ${f[0].label}.` : "" },
    { key: "sleep", pillarKey: "sleep", title: "Svefn", row: "lifeline_health_sleep_behaviour_score", surveyLabel: "Svefn", what: "svefni",
      lead: (f) => f[0] ? `${pct(f[0].n, f[0].of)}% ${f[0].label}.` : "" },
  ];
  const weakest = [...ins.pillars].filter((p) => ["sleep", "exercise", "nutrition"].includes(p.key)).sort((a, b) => (a.mean ?? 99) - (b.mean ?? 99))[0];
  for (const l of lifestyle) {
    const p = pillar(l.pillarKey);
    const f = habits(ins, l.pillarKey);
    const sc = surveyChange(ins, [l.surveyLabel], l.what, l.pillarKey);
    const links = linkSentences(ins, l.row, null);
    areas.push({
      key: l.key,
      title: l.title,
      ...(() => {
        const beh = metric(ins, l.row);
        if (beh) return { scoreLabel: `${num(beh.before)} → ${num(beh.after)}`, scoreCaption: `venjur af 10 · ${beh.n} manns${beh.significant ? " · marktækt" : ""}`, scoreTone: toneFor10(beh.after) };
        return { scoreLabel: p?.mean != null ? `${num(p.mean)} / 10` : "–", scoreCaption: p ? `venjur · ${pct(p.below6, p.n)}% undir 6` : "", scoreTone: toneFor10(p?.mean ?? null) };
      })(),
      headline: (() => {
        const beh = metric(ins, l.row), shift = bestShift(ins, l.pillarKey);
        if (beh?.significant && beh.good) {
          return `${SUB_LABEL[l.row]} bötnuðu úr ${num(beh.before)} í ${num(beh.after)} af 10.${shift ? ` Hlutfall þeirra sem ${shift.label} fór úr ${pct(shift.before, shift.of)}% í ${pct(shift.after, shift.of)}%.` : ""}`;
        }
        return `${weakest?.key === l.pillarKey ? "Veikasta stoð hópsins. " : ""}${l.lead(f)}${shift ? ` Hlutfall þeirra sem ${shift.label} fór úr ${pct(shift.before, shift.of)}% í ${pct(shift.after, shift.of)}%.` : links.find((x) => x.expected) ? ` ${links.find((x) => x.expected)!.text}` : ""}`.trim();
      })(),
      factGroups: f.length ? [{ title: "Venjur við heilsufarsskoðun", facts: f }] : [],
      links,
      subScores: ins.subScores?.[l.pillarKey] ?? [],
      change: [...measuredChange(ins, [l.pillarKey]), ...habitShiftRows(ins, l.pillarKey), ...sc.change],
      changePending: sc.pending,
      surveyProgress: sc.progress,
    });
  }

  // ── 5. Mental wellbeing ──
  const mental = pillar("mental"), wellbeing = pillar("wellbeing");
  const mf = habits(ins, "mental");
  const ms = surveyChange(ins, ["Andleg líðan", "Orka"], "andlegri líðan", "mental");
  const dep = mf.find((x) => x.label.includes("þunglyndis")), anx = mf.find((x) => x.label.includes("kvíða (GAD"));
  areas.push({
    key: "mental",
    title: "Andleg líðan",
    ...(() => {
      const pw = metric(ins, "pwi");
      if (pw) return { scoreLabel: `${num(pw.before)} → ${num(pw.after)}`, scoreCaption: `almenn vellíðan af 10 · ${pw.n} manns${pw.significant ? " · marktækt" : ""}`, scoreTone: toneFor10(pw.after) };
      return {
        scoreLabel: wellbeing?.mean != null ? `${num(wellbeing.mean)} / 10` : mental?.mean != null ? `${num(mental.mean)} / 10` : "–",
        scoreCaption: wellbeing ? "almenn vellíðan" : "andleg heilsa",
        scoreTone: toneFor10(wellbeing?.mean ?? mental?.mean ?? null),
      };
    })(),
    headline: (() => {
      const pw = metric(ins, "pwi"), p2 = metric(ins, "phq2");
      const base = [dep ? `${pct(dep.n, dep.of)}% með einkenni þunglyndis` : null, anx ? `${pct(anx.n, anx.of)}% með einkenni kvíða` : null].filter(Boolean).join(" og ") + " við heilsufarsskoðunina.";
      if (pw?.significant && pw.good) return `Almenn vellíðan jókst úr ${num(pw.before)} í ${num(pw.after)} af 10${p2?.significant && p2.good ? " og einkennum þunglyndis fækkaði" : ""}. ${base}`;
      return base + (linkSentences(ins, null, "phq9").find((x) => x.expected) ? ` ${linkSentences(ins, null, "phq9").find((x) => x.expected)!.text}` : "");
    })(),
    factGroups: mf.length ? [{ title: "Við heilsufarsskoðun", facts: mf }] : [],
    links: linkSentences(ins, null, "phq9"),
    subScores: ins.subScores?.mental ?? [],
    change: [...measuredChange(ins, ["mental"]), ...habitShiftRows(ins, "mental"), ...ms.change],
    changePending: ms.pending,
    surveyProgress: ms.progress,
  });

  return areas;
}

// ── the case for continuing, from the data sets only ─────────────
export interface ContinuationPoint { title: string; body: string }
export function buildContinuationCase(ins: CohortInsights): ContinuationPoint[] {
  const r = ins.result;
  const pts: ContinuationPoint[] = [];
  const prof = (k: string) => ins.profile.find((p) => p.key === k);
  const ow = prof("overweight"), bp = prof("bp_high"), ir = prof("insulin_res");
  const weakest = [...ins.pillars].filter((p) => ["sleep", "exercise", "nutrition"].includes(p.key)).sort((a, b) => (a.mean ?? 99) - (b.mean ?? 99))[0];
  pts.push({
    title: "Þörfin er mikil",
    body: [ow && `${pct(ow.n, ow.of)}% með ofþyngd eða offitu`, bp && `${pct(bp.n, bp.of)}% með háþrýsting`, ir && `${pct(ir.n, ir.of)}% með insúlínviðnám`].filter(Boolean).join(", ")
      + ` við heilsufarsskoðun.${weakest?.mean != null ? ` ${weakest.label} er veikasta stoðin (${num(weakest.mean)} af 10).` : ""}`,
  });
  const hb = r.subgroups.find((s) => s.key === "bp_high");
  const hs = hb?.metrics.find((m) => m.feature === "bp_systolic_avg"), hw = hb?.metrics.find((m) => m.feature === "weight");
  if (hb && hs && hs.good) pts.push({
    title: "Árangur þar sem áhættan var mest",
    body: `Hjá þeim ${hb.n} sem voru með háþrýsting lækkuðu efri mörk úr ${num(hs.before, 0)} í ${num(hs.after, 0)} mmHg${hs.significant ? " (tölfræðilega marktækt)" : ""}${hw && hw.good ? ` og þyngd um ${num(Math.abs(hw.delta))} kg` : ""}.${r.bpCategories ? ` Fjöldi með háþrýsting fór úr ${r.bpCategories.before.high} í ${r.bpCategories.after.high}.` : ""}`,
  });
  // measured lifestyle change (same questions, same people)
  const LIFE = ["lifeline_health_nutrition_behavioural_score", "lifeline_health_sleep_behaviour_score", "lifeline_health_exercise_behavioural_score", "lifstilseinkunn", "pwi"];
  const lifeWins = LIFE.map((f) => r.metrics.find((m) => m.feature === f)).filter((m): m is MetricResult => !!m && m.significant && m.good === true);
  const shifts = (ins.habitShift ?? []).filter((h) => h.p < 0.05 && h.after < h.before).sort((a, b) => a.p - b.p).slice(0, 3);
  if (lifeWins.length || shifts.length) pts.push({
    title: "Lífsstíll batnaði mælanlega",
    body: [
      lifeWins.length ? `${lifeWins.map((m) => `${(SUB_LABEL[m.feature] ?? LABEL_IS[m.feature] ?? m.label).toLowerCase()} ${num(m.before)} → ${num(m.after)}`).join(", ")} (af 10, tölfræðilega marktækt)` : "",
      shifts.length ? `Breytingar á venjum (hlutfall þátttakenda): ${shifts.map((h) => `${h.label} ${pct(h.before, h.of)}% → ${pct(h.after, h.of)}%`).join("; ")}` : "",
    ].filter(Boolean).join(". ").replace(/^./, (c) => c.toUpperCase()) + ".",
  });
  const fp = r.metrics.find((m) => m.feature === "fat_mass_percent"), mm = r.metrics.find((m) => m.feature === "skeletal_muscle_mass_kg");
  if (fp?.significant && fp.good) pts.push({
    title: "Líkamssamsetning batnaði",
    body: `Fituhlutfall lækkaði úr ${num(fp.before)}% í ${num(fp.after)}%${mm?.significant && mm.good ? ` og vöðvamassi jókst um ${num(mm.delta)} kg` : ""}, þótt meðalþyngd hafi lítið breyst: fita vék fyrir vöðvum.`,
  });
  const lost = r.weightBands.filter((b) => b.key.startsWith("lost")).reduce((a, b) => a + b.n, 0);
  const tot = r.weightBands.reduce((a, b) => a + b.n, 0);
  pts.push({
    title: "Góð þátttaka",
    body: `${r.nFollowed} af ${r.nPatients} (${pct(r.nFollowed, r.nPatients)}%) mættu í endurmælingu.${tot ? ` ${lost} af ${tot} léttust um 2% eða meira.` : ""}`,
  });
  const cmp = ins.comparison;
  if (cmp && cmp.datasets.length >= 2) {
    const [first, last] = [cmp.datasets[0], cmp.datasets[cmp.datasets.length - 1]];
    const missing = cmp.coverage.filter((c) => c.counts[0] > 0 && c.counts[c.counts.length - 1] === 0).map((c) => c.label.toLowerCase());
    if (missing.length) pts.push({
      title: "Næsta mæling getur sýnt meira",
      body: missing.length === 1 && missing[0] === "blóðprufur"
        ? `Blóðprufur voru aðeins teknar við upphaf. Með blóðprufum í næstu mælingu má meta hvort bættar venjur skili sér í blóðsykri, insúlínviðnámi og blóðfitum.`
        : `Í gagnasetti ${cmp.datasets.length} voru mældar ${last.variables} breytur en ${first.variables} í gagnasetti 1. Eftirfarandi var aðeins metið við upphaf: ${missing.join(", ")}. Með blóðprufum og heilsumati í næstu mælingu má meta hvort venjur og efnaskipti hafi breyst.`,
    });
  }
  return pts;
}
