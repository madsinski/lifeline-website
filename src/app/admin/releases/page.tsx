"use client";

import { useState } from "react";
import ReleasesTab from "./ReleasesTab";
import RiskRegisterTab from "./RiskRegisterTab";

type Tab = "releases" | "risk";

export default function AdminReleasesPage() {
  const [tab, setTab] = useState<Tab>("releases");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Releases &amp; risk</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          MDR design-history-file evidence. Every shipped build registers a
          row in <code className="bg-gray-100 px-1 py-0.5 rounded">app_releases</code> with
          its git sha, channel, risk assessment, and SBOM. The risk register
          tracks ISO 14971 entries cross-referenced from those releases.
        </p>
      </div>

      <div className="mb-4 inline-flex bg-white rounded-xl p-1 shadow-sm border border-gray-100">
        {(["releases", "risk"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {t === "releases" ? "Release log" : "Risk register"}
          </button>
        ))}
      </div>

      {tab === "releases" ? <ReleasesTab /> : <RiskRegisterTab />}
    </div>
  );
}
