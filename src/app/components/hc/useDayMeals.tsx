"use client";

// Today's meal_log, once per screen.
//
// Every MealLogger used to load and hold its own copy of the day. Í dag
// renders one per meal slot, so ticking lunch updated the lunch row's copy
// and nobody else's — "prótein í hverri máltíð" never saw all four meals
// ticked at once and so never ticked itself. On Næring, describing a meal
// updated the database and left the "næsta máltíð" card showing the old
// state until a reload.
//
// One copy now, in context. A screen that renders meal rows calls
// useDayMealsRoot() and wraps its children in <DayMealsScope>; every
// MealLogger and DescribeMeal underneath reads and writes the same rows.
// A scope nested inside another scope reuses the outer one, so a page can
// mount one higher up later without anything below changing. Outside any
// scope, useDayMeals() falls back to its own copy, which is how it behaved
// before — nothing breaks for a caller that has not been wired.
//
// ── Writes ──────────────────────────────────────────────────────────────
//
// One row per slot per day, as the app's logMeal has it. Replacing a slot
// used to be delete-then-insert with both errors ignored, so a failed insert
// after a successful delete lost the meal. It is insert-then-delete now: the
// new row goes in first, and the old ones are removed by id only once it has
// landed. The worst a failure can leave is two rows for a slot, which the
// next successful write cleans up — never zero.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { localDate } from "@/lib/hc/workout";
import { type MealLogRow } from "@/lib/hc/nutrition-log";
import { mealName, type Meal, type MealSlot } from "@/lib/hc/meals";
import { SAVE_FAILED, useToast } from "./Toast";

export interface DayMealRow extends Omit<MealLogRow, "source"> {
  id: string;
  /** "planned", or "described" / "custom" / "swap" for anything else eaten. */
  source: string;
}

export interface DayMacros { kcal: number; protein: number; carbs: number; fat: number }

export interface DayMealsApi {
  /** Today's rows, or null while the first load is in flight. */
  rows: DayMealRow[] | null;
  /** The row logged for a slot today, if any. */
  forSlot: (slot: MealSlot) => DayMealRow | null;
  refresh: () => Promise<void>;
  /** Log the planned meal for a slot. Resolves false on failure (already toasted). */
  logPlanned: (slot: MealSlot, meal: Meal) => Promise<boolean>;
  /** Log a described meal in place of the slot's planned one. */
  logDescribed: (slot: MealSlot, description: string, macros: DayMacros) => Promise<boolean>;
  /** Remove whatever is logged for a slot today. */
  unlog: (slot: MealSlot) => Promise<boolean>;
}

const DayMealsContext = createContext<DayMealsApi | null>(null);

async function myId(): Promise<string | null> {
  // getSession is local; getUser is a network round trip on every tap.
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function useDayMealsState(enabled: boolean): DayMealsApi {
  const toast = useToast();
  const [rows, setRows] = useState<DayMealRow[] | null>(null);
  const loadedFor = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const uid = await myId();
    if (!uid) return;
    const d = localDate();
    const { data, error } = await supabase.from("meal_log")
      .select("id, date, action_key, source, description, kcal, protein, carbs, fat")
      .eq("client_id", uid).eq("date", d);
    if (error) return;
    loadedFor.current = d;
    setRows((data ?? []) as DayMealRow[]);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => { void refresh(); }, 0);
    // Left open overnight, the screen would keep ticking yesterday.
    const onVis = () => {
      if (document.visibilityState === "visible" && loadedFor.current && loadedFor.current !== localDate()) void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", onVis); };
  }, [enabled, refresh]);

  const forSlot = useCallback(
    (slot: MealSlot) => (rows ?? []).find((r) => r.action_key === slot) ?? null,
    [rows]);

  /** Insert the new row, then remove the slot's old ones by id. */
  const replaceSlot = useCallback(async (slot: MealSlot, row: Omit<DayMealRow, "id">): Promise<boolean> => {
    const uid = await myId();
    if (!uid) { toast.show("Innskráningin rann út – skráðu þig aftur inn", { tone: "bad" }); return false; }
    try {
      const { data: old, error: readErr } = await supabase.from("meal_log")
        .select("id").eq("client_id", uid).eq("date", row.date).eq("action_key", slot);
      if (readErr) throw readErr;
      const { data: ins, error: insErr } = await supabase.from("meal_log")
        .insert({ ...row, client_id: uid }).select("id").single();
      if (insErr || !ins) throw insErr ?? new Error("no row");
      const oldIds = (old ?? []).map((o: { id: string }) => o.id).filter((id) => id !== ins.id);
      if (oldIds.length) {
        const { error: delErr } = await supabase.from("meal_log").delete().in("id", oldIds);
        // The new meal is in; a leftover old row is cleaned up next time.
        if (delErr) console.warn("[meal_log] old rows not removed", delErr);
      }
      setRows((r) => [...(r ?? []).filter((x) => x.action_key !== slot), { ...row, id: ins.id as string }]);
      return true;
    } catch (e) {
      console.error("[meal_log] save failed", (e as { code?: string } | null)?.code ?? "");
      toast.show(SAVE_FAILED, { tone: "bad" });
      return false;
    }
  }, [toast]);

  const logPlanned = useCallback((slot: MealSlot, meal: Meal) => replaceSlot(slot, {
    date: localDate(), action_key: slot, source: "planned",
    description: mealName(meal),
    kcal: Number(meal.calories) || 0, protein: Number(meal.protein) || 0,
    carbs: Number(meal.carbs) || 0, fat: Number(meal.fat) || 0,
  }), [replaceSlot]);

  const logDescribed = useCallback((slot: MealSlot, description: string, m: DayMacros) => replaceSlot(slot, {
    date: localDate(), action_key: slot,
    /* "described" rather than "planned", so the diary can always tell an
       estimate from a meal with known macros. */
    source: "described",
    description: description.trim().slice(0, 200),
    kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat,
  }), [replaceSlot]);

  const unlog = useCallback(async (slot: MealSlot): Promise<boolean> => {
    const uid = await myId();
    if (!uid) { toast.show("Innskráningin rann út – skráðu þig aftur inn", { tone: "bad" }); return false; }
    const { error } = await supabase.from("meal_log").delete()
      .eq("client_id", uid).eq("date", localDate()).eq("action_key", slot);
    if (error) { toast.show(SAVE_FAILED, { tone: "bad" }); return false; }
    setRows((r) => (r ?? []).filter((x) => x.action_key !== slot));
    return true;
  }, [toast]);

  return { rows, forSlot, refresh, logPlanned, logDescribed, unlog };
}

/**
 * For the screen that owns the meal rows: the enclosing scope's state if
 * there is one, otherwise its own. Pass the result to <DayMealsScope>.
 */
export function useDayMealsRoot(): DayMealsApi {
  const parent = useContext(DayMealsContext);
  const own = useDayMealsState(!parent);
  return parent ?? own;
}

export function DayMealsScope({ value, children }: { value: DayMealsApi; children: React.ReactNode }) {
  return <DayMealsContext.Provider value={value}>{children}</DayMealsContext.Provider>;
}

/** A self-contained provider, for a page that wants one scope above everything. */
export function DayMealsProvider({ children }: { children: React.ReactNode }) {
  const value = useDayMealsRoot();
  return <DayMealsScope value={value}>{children}</DayMealsScope>;
}

/** Read and write today's meals: the scope's copy, or a private one outside any scope. */
export function useDayMeals(): DayMealsApi {
  return useDayMealsRoot();
}
