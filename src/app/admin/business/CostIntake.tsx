"use client";

// Cost page — every recorded cost, listed per month and categorized,
// with an AI drag-and-drop intake at the top. Costs come from
// accounting_expense_invoices (the AI-read PDFs) and flow into the
// company-card Costs section, the Accounting tab and the monthly
// report. Backed by /api/admin/accounting/invoices (?all=1 to list,
// month=auto to upload, PATCH/DELETE to edit).

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const CATEGORIES = [
  { key: "measurements", label: "Measurements" },
  { key: "blood_tests", label: "Blood tests" },
  { key: "doctor", label: "Doctor" },
  { key: "saas", label: "SaaS / systems" },
  { key: "other", label: "Other" },
];
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));
const CAT_STYLE: Record<string, string> = {
  measurements: "bg-blue-50 text-blue-700 border-blue-200",
  blood_tests: "bg-red-50 text-red-700 border-red-200",
  doctor: "bg-violet-50 text-violet-700 border-violet-200",
  saas: "bg-gray-100 text-gray-600 border-gray-200",
  other: "bg-amber-50 text-amber-700 border-amber-200",
};

const isk = (n: number) => `${Math.round(n).toLocaleString("is-IS")} kr.`;
const IS_MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const monthLabel = (m: string) => { const [y, mo] = m.slice(0, 7).split("-").map(Number); return `${IS_MONTHS[mo - 1]} ${y}`; };

interface CostInvoice {
  id: string; month: string; vendor: string | null; description: string | null;
  category: string; amount_isk: number; currency: string; invoice_number: string | null;
  invoice_date: string | null; client_count: number | null; company_id: string | null;
  company?: { name?: string } | null; direction?: string; file_url: string | null; ai_confidence: string | null;
  split_group_id: string | null;
}

interface Alloc { company_id: string; amount: string; clients: string }

interface QueueItem { id: string; file: File; companyId: string; category: string; status: "queued" | "uploading" | "done" | "duplicate" | "error"; info: string }

