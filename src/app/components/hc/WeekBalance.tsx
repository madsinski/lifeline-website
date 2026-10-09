"use client";

// What the week is made of, per quality.
//
// Training is not one thing you do more or less of. Strength, intervals and
// easy aerobic work each do something the other two do not, and a week can
// be busy while missing one of them entirely — somebody playing football
// four times a week is fully covered for intervals and empty on both
// strength and the aerobic base. A single "how trained are you" number
// would hide exactly that.
//
// So: three rows, each against what a good week holds. The numbers come
// from the whole week — what the plan prescribes and what the person put in
// themselves — because after the programme and "þitt eigið" were merged
// there is one week, and a Tuesday lift trains you the same either way.

import { useState } from "react";
import { ChevronDown, Scale } from "lucide-react";
import { SCORE_TONE, type TrainingScore } from "@/lib/hc/adaptive-program";
import { hcCard } from "./ui";

/** "2", "hálf", "1,5" — Icelandic counts half sessions, not 0,5 of one. */
const num = (x: number) => (Number.isInteger(x) ? String(x) : String(x).replace(".", ","));

export default function WeekBalance({ score, onFix }: {
  score: TrainingScore;
  /** Open Breytingar, so a gap is one tap from being filled. */
  onFix?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const counted = score.per.filter((x) => x.target > 0);
  const gaps = counted.filter((x) => x.gap);

  return (
    <section className={`${hcCard.base} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Scale className="h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />
        <p className="font-semibold text-hc-ink">Vikan í jafnvægi</p>
        <p className="min-w-0 flex-1 text-sm text-slate-500">{score.summary}</p>
      </div>

      {/* One row per quality: what the week holds, against what it wants. */}
      <ul className="mt-3 space-y-2.5">
        {counted.map((m) => {
          const tone = SCORE_TONE(m.score);
          return (
            <li key={m.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <p className="font-semibold text-slate-800">{m.label}</p>
                <p className="shrink-0 tabular-nums text-slate-500">
                  <span className="font-bold text-slate-800">{num(m.have)}</span>
                  {" af "}{num(m.target)}
                  <span className="text-slate-400"> á viku</span>
                </p>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full transition-all ${tone.bar}`}
                  style={{ width: `${Math.min(100, (m.have / m.target) * 100)}%` }} aria-hidden />
              </div>
            </li>
          );
        })}
      </ul>

      {gaps.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm text-slate-600">
            {gaps.map((g) => `${g.label}: ${g.gap!.toLowerCase()}`).join(" · ")}
          </p>
          {onFix && (
            <button type="button" onClick={onFix}
              className="shrink-0 rounded-hc-element px-3 py-1.5 text-sm font-semibold text-hc-brand-dark ring-1 ring-hc-brand/30 transition hover:bg-hc-brand/5">
              Fylla upp í
            </button>
          )}
        </div>
      )}

      {/* Why these three and not one number. Folded away, because the
          numbers are the point and the reasoning is for the one visit
          where somebody wonders what "rólegt þol" is for. */}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="mt-3 flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-slate-500 hover:text-slate-700">
        Hvers vegna þessi þrjú?
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <dl className="mt-2 space-y-2 text-sm text-slate-600">
          <div>
            <dt className="font-semibold text-slate-800">Styrkur</dt>
            <dd>Heldur í vöðva og beinþéttni, sem hvorugt þolþjálfun gerir. Tvisvar í viku er það sem rannsóknir styðja.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-800">HIIT</dt>
            <dd>Skilar mestri bætingu í þoli á stystum tíma. Ein æfing á viku er nóg — fleiri harðir dagar bæta litlu og kosta hvíld.</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-800">Rólegt þol</dt>
            <dd>Vinnan sem þú getur gert mikið af án þess að þurfa að jafna þig: rösk ganga, hjól, sund. Undirstaðan undir hitt tvennt.</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
