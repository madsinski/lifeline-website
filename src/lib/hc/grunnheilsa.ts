// Reading a Lifeline "Grunnheilsa" report — the whole thing, not just the
// blood panel: the lifestyle scores, the four pillars, the risk figures, the
// measurements, each one's traffic light, its history and the report's own
// advice.
//
// The report is a text PDF we generate ourselves, so it parses deterministically
// here: no model, nothing leaves the server. The AI path stays as a fallback
// for scans and other labs (src/lib/hc/report-import.ts).
//
// Client-safe: pure text in, structured report out.

import type { Pillar } from "./types";

export type Signal = "green" | "yellow" | "red";
export type ItemKind = "score" | "risk" | "measure" | "blood";

export interface ReportPoint { date: string; value: number }

export interface ReportItem {
  key: string;
  title: string;
  kind: ItemKind;
  /** Which of the four pillars this belongs to, where it maps cleanly. */
  pillar?: Pillar;
  /** hc_knowledge slug, so a value can open the reference entry. */
  slug?: string;
  value: number;
  unit: string;
  date: string;
  /** The report's own verdict word ("Gott", "Vægt hækkað", "Þarfnast athygli"…).
   *  Kept for reference only: Medalia's wording and cut-offs vary, so the
   *  traffic light we show comes from Lifeline's own reference ranges
   *  (hc_knowledge) — see signalForItem below. */
  label: string | null;
  reportSignal: Signal | null;
  /** Earlier measurements, oldest first — the report carries its own history. */
  trend: ReportPoint[];
  /** The report's bullet advice for this item. */
  advice: string[];
  /** "Endurmat ráðlagt eftir 12 mánuði." and the like. */
  review: string | null;
}

export interface ReportPatient {
  name: string | null;
  kennitala: string | null;
  age: number | null;
  sex: "m" | "f" | null;
  email: string | null;
  phone: string | null;
}

export interface Grunnheilsa {
  patient: ReportPatient;
  reportDate: string | null;
  items: ReportItem[];
}

/** One row of the report, with the names it can appear under. */
interface CatalogEntry {
  key: string;
  title: string;
  kind: ItemKind;
  pillar?: Pillar;
  slug?: string;
  /** Matched against the text just before the value block, lower-cased. */
  match: RegExp;
  /** The unit as we want to show it, whatever spelling the PDF used. */
  unit?: string;
}

