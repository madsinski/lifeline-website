"use client";

// The Grunnheilsa report, readable.
//
// The PDF is eighteen pages of prose; this is the same content arranged so a
// nurse can see the picture in one screen and a client can understand their
// own results. Three things carry it: where you stand overall, what needs
// attention first, and then everything else grouped the way the body is.
//
// The traffic lights are Lifeline's own reference ranges — the same ones the
// app uses. Medalia prints its own verdicts with varying wording and cut-offs;
// where they disagree we say so quietly rather than pretend.

import { useMemo, useState } from "react";
import { ChevronDown, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { PILLAR_META, type Pillar } from "@/lib/hc/types";
import { SIGNAL_LABEL, type Grunnheilsa, type ReportItem, type Signal } from "@/lib/hc/grunnheilsa";

const RING: Record<Signal, string> = {
  green: "ring-emerald-200 bg-emerald-50",
  yellow: "ring-amber-200 bg-amber-50",
  red: "ring-red-200 bg-red-50",
};
const DOT: Record<Signal, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500" };
const TEXT: Record<Signal, string> = { green: "text-emerald-800", yellow: "text-amber-800", red: "text-red-700" };

const GROUPS: { key: string; title: string; kinds: ReportItem["kind"][]; blurb: string }[] = [
  { key: "scores", title: "Lífsstíllinn", kinds: ["score"], blurb: "Úr spurningalistanum. 0–10, hærra er betra." },
  { key: "measure", title: "Mælingar", kinds: ["measure", "risk"], blurb: "Líkamssamsetning og blóðþrýstingur." },
  { key: "blood", title: "Blóðprufa", kinds: ["blood"], blurb: "Efnaskipti, blóðfitur og lifur." },
];

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

export default function ReportView({ report, signals, audience = "staff" }: {
  report: Grunnheilsa;
  /** Traffic lights from Lifeline's reference ranges, computed on the server. */
  signals: Record<string, Signal | null>;
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
  const focus = lit.filter((x) => x.signal === "red").slice(0, 6);

  return (
    <div className="space-y-5">
      {/* Where you stand */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F2A23] to-[#065F46] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Heilsufarsskýrsla</p>
            <h2 className="mt-1 text-2xl font-bold">
              {overall ? `Lífstílseinkunn ${fmt(overall.value)}` : "Niðurstöður"}
            </h2>
            <p className="mt-0.5 text-sm text-emerald-100">
              {report.reportDate ? `Skýrsla ${report.reportDate}` : "Úr heilsufarsskoðuninni"}
              {report.patient.name && audience === "staff" ? ` · ${report.patient.name}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {(["red", "yellow", "green"] as const).map((s) => (
              <div key={s} className="rounded-2xl bg-white/10 px-3 py-2 text-center">
                <p className="text-xl font-bold">{counts[s]}</p>
                <p className="text-[11px] text-emerald-100">{SIGNAL_LABEL[s]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What to look at first */}
      {focus.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Það sem stendur upp úr</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {focus.map(({ item, signal }) => (
              <li key={item.key} className={`rounded-2xl px-4 py-3 ring-1 ${RING[signal ?? "red"]}`}>
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <span className={`h-2.5 w-2.5 rounded-full ${DOT[signal ?? "red"]}`} aria-hidden />
                  {item.title}
                </p>
                <p className="mt-0.5 text-sm text-slate-700">
                  <span className="font-bold tabular-nums">{fmt(item.value)}{item.unit ? ` ${item.unit}` : ""}</span>
                  {item.advice[0] ? ` · ${item.advice[0]}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The pillars, when the report scored them */}
      <Pillars lit={lit} />

      {/* Everything, grouped */}
      {GROUPS.map((g) => {
        const rows = lit.filter((x) => g.kinds.includes(x.item.kind));
        if (!rows.length) return null;
        return (
          <section key={g.key}>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">{g.title}</h3>
            <p className="mb-2 text-xs text-slate-500">{g.blurb}</p>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {rows.map(({ item, signal }) => <Row key={item.key} item={item} signal={signal} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
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

  return (
    <section>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Stoðirnar fjórar</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ pillar, avg, rows }) => {
          const meta = PILLAR_META[pillar];
          const signal: Signal = avg >= 7.5 ? "green" : avg >= 5 ? "yellow" : "red";
          return (
            <div key={pillar} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{fmt(avg)}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${DOT[signal]}`} style={{ width: `${Math.min(100, avg * 10)}%` }} />
              </div>
              <ul className="mt-2 space-y-0.5">
                {rows.map(({ item, signal: s }) => (
                  <li key={item.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className={`h-1.5 w-1.5 rounded-full ${DOT[s ?? "yellow"]}`} aria-hidden />
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

function Row({ item, signal }: { item: ReportItem; signal: Signal | null }) {
  const [open, setOpen] = useState(false);
  const has = item.advice.length > 0 || item.trend.length > 0 || !!item.review;
  // Medalia's own verdict, when it disagrees with our reference range.
  const disagrees = item.reportSignal && signal && item.reportSignal !== signal;
  const last = item.trend.at(-1);
  const move = last ? item.value - last.value : 0;

  return (
    <li>
      <button type="button" onClick={() => has && setOpen(!open)} aria-expanded={has ? open : undefined}
        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${has ? "hover:bg-slate-50" : "cursor-default"}`}>
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
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ring-1 ${signal ? `${RING[signal]} ${TEXT[signal]}` : "bg-slate-50 text-slate-700 ring-slate-200"}`}>
          {fmt(item.value)}{item.unit ? ` ${item.unit}` : ""}
        </span>
        {has && <ChevronDown className={`h-4 w-4 shrink-0 text-slate-300 transition ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          {item.trend.length > 0 && <Trend item={item} />}
          {item.advice.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {item.advice.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
          {item.review && <p className="text-xs text-slate-500">{item.review}</p>}
        </div>
      )}
    </li>
  );
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
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Þróun · {points.length} mælingar</p>
      <div className="flex items-center gap-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-40 overflow-visible" aria-hidden>
          <path d={d} fill="none" stroke="#10B981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={w} cy={h - ((item.value - min) / span) * h} r={2.5} fill="#10B981" />
        </svg>
        <p className="text-xs text-slate-500">
          {points[0].date} · {fmt(points[0].value)} → {item.date} · {fmt(item.value)}
        </p>
      </div>
    </div>
  );
}
