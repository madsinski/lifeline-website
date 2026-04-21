"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface SyncRun {
  id: number;
  ran_at: string;
  mode: string;
  processed: number;
  errors: number;
  last_error: string | null;
  duration_ms: number;
}

interface ActivationError {
  id: string;
  full_name: string;
  email: string;
  biody_activation_error: string;
  company_name?: string;
}

export default function BiodySyncStatus() {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [errors, setErrors] = useState<ActivationError[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: runData }, { data: errData }] = await Promise.all([
        supabase
          .from("biody_sync_runs")
          .select("*")
          .order("ran_at", { ascending: false })
          .limit(10),
        supabase
          .from("company_members")
          .select("id, full_name, email, biody_activation_error")
          .not("biody_activation_error", "is", null)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      setRuns((runData || []) as SyncRun[]);
      setErrors((errData || []) as ActivationError[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6 text-gray-400 text-sm">Loading Biody sync status…</div>;

  const lastPoll = runs.find((r) => r.mode === "notifications");
  const lastReconcile = runs.find((r) => r.mode === "reconcile");
  const recentErrors = runs.filter((r) => r.errors > 0);

  const timeSince = (ts: string) => {
    const ms = Date.now() - new Date(ts).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
    if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
    return `${Math.floor(ms / 86_400_000)}d ago`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Biody sync</h3>
          <p className="text-sm text-gray-500">Measurement polling and patient activation status</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          lastPoll && (Date.now() - new Date(lastPoll.ran_at).getTime() < 600_000)
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-700"
        }`}>
          {lastPoll ? (Date.now() - new Date(lastPoll.ran_at).getTime() < 600_000 ? "Healthy" : "Stale") : "No data"}
        </div>
      </div>

      {/* Sync summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 font-medium">Last poll</p>
          <p className="text-sm font-semibold text-gray-900">{lastPoll ? timeSince(lastPoll.ran_at) : "Never"}</p>
          {lastPoll && <p className="text-xs text-gray-400">{lastPoll.processed} processed</p>}
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 font-medium">Last reconcile</p>
          <p className="text-sm font-semibold text-gray-900">{lastReconcile ? timeSince(lastReconcile.ran_at) : "Never"}</p>
          {lastReconcile && <p className="text-xs text-gray-400">{lastReconcile.processed} processed</p>}
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 font-medium">Recent errors</p>
          <p className={`text-sm font-semibold ${recentErrors.length > 0 ? "text-red-700" : "text-gray-900"}`}>{recentErrors.length}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 font-medium">Activation failures</p>
          <p className={`text-sm font-semibold ${errors.length > 0 ? "text-amber-700" : "text-gray-900"}`}>{errors.length}</p>
        </div>
      </div>

      {/* Recent runs table */}
      {runs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent sync runs</p>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">Time</th>
                  <th className="text-left px-3 py-2">Mode</th>
                  <th className="text-left px-3 py-2">Processed</th>
                  <th className="text-left px-3 py-2">Errors</th>
                  <th className="text-left px-3 py-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="px-3 py-2 text-gray-700">{timeSince(r.ran_at)}</td>
                    <td className="px-3 py-2 text-gray-600">{r.mode}</td>
                    <td className="px-3 py-2 text-gray-900 font-medium">{r.processed}</td>
                    <td className="px-3 py-2">
                      {r.errors > 0 ? (
                        <span className="text-red-600 font-medium" title={r.last_error || ""}>{r.errors}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{r.duration_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activation errors */}
      {errors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Activation failures</p>
          <div className="space-y-2">
            {errors.map((e) => (
              <div key={e.id} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <p className="text-sm font-medium text-gray-900">{e.full_name} · {e.email}</p>
                <p className="text-xs text-amber-800 mt-0.5 font-mono break-words">{e.biody_activation_error}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
