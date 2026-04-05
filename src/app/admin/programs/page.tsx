"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

type TimeGroup = "morning" | "midday" | "evening";

interface ProgramAction {
  id: string;
  label: string;
  timeGroup: TimeGroup;
  details: string[];
  priority: boolean;
}

interface DayContent {
  day: number;
  actions: ProgramAction[];
}

interface WeekContent {
  weekRange: string;
  days: DayContent[];
}

interface Program {
  id: string;
  name: string;
  description: string;
  duration: 4 | 8 | 12;
  weeks: WeekContent[];
}

interface Category {
  id: string;
  name: string;
  programs: Program[];
}

interface ClientProgram {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  category: string;
  program_key: string;
  current_week: number;
  started_at: string;
}

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekRanges = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8", "Week 9", "Week 10", "Week 11", "Week 12"];
const timeGroups: TimeGroup[] = ["morning", "midday", "evening"];

const categoryColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  exercise: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
  nutrition: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", badge: "bg-green-100 text-green-700" },
  sleep: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", badge: "bg-purple-100 text-purple-700" },
  mental: { bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-700", badge: "bg-teal-100 text-teal-700" },
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function createEmptyWeeks(): WeekContent[] {
  return weekRanges.map((wr) => ({
    weekRange: wr,
    days: Array.from({ length: 7 }, (_, i) => ({
      day: i,
      actions: [],
    })),
  }));
}

const sampleCategories: Category[] = [
  {
    id: "exercise",
    name: "Exercise",
    programs: [
      { id: "gym-beginner", name: "Gym — Foundation", description: "Build a solid base with fundamental movements", duration: 8, weeks: createEmptyWeeks() },
      { id: "gym-intermediate", name: "Gym — Progression", description: "Progressive overload with compound lifts", duration: 8, weeks: createEmptyWeeks() },
      { id: "gym-advanced", name: "Gym — Performance", description: "Advanced training with periodisation", duration: 8, weeks: createEmptyWeeks() },
      { id: "home-beginner", name: "Home — Foundation", description: "Bodyweight fundamentals, no equipment needed", duration: 8, weeks: createEmptyWeeks() },
      { id: "home-intermediate", name: "Home — Progression", description: "Resistance bands and bodyweight progressions", duration: 8, weeks: createEmptyWeeks() },
      { id: "home-advanced", name: "Home — Performance", description: "Advanced calisthenics and unilateral work", duration: 8, weeks: createEmptyWeeks() },
      { id: "exercise-daily-insights", name: "Daily Insights", description: "Daily exercise tips shown in the app", duration: 12, weeks: createEmptyWeeks() },
    ],
  },
  {
    id: "nutrition",
    name: "Nutrition",
    programs: [
      { id: "balanced", name: "Balanced eating", description: "Whole foods focus, flexible macros", duration: 8, weeks: createEmptyWeeks() },
      { id: "weight-loss", name: "Weight management", description: "Calorie deficit with high protein", duration: 8, weeks: createEmptyWeeks() },
      { id: "performance-fuel", name: "Performance fuel", description: "High carb for athletes", duration: 8, weeks: createEmptyWeeks() },
      { id: "nutrition-daily-insights", name: "Daily Insights", description: "Daily nutrition tips shown in the app", duration: 12, weeks: createEmptyWeeks() },
    ],
  },
  {
    id: "sleep",
    name: "Sleep",
    programs: [
      { id: "sleep-foundations", name: "Sleep foundations", description: "Build a consistent sleep routine", duration: 8, weeks: createEmptyWeeks() },
      { id: "sleep-optimise", name: "Sleep optimisation", description: "Advanced techniques for deep sleep", duration: 8, weeks: createEmptyWeeks() },
      { id: "sleep-advanced", name: "Advanced sleep", description: "Chronotype optimisation, tracking analysis, protocols", duration: 8, weeks: createEmptyWeeks() },
      { id: "sleep-daily-insights", name: "Daily Insights", description: "Daily sleep tips shown in the app", duration: 12, weeks: createEmptyWeeks() },
    ],
  },
  {
    id: "mental",
    name: "Mental wellness",
    programs: [
      { id: "stress-management", name: "Stress management", description: "Breathing, journalling, mindfulness", duration: 8, weeks: createEmptyWeeks() },
      { id: "resilience", name: "Resilience building", description: "Cold exposure, gratitude, social connection", duration: 8, weeks: createEmptyWeeks() },
      { id: "mental-advanced", name: "Advanced mental", description: "Flow state, CBT techniques, emotional regulation", duration: 8, weeks: createEmptyWeeks() },
      { id: "mental-daily-insights", name: "Daily Insights", description: "Daily mental wellness tips shown in the app", duration: 12, weeks: createEmptyWeeks() },
    ],
  },
];

// Toast component
function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, type === "info" ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [onClose, type]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in max-w-md ${
      type === "success" ? "bg-green-600 text-white" : type === "info" ? "bg-blue-600 text-white" : "bg-red-600 text-white"
    }`}>
      {type === "success" ? (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : type === "info" ? (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {message}
    </div>
  );
}

// Phone preview component
function PhonePreview({ day, categoryId }: { day: DayContent; categoryId: string }) {
  const colors = categoryColors[categoryId] || categoryColors.exercise;
  const grouped = {
    morning: day.actions.filter((a) => a.timeGroup === "morning"),
    midday: day.actions.filter((a) => a.timeGroup === "midday"),
    evening: day.actions.filter((a) => a.timeGroup === "evening"),
  };

  return (
    <div className="w-[280px] h-[500px] bg-gray-900 rounded-[2rem] p-2 shadow-2xl">
      <div className="w-full h-full bg-white rounded-[1.5rem] overflow-hidden flex flex-col">
        <div className="bg-gray-900 text-white px-4 py-3 text-center">
          <div className="w-16 h-1 bg-gray-700 rounded-full mx-auto mb-2" />
          <p className="text-xs font-medium">{dayLabels[day.day]}&apos;s Actions</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {(["morning", "midday", "evening"] as const).map((tg) => {
            const actions = grouped[tg];
            if (actions.length === 0) return null;
            return (
              <div key={tg}>
                <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1">
                  {tg === "morning" ? "Morning" : tg === "midday" ? "Midday" : "Evening"}
                </p>
                {actions.map((a) => (
                  <div key={a.id} className={`p-2 mb-1 rounded-lg border text-xs ${colors.bg} ${colors.border}`}>
                    <div className="flex items-center gap-1">
                      {a.priority && <span className="w-1.5 h-1.5 bg-[#20c858] rounded-full flex-shrink-0" />}
                      <span className={`font-medium ${colors.text}`}>{a.label || "Untitled"}</span>
                    </div>
                    {a.details.length > 0 && (
                      <p className="text-gray-500 mt-0.5 leading-snug">{a.details.join(", ")}</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
          {day.actions.length === 0 && (
            <p className="text-center text-gray-300 text-xs py-8">No actions set</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProgramsCMSPage() {
  const [categories, setCategories] = useState<Category[]>(sampleCategories);
  const [activeTab, setActiveTab] = useState<string>("exercise");
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ weekIdx: number; dayIdx: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadedFromDb, setLoadedFromDb] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [copySource, setCopySource] = useState<number | null>(null);
  const [activeTimeTab, setActiveTimeTab] = useState<TimeGroup | "all">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<{ programId: string; programName: string } | null>(null);

  // Clients tab state
  const [showClientsTab, setShowClientsTab] = useState(false);
  const [clientPrograms, setClientPrograms] = useState<ClientProgram[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Program analytics: active client counts keyed by program_key
  const [programClientCounts, setProgramClientCounts] = useState<Record<string, number>>({});

  const loadClientPrograms = useCallback(async () => {
    setLoadingClients(true);
    try {
      const { data } = await supabase
        .from("client_programs")
        .select("*, clients(full_name, email)")
        .order("started_at", { ascending: false });

      if (data) {
        const mapped: ClientProgram[] = data.map((row: Record<string, unknown>) => {
          const client = row.clients as Record<string, string> | null;
          return {
            id: row.id as string,
            client_id: row.client_id as string,
            full_name: client?.full_name || "Unknown",
            email: client?.email || "",
            category: (row.category as string) || "",
            program_key: (row.program_key as string) || "",
            current_week: (row.current_week as number) || 1,
            started_at: (row.started_at as string) || "",
          };
        });
        setClientPrograms(mapped);
      }
    } catch {
      // Table may not exist
    }
    setLoadingClients(false);
  }, []);

  const loadProgramClientCounts = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("client_programs")
        .select("program_key");
      if (data) {
        const counts: Record<string, number> = {};
        for (const row of data) {
          const key = (row as Record<string, string>).program_key;
          counts[key] = (counts[key] || 0) + 1;
        }
        setProgramClientCounts(counts);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadFromSupabase = useCallback(async () => {
    try {
      const { data: catData } = await supabase.from("program_categories").select("*").order("sort_order", { ascending: true });
      if (catData && catData.length > 0) {
        const { data: progData } = await supabase.from("programs").select("*").order("sort_order", { ascending: true });

        // Fetch actions per program to avoid Supabase row limits
        const actionsByProgram: Record<string, Record<string, unknown>[]> = {};
        for (const prog of (progData || [])) {
          const { data: acts, error: actErr } = await supabase
            .from("program_actions")
            .select("*")
            .eq("program_id", prog.id)
            .order("week_range", { ascending: true })
            .order("day_of_week", { ascending: true })
            .order("sort_order", { ascending: true })
            .limit(1000);
          if (actErr) console.error(`[Load] Error fetching actions for ${prog.key}:`, actErr.message);
          actionsByProgram[prog.id] = acts || [];
          console.log(`[Load] ${prog.key}: ${(acts || []).length} actions loaded`);
        }

        const built: Category[] = catData.map((cat: Record<string, string>) => {
          const catPrograms = (progData || []).filter((p: Record<string, string>) => p.category_id === cat.id);
          return {
            id: cat.key || cat.id,
            name: cat.label || cat.name,
            programs: catPrograms.map((p: Record<string, string | number>) => {
              const progActions = actionsByProgram[p.id as string] || [];
              const weeks = weekRanges.map((wr, wi) => ({
                weekRange: wr,
                days: Array.from({ length: 7 }, (_, di) => ({
                  day: di,
                  actions: progActions
                    .filter((a) => (a as Record<string, number>).week_range === wi && (a as Record<string, number>).day_of_week === di)
                    .map((a: Record<string, unknown>) => ({
                      id: (a.id || "") as string,
                      label: (a.label || "") as string,
                      timeGroup: ((a.time_group || "morning") as string) as TimeGroup,
                      details: Array.isArray(a.details) ? (a.details as string[]) : ((a.details || "") as string).split("\n").filter(Boolean),
                      priority: !!a.priority,
                    })),
                })),
              }));
              return {
                id: (p.key || p.id) as string,
                name: p.name as string,
                description: (p.description || "") as string,
                duration: ((p.duration as number) || 8) as 4 | 8 | 12,
                weeks,
              };
            }),
          };
        });

        setCategories(built);
        setLoadedFromDb(true);
      }
    } catch {
      // Tables may not exist yet, use sample data
    }
  }, []);

  useEffect(() => {
    loadFromSupabase();
    loadProgramClientCounts();
  }, [loadFromSupabase, loadProgramClientCounts]);

  const isClientsTab = showClientsTab;
  const activeCategory = categories.find((c) => c.id === activeTab)!;
  const colors = categoryColors[activeTab] || categoryColors.exercise;

  // Summary stats for tabs
  function getCategorySummary(cat: Category) {
    let totalActions = 0;
    for (const prog of cat.programs) {
      for (const week of prog.weeks) {
        for (const day of week.days) {
          totalActions += day.actions.length;
        }
      }
    }
    return { programCount: cat.programs.length, actionCount: totalActions };
  }

  // Completeness check
  function getProgramCompleteness(program: Program) {
    let filled = 0;
    const total = program.weeks.length * 7;
    for (const week of program.weeks) {
      for (const day of week.days) {
        if (day.actions.length > 0) filled++;
      }
    }
    return { filled, total, pct: Math.round((filled / total) * 100) };
  }

  // Program analytics
  function getProgramStats(program: Program) {
    let totalActions = 0;
    let daysWithActions = 0;
    const totalDays = program.weeks.length * 7;
    for (const week of program.weeks) {
      for (const day of week.days) {
        totalActions += day.actions.length;
        if (day.actions.length > 0) daysWithActions++;
      }
    }
    const completeness = Math.round((daysWithActions / totalDays) * 100);
    const activeClients = programClientCounts[program.id] || 0;
    return { totalActions, completeness, activeClients };
  }

  const updateCategories = (updated: Category[]) => {
    setCategories(updated);
    setDirty(true);
  };

  const programSyncTimeout = useRef<Record<string, NodeJS.Timeout>>({});
  const updateProgram = (programId: string, field: "name" | "description" | "duration", value: string | number) => {
    updateCategories(
      categories.map((cat) => ({
        ...cat,
        programs: cat.programs.map((p) =>
          p.id === programId ? { ...p, [field]: value } : p
        ),
      }))
    );
    // Debounced sync to Supabase (300ms after last keystroke)
    if (programSyncTimeout.current[programId]) clearTimeout(programSyncTimeout.current[programId]);
    programSyncTimeout.current[programId] = setTimeout(async () => {
      try {
        await supabase.from("programs").update({ [field]: value }).eq("key", programId);
      } catch {
        // silent — will sync on full save
      }
    }, 300);
  };

  const addProgram = async () => {
    const newId = makeId();
    updateCategories(
      categories.map((cat) =>
        cat.id === activeTab
          ? {
              ...cat,
              programs: [
                ...cat.programs,
                {
                  id: newId,
                  name: "New Program",
                  description: "",
                  duration: 8 as 4 | 8 | 12,
                  weeks: createEmptyWeeks(),
                },
              ],
            }
          : cat
      )
    );
    // Sync to Supabase
    try {
      const meta = categoryMeta[activeTab] || { icon: "help", color: "#6B7280", label: activeTab };
      const { data: catRow } = await supabase.from("program_categories").upsert({
        key: activeTab,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
      }, { onConflict: "key" }).select("id").single();
      if (catRow) {
        const cat = categories.find((c) => c.id === activeTab);
        await supabase.from("programs").insert({
          category_id: catRow.id,
          key: newId,
          name: "New Program",
          description: "",
          duration: 8,
          sort_order: cat ? cat.programs.length : 0,
        });
      }
      setToast({ message: "Program created and synced", type: "success" });
    } catch {
      setToast({ message: "Created locally — Supabase sync failed", type: "error" });
    }
  };

  const deleteProgram = async (programId: string) => {
    // Remove from local state
    updateCategories(
      categories.map((cat) => ({
        ...cat,
        programs: cat.programs.filter((p) => p.id !== programId),
      }))
    );
    // Sync to Supabase — delete program actions first, then the program
    try {
      const { data: prog } = await supabase.from("programs").select("id").eq("key", programId).maybeSingle();
      if (prog) {
        await supabase.from("program_actions").delete().eq("program_id", prog.id);
        await supabase.from("programs").delete().eq("id", prog.id);
      }
      setToast({ message: "Program deleted", type: "success" });
    } catch {
      setToast({ message: "Deleted locally — Supabase sync failed", type: "error" });
    }
    setPendingDelete(null);
  };

  const addAction = (programId: string, weekIdx: number, dayIdx: number) => {
    updateCategories(
      categories.map((cat) => ({
        ...cat,
        programs: cat.programs.map((p) => {
          if (p.id !== programId) return p;
          const weeks = p.weeks.map((w, wi) => {
            if (wi !== weekIdx) return w;
            const days = w.days.map((d, di) => {
              if (di !== dayIdx) return d;
              return {
                ...d,
                actions: [
                  ...d.actions,
                  { id: makeId(), label: "", timeGroup: "morning" as TimeGroup, details: [] as string[], priority: false },
                ],
              };
            });
            return { ...w, days };
          });
          return { ...p, weeks };
        }),
      }))
    );
  };

  const deleteAction = (programId: string, weekIdx: number, dayIdx: number, actionId: string) => {
    updateCategories(
      categories.map((cat) => ({
        ...cat,
        programs: cat.programs.map((p) => {
          if (p.id !== programId) return p;
          const weeks = p.weeks.map((w, wi) => {
            if (wi !== weekIdx) return w;
            const days = w.days.map((d, di) => {
              if (di !== dayIdx) return d;
              return { ...d, actions: d.actions.filter((a) => a.id !== actionId) };
            });
            return { ...w, days };
          });
          return { ...p, weeks };
        }),
      }))
    );
  };

  const updateAction = (
    programId: string,
    weekIdx: number,
    dayIdx: number,
    actionId: string,
    field: keyof ProgramAction,
    value: string | boolean | string[]
  ) => {
    updateCategories(
      categories.map((cat) => ({
        ...cat,
        programs: cat.programs.map((p) => {
          if (p.id !== programId) return p;
          const weeks = p.weeks.map((w, wi) => {
            if (wi !== weekIdx) return w;
            const days = w.days.map((d, di) => {
              if (di !== dayIdx) return d;
              return {
                ...d,
                actions: d.actions.map((a) =>
                  a.id === actionId ? { ...a, [field]: value } : a
                ),
              };
            });
            return { ...w, days };
          });
          return { ...p, weeks };
        }),
      }))
    );
  };

  const copyWeek = (programId: string, sourceWeekIdx: number, targetWeekIdx: number) => {
    updateCategories(
      categories.map((cat) => ({
        ...cat,
        programs: cat.programs.map((p) => {
          if (p.id !== programId) return p;
          const sourceWeek = p.weeks[sourceWeekIdx];
          const weeks = p.weeks.map((w, wi) => {
            if (wi !== targetWeekIdx) return w;
            return {
              ...w,
              days: sourceWeek.days.map((sd) => ({
                day: sd.day,
                actions: sd.actions.map((a) => ({ ...a, id: makeId() })),
              })),
            };
          });
          return { ...p, weeks };
        }),
      }))
    );
    setCopySource(null);
    setToast({ message: `Copied ${weekRanges[sourceWeekIdx]} to ${weekRanges[targetWeekIdx]}`, type: "success" });
  };

  // Map category ids to icons and colors matching the app
  const categoryMeta: Record<string, { icon: string; color: string; label: string }> = {
    exercise: { icon: "barbell", color: "#3B82F6", label: "Exercise" },
    nutrition: { icon: "nutrition", color: "#20c858", label: "Nutrition" },
    sleep: { icon: "moon", color: "#8B5CF6", label: "Sleep" },
    mental: { icon: "happy", color: "#06B6D4", label: "Mental wellness" },
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (let ci = 0; ci < categories.length; ci++) {
        const cat = categories[ci];
        const meta = categoryMeta[cat.id] || { icon: "help", color: "#6B7280", label: cat.name };
        // Upsert category by key
        const { data: catRow } = await supabase.from("program_categories").upsert({
          key: cat.id,
          label: meta.label || cat.name,
          icon: meta.icon,
          color: meta.color,
          sort_order: ci,
        }, { onConflict: "key" }).select("id").single();

        const categoryDbId = catRow?.id;
        if (!categoryDbId) continue;

        for (let pi = 0; pi < cat.programs.length; pi++) {
          const prog = cat.programs[pi];
          // Upsert program by key
          const { data: progRow } = await supabase.from("programs").upsert({
            category_id: categoryDbId,
            key: prog.id,
            name: prog.name,
            description: prog.description,
            duration: prog.duration,
            sort_order: pi,
          }, { onConflict: "key" }).select("id").single();

          const programDbId = progRow?.id;
          if (!programDbId) continue;

          await supabase.from("program_actions").delete().eq("program_id", programDbId);

          const actions = prog.weeks.flatMap((w, wi) =>
            w.days.flatMap((d, di) =>
              d.actions.map((a, si) => ({
                program_id: programDbId,
                week_range: wi,
                day_of_week: di,
                time_group: a.timeGroup,
                action_key: a.id || `action-${si}`,
                label: a.label,
                category: cat.id,
                details: Array.isArray(a.details) ? a.details : (a.details as unknown as string).split("\n").filter(Boolean),
                priority: a.priority,
                sort_order: si,
              }))
            )
          );

          if (actions.length > 0) {
            await supabase.from("program_actions").insert(actions);
          }
        }
      }
      setDirty(false);
      setToast({ message: "All changes saved successfully", type: "success" });
    } catch (err) {
      console.error("Save error:", err);
      setToast({ message: "Failed to save changes", type: "error" });
    }
    setSaving(false);
  };

  const [syncing, setSyncing] = useState(false);

  const handleSyncList = async () => {
    setSyncing(true);
    try {
      for (let ci = 0; ci < categories.length; ci++) {
        const cat = categories[ci];
        const meta = categoryMeta[cat.id] || { icon: "help", color: "#6B7280", label: cat.name };
        const { data: catRow } = await supabase.from("program_categories").upsert({
          key: cat.id,
          label: meta.label || cat.name,
          icon: meta.icon,
          color: meta.color,
          sort_order: ci,
        }, { onConflict: "key" }).select("id").single();

        const categoryDbId = catRow?.id;
        if (!categoryDbId) continue;

        for (let pi = 0; pi < cat.programs.length; pi++) {
          const prog = cat.programs[pi];
          await supabase.from("programs").upsert({
            category_id: categoryDbId,
            key: prog.id,
            name: prog.name,
            description: prog.description,
            duration: prog.duration,
            sort_order: pi,
          }, { onConflict: "key" });
        }
      }
      setToast({ message: "Program list synced to Supabase", type: "success" });
    } catch (err) {
      console.error("Sync error:", err);
      setToast({ message: "Failed to sync program list", type: "error" });
    }
    setSyncing(false);
  };

  const handleDiscard = () => {
    if (loadedFromDb) {
      loadFromSupabase();
    } else {
      setCategories(sampleCategories);
    }
    setDirty(false);
    setSelectedCell(null);
  };

  const handleExport = () => {
    const json = JSON.stringify(categories, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "programs-export.json";
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: "Exported programs as JSON", type: "success" });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data) && data.length > 0 && data[0].id && data[0].programs) {
          setCategories(data);
          setDirty(true);
          setToast({ message: "Imported programs from JSON", type: "success" });
        } else {
          setToast({ message: "Invalid JSON format", type: "error" });
        }
      } catch {
        setToast({ message: "Failed to parse JSON file", type: "error" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSeedFromApp = () => {
    setToast({
      message: "Run the seed function from the mobile app's Settings > Developer > Seed Content to push hardcoded program content to Supabase.",
      type: "info",
    });
  };

  // Get current program for the action editor
  const expandedProg = !isClientsTab ? activeCategory?.programs.find((p) => p.id === expandedProgram) : undefined;
  const currentDay = expandedProg && selectedCell
    ? expandedProg.weeks[selectedCell.weekIdx]?.days[selectedCell.dayIdx]
    : null;

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Top-level tabs: Categories + Clients */}
      <div className="flex items-center gap-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100 flex-wrap">
        {categories.map((cat) => {
          const summary = getCategorySummary(cat);
          const catColor = categoryColors[cat.id];
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveTab(cat.id);
                setShowClientsTab(false);
                setExpandedProgram(null);
                setSelectedCell(null);
              }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === cat.id && !isClientsTab
                  ? "bg-[#20c858] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>{cat.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === cat.id && !isClientsTab
                  ? "bg-white/20 text-white"
                  : catColor?.badge || "bg-gray-100 text-gray-500"
              }`}>
                {summary.programCount}p / {summary.actionCount}a
              </span>
            </button>
          );
        })}

        {/* Clients tab */}
        <button
          onClick={() => {
            setShowClientsTab(true);
            setExpandedProgram(null);
            setSelectedCell(null);
            loadClientPrograms();
          }}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            isClientsTab
              ? "bg-[#20c858] text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Clients</span>
        </button>
      </div>

      {/* Clients tab content */}
      {isClientsTab && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Client Programs</h2>
            <button
              onClick={loadClientPrograms}
              disabled={loadingClients}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loadingClients ? "Loading..." : "Refresh"}
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Week</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clientPrograms.map((cp) => (
                  <tr key={cp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{cp.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{cp.email}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        categoryColors[cp.category]?.badge || "bg-gray-100 text-gray-500"
                      }`}>
                        {cp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{cp.program_key}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">Week {cp.current_week}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {cp.started_at ? new Date(cp.started_at).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
                {clientPrograms.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                      {loadingClients ? "Loading client programs..." : "No client programs found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category content (hidden when Clients tab is active) */}
      {!isClientsTab && (
        <>
          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={addProgram}
              className="px-4 py-2 bg-[#20c858] text-white text-sm font-medium rounded-lg hover:bg-[#1ab34d] transition-colors"
            >
              + Add Program
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Export JSON
            </button>
            <label className="px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
              Import JSON
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
            <button
              onClick={handleSyncList}
              disabled={syncing}
              className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync to Supabase"}
            </button>
            <button
              onClick={handleSeedFromApp}
              className="px-3 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
            >
              Seed from App
            </button>

            <div className="ml-auto flex items-center gap-3">
              {dirty && (
                <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  Unsaved changes
                </span>
              )}
              <button
                onClick={handleDiscard}
                disabled={!dirty}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[#20c858] text-white text-sm font-medium rounded-lg hover:bg-[#1ab34d] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Programs */}
          <div className="space-y-3">
            {activeCategory.programs.map((program) => {
              const completeness = getProgramCompleteness(program);
              const stats = getProgramStats(program);
              return (
                <div
                  key={program.id}
                  className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                    expandedProgram === program.id ? `${colors.border}` : "border-gray-100"
                  }`}
                >
                  {/* Program header */}
                  <div className="flex items-center gap-4 p-4">
                    <button
                      onClick={() => {
                        setExpandedProgram(expandedProgram === program.id ? null : program.id);
                        setSelectedCell(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${
                          expandedProgram === program.id ? "rotate-90" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2">
                        {program.id.endsWith("-daily-insights") && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full whitespace-nowrap">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                            Insight
                          </span>
                        )}
                        <input
                          type="text"
                          value={program.name}
                          onChange={(e) => updateProgram(program.id, "name", e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                        />
                      </div>
                      <input
                        type="text"
                        value={program.description}
                        onChange={(e) => updateProgram(program.id, "description", e.target.value)}
                        placeholder="Description"
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-[#20c858] outline-none"
                      />
                      <select
                        value={program.duration}
                        onChange={(e) => updateProgram(program.id, "duration", Number(e.target.value))}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-[#20c858] outline-none"
                      >
                        <option value={4}>4 weeks</option>
                        <option value={8}>8 weeks</option>
                        <option value={12}>12 weeks</option>
                      </select>
                    </div>
                    {/* Completeness */}
                    <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            completeness.pct === 100 ? "bg-[#20c858]" : completeness.pct > 50 ? "bg-amber-400" : "bg-red-400"
                          }`}
                          style={{ width: `${completeness.pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        completeness.pct === 100 ? "text-green-600" : completeness.pct > 50 ? "text-amber-600" : "text-red-500"
                      }`}>
                        {completeness.pct}%
                      </span>
                    </div>
                    <button
                      onClick={() => setPendingDelete({ programId: program.id, programName: program.name })}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Analytics stats row */}
                  {expandedProgram === program.id && (
                    <div className="px-4 pb-2 flex items-center gap-6">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">Total actions:</span>
                        <span className="text-xs font-semibold text-gray-700">{stats.totalActions}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">Completeness:</span>
                        <span className={`text-xs font-semibold ${
                          stats.completeness === 100 ? "text-green-600" : stats.completeness > 50 ? "text-amber-600" : "text-red-500"
                        }`}>{stats.completeness}%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">Active clients:</span>
                        <span className="text-xs font-semibold text-gray-700">{stats.activeClients}</span>
                      </div>
                    </div>
                  )}

                  {/* Expanded: calendar grid */}
                  {expandedProgram === program.id && (
                    <div className="border-t border-gray-100 p-4 space-y-4">
                      {/* Copy week controls */}
                      {copySource !== null && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3 text-sm">
                          <span className="text-blue-700">Copy {weekRanges[copySource]} to:</span>
                          {weekRanges.map((wr, wi) => (
                            wi !== copySource && (
                              <button
                                key={wi}
                                onClick={() => copyWeek(program.id, copySource, wi)}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
                              >
                                {wr}
                              </button>
                            )
                          ))}
                          <button onClick={() => setCopySource(null)} className="ml-auto text-blue-500 hover:text-blue-700 text-xs">
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Calendar grid: weeks as columns, days as rows */}
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="p-2 text-xs text-gray-400 font-medium text-left w-16">Day</th>
                              {weekRanges.map((wr, wi) => (
                                <th key={wi} className="p-2 text-xs font-medium text-gray-500 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {wr}
                                    <button
                                      onClick={() => setCopySource(copySource === wi ? null : wi)}
                                      title="Copy this week"
                                      className="p-0.5 text-gray-300 hover:text-gray-500"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                    </button>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dayLabels.map((dayLabel, dayIdx) => (
                              <tr key={dayIdx} className={dayIdx % 2 === 0 ? "" : "bg-gray-50/50"}>
                                <td className="p-2 text-xs font-semibold text-gray-500">{dayLabel}</td>
                                {weekRanges.map((_, weekIdx) => {
                                  const day = program.weeks[weekIdx].days[dayIdx];
                                  const actionCount = day.actions.length;
                                  const isSelected = selectedCell?.weekIdx === weekIdx && selectedCell?.dayIdx === dayIdx;
                                  return (
                                    <td key={weekIdx} className="p-1">
                                      <button
                                        onClick={() => setSelectedCell(isSelected ? null : { weekIdx, dayIdx })}
                                        className={`w-full p-2 rounded-lg text-xs transition-all border ${
                                          isSelected
                                            ? `${colors.bg} ${colors.border} ring-2 ring-[#20c858]/30`
                                            : actionCount > 0
                                            ? `bg-white border-gray-200 hover:${colors.bg} hover:${colors.border}`
                                            : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                                        }`}
                                      >
                                        {actionCount > 0 ? (
                                          <div className="flex items-center justify-center gap-1">
                                            <span className={`font-medium ${isSelected ? colors.text : "text-gray-700"}`}>
                                              {actionCount}
                                            </span>
                                            <span className={isSelected ? colors.text : "text-gray-400"}>
                                              {actionCount === 1 ? "action" : "actions"}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-gray-300">empty</span>
                                        )}
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Action editor panel */}
                      {selectedCell && currentDay && (
                        <div className={`border rounded-xl overflow-hidden ${colors.border}`}>
                          <div className={`${colors.bg} px-4 py-3 flex items-center justify-between`}>
                            <div className="flex items-center gap-3">
                              <h3 className={`text-sm font-semibold ${colors.text}`}>
                                {dayLabels[selectedCell.dayIdx]} - {weekRanges[selectedCell.weekIdx]}
                              </h3>
                              <span className="text-xs text-gray-500">{currentDay.actions.length} action(s)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setShowPreview(!showPreview)}
                                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                                  showPreview ? "bg-[#20c858] text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                {showPreview ? "Hide Preview" : "Preview"}
                              </button>
                              <button
                                onClick={() => addAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx)}
                                className="px-3 py-1 text-xs bg-[#20c858] text-white rounded-lg hover:bg-[#1ab34d] font-medium"
                              >
                                + Add Action
                              </button>
                            </div>
                          </div>

                          <div className={`flex ${showPreview ? "gap-4" : ""}`}>
                            {/* Editor side */}
                            <div className={`flex-1 p-4 ${showPreview ? "border-r border-gray-200" : ""}`}>
                              {/* Time group filter tabs */}
                              <div className="flex items-center gap-1 mb-3 bg-gray-50 rounded-lg p-1 w-fit">
                                {(["all", ...timeGroups] as const).map((tg) => (
                                  <button
                                    key={tg}
                                    onClick={() => setActiveTimeTab(tg)}
                                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                                      activeTimeTab === tg
                                        ? "bg-white text-gray-800 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                    }`}
                                  >
                                    {tg === "all" ? "All" : tg.charAt(0).toUpperCase() + tg.slice(1)}
                                  </button>
                                ))}
                              </div>

                              <div className="space-y-3">
                                {currentDay.actions
                                  .filter((a) => activeTimeTab === "all" || a.timeGroup === activeTimeTab)
                                  .map((action) => (
                                    <div
                                      key={action.id}
                                      className={`p-3 rounded-lg border transition-colors ${
                                        action.priority
                                          ? `${colors.bg} ${colors.border}`
                                          : "bg-white border-gray-200"
                                      }`}
                                    >
                                      <div className="flex items-start gap-2">
                                        {/* Drag handle hint */}
                                        <div className="mt-2 text-gray-300 cursor-grab flex-shrink-0">
                                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                                          </svg>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                            <input
                                              type="text"
                                              value={action.label}
                                              onChange={(e) =>
                                                updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "label", e.target.value)
                                              }
                                              placeholder="Action label"
                                              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900 md:col-span-2"
                                            />
                                            <select
                                              value={action.timeGroup}
                                              onChange={(e) =>
                                                updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "timeGroup", e.target.value)
                                              }
                                              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                                            >
                                              {timeGroups.map((tg) => (
                                                <option key={tg} value={tg}>
                                                  {tg.charAt(0).toUpperCase() + tg.slice(1)}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <textarea
                                            value={action.details.join("\n")}
                                            onChange={(e) =>
                                              updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "details", e.target.value.split("\n"))
                                            }
                                            placeholder="Details (one per line)"
                                            rows={2}
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none resize-none text-gray-900"
                                          />
                                          <div className="flex items-center justify-between">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                              <div className={`relative w-8 h-4 rounded-full transition-colors ${
                                                action.priority ? "bg-[#20c858]" : "bg-gray-300"
                                              }`}>
                                                <input
                                                  type="checkbox"
                                                  checked={action.priority}
                                                  onChange={(e) =>
                                                    updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "priority", e.target.checked)
                                                  }
                                                  className="sr-only"
                                                />
                                                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                                                  action.priority ? "translate-x-4" : "translate-x-0.5"
                                                }`} />
                                              </div>
                                              <span className="text-xs text-gray-500">Priority</span>
                                            </label>
                                            <button
                                              onClick={() =>
                                                deleteAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id)
                                              }
                                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                {currentDay.actions.filter((a) => activeTimeTab === "all" || a.timeGroup === activeTimeTab).length === 0 && (
                                  <div className="text-center py-8 text-gray-300 text-sm">
                                    {activeTimeTab === "all"
                                      ? "No actions yet. Click + Add Action to create one."
                                      : `No ${activeTimeTab} actions. Click + Add Action or switch tabs.`}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Preview side */}
                            {showPreview && (
                              <div className="p-4 flex justify-center items-start">
                                <PhonePreview day={currentDay} categoryId={activeTab} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {activeCategory.programs.length === 0 && (
              <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm shadow-sm border border-gray-100">
                No programs yet. Click &quot;+ Add Program&quot; to create one.
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPendingDelete(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete program</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{pendingDelete.programName}</strong>? All weekly content and actions will be permanently removed from the database.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteProgram(pendingDelete.programId)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
