"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Severity = "low" | "medium" | "high" | "critical";
type Likelihood = "rare" | "unlikely" | "possible" | "likely" | "almost_certain";
type Status = "open" | "mitigated" | "closed" | "accepted";
type Category = "clinical" | "data-integrity" | "privacy" | "security" | "regulatory" | "availability" | "integration" | "usability" | "other";

interface RiskRow {
  id: string;
  short_id: string | null;
  category: Category;
  title: string;
  description: string;
  failure_mode: string | null;
  affected_users: string | null;
  severity: Severity;
  likelihood: Likelihood | null;
  initial_risk_score: number | null;
  mitigation: string | null;
  residual_severity: Severity | null;
  residual_likelihood: Likelihood | null;
  residual_risk_score: number | null;
  detection: string | null;
  status: Status;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
}

const SEVERITY_PILL: Record<Severity, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const STATUS_PILL: Record<Status, string> = {
  open: "bg-amber-100 text-amber-700",
  mitigated: "bg-blue-100 text-blue-700",
  closed: "bg-green-100 text-green-700",
  accepted: "bg-gray-100 text-gray-600",
};

const CATEGORIES: Category[] = [
  "clinical", "data-integrity", "privacy", "security", "regulatory",
  "availability", "integration", "usability", "other",
];

const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
const LIKELIHOODS: Likelihood[] = ["rare", "unlikely", "possible", "likely", "almost_certain"];

type StatusFilter = "open" | "all" | Status;

export default function RiskRegisterTab() {
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // New-row form state
  const [draft, setDraft] = useState<Partial<RiskRow>>({
    category: "other",
    severity: "medium",
    status: "open",
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase
      .from("risk_register")
      .select("*")
      .order("opened_at", { ascending: false });
    if (statusFilter === "open") q = q.eq("status", "open");
    else if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, error } = await q;
    if (error) setError(error.message);
    else setRows((data as RiskRow[]) ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const createRow = async () => {
    if (!draft.title || !draft.description) {
      alert("Title and description are required.");
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from("risk_register").insert({
        category: draft.category ?? "other",
        title: draft.title,
        description: draft.description,
        failure_mode: draft.failure_mode ?? null,
        affected_users: draft.affected_users ?? null,
        severity: draft.severity ?? "medium",
        likelihood: draft.likelihood ?? null,
        initial_risk_score: draft.initial_risk_score ?? null,
        mitigation: draft.mitigation ?? null,
        residual_severity: draft.residual_severity ?? null,
        residual_likelihood: draft.residual_likelihood ?? null,
        residual_risk_score: draft.residual_risk_score ?? null,
        detection: draft.detection ?? null,
        status: draft.status ?? "open",
        notes: draft.notes ?? null,
      });
      if (error) {
        alert(`Insert failed: ${error.message}`);
        return;
      }
      setDraft({ category: "other", severity: "medium", status: "open" });
      setShowNew(false);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const updateRow = async (id: string, patch: Partial<RiskRow>) => {
    const cleanPatch: Record<string, unknown> = { ...patch };
    if (patch.status === "closed" || patch.status === "mitigated" || patch.status === "accepted") {
      cleanPatch.closed_at = new Date().toISOString();
    } else if (patch.status === "open") {
      cleanPatch.closed_at = null;
    }
    const { error } = await supabase.from("risk_register").update(cleanPatch).eq("id", id);
    if (error) {
      alert(`Update failed: ${error.message}`);
      return;
    }
    load();
  };

  return (
    <>
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="inline-flex bg-white rounded-xl p-1 shadow-sm border border-gray-100">
          {(["open", "all", "mitigated", "closed", "accepted"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === f ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="px-3 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {showNew ? "Cancel" : "+ New risk"}
        </button>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 ml-auto"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {showNew && (
        <div className="mb-4 p-4 bg-white border border-emerald-200 rounded-xl shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">New risk entry</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Title *</label>
              <input
                value={draft.title ?? ""}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Short summary, one line"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Category</label>
              <select
                value={draft.category ?? "other"}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Severity</label>
              <select
                value={draft.severity ?? "medium"}
                onChange={(e) => setDraft({ ...draft, severity: e.target.value as Severity })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Likelihood</label>
              <select
                value={draft.likelihood ?? ""}
                onChange={(e) => setDraft({ ...draft, likelihood: (e.target.value || null) as Likelihood | null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">—</option>
                {LIKELIHOODS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Initial risk score (1–25)</label>
              <input
                type="number" min={1} max={25}
                value={draft.initial_risk_score ?? ""}
                onChange={(e) => setDraft({ ...draft, initial_risk_score: e.target.value ? parseInt(e.target.value, 10) : null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Description *</label>
              <textarea
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                rows={3}
                placeholder="The risk in plain language. Who could be harmed and how."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Mitigation</label>
              <textarea
                value={draft.mitigation ?? ""}
                onChange={(e) => setDraft({ ...draft, mitigation: e.target.value })}
                rows={2}
                placeholder="What we do or plan to do to reduce this risk."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Detection</label>
              <textarea
                value={draft.detection ?? ""}
                onChange={(e) => setDraft({ ...draft, detection: e.target.value })}
                rows={2}
                placeholder="How we'd know if this risk materializes (logs, alerts, user reports)."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={createRow}
              disabled={creating || !draft.title || !draft.description}
              className="px-3 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {creating ? "Saving…" : "Save risk"}
            </button>
            <button
              onClick={() => { setShowNew(false); setDraft({ category: "other", severity: "medium", status: "open" }); }}
              className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Opened</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No risks registered.</td></tr>
            ) : rows.map((r) => (
              <>
                <tr
                  key={r.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.short_id ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{r.category}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SEVERITY_PILL[r.severity]}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(r.opened_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <h4 className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</h4>
                          <p className="text-gray-800 whitespace-pre-wrap">{r.description}</p>
                          {r.failure_mode && (
                            <>
                              <h4 className="font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">Failure mode</h4>
                              <p className="text-gray-800 whitespace-pre-wrap">{r.failure_mode}</p>
                            </>
                          )}
                          {r.affected_users && (
                            <>
                              <h4 className="font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">Affected users</h4>
                              <p className="text-gray-800 whitespace-pre-wrap">{r.affected_users}</p>
                            </>
                          )}
                        </div>
                        <div>
                          {r.mitigation && (
                            <>
                              <h4 className="font-semibold text-gray-500 uppercase tracking-wide mb-1">Mitigation</h4>
                              <p className="text-gray-800 whitespace-pre-wrap">{r.mitigation}</p>
                            </>
                          )}
                          {r.detection && (
                            <>
                              <h4 className="font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">Detection</h4>
                              <p className="text-gray-800 whitespace-pre-wrap">{r.detection}</p>
                            </>
                          )}
                          {(r.initial_risk_score || r.residual_risk_score) && (
                            <>
                              <h4 className="font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">Risk score</h4>
                              <p className="text-gray-800">
                                Initial: {r.initial_risk_score ?? "—"} →{" "}
                                Residual: {r.residual_risk_score ?? "—"}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2 border-t border-gray-200 pt-3">
                        <label className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide">Status</label>
                        <select
                          value={r.status}
                          onChange={(e) => updateRow(r.id, { status: e.target.value as Status })}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        >
                          {(["open","mitigated","closed","accepted"] as Status[]).map((s) =>
                            <option key={s} value={s}>{s}</option>
                          )}
                        </select>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
