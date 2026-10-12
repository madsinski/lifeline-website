"use client";

// The week's shopping, for whichever days you pick.
//
// Derived, never stored: it is computed from the same week the planner
// shows, so swapping Thursday's dinner changes the list with no action and
// nothing to refresh. A stored list would be a second copy of the plan,
// out of date the moment somebody changed their mind.
//
// Days are a multi-select because shopping is not weekly for everybody —
// some people buy for two days at a time, and "whole week" is one tap of
// the same control rather than a separate mode.

import { useMemo, useState } from "react";
import { Check, Copy, ShoppingBasket } from "lucide-react";
import Sheet from "./Sheet";
import { formatQty, shoppingList } from "@/lib/hc/shopping";
import type { Meal, MealSlot } from "@/lib/hc/meals";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/hc/personalise";

export default function ShoppingList({ week, todayIdx, onClose }: {
  /** The seven days, exactly as the planner has them. */
  week: Record<MealSlot, Meal | null>[];
  todayIdx: number;
  onClose: () => void;
}) {
  /* Opens on the rest of the week from today, which is what somebody
     standing in a shop most often wants. */
  const [picked, setPicked] = useState<Set<number>>(
    () => new Set(Array.from({ length: 7 - todayIdx }, (_, i) => todayIdx + i)),
  );
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const lines = useMemo(
    () => shoppingList([...picked].sort((a, b) => a - b).map((i) => week[i]).filter(Boolean)),
    [picked, week],
  );

  const toggleDay = (i: number) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const allWeek = picked.size === 7;

  const copy = async () => {
    const text = lines.map((l) => {
      const q = formatQty(l.qty, l.unit);
      return q ? `${q} ${l.text}` : l.text;
    }).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no clipboard: the list is on screen to read anyway */ }
  };

  return (
    <Sheet title="Innkaupalisti" onClose={onClose} canvas>
      <div className="p-3">
        {/* Which days. */}
        <div className="flex flex-wrap gap-1.5">
          <button type="button"
            onClick={() => setPicked(allWeek ? new Set([todayIdx]) : new Set([0, 1, 2, 3, 4, 5, 6]))}
            aria-pressed={allWeek}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              allWeek ? "bg-hc-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
            Vikan öll
          </button>
          {WEEKDAYS_SHORT.map((lbl, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i)}
              aria-pressed={picked.has(i)}
              aria-label={WEEKDAYS[i]}
              className={`rounded-full px-2.5 py-1.5 text-xs font-bold uppercase transition ${
                picked.has(i) ? "bg-lime-700 text-white"
                  : i === todayIdx ? "bg-lime-50 text-lime-900 ring-1 ring-lime-200"
                  : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
              {lbl}
            </button>
          ))}
        </div>

        {picked.size === 0 ? (
          <p className="mt-3 rounded-2xl bg-white p-4 text-sm text-slate-500 ring-1 ring-slate-200">
            Veldu dag eða fleiri til að sjá hvað þarf að kaupa.
          </p>
        ) : (
          <>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {lines.length} {lines.length === 1 ? "lína" : "línur"}
                {ticked.size > 0 ? ` · ${ticked.size} í körfunni` : ""}
              </p>
              <button type="button" onClick={() => void copy()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
                {copied ? <Check className="h-3.5 w-3.5 text-lime-700" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                {copied ? "Afritað" : "Afrita"}
              </button>
            </div>

            <ul className="mt-2 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {lines.map((l) => {
                const key = `${l.text}|${l.unit ?? ""}`;
                const on = ticked.has(key);
                return (
                  <li key={key} className="border-b border-slate-100 last:border-b-0">
                    {/* Ticking is for the shop and nothing else: it is not
                        saved, because a basket is a half-hour's state and
                        storing it would mean clearing it later. */}
                    <button type="button"
                      onClick={() => setTicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key); else next.add(key);
                        return next;
                      })}
                      aria-pressed={on}
                      className="flex w-full items-center gap-3 p-3 text-left">
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
                        on ? "border-transparent bg-lime-700 text-white" : "border-slate-300 text-transparent"}`}>
                        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block font-semibold ${on ? "text-slate-400 line-through" : "text-slate-900"}`}>
                          {formatQty(l.qty, l.unit)} {l.text}
                        </span>
                        {/* Which meals wanted it, so a surprising amount can
                            be traced without opening every recipe. */}
                        <span className="block truncate text-xs text-slate-500">úr {l.from.join(", ")}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* The honest caveats, once, at the foot. */}
            <p className="mt-2 px-1 text-xs text-slate-500">
              Magn er eins og það stendur í uppskriftunum — uppskrift fyrir tvo gefur tvo skammta.
              Sumt er ekki talið í magni, eins og salt og olía, og stendur þá eins og það er skrifað.
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** The button that opens it, for the planner's header. */
export function ShoppingListButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-lime-100 px-3 py-1 text-sm font-semibold text-lime-900 ring-1 ring-lime-200 transition hover:bg-lime-200">
      <ShoppingBasket className="h-3.5 w-3.5" aria-hidden /> Innkaupalisti
    </button>
  );
}
