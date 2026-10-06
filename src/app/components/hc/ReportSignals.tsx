"use client";

// The flagged values from the health report, and nothing else.
//
// The workstation used to pin the whole ReportView in a 26rem column beside
// the interview notes and the plan builder. Two problems with that, and they
// compound: the container is capped at 1024px, so the work column was left
// 544px and the report itself got 416px — and the report is ten expandable
// sections, a gradient hero and four pillar cards, none of which the nurse is
// reading while someone is talking to her.
//
// What she needs mid-conversation is the three or four values that are out of
// range. That is this. The whole report is one button away, in the drawer the
// workstation already uses for messages and referrals.

import { AlertTriangle, ChevronRight } from "lucide-react";
import type { Grunnheilsa, Signal } from "@/lib/hc/grunnheilsa";

const TONE: Record<"red" | "yellow", { dot: string; cls: string }> = {
  red: { dot: "bg-red-500", cls: "bg-red-50 text-red-900 ring-red-200" },
  yellow: { dot: "bg-amber-500", cls: "bg-amber-50 text-amber-900 ring-amber-200" },
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));

export default function ReportSignals({ report, signals, onOpen, max = 8 }: {
  report: Grunnheilsa;
  signals: Record<string, Signal | null>;
  /** Opens the full report. */
  onOpen?: () => void;
  max?: number;
}) {
  const lit = report.items
    .map((item) => ({ item, signal: signals[item.key] ?? null }))
    .filter((x): x is { item: typeof x.item; signal: "red" | "yellow" } => x.signal === "red" || x.signal === "yellow")
    // Red before yellow, so the worst is read first.
    .sort((a, b) => (a.signal === b.signal ? 0 : a.signal === "red" ? -1 : 1));

  const reds = lit.filter((x) => x.signal === "red").length;
  const yellows = lit.length - reds;
  const shown = lit.slice(0, max);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
        <p className="text-sm font-bold text-slate-900">Það sem er utan marka</p>
        <p className="text-xs text-slate-500">{reds} rauð · {yellows} gul</p>
        {onOpen && (
          <button type="button" onClick={onOpen}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Sjá alla skýrsluna <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      {lit.length === 0 ? (
        <p className="text-sm text-slate-500">Ekkert gildi er utan marka.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map(({ item, signal }) => (
            <li key={item.key}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${TONE[signal].cls}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE[signal].dot}`} aria-hidden />
              {item.title}
              <span className="font-bold tabular-nums">{fmt(item.value)}{item.unit ? ` ${item.unit}` : ""}</span>
            </li>
          ))}
          {lit.length > shown.length && (
            <li className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              +{lit.length - shown.length} til viðbótar
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
