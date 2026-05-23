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
  runtime: "browser" | "server" | "edge" | "mobile" | null;
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
  // MDR triage upgrade
  resolution_note: string | null;
  resolved_in_version: string | null;
  resolved_in_commit_sha: string | null;
  resolved_in_release_id: string | null;
  risk_register_ids: string[] | null;
  triage_status: "dev_noise" | "wontfix" | "duplicate" | null;
  triage_severity: "cosmetic" | "low" | "medium" | "high" | "critical" | null;
  triage_category: string | null;
}

interface AppRelease {
  id: string;
  repo: string;
  version: string;
  build_number: string | null;
  channel: string;
  git_sha: string;
  released_at: string;
}

interface ErrorHistoryRow {
  id: string;
  changed_at: string;
  changed_by_name: string | null;
  changed_by_email: string | null;
  prev_resolved_at: string | null;
  new_resolved_at: string | null;
  prev_resolution_note: string | null;
  new_resolution_note: string | null;
  prev_resolved_in_version: string | null;
  new_resolved_in_version: string | null;
  prev_resolved_in_commit_sha: string | null;
  new_resolved_in_commit_sha: string | null;
  prev_triage_status: string | null;
  new_triage_status: string | null;
  prev_triage_severity: string | null;
  new_triage_severity: string | null;
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
  mobile: "bg-orange-100 text-orange-700",
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
  const [runtimeFilter, setRuntimeFilter] = useState<"all" | "browser" | "server" | "edge" | "mobile">("all");
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "all">("open");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  // MDR-grade resolve dialog state.
  const [resolveTarget, setResolveTarget] = useState<{ sample: AppError; count: number } | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveVersion, setResolveVersion] = useState("");
  const [resolveCommit, setResolveCommit] = useState("");
  const [resolveSeverity, setResolveSeverity] = useState<AppError["triage_severity"]>(null);
  const [resolveCategory, setResolveCategory] = useState<string>("");
  const [resolveBusy, setResolveBusy] = useState(false);
  const [latestRelease, setLatestRelease] = useState<AppRelease | null>(null);
  // History viewer state (per-row, lazy fetch).
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [historyRows, setHistoryRows] = useState<ErrorHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  // Fetch the latest release once so the resolve modal can pre-fill
  // version + commit. Best-effort — if no releases registered yet,
  // user types manually.
  useEffect(() => {
    if (!guard.authorized) return;
    (async () => {
      const { data } = await supabase
        .from("app_releases")
        .select("id, repo, version, build_number, channel, git_sha, released_at")
        .order("released_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setLatestRelease(data as AppRelease);
    })();
  }, [guard.authorized]);

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

  // Reopen → straight update, no modal. Resolve → opens the modal
  // so the admin captures a note + version + commit, which writes a
  // history row via the trigger.
  const reopenGroup = async (g: Group) => {
    const sample = g.sample;
    let q = supabase
      .from("app_errors")
      .update({
        resolved_at: null,
        resolved_by_name: null,
        // Intentionally leave resolution_note + version + commit in
        // place — the history table preserves the timeline, and the
        // most-recent resolution context stays visible for the next
        // resolve cycle. Re-resolving overwrites them.
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

  const openResolveDialog = (g: Group) => {
    const sample = g.sample;
    setResolveTarget({ sample, count: g.count });
    // Seed with the previous resolution's values if this is a
    // regression re-resolve (so the admin doesn't retype).
    setResolveNote(sample.resolution_note ?? "");
    setResolveVersion(sample.resolved_in_version ?? latestRelease?.version ?? "");
    setResolveCommit(sample.resolved_in_commit_sha ?? latestRelease?.git_sha ?? "");
    setResolveSeverity(sample.triage_severity ?? null);
    setResolveCategory(sample.triage_category ?? "");
  };

  const confirmResolve = async () => {
    if (!resolveTarget) return;
    if (!resolveNote.trim()) {
      alert("Resolution note is required — capture the why / fix / commit for the MDR audit trail.");
      return;
    }
    setResolveBusy(true);
    try {
      const resolverName = await resolverDisplayName();
      const sample = resolveTarget.sample;
      let q = supabase
        .from("app_errors")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by_name: resolverName,
          resolution_note: resolveNote.trim(),
          resolved_in_version: resolveVersion.trim() || null,
          resolved_in_commit_sha: resolveCommit.trim() || null,
          resolved_in_release_id: latestRelease?.id ?? null,
          triage_severity: resolveSeverity,
          triage_category: resolveCategory || null,
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
      setResolveTarget(null);
      await load();
    } finally {
      setResolveBusy(false);
    }
  };

  // Mark a group as triage_status = 'dev_noise' or similar without
  // closing it as "resolved". Lets us clear HMR junk without
  // destroying rows.
  const setTriageStatus = async (g: Group, status: AppError["triage_status"]) => {
    const sample = g.sample;
    let q = supabase
      .from("app_errors")
      .update({ triage_status: status })
      .eq("message", sample.message)
      .eq("runtime", sample.runtime || "");
    if (sample.pathname) q = q.eq("pathname", sample.pathname);
    else q = q.is("pathname", null);
    const { error } = await q;
    if (error) { alert(`Could not update: ${error.message}`); return; }
    await load();
  };

  // Lazy-load the history rows when the user expands the timeline.
  const loadHistory = async (errorId: string) => {
    setHistoryLoading(true);
    setHistoryFor(errorId);
    try {
      const { data } = await supabase
        .from("app_errors_status_history")
        .select("*")
        .eq("app_error_id", errorId)
        .order("changed_at", { ascending: false });
      setHistoryRows((data as ErrorHistoryRow[]) ?? []);
    } finally {
      setHistoryLoading(false);
    }
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
    // Shared note is required even for bulk — the history trigger
    // captures it per row so the audit trail stays defensible.
    const note = prompt(`Mark ${targets.length} open group${targets.length === 1 ? "" : "s"} as resolved.\n\nShared resolution note (required — pasted into every row's resolution_note for MDR audit):`);
    if (note === null) return;
    if (!note.trim()) { alert("Resolution note is required."); return; }
    setBulkBusy(true);
    try {
      const resolverName = await resolverDisplayName();
      const resolvedAt = new Date().toISOString();
      const sharedVersion = latestRelease?.version ?? null;
      const sharedCommit = latestRelease?.git_sha ?? null;
      const sharedReleaseId = latestRelease?.id ?? null;
      const updates = await Promise.all(targets.map(async (g) => {
        const sample = g.sample;
        let q = supabase
          .from("app_errors")
          .update({
            resolved_at: resolvedAt,
            resolved_by_name: resolverName,
            resolution_note: note.trim(),
            resolved_in_version: sharedVersion,
            resolved_in_commit_sha: sharedCommit,
            resolved_in_release_id: sharedReleaseId,
          })
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
          {(["all", "browser", "server", "edge", "mobile"] as const).map((r) => (
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
                            {/* Existing resolution context — shown when previously
                                resolved so the admin can see the note + version + commit
                                before deciding whether to re-resolve. */}
                            {(g.status === "resolved" || g.status === "regression") && (e.resolution_note || e.resolved_in_version) && (
                              <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900">
                                <div className="font-semibold mb-1">Last resolution</div>
                                {e.resolution_note && <div className="whitespace-pre-wrap mb-1">{e.resolution_note}</div>}
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-emerald-700">
                                  {e.resolved_in_version && <span>Version: <span className="font-mono">{e.resolved_in_version}</span></span>}
                                  {e.resolved_in_commit_sha && <span>Commit: <span className="font-mono">{e.resolved_in_commit_sha.slice(0, 12)}</span></span>}
                                  {e.triage_severity && <span>Severity: {e.triage_severity}</span>}
                                  {e.triage_category && <span>Category: {e.triage_category}</span>}
                                </div>
                              </div>
                            )}

                            {/* Timeline / status history (lazy-loaded). The
                                history trigger captures every triage change so
                                we can replay resolved → reopened → re-resolved. */}
                            <div>
                              {historyFor === e.id ? (
                                <div className="rounded border border-gray-200 bg-white p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide">Status history</div>
                                    <button
                                      onClick={() => { setHistoryFor(null); setHistoryRows([]); }}
                                      className="text-[11px] text-gray-500 hover:text-gray-700"
                                    >Hide</button>
                                  </div>
                                  {historyLoading ? (
                                    <div className="text-[11px] text-gray-400">Loading…</div>
                                  ) : historyRows.length === 0 ? (
                                    <div className="text-[11px] text-gray-400">No prior changes recorded.</div>
                                  ) : (
                                    <ul className="space-y-2">
                                      {historyRows.map((h) => {
                                        const wasResolved = !!h.prev_resolved_at;
                                        const isResolved = !!h.new_resolved_at;
                                        const verb = !wasResolved && isResolved ? "Resolved"
                                                   : wasResolved && !isResolved ? "Reopened"
                                                   : "Updated";
                                        return (
                                          <li key={h.id} className="text-[11px] text-gray-700">
                                            <span className="font-semibold">{verb}</span>
                                            {" "}
                                            <span className="text-gray-500">
                                              {new Date(h.changed_at).toLocaleString("en-GB")}
                                              {h.changed_by_name && <> · {h.changed_by_name}</>}
                                            </span>
                                            {h.new_resolution_note && h.new_resolution_note !== h.prev_resolution_note && (
                                              <div className="mt-1 pl-3 border-l-2 border-gray-200 whitespace-pre-wrap text-gray-600">
                                                {h.new_resolution_note}
                                              </div>
                                            )}
                                            {h.new_resolved_in_version && (
                                              <div className="text-[10px] text-gray-500 mt-0.5 pl-3">
                                                Fixed in <span className="font-mono">v{h.new_resolved_in_version}</span>
                                                {h.new_resolved_in_commit_sha && <> · <span className="font-mono">{h.new_resolved_in_commit_sha.slice(0, 7)}</span></>}
                                              </div>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => loadHistory(e.id)}
                                  className="text-[11px] text-blue-700 hover:underline"
                                >
                                  Show status history
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-gray-200 flex-wrap">
                              {g.status === "resolved" ? (
                                <button
                                  onClick={() => reopenGroup(g)}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
                                >
                                  Reopen
                                </button>
                              ) : (
                                <button
                                  onClick={() => openResolveDialog(g)}
                                  className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-200 rounded hover:bg-emerald-50"
                                >
                                  {g.status === "regression" ? "Mark resolved (again)…" : "Mark resolved…"}
                                </button>
                              )}
                              <button
                                onClick={() => setTriageStatus(g, "dev_noise")}
                                className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-white border border-amber-200 rounded hover:bg-amber-50"
                                title="Tag as dev-only HMR / React Refresh artifact. Preserves the row but flags it as not real."
                              >
                                Tag dev noise
                              </button>
                              <button
                                onClick={() => setTriageStatus(g, "wontfix")}
                                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
                              >
                                Wontfix
                              </button>
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
                                className="ml-auto px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded hover:bg-red-50"
                                title="Hard delete — the row and its status history disappear. Prefer 'Wontfix' or 'Tag dev noise' to preserve the audit trail."
                              >
                                Delete
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

      {/* Resolution modal — captures the MDR-grade fields (note,
          version, commit, severity, category). Required note;
          version + commit pre-filled from the most recent
          app_releases row. */}
      {resolveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !resolveBusy && setResolveTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-xl w-full p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3">
              <h3 className="text-base font-semibold text-gray-900">Resolve error group</h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{resolveTarget.sample.message}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                {resolveTarget.count} event{resolveTarget.count === 1 ? "" : "s"} · {resolveTarget.sample.runtime} · {resolveTarget.sample.pathname || "no path"}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">
                  Resolution note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  rows={3}
                  placeholder="What was the root cause + the fix. e.g. 'Null guard at ConsistencyCard:212; deeper fix tracked in R-2026-007.'"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">Becomes the audit-trail entry. Searchable by other admins + auditors.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Fixed in version</label>
                  <input
                    type="text"
                    value={resolveVersion}
                    onChange={(e) => setResolveVersion(e.target.value)}
                    placeholder="0.1.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Commit sha</label>
                  <input
                    type="text"
                    value={resolveCommit}
                    onChange={(e) => setResolveCommit(e.target.value)}
                    placeholder="e273aa64f3ba…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                  />
                </div>
              </div>
              {latestRelease && (
                <div className="text-[10px] text-gray-500 -mt-1">
                  Pre-filled from latest release: v{latestRelease.version} · {latestRelease.git_sha.slice(0, 12)}. Override if you've cut a newer one.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Triage severity</label>
                  <select
                    value={resolveSeverity ?? ""}
                    onChange={(e) => setResolveSeverity((e.target.value || null) as AppError["triage_severity"])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">—</option>
                    <option value="cosmetic">cosmetic</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase font-semibold text-gray-500 tracking-wide mb-1">Category</label>
                  <select
                    value={resolveCategory}
                    onChange={(e) => setResolveCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">—</option>
                    {["data-integrity","clinical","privacy","security","availability","usability","regression","infra","other"].map((c) =>
                      <option key={c} value={c}>{c}</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setResolveTarget(null)}
                disabled={resolveBusy}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmResolve}
                disabled={resolveBusy || !resolveNote.trim()}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded disabled:opacity-50"
              >
                {resolveBusy ? "Saving…" : "Resolve + audit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
