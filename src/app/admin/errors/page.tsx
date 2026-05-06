"use client";

// Admin error log viewer.
// Mirrors what Sentry catches into our app_errors table so the founder
// can triage from the admin panel and ask Claude to investigate via SQL.

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStaffGuard } from "@/lib/useStaffGuard";

interface AppError {
  id: string;
  message: string;
  stack: string | null;
  url: string | null;
  pathname: string | null;
  runtime: "browser" | "server" | "edge" | null;
  user_agent: string | null;
  user_id: string | null;
  user_email: string | null;
  fingerprint: string | null;
  level: "error" | "warning" | "fatal" | "info" | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
}

const LEVEL_STYLES: Record<NonNullable<AppError["level"]>, string> = {
  fatal: "bg-red-200 text-red-900",
  error: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-blue-100 text-blue-800",
};

const RUNTIME_STYLES: Record<NonNullable<AppError["runtime"]>, string> = {
  browser: "bg-purple-100 text-purple-700",
  server: "bg-emerald-100 text-emerald-700",
  edge: "bg-cyan-100 text-cyan-700",
};

type Window = "1h" | "24h" | "7d" | "30d" | "all";

const WINDOW_LABELS: Record<Window, string> = {
  "1h": "Last hour",
  "24h": "Last 24h",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

function windowToCutoff(w: Window): Date | null {
  const now = Date.now();
  switch (w) {
    case "1h": return new Date(now - 60 * 60 * 1000);
    case "24h": return new Date(now - 24 * 60 * 60 * 1000);
    case "7d": return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "all": return null;
  }
}

export default function ErrorsPage() {
  const guard = useStaffGuard({ role: "admin" });
  const [rows, setRows] = useState<AppError[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowSel, setWindowSel] = useState<Window>("24h");
  const [runtimeFilter, setRuntimeFilter] = useState<"all" | "browser" | "server" | "edge">("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("app_errors")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(500);
      const cutoff = windowToCutoff(windowSel);
      if (cutoff) q = q.gte("occurred_at", cutoff.toISOString());
      const { data } = await q;
      setRows((data || []) as AppError[]);
    } finally {
      setLoading(false);
    }
  }, [windowSel]);

  useEffect(() => {
    if (guard.authorized) load();
  }, [guard.authorized, load]);

  const filtered = useMemo(() => {
    let r = rows;
    if (runtimeFilter !== "all") r = r.filter((x) => x.runtime === runtimeFilter);
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((x) =>
      x.message.toLowerCase().includes(q)
      || (x.pathname || "").toLowerCase().includes(q)
      || (x.fingerprint || "").toLowerCase().includes(q),
    );
    return r;
  }, [rows, runtimeFilter, search]);

  // Group by message+pathname so a recurring error doesn't drown the list.
  const grouped = useMemo(() => {
    const map = new Map<string, { sample: AppError; count: number; lastSeen: string }>();
    for (const e of filtered) {
      const key = `${e.message.slice(0, 200)}::${e.pathname || ""}::${e.runtime || ""}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { sample: e, count: 1, lastSeen: e.occurred_at });
      } else {
        existing.count += 1;
        if (e.occurred_at > existing.lastSeen) existing.lastSeen = e.occurred_at;
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
  }, [filtered]);

  const deleteOne = async (id: string) => {
    if (!confirm("Delete this error row?")) return;
    await supabase.from("app_errors").delete().eq("id", id);
    await load();
  };

  // Copy every group currently rendered (respects window + runtime +
  // search filters). Format is structured + Claude-friendly so the
  // reply can paste straight into a triage prompt.
  const [copiedAll, setCopiedAll] = useState(false);
  const copyAll = async () => {
    if (grouped.length === 0) return;
    const header = [
      `# Lifeline error log digest`,
      `Window: ${WINDOW_LABELS[windowSel]} (${grouped.length} group${grouped.length === 1 ? "" : "s"}, ${filtered.length} event${filtered.length === 1 ? "" : "s"})`,
      runtimeFilter !== "all" ? `Runtime filter: ${runtimeFilter}` : null,
      search.trim() ? `Search: "${search.trim()}"` : null,
      `Generated: ${new Date().toISOString()}`,
    ].filter(Boolean).join("\n");

    const blocks = grouped.map((g, i) => {
      const e = g.sample;
      return [
        `## ${i + 1}. [${e.level || "error"}] ${e.message}`,
        `Runtime: ${e.runtime || "—"} · Path: ${e.pathname || "—"} · Count: ${g.count} · Last seen: ${g.lastSeen}`,
        e.fingerprint ? `Fingerprint: ${e.fingerprint}` : null,
        e.url ? `URL: ${e.url}` : null,
        e.user_email ? `User: ${e.user_email}` : null,
        e.stack ? `\nStack:\n${e.stack}` : null,
      ].filter(Boolean).join("\n");
    }).join("\n\n");

    try {
      await navigator.clipboard.writeText(`${header}\n\n${blocks}\n`);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1800);
    } catch {
      // clipboard not available — fall back to opening a window with the text
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`<pre style="white-space:pre-wrap;font:12px monospace;padding:1rem">${header}\n\n${blocks}</pre>`);
      }
    }
  };

  if (guard.loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;
  if (!guard.authorized) return <div className="p-8 text-center text-red-600 text-sm">Admin access required.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1F2937]">Error logs</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          Mirrored from Sentry into our DB so you can triage here.
          Grouped by message + pathname so a recurring error counts as one row.
          When something breaks, you can paste the message + stack into a Claude
          prompt — or just say <em>&quot;read the latest errors and investigate&quot;</em>.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          {(Object.keys(WINDOW_LABELS) as Window[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindowSel(w)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                windowSel === w ? "bg-emerald-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {WINDOW_LABELS[w]}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-1">
          {(["all", "browser", "server", "edge"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRuntimeFilter(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                runtimeFilter === r ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {r === "all" ? "All runtimes" : r}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search messages, paths, fingerprints…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-72"
        />
        <button
          onClick={copyAll}
          disabled={grouped.length === 0}
          className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Copy a Claude-friendly digest of every group in the current window"
        >
          {copiedAll ? `Copied ${grouped.length} ✓` : `Copy all (${grouped.length})`}
        </button>
        <button onClick={load} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading errors…</div>
      ) : grouped.length === 0 ? (
        <div className="p-12 text-center text-gray-500 text-sm bg-white rounded-xl shadow-sm border border-gray-100">
          No errors in this window. Either everything works, or Sentry isn&apos;t configured.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Last seen</th>
                <th className="text-left px-4 py-3 font-medium">Runtime</th>
                <th className="text-left px-4 py-3 font-medium">Level</th>
                <th className="text-left px-4 py-3 font-medium w-1/2">Message</th>
                <th className="text-left px-4 py-3 font-medium">Path</th>
                <th className="text-left px-4 py-3 font-medium">Count</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grouped.map((g) => {
                const e = g.sample;
                const expanded = openId === e.id;
                const lvl = e.level || "error";
                const rt = e.runtime || "server";
                return (
                  <Fragment key={e.id}>
                    <tr className={`hover:bg-gray-50/50 ${expanded ? "bg-emerald-50/30" : ""}`}>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(g.lastSeen).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${RUNTIME_STYLES[rt]}`}>
                          {rt}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${LEVEL_STYLES[lvl]}`}>
                          {lvl}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium truncate max-w-md" title={e.message}>
                        {e.message}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono truncate max-w-xs">
                        {e.pathname || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded font-semibold ${g.count > 1 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                          {g.count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setOpenId(expanded ? null : e.id)}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          {expanded ? "Hide" : "Open"}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-gray-50/50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="space-y-3 text-xs">
                            <div>
                              <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">Message</div>
                              <div className="text-gray-800 font-mono whitespace-pre-wrap bg-white border border-gray-200 rounded p-2">
                                {e.message}
                              </div>
                            </div>
                            {e.stack && (
                              <div>
                                <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">Stack</div>
                                <pre className="text-[11px] text-gray-700 font-mono whitespace-pre-wrap bg-white border border-gray-200 rounded p-2 max-h-80 overflow-y-auto">
                                  {e.stack}
                                </pre>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">URL</div>
                                <div className="text-gray-700 font-mono break-all">{e.url || "—"}</div>
                              </div>
                              <div>
                                <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">User agent</div>
                                <div className="text-gray-500 break-all">{e.user_agent || "—"}</div>
                              </div>
                              <div>
                                <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">Fingerprint</div>
                                <div className="text-gray-700 font-mono">{e.fingerprint || "—"}</div>
                              </div>
                              <div>
                                <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">First in this group</div>
                                <div className="text-gray-700">{new Date(e.occurred_at).toLocaleString("en-GB")}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`${e.message}\n\n${e.stack || ""}\n\nPath: ${e.pathname}\nRuntime: ${e.runtime}\nWhen: ${e.occurred_at}`);
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
                              >
                                Copy for Claude
                              </button>
                              <button
                                onClick={() => deleteOne(e.id)}
                                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded hover:bg-red-50"
                              >
                                Delete this row
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
