// The hour of day a plan module belongs to.
//
// Lifted out of /api/hc/plan when the workstation's as-client route needed
// the same thing: the coach renders the client's own plan, so it has to
// arrive shaped the same way, and a second copy of this would be a second
// chance for the two to disagree about when a habit happens.

import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Stamp each module with the part of the day it belongs to.
 *
 * The time lives in hc_plan_modules; the plan payload is a snapshot taken
 * when it was published, and older snapshots predate the column entirely.
 * Joining at read time gives every existing plan the grouping without
 * rewriting one stored payload, and a module that gets retagged reaches
 * every plan using it instead of leaving them on last month's answer.
 *
 * No match keeps "anytime" — the honest answer for anything a nurse typed
 * by hand, and for the many habits that genuinely have no hour.
 */
export async function withWhen(modules: unknown): Promise<unknown> {
  if (!Array.isArray(modules) || !modules.length) return modules;
  const keys = [...new Set(modules.map((m) => (m as { key?: unknown }).key).filter((k): k is string => typeof k === "string"))];
  if (!keys.length) return modules;
  const { data } = await supabaseAdmin.from("hc_plan_modules").select("key, when_of_day").in("key", keys);
  const when = new Map((data ?? []).map((r) => [r.key as string, r.when_of_day as string]));
  return modules.map((m) => {
    const k = (m as { key?: unknown }).key;
    return { ...(m as object), when: (typeof k === "string" && when.get(k)) || "anytime" };
  });
}
