"use client";

// AI test bench — admin tool to evaluate mode + action recommendations
// against synthetic inputs before any of this ships to users.
//
// Two recommenders side by side:
//   1. /api/ai/recommend-mode      → given metrics + attestations,
//      pick a mode + rationale + runner-up
//   2. /api/ai/recommend-actions   → given a mode + candidate list,
//      rank top items + drop list with reasons
//
// Both run with dryRun=true so test runs don't pollute
// ai_recommendation_log. Candidate actions are pulled live from
// program_actions (category filter + audited rows only) so the bench
// reflects the real catalog the engine will see in production.

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStaffGuard } from "@/lib/useStaffGuard";

type Mode = "vacation" | "normal" | "beast" | "sick" | "tired";
type Intensity = "gentle" | "moderate" | "vigorous";
type RecoveryFloor = "any" | "not_sick" | "not_tired" | "not_vacation";
type Pillar = "exercise" | "nutrition" | "sleep" | "mental";

interface ActionRow {
  id: string;
  action_key: string;
  label: string;
  category: Pillar | "general";
  intensity: Intensity | null;
  min_recovery_state: RecoveryFloor | null;
  appropriate_modes: Mode[] | null;
  equipment_needed: string[] | null;
  is_keystone: boolean | null;
  is_actionable: boolean | null;
}

interface Metrics {
  sleep_hours_last_night: number | null;
  sleep_hours_3day_avg: number | null;
  hrv_today_ms: number | null;
  hrv_baseline_ms: number | null;
  rhr_today_bpm: number | null;
  rhr_baseline_bpm: number | null;
  soreness_self_rating: number | null;
}

interface Attestations {
  limitations: { knee: boolean; back: boolean; shoulder: boolean; wrist: boolean; cardio: boolean; other_notes: string | null };
  allergies: { nuts: boolean; dairy: boolean; gluten: boolean; shellfish: boolean; other_notes: string | null };
}

const EMPTY_ATT: Attestations = {
  limitations: { knee: false, back: false, shoulder: false, wrist: false, cardio: false, other_notes: null },
  allergies: { nuts: false, dairy: false, gluten: false, shellfish: false, other_notes: null },
};

// ─── Deterministic mode filter — mirrors applyModeFilter in the RN
// app's services/modes.ts. Kept inline so the bench shows the same
// pre-AI cull the user would see in-app, without depending on the RN
// repo. If the RN logic changes, mirror it here.
function suitableForMode(item: ActionRow, mode: Mode): boolean {
  if (item.appropriate_modes && item.appropriate_modes.length > 0) {
    return item.appropriate_modes.includes(mode);
  }
  switch (mode) {
    case "normal":
    case "beast":
      return true;
    case "vacation":
      if (item.min_recovery_state === "not_vacation") return false;
      if (item.intensity === "vigorous") return false;
      return true;
    case "sick":
      if (item.min_recovery_state === "not_sick") return false;
      if (item.intensity === "vigorous" || item.intensity === "moderate") return false;
      if (!item.intensity && item.category === "exercise" && item.action_key !== "steps") return false;
      return true;
    case "tired":
      if (item.min_recovery_state === "not_tired") return false;
      if (item.intensity === "vigorous") return false;
      if (item.category === "exercise" && item.intensity === "moderate") return false;
      return true;
  }
}

interface ModeRec {
  mode: Mode;
  confidence: "low" | "medium" | "high";
  rationale: string;
  runner_up: { mode: Mode; rationale: string } | null;
}

interface ActionRec {
  ordered_actions: { key: string; rank: number; yield_score: number; rationale: string }[];
  dropped_actions: { key: string; reason: string }[];
  overall_rationale: string;
}

interface OrderedMeal {
  id: string;
  rank: number;
  yield_score: number;
  rationale: string;
  name?: string;
  slot?: "breakfast" | "lunch" | "dinner" | "snack";
  protein_g?: number | null;
  calories?: number | null;
  is_high_protein_keystone?: boolean;
}

interface MealRec {
  ordered_meals: OrderedMeal[];
  dropped_meals: { id: string; name: string; reason: string }[];
  overall_rationale: string;
}

const SLOT_CHIP: Record<string, string> = {
  breakfast: "bg-amber-100 text-amber-800",
  lunch: "bg-emerald-100 text-emerald-800",
  dinner: "bg-violet-100 text-violet-800",
  snack: "bg-pink-100 text-pink-800",
};

const MODE_CHIP: Record<Mode, string> = {
  vacation: "bg-sky-100 text-sky-800",
  normal: "bg-gray-100 text-gray-800",
  beast: "bg-orange-100 text-orange-800",
  sick: "bg-red-100 text-red-800",
  tired: "bg-purple-100 text-purple-800",
};

const PILLAR_CHIP: Record<string, string> = {
  exercise: "bg-orange-100 text-orange-700",
  nutrition: "bg-lime-100 text-lime-700",
  sleep: "bg-indigo-100 text-indigo-700",
  mental: "bg-sky-100 text-sky-700",
  general: "bg-gray-100 text-gray-700",
};

