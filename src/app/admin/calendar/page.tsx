"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────

interface Appointment {
  id: string;
  client_id: string;
  type: "measurement" | "blood-test" | "consultation";
  date: string;
  time: string;
  station_name: string | null;
  coach_name: string | null;
  video_room_url: string | null;
  status: "booked" | "completed" | "cancelled";
  clients: {
    full_name: string;
    email: string;
  } | null;
}

type FilterTab = "all" | "measurement" | "blood-test" | "consultation";

// ─── Helpers ─────────────────────────────────────────────────

function getDateGroup(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));

  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  if (date.getTime() < today.getTime()) return "Past";
  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (date.getTime() <= endOfWeek.getTime()) return "This Week";
  return "Later";
}

function groupByDate(appointments: Appointment[]): Record<string, Appointment[]> {
  const groups: Record<string, Appointment[]> = {};
  const order = ["Today", "Tomorrow", "This Week", "Later", "Past"];

  for (const apt of appointments) {
    const group = getDateGroup(apt.date);
    if (!groups[group]) groups[group] = [];
    groups[group].push(apt);
  }

  // Return in order
  const ordered: Record<string, Appointment[]> = {};
  for (const key of order) {
    if (groups[key]) ordered[key] = groups[key];
  }
  return ordered;
}

function typeColor(type: string): { bg: string; text: string; dot: string } {
  switch (type) {
    case "measurement":
      return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" };
    case "blood-test":
      return { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" };
    case "consultation":
      return { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" };
    default:
      return { bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-500" };
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "booked":
      return "bg-yellow-100 text-yellow-800";
    case "completed":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatType(type: string): string {
  switch (type) {
    case "measurement":
      return "Measurement";
    case "blood-test":
      return "Blood Test";
    case "consultation":
      return "Consultation";
    default:
      return type;
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  return `${h}:${m}`;
}

// ─── Component ───────────────────────────────────────────────

interface ClientOption {
  id: string;
  name: string;
  email: string;
}

interface NewAppointment {
  clientId: string;
  type: "measurement" | "blood-test" | "consultation";
  date: string;
  time: string;
  stationName: string;
  coachName: string;
}

const emptyAppointment: NewAppointment = {
  clientId: "",
  type: "consultation",
  date: "",
  time: "09:00",
  stationName: "",
  coachName: "",
};

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [hideCancel, setHideCancel] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newApt, setNewApt] = useState<NewAppointment>(emptyAppointment);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("appointments")
        .select("*, clients(full_name, email)")
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      if (err) {
        setError(err.message);
        return;
      }

      setAppointments((data as Appointment[]) || []);
    } catch (e) {
      setError("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const loadClients = useCallback(async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, full_name, email")
      .order("full_name", { ascending: true });
    if (data) {
      setClients(data.map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: (c.full_name as string) || (c.email as string) || "Unknown",
        email: (c.email as string) || "",
      })));
    }
  }, []);

  const handleCreateAppointment = async () => {
    if (!newApt.clientId || !newApt.date) return;
    setCreating(true);
    try {
      // Format date as text like "April 8, 2026"
      const d = new Date(newApt.date);
      const dateText = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

      const { error: err } = await supabase.from("appointments").insert({
        client_id: newApt.clientId,
        type: newApt.type,
        date: dateText,
        time: newApt.time || "09:00",
        station_name: newApt.stationName || null,
        coach_name: newApt.coachName || null,
        status: "booked",
      });

      if (err) {
        setError(err.message);
      } else {
        setShowCreateForm(false);
        setNewApt(emptyAppointment);
        setClientSearch("");
        loadAppointments();
      }
    } catch {
      setError("Failed to create appointment");
    } finally {
      setCreating(false);
    }
  };

  const openCreateForm = () => {
    setShowCreateForm(true);
    loadClients();
  };

  const filteredClients = clientSearch.trim().length > 0
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c.email.toLowerCase().includes(clientSearch.toLowerCase())
      )
    : clients;

  const typeFiltered = activeFilter === "all"
    ? appointments
    : appointments.filter((a) => a.type === activeFilter);
  const filtered = hideCancel
    ? typeFiltered.filter((a) => a.status !== "cancelled")
    : typeFiltered;

  const grouped = groupByDate(filtered);
  const totalCount = filtered.length;

  const filterTabs: { key: FilterTab; label: string; color: string }[] = [
    { key: "all", label: "All", color: "bg-gray-600" },
    { key: "measurement", label: "Measurements", color: "bg-emerald-500" },
    { key: "blood-test", label: "Blood Tests", color: "bg-blue-500" },
    { key: "consultation", label: "Consultations", color: "bg-purple-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1F2937]">Calendar</h2>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} appointment{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#20c858] text-white rounded-lg text-sm font-medium hover:bg-[#1bb34e] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Book Appointment
        </button>
        <button
          onClick={loadAppointments}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
        </div>
      </div>

      {/* Create appointment modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">Book Appointment</h3>
              <button onClick={() => { setShowCreateForm(false); setNewApt(emptyAppointment); }} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Client search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c858]/30 focus:border-[#20c858]"
                />
                {clientSearch.trim() && (
                  <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-lg mt-1">
                    {filteredClients.slice(0, 8).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setNewApt((p) => ({ ...p, clientId: c.id })); setClientSearch(c.name); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${newApt.clientId === c.id ? "bg-[#20c858]/5 font-medium" : ""}`}
                      >
                        {c.name} <span className="text-gray-400 text-xs">{c.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex gap-2">
                  {(["measurement", "blood-test", "consultation"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setNewApt((p) => ({ ...p, type: t }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        newApt.type === t ? "bg-[#1F2937] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {formatType(t)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={newApt.date}
                    onChange={(e) => setNewApt((p) => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c858]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input
                    type="time"
                    value={newApt.time}
                    onChange={(e) => setNewApt((p) => ({ ...p, time: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c858]/30"
                  />
                </div>
              </div>

              {/* Station & Coach */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Station (optional)</label>
                  <input
                    type="text"
                    value={newApt.stationName}
                    onChange={(e) => setNewApt((p) => ({ ...p, stationName: e.target.value }))}
                    placeholder="e.g. Lifeline HQ"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c858]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coach (optional)</label>
                  <input
                    type="text"
                    value={newApt.coachName}
                    onChange={(e) => setNewApt((p) => ({ ...p, coachName: e.target.value }))}
                    placeholder="e.g. Coach Sarah"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c858]/30"
                  />
                </div>
              </div>

              <button
                onClick={handleCreateAppointment}
                disabled={!newApt.clientId || !newApt.date || creating}
                className="w-full py-2.5 bg-[#20c858] text-white rounded-lg font-medium text-sm hover:bg-[#1bb34e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Booking..." : "Book Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          const count =
            tab.key === "all"
              ? appointments.length
              : appointments.filter((a) => a.type === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#1F2937] text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isActive ? "bg-white" : tab.color
                }`}
              />
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => setHideCancel(!hideCancel)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            hideCancel
              ? "bg-[#20c858] text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          {hideCancel ? "Showing active only" : "Hide cancelled"}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c858]" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && totalCount === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-gray-500 font-medium">No appointments found</p>
          <p className="text-gray-400 text-sm mt-1">
            {activeFilter !== "all"
              ? "Try changing the filter to see more appointments."
              : "Appointments will appear here once clients book them."}
          </p>
        </div>
      )}

      {/* Grouped appointments */}
      {!loading &&
        Object.entries(grouped).map(([group, apts]) => (
          <div key={group}>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {group}
            </h3>
            <div className="space-y-3">
              {apts.map((apt) => {
                const color = typeColor(apt.type);
                return (
                  <div
                    key={apt.id}
                    className={`bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        {/* Type indicator */}
                        <div
                          className={`w-10 h-10 rounded-lg ${color.bg} flex items-center justify-center flex-shrink-0`}
                        >
                          <div className={`w-3 h-3 rounded-full ${color.dot}`} />
                        </div>

                        <div className="min-w-0">
                          {/* Client name */}
                          <p className="font-semibold text-[#1F2937] truncate">
                            {apt.clients?.full_name || "Unknown Client"}
                          </p>

                          {/* Type badge */}
                          <span
                            className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${color.bg} ${color.text}`}
                          >
                            {formatType(apt.type)}
                          </span>

                          {/* Details */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              {formatDate(apt.date)}
                            </span>
                            {apt.time && (
                              <span className="inline-flex items-center gap-1">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                {formatTime(apt.time)}
                              </span>
                            )}
                            {apt.station_name && (
                              <span className="inline-flex items-center gap-1">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                </svg>
                                {apt.station_name}
                              </span>
                            )}
                            {apt.coach_name && (
                              <span className="inline-flex items-center gap-1">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                                {apt.coach_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: status + join call */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {apt.video_room_url && (
                          <a
                            href={apt.video_room_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#20c858] text-white text-sm font-medium rounded-lg hover:bg-[#1bb34e] transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            Join call
                          </a>
                        )}
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusBadge(
                            apt.status
                          )}`}
                        >
                          {apt.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
