// Accounting module — shared computation for the admin Accounting tab,
// the CSV export, and the monthly report email to the accounting firm.
//
// Tables: supabase/migration-accounting.sql. The monthly P&L is DERIVED
// from operational data on demand (nothing is double-entered):
//
//   income   = company_invoices issued in month (B2B, invoiced basis)
//            + payments succeeded in month with provider != 'payday'
//              (B2C; payday payment rows mirror company_invoices and
//              would double-count)
//   COGS     = completed station_slots × measurement rate
//            + completed doctor_slots × doctor-interview rate
//   expenses = uploaded cost invoices + overheads (USD × month FX) +
//              manual adjustments

import { supabaseAdmin } from "@/lib/supabase-admin";

export const ACCOUNTANT_EMAIL =
  process.env.ACCOUNTING_FIRM_EMAIL || "jfk@mmedia.is";

export const EXPENSE_CATEGORIES = [
  "blood_tests",
  "measurements",
  "doctor",
  "saas",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  blood_tests: "Blood tests",
  measurements: "Measurements",
  doctor: "Doctor",
  saas: "SaaS / systems",
  other: "Other",
};

// ── Month helpers ────────────────────────────────────────────────────

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026-05" → { monthDate: "2026-05-01", startISO, endISO (exclusive) } */
export function monthBounds(month: string) {
  if (!MONTH_RE.test(month)) throw new Error(`bad month: ${month}`);
  const [y, m] = month.split("-").map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    month,
    monthDate: `${month}-01`,
    nextMonthDate: `${nextY}-${pad(nextM)}-01`,
    startISO: `${month}-01T00:00:00Z`,
    endISO: `${nextY}-${pad(nextM)}-01T00:00:00Z`,
  };
}

/** Previous calendar month as "YYYY-MM" (for the cron). */
export function previousMonth(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based; current month - 1 in 1-based terms
  const prevY = m === 0 ? y - 1 : y;
  const prevM = m === 0 ? 12 : m;
  return `${prevY}-${String(prevM).padStart(2, "0")}`;
}

