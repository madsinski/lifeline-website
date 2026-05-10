"use client";

// AI recommendation feedback viewer.
// Mirrors /admin/errors UX: grouped table, filter pills, copy-all
// for Claude triage, mark-resolved workflow. Backed by the
// ai_recommendation_feedback table populated from the RN app
// when a user reports a recommendation as wrong-for-them.
//
// Pattern escalation lives here too — we don't auto-route to a clinician
// because there is no clinician. Mads (admin) is also the doctor; this
// page is the loop-closing surface where he tunes the prompt/filter and
// marks the underlying recommendation pattern as applied/dismissed.

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStaffGuard } from "@/lib/useStaffGuard";

interface FeedbackRow {
  id: string;
  recommendation_id: string | null;
  client_id: string;
  reason: "allergen" | "unsafe" | "too_intense" | "too_easy" | "not_for_me_today" | "other";
  notes: string | null;
  status: "open" | "reviewed" | "applied" | "dismissed";
  resolved_at: string | null;
  resolved_by_name: string | null;
  created_at: string;
}

interface RecommendationRow {
  id: string;
  type: "mode" | "priority" | "program_item";
  input_snapshot: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  reason_text: string | null;
  model: string | null;
  user_action: string | null;
  created_at: string;
}

interface AiSummary {
  // Not persisted server-side — regenerate-on-demand keeps the schema
  // surface small. Held in component state for the session only.
  summary_md: string;
  themes: { title: string; description: string }[];
  concerns: { title: string; description: string; severity: "low" | "medium" | "high" }[];
  action_items: { title: string; description: string; priority: "low" | "medium" | "high" }[];
  responses_count: number;
  model: string;
  generated_at: string;
}

const REASON_LABELS: Record<FeedbackRow["reason"], string> = {
  allergen: "Allergen / dietary",
  unsafe: "Unsafe for me",
  too_intense: "Too intense",
  too_easy: "Too easy",
  not_for_me_today: "Not for me today",
  other: "Other",
};

const REASON_STYLES: Record<FeedbackRow["reason"], string> = {
  allergen: "bg-amber-100 text-amber-800",
  unsafe: "bg-red-100 text-red-800",
  too_intense: "bg-orange-100 text-orange-800",
  too_easy: "bg-blue-100 text-blue-800",
  not_for_me_today: "bg-gray-100 text-gray-700",
  other: "bg-gray-100 text-gray-700",
};

const STATUS_STYLES: Record<FeedbackRow["status"], string> = {
  open: "bg-gray-100 text-gray-700",
  reviewed: "bg-blue-100 text-blue-800",
  applied: "bg-emerald-100 text-emerald-800",
  dismissed: "bg-gray-200 text-gray-500",
};

