"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type TimeGroup = "morning" | "midday" | "evening";
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

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ClientProgramEditorPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  const categoryKey = params.category as string;

  const [clientName, setClientName] = useState("");
  const [programName, setProgramName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(8);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ week: number; day: number } | null>(null);

  const categoryLabels: Record<string, string> = { exercise: "Exercise", nutrition: "Nutrition", sleep: "Sleep", mental: "Mental" };
  const categoryColors: Record<string, string> = { exercise: "#3B82F6", nutrition: "#20c858", sleep: "#8B5CF6", mental: "#06B6D4" };
  const color = categoryColors[categoryKey] || "#6B7280";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load client name
      const { data: client } = await supabase.from("clients").select("full_name, email").eq("id", clientId).single();
      setClientName((client as Record<string, string>)?.full_name || (client as Record<string, string>)?.email || "Client");

      // Load custom program
      const { data: custom } = await supabase
        .from("client_custom_programs")
        .select("*")
        .eq("client_id", clientId)
        .eq("category_key", categoryKey)
        .maybeSingle();

      if (custom) {
        const c = custom as Record<string, unknown>;
        setProgramName((c.program_name as string) || "");
        setDescription((c.description as string) || "");
        setDuration((c.duration as number) || 8);
        setActions(Array.isArray(c.actions) ? c.actions as Action[] : []);
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
        description,
        duration,
        actions,
        created_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_id,category_key" });
      setDirty(false);
    } catch {
      alert("Failed to save");
    }
    setSaving(false);
  };

  const addAction = (weekIdx: number, dayIdx: number) => {
    setActions(prev => [...prev, {
      week_range: weekIdx,
      day_of_week: dayIdx,
      time_group: "morning",
      label: "",
      details: [],
      priority: false,
    }]);
    setDirty(true);
  };

  const updateAction = (idx: number, field: keyof Action, value: unknown) => {
    setActions(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
    setDirty(true);
  };

  const deleteAction = (idx: number) => {
    setActions(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const selectedActions = selectedCell
    ? actions.map((a, i) => ({ ...a, _idx: i })).filter(a => a.week_range === selectedCell.week && a.day_of_week === selectedCell.day)
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-[#20c858] rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/clients" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              &larr; Clients
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-600">{clientName}</span>
          </div>
          <h1 className="text-xl font-bold text-[#1F2937]">
            Custom {categoryLabels[categoryKey] || categoryKey} Program
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs text-amber-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />Unsaved</span>}
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-[#20c858] rounded-lg hover:bg-[#1bb34d] disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Program info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Program name</label>
            <input
              value={programName}
              onChange={(e) => { setProgramName(e.target.value); setDirty(true); }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-base font-semibold focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Duration</label>
            <select
              value={duration}
              onChange={(e) => { setDuration(Number(e.target.value)); setDirty(true); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
            >
              <option value={4}>4 weeks</option>
              <option value={8}>8 weeks</option>
              <option value={12}>12 weeks</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Description / notes</label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); setDirty(true); }}
            placeholder="Notes about this custom program for the client..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#20c858] outline-none resize-y text-gray-900"
          />
        </div>
      </div>

      {/* Week/Day grid */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-xs text-gray-400 font-medium text-left w-14">Day</th>
                {weekRanges.slice(0, duration).map((wr, wi) => (
                  <th key={wi} className="p-2 text-xs font-medium text-gray-500 text-center">{wr}</th>
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
                            isSelected ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200" :
                            count > 0 ? "bg-white border-gray-200 hover:border-blue-200" : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                          }`}
                        >
                          {count > 0 ? (
                            <span className={`font-medium ${isSelected ? "text-blue-700" : "text-gray-700"}`}>{count}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
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
      </div>

      {/* Action editor */}
      {selectedCell && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: color + "08" }}>
            <h3 className="text-sm font-semibold text-gray-700">
              {dayLabels[selectedCell.day]} — {weekRanges[selectedCell.week]}
            </h3>
            <button
              onClick={() => addAction(selectedCell.week, selectedCell.day)}
              className="px-3 py-1 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: color }}
            >
              + Add Action
            </button>
          </div>
          <div className="p-4 space-y-3">
            {selectedActions.length === 0 && (
              <p className="text-center text-sm text-gray-300 py-6">No actions. Click &quot;+ Add Action&quot; to create one.</p>
            )}
            {selectedActions.map((action) => (
              <div key={action._idx} className="p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex gap-3">
                  <input
                    value={action.label}
                    onChange={(e) => updateAction(action._idx, "label", e.target.value)}
                    placeholder="Action label"
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                  />
                  <select
                    value={action.time_group}
                    onChange={(e) => updateAction(action._idx, "time_group", e.target.value)}
                    className="w-28 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                  >
                    {timeGroups.map(tg => <option key={tg} value={tg}>{tg.charAt(0).toUpperCase() + tg.slice(1)}</option>)}
                  </select>
                </div>
                <textarea
                  value={Array.isArray(action.details) ? action.details.join("\n") : ""}
                  onChange={(e) => updateAction(action._idx, "details", e.target.value.split("\n"))}
                  placeholder="Details — one per line"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#20c858] outline-none resize-y text-gray-900 leading-relaxed min-h-[100px]"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`relative w-9 h-5 rounded-full transition-colors ${action.priority ? "bg-[#20c858]" : "bg-gray-300"}`}>
                      <input type="checkbox" checked={action.priority} onChange={(e) => updateAction(action._idx, "priority", e.target.checked)} className="sr-only" />
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${action.priority ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-xs text-gray-500">Priority</span>
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
    </div>
  );
}
