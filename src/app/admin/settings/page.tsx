"use client";

// Wrapper page: the tab bar mirrors ?tab= (AdminTabs), so
// /admin/settings?tab=checkins opens that tab directly.

import { useState } from "react";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const TeamContent = dynamic(() => import("../team/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });
const TranslationsContent = dynamic(() => import("../translations/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });
const CheckinsContent = dynamic(() => import("../checkins/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });

const tabs = [
  { key: "team", label: "Teymi" },
  { key: "translations", label: "Þýðingar" },
  { key: "checkins", label: "QR-innritun" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("team");

  return (
    <div>
      <div className="px-4 pt-4 sm:px-8 sm:pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Teymi og stillingar</h1>
        <p className="text-sm text-gray-600 mb-4">Starfsfólk, þýðingar og QR-innritun.</p>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} label="Teymi og stillingar" />
      </div>
      {tab === "team" && <TeamContent />}
      {tab === "translations" && <TranslationsContent />}
      {tab === "checkins" && <CheckinsContent />}
    </div>
  );
}
