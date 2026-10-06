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

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { localDate } from "@/lib/hc/workout";
import { proteinState, proteinTarget, totalsOf, type MealLogRow } from "@/lib/hc/nutrition-log";
import { mealName, SLOT_IS, SLOTS, type Meal, type MealSlot } from "@/lib/hc/meals";

export default function MealLogger({ day, weightKg, compact = false, part = "both", onTarget }: {
  /** The meal in each slot today, as the plan has it. */
  day: Record<MealSlot, Meal | null>;
  /** From the report's þyngd row; null means no protein bar. */
  weightKg: number | null;
  /** On "Í dag" the bar is enough; the Næring tab shows every slot. */
  compact?: boolean;
  /**
   * Which half to render. The Næring hero shows the bar the way the exercise
   * hero shows the stage, and the slot-by-slot list stays further down, so
   * the two halves mount separately there.
   */
  part?: "bar" | "list" | "both";
  /**
   * Reports the band this bar measures against, so the plan can be built to
   * land inside it. Without this the plan was assembled to maximise protein
   * and the bar measured it against 1,2–1,6 g/kg, so the two numbers on this
   * page described different things.
   */
  onTarget?: (t: { min: number; max: number } | null) => void;
}) {
  const [rows, setRows] = useState<MealLogRow[] | null>(null);
  const [busy, setBusy] = useState<MealSlot | null>(null);
  // The app computes a full macro target (Mifflin / Katch-McArdle / measured
  // BMR → TDEE → protein split) and stores it in macro_targets. When that
  // exists it wins: two different protein numbers on two screens is worse
  // than either number alone. Our 1,2–1,6 g/kg band is the fallback.
  const [appTarget, setAppTarget] = useState<number | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data }, { data: t }] = await Promise.all([
      supabase.from("meal_log")
        .select("date, action_key, source, description, kcal, protein, carbs, fat")
        .eq("client_id", u.user.id).eq("date", localDate()),
      supabase.from("macro_targets").select("target_protein")
        .eq("client_id", u.user.id).eq("active", true).maybeSingle(),
    ]);
    setTimeout(() => {
      setRows((data ?? []) as MealLogRow[]);
      setAppTarget(t?.target_protein == null ? null : Number(t.target_protein));
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

  const totals = totalsOf(rows ?? []);
  // What the plan puts on the table today, so the bar can say what reaching
  // the target would take rather than leaving the hero's number unexplained.
  const planned = useMemo(() => SLOTS.reduce(
    (t, s) => ({ protein: t.protein + Number(day[s]?.protein ?? 0), kcal: t.kcal + Number(day[s]?.calories ?? 0) }),
    { protein: 0, kcal: 0 }), [day]);
  const target = useMemo(() => (appTarget != null
    ? { min: Math.round(appTarget), max: Math.round(appTarget) }
    : proteinTarget(weightKg)), [appTarget, weightKg]);
  const state = proteinState(totals.protein, target);

  useEffect(() => { onTarget?.(target); }, [target, onTarget]);

  return (
    <div className="space-y-3">
      {/* The day so far */}
      {part !== "list" && (
      <div className={part === "bar" ? "" : "rounded-2xl bg-white p-4 ring-1 ring-slate-200"}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">Dagurinn þinn</p>
          <p className="text-sm text-slate-600">
            {rows === null ? "…" : `${totals.meals} af ${SLOTS.filter((s) => day[s]).length} máltíðum skráðar`}
          </p>
        </div>
        {target ? (
          <>
            <div className="mt-2 flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-700">Prótein skráð</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {Math.round(totals.protein)} g <span className="font-normal text-slate-500">af {target.min === target.max ? `${target.min}` : `${target.min}–${target.max}`} g</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full transition-all ${state.tone}`} style={{ width: `${state.pct}%` }} />
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {state.label} · {Math.round(totals.kcal)} kkal skráðar
              {planned.protein > 0 && ` · áætlunin í dag gefur ${Math.round(planned.protein)} g`}
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            {Math.round(totals.protein)} g prótein · {Math.round(totals.kcal)} kkal skráðar.
            Skráðu þyngdina þína til að sjá próteinmarkmið.
          </p>
        )}
      </div>
      )}

      {!compact && part !== "bar" && (
        <ul className="space-y-2">
          {SLOTS.filter((s) => day[s]).map((slot) => {
            const meal = day[slot]!;
            const done = !!loggedSlot(slot);
            return (
              <li key={slot}>
                <button type="button" onClick={() => void toggle(slot)} disabled={busy !== null}
                  aria-pressed={done}
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 transition ${
                    done ? "bg-emerald-50 ring-2 ring-emerald-500" : "bg-white ring-slate-200 hover:ring-slate-300"}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    done ? "border-transparent bg-emerald-600 text-white" : "border-slate-200 text-transparent"}`}>
                    {busy === slot ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <Check className="h-5 w-5" strokeWidth={3} />}
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
        </ul>
      )}
    </div>
  );
}