type Window = "24h" | "7d" | "30d" | "all";
const WINDOW_LABELS: Record<Window, string> = {
  "24h": "Last 24h",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

function windowToCutoff(w: Window): Date | null {
  const now = Date.now();
  switch (w) {
    case "24h": return new Date(now - 24 * 60 * 60 * 1000);
    case "7d": return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d": return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "all": return null;
  }
}

export default function AiFeedbackPage() {
  const guard = useStaffGuard({ role: "admin" });
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [recsById, setRecsById] = useState<Map<string, RecommendationRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [windowSel, setWindowSel] = useState<Window>("30d");
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "all">("open");
  const [reasonFilter, setReasonFilter] = useState<"all" | FeedbackRow["reason"]>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [summary, setSummary] = useState<AiSummary | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("ai_recommendation_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      const cutoff = windowToCutoff(windowSel);
      if (cutoff) q = q.gte("created_at", cutoff.toISOString());
      const { data: fbData } = await q;
      const fb = (fbData || []) as FeedbackRow[];
      setRows(fb);

      // Hydrate the originating recommendation rows for any feedback
      // that has a non-null recommendation_id. Single batched query
      // so the table doesn't N+1 on expand.
      const recIds = Array.from(new Set(fb.map((r) => r.recommendation_id).filter((x): x is string => !!x)));
      if (recIds.length > 0) {
        const { data: recData } = await supabase
          .from("ai_recommendation_log")
          .select("id, type, input_snapshot, output, reason_text, model, user_action, created_at")
          .in("id", recIds);
        const map = new Map<string, RecommendationRow>();
        for (const r of (recData || []) as RecommendationRow[]) map.set(r.id, r);
        setRecsById(map);
      } else {
        setRecsById(new Map());
      }
    } finally {
      setLoading(false);
    }
  }, [windowSel]);

  useEffect(() => {
    if (guard.authorized) load();
  }, [guard.authorized, load]);

  const filtered = useMemo(() => {
    let r = rows;
    if (reasonFilter !== "all") r = r.filter((x) => x.reason === reasonFilter);
    if (statusFilter === "open") r = r.filter((x) => x.status === "open" || x.status === "reviewed");
    else if (statusFilter === "resolved") r = r.filter((x) => x.status === "applied" || x.status === "dismissed");
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((x) =>
      (x.notes || "").toLowerCase().includes(q)
      || x.reason.toLowerCase().includes(q)
      || (x.client_id || "").toLowerCase().includes(q),
    );
    return r;
  }, [rows, reasonFilter, statusFilter, search]);

  // Group by reason + recommendation output signature so a recurring
  // wrong-recommendation surfaces as one row with a count, not five.
  // Pattern escalation kicks in at count >= 3 (the user's stated threshold).
  type GroupStatus = "open" | "resolved";
  interface Group {
    key: string;
    sample: FeedbackRow;
    count: number;
    lastSeen: string;
    status: GroupStatus;
    uniqueClients: number;
    escalated: boolean;
  }
  const grouped = useMemo(() => {
    const map = new Map<string, Group & { clientSet: Set<string>; allRows: FeedbackRow[] }>();
    for (const f of filtered) {
      const rec = f.recommendation_id ? recsById.get(f.recommendation_id) : null;
      const outputSig = rec?.output ? JSON.stringify(rec.output) : "";
      const key = `${f.reason}::${rec?.type || "unknown"}::${outputSig.slice(0, 200)}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          sample: f,
          count: 1,
          lastSeen: f.created_at,
          status: f.status === "open" || f.status === "reviewed" ? "open" : "resolved",
          uniqueClients: 1,
          escalated: false,
          clientSet: new Set([f.client_id]),
          allRows: [f],
        });
      } else {
        existing.count += 1;
        existing.allRows.push(f);
        existing.clientSet.add(f.client_id);
        if (f.created_at > existing.lastSeen) existing.lastSeen = f.created_at;
        if (f.status === "open" || f.status === "reviewed") existing.status = "open";
      }
    }
    return Array.from(map.values()).map((g) => ({
      key: g.key,
      sample: g.sample,
      count: g.count,
      lastSeen: g.lastSeen,
      status: g.status,
      uniqueClients: g.clientSet.size,
      escalated: g.count >= 3,
      allRows: g.allRows,
    })).sort((a, b) => {
      // Escalated patterns float to the top, then by recency.
      if (a.escalated !== b.escalated) return a.escalated ? -1 : 1;
      return a.lastSeen < b.lastSeen ? 1 : -1;
    });
  }, [filtered, recsById]);

  const statusCounts = useMemo(() => {
    let open = 0, resolved = 0;
    for (const r of rows) {
      if (r.status === "open" || r.status === "reviewed") open += 1;
      else resolved += 1;
    }
    return { open, resolved, all: rows.length };
  }, [rows]);

  const escalatedCount = useMemo(
    () => grouped.filter((g) => g.escalated && g.status === "open").length,
    [grouped],
  );

  const resolverDisplayName = useCallback(async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return null;
    const { data: staffRow } = await supabase.from("staff").select("name").eq("email", user.email).maybeSingle();
    return staffRow?.name || user.email;
  }, []);

  const updateStatus = async (g: { allRows: FeedbackRow[] }, status: FeedbackRow["status"]) => {
    const ids = g.allRows.map((r) => r.id);
    const isResolution = status === "applied" || status === "dismissed";
    const resolverName = isResolution ? await resolverDisplayName() : null;
    const { data, error } = await supabase
      .from("ai_recommendation_feedback")
      .update({
        status,
        resolved_at: isResolution ? new Date().toISOString() : null,
        resolved_by_name: isResolution ? resolverName : null,
      })
      .in("id", ids)
      .select("id");
    if (error) { alert(`Could not update: ${error.message}`); return; }
    if (!data || data.length === 0) {
      alert("0 rows updated — RLS may be blocking. Check the Admin updates ai feedback policy.");
      return;
    }
    await load();
  };

  const [copiedAll, setCopiedAll] = useState(false);
  const copyAll = async () => {
    if (grouped.length === 0) return;
    const header = [
      `# Lifeline AI feedback digest`,
      `Window: ${WINDOW_LABELS[windowSel]} (${grouped.length} group${grouped.length === 1 ? "" : "s"}, ${filtered.length} report${filtered.length === 1 ? "" : "s"})`,
      reasonFilter !== "all" ? `Reason filter: ${reasonFilter}` : null,
      search.trim() ? `Search: "${search.trim()}"` : null,
      escalatedCount > 0 ? `Escalated patterns: ${escalatedCount} (≥3 reports of the same recommendation)` : null,
      `Generated: ${new Date().toISOString()}`,
    ].filter(Boolean).join("\n");

    const blocks = grouped.map((g, i) => {
      const f = g.sample;
      const rec = f.recommendation_id ? recsById.get(f.recommendation_id) : null;
      return [
        `## ${i + 1}. [${REASON_LABELS[f.reason]}] ${g.escalated ? "⚠️ ESCALATED · " : ""}${g.count} report${g.count === 1 ? "" : "s"} from ${g.uniqueClients} client${g.uniqueClients === 1 ? "" : "s"}`,
        `Last seen: ${g.lastSeen} · Status: ${g.status}`,
        rec ? `Recommendation type: ${rec.type}` : null,
        rec?.output ? `Output: ${JSON.stringify(rec.output)}` : null,
        rec?.reason_text ? `Model rationale: ${rec.reason_text}` : null,
        rec?.input_snapshot ? `Input snapshot: ${JSON.stringify(rec.input_snapshot).slice(0, 1500)}` : null,
        f.notes ? `\nUser notes:\n"${f.notes}"` : null,
      ].filter(Boolean).join("\n");
    }).join("\n\n");

    try {
      await navigator.clipboard.writeText(`${header}\n\n${blocks}\n`);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1800);
    } catch {
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(`<pre style="white-space:pre-wrap;font:12px monospace;padding:1rem">${header}\n\n${blocks}</pre>`);
      }
    }
  };

  const generateSummary = async () => {
    setSummaryBusy(true);
    setSummaryError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { setSummaryError("Not authenticated."); return; }
      const res = await fetch("/api/admin/ai-feedback/summary", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setSummaryError(j?.error || "Summary failed");
        return;
      }
      setSummary(j.summary);
    } catch (e) {
      setSummaryError((e as Error).message);
    } finally {
      setSummaryBusy(false);
    }
  };

  if (guard.loading) return <div className="p-8 text-center text-gray-500">Loading…</div>;
  if (!guard.authorized) return <div className="p-8 text-center text-red-600 text-sm">Admin access required.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1F2937]">AI feedback</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          Users tap <em>&quot;Doesn&apos;t feel right&quot;</em> on an AI recommendation in the app
          and a row lands here. Grouped by reason + recommendation signature, so a
          recurring wrong-pick reads as one escalated pattern. Patterns with ≥3 reports
          float to the top and need a prompt/filter tweak.
        </p>
        {escalatedCount > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-800 rounded-lg text-xs font-medium">
            <span className="w-2 h-2 bg-orange-500 rounded-full" />
            {escalatedCount} escalated pattern{escalatedCount === 1 ? "" : "s"} need attention
          </div>
        )}
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
            { key: "open", label: `Open (${statusCounts.open})` },
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
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value as typeof reasonFilter)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-700"
        >
          <option value="all">All reasons</option>
          {(Object.keys(REASON_LABELS) as FeedbackRow["reason"][]).map((r) => (
            <option key={r} value={r}>{REASON_LABELS[r]}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search notes, client id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-72"
        />
        <button
          onClick={copyAll}
          disabled={grouped.length === 0}
          className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Copy a Claude-friendly digest of every group in the current view"
        >
          {copiedAll ? `Copied ${grouped.length} ✓` : `Copy all (${grouped.length})`}
        </button>
        <button
          onClick={generateSummary}
          disabled={summaryBusy || rows.length === 0}
          className="px-3 py-1.5 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Use OpenAI gpt-5.4 to summarise patterns + propose prompt/filter changes"
        >
          {summaryBusy ? "Summarising…" : summary ? "Regenerate summary" : "Generate AI summary"}
        </button>
        <button onClick={load} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg">
          Refresh
        </button>
      </div>

      {/* AI summary card */}
      {summaryError && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl p-4">
          {summaryError}
        </div>
      )}
      {summary && (
        <div className="bg-white border border-violet-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-violet-700 font-semibold uppercase tracking-wide">AI summary · {summary.model}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {summary.responses_count} report{summary.responses_count === 1 ? "" : "s"} ·
                Generated {new Date(summary.generated_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-800 whitespace-pre-wrap">
            {summary.summary_md}
          </div>
          {summary.concerns && summary.concerns.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Concerns</div>
              <div className="space-y-2">
                {summary.concerns.map((c, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        c.severity === "high" ? "bg-red-100 text-red-800"
                        : c.severity === "medium" ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-700"
                      }`}>{c.severity}</span>
                      <span className="text-sm font-medium text-gray-800">{c.title}</span>
                    </div>
                    <div className="text-xs text-gray-600">{c.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {summary.action_items && summary.action_items.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Suggested prompt/filter changes</div>
              <div className="space-y-2">
                {summary.action_items.map((a, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        a.priority === "high" ? "bg-red-100 text-red-800"
                        : a.priority === "medium" ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-700"
                      }`}>{a.priority}</span>
                      <span className="text-sm font-medium text-gray-800">{a.title}</span>
                    </div>
                    <div className="text-xs text-gray-600">{a.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading feedback…</div>
      ) : grouped.length === 0 ? (
        <div className="p-12 text-center text-gray-500 text-sm bg-white rounded-xl shadow-sm border border-gray-100">
          No feedback in this window. Either the AI is doing well, or no recommendations have shipped yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Last seen</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Reason</th>
                <th className="text-left px-4 py-3 font-medium w-1/2">Recommendation</th>
                <th className="text-left px-4 py-3 font-medium">Reports</th>
                <th className="text-left px-4 py-3 font-medium">Clients</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grouped.map((g) => {
                const f = g.sample;
                const rec = f.recommendation_id ? recsById.get(f.recommendation_id) : null;
                const expanded = openId === g.key;
                const recLabel = rec?.output
                  ? (rec.output as { label?: string; mode?: string; key?: string }).label
                    || (rec.output as { mode?: string }).mode
                    || (rec.output as { key?: string }).key
                    || JSON.stringify(rec.output).slice(0, 80)
                  : "(no recommendation snapshot)";
                return (
                  <Fragment key={g.key}>
                    <tr className={`hover:bg-gray-50/50 ${expanded ? "bg-emerald-50/30" : ""} ${g.status === "resolved" ? "opacity-60" : ""} ${g.escalated && g.status === "open" ? "bg-orange-50/30" : ""}`}>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(g.lastSeen).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        {g.escalated && g.status === "open" && (
                          <span className="inline-block px-2 py-0.5 mr-1 rounded text-[11px] font-medium bg-orange-100 text-orange-800" title="≥3 reports of the same recommendation. Pattern needs a prompt/filter tweak.">
                            Escalated
                          </span>
                        )}
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${STATUS_STYLES[f.status]}`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${REASON_STYLES[f.reason]}`}>
                          {REASON_LABELS[f.reason]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium truncate max-w-md" title={recLabel}>
                        {rec?.type && (
                          <span className="text-[10px] px-1.5 py-0.5 mr-2 rounded bg-gray-100 text-gray-600 font-mono">
                            {rec.type}
                          </span>
                        )}
                        {recLabel}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded font-semibold ${g.count >= 3 ? "bg-orange-100 text-orange-800" : g.count > 1 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                          {g.count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{g.uniqueClients}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setOpenId(expanded ? null : g.key)}
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
                            {rec && (
                              <>
                                <div>
                                  <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">Recommendation output</div>
                                  <pre className="text-[11px] text-gray-700 font-mono whitespace-pre-wrap bg-white border border-gray-200 rounded p-2 max-h-48 overflow-y-auto">
                                    {JSON.stringify(rec.output, null, 2)}
                                  </pre>
                                </div>
                                {rec.reason_text && (
                                  <div>
                                    <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">Model rationale</div>
                                    <div className="text-gray-700 italic">{rec.reason_text}</div>
                                  </div>
                                )}
                                {rec.input_snapshot && (
                                  <div>
                                    <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">Input snapshot</div>
                                    <pre className="text-[11px] text-gray-700 font-mono whitespace-pre-wrap bg-white border border-gray-200 rounded p-2 max-h-48 overflow-y-auto">
                                      {JSON.stringify(rec.input_snapshot, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">Model</div>
                                    <div className="text-gray-700 font-mono">{rec.model || "—"}</div>
                                  </div>
                                  <div>
                                    <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">Recommendation made</div>
                                    <div className="text-gray-700">{new Date(rec.created_at).toLocaleString("en-GB")}</div>
                                  </div>
                                </div>
                              </>
                            )}
                            <div>
                              <div className="text-gray-400 uppercase font-semibold tracking-wide mb-1">User reports ({g.allRows.length})</div>
                              <div className="space-y-2">
                                {g.allRows.map((r) => (
                                  <div key={r.id} className="bg-white border border-gray-200 rounded p-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${REASON_STYLES[r.reason]}`}>
                                        {REASON_LABELS[r.reason]}
                                      </span>
                                      <span className="text-[10px] text-gray-500">
                                        client {r.client_id.slice(0, 8)}… · {new Date(r.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-auto ${STATUS_STYLES[r.status]}`}>
                                        {r.status}
                                      </span>
                                    </div>
                                    {r.notes && <div className="text-gray-700 italic">&quot;{r.notes}&quot;</div>}
                                    {r.resolved_by_name && (
                                      <div className="text-[10px] text-gray-400 mt-1">
                                        Resolved by {r.resolved_by_name} {r.resolved_at ? `at ${new Date(r.resolved_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                              {g.status === "open" ? (
                                <>
                                  <button
                                    onClick={() => updateStatus(g, "applied")}
                                    className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-200 rounded hover:bg-emerald-50"
                                    title="Prompt/filter has been updated to address this. Closes the loop."
                                  >
                                    Mark applied
                                  </button>
                                  <button
                                    onClick={() => updateStatus(g, "reviewed")}
                                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50"
                                    title="Reviewed but no change needed yet — keep watching."
                                  >
                                    Mark reviewed
                                  </button>
                                  <button
                                    onClick={() => updateStatus(g, "dismissed")}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
                                  >
                                    Dismiss
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => updateStatus(g, "open")}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
                                >
                                  Reopen
                                </button>
                              )}
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
