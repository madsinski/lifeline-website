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
import { assessmentUnitPriceIsk, FOLLOWUP_DOCTOR_PRICE_ISK, BLOOD_PROVIDER_RATES } from "@/lib/b2b-pricing";

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
    // Scanned outgoing invoices (direction=income in the dump) — sales
    // made outside PayDay, e.g. pre-platform Vestmannaeyjar invoices.
    other_invoiced: {
      count: number;
      total_isk: number;
      lines: Array<{ id: string; customer: string | null; invoice_number: string | null; invoice_date: string | null; amount_isk: number }>;
    };
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
      .select("id, direction, vendor, description, category, amount_isk, invoice_number, invoice_date, client_count, company_id, company:companies(name)")
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

  const allScanned = expInvRes.data || [];
  const incomeInvoiceRows = allScanned.filter((r) => r.direction === "income");
  const otherInvoiced = {
    count: incomeInvoiceRows.length,
    total_isk: incomeInvoiceRows.reduce((s, r) => s + ((r.amount_isk as number) || 0), 0),
    lines: incomeInvoiceRows.map((r) => ({
      id: r.id as string,
      customer: (r.vendor as string | null) ?? null,
      invoice_number: (r.invoice_number as string | null) ?? null,
      invoice_date: (r.invoice_date as string | null) ?? null,
      amount_isk: (r.amount_isk as number) || 0,
    })),
  };

  const expenseInvoices = allScanned.filter((r) => r.direction !== "income").map((r) => ({
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

  const incomeTotal = b2bTotal + b2cTotal + otherInvoiced.total_isk + incomeAdjTotal;
  const expensesTotal = cogs.total_isk + expenseInvoicesTotal + overheadsTotal + expenseAdjTotal;

  return {
    month,
    generated_at: new Date().toISOString(),
    fx,
    income: {
      b2b_invoices: b2bInvoices,
      b2c_payments: { count: b2cCount, total_isk: b2cTotal },
      other_invoiced: otherInvoiced,
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
  for (const inv of report.income.other_invoiced.lines) {
    lines.push({
      date: inv.invoice_date || lastDay,
      type: "income",
      category: "Seldir reikningar (skannað)",
      description: inv.customer || "Customer invoice",
      reference: inv.invoice_number || "",
      amount_isk: inv.amount_isk,
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
  // Projections from the roster: what this company SHOULD bring in and
  // cost once everyone is assessed. Income = members × negotiated unit
  // price (companies.assessment_unit_price, falling back to the tier
  // price for the headcount); cost = members × (blood test +
  // measurement + doctor interview rates).
  member_count: number;
  expected_income_isk: number;
  expected_cost_isk: number;
  expected_net_isk: number;
  // Distinct company_documents kinds on file (tos/dpa/purchase_order/
  // other) — drives the Documents readiness counter on company cards.
  doc_kinds: string[];
}

// The founders'/doctors' pay for interview work, valued at the
// doctor-interview cost rate. Performed = completed doctor_slots;
// paid = doctor-category cost invoices recorded in accounting.
export interface DoctorPool {
  rate_isk: number;
  expected_count: number;   // total roster members across companies
  expected_isk: number;
  performed_count: number;  // doctor_slots marked completed (all-time)
  performed_isk: number;
  paid_isk: number;         // doctor-category expense invoices (all-time)
}

// Per-staff work split derived from company_work_assignments: clients
// covered (explicit count, or the company's roster when null) × rate.
export interface WorkSplitRow {
  staff_id: string;
  staff_name: string;
  role: "doctor" | "measurer";
  client_count: number;
  rate_isk: number;
  amount_isk: number;
}

// Out-of-pocket invoices (paid_by set, not yet reimbursed) grouped per
// person — money the company owes founders/staff.
export interface ReimbursementRow {
  staff_id: string;
  staff_name: string;
  invoice_count: number;
  total_isk: number;
}

export async function computeCompanyOverview(): Promise<{
  rows: CompanyOverviewRow[];
  companies: Array<{ id: string; name: string }>;
  staff: Array<{ id: string; name: string | null; email: string; role: string }>;
  doctor_pool: DoctorPool;
  work_split: WorkSplitRow[];
  reimbursements: ReimbursementRow[];
}> {
  const today = new Date().toISOString().slice(0, 10);
  const [companiesRes, membersRes, invoicesRes, expRes, adjRes, ratesRes, docDoneRes, docPaidRes, assignRes, owedRes, staffRes, companyDocsRes, incomeQtyRes] = await Promise.all([
    supabaseAdmin.from("companies").select("id, name, assessment_unit_price, followup_doctor_price, parent_company_id").order("name"),
    supabaseAdmin.from("company_members").select("company_id"),
    supabaseAdmin
      .from("company_invoices")
      .select("company_id, status, amount_total")
      .neq("status", "cancelled"),
    supabaseAdmin
      .from("accounting_expense_invoices")
      .select("company_id, amount_isk, category, direction"),
    supabaseAdmin
      .from("accounting_adjustments")
      .select("company_id, amount_isk")
      .eq("kind", "expense"),
    supabaseAdmin
      .from("accounting_cost_rates")
      .select("rate_key, amount_isk, effective_from")
      .lte("effective_from", today)
      .order("effective_from", { ascending: true }),
    supabaseAdmin
      .from("doctor_slots")
      .select("id", { count: "exact", head: true })
      .not("completed_at", "is", null),
    supabaseAdmin
      .from("accounting_expense_invoices")
      .select("amount_isk")
      .eq("category", "doctor")
      .eq("direction", "cost"),
    supabaseAdmin
      .from("company_cost_item_status")
      .select("company_id, category, staff_id, provider, unit_price_isk, staff:staff_id(name, email)"),
    supabaseAdmin
      .from("accounting_expense_invoices")
      .select("paid_by, amount_isk, payer:staff!paid_by(name, email)")
      .not("paid_by", "is", null)
      .is("reimbursed_at", null),
    supabaseAdmin
      .from("staff")
      .select("id, name, email, role")
      .eq("active", true)
      .order("name"),
    supabaseAdmin
      .from("company_documents")
      .select("company_id, kind"),
    supabaseAdmin
      .from("company_income_item_qty")
      .select("company_id, item, qty"),
  ]);

  const companies = (companiesRes.data || []) as Array<{ id: string; name: string; assessment_unit_price?: number | null; followup_doctor_price?: number | null; parent_company_id?: string | null }>;
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const rates: Record<string, number> = {};
  for (const r of ratesRes.data || []) rates[r.rate_key as string] = r.amount_isk as number;

  // Per-company cost-item settings (provider, manual unit-price
  // override) — divisions inherit the mother company's settings.
  const itemMap = new Map<string, { provider: string | null; unit_price_isk: number | null }>();
  for (const a of assignRes.data || []) {
    itemMap.set(`${a.company_id}:${a.category}`, {
      provider: (a.provider as string | null) ?? null,
      unit_price_isk: (a.unit_price_isk as number | null) ?? null,
    });
  }
  const itemFor = (companyId: string, category: string) => {
    const own = itemMap.get(`${companyId}:${category}`);
    if (own) return own;
    const parentId = companyById.get(companyId)?.parent_company_id;
    return parentId ? itemMap.get(`${parentId}:${category}`) : undefined;
  };
  // Effective per-client cost for a company: manual override > provider
  // rate (blood tests: Sameind 9.000 / Heilsugæslan 12.500) > global rate.
  const perClientCostFor = (companyId: string): number => {
    const blood = itemFor(companyId, "blood_tests");
    const bloodRate = blood?.unit_price_isk
      ?? (blood?.provider ? BLOOD_PROVIDER_RATES[blood.provider] ?? rates["blood_test"] : rates["blood_test"])
      ?? 0;
    const measRate = itemFor(companyId, "measurements")?.unit_price_isk ?? rates["measurement"] ?? 0;
    const docRate = itemFor(companyId, "doctor")?.unit_price_isk ?? rates["doctor_interview"] ?? 0;
    return (bloodRate || 0) + measRate + docRate;
  };

  const memberCounts = new Map<string, number>();
  for (const m of membersRes.data || []) {
    const id = m.company_id as string;
    memberCounts.set(id, (memberCounts.get(id) || 0) + 1);
  }
  const byId = new Map<string | null, CompanyOverviewRow>();
  const rowFor = (id: string | null): CompanyOverviewRow => {
    let row = byId.get(id);
    if (!row) {
      row = {
        company_id: id,
        company_name: id ? (companies.find((c) => c.id === id)?.name || "Deleted company") : "Unassigned",
        invoice_count: 0, invoiced_isk: 0, paid_isk: 0, outstanding_isk: 0,
        costs_isk: 0, net_isk: 0,
        member_count: 0, expected_income_isk: 0, expected_cost_isk: 0, expected_net_isk: 0,
        doc_kinds: [],
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
    const row = rowFor((e.company_id as string | null) ?? null);
    const amount = (e.amount_isk as number) || 0;
    if (e.direction === "income") {
      // Scanned outgoing invoice (pre-PayDay sale) — counts as invoiced
      // AND paid: these are historical, settled invoices.
      row.invoice_count += 1;
      row.invoiced_isk += amount;
      row.paid_isk += amount;
    } else {
      row.costs_isk += amount;
    }
  }
  for (const a of adjRes.data || []) {
    rowFor((a.company_id as string | null) ?? null).costs_isk += (a.amount_isk as number) || 0;
  }

  for (const d of companyDocsRes.data || []) {
    const row = rowFor((d.company_id as string | null) ?? null);
    const kind = d.kind as string;
    if (!row.doc_kinds.includes(kind)) row.doc_kinds.push(kind);
  }

  // Projections for every company with a roster, whether or not money
  // has moved yet. Divisions inherit the MOTHER company's negotiated
  // prices (deals are made at the parent level), and the tier fallback
  // uses the whole group's headcount — a 14-person division of a
  // 146-person group gets the group's tier, not the small-team price.
  const groupHeadcount = (companyId: string): number => {
    const own = memberCounts.get(companyId) || 0;
    const c = companyById.get(companyId);
    const rootId = c?.parent_company_id || companyId;
    let total = memberCounts.get(rootId) || 0;
    for (const x of companies) {
      if (x.parent_company_id === rootId) total += memberCounts.get(x.id) || 0;
    }
    return Math.max(total, own, 1);
  };
  let totalMembers = 0;
  for (const c of companies) {
    const members = memberCounts.get(c.id) || 0;
    if (members === 0 && !byId.has(c.id)) continue;
    const row = rowFor(c.id);
    row.member_count = members;
    totalMembers += members;
    const parent = c.parent_company_id ? companyById.get(c.parent_company_id) : null;
    // One-time income per member: health check + 3-month follow-up.
    // (App subscription is monthly and shown separately on the card.)
    const unitPrice = c.assessment_unit_price
      ?? parent?.assessment_unit_price
      ?? assessmentUnitPriceIsk(groupHeadcount(c.id), 1);
    const followupPrice = c.followup_doctor_price
      ?? parent?.followup_doctor_price
      ?? FOLLOWUP_DOCTOR_PRICE_ISK;
    row.expected_income_isk = members * (unitPrice + followupPrice);
    row.expected_cost_isk = members * perClientCostFor(c.id);
    row.expected_net_isk = row.expected_income_isk - row.expected_cost_isk;
  }

  // Manual per-service quantity overrides (set in the Pricing block on
  // the mother company's card) replace the roster-based quantities for
  // the whole group. The override-bearing company's row carries the
  // group's expected income and its divisions are zeroed so the card's
  // aggregate is exact.
  const qtyOverrides = new Map<string, Map<string, number>>();
  for (const q of incomeQtyRes.data || []) {
    const m = qtyOverrides.get(q.company_id as string) || new Map<string, number>();
    m.set(q.item as string, q.qty as number);
    qtyOverrides.set(q.company_id as string, m);
  }
  for (const [companyId, items] of qtyOverrides) {
    const c = companyById.get(companyId);
    if (!c) continue;
    const kids = companies.filter((x) => x.parent_company_id === companyId);
    const groupMembers = (memberCounts.get(companyId) || 0)
      + kids.reduce((s, x) => s + (memberCounts.get(x.id) || 0), 0);
    const parent = c.parent_company_id ? companyById.get(c.parent_company_id) : null;
    const unitPrice = c.assessment_unit_price
      ?? parent?.assessment_unit_price
      ?? assessmentUnitPriceIsk(Math.max(groupMembers, 1), 1);
    const followupPrice = c.followup_doctor_price
      ?? parent?.followup_doctor_price
      ?? FOLLOWUP_DOCTOR_PRICE_ISK;
    const qtyCheck = items.get("health_check") ?? groupMembers;
    const qtyFollow = items.get("followup") ?? groupMembers;
    const row = rowFor(companyId);
    row.expected_income_isk = qtyCheck * unitPrice + qtyFollow * followupPrice;
    row.expected_net_isk = row.expected_income_isk - row.expected_cost_isk;
    for (const kid of kids) {
      const kr = byId.get(kid.id);
      if (kr) {
        kr.expected_income_isk = 0;
        kr.expected_net_isk = -kr.expected_cost_isk;
      }
    }
  }

  const rows = Array.from(byId.values()).map((r) => ({
    ...r,
    outstanding_isk: r.invoiced_isk - r.paid_isk,
    net_isk: r.invoiced_isk - r.costs_isk,
  }));
  // Biggest relationships first; the Unassigned bucket last.
  rows.sort((a, b) => (a.company_id === null ? 1 : b.company_id === null ? -1
    : (b.invoiced_isk - a.invoiced_isk) || (b.expected_income_isk - a.expected_income_isk)));

  const doctorRate = rates["doctor_interview"] || 0;
  const performedCount = docDoneRes.count ?? 0;
  const paidIsk = (docPaidRes.data || []).reduce((s, r) => s + ((r.amount_isk as number) || 0), 0);
  const doctor_pool: DoctorPool = {
    rate_isk: doctorRate,
    expected_count: totalMembers,
    expected_isk: totalMembers * doctorRate,
    performed_count: performedCount,
    performed_isk: performedCount * doctorRate,
    paid_isk: paidIsk,
  };

  // Per-staff split from the cost-item assignees on company cards: the
  // staff member set on a company's measurements/doctor line covers
  // that company's whole group roster (mother company + divisions).
  const groupMembersOf = (companyId: string): number => {
    let total = memberCounts.get(companyId) || 0;
    for (const x of companies) {
      if (x.parent_company_id === companyId) total += memberCounts.get(x.id) || 0;
    }
    return total;
  };
  const splitMap = new Map<string, WorkSplitRow>();
  for (const a of assignRes.data || []) {
    if (!a.staff_id) continue;
    if (a.category === "blood_tests") continue; // provider, not staff
    const role: "doctor" | "measurer" = a.category === "doctor" ? "doctor" : "measurer";
    const staffId = a.staff_id as string;
    const clients = groupMembersOf(a.company_id as string);
    const rate = role === "doctor" ? doctorRate : rates["measurement"] || 0;
    const key = `${staffId}:${role}`;
    const staffName =
      ((a.staff as unknown as { name?: string; email?: string } | null)?.name) ||
      ((a.staff as unknown as { email?: string } | null)?.email) || "Unknown";
    const row = splitMap.get(key) || {
      staff_id: staffId, staff_name: staffName, role,
      client_count: 0, rate_isk: rate, amount_isk: 0,
    };
    row.client_count += clients;
    row.amount_isk = row.client_count * rate;
    splitMap.set(key, row);
  }
  const work_split = Array.from(splitMap.values())
    .sort((a, b) => a.role.localeCompare(b.role) || b.amount_isk - a.amount_isk);

  const reimbMap = new Map<string, ReimbursementRow>();
  for (const r of owedRes.data || []) {
    const staffId = r.paid_by as string;
    const name =
      ((r.payer as unknown as { name?: string; email?: string } | null)?.name) ||
      ((r.payer as unknown as { email?: string } | null)?.email) || "Unknown";
    const row = reimbMap.get(staffId) || { staff_id: staffId, staff_name: name, invoice_count: 0, total_isk: 0 };
    row.invoice_count += 1;
    row.total_isk += (r.amount_isk as number) || 0;
    reimbMap.set(staffId, row);
  }
  const reimbursements = Array.from(reimbMap.values()).sort((a, b) => b.total_isk - a.total_isk);

  return {
    rows,
    companies: companies.map(({ id, name }) => ({ id, name })),
    staff: (staffRes.data || []) as Array<{ id: string; name: string | null; email: string; role: string }>,
    doctor_pool,
    work_split,
    reimbursements,
  };
}

// ── Expected external health-check debt, per company ─────────────────
//
// The external supplier cost of running each company's health checks:
//   measurements — 2.000 ISK / head (body composition)
//   blood tests  — 9.000 (Sameind) / 12.500 (Heilsugæslan) ISK / head,
//                  by the company's chosen provider (or a manual override)
// Doctor interviews are deliberately EXCLUDED — that is founders' own
// labour (the doctor pool / internal debt), not an external supplier bill.
//
// Per company × cost line we know the head count and whether the bill has
// been settled:
//   head count = company_cost_item_status.head_count override, else the
//                group roster headcount (mother company + divisions —
//                employees are listed under the divisions)
//   status     = 'covered' → paid (no debt); 'not_applicable' → the company
//                has no such cost (e.g. BBA Fjeldco has no measurement);
//                anything else → unpaid, counts toward external debt.
// Expected external debt = Σ (unpaid lines: head count × rate).

export interface HealthCheckCostLine {
  company_id: string;
  company_name: string;
  category: "measurements" | "blood_tests";
  label: string;
  provider: string | null;
  head_count: number;
  head_count_overridden: boolean;
  rate_isk: number;
  expected_isk: number;
  status: string;      // raw company_cost_item_status.status
  paid: boolean;       // status === 'covered'
  applicable: boolean; // status !== 'not_applicable'
  unpaid_isk: number;  // applicable && !paid ? expected : 0
}

export interface HealthCheckDebt {
  lines: HealthCheckCostLine[];
  expected_total_isk: number; // all applicable lines
  paid_total_isk: number;
  unpaid_total_isk: number;   // the external health-check debt
  measurement_rate_isk: number;
  blood_rates: Record<string, number>;
}

const HC_COST_LINES: Array<{ category: "measurements" | "blood_tests"; label: string; rateKey: string }> = [
  { category: "measurements", label: "Measurements", rateKey: "measurement" },
  { category: "blood_tests", label: "Blood tests", rateKey: "blood_test" },
];

export async function computeHealthCheckDebt(): Promise<HealthCheckDebt> {
  const today = new Date().toISOString().slice(0, 10);
  const [companiesRes, membersRes, statusRes, ratesRes] = await Promise.all([
    supabaseAdmin.from("companies").select("id, name, parent_company_id").order("name"),
    supabaseAdmin.from("company_members").select("company_id"),
    // select("*") so a not-yet-applied head_count migration can't 500 this.
    supabaseAdmin.from("company_cost_item_status").select("*"),
    supabaseAdmin
      .from("accounting_cost_rates")
      .select("rate_key, amount_isk, effective_from")
      .lte("effective_from", today)
      .order("effective_from", { ascending: true }),
  ]);

  const companies = (companiesRes.data || []) as Array<{ id: string; name: string; parent_company_id?: string | null }>;
  const rates: Record<string, number> = {};
  for (const r of ratesRes.data || []) rates[r.rate_key as string] = r.amount_isk as number;

  const memberCounts = new Map<string, number>();
  for (const m of membersRes.data || []) {
    const id = m.company_id as string;
    memberCounts.set(id, (memberCounts.get(id) || 0) + 1);
  }
  // Group roster headcount: a mother company's own members + all of its
  // divisions' members.
  const groupHeadcount = (companyId: string): number => {
    let total = memberCounts.get(companyId) || 0;
    for (const x of companies) {
      if (x.parent_company_id === companyId) total += memberCounts.get(x.id) || 0;
    }
    return total;
  };

  type StatusRow = { company_id: string; category: string; status?: string | null; provider?: string | null; unit_price_isk?: number | null; head_count?: number | null };
  const statusMap = new Map<string, StatusRow>();
  for (const s of (statusRes.data || []) as StatusRow[]) {
    statusMap.set(`${s.company_id}:${s.category}`, s);
  }

  const lines: HealthCheckCostLine[] = [];
  // Only mother companies carry a health-check cost line — the group
  // headcount already folds the divisions in, so iterating divisions too
  // would double-count.
  const roots = companies.filter((c) => !c.parent_company_id);
  for (const c of roots) {
    for (const item of HC_COST_LINES) {
      const st = statusMap.get(`${c.id}:${item.category}`);
      const status = (st?.status as string) || "auto";
      const applicable = status !== "not_applicable";
      // A company with no roster, no override and no explicit status set is
      // not part of the health-check programme — skip it entirely so the
      // panel isn't flooded with empty companies.
      const headOverride = st?.head_count != null ? Number(st.head_count) : null;
      const head = headOverride ?? groupHeadcount(c.id);
      const hasStatusRow = st != null && status !== "auto";
      if (head <= 0 && !hasStatusRow) continue;

      const provider = (st?.provider as string | null) ?? null;
      const rate = st?.unit_price_isk != null
        ? Number(st.unit_price_isk)
        : item.category === "blood_tests"
          ? (provider ? BLOOD_PROVIDER_RATES[provider] ?? (rates[item.rateKey] || 0) : rates[item.rateKey] || 0)
          : rates[item.rateKey] || 0;
      const expected = applicable ? head * rate : 0;
      const paid = status === "covered";
      const unpaid = applicable && !paid ? expected : 0;
      lines.push({
        company_id: c.id,
        company_name: c.name,
        category: item.category,
        label: item.label,
        provider,
        head_count: head,
        head_count_overridden: headOverride != null,
        rate_isk: rate,
        expected_isk: expected,
        status,
        paid,
        applicable,
        unpaid_isk: unpaid,
      });
    }
  }

  lines.sort((a, b) =>
    (b.unpaid_isk - a.unpaid_isk) ||
    a.company_name.localeCompare(b.company_name) ||
    a.category.localeCompare(b.category));

  const expectedTotal = lines.reduce((s, l) => s + l.expected_isk, 0);
  const unpaidTotal = lines.reduce((s, l) => s + l.unpaid_isk, 0);
  const paidTotal = lines.filter((l) => l.paid).reduce((s, l) => s + l.expected_isk, 0);

  return {
    lines,
    expected_total_isk: expectedTotal,
    paid_total_isk: paidTotal,
    unpaid_total_isk: unpaidTotal,
    measurement_rate_isk: rates["measurement"] || 0,
    blood_rates: BLOOD_PROVIDER_RATES,
  };
}

// ── All-time totals overview ─────────────────────────────────────────
//
// The whole-business picture, not per month: every króna invoiced and
// received, every cost recorded, plus the ACCRUED costs that have no
// invoice yet — health checks performed carry a fixed per-check cost
// (blood test + measurement + doctor interview rates), so checks done
// minus per-check costs already recorded = outstanding cost accrual.

export interface TotalsOverview {
  income: {
    payday_invoiced_isk: number;
    payday_paid_isk: number;
    payday_outstanding_isk: number;
    scanned_sales_isk: number;   // income-direction scanned invoices (settled)
    b2c_paid_isk: number;
    b2c_count: number;
    adjustments_isk: number;
    total_invoiced_isk: number;
    total_received_isk: number;
  };
  costs: {
    invoices_recorded_isk: number;   // all cost invoices
    adjustments_isk: number;         // all expense adjustments
    overheads_accrued_isk: number;   // monthly overheads × months active
    recorded_total_isk: number;
    unreimbursed_isk: number;        // recorded but paid out-of-pocket, owed back
    health_checks_done: number;
    per_check_cost_isk: number;      // current blood + measurement + doctor rates
    per_check_expected_isk: number;  // checks done × per-check cost
    per_check_recorded_isk: number;  // cost invoices in those three categories
    per_check_outstanding_isk: number; // expected − recorded (no invoice yet)
    per_check_breakdown: Array<{      // itemised per component (blood/measurement/doctor)
      key: string;
      label: string;
      rate_isk: number;
      expected_isk: number;
      recorded_isk: number;
      outstanding_isk: number;
    }>;
    manual_liabilities_isk: number;  // settings: Biody machines etc.
    outstanding_total_isk: number;   // per-check outstanding + manual + unreimbursed
    grand_total_isk: number;         // recorded + per-check outstanding + manual
  };
  net: {
    realized_isk: number; // received − recorded
    full_isk: number;     // invoiced − grand total costs
  };
  items: {
    income: OverviewLineItem[];
    costs: OverviewLineItem[];
  };
  warnings: string[];
}

function monthsBetween(fromDate: string, toMonth: string): number {
  const [fy, fm] = fromDate.slice(0, 7).split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  return Math.max((ty - fy) * 12 + (tm - fm) + 1, 0);
}

export interface OverviewFilter {
  fromMonth?: string; // YYYY-MM inclusive
  toMonth?: string;   // YYYY-MM inclusive
  companyId?: string; // limit to one company (drops company-agnostic lines)
}

export interface OverviewLineItem {
  date: string; // YYYY-MM-DD or YYYY-MM
  label: string;
  ref?: string | null;
  category?: string | null;
  amount_isk: number;
  note?: string | null;
}

export async function computeTotalsOverview(filter: OverviewFilter = {}): Promise<TotalsOverview> {
  const warnings: string[] = [];
  const nowMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);
  const fromMonth = filter.fromMonth && MONTH_RE.test(filter.fromMonth) ? filter.fromMonth : null;
  const toMonth = filter.toMonth && MONTH_RE.test(filter.toMonth) ? filter.toMonth : null;
  const companyId = filter.companyId || null;
  const allTime = !fromMonth && !toMonth;
  const startISO = fromMonth ? `${fromMonth}-01T00:00:00Z` : null;
  const endISO = toMonth ? monthBounds(toMonth).endISO : null;
  const fromDate = fromMonth ? `${fromMonth}-01` : null;
  const toDate = toMonth ? `${toMonth}-01` : null;

  let invQ = supabaseAdmin
    .from("company_invoices")
    .select("status, amount_total, issued_at, payday_invoice_number, quantity, company_id, company:companies(name)")
    .neq("status", "cancelled");
  if (startISO) invQ = invQ.gte("issued_at", startISO);
  if (endISO) invQ = invQ.lt("issued_at", endISO);
  if (companyId) invQ = invQ.eq("company_id", companyId);

  let scanQ = supabaseAdmin
    .from("accounting_expense_invoices")
    .select("month, direction, category, vendor, description, amount_isk, invoice_number, paid_by, reimbursed_at, payer:staff!paid_by(name)");
  if (fromDate) scanQ = scanQ.gte("month", fromDate);
  if (toDate) scanQ = scanQ.lte("month", toDate);
  if (companyId) scanQ = scanQ.eq("company_id", companyId);

  let adjQ = supabaseAdmin
    .from("accounting_adjustments")
    .select("month, kind, description, amount_isk");
  if (fromDate) adjQ = adjQ.gte("month", fromDate);
  if (toDate) adjQ = adjQ.lte("month", toDate);
  if (companyId) adjQ = adjQ.eq("company_id", companyId);

  let b2cQ = supabaseAdmin
    .from("payments")
    .select("amount_isk", { count: "exact" })
    .eq("status", "succeeded")
    .or("provider.is.null,provider.neq.payday");
  if (startISO) b2cQ = b2cQ.gte("paid_at", startISO);
  if (endISO) b2cQ = b2cQ.lt("paid_at", endISO);

  let hcB2cQ = supabaseAdmin
    .from("body_comp_bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed")
    .eq("payment_status", "paid")
    .eq("package", "foundational");
  if (startISO) hcB2cQ = hcB2cQ.gte("scheduled_at", startISO);
  if (endISO) hcB2cQ = hcB2cQ.lt("scheduled_at", endISO);

  const [invoicesRes, scannedRes, adjRes, b2cRes, overheadsRes, ratesRes, hcB2cRes, settingsRes] =
    await Promise.all([
      invQ,
      scanQ,
      adjQ,
      companyId ? Promise.resolve({ data: [], count: 0 } as { data: Array<{ amount_isk: number }>; count: number }) : b2cQ,
      supabaseAdmin
        .from("accounting_overheads")
        .select("name, amount_isk, amount_usd, quantity, active, effective_from, effective_to"),
      supabaseAdmin
        .from("accounting_cost_rates")
        .select("rate_key, amount_isk, effective_from")
        .lte("effective_from", today)
        .order("effective_from", { ascending: true }),
      companyId ? Promise.resolve({ count: 0 } as { count: number }) : hcB2cQ,
      supabaseAdmin
        .from("accounting_settings")
        .select("key, value_numeric"),
    ]);

  const settings: Record<string, number> = {};
  for (const r of settingsRes.data || []) settings[r.key as string] = Number(r.value_numeric) || 0;
  // Company-agnostic lines (offsets, overheads, manual liabilities) only
  // belong to the unfiltered all-time view.
  const includeGlobals = !companyId;
  const includeAllTimeOnly = allTime && !companyId;

  const incomeItems: OverviewLineItem[] = [];
  const costItems: OverviewLineItem[] = [];

  // Income — PayDay invoices
  let paydayInvoiced = 0, paydayPaid = 0, invoicedQty = 0;
  for (const inv of invoicesRes.data || []) {
    const a = (inv.amount_total as number) || 0;
    paydayInvoiced += a;
    if (inv.status === "paid") paydayPaid += a;
    invoicedQty += (inv.quantity as number) || 0;
    incomeItems.push({
      date: (inv.issued_at as string | null)?.slice(0, 10) || "",
      label: `Invoice — ${((inv.company as unknown as { name?: string } | null)?.name) || "company"}`,
      ref: (inv.payday_invoice_number as string | null) ?? null,
      amount_isk: a,
      note: inv.status as string,
    });
  }

  // Income — scanned sales + cost rows
  const scanned = scannedRes.data || [];
  let scannedSales = 0;
  for (const r of scanned.filter((x) => x.direction === "income")) {
    const a = (r.amount_isk as number) || 0;
    scannedSales += a;
    incomeItems.push({
      date: String(r.month).slice(0, 7),
      label: `Sales invoice (scanned) — ${r.vendor || "customer"}`,
      ref: (r.invoice_number as string | null) ?? null,
      amount_isk: a,
      note: "settled",
    });
  }
  const incomeAdjRows = (adjRes.data || []).filter((a) => a.kind === "income");
  const incomeAdj = incomeAdjRows.reduce((s, a) => s + ((a.amount_isk as number) || 0), 0);
  for (const a of incomeAdjRows) {
    incomeItems.push({ date: String(a.month).slice(0, 7), label: `Adjustment — ${a.description}`, amount_isk: (a.amount_isk as number) || 0 });
  }
  const b2cPaid = (b2cRes.data || []).reduce((s, p) => s + ((p.amount_isk as number) || 0), 0);
  const b2cCount = b2cRes.count ?? 0;
  if (b2cPaid > 0) {
    incomeItems.push({ date: "", label: `B2C card payments (${b2cCount})`, amount_isk: b2cPaid });
  }
  const totalInvoiced = paydayInvoiced + scannedSales + b2cPaid + incomeAdj;
  const totalReceived = paydayPaid + scannedSales + b2cPaid + incomeAdj;

  // Costs recorded
  const costRows = scanned.filter((r) => r.direction !== "income");
  let costInvoices = 0, unreimbursed = 0;
  for (const r of costRows) {
    const a = (r.amount_isk as number) || 0;
    costInvoices += a;
    const owed = r.paid_by && !r.reimbursed_at;
    if (owed) unreimbursed += a;
    costItems.push({
      date: String(r.month).slice(0, 7),
      label: `${r.vendor || "Invoice"}${r.description ? ` — ${r.description}` : ""}`,
      ref: (r.invoice_number as string | null) ?? null,
      category: (r.category as string) || "other",
      amount_isk: a,
      note: owed ? `paid by ${((r.payer as unknown as { name?: string } | null)?.name) || "staff"} — owed back` : null,
    });
  }
  const expenseAdjRows = (adjRes.data || []).filter((a) => a.kind === "expense");
  const expenseAdj = expenseAdjRows.reduce((s, a) => s + ((a.amount_isk as number) || 0), 0);
  for (const a of expenseAdjRows) {
    costItems.push({ date: String(a.month).slice(0, 7), label: `Adjustment — ${a.description}`, category: "adjustment", amount_isk: (a.amount_isk as number) || 0 });
  }

  // Overheads accrued within the filtered window (company-agnostic).
  let overheadsAccrued = 0;
  if (includeGlobals) {
    let fxRate: number | null = null;
    const needsFx = (overheadsRes.data || []).some((o) => o.amount_usd != null);
    if (needsFx) {
      const fx = await getFxRate(nowMonth);
      fxRate = fx?.usd_isk ?? null;
      if (!fxRate) warnings.push("USD/ISK rate unavailable — USD overheads excluded from the accrual.");
    }
    for (const o of overheadsRes.data || []) {
      if (!o.active && !o.effective_to) continue;
      let start = String(o.effective_from).slice(0, 7);
      let end = o.effective_to ? String(o.effective_to).slice(0, 7) : nowMonth;
      if (end > nowMonth) end = nowMonth;
      if (fromMonth && start < fromMonth) start = fromMonth;
      if (toMonth && end > toMonth) end = toMonth;
      if (start > end) continue;
      const months = monthsBetween(`${start}-01`, end);
      const qty = (o.quantity as number) || 1;
      const unit = o.amount_usd != null
        ? (fxRate ? (o.amount_usd as number) * fxRate : 0)
        : ((o.amount_isk as number) || 0);
      const amount = Math.round(unit * qty * months);
      if (amount === 0) continue;
      overheadsAccrued += amount;
      costItems.push({
        date: `${start}→${end}`,
        label: `${o.name}${qty > 1 ? ` (${qty}×)` : ""} — ${months} month${months > 1 ? "s" : ""}`,
        category: "overhead",
        amount_isk: amount,
      });
    }
  }
  const recordedTotal = costInvoices + expenseAdj + overheadsAccrued;

  // Accrued per-health-check costs (no invoice yet)
  const rates: Record<string, number> = {};
  for (const r of ratesRes.data || []) rates[r.rate_key as string] = r.amount_isk as number;
  const perCheck = (rates["blood_test"] || 0) + (rates["measurement"] || 0) + (rates["doctor_interview"] || 0);
  const checksDone = invoicedQty
    + (hcB2cRes.count ?? 0)
    + (includeAllTimeOnly ? Math.round(settings.healthchecks_offset || 0) : 0);
  const perCheckExpected = checksDone * perCheck;
  // Itemise the per-check accrual by component (blood test / measurement /
  // doctor interview): each carries its own rate and its own already-recorded
  // supplier invoices, so the outstanding is clamped per component (you can't
  // net an over-recorded doctor cost against an under-recorded blood cost —
  // different vendors).
  const PER_CHECK_COMPONENTS: Array<{ key: string; rateKey: string; cat: string; label: string }> = [
    { key: "blood_test", rateKey: "blood_test", cat: "blood_tests", label: "Blood tests" },
    { key: "measurement", rateKey: "measurement", cat: "measurements", label: "Measurements (Biody)" },
    { key: "doctor_interview", rateKey: "doctor_interview", cat: "doctor", label: "Doctor interviews" },
  ];
  const recordedByCat: Record<string, number> = {};
  for (const r of costRows) {
    const c = r.category as string;
    recordedByCat[c] = (recordedByCat[c] || 0) + ((r.amount_isk as number) || 0);
  }
  const perCheckBreakdown = PER_CHECK_COMPONENTS.map((comp) => {
    const rate = rates[comp.rateKey] || 0;
    const expected = checksDone * rate;
    const recorded = recordedByCat[comp.cat] || 0;
    const outstanding = Math.max(expected - recorded, 0);
    return {
      key: comp.key,
      label: comp.label,
      rate_isk: rate,
      expected_isk: expected,
      recorded_isk: recorded,
      outstanding_isk: outstanding,
    };
  });
  const perCheckRecorded = perCheckBreakdown.reduce((s, b) => s + b.recorded_isk, 0);
  const perCheckOutstanding = perCheckBreakdown.reduce((s, b) => s + b.outstanding_isk, 0);
  for (const b of perCheckBreakdown) {
    if (b.outstanding_isk <= 0) continue;
    costItems.push({
      date: "",
      label: `${b.label} not yet invoiced (${checksDone} × ${b.rate_isk}${b.recorded_isk ? ` − ${b.recorded_isk} recorded` : ""})`,
      category: "accrual",
      amount_isk: b.outstanding_isk,
      note: "outstanding",
    });
  }

  const manualLiabilities = includeAllTimeOnly ? Math.round(settings.other_liabilities_isk || 0) : 0;
  if (manualLiabilities > 0) {
    costItems.push({ date: "", label: "Known liabilities (Biody machines etc.)", category: "liability", amount_isk: manualLiabilities, note: "outstanding" });
  }
  const outstandingTotal = perCheckOutstanding + manualLiabilities + unreimbursed;
  const grandTotal = recordedTotal + perCheckOutstanding + manualLiabilities;

  incomeItems.sort((a, b) => a.date.localeCompare(b.date));
  costItems.sort((a, b) => a.date.localeCompare(b.date));

  return {
    income: {
      payday_invoiced_isk: paydayInvoiced,
      payday_paid_isk: paydayPaid,
      payday_outstanding_isk: paydayInvoiced - paydayPaid,
      scanned_sales_isk: scannedSales,
      b2c_paid_isk: b2cPaid,
      b2c_count: b2cCount,
      adjustments_isk: incomeAdj,
      total_invoiced_isk: totalInvoiced,
      total_received_isk: totalReceived,
    },
    costs: {
      invoices_recorded_isk: costInvoices,
      adjustments_isk: expenseAdj,
      overheads_accrued_isk: overheadsAccrued,
      recorded_total_isk: recordedTotal,
      unreimbursed_isk: unreimbursed,
      health_checks_done: checksDone,
      per_check_cost_isk: perCheck,
      per_check_expected_isk: perCheckExpected,
      per_check_recorded_isk: perCheckRecorded,
      per_check_outstanding_isk: perCheckOutstanding,
      per_check_breakdown: perCheckBreakdown,
      manual_liabilities_isk: manualLiabilities,
      outstanding_total_isk: outstandingTotal,
      grand_total_isk: grandTotal,
    },
    net: {
      realized_isk: totalReceived - recordedTotal,
      full_isk: totalInvoiced - grandTotal,
    },
    items: { income: incomeItems, costs: costItems },
    warnings,
  };
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
      ${report.income.other_invoiced.count > 0 ? row(`Tekjur — seldir reikningar, skannað (${report.income.other_invoiced.count})`, fmt(report.income.other_invoiced.total_isk)) : ""}
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
