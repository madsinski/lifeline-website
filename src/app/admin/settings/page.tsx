"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const TeamContent = dynamic(() => import("../team/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const TranslationsContent = dynamic(() => import("../translations/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const CheckinsContent = dynamic(() => import("../checkins/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });

const tabs = [
  { key: "team", label: "Team" },
  { key: "translations", label: "Translations" },
  { key: "checkins", label: "QR Check-ins" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("team");

  return (
    <div>
      <div className="px-8 pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500 mb-4">Team management, translations, and check-ins</p>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {tab === "team" && <TeamContent />}
      {tab === "translations" && <TranslationsContent />}
      {tab === "checkins" && <CheckinsContent />}
    </div>
  );
}
