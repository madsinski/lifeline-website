"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────

interface Message {
  id: string;
  senderName: string;
  senderRole: "client" | "coach" | "doctor" | "nurse" | "psychologist" | "system";
  content: string;
  createdAt: string;
  read: boolean;
}

interface Conversation {
  id: string;
  clientName: string;
  clientEmail: string;
  tier: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: Message[];
  assignedStaff?: StaffMember;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "coach" | "doctor" | "nurse" | "psychologist";
  avatarInitial: string;
  active: boolean;
}

// ─── Staff data (fallback) ──────────────────────────────────

const fallbackStaffMembers: StaffMember[] = [
  { id: "staff-1", name: "Coach Sarah", email: "sarah@lifeline.is", role: "coach", avatarInitial: "CS", active: true },
  { id: "staff-2", name: "Dr. Guðmundur Sigurðsson", email: "gudmundur@lifeline.is", role: "doctor", avatarInitial: "GS", active: true },
  { id: "staff-3", name: "Helga Jónsdóttir", email: "helga@lifeline.is", role: "nurse", avatarInitial: "HJ", active: true },
  { id: "staff-4", name: "Dr. Anna Kristjánsdóttir", email: "anna.k@lifeline.is", role: "psychologist", avatarInitial: "AK", active: true },
];

async function loadStaffFromSupabase(): Promise<StaffMember[] | null> {
  try {
    // Try with permissions filter, fall back to all active staff
    const { data: d1, error: e1 } = await supabase
      .from("staff")
      .select("*")
      .eq("active", true)
      .contains("permissions", ["send_messages"]);

    let data = d1;
    if (e1 || !d1 || d1.length === 0) {
      const { data: d2 } = await supabase
        .from("staff")
        .select("*")
        .eq("active", true);
      data = d2;
    }

    if (!data || data.length === 0) return null;

    return data.map((s: Record<string, unknown>) => ({
      id: s.id as string,
      name: s.name as string,
      email: (s.email as string) || "",
      role: (s.role as StaffMember["role"]) || "coach",
      avatarInitial: ((s.name as string) || "")
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      active: true,
    }));
  } catch {
    return null;
  }
}

const roleLabels: Record<StaffMember["role"], string> = {
  coach: "Coach",
  doctor: "Doctor",
  nurse: "Nurse",
  psychologist: "Psychologist",
};

const roleColors: Record<StaffMember["role"], string> = {
  coach: "bg-emerald-100 text-emerald-700",
  doctor: "bg-blue-100 text-blue-700",
  nurse: "bg-purple-100 text-purple-700",
  psychologist: "bg-amber-100 text-amber-700",
};

// ─── Mock data (fallback) ────────────────────────────────────

