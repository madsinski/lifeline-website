"use client";

// How well one action fits this person, as something you can see.
//
// A number alone does not answer "why this one?", so the bar carries the
// combined score and opens to the two halves behind it — the need the report
// found, and the effect-for-the-time the action is worth on its own. The
// rows it is aimed at are named, because "Tekur á: Svefn — venjur" is the
// part that makes the ranking believable.

import { fitBand, FIT_IS, type Fit } from "@/lib/hc/fit";

const n1 = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

function Bar({ value, className, label }: { value: number; className: string; label: string }) {
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`${label}: ${n1(value)} af 10`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.max(4, (value / 10) * 100)}%` }} />
      </div>
      <span className="w-7 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-600">{n1(value)}</span>
    </div>
  );
}

export default function FitMeter({ fit, titles, rank }: {
  fit: Fit;
  /** hc_knowledge slug → the report row's title. */
  titles: Record<string, string>;
  /** 1-based place in the list; the top three are called out. */
  rank?: number;
}) {
  const band = fitBand(fit.fit);
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        {rank != null && rank <= 3 && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-hc-ink text-[11px] font-bold text-white" aria-hidden>{rank}</span>
        )}
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${band.chip}`}>{band.label}</span>
        {!fit.personalised && (
          <span className="text-[11px] text-slate-500" title="Ekkert sem þessi aðgerð tekur á var mælt hjá þér.">óháð skýrslunni</span>
        )}
      </div>

      <div className="mt-1.5">
        <Bar value={fit.fit} className={band.bar} label={FIT_IS.fit.label} />
      </div>

      {fit.targets.length > 0 && (
        <p className="mt-1 text-[11px] text-hc-ink-2">
          <span className="font-semibold">Tekur á:</span>{" "}
          {fit.targets.slice(0, 3).map((t) => titles[t.slug] ?? t.slug).join(" · ")}
        </p>
      )}

      <details className="mt-1 group">
        <summary className="cursor-pointer list-none text-[11px] font-semibold text-slate-500 hover:text-slate-800">
          Hvernig er þetta reiknað?
        </summary>
        <div className="mt-1.5 space-y-1.5 rounded-lg bg-slate-50 p-2">
          {fit.need != null
            ? <div><p className="text-[11px] font-semibold text-slate-700" title={FIT_IS.need.hint}>{FIT_IS.need.label}</p><Bar value={fit.need} className="bg-amber-400" label={FIT_IS.need.label} /></div>
            : <p className="text-[11px] text-slate-500">{FIT_IS.need.label}: ekkert af því sem þetta tekur á var mælt.</p>}
          {fit.bang != null
            ? <div><p className="text-[11px] font-semibold text-slate-700" title={FIT_IS.bang.hint}>{FIT_IS.bang.label}</p><Bar value={fit.bang} className="bg-sky-400" label={FIT_IS.bang.label} /></div>
            : <p className="text-[11px] text-slate-500">{FIT_IS.bang.label}: aðgerðin hefur ekki verið metin.</p>}
          <p className="text-[11px] leading-snug text-slate-500">{FIT_IS.fit.hint}</p>
        </div>
      </details>
    </div>
  );
}
