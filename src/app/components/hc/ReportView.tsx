"use client";

// The Grunnheilsa report, readable — and made to teach.
//
// The PDF is eighteen pages of prose. This is the same content arranged so the
// eye walks down it in one pass:
//
//   1. Where you stand        — one number, and how many rows are off
//   2. What matters most now  — the red rows, each with its first action
//   3. The four pillars       — the mental model everything else hangs on
//   4. The detail             — grouped by what the body is doing, not by
//                               which machine produced the number
//
// Every row opens. Inside is the reference range drawn to scale with the value
// marked on it, why the number matters, what moves it the right way and what
// moves it the wrong way. That last pair is the point: a client should leave
// understanding what to do, not just what is red.
//
// The traffic lights are Lifeline's own reference ranges — the same ones the
// app uses. Medalia prints its own verdicts with varying wording and cut-offs;
// where they disagree we say so quietly rather than pretend.

import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown, Minus, Plus, TrendingDown, TrendingUp, Upload } from "lucide-react";
import type { Pillar } from "@/lib/hc/types";
import { SIGNAL_LABEL, type Grunnheilsa, type ReportItem, type Signal } from "@/lib/hc/grunnheilsa";
import type { KnowledgeBand, ReportReference } from "@/lib/hc/knowledge";
import { badgeClass } from "./Badge";
import { hcCard, hcKicker } from "./ui";

const DOT: Record<Signal, string> = { green: "bg-hc-signal-green", yellow: "bg-hc-signal-yellow", red: "bg-hc-signal-red" };

const CHIP: Record<Signal, string> = {
  green: "bg-hc-ok-surface text-hc-ok-ink ring-hc-ok-ink/30",
  yellow: "bg-hc-warn-surface text-hc-warn-ink ring-hc-warn-ink/30",
  red: "bg-hc-bad-surface text-hc-bad-ink ring-hc-bad-ink/30",
};
const TONE_BAR: Record<KnowledgeBand["tone"], string> = {
  good: "bg-hc-signal-green",
  watch: "bg-hc-signal-yellow",
  high: "bg-hc-signal-red",
  low: "bg-hc-mental",
};

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const fmt1 = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

