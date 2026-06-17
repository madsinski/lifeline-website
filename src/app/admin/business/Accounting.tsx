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
import Link from "next/link";
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
    other_invoiced: { count: number; total_isk: number; lines: Array<{ id: string; customer: string | null; invoice_number: string | null; amount_isk: number }> };
    adjustments: Array<{ id: string; description: string; amount_isk: number }>;
    total_isk: number;
  };
  cogs: {
    measurements: { count: number; pending_count: number; rate_isk: number; total_isk: number };
    doctor_interviews: { count: number; pending_count: number; rate_isk: number; total_isk: number };
    total_isk: number;
  };
  expense_adjustments: Array<{ id: string; description: string; amount_isk: number }>;
  founder_salaries?: { amount_isk: number; note: string | null; is_set: boolean };
  totals: { income_isk: number; expense_invoices_isk: number; overheads_isk: number; founder_salaries_isk?: number; expenses_isk: number; net_isk: number };
  warnings: string[];
}

interface ReportRun {
  id: string; sent_to: string; status: string; error: string | null;
  triggered_by: string; created_at: string;
}

interface ExpenseInvoice {
  id: string; direction: "cost" | "income"; vendor: string | null; description: string | null; category: string;
  amount_isk: number; currency: string; invoice_number: string | null;
  invoice_date: string | null; client_count: number | null;
  company_id: string | null; company?: { name?: string } | null;
  paid_by: string | null; reimbursed_at: string | null; payer?: { name?: string } | null;
  ai_confidence: string | null; file_url: string | null;
}

interface ReimbursementRow {
  staff_id: string; staff_name: string; invoice_count: number; total_isk: number;
}

interface PositionData {
  cash: number;
  revenue: number;
  internal: {
    reimbursements: Array<{ name: string; amount_isk: number }>;
    reimb_total_isk: number;
    reimb_deferred: boolean;
    manual_isk: number;
    manual_label: string;
    manual_deferred: boolean;
    total_isk: number;
    active_isk: number;
    deferred_isk: number;
  };
  external: {
    health_checks_outstanding_isk: number;
    health_check_breakdown: Array<{ company_id: string; company_name: string; category: string; label: string; provider: string | null; head_count: number; rate_isk: number; outstanding_isk: number }>;
    health_check_lines: Array<{
      company_id: string; company_name: string; category: "measurements" | "blood_tests"; label: string;
      provider: string | null; head_count: number; head_count_overridden: boolean; rate_isk: number;
      expected_isk: number; status: string; paid: boolean; applicable: boolean; deferred: boolean; unpaid_isk: number;
    }>;
    health_check_expected_isk: number;
    health_check_paid_isk: number;
    biody_isk: number;
    biody_deferred: boolean;
    total_isk: number;
    active_isk: number;
    deferred_isk: number;
  };
  total_owed_now_isk: number;
  total_deferred_isk: number;
  net_position_isk: number;
}

interface TotalsOverview {
  income: {
    payday_invoiced_isk: number; payday_paid_isk: number; payday_outstanding_isk: number;
    scanned_sales_isk: number; b2c_paid_isk: number; b2c_count: number;
    adjustments_isk: number; total_invoiced_isk: number; total_received_isk: number;
  };
  costs: {
    invoices_recorded_isk: number; adjustments_isk: number; overheads_accrued_isk: number;
    recorded_total_isk: number; unreimbursed_isk: number;
    health_checks_done: number; per_check_cost_isk: number; per_check_expected_isk: number;
    per_check_recorded_isk: number; per_check_outstanding_isk: number;
    manual_liabilities_isk: number; outstanding_total_isk: number; grand_total_isk: number;
  };
  net: { realized_isk: number; full_isk: number };
  items: { income: OverviewLineItem[]; costs: OverviewLineItem[] };
  warnings: string[];
}

interface OverviewLineItem {
  date: string; label: string; ref?: string | null; category?: string | null;
  amount_isk: number; note?: string | null;
}

interface CompanyRow {
  company_id: string | null; company_name: string; invoice_count: number;
  invoiced_isk: number; paid_isk: number; outstanding_isk: number;
  costs_isk: number; net_isk: number;
  member_count: number; expected_income_isk: number;
  expected_cost_isk: number; expected_net_isk: number;
}

interface DoctorPool {
  rate_isk: number;
  expected_count: number; expected_isk: number;
  performed_count: number; performed_isk: number;
  paid_isk: number;
}

interface WorkSplitRow {
  staff_id: string; staff_name: string; role: "doctor" | "measurer";
  client_count: number; rate_isk: number; amount_isk: number;
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
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (key: string) => MONTHS_EN[parseInt(key.slice(5, 7), 10) - 1] || key;

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
// Compact controls for the dense Financial-position table.
const btnXs = "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50";
const btnXsActive = "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50";
const selXs = "text-[11px] border border-gray-200 rounded-md px-1.5 py-0.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500";

// Founders' salaries, editable month by month. Each month holds a total
// company cost (gross + employer on-costs); a month left unset counts as 0.
function FounderSalaries({ authedFetch, initialYear, currentMonthKey, onChanged }: {
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>;
  initialYear: number;
  currentMonthKey: string;
  onChanged: () => void;
}) {
  const [year, setYear] = useState(initialYear);
  const [data, setData] = useState<{ default_isk: number; months: Array<{ month: string; amount_isk: number; is_set: boolean; note: string | null }> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await authedFetch(`/api/admin/accounting/founder-salaries?year=${year}`);
    setData(res.ok ? await res.json() : null);
  }, [authedFetch, year]);