// Order here is the order the report reads in, and the order we render.
const CATALOG: CatalogEntry[] = [
  { key: "lifstilseinkunn", title: "Lífstílseinkunn", kind: "score", slug: "lifstilseinkunn", match: /lífstílseinkunn/, unit: "stig" },
  { key: "efnaskiptaheilsa", title: "Efnaskiptaheilsa", kind: "score", slug: "efnaskiptaheilsa", match: /efnaskiptaheilsa/, unit: "stig" },
  { key: "hjartaheilsa", title: "Hjartaheilsa (10 ára áhætta)", kind: "risk", slug: "hjartaheilsa", match: /hjartaheilsa/, unit: "%" },

  { key: "svefn_vandamal", slug: "stodaeinkunnir", title: "Svefn — læknisfræðileg vandamál", kind: "score", pillar: "sleep", match: /svefn læknisfræðileg vandamál|svefn.*vandamál/, unit: "stig" },
  { key: "svefn_venjur", slug: "stodaeinkunnir", title: "Svefn — venjur", kind: "score", pillar: "sleep", match: /svefn venjur/, unit: "stig" },
  { key: "hreyfing_vandamal", slug: "stodaeinkunnir", title: "Hreyfing — læknisfræðileg vandamál", kind: "score", pillar: "exercise", match: /hreyfing læknisfræðileg vandamál|hreyfing.*vandamál/, unit: "stig" },
  { key: "hreyfing_venjur", slug: "stodaeinkunnir", title: "Hreyfing — venjur", kind: "score", pillar: "exercise", match: /hreyfing venjur/, unit: "stig" },
  { key: "naering_vandamal", slug: "stodaeinkunnir", title: "Næring — læknisfræðileg vandamál", kind: "score", pillar: "nutrition", match: /næring læknisfræðileg vandamál|næring.*vandamál/, unit: "stig" },
  { key: "naering_venjur", slug: "stodaeinkunnir", title: "Næring — venjur", kind: "score", pillar: "nutrition", match: /næring venjur/, unit: "stig" },
  { key: "matarhegdun", slug: "stodaeinkunnir", title: "Matarhegðun", kind: "score", pillar: "nutrition", match: /matarhegðun/, unit: "stig" },
  { key: "koffin", title: "Koffín", kind: "score", pillar: "sleep", slug: "koffin", match: /koffín/, unit: "stig" },
  { key: "nikotin", title: "Nikótín", kind: "score", match: /nikótín/, unit: "stig" },
  { key: "afengi", title: "Áfengi", kind: "score", match: /áfengi/, unit: "stig" },
  { key: "onnur_efni", title: "Önnur efni", kind: "score", match: /önnur efni/, unit: "stig" },
  { key: "skjanotkun", title: "Skjánotkun", kind: "score", pillar: "mental", slug: "skjanotkun-cius", match: /skjánotkun/, unit: "stig" },
  { key: "fjarhaettuspil", title: "Fjárhættuspil", kind: "score", pillar: "mental", slug: "pgsi", match: /fjárhættuspil/, unit: "stig" },
  { key: "andleg_heilsa", slug: "stodaeinkunnir", title: "Andleg heilsa", kind: "score", pillar: "mental", match: /andleg heilsa/, unit: "stig" },
  { key: "streita", slug: "stodaeinkunnir", title: "Streita", kind: "score", pillar: "mental", match: /streita/, unit: "stig" },
  { key: "vellidan", slug: "stodaeinkunnir", title: "Almenn vellíðan", kind: "score", pillar: "mental", match: /almenn vellíðan|vellíðan/, unit: "stig" },

  { key: "thyngd", title: "Þyngd", kind: "measure", match: /body weight|^þyngd/, unit: "kg" },
  { key: "bmi", title: "Líkamsþyngdarstuðull (BMI)", kind: "measure", slug: "bmi", match: /bmi/, unit: "kg/m²" },
  { key: "bp_efri", title: "Blóðþrýstingur — efri mörk", kind: "measure", slug: "blodthrystingur", match: /efri mörk/, unit: "mmHg" },
  { key: "bp_nedri", title: "Blóðþrýstingur — neðri mörk", kind: "measure", slug: "blodthrystingur-nedri", match: /neðri mörk|^meðaltal$/, unit: "mmHg" },
  { key: "fitumassi", title: "Fitumassi", kind: "measure", slug: "fitumassi", match: /fitumassi/, unit: "%" },
  { key: "vodvamassi", title: "Vöðvamassi", kind: "measure", slug: "vodvamassi", match: /vöðvamassi/, unit: "%" },

  { key: "blodsykur", title: "Fastandi blóðsykur", kind: "blood", slug: "fastandi-blodsykur", match: /blood glucose|blóðsykur/, unit: "mmol/L" },
  { key: "insulin", title: "Insúlín", kind: "blood", slug: "insulin", match: /^insulin|insúlín/, unit: "mIU/L" },
  { key: "hba1c", title: "HbA1c", kind: "blood", slug: "hba1c", match: /hemoglobin a1c|hba1c/, unit: "mmol/mol" },
  { key: "homa_ir", title: "HOMA-IR", kind: "blood", slug: "homa-ir", match: /homa-ir/, unit: "" },
  { key: "kolesterol", title: "Heildarkólesteról", kind: "blood", slug: "heildarkolesterol", match: /total cholesterol|heildarkólesteról/, unit: "mmol/L" },
  { key: "hdl", title: "HDL-kólesteról", kind: "blood", slug: "hdl", match: /hdl cholesterol|hdl/, unit: "mmol/L" },
  { key: "ldl", title: "LDL-kólesteról", kind: "blood", slug: "ldl", match: /ldl cholesterol|ldl/, unit: "mmol/L" },
  { key: "thriglyserid", title: "Þríglýseríð", kind: "blood", slug: "thriglyserid", match: /triglyceride|þríglýseríð/, unit: "mmol/L" },
  { key: "alat", title: "ALAT (ALT)", kind: "blood", slug: "alt", match: /alat/, unit: "U/L" },
  { key: "asat", title: "ASAT (AST)", kind: "blood", slug: "ast", match: /asat/, unit: "U/L" },
];

