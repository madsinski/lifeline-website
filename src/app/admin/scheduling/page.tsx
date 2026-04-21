"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import AdminTabs from "../components/AdminTabs";

const CalendarContent = dynamic(() => import("../calendar/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const DoctorAppointments = dynamic(() => import("../doctor-slots/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });
const MeasurementAppointments = dynamic(() => import("../station-slots/page"), { loading: () => <p className="p-8 text-gray-400">Loading...</p> });

const tabs = [
  { key: "calendar", label: "Calendar" },
  { key: "doctor", label: "Doctor Appointments" },
  { key: "measurement", label: "Measurement Appointments" },
];

export default function SchedulingPage() {
  const [tab, setTab] = useState("calendar");

  return (
    <div>
      <div className="px-8 pt-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Scheduling</h1>
        <p className="text-sm text-gray-500 mb-4">Appointments, doctor slots, and measurement slots</p>
        <AdminTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {tab === "calendar" && <CalendarContent />}
      {tab === "doctor" && <DoctorAppointments />}
      {tab === "measurement" && <MeasurementAppointments />}
    </div>
  );
}
