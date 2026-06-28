"use client";

// Research module — cohorts, longitudinal Medalia exports, trends, AI analysis.
// Backend: /api/admin/research/* . Schema: supabase/migration-research-data-schema.sql

import { useCallback, useEffect, useState, Fragment, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { DOMAIN_LABELS, DOMAIN_GROUPS, referenceNote, canonicalUnit, changeIsGood, type Domain } from "@/lib/research/clinical";
import { sigStars } from "@/lib/research/stats";

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
  p?: number | null; q?: number | null; n_pairs?: number | null;
}
interface Completeness { feature: string; obs_type: string; n: number; n_missing: number; pct_missing: number; }
interface FlagTrendPoint { timepoint_label: string; order: number; pct: number; hits: number; eligible: number; }
interface Flag {
  key: string; label: string; domain: Domain; hits: number; eligible: number; pct: number;
  baseline_pct: number | null; delta_pct: number | null; trend: FlagTrendPoint[];
}
interface Series { feature: string; obs_type: string; display: string | null; unit: string | null; domain: Domain; points: TrendPoint[]; }
interface FeatureDetail {
  feature: string; unit: string | null; timepoints: string[];
  rows: { patient: string; gender: string | null; values: Record<string, number | string | boolean | null> }[];
}
interface DataQuality {
  excludedPatients: string[];
  excludedFeatures: string[];
  patients: { patient: string; gender: string | null; present: number; total: number; completenessPct: number; missing: string[]; excluded: boolean; suggested: boolean }[];
  features: { feature: string; present: number; total: number; missingPct: number; conditional?: boolean; excluded: boolean; suggested: boolean }[];
}
interface CohortDetail {
  cohort: { id: string; name: string; pathway: string | null };
  dataQuality?: DataQuality;
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

  const loadCohorts = useCallback(async (): Promise<CohortSummary[]> => {
    const res = await authedFetch("/api/admin/research/cohorts");
    const j = await res.json().catch(() => ({}));
    const list: CohortSummary[] = j.cohorts || [];
    setCohorts(list);
    setLoading(false);
    return list;
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    const res = await authedFetch(`/api/admin/research/cohort?id=${id}`);
    const j = await res.json().catch(() => ({}));
    if (j.cohort) setDetail(j as CohortDetail);
    else setMsg(j.error || "Failed to load cohort");
  }, []);

  // On mount: load the cohort list, then auto-open the most recent cohort
  // (the API returns them newest-first). State is only set after the await.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadCohorts().then((list) => { if (list.length) loadDetail(list[0].id); }); }, [loadCohorts, loadDetail]);

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

