"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const OutreachContent = dynamic(() => import("../outreach/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const EmailListContent = dynamic(() => import("../email-list/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const EmailPreviewContent = dynamic(() => import("../email-preview/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });

const tabs = [
  { key: "outreach", label: "Outreach" },
  { key: "subscribers", label: "Subscribers" },
  { key: "preview", label: "Email Preview" },
];

export default function CommunicationPage() {
  const [tab, setTab] = useState("outreach");

  return (
    <div>
      <div className="px-8 pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Communication</h1>
        <p className="text-sm text-gray-500 mb-4">Outreach campaigns and email subscribers</p>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {tab === "outreach" && <OutreachContent />}
      {tab === "subscribers" && <EmailListContent />}
      {tab === "preview" && <EmailPreviewContent />}
    </div>
  );
}
