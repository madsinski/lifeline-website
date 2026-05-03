"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type TimeGroup = "morning" | "midday" | "evening";
type ProgramLevel = "beginner" | "intermediate" | "advanced" | "";
type ExerciseType = "gym" | "home" | "";
const timeGroups: TimeGroup[] = ["morning", "midday", "evening"];
const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekRanges = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8", "Week 9", "Week 10", "Week 11", "Week 12"];

interface Action {
  week_range: number;
  day_of_week: number;
  time_group: string;
  label: string;
  details: string[];
  priority: boolean;
  image_url?: string;
  video_url?: string;
}

interface Phase {
  weeks: string;
  name: string;
  description: string;
}

// Exercise library types
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

function makeId() { return Math.random().toString(36).slice(2, 10); }

const categoryLabels: Record<string, string> = { exercise: "Exercise", nutrition: "Nutrition", sleep: "Sleep", mental: "Mental" };
const categoryColors: Record<string, string> = { exercise: "#EA580C", nutrition: "#84CC16", sleep: "#767194", mental: "#0EA5E9" };

export default function ClientProgramEditorPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const categoryKey = params.category as string;
  const color = categoryColors[categoryKey] || "#6B7280";

  // Program state
  const [clientName, setClientName] = useState("");
  const [programName, setProgramName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [level, setLevel] = useState<ProgramLevel>("");
  const [exerciseType, setExerciseType] = useState<ExerciseType>("");
  const [duration, setDuration] = useState(8);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [shared, setShared] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ week: number; day: number } | null>(null);
  const [copySource, setCopySource] = useState<number | null>(null);
  const [activeTimeTab, setActiveTimeTab] = useState<TimeGroup | "all">("all");

  // Exercise library state
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([]);
  const [exerciseLibraryLoaded, setExerciseLibraryLoaded] = useState(false);
  const [actionExercises, setActionExercises] = useState<Record<string, ActionExercise[]>>({});
  const [showExercisePicker, setShowExercisePicker] = useState<string | null>(null); // action_key being edited
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [exSets, setExSets] = useState<number>(3);
  const [exReps, setExReps] = useState("10");
  const [exRest, setExRest] = useState("60s");
  const [exNotes, setExNotes] = useState("");
  const [customProgramDbId, setCustomProgramDbId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: client } = await supabase.from("clients_decrypted").select("full_name, email").eq("id", clientId).single();
      setClientName((client as Record<string, string>)?.full_name || (client as Record<string, string>)?.email || "Client");

      const { data: custom } = await supabase
        .from("client_custom_programs").select("*")
        .eq("client_id", clientId).eq("category_key", categoryKey).maybeSingle();

      if (custom) {
        const c = custom as Record<string, unknown>;
        setCustomProgramDbId(c.id as string);
        setProgramName((c.program_name as string) || "");
        setTagline((c.tagline as string) || "");
        setDescription((c.description as string) || "");
        setTargetAudience((c.target_audience as string) || "");
        setLevel(((c.level as string) || "") as ProgramLevel);
        setExerciseType(((c.exercise_type as string) || "") as ExerciseType);
        setDuration((c.duration as number) || 8);
        setShared(!!(c.shared));
        setActions(Array.isArray(c.actions) ? c.actions as Action[] : []);
        try {
          const raw = c.structured_phases;
          if (Array.isArray(raw)) setPhases(raw as Phase[]);
          else if (typeof raw === "string") setPhases(JSON.parse(raw));
        } catch { setPhases([]); }
      }
    } catch {}
    setLoading(false);
  }, [clientId, categoryKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("client_custom_programs").upsert({
        client_id: clientId,
        category_key: categoryKey,
        program_name: programName,
        tagline: tagline || null,
        description: description || null,
        target_audience: targetAudience || null,
        level: level || null,
        exercise_type: exerciseType || null,
        duration,
        structured_phases: phases.length > 0 ? JSON.stringify(phases) : null,
        actions,
        shared,
        created_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_id,category_key" });
      setDirty(false);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {
      alert("Failed to save");
    }
    setSaving(false);
  };

  const handleShare = async () => {
    const next = !shared;
    setShared(next);
    // Save immediately so sharing takes effect without clicking Save
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("client_custom_programs").upsert({
        client_id: clientId,
        category_key: categoryKey,
        program_name: programName || `Custom ${categoryLabels[categoryKey] || categoryKey}`,
        tagline: tagline || null,
        description: description || null,
        target_audience: targetAudience || null,
        level: level || null,
        exercise_type: exerciseType || null,
        duration,
        structured_phases: phases.length > 0 ? JSON.stringify(phases) : null,
        actions,
        shared: next,
        created_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_id,category_key" });
    } catch {
      alert("Failed to update sharing status");
      setShared(!next); // revert
    }
  };

  // Templates
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; category_key: string; description: string; actions: unknown[]; duration: number; level: string; exercise_type: string; target_audience: string; structured_phases: unknown; tagline: string }>>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  useEffect(() => {
    supabase.from("program_templates").select("*").eq("category_key", categoryKey).order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setTemplates(data as typeof templates);
    });
  }, [categoryKey]);

  const handleSaveAsTemplate = async () => {
    const name = prompt("Template name:", programName);
    if (!name) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("program_templates").insert({
        name, category_key: categoryKey, description: description || "",
        tagline: tagline || null, level: level || null, exercise_type: exerciseType || null,
        target_audience: targetAudience || null,
        structured_phases: phases.length > 0 ? JSON.stringify(phases) : null,
        duration, actions, created_by: user?.id || null,
      });
      const { data: updated } = await supabase.from("program_templates").select("*").eq("category_key", categoryKey).order("created_at", { ascending: false });
      if (updated) setTemplates(updated as typeof templates);
      alert(`Template "${name}" saved`);
    } catch { alert("Failed to save template"); }
  };

  const handleLoadTemplate = async (templateId: string) => {
    const tmpl = templates.find(t => t.id === templateId);
    if (!tmpl) return;
    if (!confirm(`Load template "${tmpl.name}"? This will replace all current content.`)) return;
    setProgramName(tmpl.name);
    setDescription(tmpl.description || "");
    setTagline(tmpl.tagline || "");
    setLevel((tmpl.level || "") as ProgramLevel);
    setExerciseType((tmpl.exercise_type || "") as ExerciseType);
    setTargetAudience(tmpl.target_audience || "");
    setDuration(tmpl.duration || 8);
    setActions(Array.isArray(tmpl.actions) ? tmpl.actions as Action[] : []);
    try {
      const raw = tmpl.structured_phases;
      if (Array.isArray(raw)) setPhases(raw as Phase[]);
      else if (typeof raw === "string") setPhases(JSON.parse(raw));
      else setPhases([]);
    } catch { setPhases([]); }
    setDirty(true);
    setShowTemplateModal(false);
  };

  // Action CRUD
  const addAction = (w: number, d: number) => {
    setActions(prev => [...prev, { week_range: w, day_of_week: d, time_group: "morning", label: "", details: [], priority: false }]);
    setDirty(true);
  };
  const updateAction = (idx: number, field: string, value: unknown) => {
    setActions(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
    setDirty(true);
  };
  const deleteAction = (idx: number) => {
    setActions(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  // Copy week
  const copyWeek = (sourceWeek: number, targetWeek: number) => {
    const sourceActions = actions.filter(a => a.week_range === sourceWeek);
    const newActions = sourceActions.map(a => ({ ...a, week_range: targetWeek }));
    setActions(prev => [...prev.filter(a => a.week_range !== targetWeek), ...newActions]);
    setCopySource(null);
    setDirty(true);
  };
  const fillAllWeeks = (sourceWeek: number) => {
    const sourceActions = actions.filter(a => a.week_range === sourceWeek);
    const filled: Action[] = [];
    for (let w = 0; w < duration; w++) {
      if (w === sourceWeek) {
        filled.push(...sourceActions);
      } else {
        filled.push(...sourceActions.map(a => ({ ...a, week_range: w })));
      }
    }
    setActions(filled);
    setCopySource(null);
    setDirty(true);
  };

  // Exercise library functions
  const loadExerciseLibrary = useCallback(async () => {
    if (exerciseLibraryLoaded) return;
    try {
      const { data } = await supabase.from("exercises").select("*").order("name", { ascending: true });
      if (data) { setExerciseLibrary(data as Exercise[]); setExerciseLibraryLoaded(true); }
    } catch {}
  }, [exerciseLibraryLoaded]);

  const buildActionKey = (weekIdx: number, dayIdx: number, timeGroup: string, actionIndex: number) => {
    const progKey = customProgramDbId ? `custom-${customProgramDbId}` : "unknown";
    return `${categoryKey}-${progKey}-w${weekIdx}d${dayIdx}-${timeGroup}-${actionIndex}`;
  };

  const loadActionExercisesForDay = useCallback(async (weekIdx: number, dayIdx: number) => {
    if (!customProgramDbId) return;
    const progKey = `custom-${customProgramDbId}`;
    try {
      const { data } = await supabase.from("action_exercises").select("*")
        .eq("program_key", progKey).eq("week_range", weekIdx).eq("day_of_week", dayIdx)
        .order("sort_order", { ascending: true });
      if (data) {
        const grouped: Record<string, ActionExercise[]> = {};
        for (const row of data) { const k = row.action_key as string; if (!grouped[k]) grouped[k] = []; grouped[k].push(row as ActionExercise); }
        setActionExercises(prev => ({ ...prev, ...grouped }));
      }
    } catch {}
  }, [customProgramDbId]);

  // Load exercises when a cell is selected
  useEffect(() => {
    if (selectedCell && categoryKey === "exercise") {
      loadExerciseLibrary();
      loadActionExercisesForDay(selectedCell.week, selectedCell.day);
    }
  }, [selectedCell, categoryKey, loadExerciseLibrary, loadActionExercisesForDay]);

  const saveActionExercisesForKey = async (actionKey: string, exercises: ActionExercise[]) => {
    if (!customProgramDbId) return;
    const progKey = `custom-${customProgramDbId}`;
    try {
      await supabase.from("action_exercises").delete().eq("action_key", actionKey).eq("program_key", progKey);
      if (exercises.length > 0) {
        const rows = exercises.map((ex, i) => ({
          action_key: actionKey, program_key: progKey,
          week_range: selectedCell?.week ?? 0, day_of_week: selectedCell?.day ?? 0,
          exercise_id: ex.exercise_id, exercise_name: ex.exercise_name,
          sets: ex.sets, reps: ex.reps, duration: ex.duration || null,
          rest: ex.rest, notes: ex.notes || null, sort_order: i,
        }));
        await supabase.from("action_exercises").insert(rows);
      }
    } catch {}
  };

  const addExerciseToAction = async (actionKey: string) => {
    if (!selectedExercise) return;
    const newEx: ActionExercise = {
      action_key: actionKey, program_key: customProgramDbId ? `custom-${customProgramDbId}` : "",
      week_range: selectedCell?.week ?? 0, day_of_week: selectedCell?.day ?? 0,
      exercise_id: selectedExercise.id, exercise_name: selectedExercise.name,
      sets: exSets, reps: exReps, duration: "", rest: exRest, notes: exNotes,
      sort_order: (actionExercises[actionKey]?.length ?? 0),
    };
    const updated = [...(actionExercises[actionKey] || []), newEx];
    setActionExercises(prev => ({ ...prev, [actionKey]: updated }));
    await saveActionExercisesForKey(actionKey, updated);
    setSelectedExercise(null); setExerciseSearch(""); setExSets(3); setExReps("10"); setExRest("60s"); setExNotes("");
    setShowExercisePicker(null);
  };

  const removeExerciseFromAction = async (actionKey: string, index: number) => {
    const updated = (actionExercises[actionKey] || []).filter((_, i) => i !== index);
    setActionExercises(prev => ({ ...prev, [actionKey]: updated }));
    await saveActionExercisesForKey(actionKey, updated);
  };

  const selectedActions = selectedCell
    ? actions.map((a, i) => ({ ...a, _idx: i })).filter(a => a.week_range === selectedCell.week && a.day_of_week === selectedCell.day)
    : [];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-[#10B981] rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href={`/admin/clients?expand=${clientId}`} className="text-sm text-gray-400 hover:text-gray-600">&larr; {clientName}</Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium" style={{ color }}>{categoryLabels[categoryKey] || categoryKey}</span>
          </div>
          <h1 className="text-xl font-bold text-[#1F2937]">Custom Program Editor</h1>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />Unsaved</span>}
          <button onClick={() => setShowTemplateModal(true)} className="px-3 py-2 text-xs font-medium text-purple-600 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors">
            Templates {templates.length > 0 ? `(${templates.length})` : ""}
          </button>
          <button onClick={handleSaveAsTemplate} className="px-3 py-2 text-xs font-medium text-purple-600 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors">
            Save as template
          </button>
          <button onClick={handleShare} className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${shared ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}>
            {shared ? "Shared with client" : "Share with client"}
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#10B981] disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
          {saveMsg && <span className="text-xs font-medium text-green-600">{saveMsg}</span>}
        </div>
      </div>

      {/* Program details */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Program name</label>
            <input value={programName} onChange={(e) => { setProgramName(e.target.value); setDirty(true); }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-base font-semibold focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Tagline</label>
            <input value={tagline} onChange={(e) => { setTagline(e.target.value); setDirty(true); }} placeholder="One-liner for card"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Duration</label>
            <select value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setDirty(true); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900">
              <option value={4}>4 weeks</option><option value={8}>8 weeks</option><option value={12}>12 weeks</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Level</label>
            <select value={level} onChange={(e) => { setLevel(e.target.value as ProgramLevel); setDirty(true); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900">
              <option value="">Not set</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </div>
          {categoryKey === "exercise" && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Exercise type</label>
              <select value={exerciseType} onChange={(e) => { setExerciseType(e.target.value as ExerciseType); setDirty(true); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900">
                <option value="">Not set</option><option value="gym">Gym</option><option value="home">Home</option>
              </select>
            </div>
          )}
          <div className={categoryKey === "exercise" ? "md:col-span-2" : "md:col-span-3"}>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Who is it for</label>
            <input value={targetAudience} onChange={(e) => { setTargetAudience(e.target.value); setDirty(true); }} placeholder="Target audience"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</label>
          <textarea value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} rows={3} placeholder="Program description..."
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#10B981] outline-none resize-y text-gray-900 leading-relaxed" />
        </div>

        {/* Structured phases */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Program phases</label>
            <button onClick={() => { setPhases(prev => [...prev, { weeks: "", name: "", description: "" }]); setDirty(true); }}
              className="text-xs font-medium text-[#10B981] hover:underline">+ Add phase</button>
          </div>
          {phases.length === 0 && <p className="text-xs text-gray-300 py-1">No phases defined.</p>}
          {phases.map((phase, pi) => (
            <div key={pi} className="flex items-start gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 mt-1">{pi + 1}</div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                <input value={phase.weeks} onChange={(e) => { setPhases(prev => prev.map((p, i) => i === pi ? { ...p, weeks: e.target.value } : p)); setDirty(true); }}
                  placeholder="e.g. 1–4" className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900" />
                <input value={phase.name} onChange={(e) => { setPhases(prev => prev.map((p, i) => i === pi ? { ...p, name: e.target.value } : p)); setDirty(true); }}
                  placeholder="Phase name" className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900" />
                <input value={phase.description} onChange={(e) => { setPhases(prev => prev.map((p, i) => i === pi ? { ...p, description: e.target.value } : p)); setDirty(true); }}
                  placeholder="Description" className="md:col-span-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900" />
              </div>
              <button onClick={() => { setPhases(prev => prev.filter((_, i) => i !== pi)); setDirty(true); }} className="p-1 text-red-400 hover:text-red-600 mt-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Copy week bar */}
      {copySource !== null && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3 text-sm flex-wrap">
          <span className="text-blue-700 font-medium">Copy {weekRanges[copySource]} to:</span>
          <button onClick={() => fillAllWeeks(copySource)} className="px-3 py-1 bg-[#10B981] text-white rounded-lg text-xs font-bold">All weeks</button>
          <span className="text-blue-400">|</span>
          {weekRanges.slice(0, duration).map((wr, wi) => wi !== copySource && (
            <button key={wi} onClick={() => copyWeek(copySource, wi)} className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium">{wr}</button>
          ))}
          <button onClick={() => setCopySource(null)} className="ml-auto text-blue-500 hover:text-blue-700 text-xs font-medium">Cancel</button>
        </div>
      )}

      {/* Week/Day grid */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-xs text-gray-400 font-medium text-left w-14">Day</th>
                {weekRanges.slice(0, duration).map((wr, wi) => (
                  <th key={wi} className="p-2 text-xs font-medium text-gray-500 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {wr}
                      <button onClick={() => setCopySource(copySource === wi ? null : wi)} title="Copy this week" className="p-0.5 text-gray-300 hover:text-gray-500">
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
                  {weekRanges.slice(0, duration).map((_, weekIdx) => {
                    const count = actions.filter(a => a.week_range === weekIdx && a.day_of_week === dayIdx).length;
                    const isSelected = selectedCell?.week === weekIdx && selectedCell?.day === dayIdx;
                    return (
                      <td key={weekIdx} className="p-1">
                        <button
                          onClick={() => setSelectedCell(isSelected ? null : { week: weekIdx, day: dayIdx })}
                          className={`w-full p-2 rounded-lg text-xs transition-all border ${
                            isSelected ? "ring-2 ring-blue-200" : ""
                          } ${isSelected ? "bg-blue-50 border-blue-300" : count > 0 ? "bg-white border-gray-200 hover:border-blue-200" : "bg-gray-50 border-gray-100 hover:bg-gray-100"}`}
                        >
                          {count > 0 ? <span className={`font-medium ${isSelected ? "text-blue-700" : "text-gray-700"}`}>{count}</span> : <span className="text-gray-300">-</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action editor */}
      {selectedCell && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: color + "08" }}>
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-700">{dayLabels[selectedCell.day]} — {weekRanges[selectedCell.week]}</h3>
              <span className="text-xs text-gray-400">{selectedActions.length} action(s)</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Time group filter */}
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                {(["all", ...timeGroups] as const).map((tg) => (
                  <button key={tg} onClick={() => setActiveTimeTab(tg)}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${activeTimeTab === tg ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {tg === "all" ? "All" : tg.charAt(0).toUpperCase() + tg.slice(1)}
                  </button>
                ))}
              </div>
              <button onClick={() => addAction(selectedCell.week, selectedCell.day)}
                className="px-3 py-1 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: color }}>+ Add Action</button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {selectedActions.filter(a => activeTimeTab === "all" || a.time_group === activeTimeTab).length === 0 && (
              <p className="text-center text-sm text-gray-300 py-6">No actions. Click &quot;+ Add Action&quot; to create one.</p>
            )}
            {selectedActions.filter(a => activeTimeTab === "all" || a.time_group === activeTimeTab).map((action) => (
              <div key={action._idx} className="p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex gap-3">
                  <input value={action.label} onChange={(e) => updateAction(action._idx, "label", e.target.value)} placeholder="Action label (e.g. Barbell Bench Press)"
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-base font-semibold focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900" />
                  <select value={action.time_group} onChange={(e) => updateAction(action._idx, "time_group", e.target.value)}
                    className="w-32 px-3 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900">
                    {timeGroups.map(tg => <option key={tg} value={tg}>{tg.charAt(0).toUpperCase() + tg.slice(1)}</option>)}
                  </select>
                </div>
                <textarea value={Array.isArray(action.details) ? action.details.join("\n") : ""} onChange={(e) => updateAction(action._idx, "details", e.target.value.split("\n"))}
                  placeholder={"Details — one item per line\n\ne.g.\n4 sets x 8 reps\n60s rest between sets\nRPE 7"}
                  rows={8} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#10B981] outline-none resize-y text-gray-900 leading-relaxed min-h-[150px]" />
                {/* Media URLs */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Image URL</label>
                    <input value={action.image_url || ""} onChange={(e) => updateAction(action._idx, "image_url", e.target.value)} placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#10B981] outline-none text-gray-700" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Video URL</label>
                    <input value={action.video_url || ""} onChange={(e) => updateAction(action._idx, "video_url", e.target.value)} placeholder="https://youtube.com/..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#10B981] outline-none text-gray-700" />
                  </div>
                </div>
                {/* Exercise library section (exercise category only) */}
                {categoryKey === "exercise" && selectedCell && (() => {
                  const actionIdx = selectedActions.filter(a => activeTimeTab === "all" || a.time_group === activeTimeTab).indexOf(action);
                  const ak = buildActionKey(selectedCell.week, selectedCell.day, action.time_group, actionIdx);
                  const exercises = actionExercises[ak] || [];
                  return (
                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Exercises from library</span>
                        <button onClick={() => { loadExerciseLibrary(); setShowExercisePicker(showExercisePicker === ak ? null : ak); setSelectedExercise(null); setExerciseSearch(""); }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800">
                          {showExercisePicker === ak ? "Close" : "+ Add exercise"}
                        </button>
                      </div>
                      {/* Existing exercises */}
                      {exercises.length > 0 ? (
                        <div className="space-y-2 mb-2">
                          {exercises.map((ex, ei) => {
                            const libEx = exerciseLibrary.find(e => e.name === ex.exercise_name);
                            return (
                              <div key={ei} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                                {libEx?.illustration_url && (
                                  <img src={libEx.illustration_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-800">{ex.exercise_name}</p>
                                  <p className="text-xs text-gray-500">
                                    {ex.sets && `${ex.sets} sets`}{ex.reps && ` × ${ex.reps}`}{ex.rest && ` · ${ex.rest} rest`}
                                  </p>
                                  {ex.notes && <p className="text-xs text-gray-400 mt-0.5">{ex.notes}</p>}
                                </div>
                                <button onClick={() => removeExerciseFromAction(ak, ei)}
                                  className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-300 mb-2">No exercises linked yet.</p>
                      )}
                      {/* Exercise picker */}
                      {showExercisePicker === ak && (
                        <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/30 space-y-3">
                          <input value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)}
                            placeholder="Search exercises..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 outline-none text-gray-900" />
                          {!selectedExercise ? (
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {exerciseLibrary
                                .filter(e => !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) || e.category.toLowerCase().includes(exerciseSearch.toLowerCase()) || e.equipment?.toLowerCase().includes(exerciseSearch.toLowerCase()))
                                .slice(0, 20)
                                .map(e => (
                                  <button key={e.id} onClick={() => setSelectedExercise(e)}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white transition-colors text-left">
                                    {e.illustration_url && <img src={e.illustration_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-800 truncate">{e.name}</p>
                                      <p className="text-[10px] text-gray-400">{e.category}{e.equipment ? ` · ${e.equipment}` : ""}</p>
                                    </div>
                                  </button>
                                ))}
                              {exerciseLibrary.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">Loading library...</p>}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 p-2 bg-white rounded-lg">
                                {selectedExercise.illustration_url && <img src={selectedExercise.illustration_url} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">{selectedExercise.name}</p>
                                  <p className="text-[10px] text-gray-400">{selectedExercise.category}{selectedExercise.equipment ? ` · ${selectedExercise.equipment}` : ""}</p>
                                </div>
                                <button onClick={() => setSelectedExercise(null)} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Change</button>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Sets</label>
                                  <input type="number" value={exSets} onChange={(e) => setExSets(Number(e.target.value))}
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-300 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Reps</label>
                                  <input value={exReps} onChange={(e) => setExReps(e.target.value)} placeholder="8-12"
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-300 outline-none" />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Rest</label>
                                  <input value={exRest} onChange={(e) => setExRest(e.target.value)} placeholder="60s"
                                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-300 outline-none" />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Notes</label>
                                <input value={exNotes} onChange={(e) => setExNotes(e.target.value)} placeholder="Focus on controlled eccentric..."
                                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-300 outline-none" />
                              </div>
                              <button onClick={() => addExerciseToAction(ak)}
                                className="w-full py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                                Add to action
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`relative w-9 h-5 rounded-full transition-colors ${action.priority ? "bg-[#10B981]" : "bg-gray-300"}`}>
                      <input type="checkbox" checked={action.priority} onChange={(e) => updateAction(action._idx, "priority", e.target.checked)} className="sr-only" />
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${action.priority ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">Priority action</span>
                  </label>
                  <button onClick={() => deleteAction(action._idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Load template</h3>
              <button onClick={() => setShowTemplateModal(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">This will replace all current content with the template.</p>
            <div className="overflow-y-auto flex-1 space-y-1">
              {templates.length === 0 ? (
                <p className="text-sm text-gray-300 text-center py-8">No templates for {categoryLabels[categoryKey] || categoryKey} yet.</p>
              ) : templates.map((t) => (
                <button key={t.id} onClick={() => handleLoadTemplate(t.id)}
                  className="w-full text-left px-3 py-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.description || "No description"} · {t.duration || 8} weeks</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
