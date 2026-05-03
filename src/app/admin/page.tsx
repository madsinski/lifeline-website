"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BiodySyncStatus from "./components/BiodySyncStatus";
import { pickStaffGreeting, type GreetingRole } from "@/lib/staff-greetings";

// ─── Pricing (ISK per month) ──────────────────────────────────
const TIER_PRICES: Record<string, number> = {
  "free-trial": 0,
  "self-maintained": 9900,
  "premium": 29900,
};

const TIER_LABELS: Record<string, string> = {
  "free-trial": "Free Plan",
  "self-maintained": "Self-Maintained",
  "premium": "Premium",
};

// ─── Types ────────────────────────────────────────────────────

interface TrialAlert {
  name: string;
  email: string;
  trialEndsAt: string;
  daysRemaining: number;
}

interface DashboardStats {
  totalClients: number;
  freeTrialCount: number;
  selfMaintainedCount: number;
  fullAccessCount: number;
  noSubCount: number;
  prevTotalClients: number;
  prevFreeTrialCount: number;
  prevSelfMaintainedCount: number;
  prevFullAccessCount: number;
  estimatedMRR: number;
  prevMRR: number;
  trialAlerts: TrialAlert[];
  recentClients: {
    name: string;
    email: string;
    tier: string;
    joined: string;
    type: string;
  }[];
}

