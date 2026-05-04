"use client";

// Business hub: companies + payments. Legal used to be a tab here that
// duplicated /admin/legal exactly — removed in the legal-hub consolidation
// 2026-05-04. Use the dedicated Legal section in the sidebar for any
// legal documents, signed acceptances, or the security posture statement.

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const CompaniesContent = dynamic(() => import("../companies/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const PaymentsContent = dynamic(() => import("../payments/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });

const tabs = [
  { key: "companies", label: "Companies" },
  { key: "payments", label: "Payments" },
];

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
          <Link
            href="/admin/legal"
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
          >
            Legal documents &amp; agreements →
          </Link>
        </div>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {tab === "companies" && <CompaniesContent />}
      {tab === "payments" && <PaymentsContent />}
    </div>
  );
}
