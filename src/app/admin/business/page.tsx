"use client";

// Business hub: companies + payments. Legal used to be a tab here that
// duplicated /admin/legal exactly — removed in the legal-hub consolidation
// 2026-05-04. Use the dedicated Legal section in the sidebar for any
// legal documents, signed acceptances, or the security posture statement.

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import AdminTabs from "../components/AdminTabs";

const CompaniesContent = dynamic(() => import("../companies/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const PaymentsContent = dynamic(() => import("../payments/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const DiscountCodesContent = dynamic(() => import("./DiscountCodes"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });

const tabs = [
  { key: "companies", label: "Companies" },
  { key: "payments", label: "Payments" },
  { key: "discounts", label: "Discount codes" },
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

export default function BusinessPage() {
  const [tab, setTab] = useState("companies");

  return (
    <div>
      <div className="px-8 pt-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Business</h1>
            <p className="text-sm text-gray-500">Companies and billing</p>
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
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {tab === "companies" && <CompaniesContent />}
      {tab === "payments" && <PaymentsContent />}
      {tab === "discounts" && <DiscountCodesContent />}
    </div>
  );
}