const IS_MONTHS = [
  "janúar", "febrúar", "mars", "apríl", "maí", "júní",
  "júlí", "ágúst", "september", "október", "nóvember", "desember",
];
export function icelandicMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${IS_MONTHS[m - 1]} ${y}`;
}

// ── FX ───────────────────────────────────────────────────────────────

export interface FxRate {
  month: string;
  usd_isk: number;
  source: string;
  fetched_at: string;
}

/**
 * USD→ISK rate for the month. Stored once per month; auto-fetched from
 * open.er-api.com on first use (current rate — fine for SaaS overheads),
 * manually overridable via POST /api/admin/accounting/fx.
 */
export async function getFxRate(month: string): Promise<FxRate | null> {
  const { monthDate } = monthBounds(month);
  const { data: existing } = await supabaseAdmin
    .from("accounting_fx_rates")
    .select("month, usd_isk, source, fetched_at")
    .eq("month", monthDate)
    .maybeSingle();
  if (existing) return existing as FxRate;

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json();
    const rate = Number(json?.rates?.ISK);
    if (!res.ok || !Number.isFinite(rate) || rate <= 0) return null;
    const row = {
      month: monthDate,
      usd_isk: Math.round(rate * 10_000) / 10_000,
      source: "open.er-api.com",
    };
    await supabaseAdmin.from("accounting_fx_rates").upsert(row, { onConflict: "month" });
    return { ...row, fetched_at: new Date().toISOString() };
  } catch {
    return null;
  }
}

// ── Report types ─────────────────────────────────────────────────────

export interface ReportLine {
  date: string;        // YYYY-MM-DD
  type: "income" | "expense";
  category: string;    // CSV Flokkur column
  description: string;
  reference: string;   // invoice number / payment id / ''
  amount_isk: number;  // always positive; sign applied in CSV by type
}

export interface MonthlyReport {
  month: string;
  generated_at: string;
  fx: FxRate | null;
  income: {
    b2b_invoices: Array<{
      id: string;
      company_name: string;
      invoice_number: string | null;
      status: string;
      issued_at: string | null;
      amount_isk: number;
    }>;
    b2c_payments: { count: number; total_isk: number };
    adjustments: Array<{ id: string; description: string; amount_isk: number }>;
    total_isk: number;
  };
  cogs: {
    measurements: { count: number; pending_count: number; rate_isk: number; total_isk: number };
    doctor_interviews: { count: number; pending_count: number; rate_isk: number; total_isk: number };
    total_isk: number;
  };
  expense_invoices: Array<{
    id: string;
    vendor: string | null;
    description: string | null;
    category: ExpenseCategory;
    amount_isk: number;
    invoice_number: string | null;
    invoice_date: string | null;
    client_count: number | null;
    company_id: string | null;
    company_name: string | null;
  }>;
  overheads: Array<{
    id: string;
    name: string;
    quantity: number;
    amount_usd: number | null;
    amount_isk_unit: number | null;
    total_isk: number; // quantity × unit, USD converted at month FX
    fx_missing: boolean;
  }>;
  expense_adjustments: Array<{ id: string; description: string; amount_isk: number }>;
  totals: {
    income_isk: number;
    expense_invoices_isk: number;
    overheads_isk: number;
    expenses_isk: number;
    net_isk: number;
  };
  warnings: string[];
}

// ── Effective cost rates ─────────────────────────────────────────────

async function effectiveRates(monthEndExclusive: string) {
  const { data } = await supabaseAdmin
    .from("accounting_cost_rates")
    .select("rate_key, amount_isk, effective_from")
    .lt("effective_from", monthEndExclusive)
    .order("effective_from", { ascending: true });
  const out: Record<string, number> = {};
  for (const r of data || []) out[r.rate_key as string] = r.amount_isk as number;
  return out;
}

// ── Report computation ───────────────────────────────────────────────

export async function computeMonthlyReport(month: string): Promise<MonthlyReport> {
  const { monthDate, nextMonthDate, startISO, endISO } = monthBounds(month);
  const warnings: string[] = [];

  const [
    rates,
    invoicesRes,
    paymentsRes,
    measDoneRes,
    measPendingRes,
    docDoneRes,
    docPendingRes,
    expInvRes,
    overheadsRes,
    adjustmentsRes,
  ] = await Promise.all([
    effectiveRates(nextMonthDate),
    // B2B income: invoices issued this month, invoiced basis.
    supabaseAdmin
      .from("company_invoices")
      .select("id, payday_invoice_number, status, amount_total, issued_at, company:companies(name)")
      .neq("status", "cancelled")
      .gte("issued_at", startISO)
      .lt("issued_at", endISO),
    // B2C income: succeeded card payments; payday rows are mirrors of
    // company_invoices (see /api/admin/companies/[companyId]/invoice).
    supabaseAdmin
      .from("payments")
      .select("amount_isk", { count: "exact" })
      .eq("status", "succeeded")
      .or("provider.is.null,provider.neq.payday")
      .gte("paid_at", startISO)
      .lt("paid_at", endISO),
    // Measurements performed = station slots marked completed in month.
    supabaseAdmin
      .from("station_slots")
      .select("id", { count: "exact", head: true })
      .gte("completed_at", startISO)
      .lt("completed_at", endISO),
    // Drift hint: booked slots in month never marked completed.
    supabaseAdmin
      .from("station_slots")
      .select("id", { count: "exact", head: true })
      .is("completed_at", null)
      .not("client_id", "is", null)
      .gte("slot_at", startISO)
      .lt("slot_at", endISO),
    supabaseAdmin
      .from("doctor_slots")
      .select("id", { count: "exact", head: true })
      .gte("completed_at", startISO)
      .lt("completed_at", endISO),
    supabaseAdmin
      .from("doctor_slots")
      .select("id", { count: "exact", head: true })
      .is("completed_at", null)
      .not("client_id", "is", null)
      .gte("slot_at", startISO)
      .lt("slot_at", endISO),
    supabaseAdmin
      .from("accounting_expense_invoices")
      .select("id, vendor, description, category, amount_isk, invoice_number, invoice_date, client_count, company_id, company:companies(name)")
      .eq("month", monthDate)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("accounting_overheads")
      .select("id, name, amount_isk, amount_usd, quantity, active, effective_from, effective_to")
      .eq("active", true)
      .lt("effective_from", nextMonthDate)
      .or(`effective_to.is.null,effective_to.gte.${monthDate}`),
    supabaseAdmin
      .from("accounting_adjustments")
      .select("id, kind, description, amount_isk")
      .eq("month", monthDate)
      .order("created_at", { ascending: true }),
  ]);

  for (const [label, res] of [
    ["invoices", invoicesRes], ["payments", paymentsRes],
    ["expense invoices", expInvRes], ["overheads", overheadsRes],
    ["adjustments", adjustmentsRes],
  ] as const) {
    if (res.error) warnings.push(`${label} query failed: ${res.error.message}`);
  }

  // Overheads need FX only when a USD item exists for the month.
  const overheadRows = overheadsRes.data || [];
  const needsFx = overheadRows.some((o) => o.amount_usd != null);
  const fx = needsFx ? await getFxRate(month) : await (async () => {
    const { data } = await supabaseAdmin
      .from("accounting_fx_rates")
      .select("month, usd_isk, source, fetched_at")
      .eq("month", monthDate)
      .maybeSingle();
    return (data as FxRate) || null;
  })();
  if (needsFx && !fx) {
    warnings.push("USD/ISK rate unavailable — USD overheads excluded from totals. Set it manually under FX.");
  }

  const b2bInvoices = (invoicesRes.data || []).map((inv) => ({
    id: inv.id as string,
    company_name:
      ((inv.company as unknown as { name?: string } | null)?.name) || "Unknown company",
    invoice_number: (inv.payday_invoice_number as string | null) ?? null,
    status: inv.status as string,
    issued_at: (inv.issued_at as string | null) ?? null,
    amount_isk: (inv.amount_total as number) || 0,
  }));
  const b2bTotal = b2bInvoices.reduce((s, i) => s + i.amount_isk, 0);

  const b2cCount = paymentsRes.count ?? (paymentsRes.data?.length || 0);
  const b2cTotal = (paymentsRes.data || []).reduce(
    (s, p) => s + ((p.amount_isk as number) || 0), 0);

  const adjustments = adjustmentsRes.data || [];
  const incomeAdjustments = adjustments
    .filter((a) => a.kind === "income")
    .map((a) => ({ id: a.id as string, description: a.description as string, amount_isk: a.amount_isk as number }));
  const expenseAdjustments = adjustments
    .filter((a) => a.kind === "expense")
    .map((a) => ({ id: a.id as string, description: a.description as string, amount_isk: a.amount_isk as number }));
  const incomeAdjTotal = incomeAdjustments.reduce((s, a) => s + a.amount_isk, 0);
  const expenseAdjTotal = expenseAdjustments.reduce((s, a) => s + a.amount_isk, 0);

  const measurementRate = rates["measurement"] ?? 0;
  const doctorRate = rates["doctor_interview"] ?? 0;
  if (!measurementRate || !doctorRate) {
    warnings.push("Cost rate missing for measurement or doctor_interview — run migration-accounting.sql seed or add a rate.");
  }
  const measCount = measDoneRes.count ?? 0;
  const docCount = docDoneRes.count ?? 0;
  const cogs = {
    measurements: {
      count: measCount,
      pending_count: measPendingRes.count ?? 0,
      rate_isk: measurementRate,
      total_isk: measCount * measurementRate,
    },
    doctor_interviews: {
      count: docCount,
      pending_count: docPendingRes.count ?? 0,
      rate_isk: doctorRate,
      total_isk: docCount * doctorRate,
    },
    total_isk: measCount * measurementRate + docCount * doctorRate,
  };

  const expenseInvoices = (expInvRes.data || []).map((r) => ({
    id: r.id as string,
    vendor: (r.vendor as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    category: (r.category as ExpenseCategory) || "other",
    amount_isk: (r.amount_isk as number) || 0,
    invoice_number: (r.invoice_number as string | null) ?? null,
    invoice_date: (r.invoice_date as string | null) ?? null,
    client_count: (r.client_count as number | null) ?? null,
    company_id: (r.company_id as string | null) ?? null,
    company_name: ((r.company as unknown as { name?: string } | null)?.name) || null,
  }));
  const expenseInvoicesTotal = expenseInvoices.reduce((s, i) => s + i.amount_isk, 0);

  const overheads = overheadRows.map((o) => {
    const qty = (o.quantity as number) || 1;
    const usd = o.amount_usd as number | null;
    const iskUnit = o.amount_isk as number | null;
    const fxMissing = usd != null && !fx;
    const totalIsk = usd != null
      ? (fx ? Math.round(usd * qty * fx.usd_isk) : 0)
      : (iskUnit || 0) * qty;
    return {
      id: o.id as string,
      name: o.name as string,
      quantity: qty,
      amount_usd: usd,
      amount_isk_unit: iskUnit,
      total_isk: totalIsk,
      fx_missing: fxMissing,
    };
  });
  const overheadsTotal = overheads.reduce((s, o) => s + o.total_isk, 0);

  const incomeTotal = b2bTotal + b2cTotal + incomeAdjTotal;
  const expensesTotal = cogs.total_isk + expenseInvoicesTotal + overheadsTotal + expenseAdjTotal;

  return {
    month,
    generated_at: new Date().toISOString(),
    fx,
    income: {
      b2b_invoices: b2bInvoices,
      b2c_payments: { count: b2cCount, total_isk: b2cTotal },
      adjustments: incomeAdjustments,
      total_isk: incomeTotal,
    },
    cogs,
    expense_invoices: expenseInvoices,
    overheads,
    expense_adjustments: expenseAdjustments,
    totals: {
      income_isk: incomeTotal,
      expense_invoices_isk: expenseInvoicesTotal,
      overheads_isk: overheadsTotal,
      expenses_isk: expensesTotal,
      net_isk: incomeTotal - expensesTotal,
    },
    warnings,
  };
}

// ── CSV export (DK-importable flat ledger) ───────────────────────────

function csvCell(v: string | number): string {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * One flat ledger: every income/expense line of the month. Semicolon-
 * separated (Icelandic Excel/DK convention), UTF-8 BOM, integer ISK
 * amounts — income positive, expenses negative.
 */
export function reportToCsv(report: MonthlyReport): string {
  const { monthDate } = monthBounds(report.month);
  const lastDay = monthEndDate(report.month);
  const lines: ReportLine[] = [];

  for (const inv of report.income.b2b_invoices) {
    lines.push({
      date: inv.issued_at?.slice(0, 10) || monthDate,
      type: "income",
      category: "B2B reikningar",
      description: `${inv.company_name} (${inv.status})`,
      reference: inv.invoice_number || "",
      amount_isk: inv.amount_isk,
    });
  }
  if (report.income.b2c_payments.count > 0) {
    lines.push({
      date: lastDay,
      type: "income",
      category: "B2C greiðslur",
      description: `Kortagreiðslur (${report.income.b2c_payments.count} færslur)`,
      reference: "",
      amount_isk: report.income.b2c_payments.total_isk,
    });
  }
  for (const a of report.income.adjustments) {
    lines.push({ date: lastDay, type: "income", category: "Leiðrétting", description: a.description, reference: "", amount_isk: a.amount_isk });
  }

  const { measurements: me, doctor_interviews: di } = report.cogs;
  if (me.count > 0) {
    lines.push({ date: lastDay, type: "expense", category: "Mælingar", description: `${me.count} mælingar × ${me.rate_isk} kr.`, reference: "", amount_isk: me.total_isk });
  }
  if (di.count > 0) {
    lines.push({ date: lastDay, type: "expense", category: "Læknisviðtöl", description: `${di.count} viðtöl × ${di.rate_isk} kr.`, reference: "", amount_isk: di.total_isk });
  }
  for (const inv of report.expense_invoices) {
    lines.push({
      date: inv.invoice_date || lastDay,
      type: "expense",
      category: CATEGORY_LABELS[inv.category],
      description: [inv.vendor, inv.description, inv.company_name ? `(${inv.company_name})` : null]
        .filter(Boolean).join(" — ") || "Cost invoice",
      reference: inv.invoice_number || "",
      amount_isk: inv.amount_isk,
    });
  }
  for (const o of report.overheads) {
    lines.push({
      date: lastDay,
      type: "expense",
      category: "Fastur kostnaður",
      description: o.amount_usd != null
        ? `${o.name} (${o.quantity} × $${o.amount_usd}${report.fx ? ` @ ${report.fx.usd_isk}` : ""})`
        : `${o.name}${o.quantity > 1 ? ` (${o.quantity}×)` : ""}`,
      reference: "",
      amount_isk: o.total_isk,
    });
  }
  for (const a of report.expense_adjustments) {
    lines.push({ date: lastDay, type: "expense", category: "Leiðrétting", description: a.description, reference: "", amount_isk: a.amount_isk });
  }

  const header = ["Dagsetning", "Tegund", "Flokkur", "Lýsing", "Tilvísun", "Upphæð ISK"];
  const rows = lines.map((l) => [
    l.date,
    l.type === "income" ? "Tekjur" : "Gjöld",
    l.category,
    l.description,
    l.reference,
    l.type === "income" ? l.amount_isk : -l.amount_isk,
  ].map(csvCell).join(";"));
  // BOM so Excel opens UTF-8 + Icelandic characters correctly.
  return "\uFEFF" + [header.join(";"), ...rows].join("\r\n") + "\r\n";
}

export function monthEndDate(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

// ── Per-company overview (all-time) ─────────────────────────────────
//
// Ties income to attributed costs per company so margin and
// receivables are visible at a glance:
//   invoiced    = company_invoices (status != cancelled)
//   paid        = those with status 'paid'
//   outstanding = invoiced − paid (drafts + sent, i.e. receivables)
//   costs       = expense invoices + expense adjustments tagged with
//                 the company (untagged costs roll up as "Unassigned")

export interface CompanyOverviewRow {
  company_id: string | null; // null = Unassigned costs bucket
  company_name: string;
  invoice_count: number;
  invoiced_isk: number;
  paid_isk: number;
  outstanding_isk: number;
  costs_isk: number;
  net_isk: number; // invoiced − costs
}

export async function computeCompanyOverview(): Promise<{
  rows: CompanyOverviewRow[];
  companies: Array<{ id: string; name: string }>;
}> {
  const [companiesRes, invoicesRes, expRes, adjRes] = await Promise.all([
    supabaseAdmin.from("companies").select("id, name").order("name"),
    supabaseAdmin
      .from("company_invoices")
      .select("company_id, status, amount_total")
      .neq("status", "cancelled"),
    supabaseAdmin
      .from("accounting_expense_invoices")
      .select("company_id, amount_isk"),
    supabaseAdmin
      .from("accounting_adjustments")
      .select("company_id, amount_isk")
      .eq("kind", "expense"),
  ]);

  const companies = (companiesRes.data || []) as Array<{ id: string; name: string }>;
  const byId = new Map<string | null, CompanyOverviewRow>();
  const rowFor = (id: string | null): CompanyOverviewRow => {
    let row = byId.get(id);
    if (!row) {
      row = {
        company_id: id,
        company_name: id ? (companies.find((c) => c.id === id)?.name || "Deleted company") : "Unassigned",
        invoice_count: 0, invoiced_isk: 0, paid_isk: 0, outstanding_isk: 0,
        costs_isk: 0, net_isk: 0,
      };
      byId.set(id, row);
    }
    return row;
  };

  for (const inv of invoicesRes.data || []) {
    const row = rowFor((inv.company_id as string | null) ?? null);
    const amount = (inv.amount_total as number) || 0;
    row.invoice_count += 1;
    row.invoiced_isk += amount;
    if (inv.status === "paid") row.paid_isk += amount;
  }
  for (const e of expRes.data || []) {
    rowFor((e.company_id as string | null) ?? null).costs_isk += (e.amount_isk as number) || 0;
  }
  for (const a of adjRes.data || []) {
    rowFor((a.company_id as string | null) ?? null).costs_isk += (a.amount_isk as number) || 0;
  }

  const rows = Array.from(byId.values()).map((r) => ({
    ...r,
    outstanding_isk: r.invoiced_isk - r.paid_isk,
    net_isk: r.invoiced_isk - r.costs_isk,
  }));
  // Biggest relationships first; the Unassigned bucket last.
  rows.sort((a, b) => (a.company_id === null ? 1 : b.company_id === null ? -1 : b.invoiced_isk - a.invoiced_isk));
  return { rows, companies };
}

// ── Report email (Icelandic, to the accounting firm) ────────────────

const fmt = (n: number) => Math.round(n).toLocaleString("is-IS") + " kr.";

export function reportEmailBodyHtml(report: MonthlyReport): string {
  const t = report.totals;
  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#334155;${bold ? "font-weight:700;" : ""}">${label}</td><td style="padding:6px 0;text-align:right;color:#0F172A;${bold ? "font-weight:700;" : ""}">${value}</td></tr>`;
  return `
    <p style="margin:0 0 16px;">Meðfylgjandi er tekju- og gjaldayfirlit Lifeline Health ehf. fyrir ${icelandicMonthLabel(report.month)} (CSV-skrá í viðhengi, semíkommu-aðgreind).</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${row("Tekjur — B2B reikningar", fmt(report.income.b2b_invoices.reduce((s, i) => s + i.amount_isk, 0)))}
      ${row(`Tekjur — B2C greiðslur (${report.income.b2c_payments.count})`, fmt(report.income.b2c_payments.total_isk))}
      ${row("Tekjur alls", fmt(t.income_isk), true)}
      ${row(`Mælingar (${report.cogs.measurements.count} × ${report.cogs.measurements.rate_isk} kr.)`, "−" + fmt(report.cogs.measurements.total_isk))}
      ${row(`Læknisviðtöl (${report.cogs.doctor_interviews.count} × ${report.cogs.doctor_interviews.rate_isk} kr.)`, "−" + fmt(report.cogs.doctor_interviews.total_isk))}
      ${row("Kostnaðarreikningar", "−" + fmt(t.expense_invoices_isk))}
      ${row("Fastur kostnaður (kerfi/áskriftir)", "−" + fmt(t.overheads_isk))}
      ${row("Gjöld alls", "−" + fmt(t.expenses_isk), true)}
      ${row("Afkoma mánaðar", (t.net_isk < 0 ? "−" : "") + fmt(Math.abs(t.net_isk)), true)}
    </table>
    <p style="margin:16px 0 0;color:#64748B;font-size:12px;">Sjálfvirkt yfirlit úr stjórnkerfi Lifeline Health. Spurningar: mads@lifelinehealth.is.</p>`;
}
