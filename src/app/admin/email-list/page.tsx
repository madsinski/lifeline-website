"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Subscriber = {
  id: string;
  email: string;
  source: string | null;
  user_agent: string | null;
  unsubscribed_at: string | null;
  created_at: string;
};

export default function EmailListPage() {
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_subscribers")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRows(data as Subscriber[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (q && !r.email.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [rows, q, sourceFilter]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.source && set.add(r.source));
    return Array.from(set);
  }, [rows]);

  const activeCount = rows.filter((r) => !r.unsubscribed_at).length;

  const exportCsv = () => {
    const header = ["email", "source", "created_at", "unsubscribed_at"];
    const lines = [header.join(",")].concat(
      filtered.map((r) =>
        [r.email, r.source ?? "", r.created_at, r.unsubscribed_at ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeline-email-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleUnsubscribe = async (row: Subscriber) => {
    const { error } = await supabase
      .from("email_subscribers")
      .update({ unsubscribed_at: row.unsubscribed_at ? null : new Date().toISOString() })
      .eq("id", row.id);
    if (!error) load();
  };

  const remove = async (row: Subscriber) => {
    if (!confirm(`Delete ${row.email}?`)) return;
    const { error } = await supabase.from("email_subscribers").delete().eq("id", row.id);
    if (!error) load();
  };

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Email List</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount} active subscriber{activeCount === 1 ? "" : "s"} · {rows.length} total
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-full hover:bg-emerald-700 transition"
        >
          Export CSV
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email…"
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-500"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-500"
        >
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Email</th>
              <th className="text-left px-4 py-3 font-semibold">Source</th>
              <th className="text-left px-4 py-3 font-semibold">Joined</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">No subscribers yet.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-900 font-medium">{r.email}</td>
                <td className="px-4 py-3 text-gray-600">{r.source ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {r.unsubscribed_at ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                      Unsubscribed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => toggleUnsubscribe(r)}
                    className="text-xs text-gray-600 hover:text-gray-900"
                  >
                    {r.unsubscribed_at ? "Resubscribe" : "Unsubscribe"}
                  </button>
                  <button
                    onClick={() => remove(r)}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
