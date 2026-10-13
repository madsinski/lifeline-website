"use client";

// "Ég borðaði þetta": logging the day's meals.
//
// The nutrition counterpart of the workout runner, and deliberately not the
// same shape. A workout is a sequence you step through; eating is four
// moments spread over a day, so there is nothing to "start" — each slot gets
// a tick, and the day adds up as it goes.
//
// A tick writes `meal_log` with that meal's own macros and source "planned",
// which is the row the app has been writing for months and the web never did.
// Untick deletes today's row for that slot, so a mis-tap is not permanent.
//
// The protein bar is measured against hc_knowledge's own band (1,2–1,6 g per
// kg), using the weight from the report. With no weight on file there is no
// bar — a progress bar against a guessed target is worse than none.

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { localDate } from "@/lib/hc/workout";
import { type MealLogRow } from "@/lib/hc/nutrition-log";
import { mealName, SLOT_IS, SLOTS, type Meal, type MealSlot } from "@/lib/hc/meals";

export default function MealLogger({ day, compact = false, part = "list", only, flush = false, tone, onOpenMeal, onLogged, drag, lifted = false, carryY = 0, settling = false }: {
  /** The meal in each slot today, as the plan has it. */
  day: Record<MealSlot, Meal | null>;
  /** On "Í dag" the bar is enough; the Næring tab shows every slot. */
  compact?: boolean;
  /**
   * Which half to render. The Næring hero shows the bar the way the exercise
   * hero shows the stage, and the slot-by-slot list stays further down, so
   * the two halves mount separately there.
   */
  /**
   * Which half to render.
   *
   * There used to be a "bar" and a "both" — a protein progress bar reading
   * from the log. Its last caller went when Næring became the planner, and
   * removing it took the appTarget/onTarget plumbing with it. The band those
   * fed is computed in NutritionView now, from the same function.
   */
  part?: "list" | "button";
  /**
   * Render one slot's row only.
   *
   * The "næsta máltíð" card carries its own tick, and the write belongs
   * here — this component owns hc_action_logs for meals, and a second
   * copy of that write living in the card would be two things to keep in
   * step. The card asks for one row instead.
   */
  only?: MealSlot;
  /**
   * Render rows the way Í dag's checklist renders every other item.
   *
   * On the Næring page these were cards in their own right. Dropped into the
   * Í dag list they became a card inside a card, which is exactly how they
   * looked — a separate thing bolted on rather than part of the day. This
   * variant drops the card and matches ActionRow: same padding, same 40px
   * tick, same type, and the pillar's own colour when it is ticked.
   */
  flush?: boolean;
  /** The pillar colour for a ticked row, so Næring reads as Næring. */
  /**
   * The pillar's colours, for a row that has to match the habits beside it.
   *
   * `soft` is the row's own tint. It was missing, so meal rows rendered on
   * whatever was behind them — white — while every habit row carried its
   * pillar's pale wash. In a list where colour means "still to do", the
   * meals looked done before anybody touched them.
   */
  tone?: { color: string; ring: string; soft?: string };
  /**
   * Open this meal's detail.
   *
   * Every other row in Í dag's checklist opens a sleeve when you tap its
   * text; a meal row that only had a tick was the odd one out. Given, the
   * row grows the same chevron and the same tap target.
   */
  onOpenMeal?: (meal: Meal) => void;
  /**
   * Which slots are logged today, after a change.
   *
   * MealLogger owns meal_log, so it is the only thing that knows. Í dag uses
   * it to tick the habits a meal completes — which needs the whole set, not
   * just the slot that was tapped, because "prótein í hverri máltíð" is only
   * done when every meal is.
   */
  onLogged?: (slots: MealSlot[]) => void;
  /**
   * Tap-and-hold to reorder, same as a habit row.
   *
   * A meal in Í dag's checklist is one item among the day's items, so it has
   * to be carried like one. These are the hook's own handlers, passed
   * through from the list that owns the order — MealLogger does not know
   * about ordering, only that this row can be picked up.
   */
  drag?: { onPointerDown: (e: React.PointerEvent) => void; ref: (el: HTMLElement | null) => void };
  /** Being carried right now. */
  lifted?: boolean;
  /** How far to follow the finger. */
  carryY?: number;
  /** Another row is being carried: glide, do not snap. */
  settling?: boolean;
  /**
   * Reports the band this bar measures against, so the plan can be built to
   * land inside it. Without this the plan was assembled to maximise protein
   * and the bar measured it against 1,2–1,6 g/kg, so the two numbers on this
   * page described different things.
   */
}) {
  const [rows, setRows] = useState<MealLogRow[] | null>(null);
  const [busy, setBusy] = useState<MealSlot | null>(null);
  // The app computes a full macro target (Mifflin / Katch-McArdle / measured
  // BMR → TDEE → protein split) and stores it in macro_targets. When that

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase.from("meal_log")
      .select("date, action_key, source, description, kcal, protein, carbs, fat")
      .eq("client_id", u.user.id).eq("date", localDate());
    setTimeout(() => {
      setRows((data ?? []) as MealLogRow[]);
    }, 0);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const loggedSlot = (slot: MealSlot) => (rows ?? []).find((r) => r.action_key === slot) ?? null;

  const toggle = async (slot: MealSlot) => {
    const meal = day[slot];
    if (!meal || busy) return;
    setBusy(slot);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setBusy(null); return; }
    const already = loggedSlot(slot);
    if (already) {
      await supabase.from("meal_log").delete()
        .eq("client_id", u.user.id).eq("date", localDate()).eq("action_key", slot);
      setRows((r) => (r ?? []).filter((x) => x.action_key !== slot));
    } else {
      const row: MealLogRow = {
        date: localDate(), action_key: slot, source: "planned",
        description: mealName(meal),
        kcal: Number(meal.calories) || 0, protein: Number(meal.protein) || 0,
        carbs: Number(meal.carbs) || 0, fat: Number(meal.fat) || 0,
      };
      // One row per slot per day, as the app's logMeal does: delete first so
      // a double tap cannot leave two breakfasts in the diary.
      await supabase.from("meal_log").delete()
        .eq("client_id", u.user.id).eq("date", localDate()).eq("action_key", slot);
      const { error } = await supabase.from("meal_log").insert({ ...row, client_id: u.user.id });
      if (!error) setRows((r) => [...(r ?? []), row]);
    }
    setBusy(null);
  };

  /* Up to the caller after every change and on first load, off the render
     tick so a parent setState never lands inside this one. */
  useEffect(() => {
    if (!onLogged || rows === null) return;
    const slots = rows.map((r) => r.action_key as MealSlot);
    const t = setTimeout(() => onLogged(slots), 0);
    return () => clearTimeout(t);
  }, [rows, onLogged]);



  return (
    <div className="space-y-3">
      {/* The day so far */}
      {/* Flush rows are <li>s for somebody else's list.
          Wrapping them in a <ul> of their own made a list inside a list:
          invalid, and — the reason it mattered — it stopped a meal being a
          sibling of the habits. The reorder hook measures sibling
          positions to work out what a carried row is passing, so a meal in
          its own nested list could never interleave with them. */}
      {!compact && part !== "button" && (() => {
        const rows = (
          <>
              {SLOTS.filter((s) => day[s]).filter((s) => !only || s === only).map((slot) => {
                const meal = day[slot]!;
                const done = !!loggedSlot(slot);

                /* Flush: the row Í dag's checklist uses for everything else. */
                if (flush) {
                  /* Padding on the <li>, as ActionRow has it, so the two rows
                     are the same shape rather than two shapes that happen to
                     measure the same. */
                  return (
                    <li key={slot} ref={drag?.ref}
                      onPointerDown={drag?.onPointerDown}
                      className={`border-t border-slate-100 px-3 py-3 first:border-t-0 sm:px-4 ${
                        lifted ? "relative z-10 bg-white shadow-xl" : ""}`}
                      style={{
                        /* Follow the finger while carried, glide back otherwise —
                           the same two states ActionRow uses, so a carried meal
                           and a carried habit move alike. */
                        transform: carryY ? `translateY(${carryY}px)` : undefined,
                        transition: lifted ? "none" : settling ? "transform 160ms ease" : undefined,
                        touchAction: drag ? "none" : undefined,
                        userSelect: drag ? "none" : undefined,
                        WebkitUserSelect: drag ? "none" : undefined,
                        /* The pillar's tint until it is ticked, exactly as
                           ActionRow does it: colour means "still to do", and
                           a ticked row drains to white. Lifted is opaque so
                           it reads as held above the list. */
                        background: lifted ? "#FFFFFF" : done ? "#FFFFFF" : tone?.soft ?? "#F4FAE9",
                      }}>
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={() => void toggle(slot)} disabled={busy !== null}
                          aria-pressed={done}
                          aria-label={`${done ? "Afmerkja" : "Merkja sem búið"}: ${SLOT_IS[slot]} — ${mealName(meal)}`}
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white transition active:scale-90 ${
                            done ? "border-transparent text-white" : "text-transparent"}`}
                          style={done
                            ? { background: tone?.color ?? "#3F6212" }
                            : { borderColor: tone?.ring ?? "#CBD5E1" }}>
                          {busy === slot
                            ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                            : <Check className="h-5 w-5" strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          {/* The text is the way in, as it is on every other
                              row: tick on the left, detail behind the words. */}
                          {onOpenMeal ? (
                            <button type="button" onClick={() => onOpenMeal(meal)}
                              className="flex w-full items-start gap-2 text-left">
                              <span className="min-w-0 flex-1">
                                <span className={`block font-semibold ${done ? "text-slate-500 line-through" : "text-slate-900"}`}>
                                  {mealName(meal)}
                                </span>
                                <span className="mt-0.5 block text-sm text-slate-500">
                                  {[SLOT_IS[slot],
                                    meal.protein != null ? `${Math.round(Number(meal.protein))} g prótein` : null,
                                    meal.calories != null ? `${Math.round(Number(meal.calories))} kkal` : null]
                                    .filter(Boolean).join(" · ")}
                                </span>
                              </span>
                              <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                            </button>
                          ) : (
                            <>
                              <p className={`font-semibold ${done ? "text-slate-500 line-through" : "text-slate-900"}`}>
                                {mealName(meal)}
                              </p>
                              <p className="mt-0.5 text-sm text-slate-500">
                                {[SLOT_IS[slot],
                                  meal.protein != null ? `${Math.round(Number(meal.protein))} g prótein` : null,
                                  meal.calories != null ? `${Math.round(Number(meal.calories))} kkal` : null]
                                  .filter(Boolean).join(" · ")}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={slot}>
                    <button type="button" onClick={() => void toggle(slot)} disabled={busy !== null}
                      aria-pressed={done}
                      className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 transition ${
                        done ? "bg-emerald-50 ring-2 ring-emerald-500" : "bg-white ring-hc-hairline hover:ring-slate-300"}`}>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        done ? "border-transparent bg-emerald-600 text-white" : "border-hc-hairline text-transparent"}`}>
                        {busy === slot ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : <Check className="h-5 w-5" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{SLOT_IS[slot]}</span>
                        <span className={`block truncate font-semibold ${done ? "text-emerald-900" : "text-slate-900"}`}>{mealName(meal)}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-slate-500">
                        {meal.protein != null && <span className="block font-semibold text-slate-700">{Math.round(Number(meal.protein))} g</span>}
                        {meal.calories != null && <span className="block">{Math.round(Number(meal.calories))} kkal</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
          </>
        );
        return flush ? rows : <ul className="space-y-2">{rows}</ul>;
      })()}

      {/* part="button": the one solid action at the foot of Næring's "í dag"
          card, the place Æfingar puts its own.

          This branch went missing when I removed the old progress-bar
          variant: the list above is gated `part !== "button"` and nothing
          was left to answer `part === "button"`, so the card rendered the
          action as an empty div and the tick simply vanished. Mads noticed
          before I did.

          Same toggle() and same meal_log row as the checklist row, so this
          and Í dag agree by construction rather than by being kept in
          step. */}
      {part === "button" && (() => {
        const slot = only ?? SLOTS.find((x) => day[x]);
        if (!slot || !day[slot]) return null;
        const done = !!loggedSlot(slot);
        return (
          <button type="button" onClick={() => void toggle(slot)} disabled={busy !== null}
            aria-pressed={done}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold transition disabled:opacity-60 ${
              done
                ? "bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500"
                : "bg-lime-700 text-white hover:bg-lime-800"}`}>
            {busy === slot
              ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              : <Check className="h-5 w-5" strokeWidth={3} aria-hidden />}
            {/* One label in both states. "Ég borðaði þetta" is already past
                tense, so there is no second wording to switch to — the
                filled tick and the emerald ring carry "done", the way the
                checklist rows do it. */}
            Ég borðaði þetta
          </button>
        );
      })()}
    </div>
  );
}
