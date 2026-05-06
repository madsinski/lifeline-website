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
  resolved_at: string | null;
  resolved_by_name: string | null;
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
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "all">("open");
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
  // Also compute resolution status: a group is 'resolved' if every event in
  // it has resolved_at set; 'regression' if some events are resolved but
  // newer events aren't (i.e. the bug came back after we marked it fixed);
  // 'open' otherwise.
  type GroupStatus = "open" | "resolved" | "regression";
  interface Group {
    key: string;
    sample: AppError;
    count: number;
    lastSeen: string;
    status: GroupStatus;
    resolvedCount: number;
    resolvedBy: string | null;
    lastResolvedAt: string | null;
  }
  const groupedRaw = useMemo(() => {
    const map = new Map<string, Group>();
    for (const e of filtered) {
      const key = `${e.message.slice(0, 200)}::${e.pathname || ""}::${e.runtime || ""}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          sample: e,
          count: 1,
          lastSeen: e.occurred_at,
          status: e.resolved_at ? "resolved" : "open",
          resolvedCount: e.resolved_at ? 1 : 0,
          resolvedBy: e.resolved_by_name,
          lastResolvedAt: e.resolved_at,
        });
      } else {
        existing.count += 1;
        if (e.occurred_at > existing.lastSeen) existing.lastSeen = e.occurred_at;
        if (e.resolved_at) {
          existing.resolvedCount += 1;
          if (!existing.lastResolvedAt || e.resolved_at > existing.lastResolvedAt) {
            existing.lastResolvedAt = e.resolved_at;
            existing.resolvedBy = e.resolved_by_name;
          }
        }
      }
    }
    for (const g of map.values()) {
      if (g.resolvedCount === 0) g.status = "open";
      else if (g.resolvedCount === g.count) g.status = "resolved";
      else g.status = "regression";
    }
    return Array.from(map.values()).sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
  }, [filtered]);

  const grouped = useMemo(() => {
    if (statusFilter === "all") return groupedRaw;
    if (statusFilter === "open") return groupedRaw.filter((g) => g.status !== "resolved");
    return groupedRaw.filter((g) => g.status === "resolved");
  }, [groupedRaw, statusFilter]);

  // Counts for the filter pills — always reflect the unfiltered set so the
  // user can see what they're filtering toward.
  const statusCounts = useMemo(() => {
    let open = 0, resolved = 0, regression = 0;
    for (const g of groupedRaw) {
      if (g.status === "open") open += 1;
      else if (g.status === "resolved") resolved += 1;
      else regression += 1;
    }
    return { open, resolved, regression, all: groupedRaw.length };
  }, [groupedRaw]);

  const resolverDisplayName = useCallback(async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;
    const { data: staffRow } = await supabase.from("staff").select("name").eq("email", user.email).maybeSingle();
    return staffRow?.name || user.email;
  }, []);

  const markResolved = async (g: Group, resolved: boolean) => {
    const sample = g.sample;
    // Apply to every row matching the group signature so the resolution
    // sticks across all historical occurrences. Future arrivals default
    // to resolved_at = NULL, so a regression automatically reappears.
    // .select() chained so we can count the affected rows — RLS without
    // an UPDATE policy returns 0 rows with no error, which is silent.
    const resolverName = resolved ? await resolverDisplayName() : null;
    let q = supabase
      .from("app_errors")
      .update({
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by_name: resolved ? resolverName : null,
      })
      .eq("message", sample.message)
      .eq("runtime", sample.runtime || "");
    if (sample.pathname) q = q.eq("pathname", sample.pathname);
    else q = q.is("pathname", null);
    const { data, error } = await q.select("id");
    if (error) { alert(`Could not update: ${error.message}`); return; }
    if (!data || data.length === 0) {
      alert("0 rows updated — RLS may be blocking the change. Run migration-app-errors-resolution.sql to add the admin UPDATE policy.");
      return;
    }
    await load();
  };

  // Bulk-resolve every open OR regression group in the current view.
  // Honors the active window / runtime / search / status filters — what
  // you see is what you resolve. Done as parallel UPDATEs (one per
  // signature) so a single huge query doesn't lock the whole table.
  const [bulkBusy, setBulkBusy] = useState(false);
  const openGroupsCount = grouped.filter((g) => g.status !== "resolved").length;
  const markAllOpenResolved = async () => {
    const targets = grouped.filter((g) => g.status !== "resolved");
    if (targets.length === 0) return;
    if (!confirm(`Mark ${targets.length} open group${targets.length === 1 ? "" : "s"} as resolved? Regressions automatically re-open if the same error fires again.`)) return;
    setBulkBusy(true);
    try {
      const resolverName = await resolverDisplayName();
      const resolvedAt = new Date().toISOString();
      const updates = await Promise.all(targets.map(async (g) => {
        const sample = g.sample;
        let q = supabase
          .from("app_errors")
          .update({ resolved_at: resolvedAt, resolved_by_name: resolverName })
          .eq("message", sample.message)
          .eq("runtime", sample.runtime || "");
        if (sample.pathname) q = q.eq("pathname", sample.pathname);
        else q = q.is("pathname", null);
        const { data } = await q.select("id");
        return data?.length || 0;
      }));
      const totalUpdated = updates.reduce((a, b) => a + b, 0);
      if (totalUpdated === 0) {
        alert("0 rows updated — RLS may be blocking the change. Run migration-app-errors-resolution.sql to add the admin UPDATE policy.");
        return;
      }
      await load();
    } catch (e) {
      alert(`Bulk resolve failed: ${(e as Error).message}`);
    } finally {
      setBulkBusy(false);
    }
  };

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
          {([
            { key: "open", label: `Open (${statusCounts.open + statusCounts.regression})` },
            { key: "resolved", label: `Resolved (${statusCounts.resolved})` },
            { key: "all", label: `All (${statusCounts.all})` },
          ] as const).map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === s.key ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {s.label}
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
        <button
          onClick={markAllOpenResolved}
          disabled={openGroupsCount === 0 || bulkBusy}
          className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Mark every Open or Regression group in the current view as resolved. Regressions auto-reopen if new events of the same signature arrive afterwards."
        >
          {bulkBusy ? "Resolving…" : `Mark ${openGroupsCount} as resolved`}
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
                <th className="text-left px-4 py-3 font-medium">Status</th>
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
                    <tr className={`hover:bg-gray-50/50 ${expanded ? "bg-emerald-50/30" : ""} ${g.status === "resolved" ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(g.lastSeen).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        {g.status === "resolved" && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">
                            Resolved
                          </span>
                        )}
                        {g.status === "regression" && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-orange-100 text-orange-800" title="New events have arrived since this group was marked resolved.">
                            Regression
                          </span>
                        )}
                        {g.status === "open" && (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
                            Open
                          </span>
                        )}
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
                        <td colSpan={8} className="px-4 py-4">
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
                            {(g.status === "resolved" || g.status === "regression") && g.lastResolvedAt && (
                              <div className="text-[11px] text-gray-500">
                                Marked resolved {new Date(g.lastResolvedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                {g.resolvedBy && <> by {g.resolvedBy}</>}
                                {g.status === "regression" && <> · {g.count - g.resolvedCount} new event{g.count - g.resolvedCount === 1 ? "" : "s"} since</>}
                              </div>
                            )}
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                              {g.status === "resolved" ? (
                                <button
                                  onClick={() => markResolved(g, false)}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
                                >
                                  Reopen
                                </button>
                              ) : (
                                <button
                                  onClick={() => markResolved(g, true)}
                                  className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-200 rounded hover:bg-emerald-50"
                                >
                                  {g.status === "regression" ? "Mark resolved (again)" : "Mark resolved"}
                                </button>
                              )}
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
