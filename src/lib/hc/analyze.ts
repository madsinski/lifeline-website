// Turning a client's results into a proposed action plan.
//
// Two halves, deliberately separated:
//   1. The traffic light is DETERMINISTIC — a value is red/yellow/green
//      purely from Lifeline's reference bands (hc_knowledge). No model
//      decides whether a number is out of range.
//   2. The model only PROPOSES which actions to put in front of the client,
//      ranked, drawn from our own action library. The nurse edits the result
//      and the doctor confirms the report.
//
// Server-only: needs OPENAI_API_KEY.

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { bandForValue, type KnowledgeEntry } from "./knowledge";
import { PILLARS, type Pillar, type PlanModule } from "./types";

export const ANALYZE_MODEL = process.env.OPENAI_MODEL_ANALYZE || "gpt-5.4";

export type Signal = "green" | "yellow" | "red";

export interface FlaggedValue {
  slug: string;
  title: string;
  value: number;
  unit: string | null;
  band: string | null;
  signal: Signal;
}

/** good → green, watch → yellow, out of range (high or low) → red. */
export function signalOf(tone: string | undefined): Signal {
  if (tone === "good") return "green";
  if (tone === "watch") return "yellow";
  return "red";
}

export const SIGNAL_IS: Record<Signal, string> = { green: "Í lagi", yellow: "Fylgjast með", red: "Utan viðmiða" };

/**
 * Every recorded value with its traffic light. Values whose bands are
 * sex-specific are skipped when the client's sex is unknown — we do not guess.
 */
export function trafficLights(
  results: { marker: string; value: number; unit: string | null }[],
  entries: KnowledgeEntry[],
  sex: "m" | "f" | null,
): FlaggedValue[] {
  const out: FlaggedValue[] = [];
  for (const r of results) {
    const entry = entries.find((e) => e.slug === r.marker);
    if (!entry || !entry.bands.length) continue;
    if (!sex && entry.bands.some((b) => b.sex)) continue;
    const band = bandForValue(entry, r.value, sex);
    if (!band) continue;
    out.push({
      slug: entry.slug,
      title: entry.title,
      value: r.value,
      unit: r.unit ?? entry.unit,
      band: band.label,
      signal: signalOf(band.tone),
    });
  }
  const order: Signal[] = ["red", "yellow", "green"];
  return out.sort((a, b) => order.indexOf(a.signal) - order.indexOf(b.signal) || a.title.localeCompare(b.title, "is"));
}

// ── The proposal ────────────────────────────────────────────────────────────

/** core = the few that must happen · standard = the recommended plan · extra = if the client wants more. */
export const TIERS = ["core", "standard", "extra"] as const;
export type Tier = (typeof TIERS)[number];

/** Which tiers each preset includes. */
export const PRESETS: { key: "light" | "core" | "full"; label: string; hint: string; tiers: Tier[] }[] = [
  { key: "light", label: "Létt", hint: "Aðeins kjarninn — fyrir þá sem eru að byrja eða hafa lítinn tíma.", tiers: ["core"] },
  { key: "core", label: "Kjarni", hint: "Ráðlögð áætlun.", tiers: ["core", "standard"] },
  { key: "full", label: "Allt", hint: "Öll atriðin sem komu til greina.", tiers: ["core", "standard", "extra"] },
];

