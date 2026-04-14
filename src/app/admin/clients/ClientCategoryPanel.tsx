"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useClientProgress, ProgressRing, type ClientProgressData, getNudgeStatus } from "./ClientProgressPanel";

// ─── Types ─────────────────────────────────────────────────

interface ProgramInfo {
  programKey: string;
  programName: string;
  week: number;
  isCustom: boolean;
  startedAt: string | null;
}

const categoryDefs = [
  { key: "exercise", label: "Exercise", color: "#E86830", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "nutrition", label: "Nutrition", color: "#65A30D", bg: "bg-lime-50", border: "border-lime-200" },
  { key: "sleep", label: "Sleep", color: "#7C6F9B", bg: "bg-purple-50", border: "border-purple-200" },
  { key: "mental", label: "Mental", color: "#2593D1", bg: "bg-sky-50", border: "border-sky-200" },
];

// ─── Unified category panel ────────────────────────────────

export default function ClientCategoryPanel({ clientId, clientName, tier, avatarUrl, dateOfBirth, sex, address, joined }: {
  clientId: string;
  clientName: string;
  tier: string;
  avatarUrl?: string | null;
  dateOfBirth?: string;
  sex?: string;
  address?: string;
  joined?: string;
}) {
  const router = useRouter();
  const { progress, loading: progressLoading } = useClientProgress(clientId);
  const [programs, setPrograms] = useState<Record<string, ProgramInfo>>({});
  const [customPrograms, setCustomPrograms] = useState<Record<string, Record<string, unknown>>>({});
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; category_key: string; description: string }>>([]);
  const [availablePrograms, setAvailablePrograms] = useState<Record<string, Array<{ key: string; name: string }>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const { data: clientProgs } = await supabase
        .from("client_programs")
        .select("category_key, program_key, week_number, started_at")
        .eq("client_id", clientId);

      // Load all programs with their category
      const { data: allProgs } = await supabase
        .from("programs")
        .select("key, name, category_id, program_categories(key)")
        .order("sort_order", { ascending: true });
      const progNames: Record<string, string> = {};
      const byCategory: Record<string, Array<{ key: string; name: string }>> = {};
      for (const p of allProgs || []) {
        const pr = p as Record<string, unknown>;
        progNames[pr.key as string] = pr.name as string;
        const catKey = (pr.program_categories as Record<string, string>)?.key;
        if (catKey) {
          if (!byCategory[catKey]) byCategory[catKey] = [];
          byCategory[catKey].push({ key: pr.key as string, name: pr.name as string });
        }
      }
      setAvailablePrograms(byCategory);

      const { data: customs } = await supabase
        .from("client_custom_programs")
        .select("*")
        .eq("client_id", clientId);

      const customMap: Record<string, Record<string, unknown>> = {};
      for (const c of customs || []) {
        customMap[(c as Record<string, string>).category_key] = c as Record<string, unknown>;
      }
      setCustomPrograms(customMap);

      const mapped: Record<string, ProgramInfo> = {};
      for (const cp of clientProgs || []) {
        const row = cp as Record<string, unknown>;
        const catKey = row.category_key as string;
        const progKey = row.program_key as string;
        const isCustom = !!customMap[catKey];
        mapped[catKey] = {
          programKey: progKey,
          programName: isCustom ? (customMap[catKey].program_name as string) : (progNames[progKey] || progKey),
          week: (row.week_number as number) || 1,
          isCustom,
          startedAt: (row.started_at as string) || null,
        };
      }
      setPrograms(mapped);

      const { data: tmpl } = await supabase
        .from("program_templates")
        .select("id, name, category_key, description")
        .order("created_at", { ascending: false });
      setTemplates((tmpl || []) as Array<{ id: string; name: string; category_key: string; description: string }>);
    } catch {}
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  const handleChangeProgram = async (categoryKey: string, newProgramKey: string, startNextMonday?: boolean, duration?: 4 | 8 | 12) => {
    try {
      let startDate = new Date();
      if (startNextMonday) {
        const day = startDate.getDay();
        const daysUntilMonday = day === 0 ? 1 : 8 - day;
        startDate = new Date(startDate.getTime() + daysUntilMonday * 86400000);
      }
      await supabase.from("client_programs").upsert({
        client_id: clientId,
        category_key: categoryKey,
        program_key: newProgramKey,
        week_number: 1,
        started_at: startDate.toISOString(),
        duration: duration || 8,
      }, { onConflict: "client_id,category_key" });
      // Remove any custom program for this category since we're switching to a standard one
      await supabase.from("client_custom_programs").delete().eq("client_id", clientId).eq("category_key", categoryKey);
      await loadPrograms();
    } catch {}
  };

  const handleChangeWeek = async (categoryKey: string, newWeek: number) => {
    // Use upsert instead of update — update requires matching RLS on the existing row
    // which may fail if the row was created by the client (client_id != auth.uid() for staff)
    const prog = programs[categoryKey];
    if (!prog) return;
    const { error } = await supabase.from("client_programs").upsert({
      client_id: clientId,
      category_key: categoryKey,
      program_key: prog.programKey,
      week_number: newWeek,
    }, { onConflict: "client_id,category_key" });
    if (error) {
      console.error("[WeekChange] Error:", error.message);
      return;
    }
    setPrograms(prev => ({
      ...prev,
      [categoryKey]: prev[categoryKey] ? { ...prev[categoryKey], week: newWeek } : prev[categoryKey],
    }));
  };

  const handleCustomize = async (categoryKey: string) => {
    setSaving(true);
    try {
      const existing = programs[categoryKey];
      let baseName = `Custom ${categoryDefs.find(c => c.key === categoryKey)?.label || categoryKey} for ${clientName}`;
      let baseActions: Array<Record<string, unknown>> = [];
      let sourceProgId: string | null = null;

      if (existing) {
        baseName = `${existing.programName} (custom)`;
        const { data: prog } = await supabase.from("programs").select("id, description, weekly_focus")
          .eq("key", existing.programKey).maybeSingle();
        if (prog) {
          sourceProgId = (prog as Record<string, string>).id;
          const { data: acts } = await supabase.from("program_actions")
            .select("*").eq("program_id", sourceProgId).order("sort_order", { ascending: true });
          baseActions = (acts || []).map((a: Record<string, unknown>, i: number) => ({
            id: a.id || `action-${i}`,
            week_range: a.week_range,
            day_of_week: a.day_of_week,
            time_group: a.time_group,
            sort_order: a.sort_order ?? i,
            label: a.label,
            details: a.details,
            priority: a.priority,
            image_url: a.image_url || null,
            video_url: a.video_url || null,
          }));
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error: insertError } = await supabase.from("client_custom_programs").upsert({
        client_id: clientId,
        category_key: categoryKey,
        program_name: baseName,
        description: existing ? `Customized from ${existing.programName}` : "",
        actions: baseActions,
        shared: false,
        created_by: user?.id || null,
        created_from_program: existing?.programKey || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_id,category_key" }).select("id").single();

      if (insertError) {
        alert(`Failed to create custom program: ${insertError.message}`);
        setSaving(false);
        return;
      }

      // Clone action_exercises for exercise programs
      if (categoryKey === "exercise" && sourceProgId && inserted) {
        try {
          const { data: sourceExercises } = await supabase
            .from("action_exercises")
            .select("*")
            .eq("program_key", sourceProgId);
          if (sourceExercises && sourceExercises.length > 0) {
            const newCustomKey = `custom-${inserted.id}`;
            const clones = (sourceExercises as Array<Record<string, unknown>>).map((ex) => {
              const oldKey = (ex.action_key as string) || "";
              const newKey = oldKey.replace(sourceProgId!, newCustomKey);
              return {
                action_key: newKey,
                program_key: newCustomKey,
                exercise_name: ex.exercise_name,
                sets: ex.sets,
                reps: ex.reps,
                rest: ex.rest,
                notes: ex.notes,
                sort_order: ex.sort_order,
              };
            });
            await supabase.from("action_exercises").insert(clones);
          }
        } catch {
          // Non-critical — exercise details can be added in editor
        }
      }

      // Update client_programs to point to the custom program key
      // so the app picks it up (app checks for `custom-{uuid}` prefix)
      const customProgramKey = `custom-${inserted.id}`;
      await supabase.from("client_programs").upsert({
        client_id: clientId,
        category_key: categoryKey,
        program_key: customProgramKey,
        week_number: existing?.week || 1,
        started_at: new Date().toISOString(),
      }, { onConflict: "client_id,category_key" });

      await loadPrograms();
      // Navigate to the editor for the newly created custom program
      router.push(`/admin/clients/${clientId}/program/${categoryKey}`);
    } catch (e) {
      alert(`Failed to create custom program: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
    setSaving(false);
  };

  const handleRemoveCustom = async (categoryKey: string) => {
    if (!confirm("Remove custom program and revert to the general program?")) return;
    setSaving(true);
    try {
      // Get the original program key from created_from_program before deleting
      const { data: custom } = await supabase.from("client_custom_programs")
        .select("created_from_program")
        .eq("client_id", clientId).eq("category_key", categoryKey).maybeSingle();
      const originalKey = (custom as Record<string, string> | null)?.created_from_program;

      await supabase.from("client_custom_programs").delete().eq("client_id", clientId).eq("category_key", categoryKey);

      // Revert client_programs to the original program key
      if (originalKey) {
        await supabase.from("client_programs").update({ program_key: originalKey })
          .eq("client_id", clientId).eq("category_key", categoryKey);
      }

      await loadPrograms();
    } catch { alert("Failed to remove custom program"); }
    setSaving(false);
  };

  const handleSaveAsTemplate = async (categoryKey: string) => {
    const custom = customPrograms[categoryKey];
    if (!custom) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const name = prompt("Template name:", (custom.program_name as string) || "");
      if (!name) { setSaving(false); return; }
      await supabase.from("program_templates").insert({
        name, category_key: categoryKey, description: (custom.description as string) || "",
        tagline: (custom.tagline as string) || null, level: (custom.level as string) || null,
        exercise_type: (custom.exercise_type as string) || null,
        target_audience: (custom.target_audience as string) || null,
        structured_phases: custom.structured_phases || null,
        duration: (custom.duration as number) || 8, actions: custom.actions || [],
        created_by: user?.id || null,
      });
      await loadPrograms();
      alert(`Template "${name}" saved`);
    } catch { alert("Failed to save template"); }
    setSaving(false);
  };

  const handleLoadTemplate = async (categoryKey: string, templateId: string) => {
    setSaving(true);
    try {
      const { data: tmpl } = await supabase.from("program_templates").select("*").eq("id", templateId).single();
      if (tmpl) {
        const t = tmpl as Record<string, unknown>;
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("client_custom_programs").upsert({
          client_id: clientId, category_key: categoryKey,
          program_name: `${t.name as string} (for ${clientName})`,
          description: (t.description as string) || "", tagline: (t.tagline as string) || null,
          level: (t.level as string) || null, exercise_type: (t.exercise_type as string) || null,
          target_audience: (t.target_audience as string) || null,
          structured_phases: t.structured_phases || null, duration: (t.duration as number) || 8,
          actions: t.actions || [], created_by: user?.id || null,
          created_from_template: t.id as string, updated_at: new Date().toISOString(),
        }, { onConflict: "client_id,category_key" });
      }
      await loadPrograms();
    } catch { alert("Failed to load template"); }
    setSaving(false);
  };

  const isLoading = loading || progressLoading;
  const status = progress ? getNudgeStatus(progress) : "no-program";

  if (isLoading) {
    return (
      <div className="py-6 text-center">
        <span className="text-xs text-gray-400">Loading...</span>
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* Profile row */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        {avatarUrl?.startsWith("avatar:") ? (
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
            {avatarUrl.replace("avatar:", "")}
          </div>
        ) : avatarUrl?.startsWith("http") ? (
          <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
            {clientName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900">{clientName}</h3>
          <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-gray-500">
            {sex && <span className="capitalize">{sex}</span>}
            {dateOfBirth && <span>Born {dateOfBirth}</span>}
            {address && <span>{address}</span>}
            {joined && <span>Joined {joined}</span>}
          </div>
        </div>
      </div>

      {/* Weekly progress — prominent section */}
      {progress && progress.programs.length > 0 && (
        <div className="flex items-center gap-5 mb-5 pb-5 border-b border-gray-200/60 bg-gray-50/60 -mx-5 px-5 py-4 rounded-xl">
          <div className="relative flex-shrink-0">
            <ProgressRing
              percentage={progress.totalPercentage}
              size={80}
              strokeWidth={6}
              color={status === "on-track" ? "#34D399" : status === "needs-nudge" ? "#FBBF24" : "#F87171"}
            />
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-900">
              {Math.round(progress.totalPercentage)}%
            </span>
          </div>
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-bold text-gray-900">Weekly Progress</p>
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{progress.programs.reduce((s, p) => s + p.totalCompleted, 0)}</span>
              <span className="text-gray-400"> / </span>
              <span>{progress.programs.reduce((s, p) => s + p.totalExpected, 0)} actions completed</span>
            </p>
            <div className="flex items-center gap-3">
              {progress.streak > 0 && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 rounded-full">
                  <span className="text-xs">🔥</span>
                  <span className="text-xs font-bold text-emerald-700">{progress.streak} day streak</span>
                </div>
              )}
              {progress.lastActiveDate && (
                <span className="text-xs text-gray-400">
                  {progress.daysSinceActive === 0 ? "Active today" : progress.daysSinceActive === 1 ? "Active yesterday" : `Last active ${progress.daysSinceActive}d ago`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      {(!progress || progress.programs.length === 0) && (
        <div className="mb-5 pb-5 border-b border-gray-200/60" />
      )}

      {/* Category rows — full width horizontal cards */}
      <div className="space-y-3">
        {categoryDefs.map((cat) => {
          const prog = programs[cat.key];
          const custom = customPrograms[cat.key];
          const progressData = progress?.programs.find((p) => p.categoryKey === cat.key);
          const catTemplates = templates.filter((t) => t.category_key === cat.key);

          return (
            <CategoryCard
              key={cat.key}
              category={cat}
              program={prog || null}
              isCustom={!!custom}
              progress={progressData || null}
              templates={catTemplates}
              availablePrograms={availablePrograms[cat.key] || []}
              saving={saving}
              onChangeProgram={(key, startNextMonday, dur) => handleChangeProgram(cat.key, key, startNextMonday, dur)}
              onChangeWeek={(w) => handleChangeWeek(cat.key, w)}
              onCustomize={() => handleCustomize(cat.key)}
              onRemoveCustom={() => handleRemoveCustom(cat.key)}
              onEditProgram={() => router.push(`/admin/clients/${clientId}/program/${cat.key}`)}
              onSaveTemplate={() => handleSaveAsTemplate(cat.key)}
              onLoadTemplate={(id) => handleLoadTemplate(cat.key, id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Category card ─────────────────────────────────────────

function CategoryCard({ category, program, isCustom, progress, templates, availablePrograms, saving, onChangeProgram, onChangeWeek, onCustomize, onRemoveCustom, onEditProgram, onSaveTemplate, onLoadTemplate }: {
  category: { key: string; label: string; color: string; bg: string; border: string };
  program: ProgramInfo | null;
  isCustom: boolean;
  progress: { percentage: number; totalCompleted: number; totalExpected: number; trend: number | null } | null;
  templates: Array<{ id: string; name: string; description: string }>;
  availablePrograms: Array<{ key: string; name: string }>;
  saving: boolean;
  onChangeProgram: (programKey: string, startNextMonday?: boolean, duration?: 4 | 8 | 12) => void;
  onChangeWeek: (week: number) => void;
  onCustomize: () => void;
  onRemoveCustom: () => void;
  onEditProgram: () => void;
  onSaveTemplate: () => void;
  onLoadTemplate: (id: string) => void;
}) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingProgram, setPendingProgram] = useState<string | null>(null);
  const [pendingDuration, setPendingDuration] = useState<4 | 8 | 12>(8);
  const pct = progress?.percentage ?? 0;

  const confirmProgram = (startNextMonday: boolean) => {
    if (pendingProgram) {
      onChangeProgram(pendingProgram, startNextMonday, pendingDuration);
      setPendingProgram(null);
      setPendingDuration(8);
    }
  };

  return (
    <div className={`rounded-xl border p-4 transition-colors ${isCustom ? "border-amber-300/60 bg-amber-50/40" : `${category.bg} ${category.border}`}`}>
      {/* Single row: color dot + label + program name + stats + week + actions */}
      <div className="flex items-center gap-3">
        {/* Category color bar */}
        <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: category.color, opacity: 0.7 }} />

        {/* Category label + program name */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: category.color }}>
              {category.label}
            </span>
            {isCustom && (
              <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">CUSTOM</span>
            )}
          </div>
          {isCustom ? (
            <p className="text-sm font-medium text-gray-800 truncate">{program?.programName || "Custom program"}</p>
          ) : (
            <select
              value={program?.programKey || ""}
              onChange={(e) => { if (e.target.value && e.target.value !== program?.programKey) setPendingProgram(e.target.value); }}
              className="text-sm font-medium text-gray-800 bg-transparent border-none outline-none cursor-pointer p-0 -ml-0.5 max-w-full truncate"
            >
              {!program && <option value="">Select program...</option>}
              {availablePrograms.map((p) => (
                <option key={p.key} value={p.key}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Completion counter */}
        {program && (
          <div className="flex items-center gap-1 text-xs flex-shrink-0">
            <span className="font-semibold text-gray-900">{progress?.totalCompleted ?? 0}</span>
            <span className="text-gray-400">/</span>
            <span className="text-gray-500">{progress?.totalExpected ?? 0}</span>
          </div>
        )}

        {/* Trend */}
        {progress?.trend !== null && progress?.trend !== undefined && progress.trend !== 0 && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
            progress.trend > 0 ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"
          }`}>
            {progress.trend > 0 ? "+" : ""}{Math.round(progress.trend)}%
          </span>
        )}

        {/* Start date */}
        {program?.startedAt && (
          <span className="text-[10px] text-gray-400 flex-shrink-0">
            Started {new Date(program.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        )}

        {/* Week selector */}
        {program && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-[10px] text-gray-400">Wk</span>
            <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => onChangeWeek(Math.max(1, program.week - 1))}
                className="w-6 h-6 text-gray-400 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center text-xs font-bold transition-colors">−</button>
              <span className="text-xs font-semibold text-gray-700 w-6 text-center border-x border-gray-200">{program.week}</span>
              <button onClick={() => onChangeWeek(program.week + 1)}
                className="w-6 h-6 text-gray-400 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center text-xs font-bold transition-colors">+</button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isCustom ? (
            <>
              <button onClick={onEditProgram}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                Edit
              </button>
              <button onClick={onSaveTemplate} disabled={saving}
                className="p-1.5 text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50" title="Save as template">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              </button>
              <button onClick={onRemoveCustom} disabled={saving}
                className="p-1.5 text-gray-300 hover:text-red-500 border border-gray-200 rounded-lg hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50" title="Remove custom">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button onClick={onCustomize} disabled={saving}
                className="px-2.5 py-1.5 text-[11px] font-medium text-gray-500 border border-gray-200 rounded-lg hover:text-gray-700 hover:border-gray-300 transition-colors disabled:opacity-50">
                Customize
              </button>
              {templates.length > 0 && (
                <div className="relative">
                  <button onClick={() => setShowTemplates(!showTemplates)}
                    className="p-1.5 text-gray-400 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors" title="Load template">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  {showTemplates && (
                    <div className="absolute right-0 bottom-full mb-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                      {templates.map((t) => (
                        <button key={t.id} onClick={() => { onLoadTemplate(t.id); setShowTemplates(false); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors">
                          <p className="font-medium text-gray-700">{t.name}</p>
                          {t.description && <p className="text-gray-400 truncate">{t.description}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pending program change — start options */}
      {pendingProgram && (
        <div className="mt-3 p-2.5 bg-white rounded-lg border border-gray-200 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 flex-1">
              Switch to <span className="font-semibold text-gray-900">{availablePrograms.find(p => p.key === pendingProgram)?.name}</span>
            </span>
            <button onClick={() => { setPendingProgram(null); setPendingDuration(8); }}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Duration */}
            <div className="flex items-center bg-gray-50 rounded-lg p-0.5">
              {([4, 8, 12] as const).map((d) => (
                <button key={d} onClick={() => setPendingDuration(d)}
                  className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    pendingDuration === d ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  }`}>
                  {d}wk
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {/* Start options */}
            <button onClick={() => confirmProgram(false)}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors">
              Start now
            </button>
            <button onClick={() => confirmProgram(true)}
              className="px-2.5 py-1.5 text-[11px] font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              Next Monday
            </button>
          </div>
        </div>
      )}

      {/* Linear progress bar */}
      {program && !pendingProgram && (
        <div className="mt-3 h-1.5 bg-white/80 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: category.color, opacity: 0.75 }} />
        </div>
      )}
    </div>
  );
}
