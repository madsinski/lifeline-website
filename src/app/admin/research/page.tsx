"use client";

// Research module — cohorts, longitudinal Medalia exports, trends, AI analysis.
// Backend: /api/admin/research/* . Schema: supabase/migration-research-data-schema.sql

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const TIMEPOINTS = ["baseline", "3mo", "6mo", "9mo", "12mo"] as const;

interface CohortSummary {
  id: string; name: string; slug: string; pathway: string | null;
  patient_count: number; timepoints: string[];
  exports: { timepoint_label: string; export_type: string; exported_at: string | null; patient_count: number }[];
}
interface TrendPoint { timepoint_label: string; timepoint_order: number; n: number; n_missing: number; mean: number | null; }
interface Movement {
  feature: string; display: string | null; unit: string | null; obs_type: string;
  baseline_label: string; latest_label: string; baseline_mean: number | null; latest_mean: number | null;
  delta: number | null; pct_change: number | null; effect_size: number | null; n_baseline: number; n_latest: number;
}
interface Completeness { feature: string; obs_type: string; n: number; n_missing: number; pct_missing: number; }
interface CohortDetail {
  cohort: { id: string; name: string; pathway: string | null };
  exports: { id: string; timepoint_label: string; export_type: string; exported_at: string | null; patient_count: number; observation_count: number; answer_count: number }[];
  demographics: { n: number; genders: Record<string, number>; groups: Record<string, number>; age: { min: number; median: number; max: number } | null };
  series: { feature: string; obs_type: string; display: string | null; unit: string | null; points: TrendPoint[] }[];
  movements: Movement[];
  completeness: Completeness[];
  aiAnalyses: { id: string; model: string | null; summary_md: string; created_at: string }[];
}

async function authedFetch(url: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
}

