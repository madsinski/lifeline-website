"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────

interface ClientSummary {
  id: string;
  name: string;
  email: string;
  tier: string;
  programsActivated: boolean;
  lastActive: string;
  trialEndsAt: string | null;
}

interface AppointmentRow {
  id: string;
  client_id: string;
  type: string;
  date: string;
  time: string;
  station_name: string | null;
  coach_name: string | null;
  status: string;
  clients: { full_name: string; email: string } | null;
}

interface ConversationRow {
  id: string;
  client_id: string;
  coach_name: string;
  created_at: string;
  messages: { content: string; created_at: string; read: boolean; sender_role: string }[];
}

interface ProgramStat {
  category: string;
  programName: string;
  activeClients: number;
}

// ─── Helpers ─────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const typeColors: Record<string, string> = {
  measurement: "bg-emerald-100 text-emerald-700",
  "blood-test": "bg-blue-100 text-blue-700",
  consultation: "bg-purple-100 text-purple-700",
};

const typeLabels: Record<string, string> = {
  measurement: "Measurements",
  "blood-test": "Blood Test",
  consultation: "Consultation",
};

const tierColors: Record<string, string> = {
  "free-trial": "bg-gray-100 text-gray-600",
  "self-maintained": "bg-blue-100 text-blue-700",
  "premium": "bg-emerald-100 text-emerald-700",
  none: "bg-gray-50 text-gray-400",
};

const tierLabels: Record<string, string> = {
  "free-trial": "Free",
  "self-maintained": "Self",
  "premium": "Premium",
  none: "None",
};

// ─── Component ───────────────────────────────────────────────

