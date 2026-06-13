"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { assessmentUnitPriceIsk, FOLLOWUP_DOCTOR_PRICE_ISK, BLOOD_PROVIDER_RATES } from "@/lib/b2b-pricing";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import BulkBiodyButton from "./BulkBiodyButton";

interface CompanyRow {
  id: string;
  name: string;
  contact_person_id: string;
  contact_email: string | null;
  contact_full_name: string | null;
  contact_phone: string | null;
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
  assessment_unit_price?: number | null;
  followup_doctor_price?: number | null;
  app_enabled?: boolean | null;
  app_price_isk_monthly?: number | null;
  status?: "draft" | "contact_invited" | "active" | "archived" | null;
  contact_draft_email?: string | null;
  contact_draft_name?: string | null;
  contact_draft_phone?: string | null;
  parent_company_id?: string | null;
  parent_name?: string | null;
  applied_discount_code?: string | null;
  last_round_completed_at?: string | null;
  followup_completed_at?: string | null;
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

// Per-company financial rollup from /api/admin/accounting/companies —
// invoiced/paid/outstanding from PayDay invoices, costs from accounting
// invoices + adjustments tagged with the company.
interface FinRow {
  company_id: string | null;
  invoice_count: number;
  invoiced_isk: number;
  paid_isk: number;
  outstanding_isk: number;
  costs_isk: number;
  net_isk: number;
  member_count: number;
  expected_income_isk: number;
  expected_cost_isk: number;
  expected_net_isk: number;
  doc_kinds: string[];
}

const iskFmt = (n: number) => `${Math.round(n).toLocaleString("is-IS")} kr.`;

interface CompanyInvoiceRow {
  id: string;
  payday_invoice_number: string | null;
  quantity: number | null;
  amount_total: number | null;
  status: string;
  issued_at: string | null;
  pdf_url: string | null;
}

// Itemized EXPECTED income per product for the roster: health checks,
// 3-month follow-up doctor interviews, and the app subscription (when
// enabled). Uses the company's negotiated prices with tier/default
// fallbacks — the same numbers invoices are built from.
interface DiscountCodeOpt { id: string; code: string; kind: "percent" | "fixed"; value: number }

function CompanyIncomeBreakdown({ c, onReload, membersOverride, discountCodes = [], onApplyDiscount, onRemoveDiscount }: {
  c: CompanyRow;
  onReload: () => void;
  membersOverride?: number;
  discountCodes?: DiscountCodeOpt[];
  onApplyDiscount?: (c: CompanyRow, codeId: string) => void;
  onRemoveDiscount?: (c: CompanyRow) => void;
}) {
  const members = membersOverride ?? (c.member_count || 0);
  // Per-service quantity overrides — auto = the group roster count;
  // manual values persist in company_income_item_qty.
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }, []);

  const load = useCallback(async () => {
    const res = await authedFetch(`/api/admin/accounting/income-items?company_id=${c.id}`);
    if (!res.ok) return;
    const json = await res.json();
    const map: Record<string, number> = {};
    for (const it of (json.items || []) as Array<{ item: string; qty: number }>) map[it.item] = it.qty;
    setQty(map);
  }, [authedFetch, c.id]);

  useEffect(() => { queueMicrotask(load); }, [load]);

  const editQty = async (item: string, label: string) => {
    const v = prompt(`${label} — number of employees (empty = auto, full roster ${members}):`,
      qty[item] != null ? String(qty[item]) : "");
    if (v === null) return;
    const trimmed = v.replace(/[^\d]/g, "");
    setBusy(true);
    const res = await authedFetch(`/api/admin/accounting/income-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: c.id, item, qty: trimmed === "" ? null : parseInt(trimmed, 10) }),
    });
    if (!res.ok) alert("Saving quantity failed.");
    await load();
    onReload();
    setBusy(false);
  };

  if (members === 0) return null;
  const checkPrice = c.assessment_unit_price ?? assessmentUnitPriceIsk(members, 1);
  const followupPrice = c.followup_doctor_price ?? FOLLOWUP_DOCTOR_PRICE_ISK;
  const appPrice = c.app_price_isk_monthly ?? 3490;
  const qtyCheck = qty["health_check"] ?? members;
  const qtyFollow = qty["followup"] ?? members;
  const qtyApp = qty["app"] ?? members;
  const qtyBtn = (item: string, label: string, value: number, manual: boolean) => (
    <>
      <b>{value}</b>{manual ? " (manual)" : ""}{" "}
      <button
        type="button"
        className="text-gray-300 hover:text-emerald-700"
        title={`Change the number of employees for ${label} (empty = full roster)`}
        disabled={busy}
        onClick={() => editQty(item, label)}
      >✎</button>
    </>
  );
  const lines = [
    { key: "health_check", label: "Health checks", q: qtyCheck, manual: qty["health_check"] != null, price: checkPrice, suffix: "" },
    { key: "followup", label: "3-month doctor follow-up", q: qtyFollow, manual: qty["followup"] != null, price: followupPrice, suffix: "" },
    ...(c.app_enabled
      ? [{ key: "app", label: "App subscription", q: qtyApp, manual: qty["app"] != null, price: appPrice, suffix: "/mo" }]
      : []),
  ];
  const oneTimeTotal = qtyCheck * checkPrice + qtyFollow * followupPrice;
  return (
    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60">
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <span className="flex items-center gap-2">
          {c.applied_discount_code ? (
            <button
              type="button"
              onClick={() => onRemoveDiscount?.(c)}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100"
              title="Discount applied — prices below are already discounted. Click to remove (resets prices to tier/default)."
            >
              {c.applied_discount_code} applied ×
            </button>
          ) : discountCodes.length > 0 ? (
            <select
              className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-500"
              value=""
              onChange={(e) => { if (e.target.value) onApplyDiscount?.(c, e.target.value); }}
            >
              <option value="">+ discount…</option>
              {discountCodes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} (−{d.kind === "percent" ? `${d.value}%` : iskFmt(d.value)})
                </option>
              ))}
            </select>
          ) : null}
        </span>
        <CommercialSettingsButton company={c} onReload={onReload} />
      </div>
      <div className="space-y-1">
        {lines.map((l) => (
          <div key={l.key} className="flex items-center justify-between gap-2 text-xs text-gray-700">
            <span>
              {l.label} — {qtyBtn(l.key, l.label, l.q, l.manual)} × {iskFmt(l.price)}{l.suffix}
            </span>
            <span className="font-medium">{iskFmt(l.q * l.price)}{l.suffix}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-900 pt-1 border-t border-gray-100">
          <span>Total one-time income{c.app_enabled ? " (app billed monthly on top)" : ""}</span>
          <span>{iskFmt(oneTimeTotal)}</span>
        </div>
        {!c.app_enabled ? (
          <div className="text-[11px] text-gray-400">
            App subscription not enabled — turn it on under „Change pricing“ above.
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Itemized costs tagged to this company, structured around the three
// FIXED per-check items (blood test, measurement, doctor interview):
// each shows expected (roster × rate) vs recorded vs outstanding, and
// takes PDF invoice uploads straight into that category. Other costs
// and manual adjustments below, with inline amount editing.
interface TaggedCost { id: string; month: string; vendor?: string | null; description: string | null; category?: string; amount_isk: number; kind?: string; file_url?: string | null }

const FIXED_COST_ITEMS: Array<{ category: string; label: string; rateKey: string }> = [
  { category: "blood_tests", label: "Blood tests", rateKey: "blood_test" },
  { category: "measurements", label: "Measurements", rateKey: "measurement" },
  { category: "doctor", label: "Doctor interviews", rateKey: "doctor_interview" },
];

const COST_ITEM_STATUSES = [
  { value: "auto", label: "Auto" },
  { value: "outstanding", label: "Outstanding" },
  { value: "invoice_pending", label: "Invoice pending" },
  { value: "covered", label: "Covered" },
  { value: "not_applicable", label: "Not applicable" },
];
const BLOOD_PROVIDERS = Object.keys(BLOOD_PROVIDER_RATES);

interface CostItemState { status: string; provider: string | null; staff_id: string | null; unit_price_isk: number | null }

function CompanyCosts({ companyId, memberCount, onChanged }: { companyId: string; memberCount: number; onChanged?: () => void }) {
  const [invoices, setInvoices] = useState<TaggedCost[] | null>(null);
  const [adjustments, setAdjustments] = useState<TaggedCost[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [itemState, setItemState] = useState<Record<string, CostItemState>>({});
  const [staff, setStaff] = useState<Array<{ id: string; name: string | null; email: string; role: string }>>([]);
  const [form, setForm] = useState({ description: "", amount: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }, []);

  const load = useCallback(async () => {
    const [invRes, adjRes, rateRes, itemRes] = await Promise.all([
      authedFetch(`/api/admin/accounting/invoices?company_id=${companyId}`),
      authedFetch(`/api/admin/accounting/adjustments?company_id=${companyId}`),
      authedFetch(`/api/admin/accounting/rates`),
      authedFetch(`/api/admin/accounting/cost-items?company_id=${companyId}`),
    ]);
    const inv = invRes.ok ? await invRes.json() : { invoices: [] };
    const adj = adjRes.ok ? await adjRes.json() : { adjustments: [] };
    const rts = rateRes.ok ? await rateRes.json() : { rates: [] };
    const items = itemRes.ok ? await itemRes.json() : { items: [], staff: [] };
    setInvoices(((inv.invoices || []) as Array<TaggedCost & { direction?: string }>).filter((r) => r.direction !== "income"));
    setAdjustments((adj.adjustments || []).filter((a: TaggedCost) => a.kind === "expense"));
    // Latest effective rate per key (list is ordered newest-first per key)
    const map: Record<string, number> = {};
    for (const r of (rts.rates || []) as Array<{ rate_key: string; amount_isk: number }>) {
      if (map[r.rate_key] === undefined) map[r.rate_key] = r.amount_isk;
    }
    setRates(map);
    const st: Record<string, CostItemState> = {};
    for (const it of (items.items || []) as Array<{ category: string; status: string; provider: string | null; staff_id: string | null; unit_price_isk: number | null }>) {
      st[it.category] = { status: it.status, provider: it.provider, staff_id: it.staff_id, unit_price_isk: it.unit_price_isk };
    }
    setItemState(st);
    setStaff(items.staff || []);
  }, [authedFetch, companyId]);

  const saveItem = async (category: string, patch: Partial<CostItemState>) => {
    setBusy(true); setMsg("");
    const res = await authedFetch(`/api/admin/accounting/cost-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_id: companyId, category, ...patch }),
    });
    if (!res.ok) setMsg("Saving item state failed.");
    await load();
    onChanged?.();
    setBusy(false);
  };

  useEffect(() => { queueMicrotask(load); }, [load]);

  const editAmount = async (row: TaggedCost) => {
    const v = prompt(`New amount (ISK) for ${row.vendor || row.description || "this cost"}:`, String(row.amount_isk));
    if (v === null) return;
    const amount = parseInt(v.replace(/[^\d]/g, ""), 10);
    if (!Number.isInteger(amount) || amount < 0) { setMsg("Bad amount."); return; }
    setBusy(true);
    const res = await authedFetch(`/api/admin/accounting/invoices`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, amount_isk: amount }),
    });
    if (!res.ok) setMsg("Update failed.");
    await load();
    onChanged?.();
    setBusy(false);
  };

  const addAdjustment = async () => {
    const amount = parseInt(form.amount, 10);
    if (!form.description.trim() || !Number.isInteger(amount) || amount < 0) {
      setMsg("Needs a description and ISK amount."); return;
    }
    setBusy(true);
    const res = await authedFetch(`/api/admin/accounting/adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: new Date().toISOString().slice(0, 7),
        kind: "expense",
        description: form.description.trim(),
        amount_isk: amount,
        company_id: companyId,
      }),
    });
    if (!res.ok) setMsg("Add failed.");
    setForm({ description: "", amount: "" });
    await load();
    onChanged?.();
    setBusy(false);
  };

  const removeAdjustment = async (id: string) => {
    setBusy(true);
    await authedFetch(`/api/admin/accounting/adjustments?id=${id}`, { method: "DELETE" });
    await load();
    onChanged?.();
    setBusy(false);
  };

  // Per-line invoice upload: files straight into the category for this
  // company; the AI extracts amount/date (month=auto).
  const attachInvoice = async (category: string, file: File) => {
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("month", "auto");
      fd.append("category", category);
      fd.append("company_id", companyId);
      const res = await authedFetch(`/api/admin/accounting/invoices`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (json.duplicate) setMsg("Already uploaded (duplicate invoice number).");
    } catch (e) {
      setMsg(`Upload failed: ${(e as Error).message}`);
    }
    await load();
    onChanged?.();
    setBusy(false);
  };

  const total = (invoices || []).reduce((s, r) => s + r.amount_isk, 0)
    + adjustments.reduce((s, r) => s + r.amount_isk, 0);
  const fixedCategories = FIXED_COST_ITEMS.map((f) => f.category);
  const otherInvoices = (invoices || []).filter((r) => !fixedCategories.includes(r.category || ""));

  return (
    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60">
      {invoices === null ? (
        <div className="text-xs text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-1">
          {FIXED_COST_ITEMS.map((item) => {
            const state = itemState[item.category] || { status: "auto", provider: null, staff_id: null, unit_price_isk: null };
            // Rate priority: manual override > provider rate (blood
            // tests: Sameind 9.000 / Heilsugæslan 12.500) > global rate.
            const autoRate = item.category === "blood_tests" && state.provider
              ? BLOOD_PROVIDER_RATES[state.provider] ?? (rates[item.rateKey] || 0)
              : rates[item.rateKey] || 0;
            const rate = state.unit_price_isk ?? autoRate;
            const expected = memberCount * rate;
            const rows = (invoices || []).filter((r) => r.category === item.category);
            const recorded = rows.reduce((s, r) => s + r.amount_isk, 0);
            const outstanding = Math.max(expected - recorded, 0);
            const effective = state.status === "auto"
              ? (outstanding > 0 ? "outstanding" : "covered")
              : state.status;
            const statusTone = effective === "covered" || effective === "not_applicable"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700";
            return (
              <div key={item.category} className="pb-1">
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-gray-800">
                  <span className="font-medium">
                    {item.label}
                    <span className="text-gray-400 font-normal">
                      {" "}· expected {memberCount} × {iskFmt(rate)}{state.unit_price_isk != null ? " (manual)" : ""}{" "}
                      <button
                        type="button"
                        className="text-gray-300 hover:text-emerald-700"
                        title={`Override the unit price for this company (empty = auto ${iskFmt(autoRate)})`}
                        disabled={busy}
                        onClick={() => {
                          const v = prompt(
                            `${item.label} — unit price ISK for this company (empty = auto ${iskFmt(autoRate)}):`,
                            state.unit_price_isk != null ? String(state.unit_price_isk) : "",
                          );
                          if (v === null) return;
                          const trimmed = v.replace(/[^\d]/g, "");
                          saveItem(item.category, { unit_price_isk: trimmed === "" ? null : parseInt(trimmed, 10) });
                        }}
                      >✎</button>
                      {" "}= {iskFmt(expected)}
                      {state.status === "auto" && outstanding > 0 ? ` · ${iskFmt(outstanding)} open` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 whitespace-nowrap flex-wrap">
                    {item.category === "blood_tests" ? (
                      <select
                        className="text-[11px] border border-gray-200 rounded-md px-1.5 py-0.5 bg-white text-gray-600"
                        value={state.provider || ""}
                        disabled={busy}
                        onChange={(e) => saveItem(item.category, { provider: e.target.value || null })}
                      >
                        <option value="">Provider…</option>
                        {BLOOD_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : (
                      <select
                        className="text-[11px] border border-gray-200 rounded-md px-1.5 py-0.5 bg-white text-gray-600"
                        value={state.staff_id || ""}
                        disabled={busy}
                        onChange={(e) => saveItem(item.category, { staff_id: e.target.value || null })}
                        title="Who does the work — drives the salary split in Accounting"
                      >
                        <option value="">Staff…</option>
                        {staff.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
                      </select>
                    )}
                    <select
                      className={`text-[11px] border rounded-md px-1.5 py-0.5 font-medium ${statusTone}`}
                      value={state.status}
                      disabled={busy}
                      onChange={(e) => saveItem(item.category, { status: e.target.value })}
                    >
                      {COST_ITEM_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.value === "auto" ? `Auto (${outstanding > 0 ? "outstanding" : "covered"})` : s.label}
                        </option>
                      ))}
                    </select>
                    <label className="cursor-pointer text-[11px] font-medium px-2 py-0.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">
                      {busy ? "…" : "Attach PDF"}
                      <input
                        type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" disabled={busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) attachInvoice(item.category, f);
                        }}
                      />
                    </label>
                  </span>
                </div>
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-xs text-gray-600 pl-3">
                    <span>
                      {String(r.month).slice(0, 7)} · {r.vendor || "Invoice"}
                      <span className="text-gray-400">{r.description ? ` · ${r.description}` : ""}</span>
                    </span>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span className="font-medium">{iskFmt(r.amount_isk)}</span>
                      {r.file_url ? <a href={r.file_url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">PDF</a> : null}
                      <button className="text-gray-500 hover:text-gray-800" disabled={busy} onClick={() => editAmount(r)}>edit</button>
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
          {otherInvoices.length > 0 ? (
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 pt-1">Other costs</div>
          ) : null}
          {otherInvoices.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-xs text-gray-700">
              <span>
                {String(r.month).slice(0, 7)} · <span className="font-medium">{r.vendor || "Invoice"}</span>
                <span className="text-gray-400">{r.description ? ` · ${r.description}` : ""}</span>
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-medium">{iskFmt(r.amount_isk)}</span>
                {r.file_url ? <a href={r.file_url} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">PDF</a> : null}
                <button className="text-gray-500 hover:text-gray-800" disabled={busy} onClick={() => editAmount(r)}>edit</button>
              </span>
            </div>
          ))}
          {adjustments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 text-xs text-gray-700">
              <span>
                {String(a.month).slice(0, 7)} · Adjustment
                <span className="text-gray-400"> · {a.description}</span>
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-medium">{iskFmt(a.amount_isk)}</span>
                <button className="text-red-500 hover:text-red-700" disabled={busy} onClick={() => removeAdjustment(a.id)}>×</button>
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-900 pt-1 border-t border-gray-100">
            <span>Total recorded costs</span>
            <span>{iskFmt(total)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              placeholder="Manual cost (e.g. nurse, travel)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <input
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white w-28"
              type="number" placeholder="Amount ISK"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            <button
              className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={busy} onClick={addAdjustment}
            >
              Add cost
            </button>
            {msg ? <span className="text-xs text-amber-700">{msg}</span> : null}
          </div>
        </div>
      )}
    </div>
  );
}

// Approval requests from this company (measurement days, doctor days,
// intro lectures) with their status — read-only here; actions live in
// the Approvals tab.
const APPROVAL_STATUS_STYLE: Record<string, string> = {
  requested: "bg-amber-50 border-amber-200 text-amber-700",
  approved: "bg-emerald-50 border-emerald-200 text-emerald-700",
  rejected: "bg-red-50 border-red-200 text-red-600",
};

function CompanyApprovals({ companyIds }: { companyIds: string[] }) {
  const [items, setItems] = useState<Array<{ id: string; label: string; date: string; status: string }> | null>(null);
  const idsKey = companyIds.join(",");

  useEffect(() => {
    const ids = idsKey.split(",").filter(Boolean);
    (async () => {
      const [ev, iv, lec] = await Promise.all([
        supabase.from("body_comp_events").select("id, event_date, approval_status").in("company_id", ids),
        supabase.from("doctor_interview_proposals").select("id, proposed_date, approval_status").in("company_id", ids),
        supabase.from("intro_lectures").select("id, lecture_date, approval_status").in("company_id", ids),
      ]);
      const out: Array<{ id: string; label: string; date: string; status: string }> = [];
      for (const r of ev.data || []) out.push({ id: r.id, label: "Measurement day", date: r.event_date, status: r.approval_status });
      for (const r of iv.data || []) out.push({ id: r.id, label: "Doctor interview day", date: r.proposed_date, status: r.approval_status });
      for (const r of lec.data || []) out.push({ id: r.id, label: "Intro lecture", date: r.lecture_date, status: r.approval_status });
      out.sort((a, b) => a.date.localeCompare(b.date));
      setItems(out);
    })();
  }, [idsKey]);

  if (items !== null && items.length === 0) return null;
  return (
    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-gray-400">Requested days from this company and its divisions.</span>
        <Link href="/admin/business?tab=approvals" className="text-[11px] text-emerald-700 hover:underline">Approvals tab →</Link>
      </div>
      {items === null ? (
        <div className="text-xs text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-1">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2 text-xs text-gray-700">
              <span>{it.label} <span className="text-gray-400">· {new Date(it.date).toLocaleDateString("is-IS")}</span></span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${APPROVAL_STATUS_STYLE[it.status] || APPROVAL_STATUS_STYLE.requested}`}>
                {it.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const INVOICE_STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-50 border-emerald-200 text-emerald-700",
  sent: "bg-amber-50 border-amber-200 text-amber-700",
  draft: "bg-gray-50 border-gray-200 text-gray-500",
  cancelled: "bg-red-50 border-red-200 text-red-600",
};

// Email composer — send reminders, the onboarding presentation, or a
// custom message to the company admin or its employees. Backed by
// /api/admin/companies/[id]/email.
const EMAIL_MILESTONES: Array<{ key: string; label: string }> = [
  { key: "measurement", label: "Body measurement" },
  { key: "blood_test", label: "Blood test" },
  { key: "questionnaire", label: "Health questionnaire" },
  { key: "doctor_review", label: "Doctor interview" },
  { key: "followup", label: "3-month follow-up" },
  { key: "app_access", label: "Lifeline app activation" },
];

function CompanyEmailButton({ companyId, companyName, member }: { companyId: string; companyName: string; member?: { id: string; name: string | null; email: string | null } }) {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<{ admin_email: string | null; employee_count: number; presentations: Array<{ slug: string; title: string }> } | null>(null);
  const [audience, setAudience] = useState<"admin" | "all_employees" | "incomplete" | "member">(member ? "member" : "admin");
  const [type, setType] = useState<"reminder" | "presentation" | "custom">("reminder");
  const [milestone, setMilestone] = useState("measurement");
  const [slug, setSlug] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState<"" | "preview" | "test" | "send">("");
  const [result, setResult] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const authedFetch = async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(path, { ...init, headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  };

  const openModal = async () => {
    setOpen(true); setResult(""); setPreviewHtml(null);
    const res = await authedFetch(`/api/admin/companies/${companyId}/email`);
    if (res.ok) {
      const j = await res.json();
      setMeta(j);
      if (j.presentations?.[0]) setSlug(j.presentations[0].slug);
    }
  };

  const run = async (mode: "preview" | "test" | "send") => {
    setSending(mode); setResult("");
    try {
      const payload: Record<string, unknown> = { audience, type, mode };
      if (member) payload.member_id = member.id;
      if (type === "reminder" || audience === "incomplete") payload.milestone = milestone;
      if (type === "presentation") payload.presentation_slug = slug;
      if (type === "custom") { payload.subject = subject; payload.message = message; }
      const res = await authedFetch(`/api/admin/companies/${companyId}/email`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) { setResult(`Failed: ${j.error || res.status}`); return; }
      if (mode === "preview") { setPreviewHtml(j.preview_html); setResult(""); }
      else if (mode === "test") { setResult(`Test sent to ${j.test_to}.`); }
      else { setResult(`Sent to ${j.sent} recipient${j.sent === 1 ? "" : "s"}${j.failed_count ? ` · ${j.failed_count} failed` : ""}.`); }
    } catch (e) {
      setResult(`Failed: ${(e as Error).message}`);
    } finally {
      setSending("");
    }
  };

  const fieldCls = "w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 bg-white";
  return (
    <>
      {member ? (
        <button
          onClick={openModal}
          disabled={!member.email}
          className="text-gray-400 hover:text-emerald-700 disabled:opacity-30 disabled:hover:text-gray-400"
          title={member.email ? `Email ${member.name || member.email}` : "No email on file"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>
      ) : (
        <button
          onClick={openModal}
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
          title="Email the company admin or employees"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Email
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Email — {member ? (member.name || "employee") : companyName}</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Recipients */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Recipient{member ? "" : "s"}</span>
                {member ? (
                  <div className="mt-1 text-sm text-gray-700">{member.name || "—"} <span className="text-gray-400">{member.email}</span></div>
                ) : (
                  <div className="mt-1 space-y-1 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={audience === "admin"} onChange={() => setAudience("admin")} />
                      Company admin {meta?.admin_email ? <span className="text-gray-400 text-xs">({meta.admin_email})</span> : <span className="text-amber-600 text-xs">(no email on file)</span>}
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={audience === "all_employees"} onChange={() => setAudience("all_employees")} />
                      All employees <span className="text-gray-400 text-xs">({meta?.employee_count ?? 0})</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={audience === "incomplete"} onChange={() => { setAudience("incomplete"); if (type === "presentation") setType("reminder"); }} />
                      Employees missing a milestone
                    </label>
                  </div>
                )}
              </div>
              {/* Type */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Email</span>
                <div className="mt-1 space-y-1 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={type === "reminder"} onChange={() => setType("reminder")} /> Reminder to complete an item
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={type === "presentation"} disabled={audience === "incomplete"} onChange={() => setType("presentation")} /> Onboarding presentation
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={type === "custom"} disabled={audience === "incomplete"} onChange={() => setType("custom")} /> Custom message
                  </label>
                </div>
              </div>
              {(type === "reminder" || audience === "incomplete") && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Milestone</span>
                  <select className={fieldCls} value={milestone} onChange={(e) => setMilestone(e.target.value)}>
                    {EMAIL_MILESTONES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
              )}
              {type === "presentation" && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Presentation</span>
                  {meta?.presentations?.length ? (
                    <select className={fieldCls} value={slug} onChange={(e) => setSlug(e.target.value)}>
                      {meta.presentations.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
                    </select>
                  ) : (
                    <p className="text-xs text-amber-600">No published presentations. Publish one under Admin → Presentations first.</p>
                  )}
                </div>
              )}
              {type === "custom" && (
                <>
                  <input className={fieldCls} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                  <textarea className={`${fieldCls} h-28`} placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
                </>
              )}
              {result ? <div className="text-xs rounded-md px-3 py-2 border bg-emerald-50 border-emerald-200 text-emerald-900">{result}</div> : null}
              {previewHtml ? (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Preview</span>
                  <iframe title="Email preview" srcDoc={previewHtml} className="mt-1 w-full h-[540px] border border-gray-200 rounded-md bg-white" />
                </div>
              ) : null}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <button onClick={() => run("preview")} disabled={sending !== ""} className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {sending === "preview" ? "…" : "Preview"}
                </button>
                <button onClick={() => run("test")} disabled={sending !== ""} className="text-sm font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {sending === "test" ? "…" : "Send test to me"}
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="text-sm font-medium px-3 py-1.5 rounded-md text-gray-600 hover:bg-gray-50">Close</button>
                <button onClick={() => run("send")} disabled={sending !== ""} className="text-sm font-semibold px-4 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                  {sending === "send" ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Lifecycle journey strip — the admin-side mirror of the client view's
// setup steps. Shows where the relationship stands at a glance and the
// single next action; steps are clickable and jump to the section that
// handles them. Ends with the dated 3-month doctor follow-up.
const JOURNEY_TARGETS: Record<string, string | null> = {
  Admin: null, Documents: "legal", Roster: "employees", Scheduling: "approvals",
  Assessments: "employees", "Doctor interview": "employees", Invoiced: "invoices", Paid: "invoices", "3-month follow-up": "employees",
};

// Roster milestone counts feeding the Assessments (step 5) and
// Follow-up (step 8) journey steps — aggregated across the company and
// its divisions.
interface JourneyMilestones { total: number; measurement: number; blood_test: number; questionnaire: number; doctor_review: number; followup: number; }

function CompanyJourney({ invited, claimed, docsReady, members, ms, eventsScheduled, pendingCount, invoicedIsk, outstandingIsk, followupCompletedAt, onStepClick, onFollowupDone }: {
  invited: boolean;
  claimed: boolean;
  docsReady: number;
  members: number;
  ms: JourneyMilestones;
  eventsScheduled: boolean;
  pendingCount: number;
  invoicedIsk: number;
  outstandingIsk: number;
  followupCompletedAt: string | null;
  onStepClick: (sectionKey: string | null) => void;
  onFollowupDone: () => void;
}) {
  // Assessments = the on-the-day data items (measurement + blood test +
  // questionnaire). The doctor interview is its own step, and the
  // 3-month follow-up a separate service step at the end.
  const assessmentsDone = ms.total > 0 && ms.measurement >= ms.total && ms.blood_test >= ms.total && ms.questionnaire >= ms.total;
  const doctorDone = ms.total > 0 && ms.doctor_review >= ms.total;
  const followupAuto = ms.total > 0 && ms.followup >= ms.total;
  const steps: Array<{ label: string; done: boolean; hint: string }> = [
    {
      label: "Admin", done: claimed,
      hint: invited
        ? "Waiting for the company admin to claim the invite — re-invite from the company-admin section if needed"
        : "Invite the company admin (top of card)",
    },
    { label: "Documents", done: docsReady >= 3, hint: `Collect signed documents — ${docsReady}/3 on file (Legal section)` },
    { label: "Roster", done: members > 0, hint: "Add employees to the roster" },
    {
      label: "Scheduling", done: eventsScheduled,
      hint: pendingCount > 0
        ? "Approve the requested days (Approvals section)"
        : "Waiting for measurement/doctor days to be proposed",
    },
    {
      label: "Assessments", done: assessmentsDone,
      hint: ms.total === 0
        ? "Assessments — add the roster first"
        : `Assessments — measured ${ms.measurement}/${ms.total} · blood ${ms.blood_test}/${ms.total} · questionnaire ${ms.questionnaire}/${ms.total} (tick in Employees)`,
    },
    {
      label: "Doctor interview", done: doctorDone,
      hint: ms.total === 0
        ? "Doctor interview — part of the health assessment"
        : `Doctor interview — ${ms.doctor_review}/${ms.total} done (tick in Employees)`,
    },
    { label: "Invoiced", done: invoicedIsk > 0, hint: "Generate the invoice (Invoices section)" },
    { label: "Paid", done: invoicedIsk > 0 && outstandingIsk <= 0, hint: `Awaiting payment — ${Math.round(outstandingIsk).toLocaleString("is-IS")} kr. outstanding` },
    {
      label: "3-month follow-up", done: !!followupCompletedAt || followupAuto,
      hint: ms.total === 0
        ? "3-month follow-up — the separate follow-up service"
        : `3-month follow-up — ${ms.followup}/${ms.total} done (tick in Employees)`,
    },
  ];
  const currentIdx = steps.findIndex((s) => !s.done);
  const allDone = currentIdx === -1;
  const current = allDone ? null : steps[currentIdx];
  return (
    <div className="mt-3">
      <div className="flex items-start">
        {steps.map((s, i) => (
          <div key={s.label} className={`flex items-start ${i < steps.length - 1 ? "flex-1" : ""}`}>
            <button
              type="button"
              onClick={() => onStepClick(JOURNEY_TARGETS[s.label] ?? null)}
              className="flex flex-col items-center gap-1 w-14 shrink-0 group rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"
              title={s.hint}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-transform group-hover:scale-110 ${
                  s.done
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : i === currentIdx
                      ? "bg-amber-100 border-amber-400 text-amber-700"
                      : "bg-white border-gray-300 text-gray-500"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span className={`text-[10px] leading-tight text-center ${
                s.done ? "text-emerald-700" : i === currentIdx ? "text-amber-800 font-semibold" : "text-gray-500"
              }`}>
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && <div className={`h-0.5 rounded-full flex-1 mt-2.5 ${s.done ? "bg-emerald-300" : "bg-gray-100"}`} />}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[11px]">
        {allDone ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-800 font-medium">
            ✓ All steps complete — relationship in management mode.
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onStepClick(JOURNEY_TARGETS[current!.label] ?? null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span className="font-semibold">Next:</span> {current!.hint}
            {current!.label === "3-month follow-up" ? (
              <>
                {" "}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onFollowupDone(); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onFollowupDone(); } }}
                  className="text-emerald-700 hover:underline font-medium cursor-pointer"
                >
                  mark all done
                </span>
              </>
            ) : null}
          </button>
        )}
      </div>
    </div>
  );
}

// Collapsible card section — accordion panel with a summary value in
// the header so the expanded card reads as a one-screen index.
function CardSection({ title, summary, open, onToggle, children }: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-gray-100">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-3 px-5 py-3 text-left transition-colors ${open ? "bg-gray-50/70" : "hover:bg-gray-50/60"}`}
      >
        <span className="flex items-center gap-2">
          <svg className={`w-3 h-3 transition-transform ${open ? "rotate-90 text-emerald-600" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${open ? "text-gray-700" : "text-gray-500"}`}>{title}</span>
        </span>
        <span className="text-[11px] text-gray-500 px-2 py-0.5 rounded-full bg-gray-100 truncate">{summary}</span>
      </button>
      {open ? children : null}
    </div>
  );
}

// A sub-division folded into its mother company's card: compact
// dropdown row with the division's contact person; expanding reveals
// its employee roster. All money/invoices/approvals are handled at the
// parent level.
function DivisionRow({ d, onContactChanged, onMilestoneChanged }: { d: CompanyRow; onContactChanged: () => void; onMilestoneChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const contactName = d.contact_full_name || d.contact_draft_name || null;
  const contactEmail = d.contact_email || d.contact_draft_email || null;
  return (
    <div className="border border-gray-100 rounded-lg bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
      >
        <span className="flex items-center gap-2 min-w-0">
          <svg className={`w-3 h-3 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-sm text-gray-800 truncate">{d.name}</span>
          <span className="text-[11px] text-gray-400 whitespace-nowrap">{d.member_count || 0} staff</span>
        </span>
        <span className="text-[11px] text-gray-500 truncate">
          {contactName || contactEmail
            ? `${contactName || ""}${contactName && contactEmail ? " · " : ""}${contactEmail || ""}`
            : "no contact"}
        </span>
      </button>
      {open ? (
        <EmployeeRows companyId={d.id} companyName={d.name} contactEmail={contactEmail} onContactChanged={onContactChanged} onMilestoneChanged={onMilestoneChanged} />
      ) : null}
    </div>
  );
}

// Contact cell with manual registration: shows the claimed contact (or
// draft) and lets staff type in a contact person directly — name,
// email, phone land in contact_draft_*, and contact_person_id links up
// when a client account with that email exists. Roster members can
// also be promoted via "make admin" in the employee list.
function ContactCell({ c, onSaved }: { c: CompanyRow; onSaved: () => void }) {
  const name = c.contact_full_name || c.contact_draft_name || null;
  const email = c.contact_email || c.contact_draft_email || null;
  const phone = c.contact_phone || c.contact_draft_phone || null;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const save = async () => {
    if (!form.name.trim() && !form.email.trim()) { alert("Need at least a name or an email."); return; }
    setSaving(true);
    try {
      const update: Record<string, unknown> = {
        contact_draft_name: form.name.trim() || null,
        contact_draft_email: form.email.trim() || null,
        contact_draft_phone: form.phone.trim() || null,
      };
      if (form.email.trim()) {
        const { data: client } = await supabase
          .from("clients_decrypted")
          .select("id")
          .eq("email", form.email.trim())
          .maybeSingle();
        if (client?.id) update.contact_person_id = client.id;
      }
      const { error } = await supabase.from("companies").update(update).eq("id", c.id);
      if (error) { alert(`Failed: ${error.message}`); return; }
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = "w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white";
  return (
    <div className="min-w-0 rounded-lg border border-gray-100 bg-gray-50/70 px-2.5 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Company admin</span>
        {!editing ? (
          <button
            type="button"
            onClick={() => { setForm({ name: name || "", email: email || "", phone: phone || "" }); setEditing(true); }}
            className="text-[10px] text-gray-300 hover:text-emerald-700"
            title="Register / edit the company admin manually"
          >
            ✎ edit
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="space-y-1 max-w-[220px]">
          <input className={fieldCls} placeholder="Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={fieldCls} placeholder="Email" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={fieldCls} placeholder="Phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <div className="flex items-center gap-2">
            <button type="button" disabled={saving} onClick={save}
              className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" disabled={saving} onClick={() => setEditing(false)}
              className="text-[11px] text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      ) : !name && !email && !phone ? (
        <span className="text-gray-300 text-[13px]">—</span>
      ) : (
        <>
          {name && <div className="text-[13px] font-medium text-gray-800 truncate" title={name}>{name}</div>}
          {email && <div className={`text-[11px] text-gray-500 truncate ${name ? "mt-0.5" : ""}`} title={email}>{email}</div>}
          {phone && (
            <a href={`tel:${phone}`} className="block text-[11px] text-gray-500 hover:text-emerald-700 truncate mt-0.5" title={phone}>
              {phone}
            </a>
          )}
        </>
      )}
      {/* Invite lives with the contact it's sent to ("Senda boð") */}
      {!editing && (c.status === "draft" || c.status === "contact_invited") ? (
        <div className="mt-1.5">
          <InviteContactButton companyId={c.id} draftEmail={c.contact_draft_email || null} status={c.status} />
        </div>
      ) : null}
    </div>
  );
}

// Recent PayDay invoices, shown inside the expanded company card so the
// whole billing story lives on the company itself.
// The PayDay PDF proxy (/api/admin/invoices/[id]/pdf) requires a
// Bearer token — a plain <a href> sends none and 403s. Fetch with the
// session token and open the blob instead.
async function openAuthedPdf(url: string) {
  if (/^https?:\/\//.test(url)) { window.open(url, "_blank", "noreferrer"); return; }
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(url, {
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  });
  if (!res.ok) { alert(`PDF fetch failed (${res.status})`); return; }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank", "noreferrer");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

function CompanyInvoiceRows({ companyId, companyName, hasChildren }: { companyId: string; companyName: string; hasChildren: boolean }) {
  const [rows, setRows] = useState<CompanyInvoiceRow[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    supabase
      .from("company_invoices")
      .select("id, payday_invoice_number, quantity, amount_total, status, issued_at, pdf_url")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setRows((data as CompanyInvoiceRow[]) || []));
  }, [companyId, reloadKey]);
  if (rows === null) return <div className="px-5 py-2 text-xs text-gray-400 border-t border-gray-100">Loading invoices…</div>;
  return (
    <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/60">
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <span className="text-[11px] text-gray-400">PayDay invoices for this company.</span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="text-[11px] text-gray-400 hover:text-emerald-700"
            title="Refresh the list (e.g. after generating an invoice)"
          >
            refresh
          </button>
          <GenerateInvoiceButton companyId={companyId} companyName={companyName} />
          {hasChildren && <ConsolidatedInvoiceButton companyId={companyId} companyName={companyName} />}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-gray-400">No invoices yet — generate the first one with the button above.</div>
      ) : null}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 text-xs text-gray-700">
            <span className="truncate">
              {r.payday_invoice_number || "no number"}
              <span className="text-gray-400">
                {r.issued_at ? ` · ${new Date(r.issued_at).toLocaleDateString("is-IS")}` : ""}
                {r.quantity ? ` · ${r.quantity} starfsmenn` : ""}
              </span>
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-medium">{iskFmt(r.amount_total || 0)}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${INVOICE_STATUS_STYLE[r.status] || INVOICE_STATUS_STYLE.draft}`}>
                {r.status}
              </span>
              {r.pdf_url ? (
                <button
                  type="button"
                  onClick={() => openAuthedPdf(r.pdf_url!)}
                  className="text-[11px] text-emerald-700 hover:underline"
                >
                  PDF
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Overflow "more actions" menu. A button that toggles a fixed-position
// popover anchored to the button via getBoundingClientRect. Using a
// fixed overlay sidesteps table-cell clipping issues that ate our
// earlier dropdowns.
function OverflowMenu({ children, label }: { children: (close: () => void) => ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.right - 240, width: 240 });
    }
    setOpen((v) => !v);
  };
  const close = () => setOpen(false);
  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={label
          ? "inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          : "p-1.5 rounded-md hover:bg-gray-100 text-gray-500"}
        title="Fleiri aðgerðir"
      >
        {label ? (
          <>
            {label}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="4" cy="10" r="1.75" />
            <circle cx="10" cy="10" r="1.75" />
            <circle cx="16" cy="10" r="1.75" />
          </svg>
        )}
      </button>
      {open && rect && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1"
            style={{ top: rect.top, left: Math.max(8, rect.left), width: rect.width }}
          >
            {children(close)}
          </div>
        </>
      )}
    </>
  );
}

// Button for admin-created draft / contact-invited companies: generates
// a single-use claim token + sends the Icelandic invite email.
// Idempotent — clicking on an already-invited company just re-sends.
function InviteContactButton({ companyId, draftEmail, status }: { companyId: string; draftEmail: string | null; status: "draft" | "contact_invited" }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(draftEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function send() {
    setSubmitting(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/companies/${companyId}/invite-contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(email ? { email } : {}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) { setMsg({ kind: "err", text: j?.detail || j?.error || "Failed" }); return; }
      setMsg({ kind: "ok", text: `Boð sent á ${j.sent_to}. Rennur út ${new Date(j.expires_at).toLocaleDateString("en-GB")}.` });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setMsg(null); }}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {status === "draft" ? "Invite company admin" : "Re-invite company admin"}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md my-16"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">
                {status === "draft" ? "Senda boð á tengilið" : "Senda boð aftur"}
              </h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-gray-600">
                Tengiliðurinn fær íslenskan boðspóst með hlekk til að klára skráninguna og skrifa undir þjónustuskilmála + DPA. Hlekkurinn er einnota og rennur út eftir 14 daga.
              </p>
              <label className="block">
                <span className="block text-xs font-medium text-gray-700 mb-1">Netfang tengiliðs</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@fyrirtæki.is"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </label>
              {msg && (
                <div className={`text-xs rounded-lg px-3 py-2 ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
                  {msg.text}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button onClick={() => setOpen(false)} className="text-xs font-medium text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-md hover:bg-gray-50">
                Loka
              </button>
              <button
                onClick={send}
                disabled={submitting || !email}
                className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "Sendi…" : "Senda boð"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Historic document upload for a company: ToS / DPA / purchase orders
// / other PDFs that were signed offline before the digital flow.
// Opens a modal with the existing list + upload form.
type CompanyDocument = {
  id: string;
  kind: "tos" | "dpa" | "purchase_order" | "other";
  title: string | null;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  signer_name: string | null;
  signed_at: string | null;
  note: string | null;
  uploaded_at: string;
  signed_url: string | null;
};

// Required signed documents for a B2B relationship — drives the
// readiness counter on the Documents button.
const REQUIRED_DOC_KINDS = ["tos", "dpa", "purchase_order"] as const;

function DocumentsButton({ companyId, docKinds = [] }: { companyId: string; docKinds?: string[] }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Upload form state
  const [kind, setKind] = useState<"tos" | "dpa" | "purchase_order" | "other">("tos");
  const [title, setTitle] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/companies/${companyId}/documents`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const j = await res.json();
      if (res.ok && j.ok) { setDocs(j.documents || []); setLoaded(true); }
      else setMsg({ kind: "err", text: j?.detail || j?.error || "Gat ekki sótt skjöl." });
    } finally { setLoading(false); }
  };

  const openModal = async () => { setOpen(true); setMsg(null); await load(); };

  const submitUpload = async () => {
    if (!file) { setMsg({ kind: "err", text: "Veldu PDF-skrá." }); return; }
    setUploading(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      if (title) fd.append("title", title);
      if (signerName) fd.append("signer_name", signerName);
      if (signedAt) fd.append("signed_at", signedAt);
      if (note) fd.append("note", note);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/api/admin/companies/${companyId}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) { setMsg({ kind: "err", text: j?.detail || j?.error || "Upphleðsla mistókst." }); return; }
      setMsg({ kind: "ok", text: "Skjali hlaðið upp." });
      setFile(null); setTitle(""); setSignerName(""); setSignedAt(""); setNote("");
      await load();
    } finally { setUploading(false); }
  };

  const deleteDoc = async (docId: string) => {
    if (!confirm("Eyða þessu skjali?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch(`/api/admin/companies/${companyId}/documents/${docId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j?.ok) { setMsg({ kind: "err", text: j?.detail || j?.error || "Eyðing mistókst." }); return; }
    await load();
  };

  const kindLabels: Record<CompanyDocument["kind"], string> = {
    tos: "Þjónustuskilmálar",
    dpa: "Vinnslusamningur",
    purchase_order: "Þjónustusamningur",
    other: "Annað",
  };
  const kindPill = (k: CompanyDocument["kind"]) => {
    const color = k === "tos" ? "bg-blue-50 text-blue-700 border-blue-100"
      : k === "dpa" ? "bg-violet-50 text-violet-700 border-violet-100"
      : k === "purchase_order" ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-gray-50 text-gray-700 border-gray-200";
    return <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${color}`}>{kindLabels[k]}</span>;
  };
  const prettySize = (n: number | null) => n == null ? "—" : n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;

  // Readiness: required doc kinds on file. After the modal has loaded
  // the live list, prefer it (reflects uploads/deletes immediately);
  // before that, the page-level rollup is the source.
  const presentKinds = loaded ? [...new Set(docs.map((d) => d.kind as string))] : docKinds;
  const readyCount = REQUIRED_DOC_KINDS.filter((k) => presentKinds.includes(k)).length;
  const allReady = readyCount === REQUIRED_DOC_KINDS.length;

  return (
    <>
      <button
        onClick={openModal}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
          allReady
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
        }`}
        title={allReady
          ? "All required documents signed (ToS, DPA, service agreement)"
          : `Missing: ${REQUIRED_DOC_KINDS.filter((k) => !presentKinds.includes(k)).join(", ")}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Documents {readyCount}/{REQUIRED_DOC_KINDS.length}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Skjöl fyrirtækis</h3>
                <p className="text-xs text-gray-500 mt-0.5">Þjónustuskilmálar, vinnslusamningar og verðsamningar sem voru undirritaðir utan kerfisins (t.d. á prentformi).</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Upload form */}
              <section className="rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50/40">
                <div className="text-sm font-semibold text-gray-900">Hlaða upp nýju skjali</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Tegund *</span>
                    <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                      <option value="tos">Þjónustuskilmálar (ToS)</option>
                      <option value="dpa">Vinnslusamningur (DPA)</option>
                      <option value="purchase_order">Þjónustusamningur / verðsamningur</option>
                      <option value="other">Annað</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Heiti (valfrjálst)</span>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                      placeholder="t.d. Þjónustusamningur 2026–2027"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Nafn undirritanda</span>
                    <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Undirritunardagur</span>
                    <input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block text-xs font-medium text-gray-700 mb-1">Athugasemd</span>
                    <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Samningatímabil, sérmál, o.s.frv."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="block text-xs font-medium text-gray-700 mb-1">PDF-skrá *</span>
                    <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="w-full text-sm" />
                    <p className="text-[11px] text-gray-500 mt-1">Hámark 25 MB. Leyfilegt: PDF, PNG, JPEG.</p>
                  </label>
                </div>
                {msg && (
                  <div className={`text-xs ${msg.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</div>
                )}
                <div className="flex justify-end">
                  <button onClick={submitUpload} disabled={uploading || !file}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                    {uploading ? "Hleð upp…" : "Hlaða upp"}
                  </button>
                </div>
              </section>

              {/* Existing docs */}
              <section>
                <div className="text-sm font-semibold text-gray-900 mb-2">Núverandi skjöl</div>
                {loading ? (
                  <div className="text-xs text-gray-500 py-4 text-center">Sæki…</div>
                ) : docs.length === 0 ? (
                  <div className="text-xs text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-lg">Engin skjöl eru skráð enn.</div>
                ) : (
                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
                    {docs.map((d) => (
                      <li key={d.id} className="px-4 py-3 flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">{kindPill(d.kind)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{d.title || d.filename}</div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {d.filename} · {prettySize(d.size_bytes)} · hlaðið upp {new Date(d.uploaded_at).toLocaleDateString("en-GB")}
                          </div>
                          {(d.signer_name || d.signed_at) && (
                            <div className="text-[11px] text-gray-600 mt-0.5">
                              Undirritað {d.signer_name ? `af ${d.signer_name}` : ""}{d.signer_name && d.signed_at ? " · " : ""}{d.signed_at || ""}
                            </div>
                          )}
                          {d.note && <div className="text-[11px] text-gray-500 mt-0.5 whitespace-pre-wrap">{d.note}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {d.signed_url && (
                            <a href={d.signed_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs font-medium text-blue-700 hover:underline">
                              Opna
                            </a>
                          )}
                          <button onClick={() => deleteDoc(d.id)}
                            className="text-xs font-medium text-red-600 hover:underline">
                            Eyða
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Loka</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// One-click consolidated invoice for a parent (municipality-style)
// company. Aggregates all active subs into one PayDay invoice, billed
// to the parent's billing_contact_email.
type ConsolidatedRow = {
  id: string;
  name: string;
  isParent: boolean;
  quantity: number;
  unitPrice: number;
  defaultQty: number; // for display / "reset"
};

function ConsolidatedInvoiceButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<ConsolidatedRow[]>([]);
  const [notes, setNotes] = useState("");
  const [pastInvoices, setPastInvoices] = useState<{ number: string | null; quantity: number; amount_total: number; status: string; issued_at: string }[]>([]);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const openDialog = async () => {
    setOpen(true);
    setLoading(true);
    setNotes("");

    // Parent row
    const { data: parent } = await supabase
      .from("companies")
      .select("id, name, assessment_unit_price")
      .eq("id", companyId)
      .maybeSingle();

    // Sub-divisions (active only)
    const { data: subs } = await supabase
      .from("companies")
      .select("id, name, assessment_unit_price")
      .eq("parent_company_id", companyId)
      .neq("status", "archived")
      .order("name", { ascending: true });

    const parentFallbackPrice = (parent as { assessment_unit_price?: number | null } | null)?.assessment_unit_price || 49900;

    const all = [
      parent ? { ...(parent as { id: string; name: string; assessment_unit_price?: number | null }), isParent: true } : null,
      ...((subs || []) as Array<{ id: string; name: string; assessment_unit_price?: number | null }>).map((s) => ({ ...s, isParent: false })),
    ].filter(Boolean) as Array<{ id: string; name: string; assessment_unit_price?: number | null; isParent: boolean }>;

    // Count employees per company (company_members, falling back to clients)
    const rowsOut: ConsolidatedRow[] = await Promise.all(
      all.map(async (c) => {
        const { count } = await supabase
          .from("company_members")
          .select("id", { count: "exact", head: true })
          .eq("company_id", c.id);
        let qty = count || 0;
        if (qty === 0) {
          const { count: cc } = await supabase
            .from("clients_decrypted")
            .select("id", { count: "exact", head: true })
            .eq("company_id", c.id);
          if ((cc || 0) > 0) qty = cc || 0;
        }
        return {
          id: c.id,
          name: c.name,
          isParent: c.isParent,
          quantity: qty,
          defaultQty: qty,
          unitPrice: c.assessment_unit_price || parentFallbackPrice,
        };
      }),
    );
    setRows(rowsOut);

    // Past consolidated invoices on the parent
    const { data: past } = await supabase
      .from("company_invoices")
      .select("payday_invoice_number, quantity, amount_total, status, issued_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(5);
    setPastInvoices(
      (past || []).map((i: { payday_invoice_number: string | null; quantity: number; amount_total: number; status: string; issued_at: string }) => ({
        number: i.payday_invoice_number,
        quantity: i.quantity,
        amount_total: i.amount_total,
        status: i.status,
        issued_at: i.issued_at,
      })),
    );

    setLoading(false);
  };

  const updateRow = (id: string, patch: Partial<ConsolidatedRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const send = async () => {
    setSending(true);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const active = rows.filter((r) => r.quantity > 0);
    const parentRow = rows.find((r) => r.isParent);
    const res = await fetch(`/api/admin/companies/${companyId}/consolidated-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({
        send_email: true,
        create_claim: true,
        notes: notes.trim() || undefined,
        include_parent: !!parentRow && parentRow.quantity > 0,
        subs: active.map((r) => ({ company_id: r.id, quantity: r.quantity, unit_price: r.unitPrice })),
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSending(false);
    setOpen(false);
    if (!res.ok || !j?.ok) {
      const base = j?.detail || j?.error || "Mistókst.";
      let rawMsg = "";
      if (j?.raw) {
        try {
          const r = typeof j.raw === "string" ? j.raw : JSON.stringify(j.raw);
          rawMsg = r.length > 600 ? r.slice(0, 600) + "…" : r;
        } catch { /* ignore */ }
      }
      setToast({ type: "error", text: rawMsg ? `${base}\n\n${rawMsg}` : base });
    } else {
      setToast({
        type: "success",
        text: `Reikningur ${j.invoice_number || j.invoice_id}\n${(j.amount_total ?? 0).toLocaleString("is-IS")} ISK á ${j.lines?.length || 0} línur.`,
      });
    }
  };

  const total = rows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
  const activeLines = rows.filter((r) => r.quantity > 0).length;

  return (
    <>
      <button
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 transition-colors"
        title="Einn reikningur fyrir móðurfyrirtæki + allar undireiningar"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10M7 11h10M7 15h4M5 5h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
        </svg>
        Invoice all divisions
</button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-[640px] max-w-[calc(100vw-2rem)] my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 truncate">Samheildarreikningur · {companyName}</h3>
              <p className="text-sm text-gray-500 mt-0.5">Einn PayDay-reikningur · VSK-frjáls (heilbrigðisþjónusta) · 14 daga eindagi</p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-400">Hleð…</div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                {/* Past invoices */}
                {pastInvoices.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fyrri reikningar</p>
                    {pastInvoices.map((inv, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-gray-700 truncate">
                          {inv.number ? `#${inv.number}` : "—"} · {inv.quantity} stk · {inv.amount_total.toLocaleString("is-IS")} ISK
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : inv.status === "sent" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {inv.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Per-sub editable rows */}
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="grid grid-cols-[1fr_90px_130px_110px] items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <div>Fyrirtæki / deild</div>
                    <div className="text-right">Fjöldi</div>
                    <div className="text-right">Einingaverð</div>
                    <div className="text-right">Samtals</div>
                  </div>
                  {rows.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">Engar deildir fundust.</div>
                  ) : (
                    rows.map((r) => {
                      const rowTotal = r.quantity * r.unitPrice;
                      return (
                        <div
                          key={r.id}
                          className={`grid grid-cols-[1fr_90px_130px_110px] items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 ${r.quantity === 0 ? "opacity-60" : ""}`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {r.isParent && (
                                <span className="text-[9px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded">Móðurf.</span>
                              )}
                              <span className="text-sm text-gray-900 truncate">{r.name}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">Sjálfgefið: {r.defaultQty}</div>
                          </div>
                          <input
                            type="number"
                            min={0}
                            value={r.quantity}
                            onChange={(e) => updateRow(r.id, { quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:ring-2 focus:ring-emerald-300 outline-none"
                          />
                          <input
                            type="number"
                            min={0}
                            value={r.unitPrice}
                            onChange={(e) => updateRow(r.id, { unitPrice: Math.max(0, parseInt(e.target.value) || 0) })}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right focus:ring-2 focus:ring-emerald-300 outline-none"
                          />
                          <div className="text-sm text-gray-700 text-right font-medium tabular-nums">
                            {rowTotal.toLocaleString("is-IS")}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Note */}
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Athugasemd (valfrjáls)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Birtist á reikningnum"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-300 outline-none box-border"
                  />
                </div>

                {/* Total */}
                <div className="bg-emerald-50 rounded-lg p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600">{activeLines} {activeLines === 1 ? "lína" : "línur"} á reikningi</p>
                    <p className="text-xs text-gray-500">VSK-frjáls · heilbrigðisþjónusta</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 shrink-0">{total.toLocaleString("is-IS")} <span className="text-sm font-medium text-gray-500">ISK</span></p>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Hætta við
              </button>
              <button
                onClick={send}
                disabled={sending || loading || activeLines === 0 || total <= 0}
                className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {sending ? "Sendi…" : "Senda reikning"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result toast */}
      {toast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setToast(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className={`px-6 py-4 border-b border-gray-100 ${toast.type === "success" ? "bg-emerald-50" : "bg-red-50"}`}>
              <h3 className={`text-lg font-semibold ${toast.type === "success" ? "text-emerald-800" : "text-red-800"}`}>
                {toast.type === "success" ? "Reikningur sendur" : "Mistókst"}
              </h3>
            </div>
            <div className="px-6 py-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap break-words font-sans">{toast.text}</pre>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setToast(null)} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                Loka
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GenerateInvoiceButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [employeeCount, setEmployeeCount] = useState(0);
  const [unitPrice, setUnitPrice] = useState(49900);
  const [notes, setNotes] = useState("");
  // Optional extra lines, defaulted from the company's custom prices / signed PO.
  const [includeFollowup, setIncludeFollowup] = useState(false);
  const [followupQty, setFollowupQty] = useState(0);
  const [followupPrice, setFollowupPrice] = useState(12900);
  const [includeApp, setIncludeApp] = useState(false);
  const [appQty, setAppQty] = useState(0);
  const [appPrice, setAppPrice] = useState(3490);
  const [appDesc, setAppDesc] = useState("Aðgangur að Lifeline appi — áskrift");

  // Past invoices
  const [pastInvoices, setPastInvoices] = useState<{ number: string | null; quantity: number; amount_total: number; status: string; issued_at: string }[]>([]);

  const openDialog = async () => {
    setOpen(true);
    setLoading(true);
    setNotes("");
    // Fetch employee count, pricing, the company's custom prices, and past invoices
    const [{ count }, { data: po }, { data: commercial }, { data: invoices }] = await Promise.all([
      supabase.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("b2b_purchase_orders").select("line_items").eq("company_id", companyId).eq("status", "signed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("companies").select("followup_doctor_price, app_price_isk_monthly").eq("id", companyId).maybeSingle(),
      supabase.from("company_invoices").select("payday_invoice_number, quantity, amount_total, status, issued_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(5),
    ]);
    const emp = count || 0;
    setEmployeeCount(emp);
    // Parse the signed PO: line 0 is the assessment, the follow-up line is
    // identified by its description, the app line by its recurring marker.
    const poLines = (po?.line_items && Array.isArray(po.line_items) ? po.line_items : []) as Array<{ description?: string; unit_price_isk?: number; qty?: number; recurring?: string | null }>;
    if (poLines.length > 0) setUnitPrice(poLines[0].unit_price_isk || 49900);
    const followupLine = poLines.find((l) => /eftirfylgni/i.test(l.description || ""));
    // The app line is a one-time prepaid term on the PO (qty = employees,
    // unit price = monthly × months), identified by its description. Older
    // POs may still carry a recurring marker — match either.
    const appLine = poLines.find((l) => /lifeline appi/i.test(l.description || "") || l.recurring === "monthly");
    const custFollowup = (commercial as { followup_doctor_price?: number | null } | null)?.followup_doctor_price;
    const custApp = (commercial as { app_price_isk_monthly?: number | null } | null)?.app_price_isk_monthly;
    // Follow-up: pre-checked when the signed PO included it; price prefers the
    // PO line, then the company custom price, then the flat default.
    setIncludeFollowup(!!followupLine);
    setFollowupQty(followupLine?.qty ?? emp);
    setFollowupPrice(followupLine?.unit_price_isk ?? custFollowup ?? 12900);
    // App: pre-check + prefill from the prepaid PO line (term price already
    // baked into unit price); fall back to the company's monthly price.
    setIncludeApp(!!appLine);
    setAppQty(appLine?.qty ?? emp);
    setAppPrice(appLine?.unit_price_isk ?? custApp ?? 3490);
    setAppDesc(appLine?.description || "Aðgangur að Lifeline appi — áskrift");
    setPastInvoices((invoices || []).map((i: any) => ({ number: i.payday_invoice_number, quantity: i.quantity, amount_total: i.amount_total, status: i.status, issued_at: i.issued_at })));
    setLoading(false);
  };

  const send = async () => {
    setSending(true);
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    const additional_lines: Array<{ description: string; quantity: number; unit_price: number }> = [];
    if (includeFollowup && followupQty > 0) {
      additional_lines.push({ description: "Eftirfylgni læknis — 3 mánaða símtal", quantity: followupQty, unit_price: followupPrice });
    }
    if (includeApp && appQty > 0) {
      additional_lines.push({ description: appDesc, quantity: appQty, unit_price: appPrice });
    }
    const res = await fetch(`/api/admin/companies/${companyId}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ unit_price: unitPrice, quantity: employeeCount, notes: notes.trim() || undefined, additional_lines }),
    });
    const j = await res.json();
    setSending(false);
    setOpen(false);
    if (!res.ok) setToast({ type: "error", text: `Failed: ${j.detail || j.error || "unknown"}\n\nPayDay response:\n${JSON.stringify(j.raw || "none", null, 2)}` });
    else setToast({ type: "success", text: `Invoice created${j.payday_invoice_number ? ` · #${j.payday_invoice_number}` : ""}\n\n${(j.lines || []).map((l: { description: string; quantity: number; unit_price: number }) => `${l.description} · ${l.quantity} × ${l.unit_price.toLocaleString()}`).join("\n")}\nTotal: ${j.amount_total.toLocaleString()} ISK\nVAT exempt (health services) · Eindagi: 14 days` });
  };

  const total = employeeCount * unitPrice
    + (includeFollowup ? followupQty * followupPrice : 0)
    + (includeApp ? appQty * appPrice : 0);

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

                {/* Optional 3-month doctor call line */}
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <input type="checkbox" checked={includeFollowup} onChange={(e) => setIncludeFollowup(e.target.checked)} className="rounded border-gray-300" />
                    3-month doctor call
                  </label>
                  {includeFollowup && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0">
                        <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                        <input type="number" min={0} value={followupQty} onChange={(e) => setFollowupQty(Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 box-border" />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs text-gray-500 mb-1">Unit price (ISK)</label>
                        <input type="number" min={0} value={followupPrice} onChange={(e) => setFollowupPrice(Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 box-border" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional app subscription line (recurring — opt in per invoice) */}
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <input type="checkbox" checked={includeApp} onChange={(e) => setIncludeApp(e.target.checked)} className="rounded border-gray-300" />
                    App subscription <span className="text-xs font-normal text-gray-400">(prepaid term)</span>
                  </label>
                  {includeApp && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <label className="block text-xs text-gray-500 mb-1">Quantity (employees)</label>
                          <input type="number" min={0} value={appQty} onChange={(e) => setAppQty(Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 box-border" />
                        </div>
                        <div className="min-w-0">
                          <label className="block text-xs text-gray-500 mb-1">Unit price (ISK / employee)</label>
                          <input type="number" min={0} value={appPrice} onChange={(e) => setAppPrice(Math.max(0, parseInt(e.target.value) || 0))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 box-border" />
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400">Prefilled from the signed PO when the company prepaid app access. Unit price covers the full term per employee.</p>
                    </>
                  )}
                </div>

                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Note (optional)</label>
                  <input
                    type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Appears on the assessment line item"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-300 outline-none box-border"
                  />
                </div>

                {/* Total */}
                <div className="bg-emerald-50 rounded-lg p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm text-gray-600">Assessment · {employeeCount} × {unitPrice.toLocaleString()} ISK</p>
                    {includeFollowup && <p className="text-sm text-gray-600">Doctor call · {followupQty} × {followupPrice.toLocaleString()} ISK</p>}
                    {includeApp && <p className="text-sm text-gray-600">App · {appQty} × {appPrice.toLocaleString()} ISK</p>}
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
    <button onClick={click} disabled={busy} className="w-full text-left text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
      {busy ? "Creating…" : "Create Biody group"}
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
    <button onClick={click} disabled={busy} className="w-full text-left text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
      {busy ? "Creating…" : "Create all in Biody"}
    </button>
  );
}

function DeleteCompanyButton({ company, onDone }: { company: CompanyRow; onDone: () => void }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <button onClick={() => setShowModal(true)} className="w-full text-left text-xs font-medium px-2.5 py-1.5 rounded-md text-red-600 hover:bg-red-50 transition-colors">
        Delete company
      </button>
      {showModal && (
        <DeleteConfirmModal
          title={`Delete ${company.name}`}
          description={`This will permanently delete the company "${company.name}" and all ${company.member_count} roster entries. Employee Lifeline accounts will be preserved but unlinked from this company.`}
          onCancel={() => setShowModal(false)}
          onConfirm={async () => {
            const { data: s } = await supabase.auth.getSession();
            const t = s.session?.access_token;
            const res = await fetch(`/api/admin/companies/${company.id}`, {
              method: "DELETE",
              headers: t ? { Authorization: `Bearer ${t}` } : {},
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || "Delete failed");
            setShowModal(false);
            onDone();
          }}
        />
      )}
    </>
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

// The five process milestones tracked per employee. order = column order.
const MILESTONE_META: Array<{ key: MilestoneKey; short: string; full: string }> = [
  { key: "measurement", short: "Meas", full: "Body measurement done" },
  { key: "blood_test", short: "Blood", full: "Blood test done" },
  { key: "questionnaire", short: "Quest", full: "Health questionnaire done" },
  { key: "doctor_review", short: "Doctor", full: "Doctor interview (health assessment) done" },
  { key: "followup", short: "3-mo", full: "3-month follow-up done" },
  { key: "app_access", short: "App", full: "App access activated" },
];
type MilestoneKey = "measurement" | "blood_test" | "questionnaire" | "doctor_review" | "followup" | "app_access";
type MilestoneCell = { done: boolean; source: "auto" | "manual" | null; auto: boolean };
type MemberMilestones = Record<string, Record<MilestoneKey, MilestoneCell>>;

// A single tickable milestone circle. Auto-detected completions show a
// lighter ring + "auto" tooltip; admin ticks are solid; both are
// clickable (click sets/clears the admin tick — auto stays done).
function MilestoneCircle({ cell, busy, onToggle }: { cell: MilestoneCell; busy: boolean; onToggle: () => void }) {
  const title = cell.done
    ? cell.source === "auto" ? "Done — detected automatically" : "Done — marked by staff (click to unmark)"
    : "Not done — click to mark done";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      title={title}
      className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        cell.done
          ? cell.source === "auto"
            ? "bg-emerald-100 border-emerald-400 text-emerald-600"
            : "bg-emerald-500 border-emerald-500 text-white"
          : "bg-white border-gray-300 text-transparent hover:border-emerald-400"
      }`}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </button>
  );
}

function EmployeeRows({ companyId, companyName, contactEmail, onContactChanged, onMilestoneChanged }: {
  companyId: string;
  companyName: string;
  contactEmail?: string | null;
  onContactChanged?: () => void;
  onMilestoneChanged?: () => void;
}) {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [milestones, setMilestones] = useState<MemberMilestones>({});
  const [err, setErr] = useState("");
  const [sortByName, setSortByName] = useState(false);
  const [settingContact, setSettingContact] = useState<string | null>(null);

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(path, { ...init, headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }, []);

  const loadMilestones = useCallback(async () => {
    const res = await authedFetch(`/api/admin/companies/${companyId}/milestones`);
    if (!res.ok) return;
    const json = await res.json();
    const map: MemberMilestones = {};
    for (const r of (json.members || []) as Array<Record<string, unknown>>) {
      map[r.member_id as string] = {
        measurement: r.measurement as MilestoneCell,
        blood_test: r.blood_test as MilestoneCell,
        questionnaire: r.questionnaire as MilestoneCell,
        doctor_review: r.doctor_review as MilestoneCell,
        followup: r.followup as MilestoneCell,
        app_access: r.app_access as MilestoneCell,
      };
    }
    setMilestones(map);
  }, [authedFetch, companyId]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("list_company_members", { p_company_id: companyId });
      if (error) setErr(error.message);
      else setMembers((data || []) as MemberRow[]);
    })();
    loadMilestones();
  }, [companyId, loadMilestones]);

  // Optimistic: flip the cell locally now, persist in the background.
  // Untick falls back to the auto signal (a manual tick can't erase an
  // auto-detected completion). Reload only if the write fails.
  const applyCell = (memberId: string, key: MilestoneKey, target: boolean) =>
    setMilestones((prev) => {
      const row = prev[memberId];
      if (!row) return prev;
      const cur = row[key];
      const next: MilestoneCell = target
        ? { done: true, source: "manual", auto: cur.auto }
        : { done: cur.auto, source: cur.auto ? "auto" : null, auto: cur.auto };
      return { ...prev, [memberId]: { ...row, [key]: next } };
    });

  const toggleMilestone = (memberId: string, key: MilestoneKey, currentlyDone: boolean) => {
    const target = !currentlyDone;
    applyCell(memberId, key, target);
    authedFetch(`/api/admin/companies/${companyId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId, milestone: key, done: target }),
    }).then((res) => { if (!res.ok) loadMilestones(); onMilestoneChanged?.(); }).catch(() => loadMilestones());
  };

  // Tick (or untick) an entire column at once. If everyone's already
  // done, the action clears manual ticks; otherwise it marks all done.
  const [bulkBusy, setBulkBusy] = useState<MilestoneKey | null>(null);
  const toggleColumn = async (key: MilestoneKey, ids: string[]) => {
    if (ids.length === 0) return;
    const allDone = ids.every((id) => milestones[id]?.[key]?.done);
    const target = !allDone;
    setBulkBusy(key);
    ids.forEach((id) => applyCell(id, key, target));
    try {
      await authedFetch(`/api/admin/companies/${companyId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: ids, milestone: key, done: target }),
      });
      await loadMilestones();
      onMilestoneChanged?.();
    } finally {
      setBulkBusy(null);
    }
  };

  // Promote a roster member to company contact: copies their details
  // into the contact_draft_* fields, and links contact_person_id when
  // they already have a claimed client account (matched by email).
  const makeContact = async (m: MemberRow) => {
    if (!confirm(`Make ${m.full_name} the company admin for this company?`)) return;
    setSettingContact(m.id);
    try {
      const update: Record<string, unknown> = {
        contact_draft_name: m.full_name,
        contact_draft_email: m.email,
        contact_draft_phone: m.phone || null,
      };
      const { data: client } = await supabase
        .from("clients_decrypted")
        .select("id")
        .eq("email", m.email)
        .maybeSingle();
      if (client?.id) update.contact_person_id = client.id;
      const { error } = await supabase.from("companies").update(update).eq("id", companyId);
      if (error) { alert(`Failed: ${error.message}`); return; }
      onContactChanged?.();
    } finally {
      setSettingContact(null);
    }
  };

  if (err) return <div className="px-4 py-3 text-red-600 text-xs">{err}</div>;
  if (!members) return <div className="px-4 py-3 text-gray-500 text-xs">Loading employees…</div>;
  if (members.length === 0) return <div className="px-4 py-3 text-gray-500 text-xs italic">No employees on roster.</div>;

  // Original ordering = whatever the roster RPC returns; the name sort
  // is a non-destructive view on top of it.
  const shown = sortByName
    ? [...members].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "is"))
    : members;

  // Folded-in roster progress (this replaces the old standalone roster
  // card) + per-milestone completion counts for the column headers.
  const total = members.length;
  const onboarded = members.filter((m) => m.completed_at).length;
  const milestoneCount = (key: MilestoneKey) => members.filter((m) => milestones[m.id]?.[key]?.done).length;

  const GRID = "grid grid-cols-[minmax(140px,1.6fr)_repeat(6,2.25rem)_5.5rem_6rem] gap-2 items-center";

  return (
    <div className="border-t border-gray-100 bg-gray-50/50">
      {/* Roster progress strip — folded in from the old roster card */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 tabular-nums">{onboarded}</span>
          <span className="text-xs text-gray-500">of {total} onboarded</span>
          <div className="relative w-28 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${total ? Math.round((onboarded / total) * 100) : 0}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          {MILESTONE_META.map((mi) => (
            <span key={mi.key} title={mi.full}>
              {mi.short} <span className="font-semibold text-gray-700 tabular-nums">{milestoneCount(mi.key)}</span>/{total}
            </span>
          ))}
        </div>
      </div>

      {/* Column header */}
      <div className={`${GRID} px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-100/60`}>
        <button
          type="button"
          onClick={() => setSortByName((v) => !v)}
          className="text-left uppercase tracking-wider font-semibold hover:text-gray-800 flex items-center gap-1"
          title={sortByName ? "Back to original order" : "Sort by name"}
        >
          Name {sortByName ? "↓ A–Ö" : "↕"}
        </button>
        {MILESTONE_META.map((mi) => {
          const allIds = shown.map((m) => m.id);
          const allDone = allIds.length > 0 && allIds.every((id) => milestones[id]?.[mi.key]?.done);
          return (
            <div key={mi.key} className="flex flex-col items-center gap-0.5" title={mi.full}>
              <span className="text-[9px] leading-tight">{mi.short}</span>
              <button
                type="button"
                disabled={bulkBusy !== null}
                onClick={() => toggleColumn(mi.key, allIds)}
                title={allDone ? `Untick ${mi.full} for everyone` : `Tick ${mi.full} for everyone`}
                className="text-[8px] font-medium px-1 py-px rounded text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                {bulkBusy === mi.key ? "…" : allDone ? "clear" : "all"}
              </button>
            </div>
          );
        })}
        <div>Status</div>
        <div className="text-right">Admin</div>
      </div>

      <div className="divide-y divide-gray-100">
        {shown.map((m) => {
          const isContact = !!contactEmail && m.email?.toLowerCase() === contactEmail.toLowerCase();
          const cells = milestones[m.id];
          return (
            <div key={m.id} className={`${GRID} px-4 py-2 text-sm`}>
              <div className="min-w-0">
                <div className="font-medium text-gray-800 truncate">{m.full_name || "—"}</div>
                <div className="text-[11px] text-gray-500 truncate">{m.email}{m.phone ? ` · ${m.phone}` : ""}</div>
              </div>
              {MILESTONE_META.map((mi) => {
                const cell = cells?.[mi.key] || { done: false, source: null };
                return (
                  <div key={mi.key} className="flex justify-center">
                    <MilestoneCircle
                      cell={cell}
                      busy={bulkBusy === mi.key}
                      onToggle={() => toggleMilestone(m.id, mi.key, cell.done)}
                    />
                  </div>
                );
              })}
              <div className="flex items-center">
                <MemberStatus m={m} />
              </div>
              <div className="flex items-center justify-end gap-2">
                <CompanyEmailButton companyId={companyId} companyName={companyName} member={{ id: m.id, name: m.full_name, email: m.email }} />
                {isContact ? (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Admin
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={settingContact !== null}
                    onClick={() => makeContact(m)}
                    className="text-[11px] text-gray-500 hover:text-emerald-700 underline underline-offset-2 disabled:opacity-50"
                  >
                    {settingContact === m.id ? "…" : "make admin"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Per-company commercial settings: custom assessment price, app subscription
// enablement + monthly price, the access tier, and a one-click "provision app
// access for already-onboarded employees" action.
function CommercialSettingsButton({ company, onReload }: { company: CompanyRow; onReload: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [price, setPrice] = useState<string>(company.assessment_unit_price != null ? String(company.assessment_unit_price) : "");
  const [followupPrice, setFollowupPrice] = useState<string>(company.followup_doctor_price != null ? String(company.followup_doctor_price) : "");
  const [appEnabled, setAppEnabled] = useState<boolean>(company.app_enabled === true);
  const [appPrice, setAppPrice] = useState<string>(String(company.app_price_isk_monthly ?? 3490));
  const [tier, setTier] = useState<string>(company.default_tier || "");

  const authHeader = async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const save = async () => {
    setSaving(true);
    setToast(null);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch(`/api/admin/companies/${company.id}/commercial`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        assessment_unit_price: price.trim() === "" ? null : Math.max(0, parseInt(price, 10) || 0),
        followup_doctor_price: followupPrice.trim() === "" ? null : Math.max(0, parseInt(followupPrice, 10) || 0),
        app_enabled: appEnabled,
        app_price_isk_monthly: Math.max(0, parseInt(appPrice, 10) || 0),
        default_tier: tier || null,
      }),
    });
    setSaving(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast({ type: "error", text: j.detail || j.error || "Could not save settings." });
      return;
    }
    setToast({ type: "success", text: "Settings saved." });
    onReload();
  };

  const provision = async () => {
    setProvisioning(true);
    setToast(null);
    const headers = { "Content-Type": "application/json", ...(await authHeader()) };
    const res = await fetch(`/api/admin/companies/${company.id}/provision-app`, { method: "POST", headers });
    setProvisioning(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setToast({ type: "error", text: j.detail || j.error || "Could not provision app access." });
      return;
    }
    setToast({
      type: "success",
      text: j.provisioned === 0
        ? "No onboarded employees yet — they'll get access automatically when they onboard."
        : `Provisioned ${j.provisioned} employee${j.provisioned === 1 ? "" : "s"} at the ${j.tier} tier.`,
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition-colors"
        title="Pricing & app subscription"
      >
        Change pricing
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Pricing &amp; app — {company.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">Overrides apply to this company&apos;s purchase order, invoices, and app access.</p>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Custom assessment price */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Custom assessment price (ISK / assessment)</label>
                <input
                  type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder="Leave blank for standard tiered pricing"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                />
                <p className="text-[11px] text-gray-400 mt-1">Shown on the signed contract and used on invoices. Blank = tiered price (49,900–54,900).</p>
              </div>

              {/* Custom 3-month doctor call price */}
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">Custom 3-month doctor call price (ISK / employee)</label>
                <input
                  type="number" min={0} value={followupPrice} onChange={(e) => setFollowupPrice(e.target.value)}
                  placeholder="Leave blank for the standard price"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                />
                <p className="text-[11px] text-gray-400 mt-1">The optional 15-min follow-up call, when added to the order. Blank = standard price (12,900).</p>
              </div>

              {/* App subscription */}
              <div className="rounded-xl border border-gray-200 p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <input type="checkbox" checked={appEnabled} onChange={(e) => setAppEnabled(e.target.checked)} className="rounded border-gray-300" />
                  Offer Lifeline app subscription on the order
                </label>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Monthly price (ISK / employee / month)</label>
                  <input
                    type="number" min={0} value={appPrice} onChange={(e) => setAppPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">App access tier (what employees get)</label>
                  <select value={tier} onChange={(e) => setTier(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white">
                    {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">Employees get this tier (active subscription) when they onboard. Use <strong>Premium</strong> for full app access.</p>
                </div>
                <button
                  onClick={provision}
                  disabled={provisioning}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {provisioning ? "Provisioning…" : "Provision app access for onboarded employees now"}
                </button>
                <p className="text-[11px] text-gray-400">Backfills employees who already have an account. New employees get access automatically at onboarding.</p>
              </div>

              {toast && (
                <div className={`text-sm rounded-lg px-3 py-2 ${toast.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {toast.text}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Close</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-emerald-500 disabled:opacity-50">
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Per-card accordion state: which sections are open (default: none —
  // the expanded card reads as a one-screen index of summaries).
  const [openSections, setOpenSections] = useState<Record<string, Record<string, boolean>>>({});
  const toggleSection = (companyId: string, key: string) =>
    setOpenSections((prev) => ({ ...prev, [companyId]: { ...prev[companyId], [key]: !prev[companyId]?.[key] } }));
  // Journey-step click: expand the card and open exactly that section.
  const focusSection = (companyId: string, key: string | null) => {
    setExpanded((prev) => new Set(prev).add(companyId));
    if (key) setOpenSections((prev) => ({ ...prev, [companyId]: { [key]: true } }));
  };
  const markFollowupDone = async (c: CompanyRow) => {
    if (!confirm(`Mark the 3-month doctor follow-up as done for ${c.name}?`)) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("companies").update({ followup_completed_at: now }).eq("id", c.id);
    if (error) { alert(`Failed: ${error.message}`); return; }
    setCompanies((prev) => prev.map((x) => x.id === c.id ? { ...x, followup_completed_at: now } : x));
  };
  const [fin, setFin] = useState<Map<string, FinRow>>(new Map());
  const [pendingApprovals, setPendingApprovals] = useState<Map<string, number>>(new Map());
  const [discountCodes, setDiscountCodes] = useState<Array<{ id: string; code: string; kind: "percent" | "fixed"; value: number }>>([]);
  const [msSummary, setMsSummary] = useState<Map<string, JourneyMilestones & { app_access: number }>>(new Map());

  // Side data for the unified view: per-company financials (accounting
  // module) + pending approval counts. Both best-effort — the roster
  // view works without them. Exposed as a callback so cost/invoice
  // mutations inside the card can refresh the Actual/Expected lines.
  const loadSideData = useCallback(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/admin/accounting/companies", {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          setFin(new Map(
            ((json.rows || []) as FinRow[])
              .filter((r) => r.company_id)
              .map((r) => [r.company_id as string, r]),
          ));
        }
        const [ev, iv, lec] = await Promise.all([
          supabase.from("body_comp_events").select("id, company_id").eq("approval_status", "requested"),
          supabase.from("doctor_interview_proposals").select("id, company_id").eq("approval_status", "requested"),
          supabase.from("intro_lectures").select("id, company_id").eq("approval_status", "requested"),
        ]);
        const counts = new Map<string, number>();
        for (const arr of [ev.data, iv.data, lec.data]) {
          for (const r of (arr as Array<{ company_id: string }> | null) || []) {
            counts.set(r.company_id, (counts.get(r.company_id) || 0) + 1);
          }
        }
        setPendingApprovals(counts);
        // Per-company milestone completion counts → journey steps 5 & 8.
        const msRes = await fetch("/api/admin/companies/milestone-summary", {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        if (msRes.ok) {
          const j = await msRes.json();
          setMsSummary(new Map(Object.entries((j.summary || {}) as Record<string, JourneyMilestones & { app_access: number }>)));
        }
        const { data: codes } = await supabase
          .from("discount_codes")
          .select("id, code, kind, value")
          .eq("active", true);
        setDiscountCodes((codes as Array<{ id: string; code: string; kind: "percent" | "fixed"; value: number }>) || []);
      } catch { /* non-blocking */ }
    })();
  }, []);

  useEffect(() => { loadSideData(); }, [loadSideData]);

  // Apply a discount code to a company. Percent codes discount ALL
  // income items (health check, 3-month follow-up, app subscription) by
  // baking the discounted prices into the company's price columns —
  // invoices, the income breakdown, and expected income all read those.
  // Fixed-amount codes apply to the health-check price only (a flat
  // amount off every line would over-discount). Removing the code
  // resets all prices to tier/defaults.
  const applyDiscount = async (c: CompanyRow, codeId: string) => {
    const code = discountCodes.find((d) => d.id === codeId);
    if (!code) return;
    const baseCheck = c.assessment_unit_price ?? assessmentUnitPriceIsk(Math.max(c.member_count || 1, 1), 1);
    const update: Record<string, unknown> = { applied_discount_code: code.code };
    if (code.kind === "percent") {
      const f = 1 - code.value / 100;
      update.assessment_unit_price = Math.round(baseCheck * f);
      update.followup_doctor_price = Math.round((c.followup_doctor_price ?? FOLLOWUP_DOCTOR_PRICE_ISK) * f);
      update.app_price_isk_monthly = Math.round((c.app_price_isk_monthly ?? 3490) * f);
    } else {
      update.assessment_unit_price = Math.max(baseCheck - code.value, 0);
    }
    const { error } = await supabase.from("companies").update(update).eq("id", c.id);
    if (error) { alert(`Discount failed: ${error.message}`); return; }
    setCompanies((prev) => prev.map((x) => x.id === c.id ? { ...x, ...update } as CompanyRow : x));
  };

  const removeDiscount = async (c: CompanyRow) => {
    if (!confirm(`Remove discount ${c.applied_discount_code}? All prices reset to tier/default.`)) return;
    const update = {
      assessment_unit_price: null,
      followup_doctor_price: null,
      app_price_isk_monthly: 3490,
      applied_discount_code: null,
    };
    const { error } = await supabase.from("companies").update(update).eq("id", c.id);
    if (error) { alert(`Failed: ${error.message}`); return; }
    setCompanies((prev) => prev.map((x) => x.id === c.id ? { ...x, ...update } : x));
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [rpcRes, tiersRes] = await Promise.all([
      supabase.rpc("list_all_companies"),
      supabase.from("companies").select("id, name, default_tier, assessment_unit_price, followup_doctor_price, app_enabled, app_price_isk_monthly, status, contact_draft_email, contact_draft_name, contact_draft_phone, parent_company_id, applied_discount_code, last_round_completed_at, followup_completed_at"),
    ]);
    if (rpcRes.error) setError(rpcRes.error.message);
    else {
      type ExtraRow = { id: string; name: string; default_tier: string | null; assessment_unit_price: number | null; followup_doctor_price: number | null; app_enabled: boolean | null; app_price_isk_monthly: number | null; status: CompanyRow["status"]; contact_draft_email: string | null; contact_draft_name: string | null; contact_draft_phone: string | null; parent_company_id: string | null; applied_discount_code: string | null; last_round_completed_at: string | null; followup_completed_at: string | null };
      const extraMap = new Map<string, ExtraRow>((tiersRes.data || []).map((t: ExtraRow) => [t.id, t]));
      const rows = ((rpcRes.data || []) as CompanyRow[]).map((c) => {
        const extra = extraMap.get(c.id);
        const parentId = extra?.parent_company_id || null;
        const parentName = parentId ? (extraMap.get(parentId)?.name || null) : null;
        return {
          ...c,
          default_tier: extra?.default_tier || null,
          assessment_unit_price: extra?.assessment_unit_price ?? null,
          followup_doctor_price: extra?.followup_doctor_price ?? null,
          app_enabled: extra?.app_enabled ?? false,
          app_price_isk_monthly: extra?.app_price_isk_monthly ?? 3490,
          status: extra?.status || "active",
          contact_draft_email: extra?.contact_draft_email || null,
          contact_draft_name: extra?.contact_draft_name || null,
          contact_draft_phone: extra?.contact_draft_phone || null,
          parent_company_id: parentId,
          parent_name: parentName,
          applied_discount_code: extra?.applied_discount_code || null,
          last_round_completed_at: extra?.last_round_completed_at || null,
          followup_completed_at: extra?.followup_completed_at || null,
        };
      });
      // Tree order: parents first (sorted by name), each followed immediately
      // by its children (sorted by name). Orphans (parent_id pointing at a
      // non-existent company) fall through to the bottom alphabetically.
      const parents = rows.filter((r) => !r.parent_company_id).sort((a, b) => a.name.localeCompare(b.name));
      const childrenByParent = new Map<string, CompanyRow[]>();
      for (const r of rows) {
        if (r.parent_company_id) {
          const arr = childrenByParent.get(r.parent_company_id) || [];
          arr.push(r);
          childrenByParent.set(r.parent_company_id, arr);
        }
      }
      for (const arr of childrenByParent.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
      const ordered: CompanyRow[] = [];
      for (const p of parents) {
        ordered.push(p);
        const kids = childrenByParent.get(p.id) || [];
        ordered.push(...kids);
      }
      // Orphan children (parent missing): append to the end
      const seen = new Set(ordered.map((r) => r.id));
      for (const r of rows) if (!seen.has(r.id)) ordered.push(r);
      setCompanies(ordered);
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

  // Summary counts for the table header
  const parentCount = companies.filter((c) => !c.parent_company_id).length;
  const subCount = companies.filter((c) => !!c.parent_company_id).length;
  const draftCount = companies.filter((c) => c.status === "draft" || c.status === "contact_invited").length;
  const readyCount = companies.filter((c) => c.registration_finalized_at).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Click a company to expand its roster. Parent rows show their sub-divisions nested beneath.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/companies/create" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Admin stofna fyrirtæki
          </Link>
          <Link href="/business/signup" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
            Create new company link
          </Link>
        </div>
      </div>

      {/* Summary chips */}
      {!loading && companies.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            {parentCount} {parentCount === 1 ? "parent" : "parents"}
          </span>
          {subCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              {subCount} sub-{subCount === 1 ? "division" : "divisions"}
            </span>
          )}
          {draftCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {draftCount} awaiting onboard
            </span>
          )}
          {readyCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {readyCount} ready
            </span>
          )}
        </div>
      )}

      {loading && <div className="text-gray-500">Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && companies.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center text-gray-500">
          No companies yet.
        </div>
      )}
      {companies.length > 0 && (
        <div className="space-y-3">
          {companies.map((c) => {
            // Divisions render INSIDE their mother company's card (a
            // DivisionRow in the expanded view), not as standalone
            // cards. Orphans (parent deleted) keep their own card.
            const isSub = !!c.parent_company_id && companies.some((p) => p.id === c.parent_company_id);
            if (isSub) return null;
            const children = companies.filter((x) => x.parent_company_id === c.id);
            const isParentWithSubs = children.length > 0;
            const aggMembers = (c.member_count || 0) + children.reduce((s, x) => s + (x.member_count || 0), 0);
            const finRows = [c, ...children].map((x) => fin.get(x.id)).filter(Boolean) as FinRow[];
            const aggFin = (k: keyof FinRow) => finRows.reduce((s, r) => s + ((r[k] as number) || 0), 0);
            const pendingCount = [c, ...children].reduce((s, x) => s + (pendingApprovals.get(x.id) || 0), 0);
            const isExpanded = expanded.has(c.id);
            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Top gradient accent — same language as the client view */}
                <div className="h-1.5 bg-gradient-to-r from-blue-500 to-emerald-500" />
                <div className="px-5 py-4">
                  {/* Header line: name + badges left, controls right */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => toggleExpand(c.id)}
                            className="text-lg font-semibold text-gray-900 hover:text-emerald-700 text-left truncate transition-colors"
                            title={isExpanded ? "Hide details" : "Show details"}
                          >
                            {c.name}
                          </button>
                          {pendingCount > 0 && (
                            <Link
                              href="/admin/business?tab=approvals"
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                              title="Open the Approvals tab (includes divisions)"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              {pendingCount} pending approval{pendingCount > 1 ? "s" : ""}
                            </Link>
                          )}
                          {isSub && c.parent_name && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                              title={`Reikningur gengur upp á ${c.parent_name}`}
                            >
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                              </svg>
                              Billed to {c.parent_name}
                            </span>
                          )}
                          {isParentWithSubs && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200" title="Has sub-divisions">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                              </svg>
                              Parent
                            </span>
                          )}
                        </div>
                        {c.registration_finalized_at && (
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            Ready · {c.finalized_by_name || c.finalized_by_email || "—"} · {new Date(c.registration_finalized_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      <span className="text-[11px] text-gray-500 whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                      </span>
                      <button
                        onClick={() => toggleExpand(c.id)}
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                          isExpanded
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/40"
                        }`}
                        title={isExpanded ? "Hide details" : "Show pricing, costs, invoices, divisions and employees"}
                      >
                        <svg
                          className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                        {isExpanded ? "Hide" : "Details"}
                      </button>
                      <CompanyEmailButton companyId={c.id} companyName={c.name} />
                      <OverflowMenu label="Settings">
                        {() => (
                          <div className="flex flex-col items-stretch gap-0.5 px-1.5 py-1.5">
                            <Link
                              href={`/business/${c.id}`}
                              className="w-full text-left text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                              title="Open the company's own dashboard"
                            >
                              Client view
                            </Link>
                            <button
                              onClick={() => downloadCsv(c.id, c.name)}
                              className="w-full text-left text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                              title="Download employee roster as CSV"
                            >
                              Export roster CSV
                            </button>
                            <BulkBiodyButton
                              companyId={c.id}
                              companyName={c.name}
                              parentName={c.parent_company_id ? c.parent_name || null : null}
                              hasChildren={isParentWithSubs}
                            />
                            <EnsureGroupButton companyId={c.id} />
                            <BulkActivateButton companyId={c.id} />
                            <div className="border-t border-gray-100 my-0.5" />
                            <DeleteCompanyButton company={c} onDone={load} />
                          </div>
                        )}
                      </OverflowMenu>
                    </div>
                  </div>

                  <CompanyJourney
                    invited={c.status !== "draft"}
                    claimed={!!c.registration_finalized_at}
                    docsReady={REQUIRED_DOC_KINDS.filter((k) => (fin.get(c.id)?.doc_kinds || []).includes(k)).length}
                    members={aggMembers}
                    ms={[c.id, ...children.map((x) => x.id)].reduce((a, id) => {
                      const s = msSummary.get(id);
                      if (s) { a.total += s.total; a.measurement += s.measurement; a.blood_test += s.blood_test; a.questionnaire += s.questionnaire; a.doctor_review += s.doctor_review; a.followup += s.followup; }
                      return a;
                    }, { total: 0, measurement: 0, blood_test: 0, questionnaire: 0, doctor_review: 0, followup: 0 })}
                    eventsScheduled={(c.body_comp_event_count || 0) + children.reduce((s, x) => s + (x.body_comp_event_count || 0), 0) > 0}
                    pendingCount={pendingCount}
                    invoicedIsk={aggFin("invoiced_isk")}
                    outstandingIsk={aggFin("outstanding_isk")}
                    followupCompletedAt={c.followup_completed_at || null}
                    onStepClick={(key) => focusSection(c.id, key)}
                    onFollowupDone={() => markFollowupDone(c)}
                  />

                  {/* Contact — name + email/phone, manual editor, invite
                      button. Roster progress now lives in the Employees
                      section (folded into the milestone roster view). */}
                  <div className="mt-3 max-w-sm">
                    <ContactCell c={c} onSaved={load} />
                  </div>

                  {/* Financial stat tiles — aggregated across the mother
                      company + divisions; expected values use the
                      negotiated prices and quantity overrides. */}
                  {(() => {
                    if (finRows.length === 0) return null;
                    const outstanding = aggFin("outstanding_isk");
                    const net = aggFin("net_isk");
                    const margin = aggFin("expected_net_isk");
                    const tiles: Array<{ label: string; value: string; tone?: string }> = [
                      { label: "Invoiced", value: iskFmt(aggFin("invoiced_isk")) },
                      { label: "Paid", value: iskFmt(aggFin("paid_isk")) },
                      { label: "Outstanding", value: iskFmt(outstanding), tone: outstanding > 0 ? "text-amber-600" : "text-gray-900" },
                      { label: "Costs", value: iskFmt(aggFin("costs_isk")) },
                      { label: "Net", value: iskFmt(net), tone: net < 0 ? "text-red-600" : "text-emerald-700" },
                      { label: "Expected margin", value: iskFmt(margin), tone: margin < 0 ? "text-red-600" : "text-emerald-700" },
                    ];
                    return (
                      <div className="mt-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                          {tiles.map((tile) => (
                            <div key={tile.label} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 min-w-0">
                              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 truncate">{tile.label}</div>
                              <div className={`text-sm font-bold tabular-nums ${tile.tone || "text-gray-900"}`}>
                                {tile.value}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-1 text-right">
                          <Link href="/admin/business?tab=accounting" className="text-[10px] text-emerald-700 hover:underline">
                            Accounting →
                          </Link>
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* Expanded: accordion index of the company cockpit —
                    every section collapsed behind a summary header.
                    Journey steps open their section directly. */}
                {isExpanded && (() => {
                  const docsReadyCount = REQUIRED_DOC_KINDS.filter((k) => (fin.get(c.id)?.doc_kinds || []).includes(k)).length;
                  const sec = openSections[c.id] || {};
                  const t = (key: string) => () => toggleSection(c.id, key);
                  return (
                    <div className="rounded-b-2xl overflow-hidden">
                      <CardSection
                        title="Pricing"
                        summary={aggMembers > 0 ? `${iskFmt(aggFin("expected_income_isk"))} expected` : "no roster yet"}
                        open={!!sec.pricing}
                        onToggle={t("pricing")}
                      >
                        <CompanyIncomeBreakdown
                          c={c}
                          onReload={load}
                          membersOverride={aggMembers}
                          discountCodes={discountCodes}
                          onApplyDiscount={applyDiscount}
                          onRemoveDiscount={removeDiscount}
                        />
                      </CardSection>
                      <CardSection
                        title="Legal"
                        summary={`${docsReadyCount}/3 documents signed`}
                        open={!!sec.legal}
                        onToggle={t("legal")}
                      >
                        <div className="px-5 py-3 bg-gray-50/60">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] text-gray-400">
                              Signed ToS, DPA and service agreement for this company.
                            </span>
                            <DocumentsButton companyId={c.id} docKinds={fin.get(c.id)?.doc_kinds || []} />
                          </div>
                        </div>
                      </CardSection>
                      <CardSection
                        title="Costs"
                        summary={`${iskFmt(aggFin("costs_isk"))} recorded`}
                        open={!!sec.costs}
                        onToggle={t("costs")}
                      >
                        <CompanyCosts companyId={c.id} memberCount={aggMembers} onChanged={loadSideData} />
                      </CardSection>
                      <CardSection
                        title="Invoices"
                        summary={`${iskFmt(aggFin("invoiced_isk"))} invoiced${aggFin("outstanding_isk") > 0 ? ` · ${iskFmt(aggFin("outstanding_isk"))} outstanding` : ""}`}
                        open={!!sec.invoices}
                        onToggle={t("invoices")}
                      >
                        <CompanyInvoiceRows companyId={c.id} companyName={c.name} hasChildren={isParentWithSubs} />
                      </CardSection>
                      <CardSection
                        title="Approvals"
                        summary={pendingCount > 0 ? `${pendingCount} pending` : "none pending"}
                        open={!!sec.approvals}
                        onToggle={t("approvals")}
                      >
                        <CompanyApprovals companyIds={[c.id, ...children.map((x) => x.id)]} />
                      </CardSection>
                      {children.length > 0 ? (
                        <CardSection
                          title="Divisions"
                          summary={`${children.length} division${children.length > 1 ? "s" : ""}`}
                          open={!!sec.divisions}
                          onToggle={t("divisions")}
                        >
                          <div className="px-5 py-3 bg-gray-50/60">
                            <div className="space-y-1.5">
                              {children.map((d) => (
                                <DivisionRow key={d.id} d={d} onContactChanged={load} onMilestoneChanged={loadSideData} />
                              ))}
                            </div>
                          </div>
                        </CardSection>
                      ) : null}
                      <CardSection
                        title="Employees"
                        summary={
                          (c.member_count || 0) > 0
                            ? `${c.member_count} on roster`
                            : children.length > 0
                              ? `${aggMembers} across ${children.length} division${children.length > 1 ? "s" : ""}`
                              : "0 on roster"
                        }
                        open={!!sec.employees}
                        onToggle={t("employees")}
                      >
                        {(c.member_count || 0) > 0 || children.length === 0 ? (
                          <EmployeeRows
                            companyId={c.id}
                            companyName={c.name}
                            contactEmail={c.contact_email || c.contact_draft_email || null}
                            onContactChanged={load}
                            onMilestoneChanged={loadSideData}
                          />
                        ) : (
                          <div className="px-5 py-3 text-xs text-gray-500 bg-gray-50/60">
                            This company has no direct employees — its {aggMembers} employee{aggMembers === 1 ? "" : "s"} are
                            managed within the {children.length} division{children.length > 1 ? "s" : ""}. Open a division in
                            the Divisions section above to see and manage its roster.
                          </div>
                        )}
                      </CardSection>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

