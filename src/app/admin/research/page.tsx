"use client";

// Research module — cohorts, longitudinal Medalia exports, trends, AI analysis.
// Backend: /api/admin/research/* . Schema: supabase/migration-research-data-schema.sql

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DOMAIN_LABELS, DOMAIN_ORDER, referenceNote, canonicalUnit, changeIsGood, type Domain } from "@/lib/research/clinical";

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
interface Flag { key: string; label: string; domain: Domain; hits: number; eligible: number; pct: number; }
interface Series { feature: string; obs_type: string; display: string | null; unit: string | null; domain: Domain; points: TrendPoint[]; }
interface CohortDetail {
  cohort: { id: string; name: string; pathway: string | null };
  exports: { id: string; timepoint_label: string; export_type: string; exported_at: string | null; patient_count: number; observation_count: number; answer_count: number }[];
  demographics: { n: number; genders: Record<string, number>; groups: Record<string, number>; age: { min: number; median: number; max: number } | null };
  series: Series[];
  flags: Flag[];
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
    if (!confirm("Delete this cohort and ALL its timepoints?")) return;
    const res = await authedFetch(`/api/admin/research/cohorts?id=${id}`, { method: "DELETE" });
    if (res.ok) { setDetail(null); setSelectedId(null); await loadCohorts(); }
  }

  async function deleteTimepoint(exportId: string, label: string) {
    if (!confirm(`Delete the "${label}" timepoint? This removes that upload only; other timepoints stay.`)) return;
    const res = await authedFetch(`/api/admin/research/timepoint?id=${exportId}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(j.detail || j.error || "Delete failed"); return; }
    setMsg(`Deleted timepoint "${label}".`);
    await loadCohorts();
    if (selectedId) await loadDetail(selectedId);
  }

  async function downloadFile(sheet: string) {
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
    const ext = sheet === "excel" ? "xlsx" : "csv";
    a.href = url;
    a.download = `${detail?.cohort.name || "cohort"}_${sheet === "excel" ? "research" : sheet}.${ext}`;
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
      {detail && <CohortDashboard detail={detail} onAI={runAI} aiBusy={aiBusy} onDelete={() => deleteCohort(detail.cohort.id)} onDownload={downloadFile} onDeleteTimepoint={deleteTimepoint} />}
    </div>
  );
}

function flagTone(pct: number) {
  if (pct >= 50) return { bar: "bg-red-500", text: "text-red-700", chip: "bg-red-50" };
  if (pct >= 25) return { bar: "bg-amber-500", text: "text-amber-700", chip: "bg-amber-50" };
  if (pct > 0) return { bar: "bg-yellow-400", text: "text-yellow-700", chip: "bg-yellow-50" };
  return { bar: "bg-emerald-500", text: "text-emerald-700", chip: "bg-emerald-50" };
}

// Colour a delta by whether it is an improvement for THIS feature (direction-aware),
// not merely by its sign — lower BP/HbA1c is good, higher HDL/sleep is good.
function deltaTone(feature: string, delta: number | null): string {
  const good = changeIsGood(feature, delta);
  if (good === null) return "text-gray-500";
  return good ? "text-emerald-600" : "text-red-600";
}
function deltaTitle(feature: string, delta: number | null): string {
  const good = changeIsGood(feature, delta);
  return good === null ? "" : good ? "improvement" : "worsening";
}

type TabKey = "overview" | "domains" | "longitudinal" | "ai" | "data";

function CohortDashboard({ detail, onAI, aiBusy, onDelete, onDownload, onDeleteTimepoint }: {
  detail: CohortDetail; onAI: () => void; aiBusy: boolean; onDelete: () => void; onDownload: (s: string) => void;
  onDeleteTimepoint: (exportId: string, label: string) => void;
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const d = detail.demographics;
  const multiTimepoint = detail.exports.length > 1;
  const moveByFeature = new Map(detail.movements.map((m) => [m.feature, m]));
  const seriesByDomain = (dom: Domain) => detail.series.filter((s) => s.domain === dom);
  const latestMean = (s: Series) => s.points[s.points.length - 1]?.mean ?? null;
  const latestN = (s: Series) => s.points[s.points.length - 1]?.n ?? 0;

  const tabs: { k: TabKey; label: string }[] = [
    { k: "overview", label: "Clinical overview" },
    { k: "domains", label: "By domain" },
    { k: "longitudinal", label: "Longitudinal" },
    { k: "ai", label: "AI analysis" },
    { k: "data", label: "Data & export" },
  ];

  return (
    <section className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      {/* header */}
      <div className="flex items-start justify-between p-6 pb-0">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{detail.cohort.name}</h2>
          <p className="text-sm text-gray-500">
            {d.n} patients{d.age ? ` · age ${d.age.min}-${d.age.max} (median ${d.age.median})` : ""} · {Object.entries(d.genders).map(([k, v]) => `${v} ${k}`).join(", ")}
            {Object.keys(d.groups).length > 1 ? ` · ${Object.entries(d.groups).map(([k, v]) => `${k.split(" - ")[0]} (${v})`).join(", ")}` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {detail.exports.map((e) => (
              <span key={e.timepoint_label} className="group inline-flex items-center gap-1 text-[11px] rounded-full bg-gray-100 text-gray-600 pl-2 pr-1 py-0.5">
                {e.timepoint_label} · {e.patient_count}p · {e.export_type === "no_bloods" ? "no bloods" : "full"}
                <button onClick={() => onDeleteTimepoint(e.id, e.timepoint_label)}
                  title={`Delete ${e.timepoint_label} timepoint`}
                  className="ml-0.5 w-4 h-4 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 leading-none">×</button>
              </span>
            ))}
          </div>
        </div>
        <button onClick={onDelete} className="text-xs rounded-lg border border-red-200 text-red-600 px-3 py-1.5 hover:bg-red-50">Delete</button>
      </div>

      {/* tabs */}
      <div className="flex gap-1 px-6 mt-4 border-b border-gray-100">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`text-sm px-3 py-2 -mb-px border-b-2 ${tab === t.k ? "border-emerald-500 text-gray-900 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* ---------- CLINICAL OVERVIEW ---------- */}
        {tab === "overview" && (
          <div className="space-y-5">
            <p className="text-xs text-gray-500">Share of patients crossing each clinical threshold at the latest timepoint. Denominators vary — conditional screeners are only asked of some patients.</p>
            {DOMAIN_ORDER.filter((dom) => detail.flags.some((f) => f.domain === dom)).map((dom) => (
              <div key={dom}>
                <div className="text-xs font-semibold text-gray-700 mb-2">{DOMAIN_LABELS[dom]}</div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  {detail.flags.filter((f) => f.domain === dom).map((f) => {
                    const tone = flagTone(f.pct);
                    return (
                      <div key={f.key} className="flex items-center gap-3 text-xs">
                        <span className="flex-1 text-gray-700">{f.label}</span>
                        <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full ${tone.bar}`} style={{ width: `${f.pct}%` }} />
                        </div>
                        <span className={`w-20 text-right font-medium ${tone.text}`}>{f.pct}% ({f.hits}/{f.eligible})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!detail.flags.length && <p className="text-sm text-gray-400">No flag-eligible data yet.</p>}
          </div>
        )}

        {/* ---------- BY DOMAIN ---------- */}
        {tab === "domains" && (
          <div className="space-y-5">
            {DOMAIN_ORDER.filter((dom) => seriesByDomain(dom).length).map((dom) => (
              <div key={dom}>
                <div className="text-xs font-semibold text-gray-700 mb-2">{DOMAIN_LABELS[dom]}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[11px] text-gray-400">
                      <th className="py-1 pr-4">Feature</th><th className="py-1 pr-4">Mean</th><th className="py-1 pr-4">n</th>
                      <th className="py-1 pr-4">Reference range</th>{multiTimepoint && <th className="py-1 pr-4">Δ baseline→latest</th>}
                    </tr></thead>
                    <tbody>
                      {seriesByDomain(dom).map((s) => {
                        const mv = moveByFeature.get(s.feature);
                        const unit = canonicalUnit(s.feature, s.unit);
                        return (
                          <tr key={s.feature} className="border-t border-gray-50">
                            <td className="py-1 pr-4 text-gray-800">{s.feature}{unit ? <span className="text-gray-400"> ({unit})</span> : null}</td>
                            <td className="py-1 pr-4 text-gray-700">{latestMean(s) ?? "-"}</td>
                            <td className="py-1 pr-4 text-gray-500">{latestN(s)}</td>
                            <td className="py-1 pr-4 text-[11px] text-gray-400">{referenceNote(s.feature)}</td>
                            {multiTimepoint && (
                              <td className={`py-1 pr-4 ${deltaTone(s.feature, mv?.delta ?? null)}`} title={deltaTitle(s.feature, mv?.delta ?? null)}>
                                {mv?.delta != null ? `${mv.delta > 0 ? "+" : ""}${mv.delta}${mv.effect_size != null ? ` (d=${mv.effect_size})` : ""}` : "-"}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ---------- LONGITUDINAL ---------- */}
        {tab === "longitudinal" && (
          <div className="space-y-3">
            {!multiTimepoint && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
                Only a baseline timepoint so far. Upload a follow-up dataset (3mo / 6mo …) to unlock trend movement and effect sizes.
              </div>
            )}
            <div className="text-xs font-medium text-gray-500">Top movers (baseline → latest, ranked by effect size)</div>
            {detail.movements.filter((m) => m.effect_size !== null).length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-400">
                    <th className="py-1 pr-4">Feature</th><th className="py-1 pr-4">Baseline</th><th className="py-1 pr-4">Latest</th>
                    <th className="py-1 pr-4">Δ</th><th className="py-1 pr-4">% change</th><th className="py-1 pr-4">Effect size (d)</th><th className="py-1 pr-4">Direction</th>
                  </tr></thead>
                  <tbody>
                    {detail.movements.filter((m) => m.effect_size !== null).slice(0, 20).map((m) => {
                      const good = changeIsGood(m.feature, m.delta);
                      return (
                        <tr key={m.feature} className="border-t border-gray-50">
                          <td className="py-1 pr-4 text-gray-800">{m.feature}</td>
                          <td className="py-1 pr-4 text-gray-600">{m.baseline_mean ?? "-"}</td>
                          <td className="py-1 pr-4 text-gray-600">{m.latest_mean ?? "-"}</td>
                          <td className={`py-1 pr-4 ${deltaTone(m.feature, m.delta)}`}>{m.delta != null ? `${m.delta > 0 ? "+" : ""}${m.delta}` : "-"}</td>
                          <td className="py-1 pr-4 text-gray-600">{m.pct_change !== null ? `${m.pct_change}%` : "-"}</td>
                          <td className="py-1 pr-4 font-medium text-gray-800">{m.effect_size ?? "-"}</td>
                          <td className={`py-1 pr-4 text-xs ${deltaTone(m.feature, m.delta)}`}>{good === null ? "—" : good ? "improved" : "worsened"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-xs text-gray-400">No movement yet — needs at least two timepoints.</p>}
          </div>
        )}

        {/* ---------- AI ---------- */}
        {tab === "ai" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900">AI trend analysis</div>
              <button onClick={onAI} disabled={aiBusy}
                className="text-xs rounded-lg bg-gray-900 text-white px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50">
                {aiBusy ? "Analyzing..." : detail.aiAnalyses.length ? "Re-run analysis" : "Analyze with AI"}
              </button>
            </div>
            {detail.aiAnalyses.length ? (
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{detail.aiAnalyses[0].summary_md}</div>
            ) : <p className="text-xs text-gray-400">No analysis yet. Aggregate stats only are sent to the model — no per-patient data leaves the database.</p>}
          </div>
        )}

        {/* ---------- DATA & EXPORT ---------- */}
        {tab === "data" && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onDownload("excel")} className="text-sm rounded-lg bg-emerald-600 text-white px-4 py-2 font-medium hover:bg-emerald-700">Download Excel (.xlsx)</button>
              <button onClick={() => onDownload("long")} className="text-sm rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">CSV (long)</button>
              <button onClick={() => onDownload("answers")} className="text-sm rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">CSV (answers)</button>
            </div>
            <p className="text-xs text-gray-500">Excel has 4 sheets — Wide (units in headers, missing data flagged red), Long, Answers, Dictionary.</p>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">Completeness at latest timepoint (worst first)</div>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                {detail.completeness.filter((c) => c.pct_missing > 0).slice(0, 20).map((c) => (
                  <div key={c.feature} className="flex items-center gap-2 text-xs">
                    <span className="w-44 truncate text-gray-700">{c.feature}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full ${c.pct_missing >= 50 ? "bg-red-500" : "bg-amber-400"}`} style={{ width: `${c.pct_missing}%` }} />
                    </div>
                    <span className={c.pct_missing >= 50 ? "text-red-600" : "text-gray-500"}>{c.pct_missing}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