  async function saveExclusions(excludedPatients: string[], excludedFeatures: string[]) {
    if (!selectedId) return;
    setMsg(null);
    const res = await authedFetch("/api/admin/research/exclusions", {
      method: "POST",
      body: JSON.stringify({ cohortId: selectedId, excludedPatients, excludedFeatures }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(j.detail || j.error || "Could not save exclusions"); return; }
    setMsg(`Applied: ${excludedPatients.length} patient(s) and ${excludedFeatures.length} variable(s) excluded. Analysis recomputed.`);
    await loadDetail(selectedId);
  }

  async function loadFeature(feature: string): Promise<FeatureDetail | null> {
    if (!selectedId) return null;
    const res = await authedFetch(`/api/admin/research/feature?cohortId=${selectedId}&feature=${encodeURIComponent(feature)}`);
    if (!res.ok) return null;
    return res.json();
  }

  async function openEmployerReport() {
    if (!selectedId) return;
    setMsg(null);
    const res = await authedFetch(`/api/admin/research/employer-report?cohortId=${selectedId}`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMsg(j.detail || j.error || "Could not generate employer summary");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
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
      {detail && <CohortDashboard detail={detail} onAI={runAI} aiBusy={aiBusy} onDelete={() => deleteCohort(detail.cohort.id)} onDownload={downloadFile} onDeleteTimepoint={deleteTimepoint} onEmployerReport={openEmployerReport} onLoadFeature={loadFeature} onSaveExclusions={saveExclusions} />}
    </div>
  );
}

// "?" popover so the medical advisor can audit exactly how each figure is computed.
// Rendered in a portal to <body> with fixed positioning so it floats above the
// layout and never expands a table/overflow container (no stray scrollbars).
function InfoTip({ title, children }: { title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  function toggle(e: { currentTarget: HTMLElement }) {
    if (open) { setOpen(false); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const W = 320, estH = 230;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 12));
    const top = r.bottom + estH > window.innerHeight - 8 ? Math.max(8, r.top - estH - 6) : r.bottom + 6;
    setPos({ top, left });
    setOpen(true);
  }

  return (
    <span className="relative inline-block align-middle">
      <button type="button" onClick={toggle} aria-label="How this is calculated"
        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold leading-none hover:bg-gray-300">?</button>
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div role="tooltip" style={{ top: pos.top, left: pos.left, maxHeight: "calc(100vh - 1rem)" }}
            className="fixed z-[70] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl p-3 text-[11px] leading-relaxed text-gray-700 font-normal normal-case text-left">
            {title && <div className="font-semibold text-gray-900 mb-1">{title}</div>}
            {children}
          </div>
        </>,
        document.body,
      )}
    </span>
  );
}

// Method descriptions — kept in lock-step with the implementation so they can be validated.
const METHOD = {
  mean: (
    <>Cohort <b>mean</b> of the measured value at that timepoint; <b>n</b> = patients with a value.
    Median, SD, min and max use the same set. Sample SD = √(Σ(x−x̄)²/(n−1)).
    <span className="block mt-1 text-gray-400">src/lib/research/trends.ts</span></>
  ),
  delta: (
    <><b>Δ = latest mean − baseline mean</b>, in the metric’s own units. Coloured green when the change is in the
    beneficial direction for that specific metric (e.g. lower HbA1c/BP, higher HDL/sleep), red otherwise.
    Direction was set per metric and verified empirically.
    <span className="block mt-1 text-gray-400">computeMovements() · clinical.ts featureDirection()</span></>
  ),
  pctChange: <><b>% change = (latest − baseline) ÷ |baseline| × 100.</b></>,
  effect: (
    <><b>Standardised effect size</b> (Cohen’s-d style): d = (latest mean − baseline mean) ÷ pooled SD,
    pooled SD = √((SD_baseline² + SD_latest²)/2). Rule of thumb: |d| ≈ 0.2 small, 0.5 medium, 0.8 large.
    <span className="block mt-1 text-gray-400">trends.ts computeMovements()</span></>
  ),
  pq: (
    <><b>p</b> — paired two-sample <b>t-test</b> on each patient’s own change (same people at both timepoints):
    t = mean(d) ÷ (SD(d)/√n), df = n−1; two-tailed p from the Student-t distribution via the regularised
    incomplete beta function. n = paired patients.
    <span className="block mt-1"><b>q</b> — Benjamini–Hochberg false-discovery-rate adjustment across all features
    tested (controls for multiple comparisons). With small n and many measures, prefer q and effect size over raw p.</span>
    <span className="block mt-0.5">Stars: * p&lt;.05, ** p&lt;.01, *** p&lt;.001.</span>
    <span className="block mt-1 text-gray-400">src/lib/research/stats.ts (tTestP via incomplete beta, pairedTTest, benjaminiHochberg)</span></>
  ),
  flags: (
    <>Each bar = <b>share of patients whose value crosses the threshold</b> at that timepoint.
    Denominator = patients who have that measure (conditional screeners are asked of only some, so denominators vary).
    Baseline→latest shows the change in <b>percentage points (pp)</b>; green = fewer affected.
    Blood-test &amp; measurement flags use the <b>Lifeline reference ranges</b> (shared with the app — fhir-health-dashboard bloodMarkers.ts) and fire when a value leaves the optimal/green band: e.g. HbA1c ≥39, cholesterol ≥5.2, body fat M ≥20% / F ≥28%, BP ≥120. Validated instruments (PHQ-9 ≥10, GAD-7 ≥10, AUDIT-C) keep their standard cutoffs;
    the 0–10 lifestyle sub-scores use an internal &lt;6/10 “needs attention” mark.
    <span className="block mt-1"><b>Sex-specific cutoffs</b> are applied per patient where reference ranges differ — body fat (M ≥25% / F ≥32%), HDL (M &lt;1.0 / F &lt;1.3), AUDIT-C (M ≥4 / F ≥3) — so the aggregate is not skewed by the cohort’s sex mix.</span>
    <span className="block mt-1 text-gray-400">clinical.ts FLAGS · flagCrosses()</span></>
  ),
  completeness: (
    <><b>Missing %</b> = patients without a value for that measure ÷ patients at the latest timepoint × 100.
    High missingness on conditional screeners is by design (only asked when a parent screener triggers), not data loss.</>
  ),
} as const;

// Per-patient values behind one variable (UUID + value at each timepoint).
function FeatureDetailTable({ feature, state }: { feature: string; state: FeatureDetail | "loading" | "error" | undefined }) {
  if (state === undefined || state === "loading") return <div className="text-xs text-gray-400 py-2">Loading per-patient values…</div>;
  if (state === "error") return <div className="text-xs text-red-500 py-2">Could not load values.</div>;
  const unit = canonicalUnit(feature, state.unit);
  const fmt = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "boolean" ? (v ? "yes" : "no") : String(v));
  return (
    <div className="max-h-72 overflow-y-auto rounded border border-gray-100 bg-white">
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-gray-50">
          <tr className="text-left text-gray-400">
            <th className="py-1 px-2 font-medium w-8">#</th>
            <th className="py-1 px-2 font-medium">Patient UUID</th>
            <th className="py-1 px-2 font-medium">Sex</th>
            {state.timepoints.map((t) => <th key={t} className="py-1 px-2 font-medium">{t}{unit ? ` (${unit})` : ""}</th>)}
          </tr>
        </thead>
        <tbody>
          {state.rows.map((r, i) => (
            <tr key={r.patient} className="border-t border-gray-50">
              <td className="py-1 px-2 tabular-nums text-gray-400">{i + 1}</td>
              <td className="py-1 px-2 font-mono text-gray-600">{r.patient}</td>
              <td className="py-1 px-2 text-gray-500">{r.gender || "—"}</td>
              {state.timepoints.map((t) => <td key={t} className="py-1 px-2 tabular-nums text-gray-700">{fmt(r.values[t])}</td>)}
            </tr>
          ))}
          {!state.rows.length && <tr><td className="py-2 px-2 text-gray-400" colSpan={3 + state.timepoints.length}>No values recorded.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// Review & select which patients (rows) and variables (columns) to include/exclude.
function DataQualityPanel({ dq, onSave }: { dq: DataQuality | undefined; onSave: (p: string[], f: string[]) => Promise<void> }) {
  const [exP, setExP] = useState<Set<string>>(new Set(dq?.excludedPatients ?? []));
  const [exF, setExF] = useState<Set<string>>(new Set(dq?.excludedFeatures ?? []));
  const [saving, setSaving] = useState(false);
  const [openP, setOpenP] = useState<string | null>(null);
  if (!dq) return <p className="text-sm text-gray-400">No data-quality information yet.</p>;
  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set); if (n.has(key)) n.delete(key); else n.add(key); setter(n);
  };
  const useSuggested = () => {
    setExP(new Set([...exP, ...dq.patients.filter((p) => p.suggested).map((p) => p.patient)]));
    setExF(new Set([...exF, ...dq.features.filter((f) => f.suggested).map((f) => f.feature)]));
  };
  const dirty = JSON.stringify([...exP].sort()) !== JSON.stringify([...dq.excludedPatients].sort())
    || JSON.stringify([...exF].sort()) !== JSON.stringify([...dq.excludedFeatures].sort());
  const apply = async () => { setSaving(true); await onSave([...exP], [...exF]); setSaving(false); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-500 max-w-2xl">
          Review and choose which <b>patients (rows)</b> and <b>variables (columns)</b> are included in the analysis. Excluded items are removed from all trends, flags, significance and exports. Suggested exclusions (⚠) flag near-empty patients (&lt;50% complete) and sparse variables (over half of patients missing a value). <b>Conditional</b> questionnaires (e.g. the full AUDIT-10 / CIUS-14, only asked when the short screen is positive) are tagged and <b>not</b> suggested — their missingness is by design; use the unified 0–10 score for whole-cohort analysis.
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={useSuggested} className="text-xs rounded-lg border border-amber-300 text-amber-700 px-3 py-1.5 hover:bg-amber-50">Select suggested</button>
          <button onClick={apply} disabled={saving || !dirty} className="text-xs rounded-lg bg-emerald-600 text-white px-4 py-1.5 font-medium hover:bg-emerald-700 disabled:opacity-50">{saving ? "Applying…" : "Apply exclusions"}</button>
        </div>
      </div>
      <div className="text-[11px] text-gray-500">{exP.size} patient(s) and {exF.size} variable(s) marked for exclusion{dirty ? " (unsaved)" : ""}.</div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* patients */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-2">Patients (rows) — completeness at latest timepoint</div>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-100">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-gray-50"><tr className="text-left text-gray-400">
                <th className="py-1 px-2 font-medium">Exclude</th><th className="py-1 px-2 font-medium">Patient UUID</th><th className="py-1 px-2 font-medium">Complete</th>
              </tr></thead>
              <tbody>
                {dq.patients.map((p) => (
                  <Fragment key={p.patient}>
                    <tr className={`border-t border-gray-50 ${exP.has(p.patient) ? "bg-red-50" : p.suggested ? "bg-amber-50" : ""}`}>
                      <td className="py-1 px-2"><input type="checkbox" checked={exP.has(p.patient)} onChange={() => toggle(exP, p.patient, setExP)} /></td>
                      <td className="py-1 px-2 font-mono text-gray-600">
                        <button type="button" onClick={() => setOpenP(openP === p.patient ? null : p.patient)} className="inline-flex items-center gap-1 hover:text-emerald-700" title="Show which variables are missing">
                          <span className="w-3 text-gray-400">{openP === p.patient ? "▾" : "▸"}</span>{p.patient}
                        </button>
                        {p.suggested && <span className="ml-1 text-amber-600" title="Near-empty — suggested for exclusion">⚠</span>}
                      </td>
                      <td className={`py-1 px-2 tabular-nums ${p.completenessPct < 50 ? "text-red-600" : "text-gray-600"}`}>{p.completenessPct}% ({p.present}/{p.total})</td>
                    </tr>
                    {openP === p.patient && (
                      <tr className="bg-gray-50/60">
                        <td colSpan={3} className="px-3 py-2">
                          {p.missing.length === 0
                            ? <span className="text-[11px] text-emerald-700">All variables present.</span>
                            : (
                              <div>
                                <div className="text-[10px] text-gray-500 mb-1">{p.missing.length} missing variable(s) — click one to exclude that column for the whole cohort:</div>
                                <div className="flex flex-wrap gap-1">
                                  {p.missing.map((f) => (
                                    <button key={f} type="button" onClick={() => toggle(exF, f, setExF)}
                                      title="Toggle exclusion of this variable"
                                      className={`text-[10px] rounded px-1.5 py-0.5 border ${exF.has(f) ? "bg-red-100 border-red-300 text-red-700 line-through" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                                      {f}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* features */}
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-2">Variables (columns) — missingness at latest timepoint</div>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-100">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-gray-50"><tr className="text-left text-gray-400">
                <th className="py-1 px-2 font-medium">Exclude</th><th className="py-1 px-2 font-medium">Variable</th><th className="py-1 px-2 font-medium">Missing</th>
              </tr></thead>
              <tbody>
                {dq.features.map((f) => (
                  <tr key={f.feature} className={`border-t border-gray-50 ${exF.has(f.feature) ? "bg-red-50" : f.suggested ? "bg-amber-50" : ""}`}>
                    <td className="py-1 px-2"><input type="checkbox" checked={exF.has(f.feature)} onChange={() => toggle(exF, f.feature, setExF)} /></td>
                    <td className="py-1 px-2 text-gray-700">
                      {f.feature}
                      {f.suggested && <span className="ml-1 text-amber-600" title="Mostly missing — suggested for exclusion">⚠</span>}
                      {f.conditional && <span className="ml-1 text-[9px] uppercase tracking-wide text-sky-600 bg-sky-50 rounded px-1 py-0.5" title="Conditional questionnaire: only administered when the screen is positive — missing means screened negative, not data loss. Use the unified 0–10 score for whole-cohort analysis.">conditional</span>}
                    </td>
                    <td className={`py-1 px-2 tabular-nums ${f.missingPct > 50 && !f.conditional ? "text-red-600" : "text-gray-600"}`}>{f.missingPct}% ({f.total - f.present}/{f.total})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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

type TabKey = "overview" | "domains" | "longitudinal" | "ai" | "quality" | "data";

function CohortDashboard({ detail, onAI, aiBusy, onDelete, onDownload, onDeleteTimepoint, onEmployerReport, onLoadFeature, onSaveExclusions }: {
  detail: CohortDetail; onAI: () => void; aiBusy: boolean; onDelete: () => void; onDownload: (s: string) => void;
  onDeleteTimepoint: (exportId: string, label: string) => void; onEmployerReport: () => void;
  onLoadFeature: (feature: string) => Promise<FeatureDetail | null>;
  onSaveExclusions: (excludedPatients: string[], excludedFeatures: string[]) => Promise<void>;
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [featCache, setFeatCache] = useState<Record<string, FeatureDetail | "loading" | "error">>({});

  async function toggleFeature(feature: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(feature)) next.delete(feature); else next.add(feature);
      return next;
    });
    if (!featCache[feature]) {
      setFeatCache((c) => ({ ...c, [feature]: "loading" }));
      const data = await onLoadFeature(feature);
      setFeatCache((c) => ({ ...c, [feature]: data ?? "error" }));
    }
  }
  const d = detail.demographics;
  const multiTimepoint = detail.exports.length > 1;
  const moveByFeature = new Map(detail.movements.map((m) => [m.feature, m]));
  // lífstílseinkunn is shown separately as the foundations summary, so keep it out of the domain tables.
  const SUMMARY = "lifstilseinkunn";
  const summarySeries = detail.series.find((s) => s.feature === SUMMARY);
  const summaryMv = moveByFeature.get(SUMMARY);
  const seriesByDomain = (dom: Domain) => detail.series.filter((s) => s.domain === dom && s.feature !== SUMMARY);
  const latestMean = (s: Series) => s.points[s.points.length - 1]?.mean ?? null;
  const latestN = (s: Series) => s.points[s.points.length - 1]?.n ?? 0;

  const tabs: { k: TabKey; label: string }[] = [
    { k: "overview", label: "Clinical overview" },
    { k: "domains", label: "By domain" },
    { k: "longitudinal", label: "Longitudinal" },
    { k: "ai", label: "AI analysis" },
    { k: "quality", label: "Data quality" },
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
          <div className="flex flex-wrap gap-2 mt-3">
            {detail.exports.map((e) => (
              <span key={e.timepoint_label} className="inline-flex items-center gap-1.5 text-xs rounded-lg bg-white border border-gray-200 shadow-sm pl-3 pr-1.5 py-1.5 text-gray-700">
                <span className="font-semibold text-gray-900">{e.timepoint_label}</span>
                <span className="text-gray-300">·</span>
                <span className="tabular-nums">{e.patient_count}p</span>
                <span className="text-gray-300">·</span>
                <span className={e.export_type === "no_bloods" ? "text-amber-600" : "text-emerald-600"}>{e.export_type === "no_bloods" ? "no bloods" : "full"}</span>
                <button onClick={() => onDeleteTimepoint(e.id, e.timepoint_label)}
                  title={`Delete ${e.timepoint_label} timepoint`}
                  className="ml-1 w-5 h-5 rounded-md text-gray-400 hover:bg-red-100 hover:text-red-600 leading-none text-sm">×</button>
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
          <div className="space-y-6">
            <p className="text-xs text-gray-500">
              Share of patients crossing each clinical or lifestyle threshold{multiTimepoint ? ", shown as baseline → latest with the change in percentage points (green = fewer affected)" : " at the latest timepoint"}. This is a curated set of decision-relevant thresholds — see the <span className="font-medium text-gray-600">By domain</span> tab for every variable. Denominators vary: conditional screeners and lifestyle sub-scores are only recorded for some patients.
              <InfoTip title="How prevalence & change are calculated">{METHOD.flags}</InfoTip>
            </p>
            {DOMAIN_GROUPS.map((g) => {
              const groupFlags = detail.flags.filter((f) => g.domains.includes(f.domain));
              if (!groupFlags.length) return null;
              return (
                <div key={g.key} className="space-y-3">
                  <div className="flex items-baseline gap-2 border-b border-gray-100 pb-1">
                    <h3 className="text-sm font-bold text-gray-900">{g.label}</h3>
                    {g.sublabel && <span className="text-[11px] text-gray-400">— {g.sublabel}</span>}
                  </div>
                  {g.domains.filter((dom) => groupFlags.some((f) => f.domain === dom)).map((dom) => (
                    <div key={dom}>
                      <div className="text-xs font-semibold text-gray-600 mb-1.5">{DOMAIN_LABELS[dom]}</div>
                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                        {groupFlags.filter((f) => f.domain === dom).map((f) => {
                          const tone = flagTone(f.pct);
                          return (
                            <div key={f.key} className="flex items-center gap-2 text-xs">
                              <span className="flex-1 text-gray-700">{f.label}</span>
                              {f.baseline_pct != null && <span className="text-[11px] text-gray-400 tabular-nums">{f.baseline_pct}%→</span>}
                              <div className="w-16 h-2 rounded-full bg-gray-100 overflow-hidden">
                                <div className={`h-full ${tone.bar}`} style={{ width: `${f.pct}%` }} />
                              </div>
                              <span className={`w-12 text-right font-medium tabular-nums ${tone.text}`}>{f.pct}%</span>
                              {f.delta_pct != null
                                ? <span className={`w-14 text-right tabular-nums ${f.delta_pct < 0 ? "text-emerald-600" : f.delta_pct > 0 ? "text-red-600" : "text-gray-400"}`}>{f.delta_pct > 0 ? "+" : ""}{f.delta_pct}pp</span>
                                : <span className="w-14 text-right text-gray-300 tabular-nums">{f.hits}/{f.eligible}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
            {!detail.flags.length && <p className="text-sm text-gray-400">No flag-eligible data yet.</p>}
          </div>
        )}

        {/* ---------- BY DOMAIN ---------- */}
        {tab === "domains" && (
          <div className="space-y-6">
            {summarySeries && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <button type="button" onClick={() => toggleFeature(SUMMARY)} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-900 hover:text-emerald-700" title="Show per-patient values">
                      <span className="w-3 text-emerald-500">{expanded.has(SUMMARY) ? "▾" : "▸"}</span>
                      Lífstílseinkunn — lifestyle score
                    </button>
                    <div className="text-[11px] text-emerald-700 mt-0.5">Overall summary of the four health foundations (sleep, exercise, nutrition, mental wellness). 0–10, higher is better.</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-emerald-900 tabular-nums leading-none">{latestMean(summarySeries) ?? "—"}<span className="text-sm font-normal text-emerald-600">/10</span></div>
                    {multiTimepoint && summaryMv?.delta != null && (
                      <div className={`text-[11px] mt-1 ${deltaTone(SUMMARY, summaryMv.delta)}`} title={deltaTitle(SUMMARY, summaryMv.delta)}>
                        {summaryMv.baseline_mean} → {summaryMv.latest_mean} ({summaryMv.delta > 0 ? "+" : ""}{summaryMv.delta}{summaryMv.pct_change != null ? `, ${summaryMv.pct_change}%` : ""})
                        {summaryMv.p != null && <span className="text-emerald-700"> · p={summaryMv.p < 0.001 ? "<.001" : summaryMv.p.toFixed(3)}{sigStars(summaryMv.p)}</span>}
                      </div>
                    )}
                  </div>
                </div>
                {expanded.has(SUMMARY) && <div className="mt-3"><FeatureDetailTable feature={SUMMARY} state={featCache[SUMMARY]} /></div>}
              </div>
            )}
            {multiTimepoint && (
              <p className="text-[11px] text-gray-400">
                Δ is baseline→latest (green = improvement for that metric, direction-aware). p = paired t-test on per-patient change; q = Benjamini-Hochberg FDR across features. <span className="font-medium">*</span> p&lt;.05 <span className="font-medium">**</span> p&lt;.01 <span className="font-medium">***</span> p&lt;.001. With small n and many features, lean on q and effect size, not raw p alone.
              </p>
            )}
            {DOMAIN_GROUPS.map((g) => {
              const groupDomains = g.domains.filter((dom) => seriesByDomain(dom).length);
              if (!groupDomains.length) return null;
              return (
                <div key={g.key} className="space-y-4">
                  <div className="flex items-baseline gap-2 border-b border-gray-100 pb-1">
                    <h3 className="text-sm font-bold text-gray-900">{g.label}</h3>
                    {g.sublabel && <span className="text-[11px] text-gray-400">— {g.sublabel}</span>}
                  </div>
                  {groupDomains.map((dom) => (
                    <div key={dom}>
                      <div className="text-xs font-semibold text-gray-600 mb-2">{DOMAIN_LABELS[dom]}</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-[11px] text-gray-400">
                            <th className="py-1 pr-4">Feature</th><th className="py-1 pr-4">Mean<InfoTip title="Mean & spread">{METHOD.mean}</InfoTip></th><th className="py-1 pr-4">n</th>
                            <th className="py-1 pr-4">Reference range</th>
                            {multiTimepoint && <th className="py-1 pr-4">Δ baseline→latest<InfoTip title="Δ and effect size">{METHOD.delta}{METHOD.effect}</InfoTip></th>}
                            {multiTimepoint && <th className="py-1 pr-4">p (q)<InfoTip title="Significance (p and q)">{METHOD.pq}</InfoTip></th>}
                          </tr></thead>
                          <tbody>
                            {seriesByDomain(dom).map((s) => {
                              const mv = moveByFeature.get(s.feature);
                              const unit = canonicalUnit(s.feature, s.unit);
                              const isOpen = expanded.has(s.feature);
                              const cols = 4 + (multiTimepoint ? 2 : 0);
                              return (
                                <Fragment key={s.feature}>
                                  <tr className="border-t border-gray-50">
                                    <td className="py-1 pr-4 text-gray-800">
                                      <button type="button" onClick={() => toggleFeature(s.feature)}
                                        className="inline-flex items-center gap-1 hover:text-emerald-700" title="Show per-patient values">
                                        <span className="w-3 text-gray-400">{isOpen ? "▾" : "▸"}</span>
                                        {s.feature}{unit ? <span className="text-gray-400"> ({unit})</span> : null}
                                      </button>
                                    </td>
                                    <td className="py-1 pr-4 text-gray-700">{latestMean(s) ?? "-"}</td>
                                    <td className="py-1 pr-4 text-gray-500">{latestN(s)}</td>
                                    <td className="py-1 pr-4 text-[11px] text-gray-400">{referenceNote(s.feature)}</td>
                                    {multiTimepoint && (
                                      <td className={`py-1 pr-4 tabular-nums ${deltaTone(s.feature, mv?.delta ?? null)}`} title={deltaTitle(s.feature, mv?.delta ?? null)}>
                                        {mv?.delta != null ? `${mv.delta > 0 ? "+" : ""}${mv.delta}${mv.effect_size != null ? ` (d=${mv.effect_size})` : ""}` : "-"}
                                      </td>
                                    )}
                                    {multiTimepoint && (
                                      <td className="py-1 pr-4 text-xs tabular-nums text-gray-600">
                                        {mv?.p != null
                                          ? <span><span className={mv.p < 0.05 ? "text-gray-900 font-medium" : ""}>{mv.p < 0.001 ? "<.001" : mv.p.toFixed(3)}{sigStars(mv.p)}</span>{mv.q != null ? <span className="text-gray-400"> ({mv.q < 0.001 ? "q<.001" : `q=${mv.q.toFixed(3)}`})</span> : null}</span>
                                          : "-"}
                                      </td>
                                    )}
                                  </tr>
                                  {isOpen && (
                                    <tr>
                                      <td colSpan={cols} className="pb-3 pr-4">
                                        <FeatureDetailTable feature={s.feature} state={featCache[s.feature]} />
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
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
            <div className="text-xs font-medium text-gray-500">Top movers (baseline → latest, ranked by effect size)<InfoTip title="How movement is measured">{METHOD.delta}{METHOD.effect}{METHOD.pq}</InfoTip></div>
            {detail.movements.filter((m) => m.effect_size !== null).length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-400">
                    <th className="py-1 pr-4">Feature</th><th className="py-1 pr-4">Baseline</th><th className="py-1 pr-4">Latest</th>
                    <th className="py-1 pr-4">Δ</th><th className="py-1 pr-4">% change<InfoTip title="% change">{METHOD.pctChange}</InfoTip></th><th className="py-1 pr-4">d<InfoTip title="Effect size">{METHOD.effect}</InfoTip></th><th className="py-1 pr-4">p (q)<InfoTip title="Significance (p and q)">{METHOD.pq}</InfoTip></th><th className="py-1 pr-4">Direction</th>
                  </tr></thead>
                  <tbody>
                    {detail.movements.filter((m) => m.effect_size !== null).slice(0, 20).map((m) => {
                      const good = changeIsGood(m.feature, m.delta);
                      return (
                        <tr key={m.feature} className="border-t border-gray-50">
                          <td className="py-1 pr-4 text-gray-800">{m.feature}</td>
                          <td className="py-1 pr-4 text-gray-600 tabular-nums">{m.baseline_mean ?? "-"}</td>
                          <td className="py-1 pr-4 text-gray-600 tabular-nums">{m.latest_mean ?? "-"}</td>
                          <td className={`py-1 pr-4 tabular-nums ${deltaTone(m.feature, m.delta)}`}>{m.delta != null ? `${m.delta > 0 ? "+" : ""}${m.delta}` : "-"}</td>
                          <td className="py-1 pr-4 text-gray-600 tabular-nums">{m.pct_change !== null ? `${m.pct_change}%` : "-"}</td>
                          <td className="py-1 pr-4 font-medium text-gray-800 tabular-nums">{m.effect_size ?? "-"}</td>
                          <td className="py-1 pr-4 text-xs tabular-nums text-gray-600">
                            {m.p != null
                              ? <span><span className={m.p < 0.05 ? "text-gray-900 font-medium" : ""}>{m.p < 0.001 ? "<.001" : m.p.toFixed(3)}{sigStars(m.p)}</span>{m.q != null ? <span className="text-gray-400"> ({m.q < 0.001 ? "q<.001" : `q=${m.q.toFixed(3)}`})</span> : null}</span>
                              : "-"}
                          </td>
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
              <div className="text-sm font-semibold text-gray-900">AI trend analysis<InfoTip title="What the AI sees">Only the <b>computed aggregate statistics</b> are sent to the model (means, baseline→latest deltas, effect sizes, missingness, demographics) — never any per-patient data. Each metric is tagged with its beneficial direction so the model cannot misread a good drop (e.g. lower HbA1c) as bad. The narrative is interpretation, not new computation; rely on the numeric tabs to validate.</InfoTip></div>
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

        {/* ---------- DATA QUALITY ---------- */}
        {tab === "quality" && (
          <DataQualityPanel
            key={(detail.dataQuality?.excludedPatients.join() || "") + "|" + (detail.dataQuality?.excludedFeatures.join() || "")}
            dq={detail.dataQuality} onSave={onSaveExclusions} />
        )}

        {/* ---------- DATA & EXPORT ---------- */}
        {tab === "data" && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <button onClick={onEmployerReport} className="text-sm rounded-lg bg-gray-900 text-white px-4 py-2 font-medium hover:bg-gray-800">Employer summary (report)</button>
              <button onClick={() => onDownload("excel")} className="text-sm rounded-lg bg-emerald-600 text-white px-4 py-2 font-medium hover:bg-emerald-700">Download Excel (.xlsx)</button>
              <button onClick={() => onDownload("long")} className="text-sm rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">CSV (long)</button>
              <button onClick={() => onDownload("answers")} className="text-sm rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">CSV (answers)</button>
            </div>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-600">Employer summary</span> — a layman-friendly, aggregate-only results report (opens in a new tab; print to PDF to share). Needs 2+ timepoints.
              Excel has 4 sheets — Wide (units in headers, missing data flagged red), Long, Answers, Dictionary.
            </p>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">Completeness at latest timepoint (worst first)<InfoTip title="Missing data">{METHOD.completeness}</InfoTip></div>
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