const initialConversations: Conversation[] = [
  {
    id: "conv-1",
    clientName: "Jon Jonsson",
    clientEmail: "jon@example.com",
    tier: "Full Access",
    lastMessage: "Thanks! Should I finish this week as normal?",
    lastMessageAt: "2026-03-28T10:02:00Z",
    unreadCount: 2,
    assignedStaff: fallbackStaffMembers[0],
    messages: [
      { id: "m1a", senderName: "Coach Sarah", senderRole: "coach", content: "Hi Jon! I updated your training program based on your latest assessment. The new program starts next week Monday.", createdAt: "2026-03-27T09:15:00Z", read: true },
      { id: "m1b", senderName: "Jon Jonsson", senderRole: "client", content: "Thanks! Should I finish this week as normal?", createdAt: "2026-03-28T10:02:00Z", read: false },
    ],
  },
  {
    id: "conv-2",
    clientName: "Anna Sigurdardottir",
    clientEmail: "anna@example.com",
    tier: "Full Access",
    lastMessage: "My knee has been hurting after the squats. Should I modify the exercise?",
    lastMessageAt: "2026-03-28T08:30:00Z",
    unreadCount: 1,
    assignedStaff: fallbackStaffMembers[0],
    messages: [
      { id: "m2a", senderName: "Coach Sarah", senderRole: "coach", content: "Hi Anna, how is the new lower body program going?", createdAt: "2026-03-26T14:00:00Z", read: true },
      { id: "m2b", senderName: "Anna Sigurdardottir", senderRole: "client", content: "It is going well overall but I have a question.", createdAt: "2026-03-27T09:00:00Z", read: true },
      { id: "m2c", senderName: "Coach Sarah", senderRole: "coach", content: "Of course, what is on your mind?", createdAt: "2026-03-27T09:30:00Z", read: true },
      { id: "m2d", senderName: "Anna Sigurdardottir", senderRole: "client", content: "My knee has been hurting after the squats. Should I modify the exercise?", createdAt: "2026-03-28T08:30:00Z", read: false },
    ],
  },
  {
    id: "conv-3",
    clientName: "Olafur Helgason",
    clientEmail: "olafur@example.com",
    tier: "Full Access",
    lastMessage: "That sounds great. I will start the meal prep this Sunday.",
    lastMessageAt: "2026-03-26T16:45:00Z",
    unreadCount: 0,
    assignedStaff: fallbackStaffMembers[1],
    messages: [
      { id: "m3a", senderName: "Olafur Helgason", senderRole: "client", content: "Hi Coach, I wanted to ask about my nutrition plan. I have been struggling with meal prep.", createdAt: "2026-03-25T10:00:00Z", read: true },
      { id: "m3b", senderName: "Coach Sarah", senderRole: "coach", content: "Hey Olafur! I understand meal prep can be challenging. Let me suggest a simplified approach: prep just 3 proteins and 3 vegetables on Sunday, then mix and match throughout the week.", createdAt: "2026-03-25T11:15:00Z", read: true },
      { id: "m3c", senderName: "Olafur Helgason", senderRole: "client", content: "That sounds great. I will start the meal prep this Sunday.", createdAt: "2026-03-26T16:45:00Z", read: true },
    ],
  },
  {
    id: "conv-4",
    clientName: "Gudrun Magnusdottir",
    clientEmail: "gudrun@example.com",
    tier: "Full Access",
    lastMessage: "Can we reschedule the video call to Thursday instead?",
    lastMessageAt: "2026-03-28T07:15:00Z",
    unreadCount: 1,
    assignedStaff: fallbackStaffMembers[2],
    messages: [
      { id: "m4a", senderName: "Coach Sarah", senderRole: "coach", content: "Hi Gudrun! Just a reminder that we have our monthly video call scheduled for Wednesday at 14:00.", createdAt: "2026-03-27T16:00:00Z", read: true },
      { id: "m4b", senderName: "Gudrun Magnusdottir", senderRole: "client", content: "Can we reschedule the video call to Thursday instead?", createdAt: "2026-03-28T07:15:00Z", read: false },
    ],
  },
];

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
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toISOString().split("T")[0];
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Supabase helpers ────────────────────────────────────────

interface SupabaseConversation {
  id: string;
  client_id: string;
  coach_id: string;
  coach_name: string;
  created_at: string;
}

interface SupabaseMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: "client" | "coach" | "system";
  content: string;
  read: boolean;
  created_at: string;
}

async function loadConversationsFromSupabase(): Promise<Conversation[] | null> {
  try {
    const { data: convRows, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false });

    if (convError) return null;
    if (!convRows || convRows.length === 0) return [];

    const conversations: Conversation[] = [];

    for (const conv of convRows as SupabaseConversation[]) {
      const { data: msgRows, error: msgError } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });

      const msgs: Message[] = (msgRows && !msgError
        ? (msgRows as SupabaseMessage[]).map((m) => ({
            id: m.id,
            senderName: m.sender_name,
            senderRole: m.sender_role,
            content: m.content,
            createdAt: m.created_at,
            read: m.read,
          }))
        : []);

      const unread = msgs.filter((m) => !m.read).length;
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

      conversations.push({
        id: conv.id,
        clientName: conv.coach_name ?? "Client",
        clientEmail: "",
        tier: "Full Access",
        lastMessage: lastMsg?.content ?? "",
        lastMessageAt: lastMsg?.createdAt ?? conv.created_at,
        unreadCount: unread,
        messages: msgs,
        assignedStaff: fallbackStaffMembers[0],
      });
    }

    return conversations;
  } catch {
    return null;
  }
}

async function sendMessageToSupabase(
  conversationId: string,
  content: string,
  staff: StaffMember,
): Promise<Message | null> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: staff.id,
        sender_name: staff.name,
        sender_role: staff.role === "coach" ? "coach" : "coach",
        content,
        read: true,
      })
      .select()
      .single();

    if (error || !data) return null;
    const row = data as SupabaseMessage;
    return {
      id: row.id,
      senderName: row.sender_name,
      senderRole: staff.role,
      content: row.content,
      createdAt: row.created_at,
      read: row.read,
    };
  } catch {
    return null;
  }
}