export default function CoachDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"overview" | "clients" | "programs" | "calendar" | "messages">("overview");

  // Data
  const [unreadCount, setUnreadCount] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState<AppointmentRow[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentRow[]>([]);
  const [recentConversations, setRecentConversations] = useState<ConversationRow[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [programStats, setProgramStats] = useState<ProgramStat[]>([]);
  const [trialExpiring, setTrialExpiring] = useState<ClientSummary[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [activePrograms, setActivePrograms] = useState(0);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel fetch all data
      const [clientsRes, apptsRes, convsRes, programsRes] = await Promise.all([
        supabase.from("clients").select("*, subscriptions(tier, status, trial_ends_at)").order("created_at", { ascending: false }),
        supabase.from("appointments").select("*, clients(full_name, email)").eq("status", "booked").order("date", { ascending: true }).order("time", { ascending: true }),
        supabase.from("conversations").select("*, messages(content, created_at, read, sender_role)").or("archived.is.null,archived.eq.false").order("created_at", { ascending: false }).limit(10),
        supabase.from("client_programs").select("category_key, program_key"),
      ]);

      // Process clients
      const clientRows = clientsRes.data || [];
      setTotalClients(clientRows.length);
      const mapped: ClientSummary[] = clientRows.map((c: Record<string, unknown>) => {
        const subs = (c.subscriptions as Record<string, unknown>[]) || [];
        const activeSub = subs.find((s) => (s.status as string) === "active");
        const onb = (c.onboarding_data as Record<string, unknown>) || {};
        return {
          id: c.id as string,
          name: (c.full_name as string) || (c.email as string) || "Unknown",
          email: (c.email as string) || "",
          tier: (activeSub?.tier as string) || "none",
          programsActivated: !!(onb.programsActivated),
          lastActive: (c.updated_at as string) || (c.created_at as string) || "",
          trialEndsAt: (activeSub?.trial_ends_at as string) || null,
        };
      });
      setClients(mapped);

      // Trial expiring (within 7 days)
      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 86400000);
      setTrialExpiring(mapped.filter((c) => {
        if (!c.trialEndsAt || c.tier !== "free-trial") return false;
        const exp = new Date(c.trialEndsAt);
        return exp >= now && exp <= weekLater;
      }));

      // Appointments
      const appts = (apptsRes.data || []) as AppointmentRow[];
      const todayStr = now.toISOString().split("T")[0];
      // Parse appointment dates for comparison
      const parseApptDate = (dateStr: string): string => {
        const MONTHS: Record<string, string> = {
          january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
          july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
        };
        const m = dateStr.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
        if (m) {
          const mo = MONTHS[m[1].toLowerCase()];
          if (mo) return `${m[3]}-${mo}-${m[2].padStart(2, "0")}`;
        }
        return dateStr;
      };

      const todayAppts = appts.filter((a) => parseApptDate(a.date) === todayStr);
      const futureAppts = appts.filter((a) => parseApptDate(a.date) > todayStr).slice(0, 8);
      setTodayAppointments(todayAppts);
      setUpcomingAppointments(futureAppts);

      // Conversations — count unread
      const convRows = (convsRes.data || []) as ConversationRow[];
      setRecentConversations(convRows);
      let unread = 0;
      for (const conv of convRows) {
        unread += (conv.messages || []).filter((m) => !m.read && m.sender_role === "client").length;
      }
      setUnreadCount(unread);

      // Program stats
      const progRows = (programsRes.data || []) as { category_key: string; program_key: string }[];
      setActivePrograms(progRows.length);
      const statMap: Record<string, number> = {};
      for (const p of progRows) {
        const key = `${p.category_key}:${p.program_key}`;
        statMap[key] = (statMap[key] || 0) + 1;
      }
      setProgramStats(
        Object.entries(statMap)
          .map(([key, count]) => {
            const [cat, prog] = key.split(":");
            return { category: cat, programName: prog.replace(/-/g, " "), activeClients: count };
          })
          .sort((a, b) => b.activeClients - a.activeClients)
      );
    } catch (e) {
      console.error("[Coach Dashboard] Load error:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Quick action buttons
  const quickActions = [
    { label: "Messages", icon: "chat", href: "/admin/messages", badge: unreadCount > 0 ? unreadCount : null, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { label: "Calendar", icon: "calendar", href: "/admin/calendar", badge: todayAppointments.length > 0 ? todayAppointments.length : null, color: "bg-blue-50 text-blue-700 border-blue-200" },
    { label: "Programs", icon: "program", href: "/admin/programs", badge: null, color: "bg-purple-50 text-purple-700 border-purple-200" },
    { label: "Education", icon: "education", href: "/admin/education", badge: null, color: "bg-amber-50 text-amber-700 border-amber-200" },
    { label: "Clients", icon: "clients", href: "/admin/clients", badge: null, color: "bg-gray-50 text-gray-700 border-gray-200" },
  ];

  const iconMap: Record<string, React.ReactNode> = {
    chat: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
    calendar: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    program: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    education: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    clients: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937]">Coach Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-5 gap-3">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${action.color}`}
          >
            {iconMap[action.icon]}
            <span className="text-xs font-semibold">{action.label}</span>
            {action.badge && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {action.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Clients</p>
          <p className="text-2xl font-bold text-[#1F2937] mt-1">{totalClients}</p>
          <p className="text-xs text-gray-400 mt-1">{clients.filter((c) => c.tier === "premium").length} full access</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Unread Messages</p>
          <p className="text-2xl font-bold text-[#1F2937] mt-1">{unreadCount}</p>
          <p className="text-xs text-gray-400 mt-1">{recentConversations.length} conversations</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Today&apos;s Appointments</p>
          <p className="text-2xl font-bold text-[#1F2937] mt-1">{todayAppointments.length}</p>
          <p className="text-xs text-gray-400 mt-1">{upcomingAppointments.length} upcoming</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active Programs</p>
          <p className="text-2xl font-bold text-[#1F2937] mt-1">{activePrograms}</p>
          <p className="text-xs text-gray-400 mt-1">{programStats.length} unique programs</p>
        </div>
      </div>

      {/* Main content: 2-column layout */}
      <div className="grid grid-cols-3 gap-6">

        {/* Left column (2/3) */}
        <div className="col-span-2 space-y-6">

          {/* Priority Tasks */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1F2937] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                Priority Tasks
              </h2>
              <span className="text-xs text-gray-400">Action needed</span>
            </div>
            <div className="divide-y divide-gray-50">
              {/* Unread messages */}
              {unreadCount > 0 && (
                <Link href="/admin/messages" className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1F2937]">{unreadCount} unread message{unreadCount > 1 ? "s" : ""}</p>
                    <p className="text-xs text-gray-400">Respond to client messages</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )}

              {/* Today's appointments */}
              {todayAppointments.map((appt) => (
                <Link href="/admin/calendar" key={appt.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1F2937]">
                      {appt.clients?.full_name || "Client"} — {typeLabels[appt.type] || appt.type}
                    </p>
                    <p className="text-xs text-gray-400">{appt.time}{appt.station_name ? ` at ${appt.station_name}` : ""}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColors[appt.type] || "bg-gray-100 text-gray-600"}`}>
                    {appt.time}
                  </span>
                </Link>
              ))}

              {/* Trial expiring */}
              {trialExpiring.map((client) => (
                <Link href="/admin/clients" key={client.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1F2937]">{client.name} — trial expiring</p>
                    <p className="text-xs text-gray-400">
                      Expires {client.trialEndsAt ? new Date(client.trialEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "soon"}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Follow up</span>
                </Link>
              ))}

              {/* Clients without active programs */}
              {clients.filter((c) => c.tier !== "none" && !c.programsActivated).slice(0, 3).map((client) => (
                <div key={client.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1F2937]">{client.name} — no active program</p>
                    <p className="text-xs text-gray-400">Consider reaching out to help them get started</p>
                  </div>
                  <Link href="/admin/messages" className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">
                    Message
                  </Link>
                </div>
              ))}

              {unreadCount === 0 && todayAppointments.length === 0 && trialExpiring.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-gray-400">All caught up! No priority tasks right now.</p>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1F2937]">Upcoming Appointments</h2>
              <Link href="/admin/calendar" className="text-xs font-medium text-[#10B981] hover:underline">View all</Link>
            </div>
            {upcomingAppointments.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-400">No upcoming appointments</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingAppointments.map((appt) => (
                  <div key={appt.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="text-center w-12 flex-shrink-0">
                      <p className="text-[10px] font-medium text-gray-400 uppercase">{formatDate(appt.date)}</p>
                      <p className="text-xs font-bold text-[#1F2937]">{appt.time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1F2937] truncate">{appt.clients?.full_name || "Client"}</p>
                      <p className="text-xs text-gray-400 truncate">{appt.station_name || appt.type}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeColors[appt.type] || "bg-gray-100"}`}>
                      {typeLabels[appt.type] || appt.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Program Overview */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1F2937]">Program Enrollment</h2>
              <Link href="/admin/programs" className="text-xs font-medium text-[#10B981] hover:underline">Edit programs</Link>
            </div>
            {programStats.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-400">No active program enrollments yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {programStats.slice(0, 8).map((stat, i) => {
                  const catColors: Record<string, string> = {
                    exercise: "bg-blue-100 text-blue-700",
                    nutrition: "bg-emerald-100 text-emerald-700",
                    sleep: "bg-purple-100 text-purple-700",
                    mental: "bg-cyan-100 text-cyan-700",
                  };
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${catColors[stat.category] || "bg-gray-100 text-gray-600"}`}>
                        {stat.category}
                      </span>
                      <p className="text-sm text-[#1F2937] flex-1 capitalize">{stat.programName}</p>
                      <p className="text-sm font-bold text-[#1F2937]">{stat.activeClients}</p>
                      <p className="text-xs text-gray-400">client{stat.activeClients !== 1 ? "s" : ""}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">

          {/* Recent Messages */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1F2937]">Recent Messages</h2>
              <Link href="/admin/messages" className="text-xs font-medium text-[#10B981] hover:underline">Open</Link>
            </div>
            {recentConversations.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-gray-400">No conversations yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentConversations.slice(0, 6).map((conv) => {
                  const msgs = conv.messages || [];
                  const sorted = [...msgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  const lastMsg = sorted[0];
                  const unread = msgs.filter((m) => !m.read && m.sender_role === "client").length;
                  return (
                    <Link href="/admin/messages" key={conv.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-500">
                        {(conv.coach_name || "C")[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-xs truncate ${unread > 0 ? "font-bold text-[#1F2937]" : "font-medium text-gray-600"}`}>
                            {conv.coach_name || "Client"}
                          </p>
                          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                            {lastMsg ? timeAgo(lastMsg.created_at) : ""}
                          </span>
                        </div>
                        <p className={`text-[11px] truncate mt-0.5 ${unread > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                          {lastMsg?.content || "No messages"}
                        </p>
                      </div>
                      {unread > 0 && (
                        <span className="w-4 h-4 rounded-full bg-[#10B981] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-1">
                          {unread}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Client List (compact) */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1F2937]">Clients</h2>
              <Link href="/admin/clients" className="text-xs font-medium text-[#10B981] hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {clients.slice(0, 12).map((client) => (
                <div key={client.id} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gray-500">
                    {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#1F2937] truncate">{client.name}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tierColors[client.tier]}`}>
                    {tierLabels[client.tier]}
                  </span>
                  {client.programsActivated && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] flex-shrink-0" title="Program active"></span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-[#1F2937] mb-3">Quick Links</h2>
            <div className="space-y-2">
              {[
                { label: "Create new program", href: "/admin/programs", icon: "+" },
                { label: "Add education course", href: "/admin/education", icon: "+" },
                { label: "Start conversation", href: "/admin/messages", icon: "+" },
                { label: "View analytics", href: "/admin/analytics", icon: ">" },
                { label: "Manage team", href: "/admin/team", icon: ">" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-[#1F2937] transition-colors"
                >
                  <span className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400">
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