const proposalSchema = z.object({
  headline: z.string().describe("Fyrirsögn áætlunarinnar á íslensku, stutt og hvetjandi"),
  summary: z.string().describe("2–4 setningar á íslensku: hvað niðurstöðurnar segja og hvar er byrjað"),
  focus: z.array(z.object({
    pillar: z.enum(["sleep", "exercise", "nutrition", "mental"]),
    why: z.string().describe("Af hverju þessi stoð, með vísun í gildi þar sem það á við. Íslenska."),
  })).describe("Stoðirnar sem mest liggur á, mest 3"),
  actions: z.array(z.object({
    module_key: z.string().nullable().describe("Lykill úr aðgerðasafninu ef aðgerðin er þar, annars null"),
    title: z.string().describe("Heiti aðgerðar á íslensku"),
    pillar: z.enum(["sleep", "exercise", "nutrition", "mental"]),
    frequency: z.string().describe("Hversu oft, á íslensku (t.d. „daglega“, „3 sinnum í viku“)"),
    detail: z.string().describe("Hvað skjólstæðingurinn gerir nákvæmlega. Íslenska, 1–2 setningar."),
    tier: z.enum(["core", "standard", "extra"]),
    why: z.string().describe("Af hverju þetta skiptir máli fyrir þennan einstakling. Íslenska, ein setning."),
  })).describe("Raðað eftir mikilvægi, 5–9 atriði alls"),
  referrals: z.array(z.object({
    target: z.enum(["heilsugaesla", "physio", "psychologist", "nutritionist", "specialist"]),
    reason: z.string().describe("Hvað á að skoða. Niðurstaða eða einkenni — ALDREI sjúkdómsgreining. Íslenska."),
    why: z.string().describe("Ein setning um af hverju þetta á að fara áfram. Íslenska."),
  })).describe("Tilvísanir sem hjúkrunarfræðingur ætti að leggja fyrir lækni. Tómur listi ef engin þörf er."),
});

export type Proposal = z.infer<typeof proposalSchema>;
export type ProposedAction = Proposal["actions"][number];

/** A line from the Grunnheilsa report: a lifestyle score, a pillar, a risk. */
export interface ReportLine {
  title: string;
  value: number;
  unit: string;
  signal: Signal | null;
  /** The report's own advice for this row. */
  advice: string[];
  /** Earlier values, so the model can see the direction of travel. */
  previous?: number | null;
}

export interface AnalyzeInput {
  flagged: FlaggedValue[];
  /** The scores and pillars from the health report, when one was uploaded. */
  reportLines?: ReportLine[];
  /** Values we could not interpret, still useful context for the model. */
  otherValues: { title: string; value: number; unit: string | null }[];
  modules: PlanModule[];
  age: string | null;
  sex: "m" | "f" | null;
  interviewNotes: string | null;
}

const SYSTEM = `Þú ert klínískur ráðgjafi Lifeline og undirbýrð aðgerðaáætlun fyrir hjúkrunarfræðing.

Aðferðafræði Lifeline — „mest fyrir minnst“:
• Veldu fáar aðgerðir sem skila mestu. Þrjár til fimm aðgerðir í kjarna, aldrei fleiri en níu alls.
• Byrjaðu á þeirri stoð sem mest liggur á (svefn, hreyfing, næring, andleg líðan).
• Ein lykilvenja fyrst — oftast fastur fótaferðartími eða dagleg ganga — hún dregur hinar með sér.
• Stórar hreyfingar í æfingum: hnébeygja, mjaðmalyfta, ýta, toga, bera.
• Samkvæmni fram yfir fullkomnun.

Reglur sem þú mátt ekki brjóta:
• Notaðu aðgerðir úr aðgerðasafninu þegar þær passa (module_key). Búðu aðeins til nýja aðgerð þegar ekkert í safninu á við.
• Þú greinir ekki sjúkdóma, ávísar ekki meðferð og lofar engum árangri. Þú leggur til lífsstílsaðgerðir.
• Ef gildi er langt utan viðmiða skaltu nefna í summary að læknir fari yfir það — ekki setja læknisfræðilega meðferð sem aðgerð.
• Allur texti er á íslensku og ávarpar skjólstæðinginn með „þú“.
• tier: core = það sem verður að gerast, standard = ráðlögð viðbót, extra = ef viðkomandi vill meira.
• Þegar heilsufarsskýrsla fylgir skaltu byrja á þeirri stoð sem kemur verst út þar (svefn, hreyfing, næring eða andleg líðan) og vísa í töluna í rökstuðningnum.
• Umferðarljósin sem þú sérð eru viðmið Lifeline. Notaðu þau, ekki orðalag skýrslunnar.

Tilvísanir (referrals):
• Leggðu til tilvísun þegar niðurstaða kallar á mat annars fagmanns: heilsugæslu fyrir gildi utan viðmiða eða þekkta sjúkdóma, sjúkraþjálfara fyrir verki og stoðkerfi, sálfræðing fyrir andlega líðan og fíkn, næringarfræðing fyrir mataræði og matarhegðun, sérfræðing þegar sérgrein á við.
• reason er ÞAÐ SEM Á AÐ SKOÐA, aldrei sjúkdómsgreining: „Fastandi blóðsykur yfir viðmiðum“, ekki „sykursýki“.
• Leggðu ekki til tilvísun fyrir gildi sem er innan viðmiða.
• Tómur listi er rétt svar þegar ekkert kallar á tilvísun.`;

