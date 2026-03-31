"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

type TimeGroup = "morning" | "midday" | "evening";

interface ProgramAction {
  id: string;
  label: string;
  timeGroup: TimeGroup;
  details: string;
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
  weeks: WeekContent[];
}

interface Category {
  id: string;
  name: string;
  programs: Program[];
}

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekRanges = ["Week 1", "Week 2", "Week 3", "Week 4"];
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
      {
        id: makeId(),
        name: "Beginner Strength",
        description: "Foundational strength training for newcomers",
        weeks: weekRanges.map((wr) => ({
          weekRange: wr,
          days: Array.from({ length: 7 }, (_, d) => ({
            day: d,
            actions:
              d < 5
                ? [
                    { id: makeId(), label: "Warm-up walk", timeGroup: "morning" as TimeGroup, details: "10 min brisk walk", priority: false },
                    { id: makeId(), label: "Bodyweight circuit", timeGroup: "midday" as TimeGroup, details: "Squats, push-ups, lunges - 3 sets", priority: true },
                  ]
                : [{ id: makeId(), label: "Active recovery", timeGroup: "morning" as TimeGroup, details: "Light stretching or yoga", priority: false }],
          })),
        })),
      },
    ],
  },
  {
    id: "nutrition",
    name: "Nutrition",
    programs: [
      {
        id: makeId(),
        name: "Clean Eating Basics",
        description: "Learn the fundamentals of healthy eating",
        weeks: weekRanges.map((wr) => ({
          weekRange: wr,
          days: Array.from({ length: 7 }, (_, d) => ({
            day: d,
            actions: [
              { id: makeId(), label: "Meal prep", timeGroup: "morning" as TimeGroup, details: "Prepare meals for the day", priority: d === 0 },
              { id: makeId(), label: "Hydration check", timeGroup: "midday" as TimeGroup, details: "Ensure 2L water intake", priority: false },
            ],
          })),
        })),
      },
    ],
  },
  {
    id: "sleep",
    name: "Sleep",
    programs: [
      {
        id: makeId(),
        name: "Better Sleep Habits",
        description: "Improve sleep quality through better routines",
        weeks: weekRanges.map((wr) => ({
          weekRange: wr,
          days: Array.from({ length: 7 }, (_, d) => ({
            day: d,
            actions: [
              { id: makeId(), label: "Wind-down routine", timeGroup: "evening" as TimeGroup, details: "No screens 30min before bed", priority: true },
            ],
          })),
        })),
      },
    ],
  },
  {
    id: "mental",
    name: "Mental Wellness",
    programs: [
      {
        id: makeId(),
        name: "Mindfulness Starter",
        description: "Daily mindfulness and stress management",
        weeks: weekRanges.map((wr) => ({
          weekRange: wr,
          days: Array.from({ length: 7 }, (_, d) => ({
            day: d,
            actions: [
              { id: makeId(), label: "Morning meditation", timeGroup: "morning" as TimeGroup, details: "5-10 min guided meditation", priority: true },
              { id: makeId(), label: "Gratitude journal", timeGroup: "evening" as TimeGroup, details: "Write 3 things you are grateful for", priority: false },
            ],
          })),
        })),
      },
    ],
  },
];

