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

// No fallback staff — always load from Supabase

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
    // Single query: conversations with all messages (no N+1)
    const { data: convRows, error: convError } = await supabase
      .from("conversations")
      .select("*, messages(*)")
      .order("created_at", { ascending: false });

    if (convError) return null;
    if (!convRows || convRows.length === 0) return [];

    // Batch-load all client names in one query
    const clientIds = [...new Set(convRows.map((c: Record<string, unknown>) => c.client_id as string))];
    const { data: clientRows } = await supabase
      .from("clients")
      .select("id, full_name, email")
      .in("id", clientIds);
    const clientMap = new Map(
      (clientRows ?? []).map((c: Record<string, unknown>) => [c.id as string, c])
    );

    const conversations: Conversation[] = [];

    for (const conv of convRows as (SupabaseConversation & { messages: SupabaseMessage[] })[]) {
      const rawMsgs = (conv.messages ?? []).sort(
        (a: SupabaseMessage, b: SupabaseMessage) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const msgs: Message[] = rawMsgs.map((m: SupabaseMessage) => ({
        id: m.id,
        senderName: m.sender_name,
        senderRole: m.sender_role,
        content: m.content,
        createdAt: m.created_at,
        read: m.read,
      }));

      const unread = msgs.filter((m) => !m.read && m.senderRole === "client").length;
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

      const client = clientMap.get(conv.client_id) as Record<string, unknown> | undefined;
      const clientName = (client?.full_name as string) || (client?.email as string) || "Client";
      const clientEmail = (client?.email as string) || "";

      conversations.push({
        id: conv.id,
        clientName,
        clientEmail,
        tier: "Active",
        lastMessage: lastMsg?.content ?? "",
        lastMessageAt: lastMsg?.createdAt ?? conv.created_at,
        unreadCount: unread,
        messages: msgs,
      });
    }

    // Sort by last message time (most recent first)
    conversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

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
    const isRealUUID = staff.id && /^[0-9a-f]{8}-/i.test(staff.id);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: isRealUUID ? staff.id : null,
        sender_name: staff.name,
        sender_role: "coach",
        content,
        read: false,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[Messages] Insert failed:", error?.message);
      return null;
    }

    // Unarchive conversation if it was archived (so client sees it)
    try {
      await supabase
        .from("conversations")
        .update({ archived: false })
        .eq("id", conversationId);
    } catch {}

    const row = data as SupabaseMessage;

    // Send push notification to the client
    try {
      // Look up client_id from the conversation
      const { data: conv } = await supabase
        .from("conversations")
        .select("client_id")
        .eq("id", conversationId)
        .single();

      if (conv?.client_id) {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            clientId: conv.client_id,
            title: `Message from ${staff.name}`,
            body: content.length > 100 ? content.slice(0, 100) + "..." : content,
            data: { conversationId, type: "coach_message" },
          },
        });
      }
    } catch {
      // Push notification is best-effort — don't fail the message send
    }

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

interface ClientOption {
  id: string;
  name: string;
  email: string;
}

async function loadClientsForNewConversation(): Promise<ClientOption[]> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id, full_name, email")
      .order("full_name", { ascending: true });
    if (error || !data) return [];
    return data.map((c: Record<string, unknown>) => ({
      id: c.id as string,
      name: (c.full_name as string) || (c.email as string) || "Unknown",
      email: (c.email as string) || "",
    }));
  } catch {
    return [];
  }
}