export default function CostPage() {
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [invoices, setInvoices] = useState<CostInvoice[] | null>(null);
  const [catFilter, setCatFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [showIntake, setShowIntake] = useState(true);

  // intake state
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [defaultCompany, setDefaultCompany] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(path, { ...init, headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }, []);

  const loadLedger = useCallback(async () => {
    const res = await authedFetch(`/api/admin/accounting/invoices?all=1`);
    if (res.ok) {
      const j = await res.json();
      setInvoices(((j.invoices || []) as CostInvoice[]).filter((r) => r.direction !== "income"));
    } else setInvoices([]);
  }, [authedFetch]);

  useEffect(() => {
    (async () => {
      const res = await authedFetch(`/api/admin/accounting/companies`);
      if (res.ok) { const j = await res.json(); setCompanies(j.companies || []); }
    })();
    queueMicrotask(loadLedger);
  }, [authedFetch, loadLedger]);

  // ── intake ──────────────────────────────────────────────────────
  const addFiles = useCallback((files: File[]) => {
    const pdfs = files.filter((f) => f.type === "application/pdf" || /\.(pdf|png|jpe?g)$/i.test(f.name));
    setQueue((q) => [...q, ...pdfs.map((file) => ({ id: `f${idRef.current++}`, file, companyId: defaultCompany, category: defaultCategory, status: "queued" as const, info: "" }))]);
  }, [defaultCompany, defaultCategory]);

  const updateQ = (id: string, patch: Partial<QueueItem>) => setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const uploadOne = async (it: QueueItem) => {
    updateQ(it.id, { status: "uploading", info: "" });
    try {
      const fd = new FormData();
      fd.append("file", it.file); fd.append("month", "auto");
      if (it.category) fd.append("category", it.category);
      if (it.companyId) fd.append("company_id", it.companyId);
      const res = await authedFetch(`/api/admin/accounting/invoices`, { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { updateQ(it.id, { status: "error", info: j.error || `HTTP ${res.status}` }); return; }
      if (j.duplicate) { updateQ(it.id, { status: "duplicate", info: `Already uploaded (${j.vendor || ""} #${j.invoice_number || ""})` }); return; }
      const inv = j.invoice;
      updateQ(it.id, { status: "done", info: `${inv.vendor || "vendor?"} · ${isk(inv.amount_isk)} · ${String(inv.month).slice(0, 7)}${inv.company?.name ? ` → ${inv.company.name}` : ""}` });
    } catch (e) { updateQ(it.id, { status: "error", info: (e as Error).message }); }
  };

  const uploadAll = async () => {
    setBusy(true);
    const pending = queue.filter((it) => it.status === "queued" || it.status === "error");
    await Promise.all(Array.from({ length: 3 }, async () => { while (true) { const n = pending.shift(); if (!n) break; await uploadOne(n); } }));
    setBusy(false);
    await loadLedger();
  };

  // ── ledger edits ────────────────────────────────────────────────
  const patch = async (id: string, body: Record<string, unknown>) => {
    await authedFetch(`/api/admin/accounting/invoices`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    await loadLedger();
  };
  const editAmount = (r: CostInvoice) => {
    const v = prompt(`Amount ISK for ${r.vendor || "this cost"}:`, String(r.amount_isk));
    if (v === null) return;
    const n = parseInt(v.replace(/[^\d]/g, ""), 10);
    if (Number.isInteger(n) && n >= 0) patch(r.id, { amount_isk: n });
  };
  const removeInvoice = async (id: string) => {
    if (!confirm("Delete this cost invoice?")) return;
    await authedFetch(`/api/admin/accounting/invoices?id=${id}`, { method: "DELETE" });
    await loadLedger();
  };

  // ── split one invoice across companies ─────────────────────────
  // Expected recurring costs (next month) — overheads billed to the
  // debit card that don't always have an invoice (Vercel, Claude, …).
  const now = new Date();
  const nmDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const nextMonth = `${nmDate.getUTCFullYear()}-${String(nmDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const nextMonthLabel = monthLabel(`${nextMonth}-01`);
  const [recurring, setRecurring] = useState<Array<{ id: string; name: string; quantity: number; amount_usd: number | null; total_isk: number }>>([]);
  const [recurringTotal, setRecurringTotal] = useState(0);
  const [newRec, setNewRec] = useState({ name: "", amount: "" });
  const loadRecurring = useCallback(async () => {
    const res = await authedFetch(`/api/admin/accounting/report?month=${nextMonth}`);
    if (res.ok) {
      const j = await res.json();
      setRecurring(j.report?.overheads || []);
      setRecurringTotal(j.report?.totals?.overheads_isk || 0);
    }
  }, [authedFetch, nextMonth]);
  useEffect(() => { queueMicrotask(loadRecurring); }, [loadRecurring]);
  const addRecurring = async () => {
    const amount = parseInt(newRec.amount, 10);
    if (!newRec.name.trim() || !Number.isInteger(amount) || amount < 0) return;
    await authedFetch(`/api/admin/accounting/overheads`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRec.name.trim(), amount_isk: amount, quantity: 1 }),
    });
    setNewRec({ name: "", amount: "" });
    await loadRecurring();
  };
  const removeRecurring = async (id: string) => {
    await authedFetch(`/api/admin/accounting/overheads?id=${id}`, { method: "DELETE" });
    await loadRecurring();
  };

  const [splitFor, setSplitFor] = useState<CostInvoice | null>(null);
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [splitBusy, setSplitBusy] = useState(false);
  const openSplit = (r: CostInvoice) => {
    setSplitFor(r);
    // Seed two even rows (first keeps the current company).
    const half = Math.round(r.amount_isk / 2);
    setAllocs([
      { company_id: r.company_id || "", amount: String(half), clients: "" },
      { company_id: "", amount: String(r.amount_isk - half), clients: "" },
    ]);
  };
  const allocSum = allocs.reduce((s, a) => s + (parseInt(a.amount, 10) || 0), 0);
  const submitSplit = async () => {
    if (!splitFor) return;
    const valid = allocs.filter((a) => a.company_id && (parseInt(a.amount, 10) || 0) >= 0);
    if (valid.length < 1) return;
    setSplitBusy(true);
    try {
      const res = await authedFetch(`/api/admin/accounting/invoices/split`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: splitFor.id, allocations: valid.map((a) => ({ company_id: a.company_id, amount_isk: parseInt(a.amount, 10) || 0, client_count: a.clients ? parseInt(a.clients, 10) : null })) }),
      });
      if (res.ok) { setSplitFor(null); await loadLedger(); }
      else { const j = await res.json().catch(() => ({})); alert(`Split failed: ${j.error || res.status}`); }
    } finally { setSplitBusy(false); }
  };

  // ── grouping ────────────────────────────────────────────────────
  const filtered = (invoices || []).filter((r) =>
    (!catFilter || r.category === catFilter) && (!companyFilter || r.company_id === companyFilter));
  const byMonth = new Map<string, CostInvoice[]>();
  for (const r of filtered) { const k = r.month.slice(0, 7); (byMonth.get(k) || byMonth.set(k, []).get(k)!).push(r); }
  const months = [...byMonth.keys()].sort().reverse();
  const grandTotal = filtered.reduce((s, r) => s + r.amount_isk, 0);

  const selCls = "text-xs border border-gray-200 rounded-md px-2 py-1 bg-white";
  const remaining = queue.filter((it) => it.status === "queued" || it.status === "error").length;

  return (
    <div className="px-8 pb-10 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Cost</h1>
          <p className="text-sm text-gray-500">Every recorded cost invoice, per month and categorized. Drag in PDFs to add new or old invoices — the AI reads them.</p>
        </div>
        <button onClick={() => setShowIntake((v) => !v)} className="text-xs font-medium px-3 py-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
          {showIntake ? "Hide intake" : "Add invoices"}
        </button>
      </div>

      {/* ── Intake ── */}
      {showIntake && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Default for new files</span>
            <label className="flex items-center gap-1.5">Company
              <select className={selCls} value={defaultCompany} onChange={(e) => setDefaultCompany(e.target.value)}>
                <option value="">Auto-detect</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5">Category
              <select className={selCls} value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)}>
                <option value="">Auto-detect</option>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files || [])); }}
            onClick={() => fileInput.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? "border-emerald-400 bg-emerald-50/60" : "border-gray-200 bg-gray-50/60 hover:border-emerald-300"}`}
          >
            <div className="text-sm font-medium text-gray-700">Drop cost-invoice PDFs here</div>
            <div className="text-xs text-gray-400 mt-0.5">or click to choose files</div>
            <input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg" multiple className="hidden"
              onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
          </div>
          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">{queue.filter((q) => q.status === "done").length} filed · {queue.filter((q) => q.status === "duplicate").length} dup · {queue.filter((q) => q.status === "error").length} err · {remaining} to go</span>
                <div className="flex gap-2">
                  <button onClick={() => setQueue((q) => q.filter((it) => it.status === "queued" || it.status === "error" || it.status === "uploading"))} className="text-[11px] text-gray-400 hover:text-gray-700">clear done</button>
                  <button onClick={uploadAll} disabled={busy || remaining === 0} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? "Uploading…" : `Upload ${remaining}`}</button>
                </div>
              </div>
              <div className="border border-gray-100 rounded-lg divide-y divide-gray-100">
                {queue.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                    <span className="flex-1 min-w-0 truncate text-gray-700" title={it.file.name}>{it.file.name}</span>
                    {it.status === "queued" || it.status === "error" ? (
                      <>
                        <select className={selCls} value={it.companyId} onChange={(e) => updateQ(it.id, { companyId: e.target.value })}>
                          <option value="">Auto company</option>
                          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select className={selCls} value={it.category} onChange={(e) => updateQ(it.id, { category: e.target.value })}>
                          <option value="">Auto category</option>
                          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <button onClick={() => uploadOne(it)} className="text-emerald-700 hover:underline">upload</button>
                        <button onClick={() => setQueue((q) => q.filter((x) => x.id !== it.id))} className="text-red-500 hover:text-red-700">×</button>
                      </>
                    ) : (
                      <span className={`whitespace-nowrap ${it.status === "done" ? "text-emerald-700" : it.status === "duplicate" ? "text-amber-600" : "text-gray-400"}`}>{it.status === "uploading" ? "reading…" : it.info || it.status}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Expected recurring costs (next month) ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <span className="text-sm font-semibold text-gray-900">Expected recurring costs · {nextMonthLabel}</span>
          <span className="text-sm font-bold text-gray-900">{isk(recurringTotal)}</span>
        </div>
        <p className="text-[11px] text-gray-400 mb-2">Subscriptions billed to the card that don&apos;t always have an invoice (Vercel, Claude, Medalia, …). Projected for next month.</p>
        <div className="space-y-1">
          {recurring.length === 0 ? <div className="text-xs text-gray-400">No recurring costs set.</div> : null}
          {recurring.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 text-xs text-gray-700">
              <span>{o.name}{o.quantity > 1 ? ` ×${o.quantity}` : ""}{o.amount_usd != null ? <span className="text-gray-400"> · ${o.amount_usd} USD</span> : null}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium">{isk(o.total_isk)}</span>
                <button onClick={() => removeRecurring(o.id)} className="text-red-500 hover:text-red-700" title="Remove">×</button>
              </span>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-gray-100 mt-1">
            <input className={`${selCls} flex-1 min-w-[140px]`} placeholder="Recurring cost (e.g. Notion)" value={newRec.name} onChange={(e) => setNewRec({ ...newRec, name: e.target.value })} />
            <input className={`${selCls} w-28`} type="number" placeholder="ISK / month" value={newRec.amount} onChange={(e) => setNewRec({ ...newRec, amount: e.target.value })} />
            <button onClick={addRecurring} className="text-xs font-medium px-2.5 py-1 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">Add</button>
          </div>
        </div>
      </div>

      {/* ── Filters + grand total ── */}
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <select className={selCls} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select className={selCls} value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
          <option value="">All companies</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="ml-auto text-gray-600">Total <span className="font-bold text-gray-900">{isk(grandTotal)}</span> · {filtered.length} invoices</span>
      </div>

      {/* ── Monthly ledger ── */}
      {invoices === null ? (
        <div className="text-sm text-gray-400">Loading costs…</div>
      ) : months.length === 0 ? (
        <div className="text-sm text-gray-400">No cost invoices{catFilter || companyFilter ? " match the filter" : " yet — drop some PDFs above"}.</div>
      ) : (
        <div className="space-y-4">
          {months.map((m) => {
            const rows = byMonth.get(m)!;
            const monthTotal = rows.reduce((s, r) => s + r.amount_isk, 0);
            const catTotals = CATEGORIES.map((c) => ({ c, t: rows.filter((r) => r.category === c.key).reduce((s, r) => s + r.amount_isk, 0) })).filter((x) => x.t > 0);
            return (
              <div key={m} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{monthLabel(m)}</span>
                  <span className="flex items-center gap-2 flex-wrap">
                    {catTotals.map(({ c, t }) => (
                      <span key={c.key} className="text-[10px] text-gray-500">{c.label} <b className="text-gray-700">{isk(t)}</b></span>
                    ))}
                    <span className="text-sm font-bold text-gray-900 ml-1">{isk(monthTotal)}</span>
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {rows.map((r) => (
                    <div key={r.id} className="px-4 py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-800 truncate">
                          {r.vendor || "Unknown vendor"}
                          {r.company?.name ? <span className="text-gray-400 font-normal"> · {r.company.name}</span> : null}
                          {r.split_group_id ? <span className="ml-1 text-[9px] px-1 py-px rounded bg-violet-50 border border-violet-200 text-violet-700">split</span> : null}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {[r.description, r.invoice_number ? `#${r.invoice_number}` : null, r.invoice_date, r.client_count != null ? `${r.client_count} clients` : null].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <select
                          className={`text-[10px] rounded-full border px-1.5 py-0.5 ${CAT_STYLE[r.category] || CAT_STYLE.other}`}
                          value={r.category}
                          onChange={(e) => patch(r.id, { category: e.target.value })}
                          title="Change category"
                        >
                          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{CAT_LABEL[c.key]}</option>)}
                        </select>
                        <select
                          className={selCls}
                          value={r.company_id || ""}
                          onChange={(e) => patch(r.id, { company_id: e.target.value || null })}
                          title="Tag company"
                        >
                          <option value="">No company</option>
                          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button onClick={() => editAmount(r)} className="font-semibold text-gray-900 hover:text-emerald-700" title="Edit amount">{isk(r.amount_isk)}</button>
                        <button onClick={() => openSplit(r)} className="text-gray-400 hover:text-emerald-700" title="Split this invoice across companies">split</button>
                        {r.file_url ? <a href={r.file_url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">PDF</a> : null}
                        <button onClick={() => removeInvoice(r.id)} className="text-red-500 hover:text-red-700" title="Delete">×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Split modal */}
      {splitFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setSplitFor(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-12" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Split across companies</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {splitFor.vendor || "Invoice"} · {isk(splitFor.amount_isk)}{splitFor.client_count != null ? ` · ${splitFor.client_count} clients` : ""}. Each company gets its own cost line sharing this PDF.
              </p>
            </div>
            <div className="p-5 space-y-2">
              <div className="grid grid-cols-[1fr_7rem_5rem_1.5rem] gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-0.5">
                <span>Company</span><span>Amount ISK</span><span>Clients</span><span></span>
              </div>
              {allocs.map((a, i) => (
                <div key={i} className="grid grid-cols-[1fr_7rem_5rem_1.5rem] gap-2 items-center">
                  <select className={`${selCls} min-w-0`} value={a.company_id} onChange={(e) => setAllocs((p) => p.map((x, j) => j === i ? { ...x, company_id: e.target.value } : x))}>
                    <option value="">Pick company…</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input className={`${selCls} min-w-0`} type="number" placeholder="Amount" value={a.amount} onChange={(e) => setAllocs((p) => p.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                  <input className={`${selCls} min-w-0`} type="number" placeholder="#" value={a.clients} onChange={(e) => setAllocs((p) => p.map((x, j) => j === i ? { ...x, clients: e.target.value } : x))} />
                  <button onClick={() => setAllocs((p) => p.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 text-center">×</button>
                </div>
              ))}
              <button onClick={() => setAllocs((p) => [...p, { company_id: "", amount: "", clients: "" }])} className="text-xs text-emerald-700 hover:underline">+ add company</button>
              <div className={`text-xs pt-1 ${allocSum === splitFor.amount_isk ? "text-emerald-700" : "text-amber-600"}`}>
                Allocated {isk(allocSum)} of {isk(splitFor.amount_isk)}{allocSum !== splitFor.amount_isk ? ` · ${allocSum > splitFor.amount_isk ? "over" : "under"} by ${isk(Math.abs(allocSum - splitFor.amount_isk))}` : " ✓"}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setSplitFor(null)} className="text-sm font-medium px-3 py-1.5 rounded-md text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={submitSplit} disabled={splitBusy || allocs.filter((a) => a.company_id).length < 1} className="text-sm font-semibold px-4 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                {splitBusy ? "Splitting…" : "Split invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
