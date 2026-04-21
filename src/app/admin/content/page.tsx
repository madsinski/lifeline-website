"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const ProgramsContent = dynamic(() => import("../programs/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const ExercisesContent = dynamic(() => import("../exercises/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const EducationContent = dynamic(() => import("../education/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });

const tabs = [
  { key: "programs", label: "Programs" },
  { key: "exercises", label: "Exercises" },
  { key: "education", label: "Education" },
];

export default function ContentPage() {
  const [tab, setTab] = useState("programs");

  return (
    <div>
      <div className="px-8 pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Content</h1>
        <p className="text-sm text-gray-500 mb-4">Programs, exercises, and education modules</p>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {tab === "programs" && <ProgramsContent />}
      {tab === "exercises" && <ExercisesContent />}
      {tab === "education" && <EducationContent />}
    </div>
  );
}