const quickActions = [
  { href: "/admin/messages", label: "Messages", desc: "View and respond to client messages", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z", color: "bg-teal-50 text-teal-600" },
  { href: "/admin/programs", label: "Add New Program", desc: "Create a new coaching program", icon: "M12 4v16m8-8H4", color: "bg-blue-50 text-blue-600" },
  { href: "/admin/education", label: "Add New Course", desc: "Create a new education course", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", color: "bg-purple-50 text-purple-600" },
  { href: "/admin/clients", label: "View All Clients", desc: "Browse and manage client list", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", color: "bg-green-50 text-green-600" },
  { href: "/admin/analytics", label: "View Analytics", desc: "Detailed statistics and reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", color: "bg-amber-50 text-amber-600" },
];

function activityIcon(type: string) {
  switch (type) {
    case "sign-up":
      return (
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
      );
    case "subscription":
      return (
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      );
  }
}

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
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toISOString().split("T")[0];
}

function formatISK(amount: number): string {
  return amount.toLocaleString("is-IS") + " ISK";
}

function TrendArrow({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-gray-400">--</span>;
  if (previous === 0 && current > 0) return <span className="text-xs text-green-500 font-medium flex items-center gap-0.5">New</span>;
  const diff = current - previous;
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : 0;
  if (diff > 0) {
    return (
      <span className="text-xs text-green-500 font-medium flex items-center gap-0.5">
        <span className="text-green-500">&#8593;</span> +{pct}%
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="text-xs text-red-500 font-medium flex items-center gap-0.5">
        <span className="text-red-500">&#8595;</span> {pct}%
      </span>
    );
  }
  return <span className="text-xs text-gray-400">0%</span>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    freeTrialCount: 0,
    selfMaintainedCount: 0,
    fullAccessCount: 0,
    noSubCount: 0,
    prevTotalClients: 0,
    prevFreeTrialCount: 0,
    prevSelfMaintainedCount: 0,
    prevFullAccessCount: 0,
    estimatedMRR: 0,
    prevMRR: 0,
    trialAlerts: [],
    recentClients: [],
  });
  const [loading, setLoading] = useState(true);
  const [supabaseStatus, setSupabaseStatus] = useState<"connected" | "error" | "checking">("checking");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [brandTheme, setBrandTheme] = useState<"rebrand" | "classic">("rebrand");
  const [staffRole, setStaffRole] = useState<GreetingRole | null>(null);
  const [staffFirstName, setStaffFirstName] = useState<string | null>(null);
  const staffGreeting = useMemo(
    () => (staffRole ? pickStaffGreeting(staffRole, staffFirstName) : null),
    [staffRole, staffFirstName],
  );

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data } = await supabase
        .from("staff")
        .select("role, name")
        .eq("email", user.email)
        .eq("active", true)
        .maybeSingle();
      if (!data) return;
      const r = (data.role as GreetingRole | undefined) || null;
      if (r === "admin" || r === "coach" || r === "doctor" || r === "nurse" || r === "psychologist") {
        setStaffRole(r);
      }
      const first = ((data as { name?: string | null }).name || "").trim().split(/\s+/)[0] || null;
      setStaffFirstName(first);
    })();
  }, []);

  // Load and apply brand theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("ll-brand-theme");
    if (saved === "classic") {
      setBrandTheme("classic");
      document.documentElement.dataset.theme = "classic";
    } else {
      setBrandTheme("rebrand");
      delete document.documentElement.dataset.theme;
    }
  }, []);

  const toggleBrandTheme = useMemo(() => () => {
    setBrandTheme((prev) => {
      const next = prev === "rebrand" ? "classic" : "rebrand";
      if (next === "classic") {
        document.documentElement.dataset.theme = "classic";
        localStorage.setItem("ll-brand-theme", "classic");
      } else {
        delete document.documentElement.dataset.theme;
        localStorage.setItem("ll-brand-theme", "rebrand");
      }
      return next;
    });
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setSupabaseStatus("checking");

    try {
      const { data: clients, error } = await supabase
        .from("clients_decrypted")
        .select("*, subscriptions(*)")
        .order("created_at", { ascending: false });

      if (error) {
        setSupabaseStatus("error");
      } else {
        setSupabaseStatus("connected");
      }

      if (clients && clients.length > 0) {
        let freeTrial = 0, selfMaintained = 0, fullAccess = 0, noSub = 0;
        let mrr = 0;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let prevFreeTrial = 0, prevSelfMaintained = 0, prevFullAccess = 0, prevTotal = 0;
        let prevMRR = 0;

        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        const trialAlerts: TrialAlert[] = [];

        for (const c of clients) {
          // Find the active subscription (most recent)
          const activeSub = c.subscriptions?.find(
            (s: { status: string }) => s.status === "active"
          ) ?? c.subscriptions?.[0];

          const tier = activeSub?.tier;
          const createdAt = new Date(c.created_at);

          if (tier === "free-trial") {
            freeTrial++;
            // Check for trial expiring within 7 days
            if (activeSub?.trial_ends_at) {
              const trialEnd = new Date(activeSub.trial_ends_at);
              if (trialEnd >= now && trialEnd <= sevenDaysFromNow) {
                const daysRemaining = Math.ceil(
                  (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                );
                trialAlerts.push({
                  name: c.full_name || c.email,
                  email: c.email,
                  trialEndsAt: trialEnd.toISOString().split("T")[0],
                  daysRemaining,
                });
              }
            }
          } else if (tier === "self-maintained") {
            selfMaintained++;
            mrr += TIER_PRICES["self-maintained"];
          } else if (tier === "premium") {
            fullAccess++;
            mrr += TIER_PRICES["premium"];
          } else {
            noSub++;
          }

          // Previous period counts (clients from 30+ days ago)
          if (createdAt < thirtyDaysAgo) {
            prevTotal++;
            if (tier === "free-trial") prevFreeTrial++;
            else if (tier === "self-maintained") {
              prevSelfMaintained++;
              prevMRR += TIER_PRICES["self-maintained"];
            } else if (tier === "premium") {
              prevFullAccess++;
              prevMRR += TIER_PRICES["premium"];
            }
          }
        }

        // Sort trial alerts by days remaining (most urgent first)
        trialAlerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

        const recentActivity = clients.slice(0, 10).map((c) => {
          const activeSub = c.subscriptions?.find(
            (s: { status: string }) => s.status === "active"
          );
          return {
            name: c.full_name || c.email,
            email: c.email,
            tier: activeSub?.tier
              ? (TIER_LABELS[activeSub.tier as string] || activeSub.tier)
              : "No subscription",
            joined: c.created_at,
            type: activeSub?.tier ? "subscription" : "sign-up",
          };
        });

        setStats({
          totalClients: clients.length,
          freeTrialCount: freeTrial,
          selfMaintainedCount: selfMaintained,
          fullAccessCount: fullAccess,
          noSubCount: noSub,
          prevTotalClients: prevTotal,
          prevFreeTrialCount: prevFreeTrial,
          prevSelfMaintainedCount: prevSelfMaintained,
          prevFullAccessCount: prevFullAccess,
          estimatedMRR: mrr,
          prevMRR,
          trialAlerts,
          recentClients: recentActivity,
        });
      } else {
        setSupabaseStatus("connected");
      }

      setLastSync(new Date().toLocaleTimeString());
    } catch {
      setSupabaseStatus("error");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = [
    { label: "Total Clients", value: stats.totalClients, prev: stats.prevTotalClients, color: "border-l-4 border-l-[#10B981]" },
    { label: "Free Plan", value: stats.freeTrialCount, prev: stats.prevFreeTrialCount, color: "border-l-4 border-l-gray-400" },
    { label: "Self-Maintained", value: stats.selfMaintainedCount, prev: stats.prevSelfMaintainedCount, color: "border-l-4 border-l-blue-500" },
    { label: "Premium", value: stats.fullAccessCount, prev: stats.prevFullAccessCount, color: "border-l-4 border-l-emerald-500" },
  ];

  return (
    <div className="space-y-6">
      {staffGreeting && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-5 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" />
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] leading-tight">{staffGreeting}</h1>
          <p className="text-xs text-gray-500 mt-1">Lifeline Admin · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
      )}

      {/* System Status Bar */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              supabaseStatus === "connected" ? "bg-green-500" : supabaseStatus === "error" ? "bg-red-500" : "bg-yellow-500 animate-pulse"
            }`} />
            <span className="text-sm text-gray-600">
              Supabase: <span className="font-medium">{supabaseStatus === "connected" ? "Connected" : supabaseStatus === "error" ? "Connection Error" : "Checking..."}</span>
            </span>
          </div>
          {lastSync && (
            <span className="text-xs text-gray-400">Last synced: {lastSync}</span>
          )}
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 font-medium transition-colors disabled:opacity-50"
        >
          {loading ? "Syncing..." : "Refresh"}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 ${stat.color}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <TrendArrow current={stat.value} previous={stat.prev} />
            </div>
            <p className="text-2xl font-bold text-[#1F2937]">
              {loading ? (
                <span className="inline-block w-8 h-6 bg-gray-100 rounded animate-pulse" />
              ) : (
                stat.value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Revenue Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-[#10B981]">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-500">Estimated MRR</p>
            <TrendArrow current={stats.estimatedMRR} previous={stats.prevMRR} />
          </div>
          <p className="text-2xl font-bold text-[#1F2937]">
            {loading ? (
              <span className="inline-block w-24 h-6 bg-gray-100 rounded animate-pulse" />
            ) : (
              formatISK(stats.estimatedMRR)
            )}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.selfMaintainedCount} x {formatISK(TIER_PRICES["self-maintained"])} + {stats.fullAccessCount} x {formatISK(TIER_PRICES["premium"])}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 border-l-4 border-l-amber-400">
          <p className="text-sm text-gray-500 mb-1">Subscription Breakdown</p>
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Free Plan</span>
              <span className="font-medium text-[#1F2937]">{stats.freeTrialCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Self-Maintained</span>
              <span className="font-medium text-[#1F2937]">{stats.selfMaintainedCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Premium</span>
              <span className="font-medium text-[#1F2937]">{stats.fullAccessCount}</span>
            </div>
            {stats.noSubCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">No Subscription</span>
                <span className="font-medium text-red-500">{stats.noSubCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trial Expiry Alerts */}
      {stats.trialAlerts.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-5 shadow-sm border border-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-sm font-semibold text-amber-800">
              Trial Expiring Soon ({stats.trialAlerts.length} client{stats.trialAlerts.length !== 1 ? "s" : ""})
            </h3>
          </div>
          <div className="space-y-2">
            {stats.trialAlerts.map((alert, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-amber-100">
                <div>
                  <p className="text-sm font-medium text-[#1F2937]">{alert.name}</p>
                  <p className="text-xs text-gray-500">{alert.email}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${alert.daysRemaining <= 2 ? "text-red-600" : "text-amber-600"}`}>
                    {alert.daysRemaining} day{alert.daysRemaining !== 1 ? "s" : ""} left
                  </p>
                  <p className="text-xs text-gray-400">Expires {alert.trialEndsAt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-[#10B981]/30 hover:shadow-md transition-all group flex items-start gap-3"
            >
              <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center flex-shrink-0`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#1F2937] group-hover:text-[#10B981] transition-colors">{action.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#1F2937]">Recent Activity</h2>
            <Link href="/admin/clients" className="text-xs text-[#10B981] hover:underline font-medium">View all</Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1">
                    <div className="w-48 h-4 bg-gray-100 rounded animate-pulse" />
                    <div className="w-24 h-3 bg-gray-100 rounded animate-pulse mt-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats.recentClients.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              No activity yet. Clients will appear here once they register.
            </p>
          ) : (
            <div className="space-y-4">
              {stats.recentClients.map((client, i) => (
                <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  {activityIcon(client.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1F2937]">
                      <span className="font-medium">{client.name}</span>
                      {" "}
                      {client.type === "subscription" ? `subscribed to ${client.tier}` : "signed up"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {timeAgo(client.joined)}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    client.tier === "Premium" ? "bg-emerald-50 text-emerald-600" :
                    client.tier === "Self-Maintained" ? "bg-blue-50 text-blue-600" :
                    client.tier === "Free Plan" ? "bg-gray-100 text-gray-600" :
                    "bg-gray-50 text-gray-400"
                  }`}>
                    {client.tier}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System overview */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">System Overview</h2>
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Database</span>
                <span className={`text-xs font-medium ${supabaseStatus === "connected" ? "text-green-600" : "text-red-500"}`}>
                  {supabaseStatus === "connected" ? "Online" : "Offline"}
                </span>
              </div>
              <p className="text-xs text-gray-400">Supabase PostgreSQL</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Authentication</span>
                <span className="text-xs font-medium text-green-600">Active</span>
              </div>
              <p className="text-xs text-gray-400">Supabase Auth with RLS</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Payments</span>
                <span className="text-xs font-medium text-gray-500">Teya / Rapyd</span>
              </div>
              <p className="text-xs text-gray-400">Webhook-driven subscriptions</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Last Data Sync</span>
                <span className="text-xs font-medium text-gray-500">{lastSync ?? "--"}</span>
              </div>
              <p className="text-xs text-gray-400">Auto-refresh on page load</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Brand Theme</span>
                <span className={`text-xs font-medium ${brandTheme === "rebrand" ? "text-emerald-600" : "text-teal-600"}`}>
                  {brandTheme === "rebrand" ? "Rebrand" : "Classic"}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-400">Switch between classic and rebrand colours</p>
                <button
                  onClick={toggleBrandTheme}
                  className={`relative w-11 h-6 rounded-full transition-colors ${brandTheme === "rebrand" ? "bg-[#10B981]" : "bg-[#0D9488]"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${brandTheme === "rebrand" ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Biody sync status */}
        <BiodySyncStatus />
      </div>
    </div>
  );
}
