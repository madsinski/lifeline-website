"use client";

// The doctor-slots tab is gone: the doctor interview is booked in Medalia.
// The page file (src/app/admin/doctor-slots) stays for now; it is still
// reachable by URL for admins (owned by this route in admin-nav.tsx).

// Wrapper page: the tab bar mirrors ?tab= (AdminTabs), so
// /admin/scheduling?tab=measurement opens that tab directly.

import { useState } from "react";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const CalendarContent = dynamic(() => import("../calendar/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });
const MeasurementAppointments = dynamic(() => import("../station-slots/page"), { loading: () => <p role="status" className="p-8 text-gray-500">Hleð…</p> });

const tabs = [
  { key: "calendar", label: "Dagatal" },
  { key: "measurement", label: "Mælingatímar" },
];

export default function SchedulingPage() {
  const [tab, setTab] = useState("calendar");

  return (
    <div>
      <div className="px-4 pt-4 sm:px-8 sm:pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Dagatal</h1>
        <p className="text-sm text-gray-600 mb-4">Tímar og mælingatímar.</p>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} label="Dagatal" />
      </div>
      {tab === "calendar" && <CalendarContent />}
      {tab === "measurement" && <MeasurementAppointments />}
    </div>
  );
}
