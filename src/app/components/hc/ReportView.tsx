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
import { ChevronDown, Minus, Plus, TrendingDown, TrendingUp, Upload } from "lucide-react";
import { PILLAR_META, type Pillar } from "@/lib/hc/types";
import { SIGNAL_LABEL, type Grunnheilsa, type ReportItem, type Signal } from "@/lib/hc/grunnheilsa";
import type { KnowledgeBand, ReportReference } from "@/lib/hc/knowledge";

const DOT: Record<Signal, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500" };
/* The hero's count boxes, tinted to match the dots so a box and a dot say
   the same thing. Light on a mid-green hero, not the full row colours,
   which at that size would shout. */
const HERO_CHIP: Record<Signal, string> = {
  green: "bg-emerald-400/25 ring-emerald-200/40 text-white",
  yellow: "bg-amber-300/25 ring-amber-200/40 text-white",
  red: "bg-rose-400/25 ring-rose-200/50 text-white",
};
const CHIP: Record<Signal, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};
const TONE_BAR: Record<KnowledgeBand["tone"], string> = {
  good: "bg-emerald-400",
  watch: "bg-amber-300",
  high: "bg-red-400",
  low: "bg-blue-300",
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
const SECTIONS: {
  key: string; title: string; blurb: string; accent: string; keys?: string[];
  /** One of the four questionnaire pillars; its header shows their average. */
  pillar?: Pillar;
  /**
   * A section with a single composite score of its own, which belongs in
   * the heading rather than as the first row underneath it — the row and
   * the heading would otherwise print the same number twice.
   */
  scoreKey?: string;
}[] = [
  { pillar: "sleep" as Pillar, key: "sleep", title: "Svefn", blurb: "", accent: PILLAR_META.sleep.color,
    keys: ["svefn_vandamal", "svefn_venjur"] },
  { pillar: "exercise" as Pillar, key: "exercise", title: "Hreyfing", blurb: "", accent: PILLAR_META.exercise.color,
    keys: ["hreyfing_vandamal", "hreyfing_venjur"] },
  { pillar: "nutrition" as Pillar, key: "nutrition", title: "Næring", blurb: "", accent: PILLAR_META.nutrition.color,
    keys: ["naering_vandamal", "naering_venjur"] },
  { pillar: "mental" as Pillar, key: "mental", title: "Andleg líðan", blurb: "", accent: PILLAR_META.mental.color,
    keys: ["andleg_heilsa", "streita", "vellidan"] },
  { key: "habits", title: "Ávanar", blurb: "Nikótín, áfengi og önnur efni. 10 þýðir engin notkun.", accent: "#78716C",
    // Caffeine, screens and gambling are habits, whatever pillar the
    // questionnaire files their score under. A number in the Svefn heading
    // that counted caffeine while caffeine was listed elsewhere would
    // describe rows the reader cannot see.
    keys: ["nikotin", "afengi", "onnur_efni", "koffin", "skjanotkun", "fjarhaettuspil", "matarhegdun"] },
  { scoreKey: "efnaskiptaheilsa", key: "metabolic", title: "Efnaskipti", blurb: "Hvernig líkaminn heldur blóðsykri í skefjum. Hér sést álag fyrst.", accent: "#0D9488",
    keys: ["efnaskiptaheilsa", "blodsykur", "insulin", "hba1c", "homa_ir"] },
  { key: "heart", title: "Hjarta og blóðfitur", blurb: "Blóðþrýstingur og blóðfitur — það sem ræður áhættunni til langs tíma.", accent: "#E11D48",
    keys: ["hjartaheilsa", "bp_efri", "bp_nedri", "kolesterol", "hdl", "ldl", "thriglyserid"] },
  { key: "liver", title: "Lifur", blurb: "Lifrarensím. Þau svara vel breytingum á áfengi, sykri og þyngd.", accent: "#CA8A04",
    keys: ["alat", "asat"] },
  { key: "body", title: "Líkamssamsetning", blurb: "Þyngd segir lítið ein; samsetningin segir meira.", accent: "#4F46E5",
    keys: ["thyngd", "bmi", "fitumassi", "vodvamassi"] },
  { key: "rest", title: "Annað úr skýrslunni", blurb: "", accent: "#64748B" },
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
      {/* A lighter hero.
          It was near-black green, which made the whole page open on its
          darkest note and left the traffic lights — the only things here
          that mean anything — competing with the background. */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-hc-hero-from to-hc-hero-to p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Heilsufarsskýrsla</p>
            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
              {overall ? `Lífstílseinkunn ${fmt(overall.value)}` : "Niðurstöður"}
            </h2>
            <p className="mt-1 text-sm text-emerald-100">
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
          <div className="flex shrink-0 items-stretch gap-2">
            {(["green", "yellow", "red"] as const).map((s) => (
              <div key={s} className={`min-w-[4.5rem] rounded-2xl px-3 py-2 text-center ring-1 ${HERO_CHIP[s]}`}>
                <p className="text-xl font-bold tabular-nums">{counts[s]}</p>
                <p className="text-[11px] leading-tight opacity-80">{SIGNAL_LABEL[s]}</p>
              </div>
            ))}
            {onUpload && (
              <button type="button" onClick={onUpload} aria-label="Hlaða upp skýrslu"
                title="Hlaða upp skýrslu"
                className="grid w-12 shrink-0 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/25">
                <Upload className="h-5 w-5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2 ── What matters most now */}
      {focus.length > 0 && (
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
                <li key={item.key} className="rounded-2xl bg-red-50 px-4 py-3 ring-1 ring-red-200">
                  <p className="flex items-baseline gap-2">
                    <span className="font-bold text-slate-900">{item.title}</span>
                    <span className="ml-auto shrink-0 font-bold tabular-nums text-red-700">
                      {fmt(item.value)}{item.unit ? ` ${item.unit}` : ""}
                    </span>
                  </p>
                  {first && (
                    <p className="mt-1 text-sm leading-snug text-slate-700">
                      <span className="font-semibold text-red-800">Fyrsta skrefið: </span>{first}
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
        if (!rows.length) return null;
        const off = rows.filter((r) => r.signal === "red").length;
        return (
          <section key={s.key}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            style={{ borderLeftWidth: 3, borderLeftColor: s.accent }}>
            {/* A wash of the section's own colour behind the heading. Enough
                to break the page into blocks, not enough to compete with the
                traffic lights, which are the only thing that means anything. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5" style={{ backgroundColor: `${s.accent}14` }}>
              <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: s.accent }}>{s.title}</h3>
              {/* The section's own score, where the four summary cards used
                  to put it. "af 10" rather than a sentence explaining the
                  scale: the scale needs saying once, not four times. */}
              {/* ml-auto on the chip, so it and the score travel together
                  to the right edge: the score is what the eye runs down,
                  and "byrjum hér" belongs beside its own number rather than
                  next to a title three words long. */}
              {s.pillar && s.key === weakest && (
                <span className="ml-auto rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">byrjum hér</span>
              )}
              {avg !== undefined && (
                <span className={`flex items-baseline gap-1 ${s.pillar && s.key === weakest ? "" : "ml-auto"}`}>
                  <span className="text-3xl font-bold tabular-nums leading-none" style={{ color: s.accent }}>{fmt1(avg)}</span>
                  <span className="text-xs font-semibold text-slate-500">af 10</span>
                </span>
              )}
              {/* Only the red one survives. The amber chip and "Allt í lagi"
                  said what every row below says with its own traffic light,
                  and the score now carries the summary. A value outside the
                  reference range is the one thing worth saying twice. */}
              {off > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">{off} utan viðmiða</span>
              )}
              {/* order-last keeps the subtext under the whole line, so the
                  score sits beside the title rather than after a sentence. */}
              {s.blurb && <p className="order-last w-full text-xs font-normal normal-case tracking-normal text-slate-500">{s.blurb}</p>}
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map(({ item, signal }) => (
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
  return <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">{children}</h3>;
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
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${signal ? DOT[signal] : "bg-slate-300"}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900">{item.title}</span>
          <span className="block text-xs text-slate-500">
            {signal ? SIGNAL_LABEL[signal] : "Engin viðmið"}
            {disagrees ? ` · skýrslan segir „${item.label}“` : ""}
            {/* A good score can sit on top of several habits that are missing:
                "Hreyfing — venjur" scores 7,5 and still carries three red
                components. Saying so here stops the dots inside the dropdown
                reading as a contradiction of the verdict above them. */}
            {flaggedCount > 0 && (
              <span className={signal === "green" ? "font-medium text-amber-700" : ""}>
                {" · "}{flaggedCount} {flaggedCount === 1 ? "atriði" : "atriði"} til að taka á
              </span>
            )}
          </span>
        </span>
        {item.trend.length > 0 && (
          <span className={`hidden items-center gap-1 text-xs sm:flex ${move > 0 ? "text-emerald-700" : move < 0 ? "text-slate-500" : "text-slate-400"}`}>
            {move > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : move < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            {move !== 0 ? `${move > 0 ? "+" : ""}${fmt(move)}` : "óbreytt"}
          </span>
        )}
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ring-1 ${signal ? CHIP[signal] : "bg-slate-50 text-slate-700 ring-slate-200"}`}>
          {fmt(item.value)}{item.unit ? ` ${item.unit}` : ""}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/70 px-4 py-4">
          {entry && entry.bands.length > 0 && (
            <BandScale bands={entry.bands} value={item.value} unit={item.unit || entry.unit} sex={sex} />
          )}

          {item.recommendations.length > 0 && (
            <Block title="Það sem á að taka á">
              <ul className="space-y-1.5">
                {item.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${DOT[r.priority]}`} aria-hidden />
                    <span className="text-sm leading-snug text-slate-800">
                      {r.component && <span className="font-semibold">{r.component}: </span>}
                      {r.text}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Úr ráðleggingum skýrslunnar. Rauður punktur er forgangur 1, gulur forgangur 2.
              </p>
            </Block>
          )}

          {!!entry?.components?.length && (
            <Block title="Einkunnin er samsett úr">
              <ul className="space-y-0.5">
                {entry.components.map((c, i) => (
                  <li key={i} className="flex gap-1.5 text-sm leading-snug text-slate-700">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />{c}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {entry?.summary && (
            <Block title="Af hverju þetta skiptir máli">
              <p className="text-sm leading-relaxed text-slate-700">{entry.summary}</p>
            </Block>
          )}

          {(improves.length > 0 || worsens.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {improves.length > 0 && (
                <div className="rounded-xl bg-emerald-50/80 p-3 ring-1 ring-emerald-200">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-800">
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Þetta bætir
                  </p>
                  <ul className="space-y-1">
                    {improves.map((a, i) => (
                      <li key={i} className="flex gap-1.5 text-sm leading-snug text-emerald-900">
                        <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-emerald-600" />{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {worsens.length > 0 && (
                <div className="rounded-xl bg-red-50/70 p-3 ring-1 ring-red-200">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-800">
                    <Minus className="h-3.5 w-3.5" aria-hidden /> Þetta vinnur á móti
                  </p>
                  <ul className="space-y-1">
                    {worsens.map((a, i) => (
                      <li key={i} className="flex gap-1.5 text-sm leading-snug text-red-900">
                        <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-red-500" />{a}
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
                  <li key={i} className="flex gap-1.5 text-sm leading-snug text-slate-700">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />{a}
                  </li>
                ))}
              </ul>
            </Block>
          )}
          {item.review && <p className="text-xs text-slate-500">{item.review}</p>}
        </div>
      )}
    </li>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
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
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
        Viðmið Lifeline{sex ? (sex === "m" ? " · karlar" : " · konur") : ""}
      </p>
      <div className="relative pt-6">
        {/* the value, sitting where it actually falls */}
        <div className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: `${at}%` }}>
          <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {fmt(value)}{unit ? ` ${unit}` : ""}
          </span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200">
          {ordered.map((b, i) => (
            <div key={i} className={TONE_BAR[b.tone]} style={{ width: width(b.min ?? lo, b.max ?? hi) }} title={b.label} />
          ))}
        </div>
        <span className="absolute bottom-0 h-4 w-0.5 -translate-x-1/2 rounded bg-slate-900" style={{ left: `${at}%` }} aria-hidden />
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {ordered.map((b, i) => (
          <li key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_BAR[b.tone]}`} aria-hidden />
            <span className="font-semibold text-slate-800">{b.label}</span>
            <span className="tabular-nums">{rangeText(b, unit)}</span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-1.5 text-xs text-slate-500">{note}</p>}
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
        <path d={d} fill="none" stroke="#10B981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={w} cy={h - ((item.value - min) / span) * h} r={2.5} fill="#10B981" />
      </svg>
      <p className="text-xs text-slate-500">
        {points[0].date} · {fmt(points[0].value)} → {item.date} · {fmt(item.value)}
      </p>
    </div>
  );
}
