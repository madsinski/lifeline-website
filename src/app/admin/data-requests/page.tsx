"use client";

// Admin queue for Data Subject Rights requests (GDPR Arts. 15-22 / Lög 90/2018).
// Reads dsr_requests, filtered by status, with inline status transitions and
// resolution-notes capture so every request leaves a complete audit trail.
//
// Fulfilment runbook with copy-paste SQL: supabase/runbooks/dsr-runbook.md.

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useStaffGuard } from "@/lib/useStaffGuard";

type Status = "received" | "in_progress" | "completed" | "withdrawn" | "rejected";

type RequestType =
  | "access"
  | "rectification"
  | "erasure"
  | "restriction"
  | "portability"
  | "objection"
  | "withdraw_consent";

interface DsrRow {
  id: string;
  client_id: string;
  client_email: string | null;
  request_type: RequestType;
  details: string | null;
  status: Status;
  ip: string | null;
  user_agent: string | null;
  submitted_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

interface ClientLite {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  kennitala_last4: string | null;
  company_id: string | null;
}

const TYPE_LABELS: Record<RequestType, string> = {
  access: "Get a copy of all my data",
  rectification: "Correct something",
  erasure: "Delete account & data",
  restriction: "Pause processing",
  portability: "Export to another service",
  objection: "Stop a specific processing",
  withdraw_consent: "Withdraw consent",
};

const ARTICLE_REFS: Record<RequestType, string> = {
  access: "Art. 15",
  rectification: "Art. 16",
  erasure: "Art. 17",
  restriction: "Art. 18",
  portability: "Art. 20",
  objection: "Art. 21",
  withdraw_consent: "Art. 7(3)",
};

const STATUS_LABELS: Record<Status, string> = {
  received: "Received",
  in_progress: "In progress",
  completed: "Completed",
  withdrawn: "Withdrawn",
  rejected: "Rejected",
};

const STATUS_STYLES: Record<Status, string> = {
  received: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  withdrawn: "bg-gray-100 text-gray-700",
  rejected: "bg-red-100 text-red-800",
};

type FilterTab = "open" | "all" | "completed";

export default function DataRequestsPage() {
  const guard = useStaffGuard({ role: "admin" });
  const [rows, setRows] = useState<DsrRow[]>([]);
  const [clients, setClients] = useState<Record<string, ClientLite>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("dsr_requests")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      const list = (data || []) as DsrRow[];
      setRows(list);
      // Hydrate client info in one round-trip.
      const ids = Array.from(new Set(list.map((r) => r.client_id)));
      if (ids.length > 0) {
        const { data: cs } = await supabase
          .from("clients")
          .select("id, full_name, email, phone, kennitala_last4, company_id")
          .in("id", ids);
        const map: Record<string, ClientLite> = {};
        for (const c of (cs || []) as ClientLite[]) map[c.id] = c;
        setClients(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (guard.authorized) load();
  }, [guard.authorized, load]);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    if (tab === "completed") return rows.filter((r) => r.status === "completed");
    return rows.filter((r) => r.status === "received" || r.status === "in_progress");
  }, [rows, tab]);

  const counts = useMemo(() => {
    return {
      open: rows.filter((r) => r.status === "received" || r.status === "in_progress").length,
      all: rows.length,
      completed: rows.filter((r) => r.status === "completed").length,
    };
  }, [rows]);

  const transition = async (row: DsrRow, next: Status) => {
    setBusyId(row.id);
    try {
      const patch: Partial<DsrRow> = { status: next };
      if (next === "in_progress" && !row.acknowledged_at) {
        patch.acknowledged_at = new Date().toISOString();
      }
      if (next === "completed" || next === "withdrawn" || next === "rejected") {
        patch.resolved_at = new Date().toISOString();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) patch.resolved_by = user.id;
        const draft = notesDraft[row.id];
        if (draft && draft.trim()) patch.resolution_notes = draft.trim();
      }
      const { error } = await supabase.from("dsr_requests").update(patch).eq("id", row.id);
      if (error) throw error;
      await load();
    } catch (e) {
      alert("Update failed: " + (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (guard.loading) {
    return <div className="p-8 text-center text-gray-500">Loading…</div>;
  }
  if (!guard.authorized) {
    return (
      <div className="p-8 text-center text-red-600 text-sm">
        Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Privacy requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Data Subject Rights queue. Respond within 30 days (GDPR Art. 12(3)).
          </p>
        </div>
        <a
          href="https://github.com/madsinski/lifeline-website/blob/main/supabase/runbooks/dsr-runbook.md"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
        >
          Open fulfilment runbook ↗
        </a>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {(["open", "all", "completed"] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === t
                ? "border-emerald-500 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "open" ? "Open" : t === "completed" ? "Completed" : "All"}
            <span className={`ml-2 text-xs ${tab === t ? "text-emerald-600" : "text-gray-400"}`}>
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading requests…</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-gray-500 text-sm bg-white rounded-xl shadow-sm border border-gray-100">
          No requests in this view.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Submitted</th>
                <th className="text-left px-4 py-3 font-medium">Requester</th>
                <th className="text-left px-4 py-3 font-medium">What they asked for</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Deadline</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((row) => {
                const c = clients[row.client_id];
                const submittedAt = new Date(row.submitted_at);
                const deadline = new Date(submittedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
                const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const overdue = daysLeft < 0 && row.status !== "completed" && row.status !== "withdrawn" && row.status !== "rejected";
                const expanded = openId === row.id;

                return (
                  <Fragment key={row.id}>
                    <tr className={`hover:bg-gray-50/50 ${expanded ? "bg-emerald-50/30" : ""}`}>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        <div className="text-xs text-gray-400">
                          {submittedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c?.full_name || "—"}</div>
                        <div className="text-xs text-gray-500">{c?.email || row.client_email || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{TYPE_LABELS[row.request_type]}</div>
                        <div className="text-xs text-gray-400">GDPR {ARTICLE_REFS[row.request_type]}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[row.status]}`}>
                          {STATUS_LABELS[row.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className={overdue ? "text-red-600 font-medium" : "text-gray-600"}>
                          {deadline.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </div>
                        <div className={`text-xs ${overdue ? "text-red-500" : daysLeft <= 5 ? "text-amber-600" : "text-gray-400"}`}>
                          {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setOpenId(expanded ? null : row.id)}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          {expanded ? "Hide" : "Open"}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${row.id}-expanded`} className="bg-emerald-50/20">
                        <td colSpan={6} className="px-4 py-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* Requester details */}
                            <div className="md:col-span-1 space-y-2 text-xs">
                              <div>
                                <div className="text-gray-400 uppercase font-medium tracking-wide">Requester</div>
                                <div className="text-gray-700 mt-1">{c?.full_name || "—"}</div>
                                <div className="text-gray-500">{c?.email || row.client_email}</div>
                                {c?.phone && <div className="text-gray-500">{c.phone}</div>}
                                {c?.kennitala_last4 && <div className="text-gray-500">Kt. ****-{c.kennitala_last4}</div>}
                                <Link
                                  href={`/admin/clients`}
                                  className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2 mt-1 inline-block"
                                >
                                  Open in clients →
                                </Link>
                              </div>
                              <div className="pt-2">
                                <div className="text-gray-400 uppercase font-medium tracking-wide">auth.uid</div>
                                <code className="text-gray-600 text-[11px] bg-gray-100 px-1.5 py-0.5 rounded">{row.client_id}</code>
                              </div>
                              <div className="pt-2">
                                <div className="text-gray-400 uppercase font-medium tracking-wide">Submitted from</div>
                                <div className="text-gray-500">{row.ip || "—"}</div>
                                <div className="text-gray-400 break-all">{row.user_agent || "—"}</div>
                              </div>
                            </div>

                            {/* Details + notes */}
                            <div className="md:col-span-2 space-y-3">
                              {row.details && (
                                <div>
                                  <div className="text-xs text-gray-400 uppercase font-medium tracking-wide">Details from user</div>
                                  <pre className="mt-1 whitespace-pre-wrap text-sm text-gray-700 bg-white border border-gray-200 rounded p-3 font-sans">
                                    {row.details}
                                  </pre>
                                </div>
                              )}

                              {row.resolution_notes && (
                                <div>
                                  <div className="text-xs text-gray-400 uppercase font-medium tracking-wide">Resolution notes</div>
                                  <pre className="mt-1 whitespace-pre-wrap text-sm text-gray-700 bg-emerald-50/50 border border-emerald-200 rounded p-3 font-sans">
                                    {row.resolution_notes}
                                  </pre>
                                </div>
                              )}

                              {(row.status === "received" || row.status === "in_progress") && (
                                <div>
                                  <label className="text-xs text-gray-400 uppercase font-medium tracking-wide">
                                    Notes (saved when you complete/withdraw/reject)
                                  </label>
                                  <textarea
                                    value={notesDraft[row.id] ?? ""}
                                    onChange={(e) => setNotesDraft({ ...notesDraft, [row.id]: e.target.value })}
                                    placeholder="What was done? Which SQL was run? What was emailed back?"
                                    rows={3}
                                    className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-y"
                                  />
                                </div>
                              )}

                              {/* Status transitions */}
                              <div className="flex items-center gap-2 flex-wrap pt-1">
                                {row.status === "received" && (
                                  <button
                                    onClick={() => transition(row, "in_progress")}
                                    disabled={busyId === row.id}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    Mark in progress
                                  </button>
                                )}
                                {(row.status === "received" || row.status === "in_progress") && (
                                  <>
                                    <button
                                      onClick={() => transition(row, "completed")}
                                      disabled={busyId === row.id}
                                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      Mark completed
                                    </button>
                                    <button
                                      onClick={() => transition(row, "withdrawn")}
                                      disabled={busyId === row.id}
                                      className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50"
                                    >
                                      User withdrew
                                    </button>
                                    <button
                                      onClick={() => transition(row, "rejected")}
                                      disabled={busyId === row.id}
                                      className="px-3 py-1.5 bg-white border border-red-200 text-red-700 text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-50"
                                    >
                                      Reject (with reason in notes)
                                    </button>
                                  </>
                                )}
                                {row.status === "completed" && row.resolved_at && (
                                  <span className="text-xs text-gray-500">
                                    Completed {new Date(row.resolved_at).toLocaleDateString("en-GB")}
                                  </span>
                                )}
                              </div>
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
