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
}

const categoryDefs = [
  { key: "exercise", label: "Exercise", color: "#EA580C" },
  { key: "nutrition", label: "Nutrition", color: "#84CC16" },
  { key: "sleep", label: "Sleep", color: "#767194" },
  { key: "mental", label: "Mental", color: "#0EA5E9" },
];

// ─── Unified category panel ────────────────────────────────

export default function ClientCategoryPanel({ clientId, clientName, tier }: {
  clientId: string;
  clientName: string;
  tier: string;
}) {
  const router = useRouter();
  const { progress, loading: progressLoading } = useClientProgress(clientId);
  const [programs, setPrograms] = useState<Record<string, ProgramInfo>>({});
  const [customPrograms, setCustomPrograms] = useState<Record<string, Record<string, unknown>>>({});
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; category_key: string; description: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const { data: clientProgs } = await supabase
        .from("client_programs")
        .select("category_key, program_key, week_number")
        .eq("client_id", clientId);

      const { data: allProgs } = await supabase.from("programs").select("key, name");
      const progNames: Record<string, string> = {};
      for (const p of allProgs || []) progNames[(p as Record<string, string>).key] = (p as Record<string, string>).name;

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

  const handleChangeWeek = async (categoryKey: string, newWeek: number) => {
    try {
      await supabase.from("client_programs").update({ week_number: newWeek })
        .eq("client_id", clientId).eq("category_key", categoryKey);
      setPrograms(prev => ({
        ...prev,
        [categoryKey]: prev[categoryKey] ? { ...prev[categoryKey], week: newWeek } : prev[categoryKey],
      }));
    } catch {}
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
      await supabase.from("client_custom_programs").delete().eq("client_id", clientId).eq("category_key", categoryKey);
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
      {/* Overall summary — single progress ring */}
      {progress && progress.programs.length > 0 && (
        <div className="flex items-center gap-5 mb-5 pb-5 border-b border-gray-100">
          <div className="relative flex-shrink-0">
            <ProgressRing
              percentage={progress.totalPercentage}
              size={64}
              strokeWidth={5}
              color={status === "on-track" ? "#10B981" : status === "needs-nudge" ? "#F59E0B" : "#EF4444"}
            />
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800">
              {Math.round(progress.totalPercentage)}%
            </span>
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold text-[#1F2937]">Weekly Progress</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {progress.programs.reduce((s, p) => s + p.totalCompleted, 0)} of{" "}
              {progress.programs.reduce((s, p) => s + p.totalExpected, 0)} actions completed this week
            </p>
          </div>
          <div className="text-right space-y-1 flex-shrink-0">
            {progress.streak > 0 && (
              <p className="text-sm font-semibold text-emerald-600">{progress.streak} day streak</p>
            )}
            {progress.lastActiveDate && (
              <p className="text-xs text-gray-400">
                {progress.daysSinceActive === 0 ? "Active today" : progress.daysSinceActive === 1 ? "Active yesterday" : `Last active ${progress.daysSinceActive}d ago`}
              </p>
            )}
          </div>
        </div>
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
              saving={saving}
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

function CategoryCard({ category, program, isCustom, progress, templates, saving, onChangeWeek, onCustomize, onRemoveCustom, onEditProgram, onSaveTemplate, onLoadTemplate }: {
  category: { key: string; label: string; color: string };
  program: ProgramInfo | null;
  isCustom: boolean;
  progress: { percentage: number; totalCompleted: number; totalExpected: number; trend: number | null } | null;
  templates: Array<{ id: string; name: string; description: string }>;
  saving: boolean;
  onChangeWeek: (week: number) => void;
  onCustomize: () => void;
  onRemoveCustom: () => void;
  onEditProgram: () => void;
  onSaveTemplate: () => void;
  onLoadTemplate: (id: string) => void;
}) {
  const [showTemplates, setShowTemplates] = useState(false);
  const pct = progress?.percentage ?? 0;

  return (
    <div className={`rounded-xl border p-4 transition-colors ${isCustom ? "border-amber-200 bg-amber-50/30" : "border-gray-100 bg-gray-50/50"}`}>
      {/* Single row: color dot + label + program name + stats + week + actions */}
      <div className="flex items-center gap-3">
        {/* Category color bar */}
        <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />

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
          <p className="text-sm font-medium text-gray-800 truncate">
            {program ? program.programName : <span className="text-gray-300 font-normal text-xs">No program selected</span>}
          </p>
        </div>

        {/* Completion counter */}
        {program && (
          <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
            <span className="font-semibold text-gray-700">{progress?.totalCompleted ?? 0}</span>
            <span className="text-gray-400">/</span>
            <span>{progress?.totalExpected ?? 0}</span>
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

      {/* Linear progress bar */}
      {program && (
        <div className="mt-3 h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: category.color }} />
        </div>
      )}
    </div>
  );
}