  useEffect(() => { queueMicrotask(load); }, [load]);

  const setMonthAmount = async (monthKey: string, amount: number | null) => {
    setBusy(true); setMsg("");
    const res = await authedFetch(`/api/admin/accounting/founder-salaries`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: monthKey, amount_isk: amount }),
    });
    if (!res.ok) setMsg("Save failed.");
    await load();
    onChanged();
    setBusy(false);
  };

  const editDefault = async () => {
    if (!data) return;
    const v = prompt("Default monthly founders' salary (ISK) — pre-fill suggestion only:", String(data.default_isk));
    if (v === null) return;
    const n = parseInt(v.replace(/[^\d]/g, ""), 10);
    if (!Number.isInteger(n) || n < 0) { setMsg("Bad amount."); return; }
    setBusy(true);
    const res = await authedFetch(`/api/admin/accounting/plan`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "founder_salary_default_isk", value: n }),
    });
    if (!res.ok) setMsg("Save failed.");
    await load();
    setBusy(false);
  };

  const def = data?.default_isk ?? 1600000;
  const yearTotal = (data?.months || []).reduce((s, m) => s + m.amount_isk, 0);

  return (
    <div className="space-y-2 text-xs text-gray-700">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button type="button" className={btnXs} onClick={() => setYear(year - 1)} disabled={busy}>←</button>
          <span className="font-semibold text-gray-800">{year}</span>
          <button type="button" className={btnXs} onClick={() => setYear(year + 1)} disabled={busy}>→</button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Default / month</span>
          <span className="font-medium tabular-nums">{isk(def)}</span>
          <button type="button" className={btnXs} onClick={editDefault} disabled={busy}>Edit</button>
        </div>
      </div>
      <table className="w-full border-collapse">
        <tbody>
          {(data?.months || []).map((m) => {
            const isCurrent = m.month === currentMonthKey;
            return (
              <tr key={m.month} className={`border-b border-gray-50 ${isCurrent ? "bg-emerald-50/40" : ""}`}>
                <td className="py-1">
                  <span className="font-medium text-gray-800">{monthLabel(m.month)}</span>
                  {isCurrent ? <span className="text-emerald-600"> · this month</span> : null}
                </td>
                <td className="py-1 text-right tabular-nums w-28">
                  {m.is_set ? <span className="font-medium text-gray-900">{isk(m.amount_isk)}</span> : <span className="text-gray-400">not set</span>}
                </td>
                <td className="py-1 text-right whitespace-nowrap w-44">
                  <button
                    type="button" className={btnXs} disabled={busy}
                    onClick={() => {
                      const v = prompt(`${monthLabel(m.month)} ${m.month.slice(0, 4)} — founders' salary total for the company (ISK):`, String(m.is_set ? m.amount_isk : def));
                      if (v === null) return;
                      const n = parseInt(v.replace(/[^\d]/g, ""), 10);
                      if (!Number.isInteger(n) || n < 0) { setMsg("Bad amount."); return; }
                      setMonthAmount(m.month, n);
                    }}
                  >{m.is_set ? "Edit" : "Set"}</button>{" "}
                  {m.is_set ? (
                    <button type="button" className={btnXs} disabled={busy} onClick={() => setMonthAmount(m.month, null)}>Clear</button>
                  ) : (
                    <button type="button" className={btnXs} disabled={busy} onClick={() => setMonthAmount(m.month, def)}>Use default</button>
                  )}
                </td>
              </tr>
            );
          })}
          <tr className="font-semibold text-gray-900">
            <td className="py-1.5">{year} total</td>
            <td className="py-1.5 text-right tabular-nums">{isk(yearTotal)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      {msg ? <div className="text-amber-700">{msg}</div> : null}
    </div>
  );
}

