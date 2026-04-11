"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

type TimeGroup = "morning" | "midday" | "evening";

interface Exercise {
  id: string;
  name: string;
  description: string;
  category: string;
  equipment: string;
  difficulty: string;
  illustration_url: string | null;
  muscles_targeted: string[] | null;
}

interface ActionExercise {
  id?: string;
  action_key: string;
  program_key: string;
  week_range: number;
  day_of_week: number;
  exercise_id: string;
  exercise_name: string;
  sets: number | null;
  reps: string;
  duration: string;
  rest: string;
  notes: string;
  sort_order: number;
}

interface ProgramAction {
  id: string;
  label: string;
  timeGroup: TimeGroup;
  details: string[];
  priority: boolean;
  imageUrl?: string;
  videoUrl?: string;
}

interface DayContent {
  day: number;
  actions: ProgramAction[];
}

interface WeekContent {
  weekRange: string;
  days: DayContent[];
}

type ProgramLevel = "beginner" | "intermediate" | "advanced" | "";

type ExerciseType = "gym" | "home" | "";

interface ProgramPhase {
  weeks: string;
  name: string;
  description: string;
}

interface Program {
  id: string;
  name: string;
  tagline: string;
  description: string;
  duration: 4 | 8 | 12;
  level: ProgramLevel;
  exerciseType: ExerciseType;
  targetAudience: string;
  structuredPhases: ProgramPhase[];
  phases: string; // legacy
  weeklyFocus: [string, string, string, string, string, string, string]; // Mon..Sun
  weeks: WeekContent[];
  // Custom program fields (for client_custom_programs rows)
  isCustom?: boolean;
  customDbId?: string; // UUID of the client_custom_programs row
  customClientId?: string;
  customClientName?: string;
  customShared?: boolean;
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

// Categories and programs are loaded from Supabase on mount — no hardcoded fallback

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
                      {a.priority && <span className="w-1.5 h-1.5 bg-[#0D9488] rounded-full flex-shrink-0" />}
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
  const [categories, setCategories] = useState<Category[]>([]);
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
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [programTemplates, setProgramTemplates] = useState<Array<{ id: string; name: string; category_key: string; description: string; actions: unknown[]; duration: number; level: string; exercise_type: string; target_audience: string; structured_phases: unknown; tagline: string }>>([]);

  // Exercise library state
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([]);
  const [exerciseLibraryLoaded, setExerciseLibraryLoaded] = useState(false);
  const [actionExercises, setActionExercises] = useState<Record<string, ActionExercise[]>>({});
  const [showExercisePicker, setShowExercisePicker] = useState<{ programId: string; weekIdx: number; dayIdx: number; actionId: string; actionIndex: number } | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [exerciseForm, setExerciseForm] = useState({ sets: 3, reps: "8-12", rest: "60s", notes: "" });

