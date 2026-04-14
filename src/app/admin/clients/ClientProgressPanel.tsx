"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ─────────────────────────────────────────────────

interface ProgramProgress {
  categoryKey: string;
  categoryLabel: string;
  categoryColor: string;
  programName: string;
  currentWeek: number;
  totalExpected: number;
  totalCompleted: number;
  percentage: number;
  previousWeekPercentage: number | null;
  trend: number | null; // difference from previous week
}

export interface ClientProgressData {
  clientId: string;
  totalPercentage: number;
  programs: ProgramProgress[];
  lastActiveDate: string | null;
  daysSinceActive: number | null;
  streak: number;
}

export type NudgeStatus = "on-track" | "needs-nudge" | "inactive" | "no-program";

const categoryDefs: Record<string, { label: string; color: string }> = {
  exercise: { label: "Exercise", color: "#EA580C" },
  nutrition: { label: "Nutrition", color: "#84CC16" },
  sleep: { label: "Sleep", color: "#767194" },
  mental: { label: "Mental", color: "#0EA5E9" },
};

// ─── Nudge status logic ────────────────────────────────────

export function getNudgeStatus(progress: ClientProgressData | null): NudgeStatus {
  if (!progress || progress.programs.length === 0) return "no-program";
  if (progress.daysSinceActive !== null && progress.daysSinceActive >= 3) return "inactive";
  if (progress.totalPercentage < 50) return "needs-nudge";
  return "on-track";
}

export const nudgeConfig: Record<NudgeStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  "on-track": { label: "On track", color: "text-emerald-700", bgColor: "bg-emerald-50", dotColor: "bg-emerald-500" },
  "needs-nudge": { label: "Needs nudge", color: "text-amber-700", bgColor: "bg-amber-50", dotColor: "bg-amber-500" },
  "inactive": { label: "Inactive", color: "text-red-700", bgColor: "bg-red-50", dotColor: "bg-red-500" },
  "no-program": { label: "No program", color: "text-gray-500", bgColor: "bg-gray-50", dotColor: "bg-gray-300" },
};

// ─── Progress ring ─────────────────────────────────────────

function ProgressRing({ percentage, size = 48, strokeWidth = 4, color = "#10B981" }: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5E7EB" strokeWidth={strokeWidth} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        className="transition-all duration-500 ease-out" />
    </svg>
  );
}

// ─── Progress bar ──────────────────────────────────────────

