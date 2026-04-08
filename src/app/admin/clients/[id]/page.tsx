"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TIER_LABELS: Record<string, string> = {
  "free-trial": "Free Plan",
  "self-maintained": "Self-Maintained",
  "full-access": "Full Access",
};

const tierColors: Record<string, string> = {
  "free-trial": "bg-gray-100 text-gray-700",
  "self-maintained": "bg-blue-100 text-blue-700",
  "full-access": "bg-emerald-100 text-emerald-700",
};

interface Client {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  sex: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface Subscription {
  tier: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface Appointment {
  id: string;
  type: string;
  date: string;
  time: string;
  status: string;
  coach_name: string | null;
}

interface ClientProgram {
  category_key: string;
  program_key: string;
  week_number: number;
  started_at: string;
}

interface Conversation {
  id: string;
  coach_name: string;
  created_at: string;
  messageCount: number;
  lastMessage: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [programs, setPrograms] = useState<ClientProgram[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClient = useCallback(async () => {
    setLoading(true);
    try {
      // Load all in parallel
      const [clientRes, subRes, aptRes, progRes, convRes] = await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("subscriptions").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(1),
        supabase.from("appointments").select("*").eq("client_id", clientId).order("date", { ascending: false }).limit(10),
        supabase.from("client_programs").select("*").eq("client_id", clientId),
        supabase.from("conversations").select("*, messages(id, content, created_at)").eq("client_id", clientId),
      ]);

      if (clientRes.data) setClient(clientRes.data as Client);
      if (subRes.data && subRes.data.length > 0) setSubscription(subRes.data[0] as Subscription);
      if (aptRes.data) setAppointments(aptRes.data as Appointment[]);
      if (progRes.data) setPrograms(progRes.data as ClientProgram[]);
      if (convRes.data) {
        setConversations(
          (convRes.data as (Record<string, unknown> & { messages: { id: string; content: string; created_at: string }[] })[]).map((c) => ({
            id: c.id as string,
            coach_name: (c.coach_name as string) || "Coach",
            created_at: c.created_at as string,
            messageCount: c.messages?.length ?? 0,
            lastMessage: c.messages?.length > 0
              ? c.messages.sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].content
              : "",
          }))
        );
      }
    } catch (e) {
      console.error("[ClientDetail] Load error:", e);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c858]" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700 font-medium">Client not found</p>
        <button onClick={() => router.push("/admin/clients")} className="text-sm text-blue-600 mt-2 hover:underline">
          Back to clients
        </button>
      </div>
    );
  }

  const tier = subscription?.tier || "none";
  const initials = client.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/admin/clients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to clients
      </Link>

      {/* Client header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[#20c858]/10 flex items-center justify-center text-xl font-bold text-[#20c858]">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#1F2937]">{client.full_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{client.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${tierColors[tier] || "bg-gray-100 text-gray-600"}`}>
                {TIER_LABELS[tier] || "No subscription"}
              </span>
              {subscription && (
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                  subscription.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {subscription.status}
                </span>
              )}
              <span className="text-xs text-gray-400">Member since {formatDate(client.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Phone</p>
            <p className="text-sm text-gray-700 mt-1">{client.phone || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Address</p>
            <p className="text-sm text-gray-700 mt-1">{client.address || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Date of Birth</p>
            <p className="text-sm text-gray-700 mt-1">{client.date_of_birth ? formatDate(client.date_of_birth) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Sex</p>
            <p className="text-sm text-gray-700 mt-1 capitalize">{client.sex || "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Programs */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Active Programs</h2>
          {programs.length === 0 ? (
            <p className="text-sm text-gray-400">No active programs</p>
          ) : (
            <div className="space-y-3">
              {programs.map((p) => (
                <div key={p.category_key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-[#1F2937] capitalize">{p.category_key}</p>
                    <p className="text-xs text-gray-500">{p.program_key}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#20c858]">Week {p.week_number}</p>
                    <p className="text-xs text-gray-400">Started {formatDate(p.started_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Appointments */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Recent Appointments</h2>
          {appointments.length === 0 ? (
            <p className="text-sm text-gray-400">No appointments</p>
          ) : (
            <div className="space-y-3">
              {appointments.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-[#1F2937] capitalize">{a.type.replace("-", " ")}</p>
                    <p className="text-xs text-gray-500">{a.date} at {a.time}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    a.status === "booked" ? "bg-yellow-100 text-yellow-800" :
                    a.status === "completed" ? "bg-green-100 text-green-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Conversations</h2>
          {conversations.length === 0 ? (
            <p className="text-sm text-gray-400">No conversations</p>
          ) : (
            <div className="space-y-3">
              {conversations.map((c) => (
                <Link
                  key={c.id}
                  href="/admin/messages"
                  className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#1F2937]">{c.coach_name}</p>
                    <span className="text-xs text-gray-400">{c.messageCount} messages</span>
                  </div>
                  {c.lastMessage && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{c.lastMessage}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Subscription details */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-[#1F2937] mb-4">Subscription</h2>
          {!subscription ? (
            <p className="text-sm text-gray-400">No active subscription</p>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Tier</span>
                <span className="text-sm font-medium text-[#1F2937]">{TIER_LABELS[subscription.tier] || subscription.tier}</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Status</span>
                <span className="text-sm font-medium capitalize text-[#1F2937]">{subscription.status}</span>
              </div>
              {subscription.trial_ends_at && (
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Trial ends</span>
                  <span className="text-sm font-medium text-[#1F2937]">{formatDate(subscription.trial_ends_at)}</span>
                </div>
              )}
              {subscription.current_period_end && (
                <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Current period ends</span>
                  <span className="text-sm font-medium text-[#1F2937]">{formatDate(subscription.current_period_end)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
