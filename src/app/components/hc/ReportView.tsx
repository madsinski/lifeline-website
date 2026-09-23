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
import { ChevronDown, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { PILLAR_META, type Pillar } from "@/lib/hc/types";
import { SIGNAL_LABEL, type Grunnheilsa, type ReportItem, type Signal } from "@/lib/hc/grunnheilsa";
import type { KnowledgeBand, ReportReference } from "@/lib/hc/knowledge";

const DOT: Record<Signal, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500" };
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
const SECTIONS: { key: string; title: string; blurb: string; accent: string; keys?: string[] }[] = [
  { key: "sleep", title: "Svefn", blurb: "Úr spurningalistanum. 0–10, hærra er betra.", accent: PILLAR_META.sleep.color,
    keys: ["svefn_vandamal", "svefn_venjur", "koffin"] },
  { key: "exercise", title: "Hreyfing", blurb: "Úr spurningalistanum. 0–10, hærra er betra.", accent: PILLAR_META.exercise.color,
    keys: ["hreyfing_vandamal", "hreyfing_venjur"] },
  { key: "nutrition", title: "Næring", blurb: "Úr spurningalistanum. 0–10, hærra er betra.", accent: PILLAR_META.nutrition.color,
    keys: ["naering_vandamal", "naering_venjur", "matarhegdun"] },
  { key: "mental", title: "Andleg líðan", blurb: "Úr spurningalistanum. 0–10, hærra er betra.", accent: PILLAR_META.mental.color,
    keys: ["andleg_heilsa", "streita", "vellidan", "skjanotkun", "fjarhaettuspil"] },
  { key: "habits", title: "Ávanar", blurb: "Nikótín, áfengi og önnur efni. 10 þýðir engin notkun.", accent: "#78716C",
    keys: ["nikotin", "afengi", "onnur_efni"] },
  { key: "metabolic", title: "Efnaskipti", blurb: "Hvernig líkaminn heldur blóðsykri í skefjum. Hér sést álag fyrst.", accent: "#0D9488",
    keys: ["efnaskiptaheilsa", "blodsykur", "insulin", "hba1c", "homa_ir"] },
  { key: "heart", title: "Hjarta og blóðfitur", blurb: "Blóðþrýstingur og blóðfitur — það sem ræður áhættunni til langs tíma.", accent: "#E11D48",
    keys: ["hjartaheilsa", "bp_efri", "bp_nedri", "kolesterol", "hdl", "ldl", "thriglyserid"] },
  { key: "liver", title: "Lifur", blurb: "Lifrarensím. Þau svara vel breytingum á áfengi, sykri og þyngd.", accent: "#CA8A04",
    keys: ["alat", "asat"] },
  { key: "body", title: "Líkamssamsetning", blurb: "Þyngd segir lítið ein; samsetningin segir meira.", accent: "#4F46E5",
    keys: ["thyngd", "bmi", "fitumassi", "vodvamassi"] },
  { key: "rest", title: "Annað úr skýrslunni", blurb: "", accent: "#64748B" },
];

export default function ReportView({ report, signals, reference, sex, audience = "staff" }: {
  report: Grunnheilsa;
  /** Traffic lights from Lifeline's reference ranges, computed on the server. */
  signals: Record<string, Signal | null>;
  /** Reference ranges and teaching text, keyed by report row. */
  reference?: Record<string, ReportReference>;
  /** Which sex the bands were read for; sex-specific ranges need it. */
  sex?: "m" | "f" | null;
  /** The client sees their own report; staff see the name in the header. */
  audience?: "staff" | "client";
}) {
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
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F2A23] to-[#065F46] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Heilsufarsskýrsla</p>
            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
              {overall ? `Lífstílseinkunn ${fmt(overall.value)}` : "Niðurstöður"}
            </h2>
            <p className="mt-1 text-sm text-emerald-100">
              {report.reportDate ? `Skýrsla ${longDateIs(report.reportDate)}` : "Úr heilsufarsskoðuninni"}
              {report.patient.name && audience === "staff" ? ` · ${report.patient.name}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {(["red", "yellow", "green"] as const).map((s) => (
              <div key={s} className="min-w-[4.5rem] rounded-2xl bg-white/10 px-3 py-2 text-center">
                <p className="text-xl font-bold tabular-nums">{counts[s]}</p>
                <p className="text-[11px] leading-tight text-emerald-100">{SIGNAL_LABEL[s]}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-emerald-50/90">
          Hver lína hér að neðan opnast. Þar sérðu viðmiðin, af hverju gildið skiptir máli og hvað
          hefur áhrif á það — til góðs og til hins verra.
        </p>
      </section>

      {/* 2 ── What matters most now */}
      {focus.length > 0 && (
        <section>
          <SectionTitle>Það sem skiptir mestu núna</SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2">
            {focus.map(({ item }) => {
              const r = reference?.[item.key];
              const first = r?.improves?.[0] ?? item.advice[0];
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
      <Pillars lit={lit} />

      {/* 4 ── The detail */}
      {SECTIONS.map((s) => {
        const rows = s.keys
          ? s.keys.map((k) => lit.find((x) => x.item.key === k)).filter((x): x is (typeof lit)[number] => !!x)
          : lit.filter((x) => !claimed.has(x.item.key));
        if (!rows.length) return null;
        const off = rows.filter((r) => r.signal === "red").length;
        const watch = rows.filter((r) => r.signal === "yellow").length;
        return (
          <section key={s.key}>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="h-4 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.accent }} aria-hidden />
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">{s.title}</h3>
              {off > 0 ? (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-200">{off} utan viðmiða</span>
              ) : watch > 0 ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">{watch} til að fylgjast með</span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">Allt í lagi</span>
              )}
            </div>
            {s.blurb && <p className="mb-2 text-xs text-slate-500">{s.blurb}</p>}
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
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

function Pillars({ lit }: { lit: { item: ReportItem; signal: Signal | null }[] }) {
  const pillars: Pillar[] = ["sleep", "exercise", "nutrition", "mental"];
  const cards = pillars
    .map((p) => {
      const rows = lit.filter((x) => x.item.pillar === p && x.item.kind === "score");
      if (!rows.length) return null;
      const avg = rows.reduce((n, x) => n + x.item.value, 0) / rows.length;
      return { pillar: p, avg, rows };
    })
    .filter((x): x is { pillar: Pillar; avg: number; rows: typeof lit } => !!x);
  if (!cards.length) return null;

  // The lowest pillar is where the plan starts, so say so rather than leaving
  // the nurse to compare four numbers.
  const worst = cards.reduce((a, b) => (b.avg < a.avg ? b : a));

  return (
    <section>
      <SectionTitle>Stoðirnar fjórar</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ pillar, avg, rows }) => {
          const meta = PILLAR_META[pillar];
          const signal: Signal = avg >= 7.5 ? "green" : avg >= 5 ? "yellow" : "red";
          const first = pillar === worst.pillar;
          return (
            <div key={pillar}
              className={`rounded-2xl border bg-white p-4 ${first ? "border-slate-900/20 shadow-sm ring-1 ring-slate-900/5" : "border-slate-200"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</p>
                {first && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">byrjum hér</span>}
              </div>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{fmt1(avg)}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${DOT[signal]}`} style={{ width: `${Math.min(100, avg * 10)}%` }} />
              </div>
              <ul className="mt-2 space-y-0.5">
                {rows.map(({ item, signal: s }) => (
                  <li key={item.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s ? DOT[s] : "bg-slate-300"}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.title.replace(/^[^—]+—\s*/, "")}</span>
                    <span className="tabular-nums">{fmt(item.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Row({ item, signal, entry, sex }: {
  item: ReportItem;
  signal: Signal | null;
  entry?: ReportReference;
  sex: "m" | "f" | null;
}) {
  const [open, setOpen] = useState(false);
  // Medalia's own verdict, when it disagrees with our reference range.
  const disagrees = item.reportSignal && signal && item.reportSignal !== signal;
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