/** The report's own three verdicts, and anything else it prints verbatim. */
const VERDICTS: { re: RegExp; signal: Signal }[] = [
  { re: /^gott$/i, signal: "green" },
  { re: /^sæmilegt$/i, signal: "yellow" },
  { re: /^ábótavant$/i, signal: "red" },
];

/** Lines that describe a value without being the traffic light itself. */
const VALUE_WORDS = /^(vægt hækkað|hækkað|lækkað|lágt|hátt|eðlilegt|kjörsvið|of hátt|of lágt|þarfnast athygli|lítil áhætta|miðlungs áhætta|há áhætta)$/i;

/** PDF text as the extractor gives it: soft hyphens, words split over lines. */
export function normalizeReportText(raw: string): string {
  return raw
    .replace(/­/g, "")
    .replace(/-\n(?=[a-záéíóúýþæöð])/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n");
}

const num = (s: string): number | null => {
  const m = s.replace(/\./g, ".").match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Is this a Lifeline Grunnheilsa report at all? */
export function isGrunnheilsa(raw: string): boolean {
  const text = normalizeReportText(raw);
  return /Grunnheilsa skýrsla/i.test(text) && /Dagsetning\s*\n?\s*Gildi/i.test(text);
}

function parsePatient(text: string): ReportPatient {
  // The clinic's own kennitala heads the page; the client's follows their name.
  const head = text.slice(0, 1200);
  const nameLine = head.match(/Grunnheilsa skýrsla\s*\n(.+?)\s*\((Karl|Kona|Annað)[,\s]+(\d{1,3})\)/i);
  const kts = [...head.matchAll(/Kennitala:\s*([\d-]{10,11})/g)].map((m) => m[1].replace(/\D/g, ""));
  const email = head.match(/Netfang:\s*(\S+@\S+)/)?.[1] ?? null;
  const phone = head.match(/Sími:\s*([+\d\s]{5,20})/g)?.at(-1)?.replace(/Sími:\s*/, "").trim() ?? null;
  const sexWord = nameLine?.[2]?.toLowerCase();
  return {
    name: nameLine?.[1]?.trim() ?? null,
    // The first kennitala is the clinic's; the client's is the second.
    kennitala: kts.length > 1 ? kts[1] : null,
    age: nameLine?.[3] ? Number(nameLine[3]) : null,
    sex: sexWord === "karl" ? "m" : sexWord === "kona" ? "f" : null,
    email,
    phone,
  };
}

const MONTHS_IS = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];

function parseReportDate(text: string): string | null {
  const m = text.match(/Dagsetning:\s*(\d{1,2})\.\s*([^\s.]+)\.?\s*(\d{4})/);
  if (!m) return null;
  const mi = MONTHS_IS.findIndex((x) => m[2].toLowerCase().startsWith(x));
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/**
 * Pull every measured row out of the report. Each row prints as a label, then
 * "Dagsetning / Gildi", then one or more dated values (the history), then the
 * unit, an explanation, the traffic light and the report's advice.
 */
export function parseGrunnheilsa(raw: string): Grunnheilsa {
  const text = normalizeReportText(raw);
  const items: ReportItem[] = [];
  const seen = new Set<string>();

  // Each row prints its label, then "Dagsetning / Gildi", then dated values.
  // The text extractor runs the date straight into the value ("2026-09-134.5")
  // and drops the unit on its own line, so read them as one stream.
  const heads = [...text.matchAll(/Dagsetning\s*\n?\s*Gildi/g)];
  for (const h of heads) {
    const at = h.index ?? 0;
    const before = text.slice(Math.max(0, at - 200), at).split("\n").map((l) => l.trim()).filter(Boolean);
    // The line right above the block is the lab's own name for the row
    // ("Insulin", "HOMA-IR"); the lines above that are the explanation.
    const lastLine = (before.at(-1) ?? "").toLowerCase();
    const labelText = before.slice(-3).join(" ").toLowerCase();
    const entry =
      CATALOG.find((c) => !seen.has(c.key) && c.match.test(lastLine)) ??
      CATALOG.find((c) => !seen.has(c.key) && c.match.test(labelText));
    if (!entry) continue;

    const window = text.slice(at + h[0].length, at + h[0].length + 1400);
    const points: ReportPoint[] = [];
    let unit = "";
    let cursor = 0;
    const pair = /(\d{4}-\d{2}-\d{2})\s*(-?\d+(?:[.,]\d+)?)/g;
    for (const m of window.matchAll(pair)) {
      const idx = m.index ?? 0;
      // A long stretch of prose means the row is over and the next one began.
      if (points.length && idx - cursor > 60) break;
      const v = Number(m[2].replace(",", "."));
      if (Number.isFinite(v)) points.push({ date: m[1], value: v });
      if (!unit) {
        const after = window.slice(idx + m[0].length, idx + m[0].length + 24).trim();
        const u = after.match(/^\n?\s*(%\s*risk|stig|index|mmol\/mol|mmol\/L|mIU\/L|µg\/L|U\/L|mmHg|kg\/m2|kg|%)/i);
        if (u) unit = u[1].replace(/\s+/g, " ");
      }
      cursor = idx + m[0].length;
    }
    if (!points.length) continue;
    const last = points[points.length - 1];

    // The traffic light and the report's advice follow the values.
    const after = window.slice(cursor, cursor + 1400).split("\n").map((l) => l.trim());
    let label: string | null = null;
    let signal: Signal | null = null;
    const advice: string[] = [];
    let review: string | null = null;
    for (const line of after) {
      if (!line) continue;
      if (!signal) {
        const v = VERDICTS.find((x) => x.re.test(line));
        if (v) { signal = v.signal; label ??= line; continue; }
        if (VALUE_WORDS.test(line)) { label ??= line; continue; }
      }
      if (line.startsWith("•")) { advice.push(line.replace(/^•\s*/, "")); continue; }
      if (/^Endurmat/i.test(line)) { review = line; break; }
      if (advice.length) advice[advice.length - 1] = `${advice[advice.length - 1]} ${line}`.replace(/\s+/g, " ");
    }

    seen.add(entry.key);
    items.push({
      key: entry.key,
      title: entry.title,
      kind: entry.kind,
      pillar: entry.pillar,
      slug: entry.slug,
      value: Math.round(last.value * 100) / 100,
      unit: entry.unit ?? unit,
      date: last.date,
      label,
      reportSignal: signal,
      trend: points.slice(0, -1).map((p) => ({ ...p, value: Math.round(p.value * 100) / 100 })),
      advice: advice.map((a) => a.trim()).filter(Boolean).slice(0, 6),
      review,
    });
  }

  // Report order, not the order they happened to appear.
  items.sort((a, b) => CATALOG.findIndex((c) => c.key === a.key) - CATALOG.findIndex((c) => c.key === b.key));

  return { patient: parsePatient(text), reportDate: parseReportDate(text), items };
}

/**
 * The traffic light we stand behind.
 *
 * Lifeline's own reference ranges decide it — the same ranges the app uses
 * (hc_knowledge, unified with fhir-health-dashboard/src/lib/bloodMarkers.ts).
 * The Medalia report prints its own verdicts with varying wording and
 * cut-offs; those are shown as a footnote where they disagree, never as the
 * answer. Items we have no range for (weight, metabolic-health composite)
 * fall back to the report's 0–10 bands, and cardiovascular risk to SCORE2.
 */
export function signalForItem(
  item: ReportItem,
  band: (slug: string, value: number) => Signal | null,
): Signal | null {
  if (item.slug) {
    const ours = band(item.slug, item.value);
    if (ours) return ours;
  }
  if (item.kind === "score") return scoreSignal(item.value);
  if (item.kind === "risk") return item.value < 5 ? "green" : item.value < 10 ? "yellow" : "red";
  return item.reportSignal;
}

/** Scores are 0–10 with the report's own bands; use them when it printed none. */
export function scoreSignal(value: number): Signal {
  if (value >= 7.5) return "green";
  if (value >= 5) return "yellow";
  return "red";
}

export const SIGNAL_LABEL: Record<Signal, string> = { green: "Gott", yellow: "Sæmilegt", red: "Ábótavant" };

/** Every item's traffic light, worked out from our own reference ranges.
 *  Computed on the server so the workstation and the client's account cannot
 *  drift apart — and so a client never has to be handed the whole reference
 *  book to render their own report. */
export function signalsForReport(
  report: Grunnheilsa,
  band: (slug: string, value: number) => Signal | null,
): Record<string, Signal | null> {
  const out: Record<string, Signal | null> = {};
  for (const item of report.items) out[item.key] = signalForItem(item, band);
  return out;
}
