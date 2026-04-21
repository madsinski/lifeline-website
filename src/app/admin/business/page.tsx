"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const CompaniesContent = dynamic(() => import("../companies/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const InquiriesContent = dynamic(() => import("../company-inquiries/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const PaymentsContent = dynamic(() => import("../payments/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const LegalContent = dynamic(() => import("../legal/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });

const tabs = [
  { key: "companies", label: "Companies" },
  { key: "inquiries", label: "Inquiries" },
  { key: "payments", label: "Payments" },
  { key: "legal", label: "Legal" },
];

export default function BusinessPage() {
  const [tab, setTab] = useState("companies");

  return (
    <div>
      <div className="px-8 pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Business</h1>
        <p className="text-sm text-gray-500 mb-4">Companies, inquiries, billing, and agreements</p>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {tab === "companies" && <CompaniesContent />}
      {tab === "inquiries" && <InquiriesContent />}
      {tab === "payments" && <PaymentsContent />}
      {tab === "legal" && <LegalContent />}
    </div>
  );
}