export default function Accounting() {
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<Report | null>(null);
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [invoices, setInvoices] = useState<ExpenseInvoice[]>([]);
  const [overheads, setOverheads] = useState<Overhead[]>([]);
  const [rates, setRates] = useState<CostRate[]>([]);
  const [companyRows, setCompanyRows] = useState<CompanyRow[]>([]);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [doctorPool, setDoctorPool] = useState<DoctorPool | null>(null);
  const [workSplit, setWorkSplit] = useState<WorkSplitRow[]>([]);
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [reimbursements, setReimbursements] = useState<ReimbursementRow[]>([]);
  const [totals, setTotals] = useState<TotalsOverview | null>(null);
  const [position, setPosition] = useState<PositionData | null>(null);
  // Overview scope: all time / picker year / picker month, optional
  // single-company lens, and the itemized line view.
  const [scope, setScope] = useState<"all" | "year" | "month">("all");
  const [scopeCompany, setScopeCompany] = useState("");
  const [showItems, setShowItems] = useState(false);
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
      // The table shows relationships where money has actually moved;
      // roster-only rows carry projections for the Companies tab.
      setCompanyRows(((comp.rows || []) as CompanyRow[])
        .filter((r) => r.invoice_count > 0 || r.costs_isk > 0));
      setCompanies(comp.companies || []);
      setDoctorPool(comp.doctor_pool || null);
      setWorkSplit(comp.work_split || []);
      setStaffList(comp.staff || []);
      setReimbursements(comp.reimbursements || []);
      const posRes = await authedFetch(`/api/admin/accounting/position`);
      setPosition(posRes.ok ? await posRes.json() : null);
    } catch (e) {
      setMsg(`Load failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [authedFetch, month]);

  // Edit a position setting (cash / Biody liability / Þorvaldur) via the
  // shared plan-settings endpoint, then refresh the panel.
  const editPosition = useCallback(async (key: string, label: string, current: number) => {
    const v = prompt(`${label} (ISK):`, String(current));
    if (v === null) return;
    const value = Number(v.replace(/[. ]/g, "").replace(",", "."));
    if (!Number.isFinite(value)) { setMsg("Not a number."); return; }
    const res = await authedFetch(`/api/admin/accounting/plan`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }),
    });
    if (!res.ok) { setMsg("Save failed."); return; }
    const posRes = await authedFetch(`/api/admin/accounting/position`);
    setPosition(posRes.ok ? await posRes.json() : position);
  }, [authedFetch, position]);

  // Defer / un-defer an internal-debt bucket (founder loan we're in no hurry
  // to repay). Stored as a numeric 0/1 setting; deferred amounts drop out of
  // the net-position math and move to the Deferred column.
  const toggleDefer = useCallback(async (key: string, next: boolean) => {
    const res = await authedFetch(`/api/admin/accounting/plan`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: next ? 1 : 0 }),
    });
    if (!res.ok) { setMsg("Save failed."); return; }
    const posRes = await authedFetch(`/api/admin/accounting/position`);
    setPosition(posRes.ok ? await posRes.json() : position);
  }, [authedFetch, position]);

  // Update a company's health-check cost line (paid/unpaid status or head
  // count) from the Financial position panel, then refresh.
  const saveCostItem = useCallback(async (companyId: string, category: string, patch: Record<string, unknown>) => {
    const res = await authedFetch(`/api/admin/accounting/cost-items`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId, category, ...patch }),
    });
    if (!res.ok) { setMsg("Save failed."); return; }
    const posRes = await authedFetch(`/api/admin/accounting/position`);
    setPosition(posRes.ok ? await posRes.json() : position);
  }, [authedFetch, position]);

  useEffect(() => { refresh(); }, [refresh]);

  const loadTotals = useCallback(async () => {
    const params = new URLSearchParams();
    if (scope === "month") { params.set("from", month); params.set("to", month); }
    else if (scope === "year") {
      const y = month.slice(0, 4);
      params.set("from", `${y}-01`);
      params.set("to", `${y}-12`);
    }
    if (scopeCompany) params.set("company_id", scopeCompany);
    try {
      const res = await authedFetch(`/api/admin/accounting/totals?${params.toString()}`);
      const json = res.ok ? await res.json() : null;
      setTotals(json?.totals || null);
    } catch {
      setTotals(null);
    }
  }, [authedFetch, scope, scopeCompany, month]);

  useEffect(() => { loadTotals(); }, [loadTotals]);

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
      await loadTotals();
    } catch (e) {
      setMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }, [refresh, loadTotals]);

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

  // Bulk dump: many PDFs at once, month="auto" — the AI files each
  // invoice under its own invoice-date month, categorizes it, and the
  // server skips duplicates (same vendor + invoice number). Three
  // parallel workers keep it quick without hammering the model.
  interface DumpItem { name: string; status: "queued" | "parsing" | "done" | "duplicate" | "error"; info: string }
  const [dump, setDump] = useState<DumpItem[]>([]);
  const dumpInvoices = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy("dump");
    setMsg("");
    const results: DumpItem[] = files.map((f) => ({ name: f.name, status: "queued", info: "" }));
    setDump([...results]);
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const idx = next++;
        results[idx].status = "parsing";
        setDump([...results]);
        try {
          const form = new FormData();
          form.append("file", files[idx]);
          form.append("month", "auto");
          if (uploadCompany) form.append("company_id", uploadCompany);
          const res = await authedFetch(`/api/admin/accounting/invoices`, { method: "POST", body: form });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
          if (json.duplicate) {
            results[idx].status = "duplicate";
            results[idx].info = `${json.vendor || ""} #${json.invoice_number || ""} already in ${String(json.month).slice(0, 7)}`;
          } else {
            const inv = json.invoice;
            results[idx].status = "done";
            results[idx].info = `${inv.direction === "income" ? "INCOME · " : ""}${inv.vendor || "unknown vendor"} · ${inv.direction === "income" ? "sales invoice" : CATEGORY_LABELS[inv.category] || inv.category} · ${isk(inv.amount_isk)} → ${String(inv.month).slice(0, 7)}${inv.company?.name ? ` · tagged ${inv.company.name}` : ""}${inv.ai_confidence ? ` (AI: ${inv.ai_confidence})` : ""}`;
          }
        } catch (e) {
          results[idx].status = "error";
          results[idx].info = (e as Error).message;
        }
        setDump([...results]);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setBusy(null);
    await refresh();
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
        paid_by: inv.paid_by,
        direction: inv.direction,
      }),
    }));
  };

  const setReimbursed = (inv: ExpenseInvoice, reimbursed: boolean) => {
    act("reimburse", () => authedFetch(`/api/admin/accounting/invoices`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: inv.id, reimbursed }),
    }), reimbursed ? "Marked reimbursed." : "Reimbursement undone — back on the owed list.");
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

      {/* Financial position */}
      {position ? (
        <Section
          title="Financial position"
          hint="What we hold and what we owe. Defer any debt line to move it out of the net-position total into the Deferred column."
        >
          {/* Holdings */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs text-gray-700 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Bank balance</span>
              <span className="font-semibold text-gray-900 tabular-nums">{isk(position.cash)}</span>
              <button type="button" className={btnXs} onClick={() => editPosition("cash_balance_isk", "Bank balance", position.cash)}>Edit</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Total revenue to date</span>
              <span className="font-semibold text-emerald-700 tabular-nums">{isk(position.revenue)}</span>
            </div>
          </div>

          {/* Debt table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-gray-700 border-collapse">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-200">
                  <th className="text-left font-semibold py-1.5">Liability</th>
                  <th className="text-right font-semibold py-1.5 w-28">Owed now</th>
                  <th className="text-right font-semibold py-1.5 w-28">Deferred</th>
                  <th className="text-right font-semibold py-1.5 w-44">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Internal */}
                <tr>
                  <td colSpan={4} className="pt-4 pb-2">
                    <div className="rounded-md border-l-2 border-emerald-500 bg-gray-50 px-3 py-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-700">Internal</div>
                      <div className="text-[11px] text-gray-400">Founders / staff</div>
                    </div>
                  </td>
                </tr>
                {position.internal.reimb_total_isk > 0 ? (
                  <tr className="border-b border-gray-100 bg-gray-50/50 transition-colors hover:bg-emerald-50/40">
                    <td className="py-1">
                      <span className="font-medium text-gray-800">
                        {position.internal.reimbursements.length
                          ? position.internal.reimbursements.map((r) => r.name).join(", ")
                          : "Out-of-pocket"}
                      </span>
                      <span className="text-gray-400"> · Future Medical Systems</span>
                    </td>
                    <td className="text-right tabular-nums">{position.internal.reimb_deferred ? "—" : isk(position.internal.reimb_total_isk)}</td>
                    <td className="text-right tabular-nums text-gray-400">{position.internal.reimb_deferred ? isk(position.internal.reimb_total_isk) : "—"}</td>
                    <td className="text-right">
                      <button type="button" className={position.internal.reimb_deferred ? btnXsActive : btnXs}
                        onClick={() => toggleDefer("internal_reimb_deferred", !position.internal.reimb_deferred)}>
                        {position.internal.reimb_deferred ? "Activate" : "Defer"}
                      </button>
                    </td>
                  </tr>
                ) : null}
                <tr className="border-b border-gray-100 transition-colors hover:bg-emerald-50/40">
                  <td className="py-1"><span className="font-medium text-gray-800">{position.internal.manual_label}</span></td>
                  <td className="text-right tabular-nums">{position.internal.manual_deferred ? "—" : isk(position.internal.manual_isk)}</td>
                  <td className="text-right tabular-nums text-gray-400">{position.internal.manual_deferred ? isk(position.internal.manual_isk) : "—"}</td>
                  <td className="text-right whitespace-nowrap">
                    <button type="button" className={btnXs} onClick={() => editPosition("internal_debt_thorvaldur_isk", position.internal.manual_label, position.internal.manual_isk)}>Edit</button>{" "}
                    <button type="button" className={position.internal.manual_deferred ? btnXsActive : btnXs}
                      onClick={() => toggleDefer("internal_manual_deferred", !position.internal.manual_deferred)}>
                      {position.internal.manual_deferred ? "Activate" : "Defer"}
                    </button>
                  </td>
                </tr>
                <tr className="border-t-2 border-amber-300 bg-amber-50/70 font-semibold">
                  <td className="py-1.5 text-gray-700 font-semibold">Internal subtotal</td>
                  <td className="text-right tabular-nums text-amber-700 font-semibold">{isk(position.internal.active_isk)}</td>
                  <td className="text-right tabular-nums text-gray-400">{isk(position.internal.deferred_isk)}</td>
                  <td></td>
                </tr>

                {/* External */}
                <tr>
                  <td colSpan={4} className="pt-4 pb-2">
                    <div className="rounded-md border-l-2 border-emerald-500 bg-gray-50 px-3 py-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-700">External · Health-check supplier costs</div>
                      <div className="text-[11px] text-gray-400">Measurements {isk(2000)}/head · blood {isk(9000)} Sameind / {isk(12500)} Heilsugæslan</div>
                    </div>
                  </td>
                </tr>
                {position.external.health_check_lines.length ? (
                  position.external.health_check_lines.map((l, i) => {
                    const sel = l.paid ? "paid" : !l.applicable ? "na" : "unpaid";
                    const showDefer = l.applicable && !l.paid; // only a real unpaid debt can be deferred
                    return (
                      <tr key={`${l.company_id}:${l.category}`} className={`align-top border-b border-gray-100 transition-colors hover:bg-emerald-50/40 ${i % 2 ? "bg-gray-50/50" : ""}`}>
                        <td className="py-1">
                          <span className="font-medium text-gray-800">{l.company_name}</span>
                          <span className="text-gray-500"> · {l.label}</span>
                          <span className="text-gray-400"> · {l.head_count}×{isk(l.rate_isk)}{l.provider ? ` ${l.provider}` : ""}</span>
                          <button
                            type="button" className="ml-1 text-gray-300 hover:text-emerald-700"
                            title="Override the head count for this company (empty = roster headcount)"
                            onClick={() => {
                              const v = prompt(`${l.company_name} — ${l.label}: number of people (empty = roster headcount):`, String(l.head_count));
                              if (v === null) return;
                              const t = v.replace(/[^\d]/g, "");
                              saveCostItem(l.company_id, l.category, { head_count: t === "" ? null : parseInt(t, 10) });
                            }}
                          >✎</button>
                        </td>
                        <td className="text-right tabular-nums">
                          {l.paid ? <span className="text-emerald-600">paid</span>
                            : !l.applicable ? <span className="text-gray-300">n/a</span>
                            : l.deferred ? "—" : isk(l.unpaid_isk)}
                        </td>
                        <td className="text-right tabular-nums text-gray-400">
                          {showDefer && l.deferred ? isk(l.unpaid_isk) : "—"}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <select
                            className={selXs}
                            value={sel}
                            onChange={(e) => {
                              const v = e.target.value;
                              const status = v === "paid" ? "covered" : v === "na" ? "not_applicable" : "outstanding";
                              saveCostItem(l.company_id, l.category, { status });
                            }}
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                            <option value="na">N/A</option>
                          </select>{" "}
                          {showDefer ? (
                            <button type="button" className={l.deferred ? btnXsActive : btnXs}
                              onClick={() => saveCostItem(l.company_id, l.category, { deferred: !l.deferred })}>
                              {l.deferred ? "Activate" : "Defer"}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={4} className="py-1 text-gray-400">No companies set up for health-check costs yet</td></tr>
                )}
                {/* Biody */}
                <tr className={`border-b border-gray-100 transition-colors hover:bg-emerald-50/40 ${position.external.health_check_lines.length % 2 ? "bg-gray-50/50" : ""}`}>
                  <td className="py-1"><span className="font-medium text-gray-800">Biody machines</span></td>
                  <td className="text-right tabular-nums">{position.external.biody_deferred ? "—" : isk(position.external.biody_isk)}</td>
                  <td className="text-right tabular-nums text-gray-400">{position.external.biody_deferred ? isk(position.external.biody_isk) : "—"}</td>
                  <td className="text-right whitespace-nowrap">
                    <button type="button" className={btnXs} onClick={() => editPosition("other_liabilities_isk", "Biody machines liability", position.external.biody_isk)}>Edit</button>{" "}
                    <button type="button" className={position.external.biody_deferred ? btnXsActive : btnXs}
                      onClick={() => toggleDefer("external_biody_deferred", !position.external.biody_deferred)}>
                      {position.external.biody_deferred ? "Activate" : "Defer"}
                    </button>
                  </td>
                </tr>
                <tr className="border-t-2 border-amber-300 bg-amber-50/70 font-semibold">
                  <td className="py-1.5 text-gray-700 font-semibold">External subtotal</td>
                  <td className="text-right tabular-nums text-amber-700 font-semibold">{isk(position.external.active_isk)}</td>
                  <td className="text-right tabular-nums text-gray-400">{isk(position.external.deferred_isk)}</td>
                  <td></td>
                </tr>

                {/* Grand total */}
                <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold text-gray-800">
                  <td className="py-1.5">Total debt</td>
                  <td className="text-right tabular-nums text-amber-700">{isk(position.total_owed_now_isk)}</td>
                  <td className="text-right tabular-nums text-gray-500">{isk(position.total_deferred_isk)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Net position */}
          <div className="mt-3 pt-2 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Net position{" "}
              <span className="text-gray-400">
                (bank − owed now{position.total_deferred_isk > 0 ? `; ${isk(position.total_deferred_isk)} deferred` : ""})
              </span>
            </span>
            <span className={`font-bold ${position.net_position_isk < 0 ? "text-red-600" : "text-emerald-700"}`}>{isk(position.net_position_isk)}</span>
          </div>
        </Section>
      ) : null}

      {/* Business overview (filterable) */}
      {totals ? (
        <Section
          title={`Overview — ${scope === "all" ? "all time" : scope === "year" ? month.slice(0, 4) : month}${scopeCompany ? ` · ${companies.find((c) => c.id === scopeCompany)?.name || "company"}` : ""}`}
          hint="Every króna invoiced/received against costs recorded + accrued outstanding (health checks carry a fixed per-check cost even before the supplier invoice arrives). Company filter drops company-agnostic lines (overheads, B2C, liabilities)."
          action={
            <span className="flex items-center gap-2 flex-wrap">
              <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value as "all" | "year" | "month")}>
                <option value="all">All time</option>
                <option value="year">Year ({month.slice(0, 4)})</option>
                <option value="month">Month ({month})</option>
              </select>
              <select className={inputCls} value={scopeCompany} onChange={(e) => setScopeCompany(e.target.value)}>
                <option value="">All companies</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className={btn} onClick={() => setShowItems((v) => !v)}>
                {showItems ? "Hide items" : "Itemize"}
              </button>
            </span>
          }
        >
          {totals.warnings.map((w, i) => (
            <div key={i} className="text-xs rounded-md px-3 py-2 mb-2 border bg-amber-50 border-amber-200 text-amber-900">{w}</div>
          ))}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3 text-xs text-gray-700">
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Income</div>
              <div className="flex justify-between"><span>PayDay invoices issued</span><span className="font-medium">{isk(totals.income.payday_invoiced_isk)}</span></div>
              <div className="flex justify-between text-gray-500"><span className="pl-3">of which paid</span><span>{isk(totals.income.payday_paid_isk)}</span></div>
              <div className="flex justify-between"><span className="pl-3">of which outstanding</span><span className={`font-medium ${totals.income.payday_outstanding_isk > 0 ? "text-amber-600" : ""}`}>{isk(totals.income.payday_outstanding_isk)}</span></div>
              <div className="flex justify-between"><span>Scanned sales invoices (settled)</span><span className="font-medium">{isk(totals.income.scanned_sales_isk)}</span></div>
              <div className="flex justify-between"><span>B2C card payments ({totals.income.b2c_count})</span><span className="font-medium">{isk(totals.income.b2c_paid_isk)}</span></div>
              {totals.income.adjustments_isk !== 0 ? (
                <div className="flex justify-between"><span>Income adjustments</span><span className="font-medium">{isk(totals.income.adjustments_isk)}</span></div>
              ) : null}
              <div className="flex justify-between pt-1 border-t border-gray-100 font-semibold text-gray-900">
                <span>Total invoiced</span><span>{isk(totals.income.total_invoiced_isk)}</span>
              </div>
              <div className="flex justify-between font-semibold text-emerald-700">
                <span>Total received</span><span>{isk(totals.income.total_received_isk)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Costs</div>
              <div className="flex justify-between"><span>Cost invoices recorded</span><span className="font-medium">{isk(totals.costs.invoices_recorded_isk)}</span></div>
              {totals.costs.unreimbursed_isk > 0 ? (
                <div className="flex justify-between text-amber-600"><span className="pl-3">of which owed to founders (unreimbursed)</span><span>{isk(totals.costs.unreimbursed_isk)}</span></div>
              ) : null}
              {totals.costs.adjustments_isk !== 0 ? (
                <div className="flex justify-between"><span>Expense adjustments</span><span className="font-medium">{isk(totals.costs.adjustments_isk)}</span></div>
              ) : null}
              <div className="flex justify-between"><span>Overheads accrued (subscriptions × months)</span><span className="font-medium">{isk(totals.costs.overheads_accrued_isk)}</span></div>
              <div className="flex justify-between pt-1 border-t border-gray-100 font-semibold text-gray-900">
                <span>Costs recorded</span><span>{isk(totals.costs.recorded_total_isk)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>
                  Per-check costs accrued — {totals.costs.health_checks_done} checks × {isk(totals.costs.per_check_cost_isk)}
                </span>
                <span className="font-medium">{isk(totals.costs.per_check_expected_isk)}</span>
              </div>
              <div className="flex justify-between text-gray-500"><span className="pl-3">already invoiced (blood/measure/doctor)</span><span>−{isk(totals.costs.per_check_recorded_isk)}</span></div>
              <div className="flex justify-between"><span className="pl-3">outstanding, no invoice yet</span><span className={`font-medium ${totals.costs.per_check_outstanding_isk > 0 ? "text-amber-600" : ""}`}>{isk(totals.costs.per_check_outstanding_isk)}</span></div>
              {totals.costs.manual_liabilities_isk > 0 ? (
                <div className="flex justify-between"><span>Known liabilities (Biody etc.)</span><span className="font-medium text-amber-600">{isk(totals.costs.manual_liabilities_isk)}</span></div>
              ) : null}
              <div className="flex justify-between pt-1 border-t border-gray-100 font-semibold text-gray-900">
                <span>Total costs incl. outstanding</span><span>{isk(totals.costs.grand_total_isk)}</span>
              </div>
            </div>
          </div>
          {showItems ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3 mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-600">
              <div className="space-y-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Income items ({totals.items.income.length})</div>
                {totals.items.income.length === 0 ? <div className="text-gray-400">None in this scope.</div> : null}
                {totals.items.income.map((it, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <span>
                      {it.date ? <span className="text-gray-400">{it.date} · </span> : null}
                      {it.label}
                      {it.ref ? <span className="text-gray-400"> · {it.ref}</span> : null}
                      {it.note ? <span className={it.note === "paid" || it.note === "settled" ? " text-emerald-600" : " text-amber-600"}> · {it.note}</span> : null}
                    </span>
                    <span className="font-medium whitespace-nowrap">{isk(it.amount_isk)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Cost items ({totals.items.costs.length})</div>
                {totals.items.costs.length === 0 ? <div className="text-gray-400">None in this scope.</div> : null}
                {totals.items.costs.map((it, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <span>
                      {it.date ? <span className="text-gray-400">{it.date} · </span> : null}
                      {it.label}
                      {it.category ? <span className="text-gray-400"> · {CATEGORY_LABELS[it.category] || it.category}</span> : null}
                      {it.note ? <span className="text-amber-600"> · {it.note}</span> : null}
                    </span>
                    <span className="font-medium whitespace-nowrap">{isk(it.amount_isk)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 flex-wrap mt-3 pt-2 border-t border-gray-200 text-sm">
            <span className="text-gray-600">
              Net realized (received − recorded):{" "}
              <span className={`font-bold ${totals.net.realized_isk < 0 ? "text-red-600" : "text-emerald-700"}`}>{isk(totals.net.realized_isk)}</span>
            </span>
            <span className="text-gray-600">
              Net full picture (invoiced − all costs incl. outstanding):{" "}
              <span className={`font-bold ${totals.net.full_isk < 0 ? "text-red-600" : "text-emerald-700"}`}>{isk(totals.net.full_isk)}</span>
            </span>
          </div>
        </Section>
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
                    {r.company_id ? (
                      <Link href={`/business/${r.company_id}`} className="hover:text-emerald-700 hover:underline">
                        {r.company_name}
                      </Link>
                    ) : r.company_name}
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

      {/* Doctor salaries (founders) */}
      {doctorPool ? (
        <Section
          title="Doctor salaries (founders)"
          hint={`Interview work valued at ${isk(doctorPool.rate_isk)} per case, split between the doctors who perform them (Victor / Mads). Record actual payouts as Doctor-category cost invoices or adjustments so Paid out stays current.`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-gray-400 mb-0.5">Expected pool</div>
              <div className="font-bold text-gray-900">{isk(doctorPool.expected_isk)}</div>
              <div className="text-[11px] text-gray-500">{doctorPool.expected_count} roster members × {isk(doctorPool.rate_isk)}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-0.5">Earned (interviews done)</div>
              <div className="font-bold text-gray-900">{isk(doctorPool.performed_isk)}</div>
              <div className="text-[11px] text-gray-500">{doctorPool.performed_count} completed doctor slots</div>
            </div>
            <div>
              <div className="text-gray-400 mb-0.5">Paid out</div>
              <div className="font-bold text-gray-900">{isk(doctorPool.paid_isk)}</div>
              <div className="text-[11px] text-gray-500">Doctor-category cost invoices</div>
            </div>
            <div>
              <div className="text-gray-400 mb-0.5">Unpaid vs expected</div>
              <div className={`font-bold ${doctorPool.expected_isk - doctorPool.paid_isk > 0 ? "text-amber-600" : "text-gray-900"}`}>
                {isk(doctorPool.expected_isk - doctorPool.paid_isk)}
              </div>
              <div className="text-[11px] text-gray-500">Future liability if all interviews happen</div>
            </div>
          </div>
          {workSplit.length > 0 ? (
            <div className="mt-3 pt-2 border-t border-gray-100 space-y-1 text-xs text-gray-700">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Split by assignment (set via the Staff picker on each company&apos;s measurement/doctor cost lines)
              </div>
              {workSplit.map((w) => (
                <div key={`${w.staff_id}-${w.role}`} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{w.staff_name}</span>
                    <span className="text-gray-400">
                      {" "}· {w.role === "doctor" ? "doctor interviews" : "measurements"} · {w.client_count} clients × {isk(w.rate_isk)}
                    </span>
                  </span>
                  <span className="font-medium">{isk(w.amount_isk)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 pt-2 border-t border-gray-100 text-[11px] text-gray-400">
              No staff assigned yet — expand a company under Companies and pick the staff member on its Measurements / Doctor interviews cost lines to split the pool between Victor and Mads.
            </div>
          )}
        </Section>
      ) : null}

      {/* Reimbursements owed */}
      {reimbursements.length > 0 ? (
        <Section
          title="Owed to founders / staff"
          hint="Cost invoices paid out-of-pocket (set the Paid-by field on an invoice). Subtracted from investing capacity on the Plan tab. Mark each invoice reimbursed when the company pays the person back."
        >
          <div className="space-y-1.5 text-xs text-gray-700">
            {reimbursements.map((r) => (
              <div key={r.staff_id} className="flex items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{r.staff_name}</span>
                  <span className="text-gray-400"> · {r.invoice_count} invoice{r.invoice_count > 1 ? "s" : ""} paid personally</span>
                </span>
                <span className="font-semibold text-amber-600">{isk(r.total_isk)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-gray-100 font-semibold text-gray-900">
              <span>Total owed</span>
              <span>{isk(reimbursements.reduce((s, r) => s + r.total_isk, 0))}</span>
            </div>
          </div>
        </Section>
      ) : null}

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
          {report && report.income.other_invoiced.count > 0 ? (
            <div className="flex items-center justify-between gap-2">
              <span>
                Scanned sales invoices ({report.income.other_invoiced.count})
                <span className="text-gray-400"> · {report.income.other_invoiced.lines.map((l) => l.customer).filter(Boolean).join(", ")}</span>
              </span>
              <span className="font-medium">{isk(report.income.other_invoiced.total_isk)}</span>
            </div>
          ) : null}
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
          <label className={`${btnPrimary} cursor-pointer`}>
            {busy === "dump" ? "Sorting…" : "Dump PDFs (AI sorts)"}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              multiple
              className="hidden"
              disabled={busy !== null}
              onChange={(e) => {
                const fs = Array.from(e.target.files || []);
                e.target.value = "";
                dumpInvoices(fs);
              }}
            />
          </label>
          </span>
        }
      >
        <div className="space-y-2 text-xs text-gray-700">
          {dump.length > 0 ? (
            <div className="border border-gray-200 rounded-md bg-gray-50/70 p-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Dump — {dump.filter((d) => d.status === "done").length} filed,{" "}
                  {dump.filter((d) => d.status === "duplicate").length} duplicates,{" "}
                  {dump.filter((d) => d.status === "error").length} errors,{" "}
                  {dump.filter((d) => d.status === "queued" || d.status === "parsing").length} remaining
                </span>
                {busy !== "dump" ? (
                  <button className="text-gray-400 hover:text-gray-600" onClick={() => setDump([])}>clear</button>
                ) : null}
              </div>
              {dump.map((d, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <span className="truncate text-gray-600" title={d.name}>{d.name}</span>
                  <span className={`whitespace-nowrap text-right ${
                    d.status === "done" ? "text-emerald-700"
                    : d.status === "duplicate" ? "text-amber-600"
                    : d.status === "error" ? "text-red-600"
                    : "text-gray-400"
                  }`}>
                    {d.status === "queued" ? "queued" : d.status === "parsing" ? "parsing…" : d.info || d.status}
                  </span>
                </div>
              ))}
              <div className="text-[10px] text-gray-400 pt-0.5">
                Invoices are filed under their own invoice-date month — switch the month picker to review them.
              </div>
            </div>
          ) : null}
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
                <select className={inputCls} value={editingInvoice.paid_by || ""}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, paid_by: e.target.value || null })}>
                  <option value="">Paid from company funds</option>
                  {staffList.map((s) => <option key={s.id} value={s.id}>Paid by {s.name || s.email} (owed back)</option>)}
                </select>
                <select className={inputCls} value={editingInvoice.direction}
                  onChange={(e) => setEditingInvoice({ ...editingInvoice, direction: e.target.value as "cost" | "income" })}>
                  <option value="cost">Cost (we pay)</option>
                  <option value="income">Income (our sales invoice)</option>
                </select>
                <div className="flex items-center gap-2 col-span-2 sm:col-span-2 justify-end">
                  <button className={btn} onClick={() => setEditingInvoice(null)}>Cancel</button>
                  <button className={btnPrimary} onClick={saveInvoice}>Save</button>
                </div>
              </div>
            ) : (
              <div key={inv.id} className="flex items-center justify-between gap-2 border-b border-gray-50 pb-1.5">
                <span>
                  {inv.direction === "income" ? (
                    <span className="inline-flex items-center mr-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                      INCOME
                    </span>
                  ) : null}
                  <span className="font-medium">{inv.vendor || "Unknown vendor"}</span>
                  <span className="text-gray-400">
                    {" "}· {CATEGORY_LABELS[inv.category] || inv.category}
                    {inv.company?.name ? ` · ${inv.company.name}` : ""}
                    {inv.client_count != null ? ` · ${inv.client_count} clients` : ""}
                    {inv.invoice_number ? ` · #${inv.invoice_number}` : ""}
                    {inv.ai_confidence ? ` · AI: ${inv.ai_confidence}` : ""}
                  </span>
                  {inv.description ? <span className="block text-gray-500">{inv.description}</span> : null}
                  {inv.paid_by ? (
                    <span className={`inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                      inv.reimbursed_at
                        ? "bg-gray-50 border-gray-200 text-gray-500"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}>
                      Paid by {inv.payer?.name || "staff"} — {inv.reimbursed_at ? "reimbursed" : "owed back"}
                      <button
                        className="underline underline-offset-2 hover:opacity-70"
                        onClick={() => setReimbursed(inv, !inv.reimbursed_at)}
                      >
                        {inv.reimbursed_at ? "undo" : "mark reimbursed"}
                      </button>
                    </span>
                  ) : null}
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

      {/* Founders' salaries */}
      <Section
        title="Founders' salaries"
        hint="Total monthly company cost for the two founders (gross + employer on-costs: pension, tryggingagjald, vacation). Editable per month; a month left unset counts as 0. Flows into the month's expenses and the Plan tab's burn / runway."
      >
        <FounderSalaries
          authedFetch={authedFetch}
          initialYear={Number(month.slice(0, 4))}
          currentMonthKey={month}
          onChanged={refresh}
        />
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
