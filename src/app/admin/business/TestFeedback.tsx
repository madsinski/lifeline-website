"use client";

// Admin review of business-onboarding tester feedback. Lists every note
// submitted from the Testing guide composer, with filters and resolve /
// reopen + an optional reply that the tester sees back in the guide.
//
// Reads/writes via /api/admin/business/test-feedback. PATCH requires AAL2,
// so this surface is admin-only in practice (non-admins get 403 on resolve).

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

interface FeedbackRow {
  id: string;
  created_at: string;
  tester_email: string;
  tester_name: string | null;
  step_label: string | null;
  body: string;
  status: string;
  admin_note: string | null;
  resolved_at: string | null;
  resolved_by_email: string | null;
}

export default function TestFeedback() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/business/test-feedback", { headers });
      const j = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(j.feedback)) setRows(j.feedback);
    } catch { /* best effort */ } finally { setLoading(false); }
  }, [authHeaders]);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, payload: { status?: string; admin_note?: string | null }) => {
    setBusyId(id);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/admin/business/test-feedback", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id, ...payload }),
      });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.feedback) setRows((prev) => prev.map((r) => (r.id === id ? j.feedback : r)));
      }
    } catch { /* ignore */ } finally { setBusyId(null); }
  };

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter]
  );
  const openCount = rows.filter((r) => r.status === "open").length;

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString("is-IS", { dateStyle: "medium", timeStyle: "short" }); }
    catch { return iso; }
  };

  return (
    <div className="px-8 pb-12 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">Test feedback</h2>
          <p className="text-[13px] text-gray-500">
            Notes submitted by testers from the Testing guide. {openCount} open.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(["open", "resolved", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium capitalize transition-colors ${
                filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
          <button
            type="button"
            onClick={load}
            className="px-2.5 py-1.5 rounded-md text-[13px] text-gray-500 hover:text-gray-700"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          No {filter === "all" ? "" : filter} feedback yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => {
            const resolved = r.status === "resolved";
            return (
              <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-gray-900">
                      {r.tester_name || r.tester_email}
                    </span>
                    {r.tester_name && (
                      <span className="text-[12px] text-gray-400 ml-1.5">{r.tester_email}</span>
                    )}
                    <div className="text-[12px] text-gray-500 mt-0.5">
                      <span className="font-medium text-gray-600">{r.step_label || "General"}</span>
                      {" · "}{fmtDate(r.created_at)}
                    </div>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    resolved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}>
                    {r.status}
                  </span>
                </div>

                <p className="text-[14px] text-gray-800 whitespace-pre-wrap">{r.body}</p>

                {r.admin_note && (
                  <p className="mt-2 text-[13px] text-emerald-900 bg-emerald-50 rounded-lg px-3 py-2">
                    <strong>Your reply:</strong> {r.admin_note}
                  </p>
                )}

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={noteDraft[r.id] ?? r.admin_note ?? ""}
                    onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    placeholder="Reply / triage note (optional, visible to tester)"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-[13px] text-gray-800 placeholder:text-gray-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                  <div className="flex items-center gap-2">
                    {noteDraft[r.id] !== undefined && noteDraft[r.id] !== (r.admin_note ?? "") && (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => patch(r.id, { admin_note: noteDraft[r.id] })}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Save reply
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => patch(r.id, { status: resolved ? "open" : "resolved" })}
                      className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50 ${
                        resolved
                          ? "border border-gray-200 text-gray-700 hover:bg-gray-50"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {resolved ? "Reopen" : "Mark resolved"}
                    </button>
                  </div>
                </div>
                {resolved && r.resolved_by_email && (
                  <p className="mt-1.5 text-[11px] text-gray-400">
                    Resolved by {r.resolved_by_email}{r.resolved_at ? ` · ${fmtDate(r.resolved_at)}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
