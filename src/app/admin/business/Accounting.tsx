"use client";

// Accounting tab (admin/business) — monthly P&L derived from
// operational data + uploaded cost invoices. Server logic in
// src/lib/accounting.ts; tables in supabase/migration-accounting.sql.
//
//   Income   = PayDay company invoices (invoiced basis) + B2C card
//              payments (payday mirror rows excluded).
//   COGS     = completed measurements × rate + completed doctor
//              interviews × rate (rates date-effective, editable below).
//   Expenses = uploaded cost invoices (AI-parsed PDFs — Sameind etc.)
//              + recurring overheads (USD items converted at month FX)
//              + manual adjustments.
//
// Download CSV / Send to accountant produce the same DK-importable
// semicolon CSV the monthly cron (1st, 07:00 UTC) emails automatically.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const CATEGORIES = ["blood_tests", "measurements", "doctor", "saas", "other"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  blood_tests: "Blood tests",
  measurements: "Measurements",
  doctor: "Doctor",
  saas: "SaaS / systems",
  other: "Other",
};

interface Report {
  month: string;
  fx: { usd_isk: number; source: string } | null;
  income: {
    b2b_invoices: Array<{ id: string; company_name: string; invoice_number: string | null; status: string; issued_at: string | null; amount_isk: number }>;
    b2c_payments: { count: number; total_isk: number };
    adjustments: Array<{ id: string; description: string; amount_isk: number }>;
    total_isk: number;
  };
  cogs: {
    measurements: { count: number; pending_count: number; rate_isk: number; total_isk: number };
    doctor_interviews: { count: number; pending_count: number; rate_isk: number; total_isk: number };
    total_isk: number;
  };
  expense_adjustments: Array<{ id: string; description: string; amount_isk: number }>;
  totals: { income_isk: number; expense_invoices_isk: number; overheads_isk: number; expenses_isk: number; net_isk: number };
  warnings: string[];
}

interface ReportRun {
  id: string; sent_to: string; status: string; error: string | null;
  triggered_by: string; created_at: string;
}

interface ExpenseInvoice {
  id: string; vendor: string | null; description: string | null; category: string;
  amount_isk: number; currency: string; invoice_number: string | null;
  invoice_date: string | null; client_count: number | null;
  company_id: string | null; company?: { name?: string } | null;
  ai_confidence: string | null; file_url: string | null;
}

interface CompanyRow {
  company_id: string | null; company_name: string; invoice_count: number;
  invoiced_isk: number; paid_isk: number; outstanding_isk: number;
  costs_isk: number; net_isk: number;
}

interface Overhead {
  id: string; name: string; amount_isk: number | null; amount_usd: number | null;
  quantity: number; active: boolean; effective_from: string; effective_to: string | null;
  note: string | null;
}

interface CostRate {
  id: string; rate_key: string; label: string; amount_isk: number; effective_from: string;
}

const isk = (n: number) => `${Math.round(n).toLocaleString("is-IS")} kr.`;
const currentMonth = () => new Date().toISOString().slice(0, 7);