async function createConversationWithClient(
  clientId: string,
  staff: StaffMember,
): Promise<string | null> {
  try {
    // Check if conversation already exists
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("client_id", clientId)
      .limit(1);
    if (existing && existing.length > 0) return existing[0].id as string;

    const isRealUUID = staff.id && /^[0-9a-f]{8}-/i.test(staff.id);
    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({
        client_id: clientId,
        coach_id: isRealUUID ? staff.id : null,
        coach_name: staff.name,
      })
      .select()
      .single();

    if (error || !conv) return null;

    // Add welcome message
    await supabase.from("messages").insert({
      conversation_id: (conv as SupabaseConversation).id,
      sender_id: isRealUUID ? staff.id : null,
      sender_name: staff.name,
      sender_role: "coach",
      content: `Hello! I'm ${staff.name}, your health coach at Lifeline Health. Feel free to message me anytime with questions about your training, nutrition, or health goals.`,
      read: true,
    });

    return (conv as SupabaseConversation).id;
  } catch {
    return null;
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
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [replyAsStaff, setReplyAsStaff] = useState<StaffMember | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [creatingConv, setCreatingConv] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? conversations[0] ?? null;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

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
      // Auto-set replyAsStaff to the currently logged-in user
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const match = liveStaff.find((s) => s.email.toLowerCase() === user.email!.toLowerCase());
          setReplyAsStaff(match ?? liveStaff[0]);
        } else {
          setReplyAsStaff(liveStaff[0]);
        }
      } catch {
        setReplyAsStaff(liveStaff[0]);
      }
    } else {
      setDbError(true);
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

  // Realtime subscription for new messages from clients
  useEffect(() => {
    const channel = supabase
      .channel("admin-messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload: Record<string, unknown>) => {
          const m = payload.new as SupabaseMessage | undefined;
          if (!m) return;
          // Skip messages sent by staff (prevents duplicates from own sends)
          if (m.sender_role !== "client") return;
          const newMsg: Message = {
            id: m.id,
            senderName: m.sender_name,
            senderRole: m.sender_role,
            content: m.content,
            createdAt: m.created_at,
            read: m.read,
          };
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === m.conversation_id) {
                const alreadyExists = c.messages.some((msg) => msg.id === m.id);
                if (alreadyExists) return c;
                return {
                  ...c,
                  messages: [...c.messages, newMsg],
                  lastMessage: newMsg.content,
                  lastMessageAt: newMsg.createdAt,
                  unreadCount: m.sender_role === "client" ? c.unreadCount + 1 : c.unreadCount,
                };
              }
              return c;
            }),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    if (!newMessage.trim() || !replyAsStaff) return;

    const content = newMessage.trim();
    setNewMessage("");

    // Try Supabase first
    const supaMsg = await sendMessageToSupabase(selectedId, content, replyAsStaff);

    const msg: Message = supaMsg ?? {
      id: `msg-${Date.now()}`,
      senderName: replyAsStaff!.name,
      senderRole: replyAsStaff!.role,
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

  const handleOpenNewConversation = async () => {
    setShowNewConversation(true);
    setClientSearch("");
    const clients = await loadClientsForNewConversation();
    setClientOptions(clients);
  };

  const handleStartConversation = async (client: ClientOption) => {
    if (!replyAsStaff) return;
    setCreatingConv(true);
    const convId = await createConversationWithClient(client.id, replyAsStaff);
    if (convId) {
      await loadConversations();
      setSelectedId(convId);
      setShowNewConversation(false);
    } else {
      alert("Failed to create conversation.");
    }
    setCreatingConv(false);
  };

  const filteredClients = clientOptions.filter(
    (c) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(clientSearch.toLowerCase())
  );

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

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Left sidebar: conversation list */}
      <div className="w-80 border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#1F2937]">Messages</h2>
              <span className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-[#10B981]' : 'bg-gray-300'}`} title={dbConnected ? 'Connected to Supabase' : 'Using mock data'} />
            </div>
            <div className="flex items-center gap-1.5">
              {totalUnread > 0 && (
                <span className="bg-[#10B981] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              )}
              <button
                onClick={handleOpenNewConversation}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                title="New conversation"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
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
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
            />
          </div>
        </div>


        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && !loading && (
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
          {conversations.map((conv) => {
            const isSelected = conv.id === selectedId;
            return (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  isSelected ? "bg-[#10B981]/5 border-l-2 border-l-[#10B981]" : ""
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
                        <span className="bg-[#10B981] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-2">
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
          <div>
            <p className="text-sm font-semibold text-[#1F2937]">{selected.clientName}</p>
            <p className="text-xs text-gray-400">{selected.clientEmail}</p>
          </div>
          <div className="flex items-center gap-3">
            {replyAsStaff && (
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${roleColors[replyAsStaff.role]}`}>
                {replyAsStaff.avatarInitial}
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-700">{replyAsStaff.name}</p>
                <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleColors[replyAsStaff.role]}`}>
                  {roleLabels[replyAsStaff.role]}
                </span>
              </div>
            </div>
            )}
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
                          ? "bg-[#10B981] text-white rounded-br-md"
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
          {replyAsStaff && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400">Sending as</span>
            <span className="text-xs font-medium text-gray-700">{replyAsStaff.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleColors[replyAsStaff.role]}`}>{roleLabels[replyAsStaff.role]}</span>
          </div>
          )}
          <div className="flex items-end gap-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Reply to ${selected.clientName}${replyAsStaff ? ` as ${replyAsStaff.name}` : ""}...`}
              rows={1}
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] max-h-32"
              style={{ minHeight: "40px" }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="bg-[#10B981] hover:bg-[#047857] disabled:bg-gray-200 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 flex-shrink-0"
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

      {/* New conversation modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">New conversation</h3>
              <button
                onClick={() => setShowNewConversation(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-2">Message as: <span className="font-medium text-gray-700">{replyAsStaff?.name ?? "Loading..."}</span></p>
              <div className="relative">
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981] text-gray-900"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
              {filteredClients.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  {clientOptions.length === 0 ? "Loading clients..." : "No clients found"}
                </div>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleStartConversation(client)}
                    disabled={creatingConv}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 flex items-center gap-3 disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#10B981]/10 flex items-center justify-center text-xs font-bold text-[#10B981] flex-shrink-0">
                      {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1F2937] truncate">{client.name}</p>
                      <p className="text-xs text-gray-400 truncate">{client.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
