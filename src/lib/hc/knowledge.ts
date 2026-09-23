// Uppflettirit — the nurse's clinical reference (table hc_knowledge).
// Client-safe: types, Icelandic-tolerant search, and band evaluation so the
// workstation can answer a typed value ("insúlín 18") on the spot.

export type KnowledgeCategory = "blood" | "body" | "mental" | "lifestyle" | "score" | "method";
export type BandTone = "good" | "watch" | "high" | "low";

/** One value range. `min` is inclusive, `max` exclusive; null means open-ended. */
export interface KnowledgeBand {
  label: string;
  tone: BandTone;
  min?: number | null;
  max?: number | null;
  /** "m" / "f" when the range differs by sex; omitted when it applies to everyone. */
  sex?: "m" | "f" | null;
  note?: string | null;
}

export interface KnowledgeEntry {
  slug: string;
  category: KnowledgeCategory;
  title: string;
  aliases: string[];
  unit: string | null;
  summary: string;
  body_md: string | null;
  bands: KnowledgeBand[];
  higher_better: boolean | null;
  sources: string[];
  tags: string[];
  sort: number;
}

/**
 * What one report row needs in order to teach: its range, why the number
 * matters, and what moves it either way. Built server-side (report-store)
 * and handed to the view, which then needs no slug logic of its own.
 */
export interface ReportReference {
  title: string;
  unit: string | null;
  summary: string;
  bands: KnowledgeBand[];
  higher_better: boolean | null;
  improves: string[];
  worsens: string[];
}

export const CATEGORY_IS: Record<KnowledgeCategory, string> = {
  blood: "Blóðprufa",
  body: "Mælingar",
  mental: "Andleg líðan og fíkn",
  lifestyle: "Lífsstíll",
  score: "Einkunnir",
  method: "Aðferðafræði",
};

export const TONE_IS: Record<BandTone, string> = { good: "Kjörsvið", watch: "Fylgjast með", high: "Yfir mörkum", low: "Undir mörkum" };

export const TONE_CLASS: Record<BandTone, string> = {
  good: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  watch: "bg-amber-50 text-amber-800 ring-amber-200",
  high: "bg-red-50 text-red-700 ring-red-200",
  low: "bg-blue-50 text-blue-700 ring-blue-200",
};

// ── Search ──────────────────────────────────────────────────────────────────

/** Fold Icelandic (and English) spelling so "insulin", "insúlín" and
 *  "INSÚLÍN " all match: accents dropped, þ→th, æ→ae, ð→d. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/þ/g, "th").replace(/æ/g, "ae").replace(/ð/g, "d").replace(/ö/g, "o")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s.+/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A typed number in the query — "insúlín 18", "18 insulin", "hba1c 42,5". */
export function parseValue(q: string): number | null {
  const m = fold(q).match(/(?:^|\s)(\d+(?:[.,]\d+)?)(?:\s|$)/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Query with any numeric value stripped out — the part that names a topic. */
export function queryTerms(q: string): string[] {
  return fold(q).replace(/(?:^|\s)\d+(?:[.,]\d+)?(?=\s|$)/g, " ").split(" ").filter((t) => t.length > 1);
}

function scoreEntry(e: KnowledgeEntry, terms: string[]): number {
  if (!terms.length) return 0;
  const title = fold(e.title);
  const aliases = e.aliases.map(fold);
  const tags = e.tags.map(fold);
  const body = fold(`${e.summary} ${e.body_md ?? ""}`);
  let score = 0;
  for (const t of terms) {
    if (title === t || aliases.includes(t)) score += 12;
    else if (title.startsWith(t) || aliases.some((a) => a.startsWith(t))) score += 8;
    else if (title.includes(t) || aliases.some((a) => a.includes(t))) score += 6;
    else if (tags.some((g) => g.includes(t))) score += 3;
    else if (body.includes(t)) score += 2;
    else return 0; // every term must land somewhere
  }
  return score;
}

/** Best matches first. An empty query returns everything, in curated order. */
export function searchKnowledge(entries: KnowledgeEntry[], q: string): KnowledgeEntry[] {
  const terms = queryTerms(q);
  if (!terms.length) return [...entries].sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, "is"));
  return entries
    .map((e) => ({ e, s: scoreEntry(e, terms) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.sort - b.e.sort)
    .map((x) => x.e);
}

// ── Bands ───────────────────────────────────────────────────────────────────

/** The bands that apply to a sex ("m"/"f"); sex-neutral bands always apply. */
export function bandsFor(entry: KnowledgeEntry, sex?: "m" | "f" | null): KnowledgeBand[] {
  const hasSexed = entry.bands.some((b) => b.sex);
  if (!hasSexed || !sex) return entry.bands;
  return entry.bands.filter((b) => !b.sex || b.sex === sex);
}

/** Which band a value falls in, or null when it is outside every range. */
export function bandForValue(entry: KnowledgeEntry, value: number, sex?: "m" | "f" | null): KnowledgeBand | null {
  for (const b of bandsFor(entry, sex)) {
    const okMin = b.min == null || value >= b.min;
    const okMax = b.max == null || value < b.max;
    if (okMin && okMax) return b;
  }
  return null;
}

/** "2–25", "<1.9", "≥1.0" — how a band's range reads in the UI. */
export function bandRangeText(b: KnowledgeBand, unit?: string | null): string {
  const u = unit ? ` ${unit}` : "";
  const n = (x: number) => String(x).replace(".", ",");
  if (b.min != null && b.max != null) return `${n(b.min)}–${n(b.max)}${u}`;
  if (b.min != null) return `≥ ${n(b.min)}${u}`;
  if (b.max != null) return `< ${n(b.max)}${u}`;
  return "—";
}
