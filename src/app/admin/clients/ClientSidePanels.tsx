"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ─── Types ─────────────────────────────────────────────────

interface Appointment {
  id: string;
  type: string;
  date: string;
  time: string;
  status: string;
  coach_name: string | null;
  station_name: string | null;
}

interface Conversation {
  id: string;
  coach_name: string;
  lastMessage: string;
  lastMessageDate: string;
  unreadCount: number;
}

const typeColors: Record<string, string> = {
  measurement: "bg-blue-100 text-blue-700",
  "blood-test": "bg-red-100 text-red-700",
  consultation: "bg-emerald-100 text-emerald-700",
};

const statusColors: Record<string, string> = {
  booked: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch { return dateStr; }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Appointments card ─────────────────────────────────────

export function AppointmentsCard({ clientId }: { clientId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("appointments")
          .select("id, type, date, time, status, coach_name, station_name")
          .eq("client_id", clientId)
          .order("date", { ascending: false })
          .limit(5);
        setAppointments((data as Appointment[]) || []);
      } catch {}
      setLoading(false);
    })();
  }, [clientId]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Appointments</h4>
        <span className="text-[10px] text-gray-300">{appointments.length} total</span>
      </div>
      {loading ? (
        <p className="text-xs text-gray-300 py-3 text-center">Loading...</p>
      ) : appointments.length === 0 ? (
        <p className="text-xs text-gray-300 py-3 text-center">No appointments</p>
      ) : (
        <div className="space-y-2">
          {appointments.map((apt) => (
            <div key={apt.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColors[apt.type] || "bg-gray-100 text-gray-600"}`}>
                    {apt.type.replace("-", " ")}
                  </span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[apt.status] || "bg-gray-100 text-gray-600"}`}>
                    {apt.status}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {apt.date} at {apt.time}
                  {apt.station_name && <span className="text-gray-400"> · {apt.station_name}</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Messages card ─────────────────────────────────────────

export function MessagesCard({ clientId, clientName, onSendMessage }: {
  clientId: string;
  clientName: string;
  onSendMessage: (clientId: string, clientName: string) => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("conversations")
          .select("id, coach_name, messages(id, content, created_at, read, sender_role)")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });

        if (data) {
          setConversations(
            (data as Array<Record<string, unknown> & { messages: Array<{ id: string; content: string; created_at: string; read: boolean; sender_role: string }> }>).map((c) => {
              const msgs = c.messages || [];
              const sorted = [...msgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              const unread = msgs.filter(m => !m.read && m.sender_role === "client").length;
              return {
                id: c.id as string,
                coach_name: (c.coach_name as string) || "Coach",
                lastMessage: sorted[0]?.content || "",
                lastMessageDate: sorted[0]?.created_at || "",
                unreadCount: unread,
              };
            })
          );
        }
      } catch {}
      setLoading(false);
    })();
  }, [clientId]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Messages</h4>
        <button
          onClick={(e) => { e.stopPropagation(); onSendMessage(clientId, clientName); }}
          className="text-[10px] font-medium text-[#0EA5E9] hover:text-[#0EA5E9]/80"
        >
          + New
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-gray-300 py-3 text-center">Loading...</p>
      ) : conversations.length === 0 ? (
        <div className="text-center py-3">
          <p className="text-xs text-gray-300 mb-2">No conversations</p>
          <button
            onClick={(e) => { e.stopPropagation(); onSendMessage(clientId, clientName); }}
            className="text-xs font-medium text-[#0EA5E9] hover:underline"
          >
            Start conversation
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={(e) => { e.stopPropagation(); router.push("/admin/messages"); }}
              className="w-full flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-[#0EA5E9]/10 flex items-center justify-center text-[10px] font-bold text-[#0EA5E9] flex-shrink-0">
                {conv.coach_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-700">{conv.coach_name}</p>
                  {conv.lastMessageDate && (
                    <span className="text-[10px] text-gray-400">{timeAgo(conv.lastMessageDate)}</span>
                  )}
                </div>
                {conv.lastMessage && (
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">{conv.lastMessage}</p>
                )}
              </div>
              {conv.unreadCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#0EA5E9] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {conv.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