export default function AiTestBenchPage() {
  const guard = useStaffGuard({ role: "admin" });

  // Inputs
  const [mode, setMode] = useState<Mode>("normal");
  const [metrics, setMetrics] = useState<Metrics>({
    sleep_hours_last_night: 7.5,
    sleep_hours_3day_avg: 7.2,
    hrv_today_ms: 50,
    hrv_baseline_ms: 55,
    rhr_today_bpm: 62,
    rhr_baseline_bpm: 60,
    soreness_self_rating: 2,
  });
  const [att, setAtt] = useState<Attestations>(EMPTY_ATT);
  const [targetCount, setTargetCount] = useState<number>(6);
  const [pillarFocus, setPillarFocus] = useState<"all" | Pillar>("all");

  // Catalog
  const [allActions, setAllActions] = useState<ActionRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Outputs
  const [modeBusy, setModeBusy] = useState(false);
  const [modeRec, setModeRec] = useState<ModeRec | null>(null);
  const [modeError, setModeError] = useState<string | null>(null);
  const [actionsBusy, setActionsBusy] = useState(false);
  const [actionRec, setActionRec] = useState<ActionRec | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);

  // Meals (separate AI path — pulls from the meals table, not
  // program_actions). Server-side allergen filter runs before the
  // model sees any candidate.
  const [mealSlot, setMealSlot] = useState<"breakfast" | "lunch" | "dinner" | "snack" | "all">("all");
  const [mealsBusy, setMealsBusy] = useState(false);
  const [mealRec, setMealRec] = useState<MealRec | null>(null);
  const [mealsError, setMealsError] = useState<string | null>(null);
  const [mealsCounts, setMealsCounts] = useState<{ candidate: number; total: number } | null>(null);

  // Swap state — keyed by source meal id. Stores the AI's alternatives
  // alongside the meal that triggered the swap so we can render
  // inline expanders.
  const [swapBusyId, setSwapBusyId] = useState<string | null>(null);
  const [swapsByMealId, setSwapsByMealId] = useState<Record<string, {
    alternatives: { id: string; rank: number; rationale: string; name?: string; protein_g?: number | null; calories?: number | null; is_high_protein_keystone?: boolean }[];
    overall: string;
    error?: string;
  }>>({});

  // Exercise library swap. The exercises table has 869 entries
  // (free-exercise-db). User picks one + count, server filters by
  // equipment/limitation/mode + AI ranks N alternatives.
  interface ExerciseLite { id: string; name: string; category: string; equipment: string; difficulty: string }
  const [exerciseLib, setExerciseLib] = useState<ExerciseLite[]>([]);
  const [exerciseLibLoading, setExerciseLibLoading] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [pickedExerciseId, setPickedExerciseId] = useState<string | null>(null);
  const [exerciseSwapCount, setExerciseSwapCount] = useState(3);
  const [exerciseSwapBusy, setExerciseSwapBusy] = useState(false);
  const [exerciseSwapResult, setExerciseSwapResult] = useState<{
    current: { id: string; name: string; category: string; equipment: string; difficulty: string };
    alternatives: { id: string; rank: number; rationale: string; name?: string; category?: string; equipment?: string; difficulty?: string; muscles_targeted?: string[]; has_video?: boolean }[];
    overall: string;
    candidate_count: number;
    error?: string;
  } | null>(null);

  // Session swap. Pulls distinct (action_key, program_key, week, day)
  // tuples from action_exercises that have at least 2 exercises
  // mapped — those are real workout sessions worth testing
  // environment swap on.
  interface SessionLite {
    action_key: string;
    program_key: string;
    week_range: number;
    day_of_week: number;
    exercise_count: number;
    label: string;
  }
  const [sessionList, setSessionList] = useState<SessionLite[]>([]);
  const [sessionListLoading, setSessionListLoading] = useState(false);
  const [pickedSessionKey, setPickedSessionKey] = useState<string | null>(null);
  const [targetEnv, setTargetEnv] = useState<"home" | "gym" | "hybrid">("home");
  const [sessionSwapBusy, setSessionSwapBusy] = useState(false);
  const [sessionSwapResult, setSessionSwapResult] = useState<{
    session_label: string | null;
    target_environment: string;
    substitutions: {
      current: { id: string; name: string; equipment: string; difficulty: string } | null;
      alternative: { id: string; name: string; equipment: string; difficulty: string; has_video: boolean; muscles_targeted: string[] } | null;
      rationale: string;
    }[];
    no_alternative_for: { id: string; name: string; reason: string }[];
    overall_rationale: string;
    error?: string;
  } | null>(null);

  const loadSessionList = useCallback(async () => {
    if (sessionList.length > 0) return;
    setSessionListLoading(true);
    try {
      // Pull all action_exercises rows in chunks, then group client-side.
      // Production scale is bounded (~thousands), and Supabase's count
      // aggregations across distinct grouped keys are awkward so this
      // is the simplest path.
      const { data: junctionRows } = await supabase
        .from("action_exercises")
        .select("action_key, program_key, week_range, day_of_week, exercise_name")
        .order("program_key")
        .order("week_range")
        .order("day_of_week")
        .limit(5000);
      if (!junctionRows) { setSessionList([]); return; }

      // Group by (action_key, program_key, week, day) and count.
      const map = new Map<string, SessionLite & { actionKey: string }>();
      for (const r of junctionRows as Array<{ action_key: string; program_key: string; week_range: number; day_of_week: number; exercise_name: string }>) {
        const key = `${r.action_key}::${r.program_key}::${r.week_range}::${r.day_of_week}`;
        const existing = map.get(key);
        if (existing) {
          existing.exercise_count += 1;
        } else {
          map.set(key, {
            actionKey: r.action_key,
            action_key: r.action_key,
            program_key: r.program_key,
            week_range: r.week_range,
            day_of_week: r.day_of_week,
            exercise_count: 1,
            label: "",
          });
        }
      }

      // Filter to sessions with >=2 exercises (real workouts) + look up
      // labels via program_actions for nicer display.
      const candidates = Array.from(map.values()).filter((s) => s.exercise_count >= 2);
      const actionKeys = Array.from(new Set(candidates.map((s) => s.actionKey)));
      const labels = new Map<string, string>();
      if (actionKeys.length > 0) {
        const { data: actionRows } = await supabase
          .from("program_actions")
          .select("action_key, label")
          .in("action_key", actionKeys.slice(0, 500));
        for (const r of (actionRows || []) as Array<{ action_key: string; label: string }>) {
          if (!labels.has(r.action_key)) labels.set(r.action_key, r.label);
        }
      }
      for (const c of candidates) c.label = labels.get(c.actionKey) || c.action_key;

      // Sort: longest sessions first, then alphabetically.
      candidates.sort((a, b) => b.exercise_count - a.exercise_count || a.label.localeCompare(b.label));
      setSessionList(candidates.slice(0, 200));
    } finally {
      setSessionListLoading(false);
    }
  }, [sessionList.length]);

  const runSessionSwap = async () => {
    if (!pickedSessionKey) return;
    const session = sessionList.find((s) => `${s.action_key}::${s.program_key}::${s.week_range}::${s.day_of_week}` === pickedSessionKey);
    if (!session) return;
    setSessionSwapBusy(true);
    setSessionSwapResult(null);
    try {
      const { data: { session: auth } } = await supabase.auth.getSession();
      if (!auth?.access_token) {
        setSessionSwapResult({ session_label: session.label, target_environment: targetEnv, substitutions: [], no_alternative_for: [], overall_rationale: "", error: "Not authenticated" });
        return;
      }
      const res = await fetch("/api/ai/swap-session", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${auth.access_token}` },
        body: JSON.stringify({
          clientId: auth.user.id,
          source: {
            mode: "from_session",
            action_key: session.action_key,
            program_key: session.program_key,
            week_range: session.week_range,
            day_of_week: session.day_of_week,
          },
          target_environment: targetEnv,
          user_mode: mode,
          attestations: att,
          dryRun: true,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setSessionSwapResult({ session_label: session.label, target_environment: targetEnv, substitutions: [], no_alternative_for: [], overall_rationale: "", error: j?.error || "Swap failed" });
        return;
      }
      setSessionSwapResult({
        session_label: j.session_label,
        target_environment: j.target_environment,
        substitutions: j.substitutions,
        no_alternative_for: j.no_alternative_for,
        overall_rationale: j.overall_rationale,
      });
    } catch (e) {
      setSessionSwapResult({ session_label: session.label, target_environment: targetEnv, substitutions: [], no_alternative_for: [], overall_rationale: "", error: (e as Error).message });
    } finally {
      setSessionSwapBusy(false);
    }
  };

  const loadExerciseLib = useCallback(async () => {
    if (exerciseLib.length > 0) return;
    setExerciseLibLoading(true);
    const all: ExerciseLite[] = [];
    let from = 0;
    while (from < 2000) {
      const { data } = await supabase
        .from("exercises")
        .select("id, name, category, equipment, difficulty")
        .order("name")
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      all.push(...(data as ExerciseLite[]));
      if (data.length < 1000) break;
      from += 1000;
    }
    setExerciseLib(all);
    setExerciseLibLoading(false);
  }, [exerciseLib.length]);

  const runExerciseSwap = async () => {
    if (!pickedExerciseId) return;
    setExerciseSwapBusy(true);
    setExerciseSwapResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setExerciseSwapResult({ current: { id: "", name: "", category: "", equipment: "", difficulty: "" }, alternatives: [], overall: "", candidate_count: 0, error: "Not authenticated" });
        return;
      }
      const res = await fetch("/api/ai/swap-exercise", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          clientId: session.user.id,
          current_exercise_id: pickedExerciseId,
          alternatives_count: exerciseSwapCount,
          mode,
          attestations: att,
          same_category: true,
          dryRun: true,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setExerciseSwapResult({ current: { id: "", name: "", category: "", equipment: "", difficulty: "" }, alternatives: [], overall: "", candidate_count: 0, error: j?.error || "Swap failed" });
        return;
      }
      setExerciseSwapResult({
        current: j.current_exercise,
        alternatives: j.alternatives,
        overall: j.overall_rationale,
        candidate_count: j.candidate_count,
      });
    } catch (e) {
      setExerciseSwapResult({ current: { id: "", name: "", category: "", equipment: "", difficulty: "" }, alternatives: [], overall: "", candidate_count: 0, error: (e as Error).message });
    } finally {
      setExerciseSwapBusy(false);
    }
  };

  const runMealSwap = async (mealId: string, count: number = 3) => {
    setSwapBusyId(mealId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setSwapsByMealId((s) => ({ ...s, [mealId]: { alternatives: [], overall: "", error: "Not authenticated" } })); return; }
      const res = await fetch("/api/ai/swap-meal", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          clientId: session.user.id,
          current_meal_id: mealId,
          alternatives_count: count,
          mode,
          attestations: att,
          same_slot: true,
          dryRun: true,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setSwapsByMealId((s) => ({ ...s, [mealId]: { alternatives: [], overall: "", error: j?.error || "Swap failed" } }));
        return;
      }
      setSwapsByMealId((s) => ({ ...s, [mealId]: { alternatives: j.alternatives, overall: j.overall_rationale } }));
    } catch (e) {
      setSwapsByMealId((s) => ({ ...s, [mealId]: { alternatives: [], overall: "", error: (e as Error).message } }));
    } finally {
      setSwapBusyId(null);
    }
  };

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    const all: ActionRow[] = [];
    const PAGE = 1000;
    let from = 0;
    while (from < 20000) {
      const { data } = await supabase
        .from("program_actions")
        .select("id, action_key, label, category, intensity, min_recovery_state, appropriate_modes, equipment_needed, is_keystone, is_actionable, audited_at")
        .not("audited_at", "is", null)
        .eq("is_actionable", true)
        .order("category", { ascending: true })
        .order("label", { ascending: true })
        .range(from, from + PAGE - 1);
      if (!data || data.length === 0) break;
      all.push(...(data as unknown as ActionRow[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    setAllActions(all);
    setCatalogLoading(false);
  }, []);

  useEffect(() => {
    if (guard.authorized) {
      loadCatalog();
      loadExerciseLib();
      loadSessionList();
    }
  }, [guard.authorized, loadCatalog, loadExerciseLib, loadSessionList]);

  // Sample candidates: pillar filter + dedupe by (category, label)
  // + cap at 60 to keep the prompt size sane.
  //
  // Dedup key is label, NOT action_key — multiple programs share the
  // same habit ("Caffeine cutoff & movement" exists in several sleep
  // programs with distinct action_keys). Without label-dedup the AI
  // saw 6 copies of the same habit and ranked them all.
  //
  // When pillarFocus is "all", we interleave by pillar AFTER the
  // keystone-tier sort. Previously the candidate list was dominated
  // by sleep + mental keystones (which carry both is_keystone AND
  // intensity tags, scoring 3) so the first 25 had no exercise items
  // and the AI returned a sleep-heavy plan. Round-robin sampling
  // ensures each pillar contributes proportionally to the cap.
  const candidates = useMemo(() => {
    const scoreOf = (a: ActionRow) => (a.is_keystone ? 2 : 0) + (a.intensity ? 1 : 0);
    const sorted = [...allActions].sort((a, b) => {
      const aScore = scoreOf(a);
      const bScore = scoreOf(b);
      if (aScore !== bScore) return bScore - aScore;
      return a.label.localeCompare(b.label);
    });
    const seen = new Set<string>();
    const dedup: ActionRow[] = [];
    for (const a of sorted) {
      if (pillarFocus !== "all" && a.category !== pillarFocus) continue;
      const key = `${a.category}::${a.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(a);
    }
    if (pillarFocus !== "all") return dedup.slice(0, 60);
    // Round-robin across pillars so each gets representation in the cap.
    const buckets = new Map<string, ActionRow[]>();
    for (const a of dedup) {
      const arr = buckets.get(a.category) || [];
      arr.push(a);
      buckets.set(a.category, arr);
    }
    const pillarOrder = ["exercise", "nutrition", "sleep", "mental", "general"];
    const out: ActionRow[] = [];
    let pulledThisRound = true;
    while (out.length < 60 && pulledThisRound) {
      pulledThisRound = false;
      for (const p of pillarOrder) {
        const arr = buckets.get(p);
        if (arr && arr.length > 0) {
          out.push(arr.shift()!);
          pulledThisRound = true;
          if (out.length >= 60) break;
        }
      }
    }
    return out;
  }, [allActions, pillarFocus]);

  // Deterministic filter mirrors the in-app applyModeFilter cull.
  const determFiltered = useMemo(
    () => candidates.filter((c) => suitableForMode(c, mode)),
    [candidates, mode],
  );

  // Yield-by-key map for quick lookup when rendering AI output rows.
  const aiOrderByKey = useMemo(() => {
    if (!actionRec) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const r of actionRec.ordered_actions) m.set(r.key, r.rank);
    return m;
  }, [actionRec]);

  const runModeRecommend = async () => {
    setModeBusy(true);
    setModeError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setModeError("Not authenticated"); return; }
      const res = await fetch("/api/ai/recommend-mode", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          clientId: session.user.id,
          metrics,
          attestations: att,
          current_mode: mode,
          dryRun: true,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) { setModeError(j?.error || "Mode recommendation failed"); return; }
      setModeRec(j.recommendation);
    } catch (e) {
      setModeError((e as Error).message);
    } finally {
      setModeBusy(false);
    }
  };

  const runMealsRecommend = async () => {
    setMealsBusy(true);
    setMealsError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setMealsError("Not authenticated"); return; }
      const res = await fetch("/api/ai/recommend-meals", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          clientId: session.user.id,
          mode,
          attestations: att,
          meal_slot: mealSlot,
          target_count: targetCount,
          dryRun: true,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) { setMealsError(j?.error || "Meals recommendation failed"); return; }
      setMealRec(j.recommendation);
      setMealsCounts({ candidate: j.candidate_count, total: j.total_count });
    } catch (e) {
      setMealsError((e as Error).message);
    } finally {
      setMealsBusy(false);
    }
  };

  const runActionRecommend = async () => {
    setActionsBusy(true);
    setActionsError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setActionsError("Not authenticated"); return; }
      // Send the deterministic-filtered candidate set — that's what
      // the user would actually see, and what the model should rank.
      const payload = {
        clientId: session.user.id,
        mode,
        metrics,
        attestations: att,
        target_count: targetCount,
        // Cap to 25 to keep the prompt + structured-output token budget
        // sane. Real production callers will pass the user's actual day
        // plan which is similarly bounded; the bench is a stress test.
        candidate_actions: determFiltered.slice(0, 25).map((a) => ({
          key: a.action_key,
          label: a.label,
          category: a.category,
          intensity: a.intensity,
          min_recovery_state: a.min_recovery_state,
          appropriate_modes: a.appropriate_modes,
          equipment_needed: a.equipment_needed,
          estimated_minutes: null,
          is_priority: false,
          is_keystone: !!a.is_keystone,
        })),
        dryRun: true,
      };
      const res = await fetch("/api/ai/recommend-actions", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) { setActionsError(j?.error || "Action recommendation failed"); return; }
      setActionRec(j.recommendation);
    } catch (e) {
      setActionsError((e as Error).message);
    } finally {
      setActionsBusy(false);
    }
  };

  if (guard.loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;
  if (!guard.authorized) return <div className="p-8 text-center text-red-600 text-sm">Admin access required.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1F2937]">AI test bench</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          Drive the recommendation engine with synthetic inputs and compare against the
          deterministic filter. Every call uses <code className="bg-gray-100 px-1 rounded">dryRun: true</code> —
          nothing here writes to <code className="bg-gray-100 px-1 rounded">ai_recommendation_log</code>.
          Use this to validate prompt + safety rules before turning the engine on for users.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Inputs */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Mode + budget</h2>
            <label className="block text-xs text-gray-500 mb-1">Active mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3"
            >
              {(["vacation", "normal", "beast", "sick", "tired"] as Mode[]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <label className="block text-xs text-gray-500 mb-1">Target action count</label>
            <input
              type="number"
              min={1}
              max={20}
              value={targetCount}
              onChange={(e) => setTargetCount(Math.max(1, Math.min(20, parseInt(e.target.value || "6", 10))))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3"
            />
            <label className="block text-xs text-gray-500 mb-1">Pillar focus</label>
            <select
              value={pillarFocus}
              onChange={(e) => setPillarFocus(e.target.value as "all" | Pillar)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="all">All pillars</option>
              <option value="exercise">Exercise only</option>
              <option value="nutrition">Nutrition only</option>
              <option value="sleep">Sleep only</option>
              <option value="mental">Mental only</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Smart-watch metrics</h2>
            <MetricSlider label="Sleep last night (h)" value={metrics.sleep_hours_last_night ?? 0} min={0} max={12} step={0.25} onChange={(v) => setMetrics({ ...metrics, sleep_hours_last_night: v })} />
            <MetricSlider label="Sleep 3-day avg (h)" value={metrics.sleep_hours_3day_avg ?? 0} min={0} max={12} step={0.25} onChange={(v) => setMetrics({ ...metrics, sleep_hours_3day_avg: v })} />
            <MetricSlider label="HRV today (ms)" value={metrics.hrv_today_ms ?? 0} min={10} max={120} step={1} onChange={(v) => setMetrics({ ...metrics, hrv_today_ms: v })} />
            <MetricSlider label="HRV baseline (ms)" value={metrics.hrv_baseline_ms ?? 0} min={10} max={120} step={1} onChange={(v) => setMetrics({ ...metrics, hrv_baseline_ms: v })} />
            <MetricSlider label="RHR today (bpm)" value={metrics.rhr_today_bpm ?? 0} min={40} max={100} step={1} onChange={(v) => setMetrics({ ...metrics, rhr_today_bpm: v })} />
            <MetricSlider label="RHR baseline (bpm)" value={metrics.rhr_baseline_bpm ?? 0} min={40} max={100} step={1} onChange={(v) => setMetrics({ ...metrics, rhr_baseline_bpm: v })} />
            <MetricSlider label="Soreness (1-5)" value={metrics.soreness_self_rating ?? 0} min={1} max={5} step={1} onChange={(v) => setMetrics({ ...metrics, soreness_self_rating: v })} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Attestations</h2>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 mb-1">Limitations</p>
              {(["knee", "back", "shoulder", "wrist", "cardio"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={att.limitations[k]}
                    onChange={(e) => setAtt({ ...att, limitations: { ...att.limitations, [k]: e.target.checked } })}
                  />
                  {k}
                </label>
              ))}
              <p className="text-xs text-gray-500 mt-3 mb-1">Allergies</p>
              {(["nuts", "dairy", "gluten", "shellfish"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={att.allergies[k]}
                    onChange={(e) => setAtt({ ...att, allergies: { ...att.allergies, [k]: e.target.checked } })}
                  />
                  {k}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div className="lg:col-span-8 space-y-4">
          {/* Mode recommender */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Mode recommendation</h2>
              <button
                onClick={runModeRecommend}
                disabled={modeBusy}
                className="px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg disabled:opacity-50"
              >
                {modeBusy ? "Running…" : "Recommend mode"}
              </button>
            </div>
            {modeError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-3">{modeError}</div>}
            {modeRec && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${MODE_CHIP[modeRec.mode]}`}>
                    Picked: {modeRec.mode}
                  </span>
                  <span className="text-xs text-gray-500">confidence: {modeRec.confidence}</span>
                  {modeRec.runner_up && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${MODE_CHIP[modeRec.runner_up.mode]} opacity-70`}>
                      Runner-up: {modeRec.runner_up.mode}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-800">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Rationale: </span>
                  {modeRec.rationale}
                </div>
                {modeRec.runner_up && (
                  <div className="text-xs text-gray-500 italic">Runner-up rationale: {modeRec.runner_up.rationale}</div>
                )}
              </div>
            )}
          </div>

          {/* Action recommender + deterministic comparison */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Programs for this mode</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  Catalog: {catalogLoading ? "loading…" : `${allActions.length} tagged actions`}
                </span>
                <button
                  onClick={runActionRecommend}
                  disabled={actionsBusy || determFiltered.length === 0}
                  className="px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg disabled:opacity-50"
                >
                  {actionsBusy ? "Ranking…" : "AI rank"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-2">
                  Deterministic filter ({determFiltered.length})
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  What applyModeFilter() drops based on intensity / recovery / mode tags. Same code path the in-app HomeScreen uses.
                </p>
                <div className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
                  {determFiltered.map((a) => {
                    const aiRank = aiOrderByKey.get(a.action_key);
                    return (
                      <div key={a.id} className={`border rounded p-2 ${a.is_keystone ? "border-emerald-300 bg-emerald-50/40" : "border-gray-200"}`}>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PILLAR_CHIP[a.category] || PILLAR_CHIP.general}`}>
                            {a.category}
                          </span>
                          {a.is_keystone && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold" title="Pre-vetted as highest-yield in pillar">
                              KEYSTONE
                            </span>
                          )}
                          {a.intensity && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{a.intensity}</span>}
                          {aiRank !== undefined && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 font-bold">
                              AI #{aiRank}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-800">{a.label}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{a.action_key}</div>
                      </div>
                    );
                  })}
                  {determFiltered.length === 0 && (
                    <div className="text-xs text-gray-400 italic">No candidates — change pillar focus or mode.</div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-2">
                  AI ranking
                </div>
                <p className="text-xs text-gray-400 mb-2">
                  High-yield ordering on top of the deterministic set. Every kept item carries a rationale; dropped items list a reason.
                </p>
                {actionsError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-3">{actionsError}</div>}
                {actionRec ? (
                  <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                    {actionRec.overall_rationale && (
                      <div className="bg-violet-50 border border-violet-200 rounded p-2 text-xs text-violet-900">
                        <span className="font-semibold">Day shape: </span>{actionRec.overall_rationale}
                      </div>
                    )}
                    <div className="space-y-1">
                      {actionRec.ordered_actions.map((r) => {
                        const a = determFiltered.find((x) => x.action_key === r.key);
                        return (
                          <div key={r.key} className="border border-violet-200 rounded p-2 bg-violet-50/30">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-bold text-violet-800">#{r.rank}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">yield {r.yield_score}/5</span>
                              {a && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PILLAR_CHIP[a.category] || PILLAR_CHIP.general}`}>
                                  {a.category}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-800">{a?.label || r.key}</div>
                            <div className="text-xs text-gray-600 italic mt-0.5">{r.rationale}</div>
                          </div>
                        );
                      })}
                    </div>
                    {actionRec.dropped_actions.length > 0 && (
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1 mt-2">
                          Dropped by AI ({actionRec.dropped_actions.length})
                        </div>
                        <div className="space-y-1">
                          {actionRec.dropped_actions.map((d) => {
                            const a = determFiltered.find((x) => x.action_key === d.key);
                            return (
                              <div key={d.key} className="border border-gray-200 rounded p-2 opacity-70">
                                <div className="text-xs text-gray-700">{a?.label || d.key}</div>
                                <div className="text-[10px] text-gray-500 italic">{d.reason}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic">Click &quot;AI rank&quot; to see the model&apos;s ordering.</div>
                )}
              </div>
            </div>
          </div>

          {/* Meals recommender — separate AI path from program_actions.
              Pulls candidates from meals table; allergen filter runs
              server-side before the model sees anything. */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Nutrition (meals library)</h2>
              <div className="flex items-center gap-2">
                <select
                  value={mealSlot}
                  onChange={(e) => setMealSlot(e.target.value as typeof mealSlot)}
                  className="px-2 py-1 border border-gray-200 rounded text-xs bg-gray-50"
                >
                  <option value="all">All slots</option>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
                <button
                  onClick={runMealsRecommend}
                  disabled={mealsBusy}
                  className="px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg disabled:opacity-50"
                >
                  {mealsBusy ? "Ranking…" : "AI rank meals"}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Allergens are filtered server-side using the user&apos;s attestations vs ingredient names — the model never sees an unsafe meal. Mode also gates: sick = no-cook only, tired/vacation = no hard difficulty.
            </p>

            {mealsError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-3">{mealsError}</div>}

            {mealsCounts && (
              <div className="text-xs text-gray-500 mb-3">
                Server filter: <span className="font-semibold text-gray-800">{mealsCounts.candidate}</span> safe candidates from <span className="font-semibold text-gray-800">{mealsCounts.total}</span> total meals
                {mealsCounts.candidate < mealsCounts.total && (
                  <span className="text-amber-700"> · {mealsCounts.total - mealsCounts.candidate} dropped pre-AI (allergen or mode)</span>
                )}
              </div>
            )}

            {mealRec ? (
              <div className="space-y-3">
                {mealRec.overall_rationale && (
                  <div className="bg-violet-50 border border-violet-200 rounded p-2 text-xs text-violet-900">
                    <span className="font-semibold">Day shape: </span>{mealRec.overall_rationale}
                  </div>
                )}
                <div className="space-y-1">
                  {mealRec.ordered_meals.map((m) => {
                    const swap = swapsByMealId[m.id];
                    return (
                      <div key={m.id} className="border border-violet-200 rounded p-2 bg-violet-50/30">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[11px] font-bold text-violet-800">#{m.rank}</span>
                          {m.slot && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SLOT_CHIP[m.slot] || "bg-gray-100 text-gray-700"}`}>
                              {m.slot}
                            </span>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">yield {m.yield_score}/5</span>
                          {m.is_high_protein_keystone && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">KEYSTONE</span>
                          )}
                          {m.protein_g !== null && m.protein_g !== undefined && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{m.protein_g}g protein</span>
                          )}
                          {m.calories !== null && m.calories !== undefined && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{m.calories} kcal</span>
                          )}
                          <button
                            onClick={() => runMealSwap(m.id, 3)}
                            disabled={swapBusyId === m.id}
                            className="ml-auto text-[10px] px-2 py-0.5 rounded border border-violet-300 text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                            title="Get 3 alternatives for this meal"
                          >
                            {swapBusyId === m.id ? "…" : "Swap (3)"}
                          </button>
                        </div>
                        <div className="text-sm text-gray-800">{m.name || m.id}</div>
                        <div className="text-xs text-gray-600 italic mt-0.5">{m.rationale}</div>
                        {swap && (
                          <div className="mt-2 pt-2 border-t border-violet-200">
                            {swap.error && <div className="text-xs text-red-700 italic">{swap.error}</div>}
                            {swap.overall && <div className="text-[11px] text-violet-900 italic mb-1">↳ {swap.overall}</div>}
                            <div className="space-y-1">
                              {swap.alternatives.map((alt) => (
                                <div key={alt.id} className="border border-gray-200 rounded p-1.5 bg-white">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-semibold text-gray-600">#{alt.rank}</span>
                                    {alt.is_high_protein_keystone && (
                                      <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">KEY</span>
                                    )}
                                    <span className="text-xs text-gray-800">{alt.name || alt.id}</span>
                                    {alt.protein_g !== null && alt.protein_g !== undefined && (
                                      <span className="text-[10px] text-gray-500">{alt.protein_g}g protein</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-500 italic mt-0.5">{alt.rationale}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {mealRec.dropped_meals.length > 0 && (
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide mb-1 mt-2">
                      Dropped ({mealRec.dropped_meals.length})
                    </div>
                    <div className="space-y-1">
                      {mealRec.dropped_meals.map((d) => (
                        <div key={d.id} className="border border-gray-200 rounded p-2 opacity-70">
                          <div className="text-xs text-gray-700">{d.name}</div>
                          <div className="text-[10px] text-gray-500 italic">{d.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic">Click &quot;AI rank meals&quot; to see ranked nutrition picks.</div>
            )}
          </div>

          {/* Exercise library swap. Pick any exercise from the 869-entry
              library + count → AI returns N alternatives that match
              equipment + muscle group + difficulty, with limitation
              safety enforced server-side. */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Exercise library swap</h2>
              <span className="text-xs text-gray-500">
                Library: {exerciseLibLoading ? "loading…" : `${exerciseLib.length} exercises`}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Pick any exercise from the library — the AI returns alternatives in the same category, filtered server-side by equipment compat + your attestation limitations + mode caps.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Search & pick exercise</label>
                <input
                  type="text"
                  placeholder="Type to filter (squat, push, row…)"
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2"
                />
                <select
                  value={pickedExerciseId || ""}
                  onChange={(e) => setPickedExerciseId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  size={8}
                >
                  <option value="">— pick an exercise —</option>
                  {(() => {
                    const q = exerciseSearch.toLowerCase().trim();
                    const filtered = q
                      ? exerciseLib.filter((ex) =>
                          ex.name.toLowerCase().includes(q)
                          || ex.category.toLowerCase().includes(q)
                          || ex.equipment.toLowerCase().includes(q),
                        )
                      : exerciseLib;
                    // Render at most 200 matches — without a search query that
                    // means the first 200 alphabetical, but with a query the cap
                    // applies AFTER filtering so typing always reaches results.
                    return filtered.slice(0, 200).map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} ({ex.category}, {ex.equipment}, {ex.difficulty})
                      </option>
                    ));
                  })()}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  {exerciseSearch.trim()
                    ? `Filtered: search applies across name + category + equipment`
                    : `Showing first 200 alphabetically — type to filter the full ${exerciseLib.length}`}
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Alternatives count</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={exerciseSwapCount}
                  onChange={(e) => setExerciseSwapCount(Math.max(1, Math.min(8, parseInt(e.target.value || "3", 10))))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2"
                />
                <button
                  onClick={runExerciseSwap}
                  disabled={!pickedExerciseId || exerciseSwapBusy}
                  className="w-full px-3 py-2 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg disabled:opacity-50"
                >
                  {exerciseSwapBusy ? "Ranking…" : "Get alternatives"}
                </button>
              </div>
            </div>

            {exerciseSwapResult && (
              <div className="space-y-2">
                {exerciseSwapResult.error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{exerciseSwapResult.error}</div>}
                {!exerciseSwapResult.error && (
                  <>
                    <div className="text-xs text-gray-500">
                      Server filter: <span className="font-semibold text-gray-800">{exerciseSwapResult.candidate_count}</span> safe candidates
                    </div>
                    {exerciseSwapResult.overall && (
                      <div className="bg-violet-50 border border-violet-200 rounded p-2 text-xs text-violet-900">
                        <span className="font-semibold">Swap shape: </span>{exerciseSwapResult.overall}
                      </div>
                    )}
                    <div className="bg-gray-50 border border-gray-200 rounded p-2">
                      <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1">Original</div>
                      <div className="text-sm text-gray-800">{exerciseSwapResult.current.name}</div>
                      <div className="text-[10px] text-gray-500">{exerciseSwapResult.current.category} · {exerciseSwapResult.current.equipment} · {exerciseSwapResult.current.difficulty}</div>
                    </div>
                    {exerciseSwapResult.alternatives.map((alt) => (
                      <div key={alt.id} className="border border-violet-200 rounded p-2 bg-violet-50/30">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[11px] font-bold text-violet-800">#{alt.rank}</span>
                          {alt.equipment && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{alt.equipment}</span>}
                          {alt.difficulty && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{alt.difficulty}</span>}
                          {alt.has_video && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">video</span>}
                        </div>
                        <div className="text-sm text-gray-800">{alt.name || alt.id}</div>
                        {alt.muscles_targeted && alt.muscles_targeted.length > 0 && (
                          <div className="text-[10px] text-gray-500">muscles: {alt.muscles_targeted.slice(0, 5).join(", ")}</div>
                        )}
                        <div className="text-xs text-gray-600 italic mt-0.5">{alt.rationale}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Session swap. Take a whole workout (action_key + program +
              week + day) and rebuild for a different environment.
              Pulls candidate sessions from action_exercises (>=2
              exercises mapped) and lets the AI substitute each
              constituent exercise. */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Session swap (gym ↔ home)</h2>
              <span className="text-xs text-gray-500">
                {sessionListLoading ? "loading sessions…" : `${sessionList.length} mapped sessions`}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Take a whole workout session (e.g. &quot;Full Body A — Push focus&quot; with 5 gym exercises) and rebuild it for a different environment. Each exercise gets a same-muscle alternative compatible with the target environment, with limitation safety enforced server-side.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Pick a session</label>
                <select
                  value={pickedSessionKey || ""}
                  onChange={(e) => setPickedSessionKey(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  size={6}
                >
                  <option value="">— pick a session —</option>
                  {sessionList.map((s) => {
                    const key = `${s.action_key}::${s.program_key}::${s.week_range}::${s.day_of_week}`;
                    return (
                      <option key={key} value={key}>
                        {s.label} · {s.exercise_count}ex · {s.program_key} · w{s.week_range}d{s.day_of_week}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Showing top {sessionList.length} sessions by exercise count.</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Target environment</label>
                <select
                  value={targetEnv}
                  onChange={(e) => setTargetEnv(e.target.value as typeof targetEnv)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2"
                >
                  <option value="home">Home (bodyweight + dumbbells + bands)</option>
                  <option value="gym">Gym (barbell + machines + cables)</option>
                  <option value="hybrid">Hybrid (anything goes)</option>
                </select>
                <button
                  onClick={runSessionSwap}
                  disabled={!pickedSessionKey || sessionSwapBusy}
                  className="w-full px-3 py-2 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg disabled:opacity-50"
                >
                  {sessionSwapBusy ? "Swapping…" : "Swap session"}
                </button>
              </div>
            </div>

            {sessionSwapResult && (
              <div className="space-y-3">
                {sessionSwapResult.error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{sessionSwapResult.error}</div>}
                {!sessionSwapResult.error && (
                  <>
                    {sessionSwapResult.session_label && (
                      <div className="text-xs text-gray-500">
                        Session: <span className="font-semibold text-gray-800">{sessionSwapResult.session_label}</span> →
                        <span className="font-semibold text-violet-700"> {sessionSwapResult.target_environment}</span>
                      </div>
                    )}
                    {sessionSwapResult.overall_rationale && (
                      <div className="bg-violet-50 border border-violet-200 rounded p-2 text-xs text-violet-900">
                        <span className="font-semibold">Swap shape: </span>{sessionSwapResult.overall_rationale}
                      </div>
                    )}
                    <div className="space-y-2">
                      {sessionSwapResult.substitutions.map((sub, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-gray-200 rounded p-2 bg-white">
                          <div>
                            <div className="text-[10px] text-gray-500 uppercase font-semibold mb-1">From</div>
                            <div className="text-sm text-gray-800">{sub.current?.name || "?"}</div>
                            <div className="text-[10px] text-gray-500">{sub.current?.equipment} · {sub.current?.difficulty}</div>
                          </div>
                          <div className="border-l border-gray-100 md:pl-3">
                            <div className="text-[10px] text-violet-700 uppercase font-semibold mb-1 flex items-center gap-1">
                              <span>→ To</span>
                              {sub.alternative?.has_video && <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-800">video</span>}
                            </div>
                            <div className="text-sm text-gray-800">{sub.alternative?.name || "?"}</div>
                            <div className="text-[10px] text-gray-500">{sub.alternative?.equipment} · {sub.alternative?.difficulty}</div>
                            <div className="text-[11px] text-gray-600 italic mt-1">{sub.rationale}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {sessionSwapResult.no_alternative_for.length > 0 && (
                      <div>
                        <div className="text-[10px] text-amber-700 uppercase font-semibold mb-1">
                          No safe alternative ({sessionSwapResult.no_alternative_for.length})
                        </div>
                        <div className="space-y-1">
                          {sessionSwapResult.no_alternative_for.map((d) => (
                            <div key={d.id} className="border border-amber-200 rounded p-2 bg-amber-50/40">
                              <div className="text-xs text-gray-700">{d.name}</div>
                              <div className="text-[10px] text-amber-700 italic">{d.reason}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className="font-mono font-semibold text-gray-800">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
