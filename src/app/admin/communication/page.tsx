"use client";

// Wrapper page: the tab bar mirrors ?tab= (AdminTabs), so
// /admin/communication?tab=preview opens that tab directly.

import { useState } from "react";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const OutreachContent = dynamic(() => import("../outreach/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });
const InquiriesContent = dynamic(() => import("../company-inquiries/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });
const EmailListContent = dynamic(() => import("../email-list/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });
const EmailPreviewContent = dynamic(() => import("../email-preview/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });

const tabs = [
  { key: "outreach", label: "Útsendingar" },
  { key: "inquiries", label: "Fyrirspurnir fyrirtækja" },
  { key: "subscribers", label: "Áskrifendur" },
  { key: "preview", label: "Forskoðun tölvupósta" },
];

export default function CommunicationPage() {
  const [tab, setTab] = useState("outreach");

  return (
    <div>
      <div className="px-4 pt-4 sm:px-8 sm:pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Markaðssetning</h1>
        <p className="text-sm text-gray-600 mb-4">Útsendingar, fyrirspurnir fyrirtækja og póstlisti.</p>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} label="Markaðssetning" />
      </div>
      {tab === "outreach" && <OutreachContent />}
      {tab === "inquiries" && <InquiriesContent />}
      {tab === "subscribers" && <EmailListContent />}
      {tab === "preview" && <EmailPreviewContent />}
    </div>
  );
}
