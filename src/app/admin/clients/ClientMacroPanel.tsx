"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface MacroTarget {
  id: string;
  target_kcal: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  bmr: number;
  tdee_predicted: number;
  tdee_observed: number | null;
  weight_kg_snapshot: number;
  body_fat_pct_snapshot: number | null;
  activity_level_snapshot: string;
  goal_snapshot: string;
  method: string;
  calculated_at: string;
  next_recalc_at: string;
  calculated_by: string;
  notes: string | null;
}

interface WeightEntry {
  recorded_at: string;
  weight_kg: number;
  body_fat_pct: number | null;
}

interface ClientBody {
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_pct: number | null;
  activity_level: string | null;
  macro_goal: string | null;
}

const GOAL_LABELS: Record<string, string> = {
  fat_loss: "Fat loss",
  maintain: "Maintain",
  muscle_gain: "Muscle gain",
  recomp: "Recomposition",
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary",
  light: "Light",
  moderate: "Moderate",
  very_active: "Very active",
  extra_active: "Extra active",
};

export function ClientMacroPanel({ clientId }: { clientId: string }) {
  const [target, setTarget] = useState<MacroTarget | null>(null);
  const [body, setBody] = useState<ClientBody | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editKcal, setEditKcal] = useState(0);
  const [editProtein, setEditProtein] = useState(0);
  const [editCarbs, setEditCarbs] = useState(0);
  const [editFat, setEditFat] = useState(0);
  const [editNotes, setEditNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, bRes, wRes] = await Promise.all([
        supabase.from("macro_targets")
          .select("*")
          .eq("client_id", clientId)
          .eq("active", true)
          .order("calculated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("clients")
          .select("height_cm, weight_kg, body_fat_pct, muscle_mass_pct, activity_level, macro_goal")
          .eq("id", clientId)
          .maybeSingle(),
        supabase.from("weight_log")
          .select("recorded_at, weight_kg, body_fat_pct")
          .eq("client_id", clientId)
          .order("recorded_at", { ascending: false })
          .limit(20),
      ]);
      if (tRes.data) {
        const t = tRes.data as MacroTarget;
        setTarget(t);
        setEditKcal(t.target_kcal);
        setEditProtein(t.target_protein);
        setEditCarbs(t.target_carbs);
        setEditFat(t.target_fat);
        setEditNotes(t.notes || "");
      }
      if (bRes.data) setBody(bRes.data as ClientBody);
      if (wRes.data) setWeights(wRes.data as WeightEntry[]);
    } catch {}
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleSaveOverride = async () => {
    if (!target) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("macro_targets").update({ active: false }).eq("client_id", clientId).eq("active", true);
      await supabase.from("macro_targets").insert({
        client_id: clientId,
        target_kcal: editKcal,
        target_protein: editProtein,
        target_carbs: editCarbs,
        target_fat: editFat,
        bmr: target.bmr,
        tdee_predicted: target.tdee_predicted,
        tdee_observed: target.tdee_observed,
        weight_kg_snapshot: target.weight_kg_snapshot,
        body_fat_pct_snapshot: target.body_fat_pct_snapshot,
        activity_level_snapshot: target.activity_level_snapshot,
        goal_snapshot: target.goal_snapshot,
        method: target.method,
        next_recalc_at: target.next_recalc_at,
        calculated_by: 'coach',
        notes: editNotes || `Overridden by coach (${user?.email || 'unknown'})`,
        active: true,
      });
      await load();
      setEditMode(false);
    } catch (e) {
      alert(`Save failed: ${(e as Error).message}`);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-4">
        <p className="text-xs text-gray-400 py-2">Loading macros...</p>
      </div>
    );
  }

  const notSetUp = !target || !body?.height_cm;

  if (notSetUp) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-4">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Macro Tracking</h4>
        <p className="text-sm text-gray-500">Client has not completed macro setup.</p>
      </div>
    );
  }

  // Weight trend chart data (ascending order for display)
  const weightAsc = [...weights].reverse();
  const minW = Math.min(...weightAsc.map(w => Number(w.weight_kg)));
  const maxW = Math.max(...weightAsc.map(w => Number(w.weight_kg)));
  const range = Math.max(0.5, maxW - minW);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Macro Tracking</h4>
        {!editMode && (
          <button onClick={() => setEditMode(true)} className="text-[10px] font-medium text-blue-600 hover:text-blue-800">
            Override
          </button>
        )}
      </div>

      {/* Targets grid */}
      {!editMode ? (
        <div className="grid grid-cols-4 gap-2">
          <TargetCell label="kcal" value={target!.target_kcal} color="#10B981" />
          <TargetCell label="Protein" value={target!.target_protein} unit="g" color="#3B82F6" />
          <TargetCell label="Carbs" value={target!.target_carbs} unit="g" color="#F59E0B" />
          <TargetCell label="Fat" value={target!.target_fat} unit="g" color="#EF4444" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <EditCell label="kcal" value={editKcal} onChange={setEditKcal} color="#10B981" />
            <EditCell label="P (g)" value={editProtein} onChange={setEditProtein} color="#3B82F6" />
            <EditCell label="C (g)" value={editCarbs} onChange={setEditCarbs} color="#F59E0B" />
            <EditCell label="F (g)" value={editFat} onChange={setEditFat} color="#EF4444" />
          </div>
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Coach notes (why override?)"
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-300 outline-none resize-none"
          />
          <div className="flex gap-2">
            <button onClick={handleSaveOverride} disabled={saving}
              className="flex-1 py-2 text-xs font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {saving ? "Saving..." : "Save override"}
            </button>
            <button onClick={() => { setEditMode(false); if (target) { setEditKcal(target.target_kcal); setEditProtein(target.target_protein); setEditCarbs(target.target_carbs); setEditFat(target.target_fat); setEditNotes(target.notes || ""); } }}
              className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Meta grid */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
        <MetaCell label="Goal" value={GOAL_LABELS[target!.goal_snapshot] || target!.goal_snapshot} />
        <MetaCell label="Activity" value={ACTIVITY_LABELS[target!.activity_level_snapshot] || target!.activity_level_snapshot} />
        <MetaCell label="Method" value={target!.method === 'katch_mcardle' ? 'Katch-McArdle' : 'Mifflin'} />
        <MetaCell label="BMR" value={`${Math.round(target!.bmr)} kcal`} />
        <MetaCell label="TDEE pred." value={`${Math.round(target!.tdee_predicted)} kcal`} />
        <MetaCell label="TDEE obs." value={target!.tdee_observed ? `${Math.round(target!.tdee_observed)} kcal` : "—"} />
        <MetaCell label="Weight" value={`${Number(target!.weight_kg_snapshot).toFixed(1)} kg`} />
        <MetaCell label="Body fat" value={target!.body_fat_pct_snapshot ? `${target!.body_fat_pct_snapshot}%` : "—"} />
        <MetaCell label="Next recalc" value={new Date(target!.next_recalc_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} />
      </div>

      {/* Weight trend */}
      {weightAsc.length > 1 && (
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Weight trend</p>
            <p className="text-[10px] text-gray-400">Last {weightAsc.length} entries</p>
          </div>
          <div className="h-16 flex items-end gap-0.5 bg-gray-50 rounded-lg p-2">
            {weightAsc.map((w, i) => {
              const pct = ((Number(w.weight_kg) - minW) / range) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${w.recorded_at}: ${w.weight_kg} kg`}>
                  <div className="w-full bg-emerald-500 rounded-sm transition-all" style={{ height: `${Math.max(10, pct)}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{weightAsc[0].weight_kg.toFixed(1)} kg</span>
            <span>{weightAsc[weightAsc.length - 1].weight_kg.toFixed(1)} kg</span>
          </div>
        </div>
      )}

      {target!.notes && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-xs text-gray-600 italic">{target!.notes}</p>
        </div>
      )}
    </div>
  );
}

function TargetCell({ label, value, unit = "", color }: { label: string; value: number; unit?: string; color: string }) {
  return (
    <div className="text-center p-2 rounded-lg" style={{ backgroundColor: color + '10' }}>
      <p className="text-lg font-bold" style={{ color }}>{Math.round(value)}{unit}</p>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

function EditCell({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
  return (
    <div className="text-center p-2 rounded-lg" style={{ backgroundColor: color + '10' }}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-full text-lg font-bold text-center bg-transparent border-0 outline-none"
        style={{ color }}
      />
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs font-medium text-gray-700">{value}</p>
    </div>
  );
}
