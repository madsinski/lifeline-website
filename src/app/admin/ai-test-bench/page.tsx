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

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    const all: ActionRow[] = [];
    const PAGE = 1000;
    let from = 0;
    while (from < 20000) {
      const { data } = await supabase
        .from("program_actions")
        .select("id, action_key, label, category, intensity, min_recovery_state, appropriate_modes, equipment_needed, is_keystone, audited_at")
        .not("audited_at", "is", null)
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
    if (guard.authorized) loadCatalog();
  }, [guard.authorized, loadCatalog]);

  // Sample candidates: pillar filter + dedupe by action_key + cap at
  // 60 to keep the prompt size sane. Real production callers will pass
  // the user's actual day-plan set, which is similarly bounded.
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: ActionRow[] = [];
    for (const a of allActions) {
      if (pillarFocus !== "all" && a.category !== pillarFocus) continue;
      if (seen.has(a.action_key)) continue;
      seen.add(a.action_key);
      out.push(a);
      if (out.length >= 60) break;
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
        candidate_actions: determFiltered.map((a) => ({
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