async function markConversationReadInSupabase(conversationId: string): Promise<void> {
  try {
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("conversation_id", conversationId)
      .eq("read", false);
  } catch {
    // silently fail
  }
}

async function createTestConversationInSupabase(): Promise<boolean> {
  try {
    // Find the first client
    const { data: clients, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, email")
      .limit(1)
      .single();

    if (clientError || !clients) return false;

    // Create conversation
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({
        client_id: clients.id,
        coach_id: "staff-1",
        coach_name: clients.full_name || clients.email || "Client",
      })
      .select()
      .single();

    if (convError || !conv) return false;

    // Add welcome message
    const { error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: (conv as SupabaseConversation).id,
        sender_id: "staff-1",
        sender_name: "Coach Sarah",
        sender_role: "coach",
        content: "Welcome to Lifeline Health! I am Coach Sarah, your personal health coach. I am here to help you on your health journey. Feel free to message me anytime with questions about your training, nutrition, or health goals.",
        read: true,
      });

    return !msgError;
  } catch {
    return false;
  }
}

// ─── Component ───────────────────────────────────────────────

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);
  const [dbError, setDbError] = useState(false);
  const [showDemoData, setShowDemoData] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(fallbackStaffMembers);
  const [replyAsStaff, setReplyAsStaff] = useState<StaffMember>(fallbackStaffMembers[0]);
  const [creatingTest, setCreatingTest] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const displayConversations = showDemoData ? initialConversations : conversations;
  const selected = displayConversations.find((c) => c.id === selectedId) ?? displayConversations[0] ?? null;
  const totalUnread = displayConversations.reduce((sum, c) => sum + c.unreadCount, 0);

  // Load conversations and staff from Supabase on mount
  const loadConversations = useCallback(async () => {
    setLoading(true);
    setDbError(false);

    // Load staff in parallel with conversations
    const [fromDb, liveStaff] = await Promise.all([
      loadConversationsFromSupabase(),
      loadStaffFromSupabase(),
    ]);

    if (liveStaff && liveStaff.length > 0) {
      setStaffMembers(liveStaff);
      setReplyAsStaff((prev) => {
        const found = liveStaff.find((s) => s.id === prev.id);
        return found ?? liveStaff[0];
      });
    }

    if (fromDb !== null) {
      // Supabase connected successfully (may be empty or have data)
      setDbConnected(true);
      setConversations(fromDb);
      if (fromDb.length > 0) {
        setSelectedId((prev) => {
          const exists = fromDb.some((c) => c.id === prev);
          return exists ? prev : fromDb[0].id;
        });
      }
    } else {
      // Supabase connection failed
      setDbConnected(false);
      setDbError(true);
      setConversations([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Scroll to bottom of messages container only (not the page)
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [selected?.messages?.length, selectedId]);

  const handleSelectConversation = async (id: string) => {
    setSelectedId(id);
    // Mark as read locally
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              unreadCount: 0,
              messages: c.messages.map((m) => ({ ...m, read: true })),
            }
          : c
      )
    );
    // Mark as read in Supabase
    await markConversationReadInSupabase(id);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage("");

    // Try Supabase first
    const supaMsg = await sendMessageToSupabase(selectedId, content, replyAsStaff);

    const msg: Message = supaMsg ?? {
      id: `msg-${Date.now()}`,
      senderName: replyAsStaff.name,
      senderRole: replyAsStaff.role,
      content,
      createdAt: new Date().toISOString(),
      read: true,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              messages: [...c.messages, msg],
              lastMessage: msg.content,
              lastMessageAt: msg.createdAt,
            }
          : c
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCreateTestConversation = async () => {
    setCreatingTest(true);
    const success = await createTestConversationInSupabase();
    if (success) {
      await loadConversations();
    } else {
      alert("Failed to create test conversation. Make sure the database has at least one client.");
    }
    setCreatingTest(false);
  };

  // Group messages by date for display
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = "";
  for (const msg of (selected?.messages ?? [])) {
    const d = formatDate(msg.createdAt);
    if (d !== currentDate) {
      currentDate = d;
      groupedMessages.push({ date: d, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  const assignedStaff = selected?.assignedStaff;

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Left sidebar: conversation list */}
      <div className="w-80 border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#1F2937]">Messages</h2>
              <span className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-[#20c858]' : 'bg-gray-300'}`} title={dbConnected ? 'Connected to Supabase' : 'Using mock data'} />
            </div>
            <div className="flex items-center gap-1.5">
              {totalUnread > 0 && (
                <span className="bg-[#20c858] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
              <button
                onClick={handleCreateTestConversation}
                disabled={creatingTest}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-50"
                title="Create test conversation"
              >
                {creatingTest ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </button>
              <button
                onClick={loadConversations}
                disabled={loading}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-50"
                title="Refresh conversations"
              >
                <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#20c858]/30 focus:border-[#20c858]"
            />
          </div>
        </div>

        {/* Demo data toggle */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-gray-400">Show demo data</span>
          <button
            onClick={() => {
              const next = !showDemoData;
              setShowDemoData(next);
              if (next) {
                setSelectedId(initialConversations[0].id);
              } else if (conversations.length > 0) {
                setSelectedId(conversations[0].id);
              } else {
                setSelectedId("");
              }
            }}
            className="flex items-center"
          >
            <div className={`relative w-8 h-4 rounded-full transition-colors ${showDemoData ? "bg-[#20c858]" : "bg-gray-300"}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${showDemoData ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {displayConversations.length === 0 && !loading && (
            <div className="px-4 py-12 text-center">
              <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-sm text-gray-500 font-medium">No conversations yet</p>
              <p className="text-xs text-gray-400 mt-1">Click + to start a new conversation.</p>
              {dbError && (
                <p className="text-xs text-red-400 mt-2">Could not connect to database. Try the demo toggle above.</p>
              )}
            </div>
          )}
          {displayConversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            return (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  isSelected ? "bg-[#20c858]/5 border-l-2 border-l-[#20c858]" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-500">
                    {conv.clientName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? "font-semibold text-[#1F2937]" : "font-medium text-gray-700"}`}>
                        {conv.clientName}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {timeAgo(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-xs truncate ${conv.unreadCount > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                        {conv.lastMessage}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="bg-[#20c858] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-300 mt-0.5">{conv.tier}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel: message thread */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs mt-1">Or start a new one with the + button</p>
            </div>
          </div>
        ) : (<>
        {/* Thread header */}
        <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500">
              {selected.clientName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1F2937]">{selected.clientName}</p>
              <p className="text-xs text-gray-400">{selected.clientEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {assignedStaff && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                  {assignedStaff.avatarInitial}
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-700">{assignedStaff.name}</p>
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleColors[assignedStaff.role]}`}>
                    {roleLabels[assignedStaff.role]}
                  </span>
                </div>
              </div>
            )}
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-medium">
              {selected.tier}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50/50">
          {groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">{group.date}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              {group.messages.map((msg) => {
                const isStaff = msg.senderRole !== "client";
                return (
                  <div
                    key={msg.id}
                    className={`flex mb-3 ${isStaff ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        isStaff
                          ? "bg-[#20c858] text-white rounded-br-md"
                          : "bg-white text-[#1F2937] border border-gray-200 rounded-bl-md shadow-sm"
                      }`}
                    >
                      <div className={`flex items-center gap-1.5 mb-1 ${isStaff ? "text-green-100" : "text-gray-400"}`}>
                        <p className="text-xs font-medium">{msg.senderName}</p>
                        {isStaff && msg.senderRole !== "system" && (
                          <span className={`text-[9px] px-1 py-0.5 rounded ${isStaff ? "bg-white/20" : "bg-gray-100"}`}>
                            {msg.senderRole.charAt(0).toUpperCase() + msg.senderRole.slice(1)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <p className={`text-[10px] mt-1 text-right ${isStaff ? "text-green-200" : "text-gray-300"}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Send message input */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400">Reply as:</span>
            <select
              value={replyAsStaff.id}
              onChange={(e) => {
                const s = staffMembers.find((sm) => sm.id === e.target.value);
                if (s) setReplyAsStaff(s);
              }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#20c858]/30 focus:border-[#20c858] text-gray-700"
            >
              {staffMembers.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({roleLabels[s.role]})
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Reply to ${selected.clientName} as ${replyAsStaff.name}...`}
              rows={1}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#20c858]/30 focus:border-[#20c858] max-h-32"
              style={{ minHeight: "40px" }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="bg-[#20c858] hover:bg-[#1bb34e] disabled:bg-gray-200 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send
            </button>
          </div>
          <p className="text-[10px] text-gray-300 mt-1.5">Press Enter to send, Shift+Enter for new line</p>
        </div>
        </>)}
      </div>
    </div>
  );
}