// Toast component
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-in ${
      type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
    }`}>
      {type === "success" ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    {a.details && (
                      <p className="text-gray-500 mt-0.5 leading-snug">{a.details}</p>
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
  const [activeTab, setActiveTab] = useState("exercise");
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ weekIdx: number; dayIdx: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loadedFromDb, setLoadedFromDb] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [copySource, setCopySource] = useState<number | null>(null);
  const [activeTimeTab, setActiveTimeTab] = useState<TimeGroup | "all">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFromSupabase = useCallback(async () => {
    try {
      const { data: catData } = await supabase.from("program_categories").select("*");
      if (catData && catData.length > 0) {
        const { data: progData } = await supabase.from("programs").select("*");
        const { data: actData } = await supabase.from("program_actions").select("*");

        const built: Category[] = catData.map((cat: Record<string, string>) => {
          const catPrograms = (progData || []).filter((p: Record<string, string>) => p.category_id === cat.id);
          return {
            id: cat.id,
            name: cat.name,
            programs: catPrograms.map((p: Record<string, string>) => {
              const progActions = (actData || []).filter((a: Record<string, string>) => a.program_id === p.id);
              const weeks = weekRanges.map((wr, wi) => ({
                weekRange: wr,
                days: Array.from({ length: 7 }, (_, di) => ({
                  day: di,
                  actions: progActions
                    .filter((a: Record<string, number>) => a.week === wi && a.day === di)
                    .map((a: Record<string, string | boolean>) => ({
                      id: a.id as string,
                      label: a.label as string,
                      timeGroup: (a.time_group || "morning") as TimeGroup,
                      details: (a.details || "") as string,
                      priority: !!a.priority,
                    })),
                })),
              }));
              return {
                id: p.id,
                name: p.name,
                description: p.description || "",
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
  }, [loadFromSupabase]);

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
    const total = 4 * 7;
    for (const week of program.weeks) {
      for (const day of week.days) {
        if (day.actions.length > 0) filled++;
      }
    }
    return { filled, total, pct: Math.round((filled / total) * 100) };
  }

  const updateCategories = (updated: Category[]) => {
    setCategories(updated);
    setDirty(true);
  };

  const updateProgram = (programId: string, field: "name" | "description", value: string) => {
    updateCategories(
      categories.map((cat) => ({
        ...cat,
        programs: cat.programs.map((p) =>
          p.id === programId ? { ...p, [field]: value } : p
        ),
      }))
    );
  };

  const addProgram = () => {
    updateCategories(
      categories.map((cat) =>
        cat.id === activeTab
          ? {
              ...cat,
              programs: [
                ...cat.programs,
                {
                  id: makeId(),
                  name: "New Program",
                  description: "",
                  weeks: createEmptyWeeks(),
                },
              ],
            }
          : cat
      )
    );
  };

  const deleteProgram = (programId: string) => {
    updateCategories(
      categories.map((cat) => ({
        ...cat,
        programs: cat.programs.filter((p) => p.id !== programId),
      }))
    );
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
                  { id: makeId(), label: "", timeGroup: "morning" as TimeGroup, details: "", priority: false },
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
    value: string | boolean
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

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const cat of categories) {
        await supabase.from("program_categories").upsert({ id: cat.id, name: cat.name });

        for (const prog of cat.programs) {
          await supabase.from("programs").upsert({
            id: prog.id,
            category_id: cat.id,
            name: prog.name,
            description: prog.description,
          });

          await supabase.from("program_actions").delete().eq("program_id", prog.id);

          const actions = prog.weeks.flatMap((w, wi) =>
            w.days.flatMap((d, di) =>
              d.actions.map((a) => ({
                id: a.id,
                program_id: prog.id,
                week: wi,
                day: di,
                label: a.label,
                time_group: a.timeGroup,
                details: a.details,
                priority: a.priority,
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

  // Get current program for the action editor
  const expandedProg = activeCategory.programs.find((p) => p.id === expandedProgram);
  const currentDay = expandedProg && selectedCell
    ? expandedProg.weeks[selectedCell.weekIdx]?.days[selectedCell.dayIdx]
    : null;

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Category Tabs with summaries */}
      <div className="flex items-center gap-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100 flex-wrap">
        {categories.map((cat) => {
          const summary = getCategorySummary(cat);
          const catColor = categoryColors[cat.id];
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveTab(cat.id);
                setExpandedProgram(null);
                setSelectedCell(null);
              }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === cat.id
                  ? "bg-[#20c858] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>{cat.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === cat.id
                  ? "bg-white/20 text-white"
                  : catColor?.badge || "bg-gray-100 text-gray-500"
              }`}>
                {summary.programCount}p / {summary.actionCount}a
              </span>
            </button>
          );
        })}
      </div>

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
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={program.name}
                    onChange={(e) => updateProgram(program.id, "name", e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                  />
                  <input
                    type="text"
                    value={program.description}
                    onChange={(e) => updateProgram(program.id, "description", e.target.value)}
                    placeholder="Description"
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-[#20c858] outline-none"
                  />
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
                  onClick={() => deleteProgram(program.id)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

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
                                        value={action.details}
                                        onChange={(e) =>
                                          updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "details", e.target.value)
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
    </div>
  );
}