// Written out by hand: a browser without the Icelandic locale data falls back
// to English and prints "July 12, 2026" in the middle of an Icelandic page.
const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
function longDateIs(iso: string | null): string | null {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${Number(m[3])}. ${MONTHS_IS[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * The detail, grouped the way a clinician explains it rather than by which
 * machine produced the number: what you do, then what your metabolism is
 * doing, then the heart, the liver, and the body itself.
 *
 * Rows are matched by key so the order is ours, not the PDF's. Anything the
 * report grows that we have not listed still lands in the last group.
 */
/*
 * A section's colours, as CSS variables rather than hex.
 *
 * The heading used to print its title in the raw accent (#CA8A04, #0EA5E9 —
 * under 3:1 on white) and tint itself by appending "14" to the hex, which
 * only works for hex and not for a token that changes in the dark theme.
 * edge = the 3px rule on the left, ink = text, soft = the heading wash —
 * each one a pair from globals.css that holds AA in both themes.
 */
interface Tone { edge: string; ink: string; soft: string }
const tok = (n: string) => `var(--hc-${n})`;
const pillarTone = (p: Pillar): Tone => ({ edge: tok(p), ink: tok(`${p}-ink`), soft: tok(`${p}-soft`) });
const TONE = {
  habits: { edge: tok("muted"), ink: tok("ink-2"), soft: tok("sunken") },
  metabolic: { edge: tok("brand"), ink: tok("brand-text"), soft: tok("brand-surface") },
  heart: { edge: tok("signal-red"), ink: tok("bad-ink"), soft: tok("bad-surface") },
  liver: { edge: tok("signal-yellow"), ink: tok("warn-ink"), soft: tok("warn-surface") },
  body: { edge: tok("info-ink"), ink: tok("info-ink"), soft: tok("info-surface") },
  rest: { edge: tok("muted"), ink: tok("ink-2"), soft: tok("sunken") },
} satisfies Record<string, Tone>;

const SECTIONS: {
  key: string; title: string; blurb: string; accent: Tone; keys?: string[];
  /** One of the four questionnaire pillars; its header shows their average. */
  pillar?: Pillar;
  /**
   * A section with a single composite score of its own, which belongs in
   * the heading rather than as the first row underneath it — the row and
   * the heading would otherwise print the same number twice.
   */
  scoreKey?: string;
}[] = [
  { pillar: "sleep" as Pillar, key: "sleep", title: "Svefn", blurb: "", accent: pillarTone("sleep"),
    keys: ["svefn_vandamal", "svefn_venjur"] },
  { pillar: "exercise" as Pillar, key: "exercise", title: "Hreyfing", blurb: "", accent: pillarTone("exercise"),
    keys: ["hreyfing_vandamal", "hreyfing_venjur"] },
  { pillar: "nutrition" as Pillar, key: "nutrition", title: "Næring", blurb: "", accent: pillarTone("nutrition"),
    keys: ["naering_vandamal", "naering_venjur"] },
  { pillar: "mental" as Pillar, key: "mental", title: "Andleg líðan", blurb: "", accent: pillarTone("mental"),
    keys: ["andleg_heilsa", "streita", "vellidan"] },
  { key: "habits", title: "Ávanar", blurb: "Nikótín, áfengi og önnur efni. 10 þýðir engin notkun.", accent: TONE.habits,
    // Caffeine, screens and gambling are habits, whatever pillar the
    // questionnaire files their score under. A number in the Svefn heading
    // that counted caffeine while caffeine was listed elsewhere would
    // describe rows the reader cannot see.
    keys: ["nikotin", "afengi", "onnur_efni", "koffin", "skjanotkun", "fjarhaettuspil", "matarhegdun"] },
  { scoreKey: "efnaskiptaheilsa", key: "metabolic", title: "Efnaskipti", blurb: "Hvernig líkaminn heldur blóðsykri í skefjum. Hér sést álag fyrst.", accent: TONE.metabolic,
    keys: ["efnaskiptaheilsa", "blodsykur", "insulin", "hba1c", "homa_ir"] },
  { key: "heart", title: "Hjarta og blóðfitur", blurb: "Blóðþrýstingur og blóðfitur — það sem ræður áhættunni til langs tíma.", accent: TONE.heart,
    keys: ["hjartaheilsa", "bp_efri", "bp_nedri", "kolesterol", "hdl", "ldl", "thriglyserid"] },
  { key: "liver", title: "Lifur", blurb: "Lifrarensím. Þau svara vel breytingum á áfengi, sykri og þyngd.", accent: TONE.liver,
    keys: ["alat", "asat"] },
  { key: "body", title: "Líkamssamsetning", blurb: "Þyngd segir lítið ein; samsetningin segir meira.", accent: TONE.body,
    keys: ["thyngd", "bmi", "fitumassi", "vodvamassi"] },
  { key: "rest", title: "Annað úr skýrslunni", blurb: "", accent: TONE.rest },
];

export default function ReportView({ report, signals, reference, sex, audience = "staff", onUpload }: {
  report: Grunnheilsa;
  /** Traffic lights from Lifeline's reference ranges, computed on the server. */
  signals: Record<string, Signal | null>;
  /** Reference ranges and teaching text, keyed by report row. */
  reference?: Record<string, ReportReference>;
  /** Which sex the bands were read for; sex-specific ranges need it. */
  sex?: "m" | "f" | null;
  /** The client sees their own report; staff see the name in the header. */
  audience?: "staff" | "client";
  /** Jump to the upload. In the hero, because a new report is why most
      people come back to this page at all. */
  onUpload?: () => void;
}) {
  /**
   * The score in each section heading, averaged over the rows that section
   * actually shows.
   *
   * It used to average by the questionnaire's own pillar tag, which stopped
   * being the same thing the moment caffeine moved from Svefn to Ávanar: the
   * Svefn heading would have gone on counting a row the reader could no
   * longer see under it. A heading number should describe what is beneath
   * it, so it is computed from the section's own key list.
   */
  const sectionAvg = useMemo(() => {
    const byKey = new Map(report.items.map((i) => [i.key, i]));
    const out = new Map<string, number>();
    for (const sec of SECTIONS) {
      if (sec.scoreKey) {
        const c = byKey.get(sec.scoreKey);
        if (c) out.set(sec.key, c.value);
        continue;
      }
      if (!sec.pillar || !sec.keys) continue;
      const rows = sec.keys.map((k) => byKey.get(k)).filter((i) => i?.kind === "score");
      if (rows.length) out.set(sec.key, rows.reduce((n, i) => n + i!.value, 0) / rows.length);
    }
    return out;
  }, [report.items]);
  /** Where the plan starts: the weakest of the four questionnaire pillars. */
  const weakest = useMemo(() => {
    let k: string | null = null, v = Infinity;
    for (const sec of SECTIONS) {
      if (!sec.pillar) continue;
      const a2 = sectionAvg.get(sec.key);
      if (a2 !== undefined && a2 < v) { v = a2; k = sec.key; }
    }
    return k;
  }, [sectionAvg]);

  /** Show only one colour, or all of them. */
  const [only, setOnly] = useState<Signal | null>(null);

  const lit = useMemo(
    () => report.items.map((item) => ({ item, signal: signals[item.key] ?? null })),
    [report.items, signals],
  );

  const counts = {
    red: lit.filter((x) => x.signal === "red").length,
    yellow: lit.filter((x) => x.signal === "yellow").length,
    green: lit.filter((x) => x.signal === "green").length,
  };
  const overall = report.items.find((i) => i.key === "lifstilseinkunn");
  const focus = lit.filter((x) => x.signal === "red").slice(0, 4);
  // Every row a section claimed, so "Annað" really is only the remainder.
  const claimed = new Set([...SECTIONS.flatMap((s) => s.keys ?? []), "lifstilseinkunn"]);

  return (
    <div className="space-y-6">
      {/* 1 ── Where you stand */}
      {/* A pale hero, so the counts can wear the row colours.
          It was a dark green card with the boxes washed into it at 25%
          opacity — three tints of white, legible only as "not the same".
          The boxes use CHIP now, the exact classes every pill further down
          the page uses, which means the hero cannot be dark: a green chip
          needs a light ground to be green on. */}
      <section className={`overflow-hidden p-5 sm:p-6 ${hcCard.base}`}>
        {/* The score sits at the right edge, the size of what it is.
            It was inside the heading — "Lífstílseinkunn 7,4" as one line of
            text — which made the number the same weight as the word in
            front of it. Every section below puts its own score at the right
            edge, so the eye runs straight down that column; the overall one
            belongs at the top of that column, not buried in a sentence. */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`${hcKicker} text-hc-brand-text`}>Heilsufarsskýrsla</p>
            <h2 className="mt-1 text-2xl font-bold text-hc-ink sm:text-3xl">
              {overall ? "Lífstílseinkunn" : "Niðurstöður"}
            </h2>
            <p className="mt-1 text-sm text-hc-ink-2">
              {report.reportDate ? `Skýrsla ${longDateIs(report.reportDate)}` : "Úr heilsufarsskoðuninni"}
              {report.patient.name && audience === "staff" ? ` · ${report.patient.name}` : ""}
            </p>
          </div>

          {/* Good first, and each box in its own colour.
              Worst-first is a clinician's reading order — it puts the alarm
              at the front. For the person whose report it is, starting on
              what is fine and working toward what is not is the same
              information without opening on bad news. The tints are the
              same three the rows use, so a box and a dot mean one thing.
              The upload shares this line as an icon: it is an errand, not a
              finding, and a full-width button made it look like the page's
              main action. */}
          {/* A pill in its own verdict's colour, not a big number.
              48px of dark text was the loudest thing on a page whose whole
              job is the traffic lights below it — size was doing the work
              that colour does better and more precisely. The pill wears the
              same three tints every row and every section score uses, so
              7,9 does not just read as large, it reads as green. */}
          {overall && (
            <span className={`flex shrink-0 items-baseline gap-1.5 rounded-full px-4 py-1.5 ring-1 ${
              CHIP[signals[overall.key] ?? "green"]}`}>
              <span className="text-3xl font-bold leading-none tabular-nums">{fmt(overall.value)}</span>
              <span className="text-xs font-semibold opacity-70">af 10</span>
            </span>
          )}
        </div>

        {/* Full width, three across. They were content-width boxes huddled
            at one end of the row with the hero's own padding beside them;
            spanning the card gives each count the same room and lines their
            edges up with everything else on the page. */}
        <div className="mt-4 grid grid-cols-3 items-stretch gap-2">
            {/* Each box filters the page to its own colour. A count you
                cannot act on is trivia; "4 ábótavant" is only useful if the
                next thing you can do is see which four. Pressing it again
                puts everything back. */}
            {(["green", "yellow", "red"] as const).map((sig) => (
              <button key={sig} type="button" aria-pressed={only === sig}
                onClick={() => setOnly(only === sig ? null : sig)}
                disabled={!counts[sig]}
                aria-label={`Sýna aðeins: ${SIGNAL_LABEL[sig]}`}
                className={`min-h-11 rounded-hc-element px-3 py-2.5 text-center ring-1 transition disabled:opacity-40 ${CHIP[sig]} ${
                  only === sig ? "ring-2 ring-offset-1 ring-offset-hc-surface" : "hover:brightness-95"}`}>
                <p className="text-xl font-bold tabular-nums">{counts[sig]}</p>
                <p className="text-[11px] font-semibold leading-tight">{SIGNAL_LABEL[sig]}</p>
              </button>
            ))}
          </div>

        {/* Under the counts, and deliberately short.
            An icon alone said nothing about what it would do, and a
            full-height button beside the three counts made an errand look
            like the page's main action. Its own low row with words on it is
            findable without competing. */}
        {onUpload && (
          <button type="button" onClick={onUpload}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-hc-element bg-hc-sunken-2 px-4 py-2 text-xs font-semibold text-hc-ink-2 ring-1 ring-hc-hairline transition hover:bg-hc-brand-surface hover:text-hc-brand-text">
            <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Ertu með nýrri skýrslu? Hlaða upp
          </button>
        )}
      </section>

      {only && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-hc-element bg-hc-sunken-2 px-4 py-2.5">
          <p className="min-w-0 flex-1 text-sm font-semibold text-hc-ink-2">
            Sýni aðeins: {SIGNAL_LABEL[only].toLowerCase()} ({counts[only]})
          </p>
          <button type="button" onClick={() => setOnly(null)}
            className="-my-2 inline-flex min-h-11 shrink-0 items-center text-sm font-bold text-hc-brand-text hover:underline">Sýna allt</button>
        </div>
      )}

      {/* 2 ── What matters most now */}
      {!only && focus.length > 0 && (
        <section>
          <SectionTitle>Það sem skiptir mestu núna</SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2">
            {focus.map(({ item }) => {
              const r = reference?.[item.key];
              // The report's own priority-1 line is about this person; our
              // generic lever is only the fallback.
              const first = item.recommendations.find((x) => x.priority === "red")?.text
                ?? r?.improves?.[0] ?? item.advice[0];
              return (
                <li key={item.key} className="rounded-hc-card bg-hc-bad-surface px-4 py-3 ring-1 ring-hc-bad-ink/30">
                  <p className="flex items-baseline gap-2">
                    <span className="font-bold text-hc-ink">{item.title}</span>
                    <span className="ml-auto shrink-0 font-bold tabular-nums text-hc-bad-ink">
                      {fmt(item.value)}{item.unit ? ` ${item.unit}` : ""}
                    </span>
                  </p>
                  {first && (
                    <p className="mt-1 text-sm leading-snug text-hc-ink-2">
                      <span className="font-semibold text-hc-bad-ink">Fyrsta skrefið: </span>{first}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 3 ── The four pillars */}

      {/* 4 ── The detail */}
      {SECTIONS.map((s) => {
        const avg = sectionAvg.get(s.key);
        const rows = s.keys
          ? s.keys.filter((k) => k !== s.scoreKey)
              .map((k) => lit.find((x) => x.item.key === k)).filter((x): x is (typeof lit)[number] => !!x)
          : lit.filter((x) => !claimed.has(x.item.key));
        /* Filtered to one colour, a section with nothing of that colour is
           not an empty section — it is not a section. */
        const shown = only ? rows.filter((r) => r.signal === only) : rows;
        if (!shown.length) return null;
        const off = rows.filter((r) => r.signal === "red").length;
        return (
          <section key={s.key}
            className={`overflow-hidden border-l-[3px] ${hcCard.base}`}
            style={{ borderLeftColor: s.accent.edge }}>
            {/* A wash of the section's own colour behind the heading. Enough
                to break the page into blocks, not enough to compete with the
                traffic lights, which are the only thing that means anything. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5" style={{ backgroundColor: s.accent.soft }}>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: s.accent.ink }}>{s.title}</h3>
              {/* The section's own score, where the four summary cards used
                  to put it. "af 10" rather than a sentence explaining the
                  scale: the scale needs saying once, not four times. */}
              {/* ml-auto on the chip, so it and the score travel together
                  to the right edge: the score is what the eye runs down,
                  and "byrjum hér" belongs beside its own number rather than
                  next to a title three words long. */}
              {s.pillar && s.key === weakest && (
                <span className={`ml-auto ${badgeClass("brand")}`}>byrjum hér</span>
              )}
              {avg !== undefined && (
                <span className={`flex items-baseline gap-1 ${s.pillar && s.key === weakest ? "" : "ml-auto"}`}>
                  <span className="text-3xl font-bold tabular-nums leading-none" style={{ color: s.accent.ink }}>{fmt1(avg)}</span>
                  <span className="text-xs font-semibold text-hc-ink-2">af 10</span>
                </span>
              )}
              {/* Only the red one survives. The amber chip and "Allt í lagi"
                  said what every row below says with its own traffic light,
                  and the score now carries the summary. A value outside the
                  reference range is the one thing worth saying twice. */}
              {off > 0 && (
                <span className={badgeClass("bad")}>{off} utan viðmiða</span>
              )}
              {/* order-last keeps the subtext under the whole line, so the
                  score sits beside the title rather than after a sentence. */}
              {s.blurb && <p className="order-last w-full text-xs font-normal normal-case tracking-normal text-hc-ink-2">{s.blurb}</p>}
            </div>
            <ul className="divide-y divide-hc-hairline">
              {shown.map(({ item, signal }) => (
                <Row key={item.key} item={item} signal={signal} entry={reference?.[item.key]} sex={sex ?? null} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-hc-ink-2">{children}</h3>;
}

/* Pillars lived here: four cards headed "Stoðirnar fjórar", each summarising
   one of the four sections immediately below them. Four cards above four
   sections saying the same thing is the page twice, and the card held the
   number while the section it summarised did not. The number moved into the
   section heading, "byrjum hér" with it. */

function Row({ item, signal, entry, sex }: {
  item: ReportItem;
  signal: Signal | null;
  entry?: ReportReference;
  sex: "m" | "f" | null;
}) {
  const [open, setOpen] = useState(false);
  // Medalia's own verdict, when it disagrees with our reference range.
  const disagrees = item.reportSignal && signal && item.reportSignal !== signal;
  const flaggedCount = item.recommendations.filter((r) => r.priority === "red" || r.priority === "yellow").length;
  const last = item.trend.at(-1);
  const move = last ? item.value - last.value : 0;
  const improves = entry?.improves ?? [];
  const worsens = entry?.worsens ?? [];

  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hc-sunken">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${signal ? DOT[signal] : "bg-hc-border"}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-hc-ink">{item.title}</span>
          <span className="block text-xs text-hc-ink-2">
            {signal ? SIGNAL_LABEL[signal] : "Engin viðmið"}
            {disagrees ? ` · skýrslan segir „${item.label}“` : ""}
            {/* A good score can sit on top of several habits that are missing:
                "Hreyfing — venjur" scores 7,5 and still carries three red
                components. Saying so here stops the dots inside the dropdown
                reading as a contradiction of the verdict above them. */}
            {flaggedCount > 0 && (
              <span className={signal === "green" ? "font-medium text-hc-warn-ink" : ""}>
                {" · "}{flaggedCount} {flaggedCount === 1 ? "atriði" : "atriði"} til að taka á
              </span>
            )}
          </span>
        </span>
        {item.trend.length > 0 && (
          <span className={`hidden items-center gap-1 text-xs sm:flex ${move > 0 ? "text-hc-ok-ink" : move < 0 ? "text-hc-ink-2" : "text-hc-ink-3"}`}>
            {move > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : move < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            {move !== 0 ? `${move > 0 ? "+" : ""}${fmt(move)}` : "óbreytt"}
          </span>
        )}
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ring-1 ${signal ? CHIP[signal] : "bg-hc-sunken text-hc-ink-2 ring-hc-hairline"}`}>
          {fmt(item.value)}{item.unit ? ` ${item.unit}` : ""}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-hc-ink-3 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-hc-hairline bg-hc-sunken px-4 py-4">
          {entry && entry.bands.length > 0 && (
            <BandScale bands={entry.bands} value={item.value} unit={item.unit || entry.unit} sex={sex} />
          )}

          {item.recommendations.length > 0 && (
            <Block title="Það sem á að taka á">
              <ul className="space-y-1.5">
                {item.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${DOT[r.priority]}`} aria-hidden />
                    <span className="text-sm leading-snug text-hc-ink-2">
                      {r.component && <span className="font-semibold">{r.component}: </span>}
                      {r.text}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-hc-ink-2">
                Úr ráðleggingum skýrslunnar. Rauður punktur er forgangur 1, gulur forgangur 2.
              </p>
            </Block>
          )}

          {!!entry?.components?.length && (
            <Block title="Einkunnin er samsett úr">
              <ul className="space-y-0.5">
                {entry.components.map((c, i) => (
                  <li key={i} className="flex gap-1.5 text-sm leading-snug text-hc-ink-2">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-hc-muted" />{c}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {entry?.summary && (
            <Block title="Af hverju þetta skiptir máli">
              <p className="text-sm leading-relaxed text-hc-ink-2">{entry.summary}</p>
            </Block>
          )}

          {(improves.length > 0 || worsens.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {improves.length > 0 && (
                <div className="rounded-hc-element bg-hc-ok-surface p-3 ring-1 ring-hc-ok-ink/30">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-hc-ok-ink">
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Þetta bætir
                  </p>
                  <ul className="space-y-1">
                    {improves.map((a, i) => (
                      <li key={i} className="flex gap-1.5 text-sm leading-snug text-hc-ok-ink">
                        <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-hc-ok-ink" />{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {worsens.length > 0 && (
                <div className="rounded-hc-element bg-hc-bad-surface p-3 ring-1 ring-hc-bad-ink/30">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-hc-bad-ink">
                    <Minus className="h-3.5 w-3.5" aria-hidden /> Þetta vinnur á móti
                  </p>
                  <ul className="space-y-1">
                    {worsens.map((a, i) => (
                      <li key={i} className="flex gap-1.5 text-sm leading-snug text-hc-bad-ink">
                        <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-hc-bad-ink" />{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {item.trend.length > 0 && (
            <Block title={`Þróun · ${item.trend.length + 1} mælingar`}><Trend item={item} /></Block>
          )}

          {item.advice.length > 0 && (
            <Block title="Úr skýrslunni">
              <ul className="space-y-1">
                {item.advice.map((a, i) => (
                  <li key={i} className="flex gap-1.5 text-sm leading-snug text-hc-ink-2">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-hc-muted" />{a}
                  </li>
                ))}
              </ul>
            </Block>
          )}
          {item.review && <p className="text-xs text-hc-ink-2">{item.review}</p>}
        </div>
      )}
    </li>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-2">{title}</p>
      {children}
    </div>
  );
}

/**
 * The reference range, drawn to scale with the value sitting on it.
 *
 * A number means little alone — "18,6" says nothing until you can see it near
 * the top of its range. Open-ended bands ("over 25") get a plausible tail so
 * the bar has somewhere to end.
 */
function BandScale({ bands, value, unit, sex }: {
  bands: KnowledgeBand[];
  value: number;
  unit: string | null;
  sex: "m" | "f" | null;
}) {
  const use = bands.filter((b) => !b.sex || b.sex === sex);
  const edges = use.flatMap((b) => [b.min, b.max]).filter((n): n is number => typeof n === "number");
  if (!use.length || !edges.length) return null;

  let lo = Math.min(...edges, value);
  let hi = Math.max(...edges, value);
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.15;
  lo -= pad;
  hi += pad;
  const span = hi - lo || 1;
  const width = (start: number, end: number) =>
    `${Math.max(0, ((Math.min(end, hi) - Math.max(start, lo)) / span) * 100)}%`;

  const ordered = [...use].sort((a, b) => (a.min ?? lo) - (b.min ?? lo));
  const at = Math.max(0, Math.min(100, ((value - lo) / span) * 100));
  const note = use.find((b) => b.note)?.note;

  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-2">
        Viðmið Lifeline{sex ? (sex === "m" ? " · karlar" : " · konur") : ""}
      </p>
      <div className="relative pt-6">
        {/* the value, sitting where it actually falls */}
        <div className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${at}%` }}>
          <span className="rounded-md bg-hc-brand-dark px-1.5 py-0.5 text-[11px] font-bold text-white">
            {fmt(value)}{unit ? ` ${unit}` : ""}
          </span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-hc-sunken-2">
          {ordered.map((b, i) => (
            <div key={i} className={TONE_BAR[b.tone]} style={{ width: width(b.min ?? lo, b.max ?? hi) }} title={b.label} />
          ))}
        </div>
        <span className="absolute bottom-0 h-4 w-0.5 -translate-x-1/2 rounded bg-hc-brand-dark" style={{ left: `${at}%` }} aria-hidden />
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {ordered.map((b, i) => (
          <li key={i} className="flex items-center gap-1.5 text-xs text-hc-ink-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_BAR[b.tone]}`} aria-hidden />
            <span className="font-semibold text-hc-ink-2">{b.label}</span>
            <span className="tabular-nums">{rangeText(b, unit)}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-1.5 text-xs text-hc-ink-2">{note}</p>}
    </div>
  );
}

/** "2–25 mIU/L" · "yfir 25" · "undir 3,9" */
function rangeText(b: KnowledgeBand, unit: string | null): string {
  const u = unit ? ` ${unit}` : "";
  if (b.min != null && b.max != null) return `${fmt(b.min)}–${fmt(b.max)}${u}`;
  if (b.min != null) return `yfir ${fmt(b.min)}${u}`;
  if (b.max != null) return `undir ${fmt(b.max)}${u}`;
  return "";
}

/** The history the report carries, as a simple sparkline. */
function Trend({ item }: { item: ReportItem }) {
  const points = [...item.trend, { date: item.date, value: item.value }];
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 100;
  const h = 28;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * w} ${h - ((p.value - min) / span) * h}`)
    .join(" ");
  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-40 overflow-visible" aria-hidden>
        <path d={d} fill="none" stroke="var(--hc-brand)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={w} cy={h - ((item.value - min) / span) * h} r={2.5} fill="var(--hc-brand)" />
      </svg>
      <p className="text-xs text-hc-ink-2">
        {points[0].date} · {fmt(points[0].value)} <ArrowRight className="inline h-3 w-3 align-[-1px]" aria-hidden /><span className="sr-only">til</span> {item.date} · {fmt(item.value)}
      </p>
    </div>
  );
}