function Section({ title, hint, children, action }: {
  title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {hint ? <p className="text-xs text-gray-500 mt-0.5">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const btn = "text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50";
const btnPrimary = "text-xs font-medium px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50";
const inputCls = "text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export default function Accounting() {
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<Report | null>(null);
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [invoices, setInvoices] = useState<ExpenseInvoice[]>([]);
  const [overheads, setOverheads] = useState<Overhead[]>([]);
  const [rates, setRates] = useState<CostRate[]>([]);
  const [companyRows, setCompanyRows] = useState<CompanyRow[]>([]);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(path, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const [repRes, invRes, ovhRes, rateRes, compRes] = await Promise.all([
        authedFetch(`/api/admin/accounting/report?month=${month}`),
        authedFetch(`/api/admin/accounting/invoices?month=${month}`),
        authedFetch(`/api/admin/accounting/overheads`),
        authedFetch(`/api/admin/accounting/rates`),
        authedFetch(`/api/admin/accounting/companies`),
      ]);
      const rep = await repRes.json();
      if (!repRes.ok) throw new Error(rep.error || "report failed");
      setReport(rep.report);
      setRuns(rep.runs || []);
      const inv = await invRes.json();
      setInvoices(inv.invoices || []);
      const ovh = await ovhRes.json();
      setOverheads(ovh.overheads || []);
      const rts = await rateRes.json();
      setRates(rts.rates || []);
      const comp = await compRes.json();
      setCompanyRows(comp.rows || []);
      setCompanies(comp.companies || []);
    } catch (e) {
      setMsg(`Load failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [authedFetch, month]);

  useEffect(() => { refresh(); }, [refresh]);

  const act = useCallback(async (
    key: string,
    fn: () => Promise<Response>,
    okMsg?: string,
  ) => {
    setBusy(key);
    setMsg("");
    try {
      const res = await fn();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (json.warnings?.length) setMsg(`Saved. ${json.warnings.join(" · ")}`);
      else if (okMsg) setMsg(okMsg);
      await refresh();
    } catch (e) {
      setMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  // ── Header actions ──────────────────────────────────────────────

  const downloadCsv = async () => {
    setBusy("csv");
    try {
      const res = await authedFetch(`/api/admin/accounting/export?month=${month}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lifeline-bokhald-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMsg(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const sendToAccountant = () => {
    if (!confirm(`Send the ${month} report to the accounting firm now?`)) return;
    act("send", () => authedFetch(`/api/admin/accounting/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    }), "Report sent to the accounting firm.");
  };

  // ── Invoice upload + edit ───────────────────────────────────────

  const [uploadCompany, setUploadCompany] = useState("");
  const uploadInvoice = (file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("month", month);
    if (uploadCompany) form.append("company_id", uploadCompany);
    act("upload", () => authedFetch(`/api/admin/accounting/invoices`, { method: "POST", body: form }),
      "Invoice uploaded and parsed.");
  };

  const [editingInvoice, setEditingInvoice] = useState<ExpenseInvoice | null>(null);
  const saveInvoice = () => {
    if (!editingInvoice) return;
    const inv = editingInvoice;
    setEditingInvoice(null);
    act("edit-invoice", () => authedFetch(`/api/admin/accounting/invoices`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: inv.id,
        vendor: inv.vendor,
        description: inv.description,
        category: inv.category,
        amount_isk: inv.amount_isk,
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        client_count: inv.client_count,
        company_id: inv.company_id,
      }),
    }));
  };

  // ── Add-forms state ─────────────────────────────────────────────

  const [newAdj, setNewAdj] = useState({ kind: "expense", description: "", amount: "", company_id: "" });
  const addAdjustment = () => {
    const amount = parseInt(newAdj.amount, 10);
    if (!newAdj.description.trim() || !Number.isInteger(amount) || amount < 0) {
      setMsg("Adjustment needs a description and a non-negative ISK amount.");
      return;
    }
    setNewAdj({ kind: newAdj.kind, description: "", amount: "", company_id: "" });
    act("add-adj", () => authedFetch(`/api/admin/accounting/adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month, kind: newAdj.kind, description: newAdj.description.trim(),
        amount_isk: amount, company_id: newAdj.company_id || null,
      }),
    }));
  };

  const [newOvh, setNewOvh] = useState({ name: "", amount: "", currency: "ISK", quantity: "1", note: "" });
  const addOverhead = () => {
    const amount = Number(newOvh.amount);
    const quantity = parseInt(newOvh.quantity, 10) || 1;
    if (!newOvh.name.trim() || !Number.isFinite(amount) || amount < 0) {
      setMsg("Overhead needs a name and a non-negative amount.");
      return;
    }
    const body: Record<string, unknown> = { name: newOvh.name.trim(), quantity, note: newOvh.note.trim() || null };
    if (newOvh.currency === "USD") body.amount_usd = amount;
    else body.amount_isk = Math.round(amount);
    setNewOvh({ name: "", amount: "", currency: "ISK", quantity: "1", note: "" });
    act("add-ovh", () => authedFetch(`/api/admin/accounting/overheads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
  };

  const [newRate, setNewRate] = useState({ rate_key: "measurement", amount: "", effective_from: "" });
  const addRate = () => {
    const amount = parseInt(newRate.amount, 10);
    if (!Number.isInteger(amount) || amount < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(newRate.effective_from)) {
      setMsg("Rate needs an ISK amount and an effective-from date.");
      return;
    }
    const label = rates.find((r) => r.rate_key === newRate.rate_key)?.label || newRate.rate_key;
    setNewRate({ rate_key: newRate.rate_key, amount: "", effective_from: "" });
    act("add-rate", () => authedFetch(`/api/admin/accounting/rates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rate_key: newRate.rate_key, label, amount_isk: amount, effective_from: newRate.effective_from }),
    }));
  };

  const setFxManually = () => {
    const v = prompt(`USD/ISK rate for ${month}:`, report?.fx ? String(report.fx.usd_isk) : "");
    if (!v) return;
    const rate = Number(v.replace(",", "."));
    if (!Number.isFinite(rate) || rate <= 0) { setMsg("Bad FX rate."); return; }
    act("fx", () => authedFetch(`/api/admin/accounting/fx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, usd_isk: rate }),
    }));
  };

  // ── Render ──────────────────────────────────────────────────────

  const lastRun = runs[0];
  const t = report?.totals;

  return (
    <div className="px-8 pb-10 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => setMonth(e.target.value)}
            className={inputCls}
          />
          {loading ? <span className="text-xs text-gray-400">Loading…</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <button className={btn} onClick={downloadCsv} disabled={busy !== null || loading}>
            {busy === "csv" ? "Exporting…" : "Download CSV"}
          </button>
          <button className={btnPrimary} onClick={sendToAccountant} disabled={busy !== null || loading}>
            {busy === "send" ? "Sending…" : "Send to accountant"}
          </button>
        </div>
      </div>

      {msg ? (
        <div className="text-xs rounded-md px-3 py-2 border bg-amber-50 border-amber-200 text-amber-900">{msg}</div>
      ) : null}
      {report?.warnings?.length ? (
        <div className="text-xs rounded-md px-3 py-2 border bg-amber-50 border-amber-200 text-amber-900">
          {report.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      ) : null}

      {/* P&L summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-gray-200 rounded-lg bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Income</div>
          <div className="text-lg font-bold text-gray-900">{t ? isk(t.income_isk) : "—"}</div>
        </div>
        <div className="border border-gray-200 rounded-lg bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Expenses</div>
          <div className="text-lg font-bold text-gray-900">{t ? isk(t.expenses_isk) : "—"}</div>
        </div>
        <div className="border border-gray-200 rounded-lg bg-white p-4">
          <div className="text-xs text-gray-500 mb-1">Net</div>
          <div className={`text-lg font-bold ${t && t.net_isk < 0 ? "text-red-600" : "text-emerald-700"}`}>
            {t ? isk(t.net_isk) : "—"}
          </div>
          {lastRun ? (
            <div className="text-[11px] text-gray-400 mt-1">
              Last sent {new Date(lastRun.created_at).toLocaleDateString("is-IS")} ({lastRun.triggered_by}, {lastRun.status})
            </div>
          ) : (
            <div className="text-[11px] text-gray-400 mt-1">Not yet sent to accountant</div>
          )}
        </div>
      </div>

      {/* Per company (all-time) */}
      <Section
        title="Per company"
        hint="All-time per company: invoiced (PayDay, excl. cancelled), paid, outstanding receivables, and costs tagged to the company. Net = invoiced − costs. Untagged costs land in Unassigned."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-700">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="py-1.5 pr-3 font-medium">Company</th>
                <th className="py-1.5 pr-3 font-medium text-right">Invoiced</th>
                <th className="py-1.5 pr-3 font-medium text-right">Paid</th>
                <th className="py-1.5 pr-3 font-medium text-right">Outstanding</th>
                <th className="py-1.5 pr-3 font-medium text-right">Costs</th>
                <th className="py-1.5 font-medium text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {companyRows.map((r) => (
                <tr key={r.company_id || "unassigned"} className="border-b border-gray-50">
                  <td className={`py-1.5 pr-3 ${r.company_id ? "" : "text-gray-400 italic"}`}>
                    {r.company_name}
                    {r.invoice_count > 0 ? <span className="text-gray-400"> · {r.invoice_count} inv.</span> : null}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{isk(r.invoiced_isk)}</td>
                  <td className="py-1.5 pr-3 text-right">{isk(r.paid_isk)}</td>
                  <td className={`py-1.5 pr-3 text-right ${r.outstanding_isk > 0 ? "text-amber-600 font-medium" : ""}`}>
                    {isk(r.outstanding_isk)}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{isk(r.costs_isk)}</td>
                  <td className={`py-1.5 text-right font-medium ${r.net_isk < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {isk(r.net_isk)}
                  </td>
                </tr>
              ))}
              {companyRows.length === 0 ? (
                <tr><td colSpan={6} className="py-2 text-gray-400">No company invoices or tagged costs yet.</td></tr>
              ) : (
                <tr className="font-semibold text-gray-900">
                  <td className="py-1.5 pr-3">Total</td>
                  <td className="py-1.5 pr-3 text-right">{isk(companyRows.reduce((s, r) => s + r.invoiced_isk, 0))}</td>
                  <td className="py-1.5 pr-3 text-right">{isk(companyRows.reduce((s, r) => s + r.paid_isk, 0))}</td>
                  <td className="py-1.5 pr-3 text-right">{isk(companyRows.reduce((s, r) => s + r.outstanding_isk, 0))}</td>
                  <td className="py-1.5 pr-3 text-right">{isk(companyRows.reduce((s, r) => s + r.costs_isk, 0))}</td>
                  <td className="py-1.5 text-right">{isk(companyRows.reduce((s, r) => s + r.net_isk, 0))}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Income */}
      <Section
        title="Income"
        hint="B2B invoices on invoiced basis (issued this month, PayDay); B2C card payments on paid basis. PayDay mirror rows in payments are excluded to avoid double counting."
      >
        <div className="space-y-1.5 text-xs text-gray-700">
          {report?.income.b2b_invoices.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 border-b border-gray-50 pb-1.5">
              <span>
                {inv.company_name}
                <span className="text-gray-400"> · {inv.invoice_number || "no number"} · {inv.status}</span>
              </span>
              <span className="font-medium">{isk(inv.amount_isk)}</span>
            </div>
          ))}
          {report && report.income.b2b_invoices.length === 0 ? (
            <div className="text-gray-400">No B2B invoices issued this month.</div>
          ) : null}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span>B2C card payments ({report?.income.b2c_payments.count ?? 0})</span>
            <span className="font-medium">{isk(report?.income.b2c_payments.total_isk ?? 0)}</span>
          </div>
          {report?.income.adjustments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2">
              <span className="text-gray-500">Adjustment: {a.description}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium">{isk(a.amount_isk)}</span>
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => act("del-adj", () => authedFetch(`/api/admin/accounting/adjustments?id=${a.id}`, { method: "DELETE" }))}
                >×</button>
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100 font-semibold text-gray-900">
            <span>Total income</span>
            <span>{isk(report?.income.total_isk ?? 0)}</span>
          </div>
        </div>
      </Section>

      {/* Derived costs */}
      <Section
        title="Per-client costs (derived)"
        hint="Counted from slots marked completed in admin (station slots + doctor slots) × the effective rate. Use adjustments for anything the counts miss."
      >
        <div className="space-y-1.5 text-xs text-gray-700">
          <div className="flex items-center justify-between gap-2">
            <span>
              Measurements: {report?.cogs.measurements.count ?? 0} × {isk(report?.cogs.measurements.rate_isk ?? 0)}
              {report && report.cogs.measurements.pending_count > 0 ? (
                <span className="text-amber-600"> · {report.cogs.measurements.pending_count} booked but not marked completed</span>
              ) : null}
            </span>
            <span className="font-medium">{isk(report?.cogs.measurements.total_isk ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>
              Doctor interviews: {report?.cogs.doctor_interviews.count ?? 0} × {isk(report?.cogs.doctor_interviews.rate_isk ?? 0)}
              {report && report.cogs.doctor_interviews.pending_count > 0 ? (
                <span className="text-amber-600"> · {report.cogs.doctor_interviews.pending_count} booked but not marked completed</span>
              ) : null}
            </span>
            <span className="font-medium">{isk(report?.cogs.doctor_interviews.total_isk ?? 0)}</span>
          </div>
        </div>
      </Section>

      {/* Cost invoices */}
      <Section
        title="Cost invoices"
        hint="Upload supplier PDFs (Sameind blood tests etc.) — fields are AI-extracted, then editable. One invoice can cover a whole month of clients."
        action={
          <span className="flex items-center gap-2">
            <select className={inputCls} value={uploadCompany} onChange={(e) => setUploadCompany(e.target.value)}>
              <option value="">No company tag</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          <label className={`${btn} cursor-pointer`}>
            {busy === "upload" ? "Uploading…" : "Upload invoice"}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              className="hidden"
              disabled={busy !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadInvoice(f);
              }}
            />
          </label>
          </span>
        }
      >
        <div className="space-y-2 text-xs text-gray-700">
          {invoices.length === 0 ? <div className="text-gray-400">No cost invoices for this month yet.</div> : null}
          {invoices.map((inv) => (
            editingInvoice?.id === inv.id ? (
              <div key={inv.id} className="border border-emerald-200 rounded-md p-2 grid grid-cols-2 sm:grid-cols-3 gap-2 bg-emerald-50/40">
                <input className={inputCls} placeholder="Vendor" value={editingInvoice.vendor || ""}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, vendor: e.target.value })} />
                <input className={inputCls} placeholder="Description" value={editingInvoice.description || ""}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, description: e.target.value })} />
                <select className={inputCls} value={editingInvoice.category}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
                <input className={inputCls} type="number" placeholder="Amount ISK" value={editingInvoice.amount_isk}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, amount_isk: parseInt(e.target.value, 10) || 0 })} />
                <input className={inputCls} placeholder="Invoice #" value={editingInvoice.invoice_number || ""}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, invoice_number: e.target.value })} />
                <input className={inputCls} type="date" value={editingInvoice.invoice_date || ""}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, invoice_date: e.target.value || null })} />
                <input className={inputCls} type="number" placeholder="Client count" value={editingInvoice.client_count ?? ""}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, client_count: e.target.value === "" ? null : parseInt(e.target.value, 10) })} />
                <select className={inputCls} value={editingInvoice.company_id || ""}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, company_id: e.target.value || null })}>
                  <option value="">No company tag</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex items-center gap-2 col-span-2 sm:col-span-2 justify-end">
                  <button className={btn} onClick={() => setEditingInvoice(null)}>Cancel</button>
                  <button className={btnPrimary} onClick={saveInvoice}>Save</button>
                </div>
              </div>
            ) : (
              <div key={inv.id} className="flex items-center justify-between gap-2 border-b border-gray-50 pb-1.5">
                <span>
                  <span className="font-medium">{inv.vendor || "Unknown vendor"}</span>
                  <span className="text-gray-400">
                    {" "}· {CATEGORY_LABELS[inv.category] || inv.category}
                    {inv.company?.name ? ` · ${inv.company.name}` : ""}
                    {inv.client_count != null ? ` · ${inv.client_count} clients` : ""}
                    {inv.invoice_number ? ` · #${inv.invoice_number}` : ""}
                    {inv.ai_confidence ? ` · AI: ${inv.ai_confidence}` : ""}
                  </span>
                  {inv.description ? <span className="block text-gray-500">{inv.description}</span> : null}
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className="font-medium">{isk(inv.amount_isk)}</span>
                  {inv.file_url ? (
                    <a href={inv.file_url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">PDF</a>
                  ) : null}
                  <button className="text-gray-500 hover:text-gray-800" onClick={() => setEditingInvoice(inv)}>Edit</button>
                  <button
                    className="text-red-500 hover:text-red-700"
                    onClick={() => {
                      if (confirm("Delete this invoice and its file?")) {
                        act("del-inv", () => authedFetch(`/api/admin/accounting/invoices?id=${inv.id}`, { method: "DELETE" }));
                      }
                    }}
                  >×</button>
                </span>
              </div>
            )
          ))}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100 font-semibold text-gray-900">
            <span>Cost invoices total</span>
            <span>{isk(t?.expense_invoices_isk ?? 0)}</span>
          </div>
        </div>
      </Section>

      {/* Overheads */}
      <Section
        title="Monthly overheads"
        hint="Recurring system costs. USD items are converted with the month FX rate; ISK items (Medalia seats) stay fixed."
        action={
          <button className={btn} onClick={setFxManually} disabled={busy !== null}>
            FX: {report?.fx ? `${report.fx.usd_isk} USD/ISK (${report.fx.source})` : "not set"} — edit
          </button>
        }
      >
        <div className="space-y-1.5 text-xs text-gray-700">
          {overheads.filter((o) => o.active).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 border-b border-gray-50 pb-1.5">
              <span>
                {o.name}
                <span className="text-gray-400">
                  {" "}· {o.amount_usd != null ? `$${o.amount_usd}` : isk(o.amount_isk || 0)}
                  {o.quantity > 1 ? ` × ${o.quantity}` : ""}
                  {o.note ? ` · ${o.note}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <button
                  className="text-gray-500 hover:text-gray-800"
                  onClick={() => {
                    const q = prompt(`Quantity for ${o.name}:`, String(o.quantity));
                    if (!q) return;
                    const quantity = parseInt(q, 10);
                    if (!Number.isInteger(quantity) || quantity < 1) { setMsg("Bad quantity."); return; }
                    act("ovh-qty", () => authedFetch(`/api/admin/accounting/overheads`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: o.id, quantity }),
                    }));
                  }}
                >qty</button>
                <button
                  className="text-gray-500 hover:text-gray-800"
                  onClick={() => act("ovh-off", () => authedFetch(`/api/admin/accounting/overheads`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: o.id, active: false }),
                  }))}
                >deactivate</button>
              </span>
            </div>
          ))}
          {overheads.filter((o) => !o.active).map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 text-gray-400">
              <span>{o.name} (inactive)</span>
              <button
                className="hover:text-gray-700"
                onClick={() => act("ovh-on", () => authedFetch(`/api/admin/accounting/overheads`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: o.id, active: true }),
                }))}
              >reactivate</button>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100 font-semibold text-gray-900">
            <span>Overheads total (this month)</span>
            <span>{isk(t?.overheads_isk ?? 0)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <input className={inputCls} placeholder="Name (e.g. Vercel)" value={newOvh.name}
              onChange={(e) => setNewOvh({ ...newOvh, name: e.target.value })} />
            <input className={`${inputCls} w-24`} type="number" placeholder="Amount" value={newOvh.amount}
              onChange={(e) => setNewOvh({ ...newOvh, amount: e.target.value })} />
            <select className={inputCls} value={newOvh.currency}
              onChange={(e) => setNewOvh({ ...newOvh, currency: e.target.value })}>
              <option value="ISK">ISK</option>
              <option value="USD">USD</option>
            </select>
            <input className={`${inputCls} w-16`} type="number" placeholder="Qty" value={newOvh.quantity}
              onChange={(e) => setNewOvh({ ...newOvh, quantity: e.target.value })} />
            <input className={inputCls} placeholder="Note (optional)" value={newOvh.note}
              onChange={(e) => setNewOvh({ ...newOvh, note: e.target.value })} />
            <button className={btn} onClick={addOverhead} disabled={busy !== null}>Add overhead</button>
          </div>
        </div>
      </Section>

      {/* Adjustments */}
      <Section
        title="Adjustments"
        hint="Manual one-off corrections for this month — extra income or expenses the derived numbers miss."
      >
        <div className="space-y-1.5 text-xs text-gray-700">
          {report?.expense_adjustments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2">
              <span>Expense: {a.description}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium">−{isk(a.amount_isk)}</span>
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => act("del-adj", () => authedFetch(`/api/admin/accounting/adjustments?id=${a.id}`, { method: "DELETE" }))}
                >×</button>
              </span>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select className={inputCls} value={newAdj.kind}
              onChange={(e) => setNewAdj({ ...newAdj, kind: e.target.value })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input className={inputCls} placeholder="Description" value={newAdj.description}
              onChange={(e) => setNewAdj({ ...newAdj, description: e.target.value })} />
            <input className={`${inputCls} w-28`} type="number" placeholder="Amount ISK" value={newAdj.amount}
              onChange={(e) => setNewAdj({ ...newAdj, amount: e.target.value })} />
            <select className={inputCls} value={newAdj.company_id}
              onChange={(e) => setNewAdj({ ...newAdj, company_id: e.target.value })}>
              <option value="">No company tag</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className={btn} onClick={addAdjustment} disabled={busy !== null}>Add adjustment</button>
          </div>
        </div>
      </Section>

      {/* Cost rates */}
      <Section
        title="Cost rates"
        hint="Date-effective per-unit costs. Adding a rate with a new effective-from date changes future months only — history keeps the old rate. The blood-test rate is reference only (actual cost comes from uploaded invoices)."
      >
        <div className="space-y-1.5 text-xs text-gray-700">
          {rates.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2">
              <span>{r.label} <span className="text-gray-400">· from {r.effective_from}</span></span>
              <span className="font-medium">{isk(r.amount_isk)}</span>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select className={inputCls} value={newRate.rate_key}
              onChange={(e) => setNewRate({ ...newRate, rate_key: e.target.value })}>
              <option value="measurement">Body measurement</option>
              <option value="doctor_interview">Doctor interview</option>
              <option value="blood_test">Blood test (reference)</option>
            </select>
            <input className={`${inputCls} w-28`} type="number" placeholder="Amount ISK" value={newRate.amount}
              onChange={(e) => setNewRate({ ...newRate, amount: e.target.value })} />
            <input className={inputCls} type="date" value={newRate.effective_from}
              onChange={(e) => setNewRate({ ...newRate, effective_from: e.target.value })} />
            <button className={btn} onClick={addRate} disabled={busy !== null}>Add rate</button>
          </div>
        </div>
      </Section>

      {/* Send log */}
      {runs.length > 0 ? (
        <Section title="Send log" hint="Reports sent to the accounting firm for this month.">
          <div className="space-y-1 text-xs text-gray-600">
            {runs.map((r) => (
              <div key={r.id}>
                {new Date(r.created_at).toLocaleString("is-IS")} → {r.sent_to} · {r.triggered_by} ·{" "}
                <span className={r.status === "sent" ? "text-emerald-700" : "text-red-600"}>{r.status}</span>
                {r.error ? ` · ${r.error}` : ""}
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
