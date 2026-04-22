"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import AdminLocationPicker from "@/components/AdminLocationPicker";

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

type FilterTab = "all" | "measurement" | "blood-test" | "consultation" | "events" | "slots";

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
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  const [stations, setStations] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Community event state
  const [showEventForm, setShowEventForm] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: "", date: "", time: "09:00", location: "", location_lat: null as number | null, location_lng: null as number | null, description: "", type: "Outdoor run", cost: "Free", reward: "", max_participants: "", image_url: "" });
  const [communityEvents, setCommunityEvents] = useState<{ id: string; name: string; type: string; date: string; time: string; location: string | null; description: string | null; image_url: string | null; cost: string; reward: string | null; max_participants: number | null; cancelled: boolean; staff_created: boolean; created_at: string }[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEvent, setEditEvent] = useState({ name: "", date: "", time: "", location: "", location_lat: null as number | null, location_lng: null as number | null, description: "", type: "", cost: "", reward: "", max_participants: "", image_url: "" });
  const [uploadingEventImg, setUploadingEventImg] = useState(false);

  // Available slots state
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [newSlot, setNewSlot] = useState({ appointment_type: 'body_composition' as string, date: '', start_time: '09:00', end_time: '09:30', station: '', provider_name: '', max_bookings: '1', notes: '' });
  const [bulkSlotDays, setBulkSlotDays] = useState<string[]>([]);
  const [creatingSlot, setCreatingSlot] = useState(false);

  // Upcoming client bookings — station_slots + doctor_slots. The legacy
  // Calendar only tracks the 'appointments' / 'available_slots' tables,
  // but all new bookings go through station_slots + doctor_slots. We
  // surface them here so admins have a single-view summary of who is
  // coming in, without having to switch tabs.
  type ClientBooking = {
    kind: "measurement" | "consultation";
    id: string;
    slot_at: string;
    duration_minutes: number | null;
    mode?: "video" | "phone" | "in_person" | null;
    location?: string | null;
    client_name: string | null;
    client_email: string | null;
  };
  const [clientBookings, setClientBookings] = useState<ClientBooking[]>([]);
  const [clientBookingsLoading, setClientBookingsLoading] = useState(false);

  const loadClientBookings = useCallback(async () => {
    setClientBookingsLoading(true);
    const nowIso = new Date().toISOString();
    const [{ data: stationRows }, { data: doctorRows }] = await Promise.all([
      supabase
        .from("station_slots")
        .select("id, slot_at, duration_minutes, location, client:clients(full_name, email)")
        .not("client_id", "is", null)
        .is("completed_at", null)
        .gte("slot_at", nowIso)
        .order("slot_at", { ascending: true })
        .limit(100),
      supabase
        .from("doctor_slots")
        .select("id, slot_at, duration_minutes, mode, location, client:clients(full_name, email)")
        .not("client_id", "is", null)
        .is("completed_at", null)
        .gte("slot_at", nowIso)
        .order("slot_at", { ascending: true })
        .limit(100),
    ]);
    const mk = (r: Record<string, unknown>, kind: ClientBooking["kind"]): ClientBooking => {
      const c = (Array.isArray(r.client) ? r.client[0] : r.client) as { full_name?: string | null; email?: string | null } | null;
      return {
        kind,
        id: r.id as string,
        slot_at: r.slot_at as string,
        duration_minutes: (r.duration_minutes as number | null) ?? null,
        mode: (r.mode as "video" | "phone" | "in_person" | undefined) ?? null,
        location: (r.location as string | null) ?? null,
        client_name: c?.full_name ?? null,
        client_email: c?.email ?? null,
      };
    };
    const merged: ClientBooking[] = [
      ...((stationRows || []) as Record<string, unknown>[]).map((r) => mk(r, "measurement")),
      ...((doctorRows || []) as Record<string, unknown>[]).map((r) => mk(r, "consultation")),
    ].sort((a, b) => a.slot_at.localeCompare(b.slot_at));
    setClientBookings(merged);
    setClientBookingsLoading(false);
  }, []);

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

  const loadCommunityEvents = useCallback(async () => {
    try {
      const { data } = await supabase.from("community_events").select("*").eq("staff_created", true).order("date", { ascending: false });
      if (data) setCommunityEvents(data as typeof communityEvents);
    } catch {}
  }, []);

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    try {
      const { data } = await supabase.from("available_slots").select("*").order("date").order("start_time");
      if (data) setAvailableSlots(data);
    } catch {}
    setSlotsLoading(false);
  }, []);

  useEffect(() => {
    loadAppointments();
    loadCommunityEvents();
    loadSlots();
    loadClientBookings();
  }, [loadAppointments, loadCommunityEvents, loadSlots, loadClientBookings]);

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

  const loadCoaches = useCallback(async () => {
    const { data } = await supabase.from("staff").select("id, name").eq("active", true);
    if (data) setCoaches(data.map((s: Record<string, unknown>) => ({ id: s.id as string, name: s.name as string })));
  }, []);

  const loadStations = useCallback(async () => {
    // Derive unique station names from existing appointments
    const { data } = await supabase.from("appointments").select("station_name");
    if (data) {
      const unique = [...new Set(data.map((a: Record<string, unknown>) => a.station_name as string).filter(Boolean))].sort();
      setStations(unique);
    }
  }, []);

  const openCreateForm = () => {
    setShowCreateForm(true);
    setClientDropdownOpen(false);
    loadClients();
    loadCoaches();
    loadStations();
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
  const EVENT_TYPES = ["Outdoor run", "Gym", "Yoga", "Swimming", "Hiking", "Cycling", "CrossFit", "Pilates", "Meditation", "Workshop", "Seminar", "Social", "Nutrition", "Recovery", "Competition", "Special", "Other"];

  const createCommunityEvent = async () => {
    if (!newEvent.name.trim() || !newEvent.date.trim()) return;
    setCreatingEvent(true);
    try {
      const { error } = await supabase.from("community_events").insert({
        name: newEvent.name,
        type: newEvent.type,
        date: newEvent.date,
        time: newEvent.time || "09:00",
        location: newEvent.location || null,
        location_lat: newEvent.location_lat,
        location_lng: newEvent.location_lng,
        description: newEvent.description || null,
        image_url: newEvent.image_url || null,
        cost: newEvent.cost || "Free",
        reward: newEvent.reward || null,
        max_participants: newEvent.max_participants ? parseInt(newEvent.max_participants) : null,
        staff_created: true,
        creator_id: null,
      });
      if (error) { alert(`Failed: ${error.message}`); return; }
      alert(`Event "${newEvent.name}" created!`);
      setNewEvent({ name: "", date: "", time: "09:00", location: "", location_lat: null, location_lng: null, description: "", type: "Outdoor run", cost: "Free", reward: "", max_participants: "", image_url: "" });
      setShowEventForm(false);
      loadCommunityEvents();
    } catch { alert("Failed to create event"); }
    setCreatingEvent(false);
  };

  const saveEventEdit = async () => {
    if (!editingEventId) return;
    try {
      const { error } = await supabase.from("community_events").update({
        name: editEvent.name,
        type: editEvent.type,
        date: editEvent.date,
        time: editEvent.time,
        location: editEvent.location || null,
        location_lat: editEvent.location_lat,
        location_lng: editEvent.location_lng,
        description: editEvent.description || null,
        image_url: editEvent.image_url || null,
        cost: editEvent.cost || "Free",
        reward: editEvent.reward || null,
        max_participants: editEvent.max_participants ? parseInt(editEvent.max_participants) : null,
      }).eq("id", editingEventId);
      if (error) { alert(`Failed: ${error.message}`); return; }
      setEditingEventId(null);
      loadCommunityEvents();
    } catch { alert("Failed to save"); }
  };

  const uploadEventImage = async (file: File, eventId: string): Promise<string | null> => {
    setUploadingEventImg(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `event-${eventId}.${ext}`;
      await supabase.storage.from("event-images").remove([path]);
      const { error } = await supabase.storage.from("event-images").upload(path, file, { upsert: true, contentType: file.type });
      if (error) { alert(`Upload failed: ${error.message}`); return null; }
      const { data } = supabase.storage.from("event-images").getPublicUrl(path);
      return data.publicUrl + "?t=" + Date.now();
    } catch { return null; }
    finally { setUploadingEventImg(false); }
  };

  const totalCount = filtered.length;

  const filterTabs: { key: FilterTab; label: string; color: string }[] = [
    { key: "all", label: "All", color: "bg-gray-600" },
    { key: "events", label: "Events", color: "bg-cyan-500" },
    { key: "measurement", label: "Measurements", color: "bg-emerald-500" },
    { key: "blood-test", label: "Blood Tests", color: "bg-blue-500" },
    { key: "consultation", label: "Consultations", color: "bg-purple-500" },
    { key: "slots" as FilterTab, label: "Available Slots", color: "bg-teal-500" },
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
          onClick={() => setShowEventForm(!showEventForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Create Event
        </button>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-lg text-sm font-medium hover:bg-[#047857] transition-colors"
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

      {/* Upcoming client bookings from station_slots / doctor_slots —
          these don't live in the legacy `appointments` table this page
          was built around. Without this section, admins only see them
          in the Doctor Appointments / Measurement Appointments sub-tabs. */}
      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Upcoming client bookings</h3>
            <p className="text-[11.5px] text-gray-500 mt-0.5">
              Clients who have booked a measurement or doctor consultation. Live from station_slots + doctor_slots.
            </p>
          </div>
          <button
            onClick={loadClientBookings}
            disabled={clientBookingsLoading}
            className="text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50"
            title="Refresh"
          >
            {clientBookingsLoading ? "…" : "Refresh"}
          </button>
        </div>
        {clientBookingsLoading ? (
          <div className="p-4 text-xs text-gray-400">Loading…</div>
        ) : clientBookings.length === 0 ? (
          <div className="p-4 text-xs text-gray-400">No upcoming client bookings.</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {clientBookings.slice(0, 20).map((b) => {
              const when = new Date(b.slot_at);
              const dayLabel = when.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Atlantic/Reykjavik" });
              const timeLabel = when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Atlantic/Reykjavik" });
              const modeLabel = b.kind === "consultation"
                ? (b.mode === "video" ? "Video" : b.mode === "phone" ? "Phone" : b.mode === "in_person" ? "In person" : "Consultation")
                : "Station measurement";
              const accent = b.kind === "measurement" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-violet-50 text-violet-700 border-violet-100";
              return (
                <li key={`${b.kind}-${b.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="shrink-0 w-20 text-xs text-gray-500 font-medium tabular-nums">{dayLabel}</div>
                  <div className="shrink-0 w-14 text-xs font-semibold text-gray-800 tabular-nums">{timeLabel}</div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-gray-900">{b.client_name || b.client_email || "—"}</div>
                    <div className="truncate text-[11px] text-gray-500">{modeLabel}{b.location ? ` · ${b.location}` : ""}</div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${accent}`}>
                    {b.kind === "measurement" ? "Measurement" : "Doctor"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {clientBookings.length > 20 && (
          <div className="px-4 py-2 text-[11px] text-gray-500 border-t border-gray-100">
            Showing 20 of {clientBookings.length}. Full list in the Doctor / Measurement tabs.
          </div>
        )}
      </section>

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
              {/* Client search dropdown */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                <input
                  type="text"
                  placeholder="Start typing to search clients..."
                  value={clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); setClientDropdownOpen(true); if (!e.target.value.trim()) setNewApt((p) => ({ ...p, clientId: "" })); }}
                  onFocus={() => setClientDropdownOpen(true)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] ${newApt.clientId ? "border-[#10B981] bg-[#10B981]/5" : "border-gray-200"}`}
                />
                {newApt.clientId && <span className="absolute right-3 top-[34px] text-[#10B981]"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></span>}
                {clientDropdownOpen && clientSearch.trim().length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredClients.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">No clients found</div>
                    ) : (
                      filteredClients.slice(0, 8).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setNewApt((p) => ({ ...p, clientId: c.id })); setClientSearch(c.name); setClientDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 ${newApt.clientId === c.id ? "bg-[#10B981]/5 font-medium" : ""}`}
                        >
                          <span className="font-medium text-[#1F2937]">{c.name}</span>
                          <span className="text-gray-400 text-xs ml-2">{c.email}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={newApt.date}
                    onChange={(e) => setNewApt((p) => ({ ...p, date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B981]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                  <input
                    type="time"
                    value={newApt.time}
                    onChange={(e) => setNewApt((p) => ({ ...p, time: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B981]/30"
                  />
                </div>
              </div>

              {/* Station dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Station</label>
                <select
                  value={newApt.stationName}
                  onChange={(e) => setNewApt((p) => ({ ...p, stationName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 text-gray-900 bg-white"
                >
                  <option value="">Select station...</option>
                  {stations.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="__custom">+ Add new station</option>
                </select>
                {newApt.stationName === "__custom" && (
                  <input
                    type="text"
                    placeholder="Enter new station name"
                    onChange={(e) => setNewApt((p) => ({ ...p, stationName: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B981]/30"
                    autoFocus
                  />
                )}
              </div>

              {/* Coach dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Coach</label>
                <select
                  value={newApt.coachName}
                  onChange={(e) => setNewApt((p) => ({ ...p, coachName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 text-gray-900 bg-white"
                >
                  <option value="">Select coach...</option>
                  {coaches.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <button
                onClick={handleCreateAppointment}
                disabled={!newApt.clientId || !newApt.date || creating}
                className="w-full py-2.5 bg-[#10B981] text-white rounded-lg font-medium text-sm hover:bg-[#047857] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Booking..." : "Book Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create community event form */}
      {showEventForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Create Community Event
            </h3>
            <button onClick={() => setShowEventForm(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Event name *</label>
              <input type="text" value={newEvent.name} onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })} placeholder="e.g. Morning yoga session" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={newEvent.type} onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none">
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
              <input type="time" value={newEvent.time} onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <AdminLocationPicker value={newEvent.location} onChange={(loc, lat, lng) => setNewEvent({ ...newEvent, location: loc, location_lat: lat ?? null, location_lng: lng ?? null })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cost</label>
              <input type="text" value={newEvent.cost} onChange={(e) => setNewEvent({ ...newEvent, cost: e.target.value })} placeholder="Free" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reward</label>
              <input type="text" value={newEvent.reward} onChange={(e) => setNewEvent({ ...newEvent, reward: e.target.value })} placeholder="e.g. +10 pts" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max participants</label>
              <input type="number" value={newEvent.max_participants} onChange={(e) => setNewEvent({ ...newEvent, max_participants: e.target.value })} placeholder="Unlimited" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} placeholder="Event description..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none resize-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Event Image</label>
              <div className="flex items-center gap-3">
                {newEvent.image_url && <img src={newEvent.image_url} alt="" className="w-16 h-10 rounded object-cover border" />}
                <input type="text" value={newEvent.image_url} onChange={(e) => setNewEvent({ ...newEvent, image_url: e.target.value })} placeholder="Paste image URL or upload..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                <label className="cursor-pointer px-3 py-2 text-xs font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors whitespace-nowrap">
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const url = await uploadEventImage(file, "new-" + Date.now());
                    if (url) setNewEvent({ ...newEvent, image_url: url });
                    e.target.value = "";
                  }} />
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowEventForm(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={createCommunityEvent} disabled={creatingEvent || !newEvent.name.trim() || !newEvent.date.trim()} className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50">
              {creatingEvent ? "Creating..." : "Create Event"}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          const count =
            tab.key === "all"
              ? appointments.length + communityEvents.length + availableSlots.length
              : tab.key === "events"
              ? communityEvents.length
              : tab.key === "slots"
              ? availableSlots.length
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
              ? "bg-[#10B981] text-white"
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10B981]" />
        </div>
      )}

      {/* Community Events */}
      {(activeFilter === "all" || activeFilter === "events") && communityEvents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Community Events</h3>
          <div className="space-y-2">
            {communityEvents.map((evt) => {
              const isPast = new Date(evt.date) < new Date(new Date().toDateString());
              const isEditing = editingEventId === evt.id;
              return (
                <div key={evt.id} className={`bg-white rounded-xl border shadow-sm ${isPast ? "opacity-50 border-gray-200" : "border-cyan-200"} ${evt.cancelled ? "border-red-200 bg-red-50/30" : ""}`}>
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-1 self-stretch rounded-full bg-cyan-500" />
                    {evt.image_url && <img src={evt.image_url} alt="" className="w-14 h-14 rounded-lg object-cover" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{evt.name}</span>
                        <span className="text-[10px] font-medium text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded">{evt.type}</span>
                        {evt.cancelled && <span className="text-[10px] font-medium text-red-700 bg-red-50 px-1.5 py-0.5 rounded">Cancelled</span>}
                        {isPast && !evt.cancelled && <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Past</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-gray-500">{new Date(evt.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at {evt.time}</span>
                        {evt.location && <span className="text-xs text-gray-400">{evt.location}</span>}
                        {evt.reward && <span className="text-xs text-emerald-600 font-medium">{evt.reward}</span>}
                        {evt.max_participants && <span className="text-xs text-gray-400">Max {evt.max_participants}</span>}
                      </div>
                      {evt.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{evt.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingEventId(isEditing ? null : evt.id); setEditEvent({ name: evt.name, date: evt.date, time: evt.time, location: evt.location || "", location_lat: (evt as any).location_lat ?? null, location_lng: (evt as any).location_lng ?? null, description: evt.description || "", type: evt.type, cost: evt.cost || "Free", reward: evt.reward || "", max_participants: evt.max_participants ? String(evt.max_participants) : "", image_url: evt.image_url || "" }); }} className="p-1.5 rounded hover:bg-cyan-50 text-gray-300 hover:text-cyan-600 transition-colors" title="Edit">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={async () => { if (!confirm(`Cancel "${evt.name}"?`)) return; await supabase.from("community_events").update({ cancelled: true, cancel_reason: "Cancelled by admin" }).eq("id", evt.id); loadCommunityEvents(); }} className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" title="Cancel">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <button onClick={async () => { if (!confirm(`Delete "${evt.name}" permanently?`)) return; await supabase.from("community_events").delete().eq("id", evt.id); loadCommunityEvents(); }} className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" title="Delete">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                  {/* Edit form */}
                  {isEditing && (
                    <div className="border-t border-gray-100 p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Name</label>
                          <input type="text" value={editEvent.name} onChange={(e) => setEditEvent({ ...editEvent, name: e.target.value })} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Type</label>
                          <select value={editEvent.type} onChange={(e) => setEditEvent({ ...editEvent, type: e.target.value })} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none">
                            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Date</label>
                          <input type="date" value={editEvent.date} onChange={(e) => setEditEvent({ ...editEvent, date: e.target.value })} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Time</label>
                          <input type="time" value={editEvent.time} onChange={(e) => setEditEvent({ ...editEvent, time: e.target.value })} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Location</label>
                          <AdminLocationPicker value={editEvent.location} onChange={(loc, lat, lng) => setEditEvent({ ...editEvent, location: loc, location_lat: lat ?? null, location_lng: lng ?? null })} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Cost</label>
                          <input type="text" value={editEvent.cost} onChange={(e) => setEditEvent({ ...editEvent, cost: e.target.value })} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Reward</label>
                          <input type="text" value={editEvent.reward} onChange={(e) => setEditEvent({ ...editEvent, reward: e.target.value })} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Max participants</label>
                          <input type="number" value={editEvent.max_participants} onChange={(e) => setEditEvent({ ...editEvent, max_participants: e.target.value })} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Description</label>
                          <textarea value={editEvent.description} onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })} rows={2} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none resize-none" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Event Image</label>
                          <div className="flex items-center gap-3">
                            {editEvent.image_url && <img src={editEvent.image_url} alt="" className="w-16 h-10 rounded object-cover border" />}
                            <input type="text" value={editEvent.image_url} onChange={(e) => setEditEvent({ ...editEvent, image_url: e.target.value })} placeholder="Paste URL or upload..." className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 outline-none" />
                            <label className={`cursor-pointer px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors whitespace-nowrap ${uploadingEventImg ? "opacity-50" : ""}`}>
                              {uploadingEventImg ? "..." : "Upload"}
                              <input type="file" accept="image/*" className="hidden" disabled={uploadingEventImg} onChange={async (e) => {
                                const file = e.target.files?.[0]; if (!file) return;
                                const url = await uploadEventImage(file, evt.id);
                                if (url) setEditEvent({ ...editEvent, image_url: url });
                                e.target.value = "";
                              }} />
                            </label>
                            {editEvent.image_url && <button onClick={() => setEditEvent({ ...editEvent, image_url: "" })} className="text-[10px] text-red-400 hover:text-red-600">Remove</button>}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 mt-3">
                        <button onClick={() => setEditingEventId(null)} className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                        <button onClick={saveEventEdit} className="px-3 py-1.5 text-xs font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700">Save</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Slots Section */}
      {(activeFilter === "all" || activeFilter === "slots") && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Available Slots</h3>
            <button
              onClick={() => setShowSlotForm(!showSlotForm)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create Slot
            </button>
          </div>

          {/* Create slot form */}
          {showSlotForm && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Create Available Slot
                </h3>
                <button onClick={() => setShowSlotForm(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Appointment type *</label>
                  <select value={newSlot.appointment_type} onChange={(e) => setNewSlot({ ...newSlot, appointment_type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                    <option value="body_composition">Body Composition</option>
                    <option value="health_assessment">Health Assessment</option>
                    <option value="coach_consultation">Coach Consultation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Single date</label>
                  <input type="date" value={newSlot.date} onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Start time *</label>
                  <select value={newSlot.start_time} onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                    {Array.from({ length: 19 }, (_, i) => { const h = Math.floor(i / 2) + 8; const m = i % 2 === 0 ? "00" : "30"; return `${String(h).padStart(2, "0")}:${m}`; }).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">End time *</label>
                  <select value={newSlot.end_time} onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none">
                    {Array.from({ length: 19 }, (_, i) => { const h = Math.floor(i / 2) + 8; const m = i % 2 === 0 ? "00" : "30"; return `${String(h).padStart(2, "0")}:${m}`; }).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Station / Location</label>
                  <input type="text" value={newSlot.station} onChange={(e) => setNewSlot({ ...newSlot, station: e.target.value })} placeholder="e.g. Room A, Clinic 2" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Provider name</label>
                  <input type="text" value={newSlot.provider_name} onChange={(e) => setNewSlot({ ...newSlot, provider_name: e.target.value })} placeholder="e.g. Dr. Smith" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Max bookings</label>
                  <input type="number" min="1" value={newSlot.max_bookings} onChange={(e) => setNewSlot({ ...newSlot, max_bookings: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input type="text" value={newSlot.notes} onChange={(e) => setNewSlot({ ...newSlot, notes: e.target.value })} placeholder="Optional notes" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
                </div>

                {/* Bulk date selection */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-2">Select multiple dates (next 6 months)</label>
                  <div className="grid grid-cols-7 gap-1.5 max-h-64 overflow-y-auto">
                    {Array.from({ length: 180 }, (_, i) => {
                      const d = new Date(); d.setDate(d.getDate() + i + 1);
                      const iso = d.toISOString().split("T")[0];
                      const dayName = d.toLocaleDateString("en-GB", { weekday: "short" });
                      const dayNum = d.getDate();
                      const mon = d.toLocaleDateString("en-GB", { month: "short" });
                      const isSelected = bulkSlotDays.includes(iso);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <button key={iso} type="button" onClick={() => setBulkSlotDays(prev => prev.includes(iso) ? prev.filter(x => x !== iso) : [...prev, iso])}
                          className={`p-1.5 rounded-lg text-center text-[11px] leading-tight border transition-colors ${isSelected ? "bg-teal-600 text-white border-teal-600" : isWeekend ? "bg-gray-50 text-gray-400 border-gray-200 hover:bg-teal-50" : "bg-white text-gray-700 border-gray-200 hover:bg-teal-50"}`}>
                          <div className="font-medium">{dayName}</div>
                          <div>{dayNum} {mon}</div>
                        </button>
                      );
                    })}
                  </div>
                  {bulkSlotDays.length > 0 && <p className="text-xs text-teal-600 mt-1 font-medium">{bulkSlotDays.length} date{bulkSlotDays.length !== 1 ? "s" : ""} selected</p>}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => { setShowSlotForm(false); setBulkSlotDays([]); }} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                <button
                  disabled={creatingSlot || (!newSlot.date && bulkSlotDays.length === 0)}
                  onClick={async () => {
                    setCreatingSlot(true);
                    try {
                      const dates = bulkSlotDays.length > 0 ? bulkSlotDays : newSlot.date ? [newSlot.date] : [];
                      if (dates.length === 0) return;
                      const rows = dates.map(d => ({
                        appointment_type: newSlot.appointment_type,
                        date: d,
                        start_time: newSlot.start_time,
                        end_time: newSlot.end_time,
                        station: newSlot.station || null,
                        provider_name: newSlot.provider_name || null,
                        max_bookings: parseInt(newSlot.max_bookings) || 1,
                        current_bookings: 0,
                        status: "open",
                        notes: newSlot.notes || null,
                      }));
                      const { error } = await supabase.from("available_slots").insert(rows);
                      if (error) { alert(`Failed: ${error.message}`); return; }
                      alert(`Created ${rows.length} slot${rows.length !== 1 ? "s" : ""}!`);
                      setNewSlot({ appointment_type: 'body_composition', date: '', start_time: '09:00', end_time: '09:30', station: '', provider_name: '', max_bookings: '1', notes: '' });
                      setBulkSlotDays([]);
                      setShowSlotForm(false);
                      loadSlots();
                    } catch { alert("Failed to create slot"); }
                    setCreatingSlot(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {creatingSlot ? "Creating..." : `Create ${bulkSlotDays.length > 1 ? bulkSlotDays.length + " Slots" : "Slot"}`}
                </button>
              </div>
            </div>
          )}

          {/* Slots list grouped by date */}
          {slotsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500" />
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500 font-medium">No available slots</p>
              <p className="text-gray-400 text-sm mt-1">Create slots using the button above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(
                availableSlots.reduce<Record<string, typeof availableSlots>>((acc, slot) => {
                  const key = slot.date;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(slot);
                  return acc;
                }, {})
              ).map(([date, slots]) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    {new Date(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <div className="space-y-2">
                    {slots.map((slot: any) => {
                      const borderColor = slot.appointment_type === "body_composition" ? "bg-teal-500" : slot.appointment_type === "health_assessment" ? "bg-emerald-500" : "bg-purple-500";
                      const typeBg = slot.appointment_type === "body_composition" ? "bg-teal-50 text-teal-700" : slot.appointment_type === "health_assessment" ? "bg-emerald-50 text-emerald-700" : "bg-purple-50 text-purple-700";
                      const typeLabel = slot.appointment_type === "body_composition" ? "Body Composition" : slot.appointment_type === "health_assessment" ? "Health Assessment" : "Coach Consultation";
                      const isFull = slot.current_bookings >= slot.max_bookings;
                      const isCancelled = slot.status === "cancelled";
                      return (
                        <div key={slot.id} className={`bg-white rounded-xl border shadow-sm ${isCancelled ? "border-red-200 bg-red-50/30 opacity-60" : isFull ? "border-amber-200" : "border-gray-200"}`}>
                          <div className="flex items-center gap-3 p-4">
                            <div className={`w-1 self-stretch rounded-full ${borderColor}`} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${typeBg}`}>{typeLabel}</span>
                                {isCancelled && <span className="text-[10px] font-medium text-red-700 bg-red-50 px-1.5 py-0.5 rounded">Cancelled</span>}
                                {isFull && !isCancelled && <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Full</span>}
                                {!isFull && !isCancelled && <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">Open</span>}
                              </div>
                              <div className="flex items-center gap-4 mt-1 flex-wrap">
                                {slot.station && <span className="text-xs text-gray-500">{slot.station}</span>}
                                {slot.provider_name && <span className="text-xs text-gray-400">{slot.provider_name}</span>}
                                <span className="text-xs text-gray-400">
                                  Bookings: <span className={`font-medium ${isFull ? "text-amber-600" : "text-gray-700"}`}>{slot.current_bookings || 0}</span>/{slot.max_bookings}
                                </span>
                                {/* Progress bar */}
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${isFull ? "bg-amber-500" : "bg-teal-500"}`} style={{ width: `${Math.min(100, ((slot.current_bookings || 0) / slot.max_bookings) * 100)}%` }} />
                                </div>
                              </div>
                              {slot.notes && <p className="text-xs text-gray-400 mt-1">{slot.notes}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              {!isCancelled && (
                                <button onClick={async () => { if (!confirm("Cancel this slot?")) return; await supabase.from("available_slots").update({ status: "cancelled" }).eq("id", slot.id); loadSlots(); }} className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" title="Cancel">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              )}
                              <button onClick={async () => { if (!confirm("Delete this slot permanently?")) return; await supabase.from("available_slots").delete().eq("id", slot.id); loadSlots(); }} className="p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" title="Delete">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && activeFilter === "events" && communityEvents.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 font-medium">No community events</p>
          <p className="text-gray-400 text-sm mt-1">Create an event using the button above.</p>
        </div>
      )}
      {!loading && !error && activeFilter === "slots" && availableSlots.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 font-medium">No available slots</p>
          <p className="text-gray-400 text-sm mt-1">Create slots using the button above.</p>
        </div>
      )}
      {!loading && !error && activeFilter !== "events" && activeFilter !== "slots" && totalCount === 0 && (
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
      {!loading && activeFilter !== "events" && activeFilter !== "slots" &&
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981] text-white text-sm font-medium rounded-lg hover:bg-[#047857] transition-colors"
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
