"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Payment = {
  id: string;
  owner_type: "client" | "company";
  owner_id: string;
  // Snapshot columns — set at insert time, preserved even if the
  // company is later deleted. Prefer these over live lookups.
  owner_company_id: string | null;
  owner_company_name: string | null;
  amount_isk: number;
  currency: string;
  description: string;
  provider: string;
  provider_reference: string | null;
  status: "pending" | "succeeded" | "refunded" | "failed";
  related_type: string | null;
  related_id: string | null;
  paid_at: string | null;
  created_at: string;
  pdf_url: string | null;
  client?: { full_name?: string | null; email?: string | null } | null;
  // Live-lookup fallback fields for pre-snapshot rows.
  company?: { name?: string | null } | null;
  client_company?: { id: string | null; name: string | null } | null;
};

type Filter = "all" | "pending" | "succeeded" | "refunded" | "failed";
type OwnerFilter = "all" | "client" | "company";

function SyncPayDayButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const click = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const t = s.session?.access_token;
      const res = await fetch("/api/admin/invoices/sync", {
        method: "POST",
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      const j = await res.json();
      setResult(`${j.synced || 0} invoice(s) updated${j.errors?.length ? ` · ${j.errors.length} error(s)` : ""}`);
    } catch { setResult("Sync failed"); }
    setSyncing(false);
    setTimeout(() => setResult(null), 4000);
  };
  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-emerald-600">{result}</span>}
      <button onClick={click} disabled={syncing} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50">
        {syncing ? "Syncing…" : "Sync PayDay status"}
      </button>
    </div>
  );
}

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Filter>("all");
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch payments without joins. owner_id is polymorphic (either a
    // client or a company) so we can't rely on a single FK join — we
    // resolve names in a second pass. This also lets us look up the
    // employer of B2C payers so company-of-client is visible too.
    const { data: paymentsData } = await supabase
      .from("payments")
      .select("id, owner_type, owner_id, owner_company_id, owner_company_name, amount_isk, currency, description, provider, provider_reference, status, related_type, related_id, paid_at, created_at, pdf_url")
      .order("created_at", { ascending: false })
      .limit(500);
    const base = (paymentsData as Payment[]) || [];
    if (base.length === 0) { setRows([]); setLoading(false); return; }

    const clientIds = Array.from(new Set(base.filter((p) => p.owner_type === "client").map((p) => p.owner_id)));
    const companyIds = Array.from(new Set(base.filter((p) => p.owner_type === "company").map((p) => p.owner_id)));

    const clientMap = new Map<string, { full_name: string | null; email: string | null; company_id: string | null }>();
    const companyMap = new Map<string, { name: string | null }>();

    // Parallel lookups. For clients we also fetch their company_id so
    // B2C rows can show "via Acme ehf." alongside the client's name.
    const [clientsRes, companiesRes] = await Promise.all([
      clientIds.length > 0
        ? supabase.from("clients").select("id, full_name, email, company_id").in("id", clientIds)
        : Promise.resolve({ data: [] }),
      companyIds.length > 0
        ? supabase.from("companies").select("id, name").in("id", companyIds)
        : Promise.resolve({ data: [] }),
    ]);

    for (const c of (clientsRes.data as Array<{ id: string; full_name: string | null; email: string | null; company_id: string | null }>) || []) {
      clientMap.set(c.id, { full_name: c.full_name, email: c.email, company_id: c.company_id });
    }
    for (const c of (companiesRes.data as Array<{ id: string; name: string | null }>) || []) {
      companyMap.set(c.id, { name: c.name });
    }

    // Resolve employer names for B2C payers with a company_id set.
    const employerIds = Array.from(new Set(Array.from(clientMap.values()).map((c) => c.company_id).filter((x): x is string => !!x).filter((id) => !companyMap.has(id))));
    if (employerIds.length > 0) {
      const { data: employers } = await supabase.from("companies").select("id, name").in("id", employerIds);
      for (const c of (employers as Array<{ id: string; name: string | null }>) || []) {
        companyMap.set(c.id, { name: c.name });
      }
    }

    const enriched: Payment[] = base.map((p) => {
      if (p.owner_type === "client") {
        const cli = clientMap.get(p.owner_id);
        return {
          ...p,
          client: cli ? { full_name: cli.full_name, email: cli.email } : null,
          company: null,
          client_company: cli?.company_id ? { id: cli.company_id, name: companyMap.get(cli.company_id)?.name || null } : null,
        };
      }
      return {
        ...p,
        client: null,
        company: companyMap.get(p.owner_id) ? { name: companyMap.get(p.owner_id)!.name } : null,
      };
    });
    setRows(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (owner !== "all" && r.owner_type !== owner) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = [
          r.description,
          r.provider_reference || "",
          r.client?.full_name || "",
          r.client?.email || "",
          r.company?.name || "",
          r.client_company?.name || "",
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, status, owner, query]);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, succeeded: 0, refunded: 0, failed: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  async function bulkDelete(opts: { all?: boolean }) {
    const ids = Array.from(selected);
    const count = opts.all ? rows.length : ids.length;
    if (count === 0) return;
    const prompt = opts.all
      ? `Delete ALL ${rows.length} payments? This cannot be undone.`
      : `Delete ${ids.length} selected payment(s)? This cannot be undone.`;
    if (!confirm(prompt)) return;
    setDeleting(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const t = s.session?.access_token;
      const res = await fetch("/api/admin/payments/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify(opts.all ? { all: true } : { ids }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setMsg(`Delete failed: ${j?.detail || j?.error || "unknown"}`);
      } else {
        setMsg(`Deleted ${j.deleted} payment(s).`);
        setSelected(new Set());
        await load();
      }
    } finally {
      setDeleting(false);
    }
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllFiltered() {
    setSelected((prev) => {
      if (prev.size === filtered.length && filtered.every((r) => prev.has(r.id))) return new Set();
      return new Set(filtered.map((r) => r.id));
    });
  }

  async function markSucceeded(id: string) {
    const { error } = await supabase.from("payments").update({ status: "succeeded", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) { setMsg(`Update failed: ${error.message}`); return; }
    setMsg("Marked succeeded.");
    load();
  }
  async function markRefunded(id: string) {
    // Look up what this payment is for. If it's tied to a body_comp_booking,
    // run the atomic refund RPC so the booking, station_slot claim, doctor
    // claim, and (optionally) the Check-in doctor add-on are all cleaned up
    // in one transaction. For other related_types (subscriptions, invoices,
    // etc.) fall back to the simple ledger-only mark-refunded.
    const { data: p } = await supabase
      .from("payments")
      .select("related_type, related_id, amount_isk, description")
      .eq("id", id)
      .maybeSingle();
    const related = p as { related_type?: string | null; related_id?: string | null; amount_isk?: number; description?: string } | null;
    if (related?.related_type === "body_comp_booking" && related.related_id) {
      const full = related.amount_isk ?? 0;
      const amountStr = window.prompt(
        `Refund amount in ISK (full = ${full.toLocaleString("is-IS")}, 0 = cancel without refund):`,
        String(full),
      );
      if (amountStr === null) return;
      const amount = parseInt(amountStr.replace(/[^\d-]/g, ""), 10);
      if (Number.isNaN(amount) || amount < 0 || amount > full) {
        setMsg(`Refund amount must be between 0 and ${full.toLocaleString("is-IS")} ISK.`);
        return;
      }
      const reason = (window.prompt("Admin reason (saved on booking as audit trail — required):", "") || "").trim();
      if (!reason) { setMsg("Reason is required."); return; }
      const includeAddon = confirm("Also refund the Check-in doctor add-on (18,500 ISK) for this client, if any?");
      if (!confirm(`Cancel booking and refund ${amount.toLocaleString("is-IS")} ISK${includeAddon ? " + 18,500 ISK doctor add-on" : ""}? This also releases the measurement slot and any tied doctor consult.`)) return;
      const { data, error } = await supabase.rpc("admin_cancel_booking", {
        p_booking_id: related.related_id,
        p_reason: reason,
        p_refund_isk: amount,
        p_include_checkin_addon: includeAddon,
      });
      const row = Array.isArray(data) ? data[0] : data;
      if (error || (row && row.ok === false)) {
        setMsg(`Refund failed: ${error?.message || row?.error}`);
        return;
      }
      setMsg(`Refunded ${(row?.refunded_isk ?? 0).toLocaleString("is-IS")} ISK and cancelled booking.`);
      load();
      return;
    }
    if (!confirm("Mark this payment as refunded? (Ledger only — not linked to a booking.)")) return;
    const { error } = await supabase.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("id", id);
    if (error) { setMsg(`Update failed: ${error.message}`); return; }
    setMsg("Marked refunded.");
    load();
  }

  function statusPill(s: Payment["status"]) {
    const cls = {
      pending: "bg-amber-50 text-amber-700 border-amber-100",
      succeeded: "bg-emerald-50 text-emerald-700 border-emerald-100",
      refunded: "bg-gray-50 text-gray-600 border-gray-200",
      failed: "bg-red-50 text-red-700 border-red-100",
    }[s];
    return <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}>{s}</span>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[#1F2937]">Payments</h1>
          <p className="text-sm text-[#6B7280]">All Straumur + PayDay activity across clients and companies.</p>
        </div>
        <SyncPayDayButton />
      </header>

      {msg && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
          {msg} <button onClick={() => setMsg("")} className="ml-2 text-xs underline">dismiss</button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {([["all", `All (${counts.all})`], ["pending", `Pending (${counts.pending})`], ["succeeded", `Succeeded (${counts.succeeded})`], ["refunded", `Refunded (${counts.refunded})`], ["failed", `Failed (${counts.failed})`]] as [Filter, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`px-3 py-1.5 rounded-lg text-sm ${status === k ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {l}
          </button>
        ))}
        <span className="text-gray-300">·</span>
        {(["all", "client", "company"] as OwnerFilter[]).map((k) => (
          <button key={k} onClick={() => setOwner(k)}
            className={`px-3 py-1.5 rounded-lg text-sm ${owner === k ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {k === "all" ? "All owners" : k === "client" ? "Clients" : "Companies"}
          </button>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search description, name, reference…"
          className="ml-auto px-3 py-1.5 rounded-lg text-sm border border-gray-200 w-64"
        />
      </div>

      {/* Bulk-action bar */}
      {!loading && rows.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <span>{selected.size} selected</span>
          <button
            onClick={() => bulkDelete({ all: false })}
            disabled={selected.size === 0 || deleting}
            className="px-2.5 py-1 rounded-md border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Delete selected
          </button>
          <div className="flex-1" />
          <button
            onClick={() => bulkDelete({ all: true })}
            disabled={deleting}
            className="px-2.5 py-1 rounded-md border border-red-400 text-red-800 bg-red-50 hover:bg-red-100 font-semibold disabled:opacity-40"
            title="Wipe every row — use for starting fresh"
          >
            Delete ALL payments
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center text-sm text-gray-600">
          No payments in this view.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-3 py-3 text-left font-medium w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                    onChange={toggleAllFiltered}
                    className="w-4 h-4 accent-emerald-600"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Paid by</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Provider</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isCompanyPayment = p.owner_type === "company";
                // Snapshot wins. Falls back to live lookup for legacy
                // rows that predate the snapshot columns.
                const snapshotCompanyName = p.owner_company_name || null;
                const ownerCompanyName = isCompanyPayment
                  ? (snapshotCompanyName || p.company?.name || null)
                  : null;
                const employerName = !isCompanyPayment
                  ? (snapshotCompanyName || p.client_company?.name || null)
                  : null;
                const payerLabel = p.owner_type === "client"
                  ? (p.client?.full_name || p.client?.email || p.owner_id.slice(0, 8))
                  : (ownerCompanyName || p.owner_id.slice(0, 8));
                return (
                <tr key={p.id} className={`border-t border-gray-100 align-top ${selected.has(p.id) ? "bg-emerald-50/40" : ""}`}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleRow(p.id)}
                      className="w-4 h-4 accent-emerald-600"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                    {new Date(p.paid_at || p.created_at).toLocaleDateString("en-GB")}
                    <div className="text-[10px] text-gray-500">{new Date(p.paid_at || p.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {isCompanyPayment ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          Company
                        </span>
                        <div className="font-medium text-[13px] mt-1 truncate max-w-[200px]" title={ownerCompanyName || ""}>
                          {ownerCompanyName || <span className="text-gray-400">— unknown —</span>}
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Personal
                        </span>
                        {employerName && (
                          <div className="text-[11px] text-gray-500 mt-1 truncate max-w-[200px]" title={employerName}>
                            employee of <span className="text-gray-700 font-medium">{employerName}</span>
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">{p.owner_type}</div>
                    <div className="font-medium truncate max-w-[180px]" title={payerLabel}>{payerLabel}</div>
                    {p.owner_type === "client" && p.client?.email && p.client.email !== payerLabel && (
                      <div className="text-[10px] text-gray-400 truncate max-w-[180px]" title={p.client.email}>{p.client.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-900 max-w-sm">
                    {p.description}
                    {p.provider_reference && <div className="text-[10px] text-gray-400 font-mono">{p.provider_reference}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium text-right whitespace-nowrap">
                    {p.amount_isk.toLocaleString("is-IS")} {p.currency}
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{p.provider}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{statusPill(p.status)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                    {p.status === "pending" && (
                      <button onClick={() => markSucceeded(p.id)} className="text-xs font-medium text-emerald-700 hover:underline">Mark paid</button>
                    )}
                    {p.status === "succeeded" && (
                      <button onClick={() => markRefunded(p.id)} className="text-xs font-medium text-gray-600 hover:underline">Refund</button>
                    )}
                    {p.pdf_url && (
                      <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline">PDF</a>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
