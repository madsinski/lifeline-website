"use client";

// Wrapper page: the tab bar mirrors ?tab= (AdminTabs), so
// /admin/content?tab=education opens that tab directly.

import { useState } from "react";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const ProgramsContent = dynamic(() => import("../programs/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });
const ExercisesContent = dynamic(() => import("../exercises/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });
const EducationContent = dynamic(() => import("../education/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });

const tabs = [
  { key: "programs", label: "Prógrömm" },
  { key: "exercises", label: "Æfingar" },
  { key: "education", label: "Fræðsluefni" },
];

export default function ContentPage() {
  const [tab, setTab] = useState("programs");

  return (
    <div>
      <div className="px-4 pt-4 sm:px-8 sm:pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Appefni</h1>
        <p className="text-sm text-gray-600 mb-4">Prógrömm, æfingar og fræðsluefni í appinu.</p>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} label="Appefni" />
      </div>
      {tab === "programs" && <ProgramsContent />}
      {tab === "exercises" && <ExercisesContent />}
      {tab === "education" && <EducationContent />}
    </div>
  );
}
