"use client";

// Wrapper page: the tab bar mirrors ?tab= (AdminTabs), so
// /admin/conversations?tab=feedback opens that tab directly.

import { useState } from "react";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const MessagesContent = dynamic(() => import("../messages/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });
const FeedbackContent = dynamic(() => import("../feedback/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });

const tabs = [
  { key: "messages", label: "Skilaboð" },
  { key: "feedback", label: "Ábendingar" },
];

export default function ConversationsPage() {
  const [tab, setTab] = useState("messages");

  return (
    <div>
      <div className="px-4 pt-4 sm:px-8 sm:pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Skilaboð</h1>
        <p className="text-sm text-gray-600 mb-4">Skilaboð frá skjólstæðingum og ábendingar úr betaútgáfu.</p>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} label="Skilaboð" />
      </div>
      {tab === "messages" && <MessagesContent />}
      {tab === "feedback" && <FeedbackContent />}
    </div>
  );
}
