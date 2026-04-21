"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface CompanyRow {
  id: string;
  name: string;
  contact_person_id: string;
  contact_email: string | null;
  created_at: string;
  member_count: number;
  invited_count: number;
  completed_count: number;
  roster_confirmed_at: string | null;
  registration_finalized_at: string | null;
  registration_finalized_by?: string | null;
  finalized_by_name?: string | null;
  finalized_by_email?: string | null;
  body_comp_event_count: number;
  blood_test_day_count: number;
  default_tier?: string | null;
}

interface MemberRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  kennitala_last4: string | null;
  invited_at: string | null;
  invite_sent_count: number;
  completed_at: string | null;
  profile_complete: boolean | null;
  biody_activated: boolean | null;
  created_at: string;
}

const TIERS = [
  { value: "", label: "— none —" },
  { value: "free-trial", label: "Free" },
  { value: "self-maintained", label: "Self-maintained" },
  { value: "premium", label: "Premium" },
];

function GenerateInvoiceButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [employeeCount, setEmployeeCount] = useState(0);
  const [unitPrice, setUnitPrice] = useState(49900);
  const [notes, setNotes] = useState("");

  // Past invoices
  const [pastInvoices, setPastInvoices] = useState<{ number: string | null; quantity: number; amount_total: number; status: string; issued_at: string }[]>([]);

  const openDialog = async () => {
    setOpen(true);
    setLoading(true);
    setNotes("");
    // Fetch employee count, pricing, and past invoices
    const [{ count }, { data: po }, { data: invoices }] = await Promise.all([
      supabase.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("b2b_purchase_orders").select("line_items").eq("company_id", companyId).eq("status", "signed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("company_invoices").select("payday_invoice_number, quantity, amount_total, status, issued_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(5),
    ]);
    setEmployeeCount(count || 0);
    if (po?.line_items && Array.isArray(po.line_items) && po.line_items.length > 0) {
      setUnitPrice((po.line_items[0] as { unit_price_isk?: number }).unit_price_isk || 49900);
    }
    setPastInvoices((invoices || []).map((i: any) => ({ number: i.payday_invoice_number, quantity: i.quantity, amount_total: i.amount_total, status: i.status, issued_at: i.issued_at })));
    setLoading(false);
  };

  const send = async () => {
    setSending(true);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch(`/api/admin/companies/${companyId}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ unit_price: unitPrice, quantity: employeeCount, notes: notes.trim() || undefined }),
    });
    const j = await res.json();
    setSending(false);
    setOpen(false);
    if (!res.ok) setToast({ type: "error", text: `Failed: ${j.detail || j.error || "unknown"}\n\nPayDay response:\n${JSON.stringify(j.raw || "none", null, 2)}` });
    else setToast({ type: "success", text: `Invoice created${j.payday_invoice_number ? ` · #${j.payday_invoice_number}` : ""}\n\n${j.quantity} employees × ${j.unit_price.toLocaleString()} ISK = ${j.amount_total.toLocaleString()} ISK\nVAT exempt (health services) · Eindagi: 14 days` });
  };

  const total = employeeCount * unitPrice;

  return (
    <>
      <button onClick={openDialog} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">Invoice</button>

      {/* Invoice dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[420px] max-w-[calc(100vw-2rem)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 truncate">Invoice for {companyName}</h3>
              <p className="text-sm text-gray-500 mt-0.5">PayDay · VAT exempt · 14-day eindagi</p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading…</div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                {/* Past invoices */}
                {pastInvoices.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Previous invoices</p>
                    {pastInvoices.map((inv, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-gray-700 truncate">
                          {inv.number ? `#${inv.number}` : "—"} · {inv.quantity} emp · {inv.amount_total.toLocaleString()} ISK
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : inv.status === "sent" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {inv.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Editable fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Employees</label>
                    <input
                      type="number" min={1} value={employeeCount}
                      onChange={(e) => setEmployeeCount(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-300 outline-none box-border"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Unit price (ISK)</label>
                    <input
                      type="number" min={0} value={unitPrice}
                      onChange={(e) => setUnitPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-300 outline-none box-border"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Note (optional)</label>
                  <input
                    type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Appears on the invoice line item"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-300 outline-none box-border"
                  />
                </div>

                {/* Total */}
                <div className="bg-emerald-50 rounded-lg p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600">{employeeCount} × {unitPrice.toLocaleString()} ISK</p>
                    <p className="text-xs text-gray-500">VAT exempt · health services</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 shrink-0">{total.toLocaleString()} <span className="text-sm font-medium text-gray-500">ISK</span></p>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={send} disabled={sending || loading || employeeCount <= 0} className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {sending ? "Sending…" : pastInvoices.length > 0 ? "Send new invoice" : "Send invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result toast */}
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setToast(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`px-5 py-3 rounded-t-xl text-sm font-semibold ${toast.type === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
              {toast.type === "error" ? "Error" : "Invoice sent"}
            </div>
            <pre className="px-5 py-4 text-sm text-gray-800 whitespace-pre-wrap break-words select-all font-mono leading-relaxed">
              {toast.text}
            </pre>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setToast(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EnsureGroupButton({ companyId }: { companyId: string }) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch("/api/admin/biody/ensure-group", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ company_id: companyId }),
    });
    const j = await res.json();
    if (j.ok && j.biody_group_id) alert(`Biody group ready: id ${j.biody_group_id}`);
    else alert(`Failed: ${j.error || JSON.stringify(j)}`);
    setBusy(false);
  };
  return (
    <button onClick={click} disabled={busy} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors">
      {busy ? "Creating…" : "Biody group"}
    </button>
  );
}

function BulkActivateButton({ companyId }: { companyId: string }) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    if (!confirm("Create all employees of this company as patients in Biody? Skips anyone already created.")) return;
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const res = await fetch("/api/admin/biody/bulk-activate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ company_id: companyId }),
    });
    const j = await res.json();
    const failures = (j.results || []).filter((r: { ok: boolean }) => !r.ok);
    const summary = `Processed ${j.processed ?? 0} · created ${j.succeeded ?? 0} · failed ${j.failed ?? 0}`;
    if (failures.length) {
      const detail = failures.map((r: { client_id: string; error?: string }) => `• ${r.client_id}: ${r.error}`).join("\n");
      alert(`${summary}\n\nErrors:\n${detail}`);
    } else {
      alert(summary);
    }
    setBusy(false);
  };
  return (
    <button onClick={click} disabled={busy} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors">
      {busy ? "Creating…" : "Create all in Biody"}
    </button>
  );
}

function DeleteCompanyButton({ company, onDone }: { company: CompanyRow; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    const hasEmployees = company.member_count > 0;
    const baseMsg = `Delete company "${company.name}"?\n\nThis removes the company record and all ${company.member_count} roster entries.`;
    if (!confirm(baseMsg)) return;

    let deleteEmployees = false;
    if (hasEmployees) {
      deleteEmployees = confirm(
        `Also permanently delete the ${company.completed_count} employee Lifeline accounts that were created via this company?\n\n` +
        `OK = delete their accounts (IRREVERSIBLE).\nCancel = keep accounts (employees can still sign in; they just won't be linked to this company).`,
      );
    }

    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const url = `/api/admin/companies/${company.id}${deleteEmployees ? "?delete_employees=true" : ""}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    const j = await res.json();
    if (!res.ok) {
      alert(`Delete failed: ${j.error || "unknown"}`);
    } else {
      alert(
        deleteEmployees
          ? `Deleted company "${company.name}" + ${j.employees_deleted}/${j.employees_found} employee accounts.`
          : `Deleted company "${company.name}". Employee accounts preserved.`,
      );
      onDone();
    }
    setBusy(false);
  };
  return (
    <button onClick={click} disabled={busy} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors">
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}

function MemberStatus({ m }: { m: MemberRow }) {
  if (!m.invited_at && !m.completed_at) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Draft</span>;
  }
  if (m.invited_at && !m.completed_at) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Invited{m.invite_sent_count > 1 ? ` (${m.invite_sent_count}×)` : ""}</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Completed</span>;
}

function DataDot({ m }: { m: MemberRow }) {
  if (!m.completed_at) return <span className="text-gray-300">—</span>;
  if (m.profile_complete && m.biody_activated) {
    return <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><span className="w-2 h-2 rounded-full bg-emerald-500" />Ready</span>;
  }
  if (m.profile_complete) {
    return <span className="inline-flex items-center gap-1 text-xs text-amber-700"><span className="w-2 h-2 rounded-full bg-amber-500" />Needs activation</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs text-red-700"><span className="w-2 h-2 rounded-full bg-red-500" />Incomplete</span>;
}

function EmployeeRows({ companyId }: { companyId: string }) {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("list_company_members", { p_company_id: companyId });
      if (error) setErr(error.message);
      else setMembers((data || []) as MemberRow[]);
    })();
  }, [companyId]);

  if (err) return <tr><td colSpan={8} className="px-4 py-3 text-red-600 text-xs">{err}</td></tr>;
  if (!members) return <tr><td colSpan={8} className="px-4 py-3 text-gray-500 text-xs">Loading employees…</td></tr>;
  if (members.length === 0) return <tr><td colSpan={8} className="px-4 py-3 text-gray-500 text-xs italic">No employees on roster.</td></tr>;

  return (
    <>
      {members.map((m) => (
        <tr key={m.id} className="border-t border-gray-50 bg-gray-50/60">
          <td className="pl-12 pr-4 py-2 text-sm font-medium">{m.full_name}</td>
          <td className="px-4 py-2 text-sm text-gray-700">{m.email}</td>
          <td className="px-4 py-2 text-xs text-gray-500 font-mono">•••••{m.kennitala_last4 || ""}</td>
          <td className="px-4 py-2 text-sm text-gray-700">{m.phone || "—"}</td>
          <td className="px-4 py-2"><MemberStatus m={m} /></td>
          <td className="px-4 py-2"><DataDot m={m} /></td>
          <td className="px-4 py-2 text-xs text-gray-500">
            {m.completed_at
              ? `Done ${new Date(m.completed_at).toLocaleDateString()}`
              : m.invited_at
                ? `Invited ${new Date(m.invited_at).toLocaleDateString()}`
                : `Added ${new Date(m.created_at).toLocaleDateString()}`}
          </td>
          <td className="px-4 py-2"></td>
        </tr>
      ))}
    </>
  );
}

function SyncInvoicesButton() {
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

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [rpcRes, tiersRes] = await Promise.all([
      supabase.rpc("list_all_companies"),
      supabase.from("companies").select("id, default_tier"),
    ]);
    if (rpcRes.error) setError(rpcRes.error.message);
    else {
      const tierMap = new Map<string, string | null>((tiersRes.data || []).map((t: { id: string; default_tier: string | null }) => [t.id, t.default_tier]));
      const rows = ((rpcRes.data || []) as CompanyRow[]).map((c) => ({ ...c, default_tier: tierMap.get(c.id) || null }));
      setCompanies(rows);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadCsv = async (companyId: string, companyName: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch(`/api/admin/companies/${companyId}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { alert("Export failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${companyName.replace(/[^a-z0-9]+/gi, "-")}-roster.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Companies</h1>
        <div className="flex items-center gap-3">
          <SyncInvoicesButton />
          <Link href="/business/signup" className="text-sm text-blue-600 hover:underline">+ Create a company</Link>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Click a company name to expand its employee roster. Update default tier, activate Biody profiles,
        export, or delete from each row.
      </p>
      {loading && <div className="text-gray-500">Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && companies.length === 0 && (
        <div className="text-gray-500">No companies yet.</div>
      )}
      {companies.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Roster</th>
                <th className="px-4 py-3">Invited</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Default tier</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <Fragment key={c.id}>
                  <tr className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => toggleExpand(c.id)}
                          className="inline-flex items-center gap-2 hover:underline"
                          title="Show employees"
                        >
                          <svg
                            className={`w-3 h-3 transition-transform ${expanded.has(c.id) ? "rotate-90" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {c.name}
                        </button>
                        {c.registration_finalized_at ? (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold cursor-help"
                            title={`Finalized by ${c.finalized_by_name || c.finalized_by_email || "a company admin"}${c.finalized_by_email && c.finalized_by_name ? ` (${c.finalized_by_email})` : ""} on ${new Date(c.registration_finalized_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                          >
                            Ready ⓘ
                          </span>
                        ) : c.roster_confirmed_at && c.body_comp_event_count > 0 && c.blood_test_day_count > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Awaiting finalize</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Setup</span>
                        )}
                      </div>
                      {c.registration_finalized_at && (
                        <div className="text-xs text-gray-500 mt-1">
                          Approved by <span className="font-medium text-gray-700">{c.finalized_by_name || c.finalized_by_email || "—"}</span>
                          {" "}on {new Date(c.registration_finalized_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}
                      <div className="mt-2">
                        <Link
                          href={`/business/${c.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.contact_email || "—"}</td>
                    <td className="px-4 py-3">{c.member_count}</td>
                    <td className="px-4 py-3">{c.invited_count}</td>
                    <td className="px-4 py-3">{c.completed_count}</td>
                    <td className="px-4 py-3">
                      <select
                        value={c.default_tier || ""}
                        onChange={async (e) => {
                          const tier = e.target.value || null;
                          await supabase.from("companies").update({ default_tier: tier }).eq("id", c.id);
                          setCompanies((prev) => prev.map((x) => x.id === c.id ? { ...x, default_tier: tier } : x));
                        }}
                        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                      >
                        {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <EnsureGroupButton companyId={c.id} />
                      <BulkActivateButton companyId={c.id} />
                      <GenerateInvoiceButton companyId={c.id} companyName={c.name} />
                      <button onClick={() => downloadCsv(c.id, c.name)} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                        CSV
                      </button>
                      <DeleteCompanyButton company={c} onDone={load} />
                    </div>
                    </td>
                  </tr>
                  {expanded.has(c.id) && <EmployeeRows companyId={c.id} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
