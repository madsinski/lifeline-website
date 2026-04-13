"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const TIER_PRICES: Record<string, number> = {
  "free-trial": 0,
  "self-maintained": 9900,
  "full-access": 29900,
};

const TIER_LABELS: Record<string, string> = {
  "free-trial": "Free Plan",
  "self-maintained": "Self-Maintained",
  "full-access": "Full Access",
};

function formatISK(amount: number) {
  if (amount >= 1000000) return `kr ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `kr ${(amount / 1000).toFixed(0)}k`;
  return `kr ${amount}`;
}

interface Stats {
  totalClients: number;
  tierCounts: Record<string, number>;
  activeRate: number;
  mrr: number;
  totalAppointments: number;
  appointmentsByType: Record<string, number>;
  completionRate: number;
  totalCompletions: number;
  avgCompletionsPerDay: number;
  recentSignups: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch clients with subscriptions
      const { data: clients } = await supabase
        .from("clients")
        .select("id, created_at, subscriptions(tier, status)");

      const allClients = clients ?? [];
      const totalClients = allClients.length;

      // Count by tier
      const tierCounts: Record<string, number> = {
        "free-trial": 0,
        "self-maintained": 0,
        "full-access": 0,
        none: 0,
      };
      let activeCount = 0;
      let recentSignups = 0;
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      for (const c of allClients) {
        const subs = (c.subscriptions as { tier: string; status: string }[]) ?? [];
        const activeSub = subs.find((s) => s.status === "active");
        if (activeSub) {
          tierCounts[activeSub.tier] = (tierCounts[activeSub.tier] || 0) + 1;
          activeCount++;
        } else {
          tierCounts.none++;
        }
        if (new Date(c.created_at) >= sevenDaysAgo) recentSignups++;
      }

      const activeRate = totalClients > 0 ? (activeCount / totalClients) * 100 : 0;
      const mrr =
        (tierCounts["self-maintained"] || 0) * TIER_PRICES["self-maintained"] +
        (tierCounts["full-access"] || 0) * TIER_PRICES["full-access"];

      // Fetch appointments
      const { data: appointments } = await supabase
        .from("appointments")
        .select("type, status");
      const allAppointments = appointments ?? [];
      const appointmentsByType: Record<string, number> = {};
      for (const a of allAppointments) {
        appointmentsByType[a.type] = (appointmentsByType[a.type] || 0) + 1;
      }

      // Fetch action completions (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count: completionCount } = await supabase
        .from("action_completions")
        .select("*", { count: "exact", head: true })
        .gte("date", thirtyDaysAgo.toISOString().split("T")[0]);

      const totalCompletions = completionCount ?? 0;
      const avgCompletionsPerDay = totalCompletions / 30;

      // Completion rate: completions vs total possible (rough: active clients * 3 actions/day * 30 days)
      const possibleActions = activeCount * 3 * 30;
      const completionRate = possibleActions > 0 ? (totalCompletions / possibleActions) * 100 : 0;

      setStats({
        totalClients,
        tierCounts,
        activeRate,
        mrr,
        totalAppointments: allAppointments.length,
        appointmentsByType,
        completionRate: Math.min(completionRate, 100),
        totalCompletions,
        avgCompletionsPerDay,
        recentSignups,
      });
    } catch (e) {
      console.error("[Analytics] Failed to load stats:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10B981]" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">
        Failed to load analytics. Please try refreshing.
      </div>
    );
  }

  const tierEntries = Object.entries(TIER_LABELS).map(([key, label]) => ({
    tier: label,
    key,
    clients: stats.tierCounts[key] || 0,
    pricePerMonth: TIER_PRICES[key],
    mrr: (stats.tierCounts[key] || 0) * TIER_PRICES[key],
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#1F2937]">Analytics</h2>
        <button
          onClick={loadStats}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Client Statistics */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Client Statistics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Clients</p>
            <p className="text-2xl font-bold text-[#1F2937] mt-1">{stats.totalClients}</p>
          </div>
          {Object.entries(TIER_LABELS).map(([key, label]) => (
            <div key={key}>
              <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
              <p className="text-2xl font-bold text-[#1F2937] mt-1">{stats.tierCounts[key] || 0}</p>
            </div>
          ))}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Active Rate</p>
            <p className="text-2xl font-bold text-[#1F2937] mt-1">{stats.activeRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">New (7 days)</p>
            <p className="text-2xl font-bold text-[#10B981] mt-1">{stats.recentSignups}</p>
          </div>
        </div>
      </div>

      {/* Tier distribution bar */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Client Distribution by Tier</h2>
        {stats.totalClients === 0 ? (
          <p className="text-sm text-gray-400">No clients yet</p>
        ) : (
          <div className="space-y-3">
            {tierEntries.map(({ tier, clients, key }) => {
              const pct = stats.totalClients > 0 ? (clients / stats.totalClients) * 100 : 0;
              const colors: Record<string, string> = {
                "free-trial": "bg-gray-400",
                "self-maintained": "bg-blue-500",
                "full-access": "bg-[#10B981]",
              };
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{tier}</span>
                    <span className="text-gray-500">{clients} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colors[key] || "bg-gray-300"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assessment / Appointment Stats */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Appointment Statistics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Appointments</p>
            <p className="text-2xl font-bold text-[#1F2937] mt-1">{stats.totalAppointments}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Measurements</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.appointmentsByType["measurement"] || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Blood Tests</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.appointmentsByType["blood-test"] || 0}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Consultations</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{stats.appointmentsByType["consultation"] || 0}</p>
          </div>
        </div>
      </div>

      {/* Coaching Stats */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Coaching Statistics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Completions (30d)</p>
            <p className="text-2xl font-bold text-[#1F2937] mt-1">{stats.totalCompletions.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Avg/Day</p>
            <p className="text-2xl font-bold text-[#1F2937] mt-1">{stats.avgCompletionsPerDay.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Completion Rate</p>
            <p className="text-2xl font-bold text-[#1F2937] mt-1">{stats.completionRate.toFixed(0)}%</p>
          </div>
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Revenue Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Monthly Recurring Revenue</p>
            <p className="text-2xl font-bold text-[#1F2937] mt-1">{formatISK(stats.mrr)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Paying Clients</p>
            <p className="text-2xl font-bold text-[#1F2937] mt-1">
              {(stats.tierCounts["self-maintained"] || 0) + (stats.tierCounts["full-access"] || 0)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3">Tier</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3">Clients</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3">Price/Mo</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2 px-3">MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tierEntries.map((row, idx) => (
                <tr key={row.key} className={idx % 2 === 1 ? "bg-gray-50/50" : ""}>
                  <td className="py-2.5 px-3 text-sm font-medium text-[#1F2937]">{row.tier}</td>
                  <td className="py-2.5 px-3 text-sm text-gray-600">{row.clients}</td>
                  <td className="py-2.5 px-3 text-sm text-gray-600">
                    {row.pricePerMonth === 0 ? "Free" : `kr ${row.pricePerMonth.toLocaleString()}`}
                  </td>
                  <td className="py-2.5 px-3 text-sm font-medium text-[#1F2937]">{formatISK(row.mrr)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200">
                <td className="py-2.5 px-3 text-sm font-bold text-[#1F2937]">Total</td>
                <td className="py-2.5 px-3 text-sm font-bold text-[#1F2937]">
                  {tierEntries.reduce((s, r) => s + r.clients, 0)}
                </td>
                <td className="py-2.5 px-3" />
                <td className="py-2.5 px-3 text-sm font-bold text-[#10B981]">{formatISK(stats.mrr)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
