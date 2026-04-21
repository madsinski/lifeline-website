"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Payment = {
  id: string;
  owner_type: "client" | "company";
  owner_id: string;
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
  company?: { name?: string | null } | null;
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

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payments")
      .select(`
        id, owner_type, owner_id, amount_isk, currency, description, provider,
        provider_reference, status, related_type, related_id, paid_at,
        created_at, pdf_url,
        client:clients!payments_owner_id_fkey(full_name, email),
        company:companies!payments_owner_id_fkey(name)
      `)
      .order("created_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) {
      // Fallback without the joins if the FK alias path fails
      const { data: plain } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setRows((plain as Payment[]) || []);
      return;
    }
    setRows((data as unknown as Payment[]) || []);
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

  async function markSucceeded(id: string) {
    const { error } = await supabase.from("payments").update({ status: "succeeded", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) { setMsg(`Update failed: ${error.message}`); return; }
    setMsg("Marked succeeded.");
    load();
  }
  async function markRefunded(id: string) {
    if (!confirm("Mark this payment as refunded?")) return;
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
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Owner</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Provider</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 align-top">
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                    {new Date(p.paid_at || p.created_at).toLocaleDateString("en-GB")}
                    <div className="text-[10px] text-gray-500">{new Date(p.paid_at || p.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">{p.owner_type}</div>
                    <div className="font-medium">
                      {p.owner_type === "client"
                        ? (p.client?.full_name || p.client?.email || p.owner_id.slice(0, 8))
                        : (p.company?.name || p.owner_id.slice(0, 8))}
                    </div>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
