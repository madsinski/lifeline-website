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
import type { MetricResult } from "./before-after";

export type AreaKey = "body" | "exercise" | "nutrition" | "sleep" | "mental";

export interface AreaFact { label: string; n: number; of: number }
export interface AreaChange { label: string; value: string; tone: "good" | "bad" | "neutral"; note?: string }
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
  changeNote?: string;      // caveat under the change list
  changePending?: string;   // shown when no change data yet
}

const EXPLORATORY = "Könnunarleg greining: Lífsstíll var aðeins metinn við heilsufarsskoðun, svo hér er mæld breyting á þyngd og blóðþrýstingi borin saman eftir venjum við upphaf. Hóparnir byrjuðu ekki á sama blóðþrýstingi og margir samanburðir auka líkur á tilviljun; túlka varlega.";

function habitChangeRows(ins: CohortInsights, area: string, subject: string): AreaChange[] {
  return (ins.habitChange?.[area] ?? []).map((g) => {
    const parts: string[] = [];
    if (g.sbp) parts.push(`blóðþrýstingur ${g.sbp.delta > 0 ? "+" : g.sbp.delta < 0 ? "−" : ""}${num(Math.abs(g.sbp.delta))} mmHg${g.sbp.p !== null && g.sbp.p < 0.05 ? "*" : ""}`);
    if (g.weight) parts.push(`þyngd ${g.weight.delta > 0 ? "+" : g.weight.delta < 0 ? "−" : ""}${num(Math.abs(g.weight.delta))} kg${g.weight.p !== null && g.weight.p < 0.05 ? "*" : ""}`);
    const sig = (g.sbp?.p ?? 1) < 0.05 && (g.sbp?.delta ?? 0) < 0;
    return {
      label: `${subject} ${g.label.toLowerCase()} (${g.n} manns)`,
      value: parts.join(" · "),
      tone: sig ? "good" : "neutral",
      note: g.sbp ? `Blóðþrýstingur við upphaf ${num(g.sbp.baseline, 0)} mmHg.${sig ? " Marktæk lækkun (*)." : ""}` : undefined,
    } as AreaChange;
  });
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

function surveyChange(ins: CohortInsights, label: string, what: string): { change: AreaChange[]; pending?: string } {
  const s = ins.survey;
  if (!s) return { change: [], pending: "Ekki var mælt aftur í eftirfylgni. Engin eftirfylgnikönnun er tengd hópnum." };
  if (!s.enough) return { change: [], pending: `Upplifun þátttakenda af breytingum á ${what} birtist hér þegar að minnsta kosti 5 hafa svarað eftirfylgnikönnuninni (${s.completed} af ${s.sent} hafa svarað).` };
  const c = s.change.find((x) => x.label === label);
  if (!c || !c.n) return { change: [] };
  const worse = c.dist[3] + c.dist[4];
  return {
    change: [{
      label: `Segja ${what} hafa batnað síðan í heilsufarsskoðuninni`,
      value: `${Math.round(c.better * 100)}%`,
      tone: c.better >= 0.5 ? "good" : "neutral",
      note: `${c.dist[0] + c.dist[1]} af ${c.n} svarendum; ${worse} segja hana hafa versnað.`,
    }],
  };
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
  areas.push({
    key: "body",
    title: "Líkami og áhætta",
    scoreLabel: ow ? `${pct(ow.n, ow.of)}%` : "–",
    scoreCaption: "með ofþyngd eða offitu",
    scoreTone: ow && pct(ow.n, ow.of) >= 50 ? "bad" : "warn",
    headline: [
      bp ? `${pct(bp.n, bp.of)}% voru með háþrýsting` : null,
      ir ? `${pct(ir.n, ir.of)}% með insúlínviðnám` : null,
    ].filter(Boolean).join(" og ") + " við heilsufarsskoðunina." + (bpHighSys?.significant && bpHighSys.good ? ` Hjá þeim sem voru með háþrýsting lækkaði blóðþrýstingur um ${num(Math.abs(bpHighSys.delta), 0)} mmHg að meðaltali.` : ""),
    factGroups: [
      { title: "Við heilsufarsskoðun", facts: ins.profile.filter((p) => !["mental", "exercise"].includes(p.key)).map((p) => ({ label: `${p.label.toLowerCase()} (${p.threshold})`, n: p.n, of: p.of })) },
      { title: "Nikótín, koffín og áfengi", facts: habits(ins, "substances") },
    ].filter((g) => g.facts.length),
    links: linkSentences(ins, null, null).filter((l) => !l.text.includes("þunglyndis")),
    subScores: ins.subScores?.body ?? [],
    change: bodyChange,
  });

  // ── 2–4. Lifestyle pillars ──
  const lifestyle: { key: AreaKey; pillarKey: string; title: string; subject: string; row: string; surveyLabel: string; what: string; lead: (f: AreaFact[]) => string }[] = [
    { key: "exercise", pillarKey: "exercise", title: "Hreyfing", subject: "Hreyfivenjur", row: "lifeline_health_exercise_behavioural_score", surveyLabel: "Hreyfing", what: "hreyfingu",
      lead: (f) => f[0] ? `${pct(f[0].n, f[0].of)}% ${f[0].label}.` : "" },
    { key: "nutrition", pillarKey: "nutrition", title: "Næring", subject: "Matarvenjur", row: "lifeline_health_nutrition_behavioural_score", surveyLabel: "Mataræði", what: "mataræði",
      lead: (f) => f[0] ? `${pct(f[0].n, f[0].of)}% ${f[0].label}.` : "" },
    { key: "sleep", pillarKey: "sleep", title: "Svefn", subject: "Svefnvenjur", row: "lifeline_health_sleep_behaviour_score", surveyLabel: "Svefn", what: "svefni",
      lead: (f) => f[0] ? `${pct(f[0].n, f[0].of)}% ${f[0].label}.` : "" },
  ];
  const weakest = [...ins.pillars].filter((p) => ["sleep", "exercise", "nutrition"].includes(p.key)).sort((a, b) => (a.mean ?? 99) - (b.mean ?? 99))[0];
  for (const l of lifestyle) {
    const p = pillar(l.pillarKey);
    const f = habits(ins, l.pillarKey);
    const sc = surveyChange(ins, l.surveyLabel, l.what);
    const links = linkSentences(ins, l.row, null);
    areas.push({
      key: l.key,
      title: l.title,
      scoreLabel: p?.mean != null ? `${num(p.mean)} / 10` : "–",
      scoreCaption: p ? `venjur · ${pct(p.below6, p.n)}% undir 6` : "",
      scoreTone: toneFor10(p?.mean ?? null),
      headline: `${weakest?.key === l.pillarKey ? "Veikasta stoð hópsins. " : ""}${l.lead(f)}${links.find((x) => x.expected) ? ` ${links.find((x) => x.expected)!.text}` : ""}`.trim(),
      factGroups: f.length ? [{ title: "Venjur við heilsufarsskoðun", facts: f }] : [],
      links,
      subScores: ins.subScores?.[l.pillarKey] ?? [],
      change: [...habitChangeRows(ins, l.pillarKey, l.subject), ...sc.change],
      changeNote: ins.habitChange?.[l.pillarKey]?.length ? EXPLORATORY : undefined,
      changePending: sc.pending,
    });
  }

  // ── 5. Mental wellbeing ──
  const mental = pillar("mental"), wellbeing = pillar("wellbeing");
  const mf = habits(ins, "mental");
  const ms = surveyChange(ins, "Andleg líðan", "andlegri líðan");
  const energy = surveyChange(ins, "Orka", "orku");
  const dep = mf.find((x) => x.label.includes("þunglyndis")), anx = mf.find((x) => x.label.includes("kvíða (GAD"));
  areas.push({
    key: "mental",
    title: "Andleg líðan",
    scoreLabel: wellbeing?.mean != null ? `${num(wellbeing.mean)} / 10` : mental?.mean != null ? `${num(mental.mean)} / 10` : "–",
    scoreCaption: wellbeing ? "almenn vellíðan" : "andleg heilsa",
    scoreTone: toneFor10(wellbeing?.mean ?? mental?.mean ?? null),
    headline: [dep ? `${pct(dep.n, dep.of)}% með einkenni þunglyndis` : null, anx ? `${pct(anx.n, anx.of)}% með einkenni kvíða` : null].filter(Boolean).join(" og ")
      + " við heilsufarsskoðunina." + (linkSentences(ins, null, "phq9").find((x) => x.expected) ? ` ${linkSentences(ins, null, "phq9").find((x) => x.expected)!.text}` : ""),
    factGroups: mf.length ? [{ title: "Við heilsufarsskoðun", facts: mf }] : [],
    links: linkSentences(ins, null, "phq9"),
    subScores: ins.subScores?.mental ?? [],
    change: [...habitChangeRows(ins, "mental", "Streitueinkunn"), ...ms.change, ...energy.change],
    changeNote: ins.habitChange?.mental?.length ? EXPLORATORY : undefined,
    changePending: ms.pending,
  });

  return areas;
}