export default function ResearchPage() {
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [detail, setDetail] = useState<CohortDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // upload form
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<{ patientCount: number; pathway: string | null } | null>(null);
  const [targetCohort, setTargetCohort] = useState<string>("new");
  const [newCohortName, setNewCohortName] = useState("");
  const [timepoint, setTimepoint] = useState<string>("baseline");
  const [exportType, setExportType] = useState<"full" | "no_bloods">("full");
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const loadCohorts = useCallback(async () => {
    const res = await authedFetch("/api/admin/research/cohorts");
    const j = await res.json().catch(() => ({}));
    setCohorts(j.cohorts || []);
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    const res = await authedFetch(`/api/admin/research/cohort?id=${id}`);
    const j = await res.json().catch(() => ({}));
    if (j.cohort) setDetail(j as CohortDetail);
    else setMsg(j.error || "Failed to load cohort");
  }, []);

  // loadCohorts sets state only after its await; disable the synchronous-setState heuristic.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadCohorts(); }, [loadCohorts]);

  async function onFile(f: File | null) {
    setFile(f); setFilePreview(null);
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      setFilePreview({ patientCount: Array.isArray(json.patients) ? json.patients.length : 0, pathway: json.pathway || null });
    } catch { setMsg("Could not parse JSON file"); }
  }

  async function submitUpload() {
    if (!file) { setMsg("Choose a JSON export first"); return; }
    if (targetCohort === "new" && !newCohortName.trim()) { setMsg("Name the new cohort"); return; }
    setUploading(true); setMsg(null);
    try {
      const json = JSON.parse(await file.text());
      const body: Record<string, unknown> = { json, timepointLabel: timepoint, exportType, filename: file.name };
      if (targetCohort === "new") body.cohortName = newCohortName.trim();
      else body.cohortId = targetCohort;
      const res = await authedFetch("/api/admin/research/ingest", { method: "POST", body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(j.detail || j.error || "Ingest failed"); }
      else {
        const r = j.reconciliation;
        setMsg(`Imported ${r.patients} patients - ${r.total} values (${r.scores} scores, ${r.labs} labs, ${r.measurements} measurements, ${r.answers} answers). ${r.balanced ? "Reconciled OK." : "Count mismatch!"}`);
        setFile(null); setFilePreview(null); setNewCohortName("");
        await loadCohorts();
        await loadDetail(j.cohortId);
        if (targetCohort === "new") setTargetCohort(j.cohortId);
      }
    } catch (e) { setMsg(e instanceof Error ? e.message : "Upload error"); }
    setUploading(false);
  }

  async function runAI() {
    if (!selectedId) return;
    setAiBusy(true); setMsg(null);
    const res = await authedFetch("/api/admin/research/analyze", { method: "POST", body: JSON.stringify({ cohortId: selectedId }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(j.detail || j.error || "AI analysis failed");
    else await loadDetail(selectedId);
    setAiBusy(false);
  }

  async function deleteCohort(id: string) {
    if (!confirm("Delete this cohort and all its exports?")) return;
    const res = await authedFetch(`/api/admin/research/cohorts?id=${id}`, { method: "DELETE" });
    if (res.ok) { setDetail(null); setSelectedId(null); await loadCohorts(); }
  }

  async function downloadCsv(sheet: string) {
    if (!selectedId) return;
    setMsg(null);
    const res = await authedFetch(`/api/admin/research/export?cohortId=${selectedId}&sheet=${sheet}`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.detail || j.error || "Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${detail?.cohort.name || "cohort"}_${sheet}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Research</h1>
        <p className="text-gray-500 text-sm">Cohorts, longitudinal data exports, trends, and AI analysis.</p>
      </header>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm px-4 py-3">{msg}</div>
      )}

      {/* Upload */}
      <section className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Import data export</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Medalia JSON export</label>
            <input type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white hover:file:bg-emerald-700" />
            {filePreview && <p className="text-xs text-gray-500 mt-1">{filePreview.patientCount} patients{filePreview.pathway ? ` - ${filePreview.pathway}` : ""}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cohort</label>
              <select value={targetCohort} onChange={(e) => setTargetCohort(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="new">+ New cohort</option>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {targetCohort === "new" && (
                <input value={newCohortName} onChange={(e) => setNewCohortName(e.target.value)} placeholder="Cohort name"
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Timepoint</label>
              <select value={timepoint} onChange={(e) => setTimepoint(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                {TIMEPOINTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={exportType} onChange={(e) => setExportType(e.target.value as "full" | "no_bloods")} className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="full">Full (incl. bloods)</option>
                <option value="no_bloods">No bloods (quarterly)</option>
              </select>
            </div>
          </div>
        </div>
        <button onClick={submitUpload} disabled={uploading || !file}
          className="rounded-lg bg-emerald-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
          {uploading ? "Importing..." : "Import export"}
        </button>
      </section>

      {/* Cohort list */}
      <section className="space-y-3">
        <h2 className="font-semibold text-gray-900">Cohorts {loading && <span className="text-xs text-gray-400">loading...</span>}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cohorts.map((c) => (
            <button key={c.id} onClick={() => loadDetail(c.id)}
              className={`text-left rounded-xl border p-4 transition ${selectedId === c.id ? "border-emerald-400 bg-emerald-50" : "border-gray-100 bg-white hover:border-gray-200"}`}>
              <div className="font-medium text-gray-900">{c.name}</div>
              <div className="text-xs text-gray-500 mt-1">{c.patient_count} patients - {c.timepoints.length} timepoint(s)</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {c.timepoints.map((t) => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t}</span>)}
              </div>
            </button>
          ))}
          {!cohorts.length && !loading && <p className="text-sm text-gray-400">No cohorts yet. Import an export to begin.</p>}
        </div>
      </section>

      {/* Detail */}
      {detail && <CohortDashboard detail={detail} onAI={runAI} aiBusy={aiBusy} onDelete={() => deleteCohort(detail.cohort.id)} onDownload={downloadCsv} />}
    </div>
  );
}

function CohortDashboard({ detail, onAI, aiBusy, onDelete, onDownload }: {
  detail: CohortDetail; onAI: () => void; aiBusy: boolean; onDelete: () => void; onDownload: (s: string) => void;
}) {
  const d = detail.demographics;
  const topMovers = detail.movements.filter((m) => m.effect_size !== null).slice(0, 12);
  return (
    <section className="rounded-2xl bg-white shadow-sm border border-gray-100 p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{detail.cohort.name}</h2>
          {detail.cohort.pathway && <p className="text-sm text-gray-500">{detail.cohort.pathway}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onDownload("long")} className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">CSV long</button>
          <button onClick={() => onDownload("wide")} className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">CSV wide</button>
          <button onClick={() => onDownload("answers")} className="text-xs rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">CSV answers</button>
          <button onClick={onDelete} className="text-xs rounded-lg border border-red-200 text-red-600 px-3 py-1.5 hover:bg-red-50">Delete</button>
        </div>
      </div>

      {/* demographics + timepoints */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-gray-50 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Demographics</div>
          <div className="text-sm text-gray-800">{d.n} patients{d.age ? ` - age ${d.age.min}-${d.age.max} (median ${d.age.median})` : ""}</div>
          <div className="text-xs text-gray-600 mt-1">{Object.entries(d.genders).map(([k, v]) => `${v} ${k}`).join(", ")}</div>
          {Object.keys(d.groups).length > 1 && (
            <div className="text-xs text-gray-600 mt-1">Groups: {Object.entries(d.groups).map(([k, v]) => `${k} (${v})`).join(", ")}</div>
          )}
        </div>
        <div className="rounded-xl bg-gray-50 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">Timepoints</div>
          <div className="flex flex-wrap gap-2">
            {detail.exports.map((e) => (
              <span key={e.timepoint_label} className="text-xs rounded-lg bg-white border border-gray-200 px-2 py-1">
                {e.timepoint_label} - {e.patient_count}p - {e.export_type === "no_bloods" ? "no bloods" : "full"}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* top movers */}
      <div>
        <div className="text-xs font-medium text-gray-500 mb-2">Top movers (baseline to latest)</div>
        {topMovers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-400">
                <th className="py-1 pr-4">Feature</th><th className="py-1 pr-4">Baseline</th><th className="py-1 pr-4">Latest</th>
                <th className="py-1 pr-4">Delta</th><th className="py-1 pr-4">% change</th><th className="py-1 pr-4">Effect size</th>
              </tr></thead>
              <tbody>
                {topMovers.map((m) => (
                  <tr key={m.feature} className="border-t border-gray-50">
                    <td className="py-1 pr-4 text-gray-800">{m.feature}</td>
                    <td className="py-1 pr-4 text-gray-600">{m.baseline_mean ?? "-"}</td>
                    <td className="py-1 pr-4 text-gray-600">{m.latest_mean ?? "-"}</td>
                    <td className={`py-1 pr-4 ${(m.delta ?? 0) > 0 ? "text-emerald-600" : (m.delta ?? 0) < 0 ? "text-red-600" : "text-gray-500"}`}>{m.delta ?? "-"}</td>
                    <td className="py-1 pr-4 text-gray-600">{m.pct_change !== null ? `${m.pct_change}%` : "-"}</td>
                    <td className="py-1 pr-4 font-medium text-gray-800">{m.effect_size ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-gray-400">Needs at least two timepoints to compute movement.</p>}
      </div>

      {/* completeness */}
      <div>
        <div className="text-xs font-medium text-gray-500 mb-2">Completeness at latest timepoint</div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          {detail.completeness.filter((c) => c.pct_missing > 0).slice(0, 16).map((c) => (
            <div key={c.feature} className="flex items-center gap-2 text-xs">
              <span className="w-40 truncate text-gray-700">{c.feature}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full ${c.pct_missing >= 50 ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${c.pct_missing}%` }} />
              </div>
              <span className={c.pct_missing >= 50 ? "text-red-600" : "text-gray-500"}>{c.pct_missing}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI */}
      <div className="rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-900">AI trend analysis</div>
          <button onClick={onAI} disabled={aiBusy}
            className="text-xs rounded-lg bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50">
            {aiBusy ? "Analyzing..." : "Analyze with AI"}
          </button>
        </div>
        {detail.aiAnalyses.length ? (
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{detail.aiAnalyses[0].summary_md}</div>
        ) : <p className="text-xs text-gray-400">No analysis yet. Aggregate stats only are sent to the model - no per-patient data.</p>}
      </div>
    </section>
  );
}
