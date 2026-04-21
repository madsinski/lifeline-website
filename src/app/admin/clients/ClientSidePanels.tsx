"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  station_address: string | null;
  package_name: string | null;
  consultation_type: string | null;
  video_room_url: string | null;
}

interface Message {
  id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

interface StaffMember {
  id: string;
  name: string;
}

const typeIcons: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  consultation: { icon: "💬", color: "text-emerald-800", bg: "bg-emerald-50/80 border-emerald-200/60", label: "Consultation" },
  "blood-test": { icon: "🩸", color: "text-red-800", bg: "bg-red-50/80 border-red-200/60", label: "Blood test" },
  measurement: { icon: "📏", color: "text-blue-800", bg: "bg-blue-50/80 border-blue-200/60", label: "Measurement" },
};

function formatTime(timeStr: string): string {
  return timeStr;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ─── Appointments card ─────────────────────────────────────

const CONSULTATIONS_PER_TIER: Record<string, number> = {
  "free-trial": 1,
  "self-maintained": 0,
  "premium": 4,
};

export function AppointmentsCard({ clientId }: { clientId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [consultationQuota, setConsultationQuota] = useState<{ used: number; total: number; tier: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Load booked appointments
        const { data } = await supabase
          .from("appointments")
          .select("*")
          .eq("client_id", clientId)
          .eq("status", "booked")
          .order("date", { ascending: true });
        setAppointments((data as Appointment[]) || []);

        // Load consultation quota
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("tier, current_period_start")
          .eq("client_id", clientId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);

        if (subs && subs.length > 0) {
          const sub = subs[0] as { tier: string; current_period_start: string };
          const total = CONSULTATIONS_PER_TIER[sub.tier] ?? 0;
          const periodStart = sub.current_period_start || new Date(Date.now() - 30 * 86400000).toISOString();

          // Count consultations (booked + completed) in current period
          const { count } = await supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("client_id", clientId)
            .eq("type", "consultation")
            .in("status", ["booked", "completed"])
            .gte("created_at", periodStart);

          setConsultationQuota({ used: count ?? 0, total, tier: sub.tier });
        }
      } catch {}
      setLoading(false);
    })();
  }, [clientId]);

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this appointment?")) return;
    await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  const handleComplete = async (id: string) => {
    await supabase.from("appointments").update({ status: "completed" }).eq("id", id);
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Upcoming appointments</h4>
        <div className="flex items-center gap-2">
          {consultationQuota && consultationQuota.total > 0 && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              consultationQuota.total - consultationQuota.used <= 0
                ? "text-red-600 bg-red-50"
                : consultationQuota.total - consultationQuota.used <= 1
                ? "text-amber-600 bg-amber-50"
                : "text-gray-600 bg-gray-100"
            }`}>
              {consultationQuota.total - consultationQuota.used}/{consultationQuota.total} consultations left
            </span>
          )}
          {consultationQuota && consultationQuota.total === 0 && (
            <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
              No consultations incl.
            </span>
          )}
        </div>
      </div>
      {loading ? (
        <p className="text-xs text-gray-300 py-4 text-center">Loading...</p>
      ) : appointments.length === 0 ? (
        <p className="text-xs text-gray-300 py-4 text-center">No upcoming appointments</p>
      ) : (
        <div className="space-y-2">
          {appointments.map((apt) => {
            const cfg = typeIcons[apt.type] || typeIcons.consultation;
            return (
              <div key={apt.id} className={`rounded-lg border p-3 ${cfg.bg}`}>
                {/* Type + date row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cfg.icon}</span>
                    <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-600">{apt.date} · {formatTime(apt.time)}</span>
                </div>

                {/* Details */}
                <div className="space-y-0.5 mb-2">
                  {apt.consultation_type && (
                    <p className="text-xs text-gray-600">{apt.consultation_type}</p>
                  )}
                  {apt.coach_name && (
                    <p className="text-xs text-gray-500">Coach: {apt.coach_name}</p>
                  )}
                  {apt.station_name && (
                    <p className="text-xs text-gray-500">{apt.station_name}{apt.station_address ? ` — ${apt.station_address}` : ""}</p>
                  )}
                  {apt.package_name && (
                    <p className="text-xs text-gray-500">Package: {apt.package_name}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {apt.video_room_url && (
                    <a href={apt.video_room_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Join call
                    </a>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleComplete(apt.id); }}
                    className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    Mark done
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleCancel(apt.id); }}
                    className="px-2.5 py-1.5 text-xs font-medium text-red-500 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Inline chat card ──────────────────────────────────────

export function MessagesCard({ clientId, clientName, staffMembers }: {
  clientId: string;
  clientName: string;
  staffMembers: StaffMember[];
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load or create the single conversation for this client
  const loadConversation = useCallback(async () => {
    setLoading(true);
    try {
      // Find ANY existing conversation (including archived) — one per client
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, archived")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1);

      let convId: string;
      if (convs && convs.length > 0) {
        convId = convs[0].id as string;
        // Unarchive if needed
        if (convs[0].archived) {
          await supabase.from("conversations").update({ archived: false }).eq("id", convId);
        }
      } else {
        // No conversation at all — create one
        const defaultStaff = staffMembers[0];
        const isRealUUID = defaultStaff?.id && /^[0-9a-f]{8}-/i.test(defaultStaff.id);
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            client_id: clientId,
            coach_id: isRealUUID ? defaultStaff.id : null,
            coach_name: defaultStaff?.name || "Coach",
          })
          .select("id")
          .single();
        convId = (newConv as Record<string, string>)?.id;
      }

      setConversationId(convId);

      // Load messages
      if (convId) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("id, sender_name, sender_role, content, created_at")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true });
        setMessages((msgs as Message[]) || []);

        // Mark client messages as read
        await supabase
          .from("messages")
          .update({ read: true })
          .eq("conversation_id", convId)
          .eq("sender_role", "client")
          .eq("read", false);
      }
    } catch (e) {
      console.error("[MessagesCard] Error:", e);
    }
    setLoading(false);
  }, [clientId, staffMembers]);

  useEffect(() => { loadConversation(); }, [loadConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Auto-mark as read if from client
          if (msg.sender_role === "client") {
            supabase.from("messages").update({ read: true }).eq("id", msg.id).then(() => {});
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    try {
      const staff = staffMembers[0];
      const isRealUUID = staff?.id && /^[0-9a-f]{8}-/i.test(staff.id);

      const { data } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: isRealUUID ? staff.id : null,
          sender_name: staff?.name || "Coach",
          sender_role: "coach",
          content,
          read: false,
        })
        .select()
        .single();

      if (data) {
        const msg = data as Message;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      }

      // Send push notification
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: { clientId, title: `Message from ${staff?.name || "Coach"}`, body: content },
        });
      } catch {}
    } catch (e) {
      console.error("[MessagesCard] Send error:", e);
      setInput(content); // restore on failure
    }
    setSending(false);
  };

  const [showNudges, setShowNudges] = useState(false);
  const [editingNudges, setEditingNudges] = useState(false);

  const defaultNudges = [
    "Hey {name}! Just checking in — how are you feeling about your program this week?",
    "I noticed your activity has been a bit quiet lately. Everything okay? Let me know if you need to adjust anything.",
    "Great work on your recent progress! Keep the momentum going this week.",
    "Quick reminder to log your actions today — every small step counts!",
    "How was your sleep this week? If you're struggling, let's look at your routine together.",
    "Time for a check-in! How's the nutrition plan working for you? Any meals you'd like to swap?",
    "You're doing really well — just a nudge to stay consistent with your evening routine.",
    "I've updated your program for this week. Take a look and let me know if it works for you.",
    "Don't forget to hit your step goal today! A quick walk after lunch makes a big difference.",
    "Let's book a call this week to review your progress and plan the next phase.",
  ];

  const [nudgeTemplates, setNudgeTemplates] = useState<string[]>(() => {
    if (typeof window === "undefined") return defaultNudges;
    try {
      const saved = localStorage.getItem("ll-nudge-templates");
      return saved ? JSON.parse(saved) : defaultNudges;
    } catch { return defaultNudges; }
  });

  const saveNudges = (templates: string[]) => {
    setNudgeTemplates(templates);
    try { localStorage.setItem("ll-nudge-templates", JSON.stringify(templates)); } catch {}
  };

  const personalize = (msg: string) => msg.replace(/\{name\}/g, clientName.split(" ")[0]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200/60 flex flex-col overflow-hidden" style={{ height: "100%" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Chat with {clientName.split(" ")[0]}</h4>
        {messages.length > 0 && (
          <span className="text-[10px] text-gray-300">{messages.length} messages</span>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0" style={{ maxHeight: 280 }}>
        {loading ? (
          <p className="text-xs text-gray-300 py-8 text-center">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-gray-300 py-8 text-center">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => {
            const isCoach = msg.sender_role === "coach" || msg.sender_role === "system";
            return (
              <div key={msg.id} className={`flex ${isCoach ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                  isCoach
                    ? "bg-gray-900 text-white rounded-br-md"
                    : "bg-gray-100 text-gray-900 rounded-bl-md"
                }`}>
                  <p className="text-xs leading-relaxed">{msg.content}</p>
                  <p className={`text-[9px] mt-1 ${isCoach ? "text-gray-400" : "text-gray-400"}`}>
                    {msg.sender_name} · {timeAgo(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Nudge templates dropdown */}
      {showNudges && (
        <div className="border-t border-gray-100 flex-shrink-0">
          <div className="px-3 pt-2 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nudge templates</span>
            <div className="flex items-center gap-2">
              {editingNudges && (
                <button onClick={() => { saveNudges([...nudgeTemplates, "New template — use {name} for client name"]); }}
                  className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700">+ Add</button>
              )}
              <button onClick={() => {
                if (editingNudges) saveNudges(nudgeTemplates);
                setEditingNudges(!editingNudges);
              }} className="text-[10px] font-medium text-gray-500 hover:text-gray-700">
                {editingNudges ? "Done" : "Edit"}
              </button>
            </div>
          </div>
          <div className="px-3 pb-2 max-h-40 overflow-y-auto space-y-1">
            {editingNudges ? (
              nudgeTemplates.map((msg, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <textarea
                    value={msg}
                    onChange={(e) => { const next = [...nudgeTemplates]; next[i] = e.target.value; setNudgeTemplates(next); }}
                    rows={2}
                    className="flex-1 px-2.5 py-1.5 text-[11px] text-gray-700 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-300 outline-none resize-none leading-snug"
                  />
                  <button onClick={() => { const next = nudgeTemplates.filter((_, j) => j !== i); saveNudges(next); }}
                    className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            ) : (
              nudgeTemplates.map((msg, i) => (
                <button key={i} onClick={() => { setInput(personalize(msg)); setShowNudges(false); }}
                  className="w-full text-left px-2.5 py-2 text-[11px] text-gray-600 hover:bg-gray-50 rounded-lg transition-colors leading-snug">
                  {personalize(msg)}
                </button>
              ))
            )}
          </div>
          {editingNudges && (
            <div className="px-3 pb-2">
              <button onClick={() => { saveNudges(defaultNudges); }}
                className="text-[10px] text-gray-400 hover:text-gray-600">Reset to defaults</button>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => setShowNudges(!showNudges)}
          className={`p-2 rounded-xl transition-colors flex-shrink-0 ${showNudges ? "bg-amber-200 text-amber-700" : "bg-amber-50 text-amber-500 hover:bg-amber-100 hover:text-amber-600"}`}
          title="Nudge templates"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-gray-300 focus:bg-white outline-none text-gray-900 placeholder:text-gray-400"
          disabled={loading || !conversationId}
        />
        <button
          onClick={(e) => { e.stopPropagation(); sendMessage(); }}
          disabled={!input.trim() || sending || loading}
          className="px-3 py-2 text-xs font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-colors flex-shrink-0"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
