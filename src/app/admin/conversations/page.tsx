"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const MessagesContent = dynamic(() => import("../messages/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const FeedbackContent = dynamic(() => import("../feedback/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });

const tabs = [
  { key: "messages", label: "Messages" },
  { key: "feedback", label: "Feedback" },
];

export default function ConversationsPage() {
  const [tab, setTab] = useState("messages");

  return (
    <div>
      <div className="px-8 pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Conversations</h1>
        <p className="text-sm text-gray-500 mb-4">Client messages and beta feedback</p>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {tab === "messages" && <MessagesContent />}
      {tab === "feedback" && <FeedbackContent />}
    </div>
  );
}
