"use client";

import { useState } from "react";
import NdaTab from "./NdaTab";
import FeedbackTab from "./FeedbackTab";

type Tab = "feedback" | "nda";

export default function AdminBetaPage() {
  const [tab, setTab] = useState<Tab>("feedback");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Beta</h1>
        <p className="text-sm text-gray-500 mt-1">
          Signed tester agreements + feedback from inside the beta app.
        </p>
      </div>

      <div className="mb-4 inline-flex bg-white rounded-xl p-1 shadow-sm border border-gray-100">
        {(["feedback", "nda"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t === "feedback" ? "Feedback" : "Signed agreements"}
          </button>
        ))}
      </div>

      {tab === "feedback" ? <FeedbackTab /> : <NdaTab />}
    </div>
  );
}