function ProgressBar({ percentage, color, label, subtitle, trend }: {
  percentage: number;
  color: string;
  label: string;
  subtitle: string;
  trend: number | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-gray-700">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-800">{Math.round(percentage)}%</span>
          {trend !== null && trend !== 0 && (
            <span className={`text-[10px] font-medium ${trend > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {trend > 0 ? "+" : ""}{Math.round(trend)}%
            </span>
          )}
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }} />
      </div>
      <p className="text-[10px] text-gray-400">{subtitle}</p>
    </div>
  );
}

// ─── Data fetching hook ────────────────────────────────────

export function useClientProgress(clientId: string): { progress: ClientProgressData | null; loading: boolean } {
  const [progress, setProgress] = useState<ClientProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Get client's active programs
      const { data: clientProgs } = await supabase
        .from("client_programs")
        .select("category_key, program_key, week_number, started_at")
        .eq("client_id", clientId);

      if (!clientProgs || clientProgs.length === 0) {
        setProgress({ clientId, totalPercentage: 0, programs: [], lastActiveDate: null, daysSinceActive: null, streak: 0 });
        setLoading(false);
        return;
      }

      // 2. Get program IDs from program keys
      const programKeys = clientProgs.map((p) => (p as Record<string, unknown>).program_key as string);
      const { data: programs } = await supabase
        .from("programs")
        .select("id, key, name")
        .in("key", programKeys);

      const progMap: Record<string, { id: string; name: string }> = {};
      for (const p of programs || []) {
        progMap[(p as Record<string, string>).key] = { id: (p as Record<string, string>).id, name: (p as Record<string, string>).name };
      }

      // 3. Get all program actions for current and previous weeks
      const progIds = Object.values(progMap).map((p) => p.id);
      const { data: allActions } = await supabase
        .from("program_actions")
        .select("program_id, week_range, day_of_week, action_key, category")
        .in("program_id", progIds);

      // 4. Calculate date ranges for current and previous weeks
      const today = new Date();
      const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun

      // Current week: Monday to today
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);

      const weekStartStr = weekStart.toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];

      // Previous week
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekEnd = new Date(weekStart);
      prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);

      const prevWeekStartStr = prevWeekStart.toISOString().split("T")[0];
      const prevWeekEndStr = prevWeekEnd.toISOString().split("T")[0];

      // 5. Get completions for current week
      const { data: currentCompletions } = await supabase
        .from("action_completions")
        .select("action_key, date, status")
        .eq("client_id", clientId)
        .eq("status", "done")
        .gte("date", weekStartStr)
        .lte("date", todayStr);

      // 6. Get completions for previous week
      const { data: prevCompletions } = await supabase
        .from("action_completions")
        .select("action_key, date, status")
        .eq("client_id", clientId)
        .eq("status", "done")
        .gte("date", prevWeekStartStr)
        .lte("date", prevWeekEndStr);

      // 7. Get last active date and streak
      const { data: recentCompletions } = await supabase
        .from("action_completions")
        .select("date")
        .eq("client_id", clientId)
        .eq("status", "done")
        .order("date", { ascending: false })
        .limit(60);

      let lastActiveDate: string | null = null;
      let daysSinceActive: number | null = null;
      let streak = 0;

      if (recentCompletions && recentCompletions.length > 0) {
        lastActiveDate = (recentCompletions[0] as Record<string, string>).date;
        const lastDate = new Date(lastActiveDate);
        daysSinceActive = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate streak
        const uniqueDates = [...new Set(recentCompletions.map((c) => (c as Record<string, string>).date))].sort().reverse();
        for (let i = 0; i < uniqueDates.length; i++) {
          const expected = new Date(today);
          expected.setDate(expected.getDate() - i);
          const expectedStr = expected.toISOString().split("T")[0];
          if (uniqueDates[i] === expectedStr || (i === 0 && daysSinceActive! <= 1)) {
            streak++;
          } else {
            break;
          }
        }
      }

      // 8. Build per-program progress — count per day to avoid deduplication
      // Completions keyed by "action_key::date" for exact matching
      const currentCompletionPairs = new Set(
        (currentCompletions || []).map((c) => {
          const r = c as Record<string, string>;
          return `${r.action_key}::${r.date}`;
        })
      );
      const prevCompletionPairs = new Set(
        (prevCompletions || []).map((c) => {
          const r = c as Record<string, string>;
          return `${r.action_key}::${r.date}`;
        })
      );

      // Build date strings for each day of the current week
      const dayDates: string[] = [];
      for (let d = 0; d <= dayOfWeek; d++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + d);
        dayDates.push(date.toISOString().split("T")[0]);
      }

      // Previous week date strings
      const prevDayDates: string[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(prevWeekStart);
        date.setDate(prevWeekStart.getDate() + d);
        prevDayDates.push(date.toISOString().split("T")[0]);
      }

      const programProgress: ProgramProgress[] = [];
      let totalExpected = 0;
      let totalCompleted = 0;

      for (const cp of clientProgs) {
        const row = cp as Record<string, unknown>;
        const catKey = row.category_key as string;
        const progKey = row.program_key as string;
        const weekNum = (row.week_number as number) || 1;
        const weekRange = weekNum - 1; // DB uses 0-indexed

        const progInfo = progMap[progKey];
        if (!progInfo) continue;

        const catDef = categoryDefs[catKey] || { label: catKey, color: "#6B7280" };

        // Count expected and completed per day for current week
        let expected = 0;
        let completed = 0;
        for (let d = 0; d <= dayOfWeek; d++) {
          const dayActions = (allActions || []).filter((a) => {
            const act = a as Record<string, unknown>;
            return act.program_id === progInfo.id && act.week_range === weekRange && act.day_of_week === d;
          });
          for (const a of dayActions) {
            const act = a as Record<string, string>;
            const compositeKey = `${act.category}-${act.action_key}`;
            expected++;
            if (currentCompletionPairs.has(`${compositeKey}::${dayDates[d]}`)) {
              completed++;
            }
          }
        }

        // Previous week — count all 7 days
        const prevWeekRange = Math.max(0, weekRange - 1);
        let prevExpected = 0;
        let prevCompleted = 0;
        for (let d = 0; d < 7; d++) {
          const dayActions = (allActions || []).filter((a) => {
            const act = a as Record<string, unknown>;
            return act.program_id === progInfo.id && act.week_range === prevWeekRange && act.day_of_week === d;
          });
          for (const a of dayActions) {
            const act = a as Record<string, string>;
            const compositeKey = `${act.category}-${act.action_key}`;
            prevExpected++;
            if (prevCompletionPairs.has(`${compositeKey}::${prevDayDates[d]}`)) {
              prevCompleted++;
            }
          }
        }

        const percentage = expected > 0 ? (completed / expected) * 100 : 0;
        const prevPercentage = prevExpected > 0 ? (prevCompleted / prevExpected) * 100 : null;
        const trend = prevPercentage !== null ? percentage - prevPercentage : null;

        // Check for custom program name override
        const { data: customProg } = await supabase
          .from("client_custom_programs")
          .select("program_name")
          .eq("client_id", clientId)
          .eq("category_key", catKey)
          .maybeSingle();

        programProgress.push({
          categoryKey: catKey,
          categoryLabel: catDef.label,
          categoryColor: catDef.color,
          programName: customProg ? (customProg as Record<string, string>).program_name : progInfo.name,
          currentWeek: weekNum,
          totalExpected: expected,
          totalCompleted: completed,
          percentage,
          previousWeekPercentage: prevPercentage,
          trend,
        });

        totalExpected += expected;
        totalCompleted += completed;
      }

      // Add "steps" — always-present daily action (key: "steps", category: exercise)
      // The app injects this for every day regardless of program
      const hasAnyProgram = clientProgs.length > 0;
      if (hasAnyProgram) {
        let stepsExpected = 0;
        let stepsCompleted = 0;
        for (let d = 0; d <= dayOfWeek; d++) {
          stepsExpected++;
          if (currentCompletionPairs.has(`steps::${dayDates[d]}`)) {
            stepsCompleted++;
          }
        }
        // Add steps to exercise program row if it exists, otherwise to totals only
        const exerciseRow = programProgress.find((p) => p.categoryKey === "exercise");
        if (exerciseRow) {
          exerciseRow.totalExpected += stepsExpected;
          exerciseRow.totalCompleted += stepsCompleted;
          exerciseRow.percentage = exerciseRow.totalExpected > 0
            ? (exerciseRow.totalCompleted / exerciseRow.totalExpected) * 100 : 0;
        }
        totalExpected += stepsExpected;
        totalCompleted += stepsCompleted;
      }

      const totalPercentage = totalExpected > 0 ? (totalCompleted / totalExpected) * 100 : 0;

      setProgress({
        clientId,
        totalPercentage,
        programs: programProgress,
        lastActiveDate,
        daysSinceActive,
        streak,
      });
    } catch (err) {
      console.error("[ClientProgress] Error:", err);
      setProgress(null);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  return { progress, loading };
}

// ─── Batch hook for all clients ────────────────────────────

export function useAllClientsProgress(clientIds: string[]): {
  progressMap: Record<string, ClientProgressData>;
  loading: boolean;
} {
  const [progressMap, setProgressMap] = useState<Record<string, ClientProgressData>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (clientIds.length === 0) { setLoading(false); return; }
    setLoading(true);

    try {
      // Batch fetch all data in parallel
      const [
        { data: allClientProgs },
        { data: allPrograms },
        { data: allActions },
      ] = await Promise.all([
        supabase.from("client_programs").select("client_id, category_key, program_key, week_number").in("client_id", clientIds),
        supabase.from("programs").select("id, key, name"),
        supabase.from("program_actions").select("program_id, week_range, day_of_week, action_key, category"),
      ]);

      const progMap: Record<string, { id: string; name: string }> = {};
      for (const p of allPrograms || []) {
        progMap[(p as Record<string, string>).key] = { id: (p as Record<string, string>).id, name: (p as Record<string, string>).name };
      }

      const today = new Date();
      const dayOfWeek = (today.getDay() + 6) % 7;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - dayOfWeek);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];

      // Fetch completions for this week for all clients
      const { data: allCompletions } = await supabase
        .from("action_completions")
        .select("client_id, action_key, date")
        .in("client_id", clientIds)
        .eq("status", "done")
        .gte("date", weekStartStr)
        .lte("date", todayStr);

      // Fetch last active date for all clients
      const { data: lastActiveDates } = await supabase
        .from("action_completions")
        .select("client_id, date")
        .in("client_id", clientIds)
        .eq("status", "done")
        .order("date", { ascending: false });

      // Group completions by client — store "action_key::date" pairs to count per-day
      const completionsByClient: Record<string, Set<string>> = {};
      for (const c of allCompletions || []) {
        const row = c as Record<string, string>;
        if (!completionsByClient[row.client_id]) completionsByClient[row.client_id] = new Set();
        completionsByClient[row.client_id].add(`${row.action_key}::${row.date}`);
      }

      // Build date strings for each day of the current week
      const dayDates: string[] = [];
      for (let d = 0; d <= dayOfWeek; d++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + d);
        dayDates.push(date.toISOString().split("T")[0]);
      }

      const lastActiveByClient: Record<string, string> = {};
      for (const c of lastActiveDates || []) {
        const row = c as Record<string, string>;
        if (!lastActiveByClient[row.client_id]) lastActiveByClient[row.client_id] = row.date;
      }

      const progsByClient: Record<string, Array<Record<string, unknown>>> = {};
      for (const cp of allClientProgs || []) {
        const row = cp as Record<string, unknown>;
        const cid = row.client_id as string;
        if (!progsByClient[cid]) progsByClient[cid] = [];
        progsByClient[cid].push(row);
      }

      // Calculate progress for each client
      const result: Record<string, ClientProgressData> = {};

      for (const clientId of clientIds) {
        const clientProgs = progsByClient[clientId] || [];
        const clientCompletions = completionsByClient[clientId] || new Set();
        const lastActive = lastActiveByClient[clientId] || null;

        let daysInactive: number | null = null;
        if (lastActive) {
          daysInactive = Math.floor((today.getTime() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24));
        }

        if (clientProgs.length === 0) {
          result[clientId] = { clientId, totalPercentage: 0, programs: [], lastActiveDate: lastActive, daysSinceActive: daysInactive, streak: 0 };
          continue;
        }

        let totalExpected = 0;
        let totalCompleted = 0;
        const programs: ProgramProgress[] = [];

        for (const cp of clientProgs) {
          const catKey = cp.category_key as string;
          const progKey = cp.program_key as string;
          const weekNum = (cp.week_number as number) || 1;
          const weekRange = weekNum - 1;
          const progInfo = progMap[progKey];
          if (!progInfo) continue;

          const catDef = categoryDefs[catKey] || { label: catKey, color: "#6B7280" };

          // Count per-day to avoid deduplication across days
          let expected = 0;
          let completed = 0;
          for (let d = 0; d <= dayOfWeek; d++) {
            const dayActions = (allActions || []).filter((a) => {
              const act = a as Record<string, unknown>;
              return act.program_id === progInfo.id && act.week_range === weekRange && act.day_of_week === d;
            });
            for (const a of dayActions) {
              const act = a as Record<string, string>;
              const compositeKey = `${act.category}-${act.action_key}`;
              expected++;
              if (clientCompletions.has(`${compositeKey}::${dayDates[d]}`)) {
                completed++;
              }
            }
          }
          const percentage = expected > 0 ? (completed / expected) * 100 : 0;

          programs.push({
            categoryKey: catKey,
            categoryLabel: catDef.label,
            categoryColor: catDef.color,
            programName: progInfo.name,
            currentWeek: weekNum,
            totalExpected: expected,
            totalCompleted: completed,
            percentage,
            previousWeekPercentage: null,
            trend: null,
          });

          totalExpected += expected;
          totalCompleted += completed;
        }

        // Add "steps" — always-present daily action
        if (clientProgs.length > 0) {
          let stepsExpected = 0;
          let stepsCompleted = 0;
          for (let d = 0; d <= dayOfWeek; d++) {
            stepsExpected++;
            if (clientCompletions.has(`steps::${dayDates[d]}`)) {
              stepsCompleted++;
            }
          }
          const exerciseRow = programs.find((p) => p.categoryKey === "exercise");
          if (exerciseRow) {
            exerciseRow.totalExpected += stepsExpected;
            exerciseRow.totalCompleted += stepsCompleted;
            exerciseRow.percentage = exerciseRow.totalExpected > 0
              ? (exerciseRow.totalCompleted / exerciseRow.totalExpected) * 100 : 0;
          }
          totalExpected += stepsExpected;
          totalCompleted += stepsCompleted;
        }

        result[clientId] = {
          clientId,
          totalPercentage: totalExpected > 0 ? (totalCompleted / totalExpected) * 100 : 0,
          programs,
          lastActiveDate: lastActive,
          daysSinceActive: daysInactive,
          streak: 0,
        };
      }

      setProgressMap(result);
    } catch (err) {
      console.error("[AllClientsProgress] Error:", err);
    }
    setLoading(false);
  }, [clientIds.join(",")]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { progressMap, loading };
}

// ─── Inline progress indicator (collapsed row) ─────────────

export function ProgressIndicator({ progress, loading }: { progress: ClientProgressData | null; loading: boolean }) {
  if (loading) return <span className="text-[10px] text-gray-300">...</span>;
  if (!progress || progress.programs.length === 0) return <span className="text-[10px] text-gray-300">—</span>;

  const status = getNudgeStatus(progress);
  const config = nudgeConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8">
        <ProgressRing
          percentage={progress.totalPercentage}
          size={32}
          strokeWidth={3}
          color={status === "on-track" ? "#10B981" : status === "needs-nudge" ? "#F59E0B" : "#EF4444"}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-700">
          {Math.round(progress.totalPercentage)}
        </span>
      </div>
      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${config.color} ${config.bgColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
        {config.label}
      </div>
    </div>
  );
}

// ─── Expanded progress panel ───────────────────────────────

export function ClientProgressPanel({ clientId }: { clientId: string }) {
  const { progress, loading } = useClientProgress(clientId);

  if (loading) {
    return (
      <div className="py-4 text-center">
        <span className="text-xs text-gray-400">Loading progress...</span>
      </div>
    );
  }

  if (!progress || progress.programs.length === 0) {
    return (
      <div className="py-4 text-center">
        <span className="text-xs text-gray-400">No active programs</span>
      </div>
    );
  }

  const status = getNudgeStatus(progress);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Weekly Progress</p>

      {/* Overall stats row */}
      <div className="flex items-center gap-6 mb-4 p-3 bg-gray-50/80 rounded-xl">
        <div className="relative">
          <ProgressRing
            percentage={progress.totalPercentage}
            size={56}
            strokeWidth={5}
            color={status === "on-track" ? "#10B981" : status === "needs-nudge" ? "#F59E0B" : "#EF4444"}
          />
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800">
            {Math.round(progress.totalPercentage)}%
          </span>
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-gray-800">Overall completion</p>
          <p className="text-xs text-gray-500">
            {progress.programs.reduce((s, p) => s + p.totalCompleted, 0)} of{" "}
            {progress.programs.reduce((s, p) => s + p.totalExpected, 0)} actions this week
          </p>
        </div>
        <div className="text-right space-y-1">
          {progress.streak > 0 && (
            <p className="text-xs font-medium text-emerald-600">{progress.streak} day streak</p>
          )}
          {progress.lastActiveDate && (
            <p className="text-[10px] text-gray-400">
              Last active: {progress.daysSinceActive === 0 ? "today" : progress.daysSinceActive === 1 ? "yesterday" : `${progress.daysSinceActive}d ago`}
            </p>
          )}
        </div>
      </div>

      {/* Per-program breakdown */}
      <div className="space-y-3">
        {progress.programs.map((prog) => (
          <ProgressBar
            key={prog.categoryKey}
            percentage={prog.percentage}
            color={prog.categoryColor}
            label={`${prog.categoryLabel} — ${prog.programName}`}
            subtitle={`Week ${prog.currentWeek} · ${prog.totalCompleted}/${prog.totalExpected} actions`}
            trend={prog.trend}
          />
        ))}
      </div>
    </div>
  );
}
