"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Admin bookings & refund requests.
// Consolidates manual cancel / refund workflows for body_comp_bookings plus
// the client-initiated refund-request queue. All destructive actions route
// through admin_cancel_booking (full or partial refund, atomic) — never
// direct DB writes.
// ─────────────────────────────────────────────────────────────────────────────

type BookingRow = {
  id: string;
  client_id: string;
  scheduled_at: string | null;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  package: string | null;
  amount_isk: number | null;
  payment_status: "pending" | "paid" | "refunded" | null;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
  notes: string | null;
  client?: { full_name: string | null; email: string | null; checkin_doctor_addon_paid_at: string | null } | null;
};

type RefundRequestRow = {
  id: string;
  client_id: string;
  booking_id: string | null;
  reason: string;
  requested_isk: number;
  approved_isk: number | null;
  include_checkin_addon: boolean;
  status: "pending" | "approved" | "denied" | "withdrawn";
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  client?: { full_name: string | null; email: string | null } | null;
  booking?: { scheduled_at: string | null; package: string | null; amount_isk: number | null } | null;
};

type Tab = "bookings" | "requests";
type StatusFilter = "active" | "all" | "cancelled";

export default function AdminBookingsPage() {
  const [tab, setTab] = useState<Tab>("bookings");
  const [msg, setMsg] = useState("");
  const [requestsPending, setRequestsPending] = useState(0);

  const loadPendingCount = useCallback(async () => {
    const { count } = await supabase
      .from("refund_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setRequestsPending(count || 0);
  }, []);

  useEffect(() => { loadPendingCount(); }, [loadPendingCount]);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[#1F2937]">Bookings & refunds</h1>
        <p className="text-sm text-[#6B7280]">Manual cancel, partial / full refund, and the client-initiated refund queue.</p>
      </header>

      {msg && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900 flex items-center justify-between gap-2">
          <span>{msg}</span>
          <button onClick={() => setMsg("")} className="text-xs underline">dismiss</button>
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("bookings")}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "bookings" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          All bookings
        </button>
        <button
          onClick={() => setTab("requests")}
          className={`px-4 py-2 text-sm font-medium border-b-2 flex items-center gap-2 ${tab === "requests" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Refund requests
          {requestsPending > 0 && (
            <span className="text-[10px] font-semibold bg-amber-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{requestsPending}</span>
          )}
        </button>
      </div>

      {tab === "bookings" ? (
        <BookingsTable setMsg={setMsg} onAfterAction={loadPendingCount} />
      ) : (
        <RefundRequestsTable setMsg={setMsg} onAfterAction={loadPendingCount} />
      )}
    </div>
  );
}

// ─── Bookings tab ───────────────────────────────────────────────────────────

function BookingsTable({ setMsg, onAfterAction }: { setMsg: (s: string) => void; onAfterAction: () => void }) {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("body_comp_bookings")
      .select("id, client_id, scheduled_at, status, package, amount_isk, payment_status, paid_at, payment_reference, created_at, notes, client:clients!inner(full_name, email, checkin_doctor_addon_paid_at)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (status === "active") q = q.in("status", ["requested", "confirmed"]);
    else if (status === "cancelled") q = q.eq("status", "cancelled");
    const { data, error } = await q;
    if (error) { setMsg(`Load failed: ${error.message}`); setLoading(false); return; }
    setRows((data as unknown as BookingRow[]) || []);
    setLoading(false);
  }, [status, setMsg]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      (r.client?.full_name || "").toLowerCase().includes(s) ||
      (r.client?.email || "").toLowerCase().includes(s) ||
      r.id.includes(s),
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {([["active", "Active"], ["all", "All"], ["cancelled", "Cancelled"]] as [StatusFilter, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`px-3 py-1.5 rounded-lg text-sm ${status === k ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {l}
          </button>
        ))}
        <input
          type="text" placeholder="Search name, email, or booking id"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Package</th>
              <th className="px-4 py-3 text-left">Scheduled</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Payment</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No bookings</td></tr>
            ) : filtered.map((r) => (
              <BookingTableRow key={r.id} row={r} onReload={() => { load(); onAfterAction(); }} setMsg={setMsg} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingTableRow({ row, onReload, setMsg }: { row: BookingRow; onReload: () => void; setMsg: (s: string) => void }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const packageLabel = row.package === "foundational" ? "Foundational" : row.package === "checkin" ? "Check-in" : row.package === "self-checkin" ? "Self Check-in" : (row.package || "—");
  const statusPill = (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
      row.status === "confirmed" ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : row.status === "requested" ? "bg-blue-50 text-blue-700 border-blue-100"
      : row.status === "completed" ? "bg-gray-50 text-gray-700 border-gray-200"
      : "bg-red-50 text-red-700 border-red-100"
    }`}>{row.status}</span>
  );
  const payPill = row.payment_status ? (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
      row.payment_status === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : row.payment_status === "refunded" ? "bg-gray-50 text-gray-600 border-gray-200"
      : "bg-amber-50 text-amber-700 border-amber-100"
    }`}>{row.payment_status}</span>
  ) : <span className="text-xs text-gray-400">—</span>;
  const scheduled = row.scheduled_at ? new Date(row.scheduled_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
  const active = row.status === "requested" || row.status === "confirmed";

  return (
    <>
      <tr className="hover:bg-gray-50/50">
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900">{row.client?.full_name || "—"}</div>
          <div className="text-[11px] text-gray-500">{row.client?.email}</div>
          <div className="text-[10px] text-gray-400 font-mono mt-0.5">{row.id.slice(0, 8)}</div>
        </td>
        <td className="px-4 py-3">
          <div className="text-gray-800">{packageLabel}</div>
          {row.client?.checkin_doctor_addon_paid_at && row.package === "checkin" && (
            <div className="text-[10px] text-violet-700">+ doctor add-on</div>
          )}
        </td>
        <td className="px-4 py-3 text-gray-700">{scheduled}</td>
        <td className="px-4 py-3">{statusPill}</td>
        <td className="px-4 py-3">{payPill}</td>
        <td className="px-4 py-3 text-right text-gray-800 tabular-nums">
          {(row.amount_isk ?? 0).toLocaleString("is-IS")} ISK
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          {active ? (
            <button onClick={() => setCancelOpen(true)} className="text-xs font-medium text-red-600 hover:underline">
              Cancel / refund
            </button>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
      </tr>
      {cancelOpen && (
        <tr>
          <td colSpan={7} className="p-0">
            <CancelForm
              row={row}
              onClose={() => setCancelOpen(false)}
              onDone={(text) => { setMsg(text); setCancelOpen(false); onReload(); }}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Cancel / refund form (inline row expansion) ────────────────────────────

function CancelForm({ row, onClose, onDone }: { row: BookingRow; onClose: () => void; onDone: (msg: string) => void }) {
  const full = row.amount_isk ?? 0;
  const hasAddon = !!row.client?.checkin_doctor_addon_paid_at && row.package === "checkin";
  const [refundAmount, setRefundAmount] = useState<number>(full);
  const [includeAddon, setIncludeAddon] = useState<boolean>(hasAddon);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!reason.trim()) { setErr("Reason is required — it's saved on the booking as an audit trail."); return; }
    if (refundAmount < 0 || refundAmount > full) { setErr("Refund amount must be between 0 and the original charge."); return; }
    setErr(""); setBusy(true);
    const { data, error } = await supabase.rpc("admin_cancel_booking", {
      p_booking_id: row.id,
      p_reason: reason.trim(),
      p_refund_isk: refundAmount,
      p_include_checkin_addon: includeAddon,
    });
    setBusy(false);
    const r = Array.isArray(data) ? data[0] : data;
    if (error || (r && r.ok === false)) {
      setErr(error?.message || r?.error || "Unknown error");
      return;
    }
    onDone(`Cancelled. Refunded ${(r?.refunded_isk ?? 0).toLocaleString("is-IS")} ISK.`);
  }

  return (
    <div className="bg-amber-50/40 border-t border-b border-amber-100 p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">Cancel booking {row.id.slice(0, 8)} — {row.client?.full_name || row.client?.email}</div>
        <button onClick={onClose} className="text-xs text-gray-500 hover:underline">Close</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Refund amount (ISK)</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number" min={0} max={full} value={refundAmount}
              onChange={(e) => setRefundAmount(Math.max(0, Math.min(full, parseInt(e.target.value || "0", 10))))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm tabular-nums"
              disabled={busy || full === 0}
            />
            <button
              type="button" onClick={() => setRefundAmount(full)}
              disabled={busy || full === 0}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap"
            >
              Full ({full.toLocaleString("is-IS")})
            </button>
            <button
              type="button" onClick={() => setRefundAmount(0)}
              disabled={busy}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              None
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">
            0 = cancel without refund (no-show, clinic-initiated). Partial refunds create a compensating ledger row so reporting stays balanced.
          </p>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Admin reason (required)</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Client requested — illness; partial refund per goodwill policy."
            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            disabled={busy}
          />
        </label>
      </div>

      {hasAddon && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={includeAddon} onChange={(e) => setIncludeAddon(e.target.checked)} disabled={busy} />
          Also refund the 18,500 ISK Check-in doctor add-on
        </label>
      )}

      {err && <div className="text-sm text-red-600">{err}</div>}

      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} disabled={busy} className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
          Cancel
        </button>
        <button
          onClick={submit} disabled={busy}
          className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? "Working…" : `Cancel & refund ${refundAmount.toLocaleString("is-IS")} ISK`}
        </button>
      </div>
    </div>
  );
}

// ─── Refund requests tab ────────────────────────────────────────────────────

function RefundRequestsTable({ setMsg, onAfterAction }: { setMsg: (s: string) => void; onAfterAction: () => void }) {
  const [rows, setRows] = useState<RefundRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("refund_requests")
      .select("id, client_id, booking_id, reason, requested_isk, approved_isk, include_checkin_addon, status, admin_note, created_at, resolved_at, client:clients!inner(full_name,email), booking:body_comp_bookings(scheduled_at,package,amount_isk)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "pending") q = q.eq("status", "pending");
    const { data, error } = await q;
    if (error) { setMsg(`Load failed: ${error.message}`); setLoading(false); return; }
    setRows((data as unknown as RefundRequestRow[]) || []);
    setLoading(false);
  }, [filter, setMsg]);

  useEffect(() => { load(); }, [load]);

  async function approve(req: RefundRequestRow, amount: number, adminNote: string) {
    if (!req.booking_id) { setMsg("This request is not linked to a booking — resolve it manually."); return; }
    const { data, error } = await supabase.rpc("admin_cancel_booking", {
      p_booking_id: req.booking_id,
      p_reason: `Refund request approved: ${req.reason}${adminNote ? ` — ${adminNote}` : ""}`,
      p_refund_isk: amount,
      p_include_checkin_addon: req.include_checkin_addon,
    });
    const r = Array.isArray(data) ? data[0] : data;
    if (error || (r && r.ok === false)) {
      setMsg(`Approve failed: ${error?.message || r?.error}`);
      return;
    }
    await supabase.from("refund_requests")
      .update({ status: "approved", approved_isk: amount, admin_note: adminNote || null, resolved_at: new Date().toISOString() })
      .eq("id", req.id);
    setMsg(`Approved — refunded ${(r?.refunded_isk ?? 0).toLocaleString("is-IS")} ISK.`);
    // Notify the client via email — fire-and-forget, row is already updated.
    fetch("/api/bookings/refund-request-resolved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: req.id }),
    }).catch(() => {});
    load();
    onAfterAction();
  }

  async function deny(req: RefundRequestRow, adminNote: string) {
    await supabase.from("refund_requests")
      .update({ status: "denied", admin_note: adminNote || null, resolved_at: new Date().toISOString() })
      .eq("id", req.id);
    setMsg("Request denied.");
    fetch("/api/bookings/refund-request-resolved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: req.id }),
    }).catch(() => {});
    load();
    onAfterAction();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pending", "all"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-sm ${filter === k ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {k === "pending" ? "Pending" : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-400 py-8 bg-white rounded-xl border border-gray-100">
          No refund requests{filter === "pending" ? " pending" : ""}.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <RefundRequestCard key={r.id} req={r} onApprove={approve} onDeny={deny} />
          ))}
        </div>
      )}
    </div>
  );
}

