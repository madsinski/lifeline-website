"use client";

// Business hub: companies + payments. Legal used to be a tab here that
// duplicated /admin/legal exactly — removed in the legal-hub consolidation
// 2026-05-04. Use the dedicated Legal section in the sidebar for any
// legal documents, signed acceptances, or the security posture statement.

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import AdminTabs from "../components/AdminTabs";

const CompaniesContent = dynamic(() => import("../companies/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const PaymentsContent = dynamic(() => import("../payments/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const DiscountCodesContent = dynamic(() => import("./DiscountCodes"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const ApprovalsContent = dynamic(() => import("./Approvals"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const AccountingContent = dynamic(() => import("./Accounting"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const PlanContent = dynamic(() => import("./Plan"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const CostIntakeContent = dynamic(() => import("./CostIntake"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });

const tabs = [
  { key: "companies", label: "Companies" },
  { key: "approvals", label: "Scheduling" },
  { key: "payments", label: "Payments" },
  { key: "cost-intake", label: "Cost" },
  { key: "discounts", label: "Discount codes" },
  { key: "accounting", label: "Accounting" },
  { key: "plan", label: "Plan" },
];

interface PaydayTestResult {
  ok: boolean;
  baseUrl?: string;
  environment?: "production" | "sandbox" | "unknown";
  clientIdSet?: boolean;
  clientSecretSet?: boolean;
  clientIdPreview?: string | null;
  tokenIssued?: boolean;
  httpStatus?: number;
  error?: string;
}

// Staff diagnostic — confirms which Payday env the deployed server is
// pointed at and whether the configured client_id/secret can mint a
// real OAuth token. Use this after switching env vars to verify the
// production credentials before issuing real invoices.
function PaydayDiagButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PaydayTestResult | null>(null);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      // Admin API routes authenticate via Authorization: Bearer; without
      // it getUserFromRequest returns null and the route 403s.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/admin/payday/test-connection", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? "Testing…" : "Test Payday connection"}
      </button>
      {result ? (
        <div
          className={`text-[11px] rounded-md px-2 py-1.5 border max-w-xs leading-snug ${
            result.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <div className="font-semibold">
            {result.ok ? "Connected" : "Failed"}
            {result.environment ? ` · ${result.environment}` : ""}
            {typeof result.httpStatus === "number" ? ` · HTTP ${result.httpStatus}` : ""}
          </div>
          {result.baseUrl ? <div className="opacity-80">{result.baseUrl}</div> : null}
          {result.clientIdPreview ? (
            <div className="opacity-80">client: {result.clientIdPreview}</div>
          ) : null}
          {result.error ? <div className="opacity-80 break-words">{result.error}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

// At-a-glance strip above the tabs: this month's P&L (Accounting),
// outstanding receivables (PayDay invoices not yet paid), and pending
// approval requests. Each card navigates to the tab that owns it, so
// the strip doubles as a map of how the tabs fit together.
function OverviewStrip({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [data, setData] = useState<{
    income: number; expenses: number; net: number;
    outstanding: number; pending: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const month = new Date().toISOString().slice(0, 7);
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` } : {};
        const [repRes, compRes, ev, iv, lec] = await Promise.all([
          fetch(`/api/admin/accounting/report?month=${month}`, { headers }),
          fetch(`/api/admin/accounting/companies`, { headers }),
          supabase.from("body_comp_events").select("id", { count: "exact", head: true }).eq("approval_status", "requested"),
          supabase.from("doctor_interview_proposals").select("id", { count: "exact", head: true }).eq("approval_status", "requested"),
          supabase.from("intro_lectures").select("id", { count: "exact", head: true }).eq("approval_status", "requested"),
        ]);
        const rep = repRes.ok ? await repRes.json() : null;
        const comp = compRes.ok ? await compRes.json() : null;
        if (cancelled) return;
        setData({
          income: rep?.report?.totals?.income_isk ?? 0,
          expenses: rep?.report?.totals?.expenses_isk ?? 0,
          net: rep?.report?.totals?.net_isk ?? 0,
          outstanding: ((comp?.rows || []) as Array<{ outstanding_isk: number }>)
            .reduce((s, r) => s + (r.outstanding_isk || 0), 0),
          pending: (ev.count || 0) + (iv.count || 0) + (lec.count || 0),
        });
      } catch { /* strip is best-effort; tabs still work without it */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const isk = (n: number) => `${Math.round(n).toLocaleString("is-IS")} kr.`;
  const card = "text-left border border-gray-200 rounded-lg bg-white px-3.5 py-2.5 hover:border-emerald-300 hover:shadow-sm transition-all";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
      <button type="button" className={card} onClick={() => onNavigate("accounting")}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">This month</div>
        <div className={`text-sm font-bold ${data && data.net < 0 ? "text-red-600" : "text-gray-900"}`}>
          {data ? isk(data.net) : "…"}
          <span className="font-normal text-gray-400 text-xs"> net</span>
        </div>
        <div className="text-[11px] text-gray-500">
          {data ? `${isk(data.income)} in · ${isk(data.expenses)} out` : "Loading"}
        </div>
      </button>
      <button type="button" className={card} onClick={() => onNavigate("accounting")}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Outstanding invoices</div>
        <div className={`text-sm font-bold ${data && data.outstanding > 0 ? "text-amber-600" : "text-gray-900"}`}>
          {data ? isk(data.outstanding) : "…"}
        </div>
        <div className="text-[11px] text-gray-500">Issued via PayDay, not yet paid</div>
      </button>
      <button type="button" className={card} onClick={() => onNavigate("approvals")}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Pending approvals</div>
        <div className={`text-sm font-bold ${data && data.pending > 0 ? "text-amber-600" : "text-gray-900"}`}>
          {data ? data.pending : "…"}
        </div>
        <div className="text-[11px] text-gray-500">Measurement days, doctor days, lectures</div>
      </button>
    </div>
  );
}

export default function BusinessPage() {
  const [tab, setTab] = useState("companies");

  // Deep-linking: /admin/business?tab=accounting opens that tab directly
  // (used by the Financials line on company cards, and bookmarkable).
  // Deferred a tick: the URL is only readable client-side, and the
  // lint rule (correctly) dislikes synchronous setState in effects.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && tabs.some((x) => x.key === t)) queueMicrotask(() => setTab(t));
  }, []);

  return (
    <div>
      <div className="px-8 pt-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Business</h1>
            <p className="text-sm text-gray-500">Companies → approvals → invoicing → payments → accounting</p>
          </div>
          <div className="flex items-start gap-4">
            <PaydayDiagButton />
            <div className="flex flex-col items-end gap-1 mt-1.5">
              <Link
                href="/admin/legal"
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
              >
                Legal documents &amp; agreements →
              </Link>
            </div>
          </div>
        </div>
        <OverviewStrip onNavigate={setTab} />
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {tab === "companies" && <CompaniesContent />}
      {tab === "approvals" && <ApprovalsContent />}
      {tab === "payments" && <PaymentsContent />}
      {tab === "discounts" && <DiscountCodesContent />}
      {tab === "accounting" && <AccountingContent />}
      {tab === "cost-intake" && <CostIntakeContent />}
      {tab === "plan" && <PlanContent />}
    </div>
  );
}
