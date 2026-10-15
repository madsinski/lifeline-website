"use client";

// The week's shopping, for whichever meals you pick.
//
// Derived, never stored: computed from the same week the planner shows, so
// swapping Thursday's dinner changes the list with no action and nothing to
// refresh. A stored list would be a second copy of the plan, out of date the
// moment somebody changed their mind.
//
// Three filters, narrowest last:
//
//   days   shopping is not weekly for everybody — some people buy for two
//          days at a time, and "whole week" is one tap of the same control
//   slots  "only breakfasts" is a real trip: you buy oats and skyr on their
//          own without wanting Thursday's dinner in the basket
//   meals  the individual tick, for the one meal you already have the food
//          for, or are not going to cook
//
// The meal ticks are what the other two cannot express. Days and slots are
// shortcuts for the common shapes; the tick is the escape hatch for a plan
// that never quite matches the week.

import { useMemo, useState } from "react";
import { Check, ChevronDown, Copy, ShoppingBasket } from "lucide-react";
import Sheet from "./Sheet";
import { useToast } from "./Toast";
import { formatQty, plannedKey, plannedMeals, shoppingList } from "@/lib/hc/shopping";
import { mealName, SLOT_CATEGORY, SLOT_IS, type Meal, type MealSlot } from "@/lib/hc/meals";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/hc/personalise";

/* The slot filter is by category, not by slot: a second millimál is the same
   trip to the same shelf as the first, so one "Millimál" chip covers both. */
type SlotCat = "breakfast" | "lunch" | "snack" | "dinner";
const SLOT_CATS: SlotCat[] = ["breakfast", "snack", "lunch", "dinner"];