function RefundRequestCard({
  req, onApprove, onDeny,
}: {
  req: RefundRequestRow;
  onApprove: (req: RefundRequestRow, amount: number, note: string) => void;
  onDeny: (req: RefundRequestRow, note: string) => void;
}) {
  const [expanded, setExpanded] = useState(req.status === "pending");
  const [amount, setAmount] = useState<number>(req.requested_isk || req.booking?.amount_isk || 0);
  const [note, setNote] = useState("");
  const scheduled = req.booking?.scheduled_at ? new Date(req.booking.scheduled_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
  const pkgLabel = req.booking?.package === "foundational" ? "Foundational" : req.booking?.package === "checkin" ? "Check-in" : req.booking?.package === "self-checkin" ? "Self Check-in" : "—";
  const hoursUntil = req.booking?.scheduled_at ? (new Date(req.booking.scheduled_at).getTime() - Date.now()) / 3_600_000 : null;

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
      >
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
          req.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-100"
          : req.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : req.status === "denied" ? "bg-red-50 text-red-700 border-red-100"
          : "bg-gray-50 text-gray-600 border-gray-200"
        }`}>{req.status}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 text-sm truncate">{req.client?.full_name || req.client?.email}</div>
          <div className="text-[11px] text-gray-500 truncate">{pkgLabel} · {scheduled}{hoursUntil !== null && req.status === "pending" ? (hoursUntil < 48 ? ` · in ${hoursUntil.toFixed(0)}h` : "") : ""}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-800 tabular-nums">{req.requested_isk.toLocaleString("is-IS")} ISK</div>
          <div className="text-[11px] text-gray-400">requested</div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
          <div className="pt-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-0.5">Reason</div>
            <div className="text-sm text-gray-800 whitespace-pre-wrap">{req.reason}</div>
          </div>
          {req.admin_note && (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 mb-0.5">Admin note</div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{req.admin_note}</div>
            </div>
          )}
          {req.include_checkin_addon && (
            <div className="text-xs text-violet-700">Client also requested refund of the Check-in doctor add-on (18,500 ISK).</div>
          )}
          {req.status === "pending" && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Approve amount (ISK)</span>
                  <input
                    type="number" min={0} value={amount}
                    onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value || "0", 10)))}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Internal note (optional)</span>
                  <input
                    type="text" value={note} onChange={(e) => setNote(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="e.g. Goodwill 50% refund"
                  />
                </label>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => onDeny(req, note)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Deny
                </button>
                <button
                  onClick={() => onApprove(req, amount, note)}
                  className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                >
                  Approve & refund {amount.toLocaleString("is-IS")} ISK
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