  // Clients tab state
  const [showClientsTab, setShowClientsTab] = useState(false);
  // Toggle between public and custom programs view inside each category tab
  const [programView, setProgramView] = useState<"public" | "custom">("public");
  const [clientPrograms, setClientPrograms] = useState<ClientProgram[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Program analytics: active client counts keyed by program_key
  const [programClientCounts, setProgramClientCounts] = useState<Record<string, number>>({});

  // Share modal state (assigns global program directly)
  const [showShareModal, setShowShareModal] = useState<Program | null>(null);
  const [shareSearch, setShareSearch] = useState("");

  // Customize modal state (clones program into client_custom_programs)
  const [showCustomizeModal, setShowCustomizeModal] = useState<Program | null>(null);
  const [customizeSearch, setCustomizeSearch] = useState("");
  const [customizeClients, setCustomizeClients] = useState<Array<{ id: string; full_name: string; email: string }>>([]);
  const [customizeSelected, setCustomizeSelected] = useState<Set<string>>(new Set());
  const [customizeLoading, setCustomizeLoading] = useState(false);
  const [customizeSaving, setCustomizeSaving] = useState(false);
  const [customizeName, setCustomizeName] = useState("");
  const [shareClients, setShareClients] = useState<Array<{ id: string; full_name: string; email: string; current_program_key: string | null }>>([]);
  const [shareAssigned, setShareAssigned] = useState<Set<string>>(new Set());
  const [shareLoading, setShareLoading] = useState(false);
  const [shareAssigning, setShareAssigning] = useState<Set<string>>(new Set());

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

  const loadShareClients = useCallback(async (programKey: string, categoryKey: string, search: string) => {
    setShareLoading(true);
    try {
      let query = supabase.from("clients").select("id, full_name, email").order("full_name", { ascending: true }).limit(50);
      if (search.trim()) {
        query = query.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
      }
      const { data: clients } = await query;
      if (clients) {
        // Load client_programs for this category to see current assignments
        const clientIds = clients.map((c: Record<string, string>) => c.id);
        const { data: assignments } = await supabase
          .from("client_programs")
          .select("client_id, program_key")
          .eq("category", categoryKey)
          .in("client_id", clientIds);

        const assignmentMap: Record<string, string> = {};
        const assignedSet = new Set<string>();
        if (assignments) {
          for (const a of assignments) {
            const row = a as Record<string, string>;
            assignmentMap[row.client_id] = row.program_key;
            if (row.program_key === programKey) {
              assignedSet.add(row.client_id);
            }
          }
        }

        setShareClients(clients.map((c: Record<string, string>) => ({
          id: c.id,
          full_name: c.full_name || "Unknown",
          email: c.email || "",
          current_program_key: assignmentMap[c.id] || null,
        })));
        setShareAssigned(assignedSet);
      }
    } catch {
      // Table may not exist
    }
    setShareLoading(false);
  }, []);

  const assignProgramToClient = useCallback(async (clientId: string, clientName: string, programKey: string, categoryKey: string) => {
    setShareAssigning(prev => new Set(prev).add(clientId));
    try {
      await supabase.from("client_programs").upsert({
        client_id: clientId,
        category_key: categoryKey,
        program_key: programKey,
        week_number: 1,
        started_at: new Date().toISOString(),
      }, { onConflict: "client_id,category_key" });

      setShareAssigned(prev => new Set(prev).add(clientId));
      setShareClients(prev => prev.map(c => c.id === clientId ? { ...c, current_program_key: programKey } : c));
      setToast({ message: `Program assigned to ${clientName}`, type: "success" });
      // Update counts
      loadProgramClientCounts();
    } catch {
      setToast({ message: "Failed to assign program", type: "error" });
    }
    setShareAssigning(prev => { const next = new Set(prev); next.delete(clientId); return next; });
  }, [loadProgramClientCounts]);

  const assignProgramToAll = useCallback(async (programKey: string, categoryKey: string) => {
    const unassigned = shareClients.filter(c => !shareAssigned.has(c.id));
    if (unassigned.length === 0) return;
    setShareLoading(true);
    try {
      const rows = unassigned.map(c => ({
        client_id: c.id,
        category_key: categoryKey,
        program_key: programKey,
        started_at: new Date().toISOString(),
        week_number: 1,
      }));
      await supabase.from("client_programs").upsert(rows, { onConflict: "client_id,category_key" });
      setShareAssigned(prev => {
        const next = new Set(prev);
        unassigned.forEach(c => next.add(c.id));
        return next;
      });
      setShareClients(prev => prev.map(c => ({ ...c, current_program_key: programKey })));
      setToast({ message: `Program assigned to ${unassigned.length} client${unassigned.length > 1 ? "s" : ""}`, type: "success" });
      loadProgramClientCounts();
    } catch {
      setToast({ message: "Failed to assign to all clients", type: "error" });
    }
    setShareLoading(false);
  }, [shareClients, shareAssigned, loadProgramClientCounts]);

  // ──────────────────────────────────────────────────────────────────────────
  // Customize for clients: clone a program into client_custom_programs (one
  // row per selected client). The clone is a per-client copy that the coach
  // can later edit without touching the global program.
  // ──────────────────────────────────────────────────────────────────────────

  // Convert the program's weeks/days/actions matrix into the flat array
  // format used by client_custom_programs.actions (jsonb).
  const flattenWeeksToActions = useCallback((weeks: WeekContent[]): Array<Record<string, unknown>> => {
    const out: Array<Record<string, unknown>> = [];
    weeks.forEach((week, wi) => {
      week.days.forEach((day) => {
        day.actions.forEach((action, ai) => {
          out.push({
            id: action.id,
            week_range: wi,
            day_of_week: day.day,
            time_group: action.timeGroup,
            sort_order: ai,
            label: action.label,
            details: action.details,
            priority: action.priority,
            image_url: action.imageUrl || null,
            video_url: action.videoUrl || null,
          });
        });
      });
    });
    return out;
  }, []);

  // Inverse: convert client_custom_programs.actions jsonb back into the
  // weeks/days/actions matrix used by the editor.
  const unflattenActionsToWeeks = useCallback((actions: Array<Record<string, unknown>>): WeekContent[] => {
    const weeks: WeekContent[] = createEmptyWeeks();
    if (!Array.isArray(actions)) return weeks;
    for (const a of actions) {
      const wi = (a.week_range as number) ?? 0;
      const di = (a.day_of_week as number) ?? 0;
      if (wi < 0 || wi > 11 || di < 0 || di > 6) continue;
      const action: ProgramAction = {
        id: (a.id as string) || makeId(),
        timeGroup: ((a.time_group as TimeGroup) || "morning") as TimeGroup,
        label: (a.label as string) || "",
        details: Array.isArray(a.details) ? (a.details as string[]) : [],
        priority: !!a.priority,
        imageUrl: (a.image_url as string) || undefined,
        videoUrl: (a.video_url as string) || undefined,
      };
      weeks[wi].days[di].actions.push(action);
    }
    // Sort actions in each day by sort_order if present
    for (const w of weeks) {
      for (const d of w.days) {
        d.actions.sort((a, b) => {
          const ai = actions.find(x => x.id === a.id)?.sort_order as number ?? 0;
          const bi = actions.find(x => x.id === b.id)?.sort_order as number ?? 0;
          return ai - bi;
        });
      }
    }
    return weeks;
  }, []);

  // Load custom programs (client_custom_programs) and append them to the
  // matching category in the categories array. Each becomes an editable
  // Program with isCustom=true.
  const loadCustomProgramsIntoCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("client_custom_programs")
        .select("*, clients(id, full_name, email)")
        .order("updated_at", { ascending: false });
      if (error || !data) return;
      setCategories((prev) => {
        // Strip any existing custom programs (we're refreshing them)
        const withoutCustom = prev.map((cat) => ({
          ...cat,
          programs: cat.programs.filter((p) => !p.isCustom),
        }));
        // Build custom Program objects from each row
        for (const row of data as Array<Record<string, unknown>>) {
          const catKey = row.category_key as string;
          const cat = withoutCustom.find((c) => c.id === catKey);
          if (!cat) continue;
          const client = row.clients as Record<string, string> | null;
          const customProg: Program = {
            id: `custom-${row.id}`,
            name: (row.program_name as string) || "Custom program",
            tagline: (row.tagline as string) || "",
            description: (row.description as string) || "",
            duration: ((row.duration as number) || 8) as 4 | 8 | 12,
            level: ((row.level as ProgramLevel) || "") as ProgramLevel,
            exerciseType: ((row.exercise_type as ExerciseType) || "") as ExerciseType,
            targetAudience: (row.target_audience as string) || "",
            structuredPhases: (() => {
              try {
                const raw = row.structured_phases;
                if (Array.isArray(raw)) return raw as ProgramPhase[];
                if (typeof raw === "string") return JSON.parse(raw) as ProgramPhase[];
              } catch {}
              return [];
            })(),
            phases: "",
            weeklyFocus: ["", "", "", "", "", "", ""] as Program["weeklyFocus"],
            weeks: unflattenActionsToWeeks((row.actions as Array<Record<string, unknown>>) || []),
            isCustom: true,
            customDbId: row.id as string,
            customClientId: client?.id || "",
            customClientName: client?.full_name || "Unknown client",
            customShared: !!row.shared,
          };
          cat.programs.push(customProg);
        }
        return withoutCustom;
      });
    } catch {
      // ignore
    }
  }, [unflattenActionsToWeeks]);

  const loadCustomizeClients = useCallback(async (search: string) => {
    setCustomizeLoading(true);
    try {
      let query = supabase
        .from("clients")
        .select("id, full_name, email")
        .order("full_name", { ascending: true })
        .limit(50);
      if (search.trim()) {
        query = query.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
      }
      const { data } = await query;
      if (data) {
        setCustomizeClients(data.map((c: Record<string, string>) => ({
          id: c.id,
          full_name: c.full_name || "Unknown",
          email: c.email || "",
        })));
      }
    } catch {
      // ignore
    }
    setCustomizeLoading(false);
  }, []);

  const openCustomizeModal = useCallback((program: Program) => {
    setShowCustomizeModal(program);
    setCustomizeSearch("");
    setCustomizeClients([]);
    setCustomizeSelected(new Set());
    setCustomizeName(`${program.name} (custom)`);
    loadCustomizeClients("");
  }, [loadCustomizeClients]);

  const customizeProgramForClients = useCallback(async () => {
    if (!showCustomizeModal || customizeSelected.size === 0) return;
    setCustomizeSaving(true);
    try {
      const program = showCustomizeModal;
      const flatActions = flattenWeeksToActions(program.weeks);
      const rows = Array.from(customizeSelected).map((clientId) => ({
        client_id: clientId,
        category_key: activeTab,
        program_name: customizeName.trim() || `${program.name} (custom)`,
        description: program.description || "",
        tagline: program.tagline || null,
        target_audience: program.targetAudience || null,
        level: program.level || null,
        exercise_type: program.exerciseType || null,
        structured_phases: program.structuredPhases.length > 0 ? JSON.stringify(program.structuredPhases) : null,
        duration: program.duration,
        actions: flatActions,
        shared: true,
        created_from_program: program.id,
      }));
      const { data: insertedRows, error } = await supabase
        .from("client_custom_programs")
        .insert(rows)
        .select("id");
      if (error) {
        setToast({ message: `Failed to clone: ${error.message}`, type: "error" });
      } else {
        // Also clone the source program's action_exercises rows so the new
        // custom programs are pre-populated with library links. Without this,
        // the exercise library section in the editor would be empty.
        if (insertedRows && insertedRows.length > 0 && activeTab === "exercise") {
          try {
            // Fetch the source program's action_exercises (matched by program_key)
            const { data: sourceExercises } = await supabase
              .from("action_exercises")
              .select("*")
              .eq("program_key", program.id);
            if (sourceExercises && sourceExercises.length > 0) {
              // For each new custom program, clone the rows with rewritten keys
              const allClones: Array<Record<string, unknown>> = [];
              for (const newRow of insertedRows) {
                const newCustomKey = `custom-${newRow.id}`;
                for (const ex of sourceExercises as Array<Record<string, unknown>>) {
                  // Replace the source program key with the new custom key
                  // (handles both `${cat}-${prog}-w...-...` and bare `${prog}-w...-...` formats)
                  const oldKey = ex.action_key as string;
                  const newKey = oldKey
                    .replace(`exercise-${program.id}-`, `exercise-${newCustomKey}-`)
                    .replace(`${program.id}-`, `${newCustomKey}-`);
                  allClones.push({
                    action_key: newKey,
                    program_key: newCustomKey,
                    week_range: ex.week_range,
                    day_of_week: ex.day_of_week,
                    exercise_id: ex.exercise_id,
                    exercise_name: ex.exercise_name,
                    sets: ex.sets,
                    reps: ex.reps,
                    duration: ex.duration,
                    rest: ex.rest,
                    notes: ex.notes,
                    sort_order: ex.sort_order,
                  });
                }
              }
              if (allClones.length > 0) {
                await supabase.from("action_exercises").insert(allClones);
              }
            }
          } catch {
            // Best-effort — if exercise cloning fails, the custom program still exists
          }
        }

        // Send a push notification to each client (best-effort, non-blocking)
        const programName = customizeName.trim() || `${program.name} (custom)`;
        for (const clientId of customizeSelected) {
          supabase.functions.invoke("send-push-notification", {
            body: {
              clientId,
              title: "New custom program from your coach",
              body: `${programName} has been created just for you. Open the app to start.`,
              data: { type: "custom_program", programName },
            },
          }).catch(() => { /* silent — push is best-effort */ });
        }

        setToast({
          message: `Customized for ${customizeSelected.size} client${customizeSelected.size > 1 ? "s" : ""}`,
          type: "success",
        });
        setShowCustomizeModal(null);
        // Refresh so the new custom programs appear in the list
        await loadCustomProgramsIntoCategories();
      }
    } catch (e) {
      setToast({ message: `Error: ${(e as Error).message}`, type: "error" });
    }
    setCustomizeSaving(false);
  }, [showCustomizeModal, customizeSelected, customizeName, activeTab, flattenWeeksToActions]);

  const exerciseCategoryColors: Record<string, string> = {
    chest: "#EF4444", back: "#3B82F6", shoulders: "#F59E0B", arms: "#8B5CF6",
    legs: "#0D9488", core: "#06B6D4", cardio: "#EC4899", flexibility: "#14B8A6", "full-body": "#6366F1",
  };

  const loadExerciseLibrary = useCallback(async () => {
    if (exerciseLibraryLoaded) return;
    try {
      const { data } = await supabase.from("exercises").select("*").order("name", { ascending: true });
      if (data) {
        setExerciseLibrary(data as Exercise[]);
        setExerciseLibraryLoaded(true);
      }
    } catch { /* table may not exist */ }
  }, [exerciseLibraryLoaded]);

  const loadActionExercises = useCallback(async (programKey: string, weekRange: number, dayOfWeek: number) => {
    try {
      const { data } = await supabase
        .from("action_exercises")
        .select("*")
        .eq("program_key", programKey)
        .eq("week_range", weekRange)
        .eq("day_of_week", dayOfWeek)
        .order("sort_order", { ascending: true });
      if (data) {
        const grouped: Record<string, ActionExercise[]> = {};
        for (const row of data) {
          const key = row.action_key as string;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(row as ActionExercise);
        }
        setActionExercises((prev) => {
          const next = { ...prev };
          // Clear previous entries for this day's actions
          for (const k of Object.keys(next)) {
            if (k.includes(`-${programKey}-w${weekRange}d${dayOfWeek}-`)) {
              delete next[k];
            }
          }
          return { ...next, ...grouped };
        });
      }
    } catch { /* table may not exist */ }
  }, []);

  const buildActionKey = (categoryId: string, programKey: string, weekIdx: number, dayIdx: number, timeGroup: string, actionIndex: number) => {
    return `${categoryId}-${programKey}-w${weekIdx}d${dayIdx}-${timeGroup}-${actionIndex}`;
  };

  const saveActionExercises = useCallback(async (actionKey: string, programKey: string, weekRange: number, dayOfWeek: number, exercises: ActionExercise[]) => {
    try {
      await supabase.from("action_exercises").delete().eq("action_key", actionKey).eq("program_key", programKey);
      if (exercises.length > 0) {
        const rows = exercises.map((ex, i) => ({
          action_key: actionKey,
          program_key: programKey,
          week_range: weekRange,
          day_of_week: dayOfWeek,
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          sets: ex.sets,
          reps: ex.reps,
          duration: ex.duration || null,
          rest: ex.rest,
          notes: ex.notes || null,
          sort_order: i,
        }));
        await supabase.from("action_exercises").insert(rows);
      }
    } catch { /* silent */ }
  }, []);

  const generateDetailsFromExercises = (exercises: ActionExercise[]): string[] => {
    return exercises.map((ex) => {
      const parts = [ex.exercise_name];
      if (ex.sets && ex.reps) parts.push(`${ex.sets}\u00d7${ex.reps}`);
      else if (ex.duration) parts.push(ex.duration);
      if (ex.rest) parts.push(`${ex.rest} rest`);
      return parts.join(" \u2014 ");
    });
  };

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
                      imageUrl: (a.image_url as string) || undefined,
                      videoUrl: (a.video_url as string) || undefined,
                    })),
                })),
              }));
              return {
                id: (p.key || p.id) as string,
                name: p.name as string,
                description: (p.description || "") as string,
                duration: ((p.duration as number) || 8) as 4 | 8 | 12,
                level: ((p as Record<string, unknown>).level as ProgramLevel) || "",
                exerciseType: ((p as Record<string, unknown>).exercise_type as ExerciseType) || "",
                tagline: ((p as Record<string, unknown>).tagline as string) || "",
                targetAudience: ((p as Record<string, unknown>).target_audience as string) || "",
                structuredPhases: (() => {
                  try {
                    const raw = (p as Record<string, unknown>).structured_phases;
                    if (Array.isArray(raw)) return raw as ProgramPhase[];
                    if (typeof raw === "string") return JSON.parse(raw) as ProgramPhase[];
                  } catch {}
                  return [];
                })(),
                phases: ((p as Record<string, unknown>).phases as string) || "",
                weeklyFocus: (() => {
                  try {
                    const raw = (p as Record<string, unknown>).weekly_focus;
                    if (Array.isArray(raw) && raw.length === 7) return raw as Program["weeklyFocus"];
                    if (typeof raw === "string") {
                      const parsed = JSON.parse(raw);
                      if (Array.isArray(parsed) && parsed.length === 7) return parsed as Program["weeklyFocus"];
                    }
                  } catch {}
                  return ["", "", "", "", "", "", ""] as Program["weeklyFocus"];
                })(),
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

  // Auto-select first available category once loaded from Supabase
  useEffect(() => {
    if (categories.length > 0 && !categories.find((c) => c.id === activeTab)) {
      setActiveTab(categories[0].id);
    }
  }, [categories, activeTab]);

  useEffect(() => {
    (async () => {
      await loadFromSupabase();
      await loadCustomProgramsIntoCategories();
      loadProgramClientCounts();
      // Load templates
      const { data } = await supabase.from("program_templates").select("*").order("created_at", { ascending: false });
      if (data) setProgramTemplates(data as typeof programTemplates);
    })();
  }, [loadFromSupabase, loadProgramClientCounts, loadCustomProgramsIntoCategories]);

  // Load action exercises when a cell is selected
  useEffect(() => {
    if (selectedCell && expandedProgram) {
      loadActionExercises(expandedProgram, selectedCell.weekIdx, selectedCell.dayIdx);
    }
  }, [selectedCell, expandedProgram, loadActionExercises]);

  const isClientsTab = showClientsTab;
  const activeCategory = categories.find((c) => c.id === activeTab);
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

  // Required-field check: returns the list of empty required fields (slugs)
  function getMissingFields(program: Program, categoryKey: string): string[] {
    const missing: string[] = [];
    if (!program.name?.trim()) missing.push("name");
    if (!program.description?.trim()) missing.push("description");
    if (!program.tagline?.trim()) missing.push("tagline");
    if (!program.targetAudience?.trim()) missing.push("targetAudience");
    if (!program.level) missing.push("level");
    if (categoryKey === "exercise" && !program.exerciseType) missing.push("exerciseType");
    if (program.structuredPhases.length === 0) missing.push("structuredPhases");
    if (!program.weeklyFocus.some(f => f && f.trim())) missing.push("weeklyFocus");
    const totalActions = program.weeks.reduce((sum, w) => sum + w.days.reduce((s, d) => s + d.actions.length, 0), 0);
    if (totalActions === 0) missing.push("actions");
    return missing;
  }

  const updateCategories = (updated: Category[]) => {
    setCategories(updated);
    setDirty(true);
  };

  const programSyncTimeout = useRef<Record<string, NodeJS.Timeout>>({});
  const updateProgram = (programId: string, field: keyof Program, value: string | number | ProgramPhase[] | string[]) => {
    updateCategories(
      categories.map((cat) => ({
        ...cat,
        programs: cat.programs.map((p) =>
          p.id === programId ? { ...p, [field]: value } : p
        ),
      }))
    );
    // Find the program to determine if it's a custom one
    const target = categories.flatMap(c => c.programs).find(p => p.id === programId);
    // Debounced sync to Supabase (300ms after last keystroke)
    if (programSyncTimeout.current[programId]) clearTimeout(programSyncTimeout.current[programId]);
    programSyncTimeout.current[programId] = setTimeout(async () => {
      try {
        if (target?.isCustom && target.customDbId) {
          // Route to client_custom_programs
          const customFieldMap: Record<string, string> = {
            name: "program_name",
            targetAudience: "target_audience",
            exerciseType: "exercise_type",
            structuredPhases: "structured_phases",
          };
          const dbField = customFieldMap[field] || field;
          // weeklyFocus is not in client_custom_programs schema — skip
          if (field === "weeklyFocus") return;
          const dbValue = field === "structuredPhases" ? JSON.stringify(value) : value;
          await supabase.from("client_custom_programs").update({ [dbField]: dbValue }).eq("id", target.customDbId);
        } else {
          // Route to global programs table
          const fieldMap: Record<string, string> = { targetAudience: "target_audience", exerciseType: "exercise_type", structuredPhases: "structured_phases", weeklyFocus: "weekly_focus" };
          const dbField = fieldMap[field] || field;
          const dbValue = (field === "structuredPhases" || field === "weeklyFocus") ? JSON.stringify(value) : value;
          await supabase.from("programs").update({ [dbField]: dbValue }).eq("key", programId);
        }
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
                  tagline: "",
                  description: "",
                  duration: 8 as 4 | 8 | 12,
                  level: "" as ProgramLevel,
                  exerciseType: "" as ExerciseType,
                  targetAudience: "",
                  structuredPhases: [],
                  phases: "",
                  weeklyFocus: ["", "", "", "", "", "", ""],
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

  const duplicateProgram = async (sourceProgram: Program) => {
    const newId = `${sourceProgram.id}-copy-${makeId()}`;
    const clonedWeeks: WeekContent[] = sourceProgram.weeks.map((w) => ({
      weekRange: w.weekRange,
      days: w.days.map((d) => ({
        day: d.day,
        actions: d.actions.map((a) => ({ ...a, id: makeId() })),
      })),
    }));
    updateCategories(
      categories.map((cat) =>
        cat.id === activeTab
          ? {
              ...cat,
              programs: [
                ...cat.programs,
                {
                  id: newId,
                  name: `${sourceProgram.name} (copy)`,
                  tagline: sourceProgram.tagline,
                  description: sourceProgram.description,
                  duration: sourceProgram.duration,
                  level: sourceProgram.level,
                  exerciseType: sourceProgram.exerciseType,
                  targetAudience: sourceProgram.targetAudience,
                  structuredPhases: sourceProgram.structuredPhases.map(p => ({ ...p })),
                  phases: sourceProgram.phases,
                  weeklyFocus: [...sourceProgram.weeklyFocus] as Program["weeklyFocus"],
                  weeks: clonedWeeks,
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
        key: activeTab, label: meta.label, icon: meta.icon, color: meta.color,
      }, { onConflict: "key" }).select("id").single();
      if (catRow) {
        const cat = categories.find((c) => c.id === activeTab);
        await supabase.from("programs").insert({
          category_id: catRow.id, key: newId, name: `${sourceProgram.name} (copy)`,
          description: sourceProgram.description, duration: sourceProgram.duration,
          sort_order: cat ? cat.programs.length : 0,
        });
      }
      setToast({ message: `Duplicated "${sourceProgram.name}" with all content`, type: "success" });
    } catch {
      setToast({ message: "Duplicated locally — Supabase sync on save", type: "info" });
    }
    setShowDuplicateModal(false);
  };

  const fillWeeksFromSource = (programId: string, sourceWeekIdx: number) => {
    updateCategories(
      categories.map((cat) => ({
        ...cat,
        programs: cat.programs.map((p) => {
          if (p.id !== programId) return p;
          const sourceWeek = p.weeks[sourceWeekIdx];
          const weeks = p.weeks.map((w, wi) => {
            if (wi === sourceWeekIdx) return w;
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
    setToast({ message: `Filled all weeks from ${weekRanges[sourceWeekIdx]}`, type: "success" });
  };

  const deleteProgram = async (programId: string) => {
    const target = categories.flatMap(c => c.programs).find(p => p.id === programId);
    // Remove from local state
    updateCategories(
      categories.map((cat) => ({
        ...cat,
        programs: cat.programs.filter((p) => p.id !== programId),
      }))
    );
    try {
      if (target?.isCustom && target.customDbId) {
        // Custom program: delete from client_custom_programs
        await supabase.from("client_custom_programs").delete().eq("id", target.customDbId);
      } else {
        // Global program: delete actions first, then program
        const { data: prog } = await supabase.from("programs").select("id").eq("key", programId).maybeSingle();
        if (prog) {
          await supabase.from("program_actions").delete().eq("program_id", prog.id);
          await supabase.from("programs").delete().eq("id", prog.id);
        }
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
                  { id: makeId(), label: "", timeGroup: "morning" as TimeGroup, details: [] as string[], priority: false, imageUrl: undefined, videoUrl: undefined },
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
    nutrition: { icon: "nutrition", color: "#0D9488", label: "Nutrition" },
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

          // Custom programs save to client_custom_programs (single jsonb actions blob)
          if (prog.isCustom && prog.customDbId) {
            const flatActions = flattenWeeksToActions(prog.weeks);
            await supabase.from("client_custom_programs").update({
              program_name: prog.name,
              description: prog.description || null,
              tagline: prog.tagline || null,
              target_audience: prog.targetAudience || null,
              level: prog.level || null,
              exercise_type: prog.exerciseType || null,
              structured_phases: prog.structuredPhases.length > 0 ? JSON.stringify(prog.structuredPhases) : null,
              actions: flatActions,
              shared: prog.customShared !== false,
              updated_at: new Date().toISOString(),
            }).eq("id", prog.customDbId);
            continue;
          }

          // Global program — upsert into programs + program_actions
          const { data: progRow } = await supabase.from("programs").upsert({
            category_id: categoryDbId,
            key: prog.id,
            name: prog.name,
            tagline: prog.tagline || null,
            description: prog.description || null,
            duration: prog.duration,
            level: prog.level || null,
            exercise_type: prog.exerciseType || null,
            target_audience: prog.targetAudience || null,
            structured_phases: prog.structuredPhases.length > 0 ? JSON.stringify(prog.structuredPhases) : null,
            weekly_focus: prog.weeklyFocus.some(f => f) ? JSON.stringify(prog.weeklyFocus) : null,
            phases: prog.phases || null,
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
                image_url: a.imageUrl || null,
                video_url: a.videoUrl || null,
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
            tagline: prog.tagline || null,
            description: prog.description || null,
            duration: prog.duration,
            level: prog.level || null,
            exercise_type: prog.exerciseType || null,
            target_audience: prog.targetAudience || null,
            structured_phases: prog.structuredPhases.length > 0 ? JSON.stringify(prog.structuredPhases) : null,
            weekly_focus: prog.weeklyFocus.some(f => f) ? JSON.stringify(prog.weeklyFocus) : null,
            phases: prog.phases || null,
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
    loadFromSupabase();
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

  // Loading state — categories not yet fetched from Supabase
  if (categories.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-[#0D9488] rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-gray-500">Loading programs…</p>
        </div>
      </div>
    );
  }

  // Briefly transitioning between categories
  if (!activeCategory && !isClientsTab) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

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
                  ? "bg-[#0D9488] text-white"
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
              ? "bg-[#0D9488] text-white"
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
              className="px-4 py-2 bg-[#0D9488] text-white text-sm font-medium rounded-lg hover:bg-[#0B7B73] transition-colors"
            >
              + Add Program
            </button>
            <button
              onClick={() => setShowDuplicateModal(true)}
              className="px-4 py-2 bg-white border border-[#0D9488] text-[#0D9488] text-sm font-medium rounded-lg hover:bg-[#0D9488]/5 transition-colors"
            >
              Duplicate Existing
            </button>
            <button
              onClick={() => setShowTemplateModal(true)}
              className="px-4 py-2 bg-white border border-purple-400 text-purple-600 text-sm font-medium rounded-lg hover:bg-purple-50 transition-colors"
            >
              Templates {programTemplates.length > 0 ? `(${programTemplates.length})` : ""}
            </button>
            <a
              href="/admin/exercises"
              className="px-4 py-2 bg-white border border-blue-400 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors inline-flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h2m4 0h10M5 12a2 2 0 11-4 0 2 2 0 014 0zm16 0a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Exercise Library
            </a>
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
                className="px-4 py-2 bg-[#0D9488] text-white text-sm font-medium rounded-lg hover:bg-[#0B7B73] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Public / Custom toggle */}
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setProgramView("public")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  programView === "public"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Public programs
                <span className="ml-2 text-xs text-gray-400">
                  {activeCategory!.programs.filter((p) => !p.isCustom).length}
                </span>
              </button>
              <button
                onClick={() => setProgramView("custom")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  programView === "custom"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Client programs
                <span className="text-xs text-gray-400">
                  {activeCategory!.programs.filter((p) => p.isCustom).length}
                </span>
              </button>
            </div>
          </div>

          {/* Programs */}
          <div className="space-y-3">
            {(() => {
              const filtered = activeCategory!.programs.filter((p) =>
                programView === "custom" ? p.isCustom : !p.isCustom
              );
              if (filtered.length === 0) {
                return (
                  <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm shadow-sm border border-gray-100">
                    {programView === "custom"
                      ? "No client-specific programs in this category yet. Use the ✏️ button on a public program to customize one for clients."
                      : 'No public programs yet. Click "+ Add Program" to create one.'}
                  </div>
                );
              }
              return filtered.map((program) => {
              const completeness = getProgramCompleteness(program);
              const stats = getProgramStats(program);
              const missingFields = getMissingFields(program, activeCategory!.id);
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
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="flex items-center gap-2 md:col-span-2">
                        {program.id.endsWith("-daily-insights") && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full whitespace-nowrap">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                            Insight
                          </span>
                        )}
                        {program.isCustom && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full whitespace-nowrap" title={`Custom program for ${program.customClientName}`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            {program.customClientName}
                          </span>
                        )}
                        {missingFields.length > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full whitespace-nowrap"
                            title={`Empty fields: ${missingFields.join(", ")}`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {missingFields.length} field{missingFields.length > 1 ? "s" : ""} needed
                          </span>
                        )}
                        <input
                          type="text"
                          value={program.name}
                          onChange={(e) => updateProgram(program.id, "name", e.target.value)}
                          className={`flex-1 px-3 py-1.5 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900 ${
                            !program.name?.trim() ? "border-amber-400 bg-amber-50/40" : "border-gray-300"
                          }`}
                          placeholder="Program name"
                        />
                      </div>
                      <input
                        type="text"
                        value={program.tagline}
                        onChange={(e) => updateProgram(program.id, "tagline", e.target.value)}
                        placeholder="Tagline (one-liner for card)"
                        className={`px-3 py-1.5 border rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-[#0D9488] outline-none ${
                          !program.tagline?.trim() ? "border-amber-400 bg-amber-50/40" : "border-gray-300"
                        }`}
                      />
                      <select
                        value={program.duration}
                        onChange={(e) => updateProgram(program.id, "duration", Number(e.target.value))}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-[#0D9488] outline-none"
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
                            completeness.pct === 100 ? "bg-[#0D9488]" : completeness.pct > 50 ? "bg-amber-400" : "bg-red-400"
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
                      onClick={async () => {
                        const name = prompt("Save as template:", program.name);
                        if (!name) return;
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          // Collect all actions from this program
                          const allActions = program.weeks.flatMap((w, wi) =>
                            w.days.flatMap((d, di) =>
                              d.actions.map((a) => ({
                                week_range: wi, day_of_week: di, time_group: a.timeGroup,
                                label: a.label, details: a.details, priority: a.priority,
                                image_url: a.imageUrl || null, video_url: a.videoUrl || null,
                              }))
                            )
                          );
                          await supabase.from("program_templates").insert({
                            name, category_key: activeTab, description: program.description || "",
                            tagline: program.tagline || null, level: program.level || null,
                            exercise_type: program.exerciseType || null,
                            target_audience: program.targetAudience || null,
                            structured_phases: program.structuredPhases.length > 0 ? JSON.stringify(program.structuredPhases) : null,
                            duration: program.duration, actions: allActions,
                            created_by: user?.id || null,
                          });
                          setProgramTemplates(prev => [{ id: "new", name, category_key: activeTab, description: program.description || "", actions: allActions, duration: program.duration, level: program.level || "", exercise_type: program.exerciseType || "", target_audience: program.targetAudience || "", structured_phases: program.structuredPhases, tagline: program.tagline || "" }, ...prev]);
                          setToast({ message: `Template "${name}" saved`, type: "success" });
                        } catch {
                          setToast({ message: "Failed to save template", type: "error" });
                        }
                      }}
                      className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                      title="Save as template"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => openCustomizeModal(program)}
                      className="p-2 text-gray-400 hover:text-[#0D9488] rounded-lg hover:bg-[#0D9488]/5 transition-colors"
                      title="Customize for clients (clone & edit per client)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setShowShareModal(program);
                        setShareSearch("");
                        setShareClients([]);
                        setShareAssigned(new Set());
                        loadShareClients(program.id, activeTab, "");
                      }}
                      className="p-2 text-gray-400 hover:text-[#0D9488] rounded-lg hover:bg-[#0D9488]/5 transition-colors"
                      title="Assign global program to clients (no customization)"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
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

                  {/* Program details panel */}
                  {expandedProgram === program.id && (
                    <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Program Details</p>
                      {/* Row 1: Level, Exercise type, Duration info */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Level <span className="text-amber-600">*</span></label>
                          <select
                            value={program.level}
                            onChange={(e) => updateProgram(program.id, "level", e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900 ${
                              !program.level ? "border-amber-400 bg-amber-50/40" : "border-gray-200"
                            }`}
                          >
                            <option value="">Not set</option>
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </div>
                        {activeTab === "exercise" && (
                          <div>
                            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Exercise type <span className="text-amber-600">*</span></label>
                            <select
                              value={program.exerciseType}
                              onChange={(e) => updateProgram(program.id, "exerciseType", e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900 ${
                                !program.exerciseType ? "border-amber-400 bg-amber-50/40" : "border-gray-200"
                              }`}
                            >
                              <option value="">Not set</option>
                              <option value="gym">Gym</option>
                              <option value="home">Home</option>
                            </select>
                          </div>
                        )}
                        <div className={activeTab === "exercise" ? "md:col-span-2" : "md:col-span-3"}>
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Who is it for <span className="text-amber-600">*</span></label>
                          <input
                            type="text"
                            value={program.targetAudience}
                            onChange={(e) => updateProgram(program.id, "targetAudience", e.target.value)}
                            placeholder="e.g. People new to strength training looking to build a solid foundation"
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900 ${
                              !program.targetAudience?.trim() ? "border-amber-400 bg-amber-50/40" : "border-gray-200"
                            }`}
                          />
                        </div>
                      </div>
                      {/* Row 2: Description */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description <span className="text-amber-600">*</span> <span className="text-gray-300 normal-case">(shown under &quot;Who is it for&quot; in the app)</span></label>
                        <textarea
                          value={program.description}
                          onChange={(e) => updateProgram(program.id, "description", e.target.value)}
                          placeholder="Detailed description of the program, what to expect, and how it works..."
                          rows={3}
                          className={`w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-[#0D9488] outline-none resize-y text-gray-900 leading-relaxed ${
                            !program.description?.trim() ? "border-amber-400 bg-amber-50/40" : "border-gray-200"
                          }`}
                        />
                      </div>
                      {/* Row 3: Structured phases */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Program phases</label>
                          <button
                            onClick={() => {
                              const updated = [...program.structuredPhases, { weeks: "", name: "", description: "" }];
                              updateProgram(program.id, "structuredPhases", updated);
                            }}
                            className="text-xs font-medium text-[#0D9488] hover:underline"
                          >
                            + Add phase
                          </button>
                        </div>
                        {program.structuredPhases.length === 0 && (
                          <p className="text-xs text-gray-300 py-2">No phases defined. Click &quot;+ Add phase&quot; to create one.</p>
                        )}
                        {program.structuredPhases.map((phase, pi) => (
                          <div key={pi} className="flex items-start gap-3 mb-2">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 mt-1">
                              {pi + 1}
                            </div>
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                              <input
                                type="text"
                                value={phase.weeks}
                                onChange={(e) => {
                                  const updated = program.structuredPhases.map((p, i) => i === pi ? { ...p, weeks: e.target.value } : p);
                                  updateProgram(program.id, "structuredPhases", updated);
                                }}
                                placeholder="e.g. 1–4"
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900"
                              />
                              <input
                                type="text"
                                value={phase.name}
                                onChange={(e) => {
                                  const updated = program.structuredPhases.map((p, i) => i === pi ? { ...p, name: e.target.value } : p);
                                  updateProgram(program.id, "structuredPhases", updated);
                                }}
                                placeholder="Phase name"
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900"
                              />
                              <input
                                type="text"
                                value={phase.description}
                                onChange={(e) => {
                                  const updated = program.structuredPhases.map((p, i) => i === pi ? { ...p, description: e.target.value } : p);
                                  updateProgram(program.id, "structuredPhases", updated);
                                }}
                                placeholder="Description"
                                className="md:col-span-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900"
                              />
                            </div>
                            <button
                              onClick={() => {
                                const updated = program.structuredPhases.filter((_, i) => i !== pi);
                                updateProgram(program.id, "structuredPhases", updated);
                              }}
                              className="p-1 text-red-400 hover:text-red-600 mt-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      {/* Weekly focus — one short label per day, shown in the app's program detail view */}
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                          Weekly focus (Mon–Sun)
                        </label>
                        <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
                          Short focus name for each day (e.g. &quot;Push — Chest, shoulders&quot;, &quot;Wind-down routine&quot;, &quot;Rest&quot;).
                          Shown to users in the program detail sheet. Keep to 2–5 words.
                        </p>
                        <div className="grid grid-cols-7 gap-1.5">
                          {dayLabels.map((day, di) => (
                            <div key={di} className="flex flex-col">
                              <p className="text-[10px] font-bold text-gray-500 text-center mb-1">{day}</p>
                              <input
                                type="text"
                                value={program.weeklyFocus[di] || ""}
                                onChange={(e) => {
                                  const updated = [...program.weeklyFocus] as Program["weeklyFocus"];
                                  updated[di] = e.target.value;
                                  updateProgram(program.id, "weeklyFocus", updated);
                                }}
                                placeholder={di === 6 ? "Rest" : "Focus"}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-[11px] focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900 text-center"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expanded: calendar grid */}
                  {expandedProgram === program.id && (
                    <div className="border-t border-gray-100 p-4 space-y-4">
                      {/* Copy week controls */}
                      {copySource !== null && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3 text-sm flex-wrap">
                          <span className="text-blue-700 font-medium">Copy {weekRanges[copySource]} to:</span>
                          <button
                            onClick={() => fillWeeksFromSource(program.id, copySource)}
                            className="px-3 py-1 bg-[#0D9488] text-white rounded-lg hover:bg-[#0B7B73] text-xs font-bold"
                          >
                            All weeks
                          </button>
                          <span className="text-blue-400">|</span>
                          {weekRanges.slice(0, program.duration).map((wr, wi) => (
                            wi !== copySource && (
                              <button
                                key={wi}
                                onClick={() => copyWeek(program.id, copySource, wi)}
                                className="px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium"
                              >
                                {wr}
                              </button>
                            )
                          ))}
                          <button onClick={() => setCopySource(null)} className="ml-auto text-blue-500 hover:text-blue-700 text-xs font-medium">
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Calendar grid: weeks as columns, days as rows — limited by duration */}
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr>
                              <th className="p-2 text-xs text-gray-400 font-medium text-left w-16">Day</th>
                              {weekRanges.slice(0, program.duration).map((wr, wi) => (
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
                                {weekRanges.slice(0, program.duration).map((_, weekIdx) => {
                                  const day = program.weeks[weekIdx].days[dayIdx];
                                  const actionCount = day.actions.length;
                                  const isSelected = selectedCell?.weekIdx === weekIdx && selectedCell?.dayIdx === dayIdx;
                                  return (
                                    <td key={weekIdx} className="p-1">
                                      <button
                                        onClick={() => setSelectedCell(isSelected ? null : { weekIdx, dayIdx })}
                                        className={`w-full p-2 rounded-lg text-xs transition-all border ${
                                          isSelected
                                            ? `${colors.bg} ${colors.border} ring-2 ring-[#0D9488]/30`
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
                                  showPreview ? "bg-[#0D9488] text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                }`}
                              >
                                {showPreview ? "Hide Preview" : "Preview"}
                              </button>
                              <button
                                onClick={() => addAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx)}
                                className="px-3 py-1 text-xs bg-[#0D9488] text-white rounded-lg hover:bg-[#0B7B73] font-medium"
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
                                      className={`p-4 rounded-xl border transition-colors ${
                                        action.priority
                                          ? `${colors.bg} ${colors.border}`
                                          : "bg-white border-gray-200"
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        {/* Drag handle */}
                                        <div className="mt-3 text-gray-300 cursor-grab flex-shrink-0">
                                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                                          </svg>
                                        </div>
                                        <div className="flex-1 space-y-3">
                                          {/* Row 1: Label + time group */}
                                          <div className="flex gap-3">
                                            <input
                                              type="text"
                                              value={action.label}
                                              onChange={(e) =>
                                                updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "label", e.target.value)
                                              }
                                              placeholder="Action label (e.g. Barbell Bench Press)"
                                              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-base font-semibold focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900"
                                            />
                                            <select
                                              value={action.timeGroup}
                                              onChange={(e) =>
                                                updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "timeGroup", e.target.value)
                                              }
                                              className="w-32 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900"
                                            >
                                              {timeGroups.map((tg) => (
                                                <option key={tg} value={tg}>
                                                  {tg.charAt(0).toUpperCase() + tg.slice(1)}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          {/* Row 2: Details textarea (larger) */}
                                          <textarea
                                            value={action.details.join("\n")}
                                            onChange={(e) =>
                                              updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "details", e.target.value.split("\n"))
                                            }
                                            placeholder="Details — one item per line&#10;&#10;e.g.&#10;4 sets x 8 reps&#10;60s rest between sets&#10;RPE 7&#10;Focus on controlled tempo"
                                            rows={12}
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D9488] outline-none resize-y text-gray-900 leading-relaxed min-h-[200px]"
                                          />
                                          {/* Row 2b: Exercise library */}
                                          {activeTab === "exercise" && (() => {
                                            const actionIndex = currentDay.actions.indexOf(action);
                                            const actionKey = buildActionKey(activeTab, program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.timeGroup, actionIndex);
                                            const exercises = actionExercises[actionKey] || [];
                                            return (
                                              <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Exercises from library</label>
                                                  <button
                                                    onClick={() => {
                                                      loadExerciseLibrary();
                                                      setShowExercisePicker({ programId: program.id, weekIdx: selectedCell.weekIdx, dayIdx: selectedCell.dayIdx, actionId: action.id, actionIndex });
                                                      setExerciseSearch("");
                                                      setExerciseCategoryFilter(null);
                                                      setSelectedExercise(null);
                                                    }}
                                                    className="px-3 py-1.5 bg-[#0D9488] text-white rounded-lg text-xs font-medium hover:bg-[#0B7B73] transition-colors"
                                                  >
                                                    + Add exercise
                                                  </button>
                                                </div>
                                                {exercises.length > 0 ? (
                                                  <div className="space-y-1.5">
                                                    {exercises.map((ex, ei) => (
                                                      <div key={ex.exercise_id + "-" + ei} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                                                        <span className="text-xs text-gray-400 font-medium w-4">{ei + 1}</span>
                                                        {(() => { const img = exerciseLibrary.find(e => e.name === ex.exercise_name)?.illustration_url; return img ? <img src={img} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" /> : null; })()}
                                                        <div className="flex-1 min-w-0">
                                                          <span className="text-sm font-medium text-gray-800">{ex.exercise_name}</span>
                                                          <span className="text-xs text-gray-400 ml-2">
                                                            {ex.sets && ex.reps ? `${ex.sets}\u00d7${ex.reps}` : ex.duration || ""}
                                                            {ex.rest ? ` \u2022 ${ex.rest} rest` : ""}
                                                          </span>
                                                        </div>
                                                        <button
                                                          onClick={() => {
                                                            const updated = exercises.filter((_, i) => i !== ei);
                                                            const newActionExercises = { ...actionExercises, [actionKey]: updated };
                                                            setActionExercises(newActionExercises);
                                                            saveActionExercises(actionKey, program.id, selectedCell.weekIdx, selectedCell.dayIdx, updated);
                                                            const details = generateDetailsFromExercises(updated);
                                                            updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "details", details);
                                                          }}
                                                          className="p-1 text-red-400 hover:text-red-600 rounded transition-colors flex-shrink-0"
                                                        >
                                                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                          </svg>
                                                        </button>
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <p className="text-xs text-gray-300 py-2">No exercises linked. Use the button above to add from the library.</p>
                                                )}
                                              </div>
                                            );
                                          })()}
                                          {/* Row 3: Media URLs */}
                                          <div className="flex gap-3">
                                            <div className="flex-1">
                                              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Image URL</label>
                                              <div className="flex gap-2">
                                                <input
                                                  type="text"
                                                  value={action.imageUrl || ""}
                                                  onChange={(e) =>
                                                    updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "imageUrl" as keyof ProgramAction, e.target.value)
                                                  }
                                                  placeholder="https://... (exercise photo, meal image)"
                                                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-700"
                                                />
                                                {action.imageUrl && (
                                                  <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 bg-gray-50">
                                                    <img src={action.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex-1">
                                              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Video URL</label>
                                              <input
                                                type="text"
                                                value={action.videoUrl || ""}
                                                onChange={(e) =>
                                                  updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "videoUrl" as keyof ProgramAction, e.target.value)
                                                }
                                                placeholder="https://youtube.com/... or vimeo link"
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-700"
                                              />
                                            </div>
                                          </div>
                                          {/* Row 4: Priority + delete */}
                                          <div className="flex items-center justify-between pt-1">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                              <div className={`relative w-9 h-5 rounded-full transition-colors ${
                                                action.priority ? "bg-[#0D9488]" : "bg-gray-300"
                                              }`}>
                                                <input
                                                  type="checkbox"
                                                  checked={action.priority}
                                                  onChange={(e) =>
                                                    updateAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id, "priority", e.target.checked)
                                                  }
                                                  className="sr-only"
                                                />
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                                  action.priority ? "translate-x-4" : "translate-x-0.5"
                                                }`} />
                                              </div>
                                              <span className="text-xs text-gray-500 font-medium">Priority action</span>
                                            </label>
                                            <div className="flex items-center gap-2">
                                              {(action.imageUrl || action.videoUrl) && (
                                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                  {action.imageUrl && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                                  {action.videoUrl && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                                  Media attached
                                                </span>
                                              )}
                                              <button
                                                onClick={() =>
                                                  deleteAction(program.id, selectedCell.weekIdx, selectedCell.dayIdx, action.id)
                                                }
                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                              </button>
                                            </div>
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
            });
            })()}
          </div>
        </>
      )}

      {/* Duplicate from existing modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDuplicateModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Duplicate program</h3>
                <p className="text-sm text-gray-500">Copy all content from an existing program</p>
              </div>
              <button onClick={() => setShowDuplicateModal(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">{cat.name}</p>
                  {cat.programs.map((prog) => {
                    const stats = getProgramStats(prog);
                    return (
                      <button
                        key={prog.id}
                        onClick={() => duplicateProgram(prog)}
                        className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors flex items-center gap-3"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${categoryColors[cat.id]?.bg || "bg-gray-50"}`}>
                          <span className={`text-xs font-bold ${categoryColors[cat.id]?.text || "text-gray-500"}`}>
                            {cat.name[0]}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{prog.name}</p>
                          <p className="text-xs text-gray-400">{stats.totalActions} actions · {stats.completeness}% complete · {prog.duration} weeks</p>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Template library modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Template Library</h3>
                <p className="text-sm text-gray-500">Load a template as a new program in {activeCategory?.name || "this category"}</p>
              </div>
              <button onClick={() => setShowTemplateModal(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {programTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">No templates yet</p>
                  <p className="text-xs text-gray-300 mt-1">Customize a client&apos;s program and save it as a template to see it here.</p>
                </div>
              ) : (
                <>
                  {/* Templates for current category */}
                  {programTemplates.filter(t => t.category_key === activeTab).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">{activeCategory?.name || activeTab}</p>
                      {programTemplates.filter(t => t.category_key === activeTab).map((tmpl) => (
                        <button
                          key={tmpl.id}
                          onClick={async () => {
                            const newId = `tmpl-${tmpl.id.slice(0, 8)}-${Math.random().toString(36).slice(2, 6)}`;
                            // Create program from template actions — convert to week structure
                            const templateActions = (tmpl.actions || []) as Array<Record<string, unknown>>;
                            const weeks = createEmptyWeeks();
                            for (const a of templateActions) {
                              const wi = (a.week_range as number) || 0;
                              const di = (a.day_of_week as number) || 0;
                              if (wi < weeks.length && di < 7) {
                                weeks[wi].days[di].actions.push({
                                  id: makeId(),
                                  label: (a.label as string) || "",
                                  timeGroup: ((a.time_group as string) || "morning") as TimeGroup,
                                  details: Array.isArray(a.details) ? a.details as string[] : [],
                                  priority: !!a.priority,
                                  imageUrl: (a.image_url as string) || undefined,
                                  videoUrl: (a.video_url as string) || undefined,
                                });
                              }
                            }
                            updateCategories(
                              categories.map((cat) =>
                                cat.id === activeTab ? {
                                  ...cat,
                                  programs: [...cat.programs, {
                                    id: newId,
                                    name: tmpl.name,
                                    tagline: tmpl.tagline || "",
                                    description: tmpl.description || "",
                                    duration: (tmpl.duration || 8) as 4 | 8 | 12,
                                    level: (tmpl.level || "") as ProgramLevel,
                                    exerciseType: (tmpl.exercise_type || "") as ExerciseType,
                                    targetAudience: tmpl.target_audience || "",
                                    structuredPhases: Array.isArray(tmpl.structured_phases) ? tmpl.structured_phases as ProgramPhase[] : [],
                                    phases: "",
                                    weeklyFocus: ["", "", "", "", "", "", ""],
                                    weeks,
                                  }],
                                } : cat
                              )
                            );
                            setShowTemplateModal(false);
                            setToast({ message: `Created "${tmpl.name}" from template`, type: "success" });
                          }}
                          className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-purple-600">T</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{tmpl.name}</p>
                            <p className="text-xs text-gray-400">{tmpl.description || "No description"} · {tmpl.duration || 8} weeks</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Templates for other categories */}
                  {programTemplates.filter(t => t.category_key !== activeTab).length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider px-1 mb-1">Other categories</p>
                      {programTemplates.filter(t => t.category_key !== activeTab).map((tmpl) => (
                        <div key={tmpl.id} className="px-4 py-2 text-xs text-gray-400">
                          {tmpl.name} <span className="text-gray-300">({tmpl.category_key})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exercise picker modal */}
      {showExercisePicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setShowExercisePicker(null); setSelectedExercise(null); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedExercise ? "Configure Exercise" : "Add Exercise"}</h3>
                <p className="text-sm text-gray-500">{selectedExercise ? `Set parameters for ${selectedExercise.name}` : "Search and select an exercise from the library"}</p>
              </div>
              <button onClick={() => { setShowExercisePicker(null); setSelectedExercise(null); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedExercise ? (
              /* Exercise configuration form */
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                  {selectedExercise.illustration_url && (
                    <img src={selectedExercise.illustration_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{selectedExercise.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: exerciseCategoryColors[selectedExercise.category] || "#6B7280" }}>
                        {selectedExercise.category}
                      </span>
                      {selectedExercise.equipment && <span className="text-xs text-gray-400">{selectedExercise.equipment}</span>}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Sets</label>
                    <input
                      type="number"
                      min={1}
                      value={exerciseForm.sets}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, sets: parseInt(e.target.value) || 1 })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Reps</label>
                    <input
                      type="text"
                      value={exerciseForm.reps}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, reps: e.target.value })}
                      placeholder="e.g. 8-12"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Rest</label>
                    <input
                      type="text"
                      value={exerciseForm.rest}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, rest: e.target.value })}
                      placeholder="e.g. 60s"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes (optional)</label>
                    <input
                      type="text"
                      value={exerciseForm.notes}
                      onChange={(e) => setExerciseForm({ ...exerciseForm, notes: e.target.value })}
                      placeholder="e.g. Slow eccentric"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setSelectedExercise(null)}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (!showExercisePicker || !selectedExercise) return;
                      const { programId, weekIdx, dayIdx, actionId, actionIndex } = showExercisePicker;
                      const prog = categories.flatMap(c => c.programs).find(p => p.id === programId);
                      if (!prog) return;
                      const action = prog.weeks[weekIdx]?.days[dayIdx]?.actions.find(a => a.id === actionId);
                      if (!action) return;
                      const actionKey = buildActionKey(activeTab, programId, weekIdx, dayIdx, action.timeGroup, actionIndex);
                      const existing = actionExercises[actionKey] || [];
                      const newExercise: ActionExercise = {
                        action_key: actionKey,
                        program_key: programId,
                        week_range: weekIdx,
                        day_of_week: dayIdx,
                        exercise_id: selectedExercise.id,
                        exercise_name: selectedExercise.name,
                        sets: exerciseForm.sets,
                        reps: exerciseForm.reps,
                        duration: "",
                        rest: exerciseForm.rest,
                        notes: exerciseForm.notes,
                        sort_order: existing.length,
                      };
                      const updated = [...existing, newExercise];
                      setActionExercises({ ...actionExercises, [actionKey]: updated });
                      saveActionExercises(actionKey, programId, weekIdx, dayIdx, updated);
                      // Auto-populate details
                      const details = generateDetailsFromExercises(updated);
                      updateAction(programId, weekIdx, dayIdx, actionId, "details", details);
                      setDirty(true);
                      setSelectedExercise(null);
                      setShowExercisePicker(null);
                      setExerciseForm({ sets: 3, reps: "8-12", rest: "60s", notes: "" });
                      setToast({ message: `Added ${selectedExercise.name}`, type: "success" });
                    }}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#0D9488] hover:bg-[#0B7B73] rounded-lg transition-colors"
                  >
                    Add to action
                  </button>
                </div>
              </div>
            ) : (
              /* Exercise browser */
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Search */}
                <div className="px-6 pt-4 pb-2">
                  <input
                    type="text"
                    value={exerciseSearch}
                    onChange={(e) => setExerciseSearch(e.target.value)}
                    placeholder="Search exercises..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D9488] outline-none"
                    autoFocus
                  />
                </div>
                {/* Category filter pills */}
                <div className="px-6 pb-3 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setExerciseCategoryFilter(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      !exerciseCategoryFilter ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    All
                  </button>
                  {Object.entries(exerciseCategoryColors).map(([cat, color]) => (
                    <button
                      key={cat}
                      onClick={() => setExerciseCategoryFilter(exerciseCategoryFilter === cat ? null : cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors`}
                      style={{
                        backgroundColor: exerciseCategoryFilter === cat ? color : `${color}18`,
                        color: exerciseCategoryFilter === cat ? "#fff" : color,
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {/* Exercise grid */}
                <div className="flex-1 overflow-y-auto px-6 pb-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {exerciseLibrary
                      .filter((ex) => {
                        if (exerciseCategoryFilter && ex.category !== exerciseCategoryFilter) return false;
                        if (exerciseSearch) {
                          const q = exerciseSearch.toLowerCase();
                          return ex.name.toLowerCase().includes(q) || ex.category.toLowerCase().includes(q) || (ex.equipment || "").toLowerCase().includes(q);
                        }
                        return true;
                      })
                      .map((ex) => (
                        <button
                          key={ex.id}
                          onClick={() => {
                            setSelectedExercise(ex);
                            setExerciseForm({ sets: 3, reps: "8-12", rest: "60s", notes: "" });
                          }}
                          className="text-left p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all bg-white"
                        >
                          <div className="flex items-start gap-2">
                            {ex.illustration_url ? (
                              <img src={ex.illustration_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h2m4 0h10M5 12a2 2 0 11-4 0 2 2 0 014 0zm16 0a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{ex.name}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                                  style={{ backgroundColor: exerciseCategoryColors[ex.category] || "#6B7280" }}
                                >
                                  {ex.category}
                                </span>
                                {ex.equipment && (
                                  <span className="text-[10px] text-gray-400 truncate">{ex.equipment}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    {exerciseLibrary.length === 0 && (
                      <div className="col-span-3 text-center py-12 text-gray-400 text-sm">
                        No exercises in library. Add exercises in the Exercise Library page first.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {/* Share with client modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowShareModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Share program</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{showShareModal.name}</p>
                </div>
                <button onClick={() => setShowShareModal(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Search */}
              <input
                type="text"
                value={shareSearch}
                onChange={(e) => {
                  setShareSearch(e.target.value);
                  loadShareClients(showShareModal.id, activeTab, e.target.value);
                }}
                placeholder="Search clients by name or email..."
                className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-[#0D9488] outline-none"
              />
            </div>

            {/* Client list */}
            <div className="overflow-y-auto flex-1">
              {shareLoading && shareClients.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-[#0D9488] rounded-full animate-spin" />
                </div>
              ) : shareClients.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-sm text-gray-400">No clients found</p>
                  <p className="text-xs text-gray-300 mt-1">{shareSearch ? "Try a different search" : "No clients in your database yet"}</p>
                </div>
              ) : (
                shareClients.map((client) => {
                  const isAssigned = shareAssigned.has(client.id);
                  const isAssigning = shareAssigning.has(client.id);
                  const hasOtherProgram = client.current_program_key && client.current_program_key !== showShareModal.id;
                  return (
                    <div key={client.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-gray-500">
                          {(client.full_name || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{client.full_name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-gray-400 truncate">{client.email}</p>
                          {hasOtherProgram && (
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-medium rounded">
                              {client.current_program_key}
                            </span>
                          )}
                        </div>
                      </div>
                      {isAssigned ? (
                        <span className="px-3 py-1 bg-gray-100 text-gray-400 text-xs font-medium rounded-lg">
                          Assigned
                        </span>
                      ) : (
                        <button
                          onClick={() => assignProgramToClient(client.id, client.full_name, showShareModal.id, activeTab)}
                          disabled={isAssigning}
                          className="px-3 py-1 bg-[#0D9488] text-white text-xs font-medium rounded-lg hover:bg-[#1bb34d] disabled:opacity-50 transition-colors"
                        >
                          {isAssigning ? "..." : "Assign"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer: bulk assign */}
            {shareClients.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                <button
                  onClick={() => assignProgramToAll(showShareModal.id, activeTab)}
                  disabled={shareLoading || shareClients.every(c => shareAssigned.has(c.id))}
                  className="w-full px-4 py-2 bg-[#0D9488] text-white text-sm font-medium rounded-lg hover:bg-[#1bb34d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {shareClients.every(c => shareAssigned.has(c.id))
                    ? "All clients assigned"
                    : `Assign to all ${shareClients.filter(c => !shareAssigned.has(c.id)).length} client${shareClients.filter(c => !shareAssigned.has(c.id)).length !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customize for clients modal — clones the program into client_custom_programs */}
      {showCustomizeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !customizeSaving && setShowCustomizeModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Customize for clients</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Clone <strong>{showCustomizeModal.name}</strong> for one or more clients. You&apos;ll be able to edit each clone separately.</p>
                </div>
                <button onClick={() => !customizeSaving && setShowCustomizeModal(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Custom name */}
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Program name</label>
              <input
                type="text"
                value={customizeName}
                onChange={(e) => setCustomizeName(e.target.value)}
                placeholder={`${showCustomizeModal.name} (custom)`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0D9488] outline-none mb-3"
              />
              {/* Search */}
              <input
                type="text"
                value={customizeSearch}
                onChange={(e) => {
                  setCustomizeSearch(e.target.value);
                  loadCustomizeClients(e.target.value);
                }}
                placeholder="Search clients by name or email..."
                className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm focus:ring-2 focus:ring-[#0D9488] outline-none"
              />
            </div>

            {/* Client list with checkboxes */}
            <div className="overflow-y-auto flex-1">
              {customizeLoading && customizeClients.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-[#0D9488] rounded-full animate-spin" />
                </div>
              ) : customizeClients.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-sm text-gray-400">No clients found</p>
                </div>
              ) : (
                customizeClients.map((client) => {
                  const checked = customizeSelected.has(client.id);
                  return (
                    <label
                      key={client.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setCustomizeSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(client.id)) next.delete(client.id);
                            else next.add(client.id);
                            return next;
                          });
                        }}
                        className="w-4 h-4 accent-[#0D9488] flex-shrink-0"
                      />
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-gray-500">
                          {(client.full_name || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{client.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{client.email}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-2">
              <button
                onClick={() => !customizeSaving && setShowCustomizeModal(null)}
                disabled={customizeSaving}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={customizeProgramForClients}
                disabled={customizeSelected.size === 0 || customizeSaving || !customizeName.trim()}
                className="flex-1 px-4 py-2 bg-[#0D9488] text-white text-sm font-medium rounded-lg hover:bg-[#0B7B73] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {customizeSaving
                  ? "Cloning..."
                  : customizeSelected.size === 0
                    ? "Select clients"
                    : `Customize for ${customizeSelected.size} client${customizeSelected.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

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