/** Ask the model for a ranked plan. Throws on model/transport errors. */
export async function proposePlan(input: AnalyzeInput): Promise<Proposal> {
  const library = input.modules
    .map((m) => `${m.key} [${m.pillar}] ${m.title} — ${m.summary}${m.frequency ? ` (${m.frequency})` : ""}`)
    .join("\n");

  const lines = (input.reportLines ?? [])
    .map((l) => {
      const arrow = l.previous == null ? "" : l.value > l.previous ? ` (upp úr ${l.previous})` : l.value < l.previous ? ` (niður úr ${l.previous})` : " (óbreytt)";
      const light = l.signal ? SIGNAL_IS[l.signal] : "engin viðmið";
      return `${l.title}: ${l.value}${l.unit ? ` ${l.unit}` : ""} → ${light}${arrow}${l.advice.length ? ` — skýrslan ráðleggur: ${l.advice[0]}` : ""}`;
    })
    .join("\n");

  const flagged = input.flagged.length
    ? input.flagged.map((f) => `${f.title}: ${f.value}${f.unit ? ` ${f.unit}` : ""} → ${SIGNAL_IS[f.signal]}${f.band ? ` (${f.band})` : ""}`).join("\n")
    : "Engin mæligildi skráð.";

  const other = input.otherValues.length
    ? input.otherValues.map((v) => `${v.title}: ${v.value}${v.unit ? ` ${v.unit}` : ""}`).join("\n")
    : "";

  const prompt = [
    `Skjólstæðingur: ${[input.age, input.sex === "m" ? "karl" : input.sex === "f" ? "kona" : null].filter(Boolean).join(", ") || "engar lýðfræðiupplýsingar"}.`,
    "",
    ...(lines ? ["ÚR HEILSUFARSSKÝRSLUNNI (lífsstílseinkunnir, stoðirnar og áhætta):", lines, ""] : []),
    "MÆLIGILDI OG VIÐMIÐ:",
    flagged,
    other ? `\nÖNNUR GILDI (engin viðmið reiknuð):\n${other}` : "",
    input.interviewNotes ? `\nÚR VIÐTALINU:\n${input.interviewNotes}` : "",
    "",
    "AÐGERÐASAFN (lykill [stoð] heiti — lýsing):",
    library || "(tómt)",
  ].join("\n");

  const result = await generateText({
    model: openai(ANALYZE_MODEL),
    output: Output.object({ schema: proposalSchema }),
    maxOutputTokens: 4000,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
  });
  const out = result.experimental_output as Proposal;
  // Keep only pillars we actually render.
  out.focus = (out.focus ?? []).filter((f) => (PILLARS as readonly string[]).includes(f.pillar)) as Proposal["focus"];
  out.actions = (out.actions ?? []).filter((a) => (PILLARS as readonly string[]).includes(a.pillar)) as Proposal["actions"];
  out.referrals = (out.referrals ?? []).filter((r) => r.reason?.trim()) as Proposal["referrals"];
  return out;
}

/** The pillars a proposal touches, in our canonical order. */
export function proposalPillars(p: Proposal): Pillar[] {
  return PILLARS.filter((pil) => p.actions.some((a) => a.pillar === pil));
}