export default function ShoppingList({ week, todayIdx, onClose }: {
  /** The seven days, exactly as the planner has them. */
  week: Record<MealSlot, Meal | null>[];
  todayIdx: number;
  onClose: () => void;
}) {
  /* Opens on the rest of the week from today, every slot — what somebody
     standing in a shop most often wants. */
  const [days, setDays] = useState<Set<number>>(
    () => new Set(Array.from({ length: 7 - todayIdx }, (_, i) => todayIdx + i)),
  );
  const [cats, setCats] = useState<Set<SlotCat>>(() => new Set(SLOT_CATS));
  /** Meals explicitly unticked. Absent means included. */
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [mealsOpen, setMealsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const all = useMemo(() => plannedMeals(week), [week]);
  /** In scope by day and slot — what the meal ticks are offered over. */
  const inScope = useMemo(
    () => all.filter((p) => days.has(p.dayIdx) && cats.has(SLOT_CATEGORY[p.slot] as SlotCat)),
    [all, days, cats],
  );
  const picked = useMemo(
    () => inScope.filter((p) => !dropped.has(plannedKey(p))),
    [inScope, dropped],
  );
  const lines = useMemo(() => shoppingList(picked), [picked]);

  const toggleIn = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    return next;
  };

  const allWeek = days.size === 7;
  const allCats = cats.size === SLOT_CATS.length;

  const copy = async () => {
    const text = lines.map((l) => {
      const q = formatQty(l.qty, l.unit);
      return q ? `${q} ${l.text}` : l.text;
    }).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard (or no permission). The tap used to do nothing at all.
      toast.show("Ekki tókst að afrita listann – hann er hér á skjánum", { tone: "bad" });
    }
  };

  const chip = (on: boolean, extra = "") =>
    `rounded-full px-2.5 py-1.5 text-xs font-bold transition ${
      on ? `bg-lime-700 text-white ${extra}` : "bg-hc-surface text-hc-ink-2 ring-1 ring-hc-hairline"}`;

  return (
    <Sheet title="Innkaupalisti" onClose={onClose} canvas>
      <div className="p-3">
        {/* Days. */}
        <div className="flex flex-wrap gap-1.5">
          <button type="button"
            onClick={() => setDays(allWeek ? new Set([todayIdx]) : new Set([0, 1, 2, 3, 4, 5, 6]))}
            aria-pressed={allWeek}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              allWeek ? "bg-hc-brand-dark text-white" : "bg-hc-surface text-hc-ink-2 ring-1 ring-hc-hairline"}`}>
            Vikan öll
          </button>
          {WEEKDAYS_SHORT.map((lbl, i) => (
            <button key={i} type="button" onClick={() => setDays((p) => toggleIn(p, i))}
              aria-pressed={days.has(i)} aria-label={WEEKDAYS[i]}
              className={`uppercase ${chip(days.has(i))} ${
                !days.has(i) && i === todayIdx ? "!bg-lime-50 !text-lime-900 !ring-lime-200" : ""}`}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Slots. Separated from the days by a label, because two rows of
            chips with nothing between them read as one broken row. */}
        <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-hc-ink-2">Máltíðir dagsins</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <button type="button"
            onClick={() => setCats(allCats ? new Set<SlotCat>(["breakfast"]) : new Set(SLOT_CATS))}
            aria-pressed={allCats}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              allCats ? "bg-hc-brand-dark text-white" : "bg-hc-surface text-hc-ink-2 ring-1 ring-hc-hairline"}`}>
            Allar
          </button>
          {SLOT_CATS.map((c) => (
            <button key={c} type="button" onClick={() => setCats((p) => toggleIn(p, c))}
              aria-pressed={cats.has(c)} className={chip(cats.has(c))}>
              {SLOT_IS[c]}
            </button>
          ))}
        </div>

        {inScope.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-hc-surface p-4 text-sm text-hc-ink-2 ring-1 ring-hc-hairline">
            Engin máltíð valin. Veldu dag og máltíð til að sjá hvað þarf að kaupa.
          </p>
        ) : (
          <>
            {/* The individual meals, folded away — it is a long list and most
                trips do not need it, but when you need it nothing else will
                do. */}
            <button type="button" onClick={() => setMealsOpen((v) => !v)} aria-expanded={mealsOpen}
              className="mt-3 flex w-full items-center gap-2 rounded-2xl bg-hc-surface p-3 text-left ring-1 ring-hc-hairline">
              <span className="min-w-0 flex-1 text-sm font-semibold text-hc-ink">
                {picked.length} af {inScope.length} máltíðum
              </span>
              <span className="shrink-0 text-xs font-semibold text-hc-ink-2">Velja</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-hc-ink-2 transition ${mealsOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>

            {mealsOpen && (
              <ul className="mt-1.5 overflow-hidden rounded-2xl bg-hc-surface ring-1 ring-hc-hairline">
                {inScope.map((p) => {
                  const key = plannedKey(p);
                  const on = !dropped.has(key);
                  return (
                    <li key={key} className="border-b border-hc-hairline last:border-b-0">
                      <button type="button" onClick={() => setDropped((prev) => toggleIn(prev, key))}
                        aria-pressed={on} className="flex w-full items-center gap-3 p-3 text-left">
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition ${
                          on ? "border-transparent bg-lime-700 text-white" : "border-slate-300 text-transparent"}`}>
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm font-semibold ${on ? "text-hc-ink" : "text-hc-ink-3"}`}>
                            {mealName(p.meal)}
                          </span>
                          <span className="block text-[11px] text-hc-ink-2">
                            {WEEKDAYS[p.dayIdx]} · {SLOT_IS[p.slot]}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 flex items-baseline justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-hc-ink-2">
                {lines.length} {lines.length === 1 ? "lína" : "línur"}
                {ticked.size > 0 ? ` · ${ticked.size} í körfunni` : ""}
              </p>
              <button type="button" onClick={() => void copy()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-hc-ink-2 hover:text-hc-ink">
                {copied ? <Check className="h-3.5 w-3.5 text-lime-700" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                {copied ? "Afritað" : "Afrita"}
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="mt-2 rounded-2xl bg-hc-surface p-4 text-sm text-hc-ink-2 ring-1 ring-hc-hairline">
                Engin máltíð valin af þeim sem eru í boði.
              </p>
            ) : (
              <ul className="mt-2 overflow-hidden rounded-2xl bg-hc-surface ring-1 ring-hc-hairline">
                {lines.map((l) => {
                  const key = `${l.text}|${l.unit ?? ""}`;
                  const on = ticked.has(key);
                  return (
                    <li key={key} className="border-b border-hc-hairline last:border-b-0">
                      {/* Ticking is for the shop and nothing else: it is not
                          saved, because a basket is a half-hour's state and
                          storing it would mean clearing it later. */}
                      <button type="button" onClick={() => setTicked((prev) => toggleIn(prev, key))}
                        aria-pressed={on}
                        className="flex w-full items-center gap-3 p-3 text-left">
                        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition ${
                          on ? "border-transparent bg-lime-700 text-white" : "border-slate-300 text-transparent"}`}>
                          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block font-semibold ${on ? "text-hc-ink-3 line-through" : "text-hc-ink"}`}>
                            {formatQty(l.qty, l.unit)} {l.text}
                          </span>
                          {/* Which meals wanted it, so a surprising amount can
                              be traced without opening every recipe. */}
                          <span className="block truncate text-xs text-hc-ink-2">úr {l.from.join(", ")}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* The honest caveats, once, at the foot. */}
            <p className="mt-2 px-1 text-xs text-hc-ink-2">
              Magn er eins og það stendur í uppskriftunum — uppskrift fyrir tvo gefur tvo skammta.
              Sumt er ekki talið í magni, eins og salt og olía, og stendur þá eins og það er skrifað.
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** The button that opens it. */
export function ShoppingListButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-lime-100 px-3 py-2 text-sm font-semibold text-lime-900 ring-1 ring-lime-200 transition hover:bg-lime-200">
      <ShoppingBasket className="h-4 w-4" aria-hidden /> Innkaupalisti
    </button>
  );
}
