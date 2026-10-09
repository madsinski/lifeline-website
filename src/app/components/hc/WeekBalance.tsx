"use client";

// Where the programme is, and what the week is made of — one card.
//
// These were three separate things stacked down the page: a stage line with
// a row of progress pips inside the hero, a balance card further down, and
// a paragraph explaining the stage that nobody opened twice. They answer one
// question between them — is this programme going anywhere, and is this week
// the right shape — so they are one card.
//
// On the balance itself: training is not one quantity you do more or less
// of. Strength, intervals and easy aerobic work each do something the other
// two do not, and a week can be busy while missing one entirely. Somebody
// playing football four times a week is not "80% trained" — they are fully
// covered for intervals and empty on both strength and the aerobic base.
// One number would hide exactly that, so there are three rows.
//
// The numbers count the whole week, prescribed and own alike, because after
// the programme and "þitt eigið" were merged there is one week and a Tuesday
// lift trains you the same whoever put it there.

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SCORE_TONE, type StageInfo, type TrainingScore } from "@/lib/hc/adaptive-program";
import { hcCard } from "./ui";

/** "2", "hálf", "1,5" — Icelandic counts half sessions, not 0,5 of one. */
const num = (x: number) => (Number.isInteger(x) ? String(x) : String(x).replace(".", ","));

export default function WeekBalance({ score, stage, onFix }: {
  score: TrainingScore;
  /** Which stage of the progression this is, when the plan has a start date. */
  stage?: StageInfo | null;
  /** Open Breytingar, so a gap is one tap from being filled. */
  onFix?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const counted = score.per.filter((x) => x.target > 0);
  const gaps = counted.filter((x) => x.gap);

  return (
    <section className={`${hcCard.base} overflow-hidden`}>
      {/* Where you are. The stage title is the headline — it is the one line
          that says this is a programme with a direction, not a list. */}
      {stage && (
        <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-bold text-hc-ink">{stage.title}</p>
            <p className="text-sm tabular-nums text-slate-500">Vika {stage.week}</p>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {Array.from({ length: stage.count }, (_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${
                i < stage.index ? "bg-hc-brand/40" : i === stage.index ? "bg-hc-brand" : "bg-slate-100"}`} />
            ))}
          </div>
          {stage.weeksToNext !== null && stage.nextTitle && (
            <p className="mt-2 text-sm text-slate-500">
              Næst: {stage.nextTitle} eftir {stage.weeksToNext} {stage.weeksToNext === 1 ? "viku" : "vikur"}
            </p>
          )}
        </div>
      )}

      {/* What the week holds. One row per quality, against what a good week
          wants. The label, the count and the bar — nothing else fits on a
          phone without one of the three getting cramped. */}
      <div className="px-4 py-3.5 sm:px-5">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Vikan</p>
        <ul className="mt-2.5 space-y-2.5">
          {counted.map((m) => {
            const tone = SCORE_TONE(m.score);
            return (
              <li key={m.key} className="flex items-center gap-3">
                <p className="w-24 shrink-0 text-sm font-semibold text-slate-800">{m.label}</p>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className={`block h-full rounded-full transition-all ${tone.bar}`}
                    style={{ width: `${Math.min(100, (m.have / m.target) * 100)}%` }} aria-hidden />
                </span>
                <p className="shrink-0 text-sm tabular-nums text-slate-500">
                  <span className="font-bold text-slate-800">{num(m.have)}</span>/{num(m.target)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* What to do about it, when there is something. A card that only ever
          reports is a card people stop reading. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 px-4 py-3 sm:px-5">
        <p className="min-w-0 flex-1 text-sm text-slate-600">
          {gaps.length
            ? gaps.map((g) => `${g.label}: ${g.gap!.charAt(0).toLowerCase()}${g.gap!.slice(1)}`).join(" · ")
            : score.summary}
        </p>
        {gaps.length > 0 && onFix && (
          <button type="button" onClick={onFix}
            className="shrink-0 rounded-hc-element px-3 py-1.5 text-sm font-semibold text-hc-brand-dark ring-1 ring-hc-brand/30 transition hover:bg-hc-brand/5">
            Fylla upp í
          </button>
        )}
      </div>

      {/* The reasoning, folded. The numbers are the point; what the stage
          means and why these three qualities is for the one visit where
          somebody wonders. */}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-slate-500 transition hover:bg-slate-50 sm:px-5">
        Um áætlunina
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3.5 text-sm text-slate-600 sm:px-5">
          {stage && (
            <p><span className="font-semibold text-slate-800">{stage.title}.</span> {stage.text}</p>
          )}
          <dl className="space-y-2">
            <div>
              <dt className="font-semibold text-slate-800">Styrkur</dt>
              <dd>Heldur í vöðva og beinþéttni, sem þolþjálfun gerir ekki. Tvisvar í viku er það sem rannsóknir styðja.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">HIIT</dt>
              <dd>Mesta bæting í þoli á stystum tíma. Ein æfing á viku er nóg — fleiri harðir dagar bæta litlu og kosta hvíld.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-800">Rólegt þol</dt>
              <dd>Vinna sem þú getur gert mikið af án þess að þurfa að jafna þig: rösk ganga, hjól, sund. Undirstaðan undir hitt tvennt.</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
