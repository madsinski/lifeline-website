"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tier = "free-trial" | "self-maintained" | "full-access";
type Status = "active" | "cancelled" | "expired" | "trial";

interface Subscription {
  id: string;
  tier: Tier;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
}

interface ClientRow {
  id: string;
  email: string;
  full_name: string | null;
  date_of_birth: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string | null;
  subscriptions: Subscription[];
}

// Normalized client for display
interface Client {
  id: string;
  name: string;
  email: string;
  tier: Tier | "none";
  status: Status;
  joined: string;
  phone: string;
  subscriptionId: string | null;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  trialEndsAt: string | null;
}

const tierColors: Record<Tier | "none", string> = {
  "free-trial": "bg-gray-100 text-gray-700",
  "self-maintained": "bg-blue-100 text-blue-800",
  "full-access": "bg-emerald-100 text-emerald-800",
  none: "bg-red-50 text-red-600",
};

const tierLabels: Record<Tier | "none", string> = {
  "free-trial": "Free",
  "self-maintained": "Self-Maintained",
  "full-access": "Full Access",
  none: "No Subscription",
};

const statusColors: Record<Status, string> = {
  active: "bg-green-500",
  trial: "bg-yellow-500",
  cancelled: "bg-gray-400",
  expired: "bg-red-400",
};

const statusLabels: Record<Status, string> = {
  active: "Active",
  trial: "Trial",
  cancelled: "Cancelled",
  expired: "Expired",
};

const tierOptions: Tier[] = ["free-trial", "self-maintained", "full-access"];

// ─── Staff types ────────────────────────────────────────────

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "coach" | "doctor" | "nurse" | "psychologist";
  avatarInitial: string;
  active: boolean;
}

const fallbackStaffMembers: StaffMember[] = [
  { id: "staff-1", name: "Coach Sarah", email: "sarah@lifeline.is", role: "coach", avatarInitial: "CS", active: true },
  { id: "staff-2", name: "Dr. Guðmundur Sigurðsson", email: "gudmundur@lifeline.is", role: "doctor", avatarInitial: "GS", active: true },
  { id: "staff-3", name: "Helga Jónsdóttir", email: "helga@lifeline.is", role: "nurse", avatarInitial: "HJ", active: true },
  { id: "staff-4", name: "Dr. Anna Kristjánsdóttir", email: "anna.k@lifeline.is", role: "psychologist", avatarInitial: "AK", active: true },
];

const staffRoleLabels: Record<StaffMember["role"], string> = {
  coach: "Coach",
  doctor: "Doctor",
  nurse: "Nurse",
  psychologist: "Psychologist",
};

const staffRoleColors: Record<StaffMember["role"], string> = {
  coach: "bg-emerald-100 text-emerald-700",
  doctor: "bg-blue-100 text-blue-700",
  nurse: "bg-purple-100 text-purple-700",
  psychologist: "bg-amber-100 text-amber-700",
};

type SortKey = "name" | "email" | "tier" | "status" | "joined";

function deriveStatus(sub: Subscription | undefined): Status {
  if (!sub) return "expired";
  if (sub.status === "cancelled") return "cancelled";
  if (sub.status === "expired") return "expired";
  if (sub.tier === "free-trial" && sub.trial_ends_at) {
    const trialEnd = new Date(sub.trial_ends_at);
    if (trialEnd < new Date()) return "expired";
    return "trial";
  }
  return "active";
}

function normalizeClient(row: ClientRow): Client {
  const sub = row.subscriptions?.find((s) => s.status === "active") ?? row.subscriptions?.[0];
  return {
    id: row.id,
    name: row.full_name || row.email,
    email: row.email,
    tier: sub?.tier || "none",
    status: deriveStatus(sub),
    joined: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "",
    phone: row.phone || "",
    subscriptionId: sub?.id ?? null,
    subscriptionStart: sub?.current_period_start
      ? new Date(sub.current_period_start).toISOString().split("T")[0]
      : null,
    subscriptionEnd: sub?.current_period_end
      ? new Date(sub.current_period_end).toISOString().split("T")[0]
      : null,
    trialEndsAt: sub?.trial_ends_at
      ? new Date(sub.trial_ends_at).toISOString().split("T")[0]
      : null,
  };
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState<"All" | Tier | "none">("All");
  const [filterStatus, setFilterStatus] = useState<"All" | Status>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [savingTier, setSavingTier] = useState<string | null>(null);
  const [creatingSubscription, setCreatingSubscription] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"clients" | "staff">("clients");
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(fallbackStaffMembers);
  const [coachAssignments, setCoachAssignments] = useState<Record<string, string>>({});
  const [deletingClient, setDeletingClient] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sendingMessage, setSendingMessage] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First try fetching clients without joining subscriptions
      // (the join can fail if there's no FK relationship or RLS issues)
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("[Admin Clients] Query result:", { clientsData, clientsError });

      if (clientsError) {
        setError(
          `Failed to fetch clients: ${clientsError.message} (code: ${clientsError.code}). This may be due to RLS policies — ensure the admin user has read access.`
        );
        setClients([]);
        setLoading(false);
        return;
      }

      if (clientsData && clientsData.length > 0) {
        // Fetch subscriptions separately to avoid join issues
        let subsMap: Record<string, Subscription[]> = {};
        try {
          const { data: subsData } = await supabase
            .from("subscriptions")
            .select("*")
            .order("created_at", { ascending: false });

          if (subsData) {
            for (const sub of subsData) {
              const clientId = sub.client_id as string;
              if (!subsMap[clientId]) subsMap[clientId] = [];
              subsMap[clientId].push(sub as Subscription);
            }
          }
        } catch {
          console.log("[Admin Clients] Could not fetch subscriptions separately, showing clients without subscription data");
        }

        const normalized = clientsData.map((row) => {
          const clientRow: ClientRow = {
            ...row,
            subscriptions: subsMap[row.id] || [],
          } as ClientRow;
          return normalizeClient(clientRow);
        });

        console.log("[Admin Clients] Normalized clients:", normalized);
        setClients(normalized);
      } else {
        console.log("[Admin Clients] No clients found in clients table, trying auth admin API...");
        // Fallback: try auth admin API (requires service role key)
        try {
          const { data: authData, error: authError } =
            await supabase.auth.admin.listUsers();

          console.log("[Admin Clients] Auth admin result:", { authData, authError });

          if (!authError && authData?.users && authData.users.length > 0) {
            setClients(
              authData.users.map((u) => ({
                id: u.id,
                name:
                  (u.user_metadata?.full_name as string) ||
                  u.email ||
                  "Unknown",
                email: u.email || "",
                tier: "none" as const,
                status: "expired" as Status,
                joined: u.created_at
                  ? new Date(u.created_at).toISOString().split("T")[0]
                  : "",
                phone: (u.user_metadata?.phone as string) || "",
                subscriptionId: null,
                subscriptionStart: null,
                subscriptionEnd: null,
                trialEndsAt: null,
              }))
            );
          } else {
            setClients([]);
          }
        } catch {
          setClients([]);
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
      console.error("[Admin Clients] Unexpected error:", errMsg);
      setError(errMsg);
      setClients([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Load staff from Supabase
  useEffect(() => {
    (async () => {
      try {
        const { data, error: staffError } = await supabase
          .from("staff")
          .select("*")
          .eq("active", true)
          .contains("permissions", ["send_messages"]);

        if (!staffError && data && data.length > 0) {
          const mapped: StaffMember[] = data.map((s: Record<string, unknown>) => ({
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
          setStaffMembers(mapped);
        }
      } catch {
        // keep fallback staff
      }
    })();
  }, []);

  const handleSendMessageToClient = async (clientId: string, clientName: string) => {
    setSendingMessage(clientId);
    try {
      // Check if conversation already exists for this client
      const { data: existingConvs } = await supabase
        .from("conversations")
        .select("id")
        .eq("client_id", clientId)
        .limit(1);

      if (existingConvs && existingConvs.length > 0) {
        // Conversation exists, navigate to messages
        router.push("/admin/messages");
      } else {
        // Create new conversation
        const defaultStaff = staffMembers[0];
        const { error: convError } = await supabase
          .from("conversations")
          .insert({
            client_id: clientId,
            coach_id: defaultStaff?.id || "staff-1",
            coach_name: clientName,
          });

        if (convError) {
          alert(`Failed to create conversation: ${convError.message}`);
        } else {
          router.push("/admin/messages");
        }
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setSendingMessage(null);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const filtered = clients
    .filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase());
      const matchesTier = filterTier === "All" || c.tier === filterTier;
      const matchesStatus = filterStatus === "All" || c.status === filterStatus;
      return matchesSearch && matchesTier && matchesStatus;
    })
    .sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
      return sortAsc ? cmp : -cmp;
    });

  const changeTier = async (clientId: string, subscriptionId: string | null, newTier: Tier) => {
    setSavingTier(clientId);

    // Optimistically update UI
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, tier: newTier } : c))
    );

    if (subscriptionId) {
      // Cancel existing subscription and create new one
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", subscriptionId);
    }

    const now = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: insertError } = await supabase
      .from("subscriptions")
      .insert({
        client_id: clientId,
        tier: newTier,
        status: "active",
        current_period_start: now,
        current_period_end: periodEnd,
        trial_ends_at: newTier === "free-trial"
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      });

    if (insertError) {
      await fetchClients();
      alert(`Failed to update tier: ${insertError.message}`);
    } else {
      await fetchClients();
    }

    setSavingTier(null);
  };

  const createSubscription = async (clientId: string) => {
    setCreatingSubscription(clientId);

    const now = new Date().toISOString();
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from("subscriptions")
      .insert({
        client_id: clientId,
        tier: "free-trial",
        status: "active",
        trial_ends_at: trialEnd,
        current_period_start: now,
        current_period_end: trialEnd,
      });

    if (insertError) {
      alert(`Failed to create subscription: ${insertError.message}`);
    } else {
      await fetchClients();
    }

    setCreatingSubscription(null);
  };

  const deleteClient = async (clientId: string) => {
    setDeletingClient(clientId);
    setStatusMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatusMessage({ type: "error", text: "Not authenticated. Please sign in again." });
        setDeletingClient(null);
        setDeleteConfirmId(null);
        return;
      }

      const response = await fetch(
        "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/delete-user",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmliZnh6bHR4aXJpcXh2dnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQxMDgsImV4cCI6MjA5MDQ1MDEwOH0.LHBADsUdW7SBtrxZ9KikTmAl5brBGPb3gFTMuPYrmD8",
          },
          body: JSON.stringify({ userId: clientId }),
        },
      );

      let result: Record<string, unknown>;
      try {
        result = await response.json();
      } catch {
        const text = await response.text().catch(() => "");
        setStatusMessage({ type: "error", text: `Failed to delete client (${response.status}): ${text || "Non-JSON response"}` });
        setDeletingClient(null);
        setDeleteConfirmId(null);
        return;
      }

      if (!response.ok) {
        const errMsg = (result.error as string) || (result.message as string) || JSON.stringify(result);
        setStatusMessage({ type: "error", text: `Failed to delete client: ${errMsg}` });
        setDeletingClient(null);
        setDeleteConfirmId(null);
        return;
      }

      // Remove from local state
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      if (expandedId === clientId) setExpandedId(null);
      setStatusMessage({ type: "success", text: "Client and all related data deleted successfully." });
    } catch (err) {
      setStatusMessage({ type: "error", text: `Delete failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    }
    setDeletingClient(null);
    setDeleteConfirmId(null);
  };

  const syncClients = async () => {
    setSyncing(true);
    setStatusMessage(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatusMessage({ type: "error", text: "Not authenticated. Please sign in again." });
        setSyncing(false);
        return;
      }

      const response = await fetch(
        "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/sync-users",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
        },
      );

      let result: Record<string, unknown>;
      try {
        result = await response.json();
      } catch {
        setStatusMessage({ type: "error", text: `Sync failed (${response.status})` });
        setSyncing(false);
        return;
      }

      if (!response.ok) {
        const errMsg = (result.error as string) || (result.message as string) || "Unknown error";
        setStatusMessage({ type: "error", text: `Sync failed: ${errMsg}` });
        setSyncing(false);
        return;
      }

      setStatusMessage({ type: "success", text: `Sync complete. ${result.created} new client(s) created from ${result.total} auth user(s).` });
      await fetchClients();
    } catch (err) {
      setStatusMessage({ type: "error", text: `Sync error: ${err instanceof Error ? err.message : "Unknown"}` });
    }
    setSyncing(false);
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === field && (
          <span className="text-[#20c858]">{sortAsc ? "\u2191" : "\u2193"}</span>
        )}
      </div>
    </th>
  );

  const handleAssignCoach = (clientId: string, staffId: string) => {
    setCoachAssignments((prev) => ({ ...prev, [clientId]: staffId }));
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("clients")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "clients"
              ? "bg-white text-[#1F2937] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Clients
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "staff"
              ? "bg-white text-[#1F2937] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Staff
        </button>
      </div>

      {/* Staff tab */}
      {activeTab === "staff" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-[#1F2937]">Team Members</h3>
            <p className="text-sm text-gray-500 mt-1">Internal staff who can be assigned to clients</p>
          </div>
          <div className="divide-y divide-gray-100">
            {staffMembers.map((staff) => (
              <div key={staff.id} className="px-6 py-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${staffRoleColors[staff.role]}`}>
                  {staff.avatarInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1F2937]">{staff.name}</p>
                  <p className="text-xs text-gray-500">{staff.email}</p>
                </div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${staffRoleColors[staff.role]}`}>
                  {staffRoleLabels[staff.role]}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${staff.active ? "bg-green-500" : "bg-gray-400"}`} />
                  <span className="text-xs text-gray-500">{staff.active ? "Active" : "Inactive"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clients tab */}
      {activeTab === "clients" && <>
      {/* Search / Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-72 focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none text-gray-900"
        />
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value as "All" | Tier | "none")}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none text-gray-900"
        >
          <option value="All">All Tiers</option>
          {tierOptions.map((t) => (
            <option key={t} value={t}>
              {tierLabels[t]}
            </option>
          ))}
          <option value="none">No Subscription</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "All" | Status)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] focus:border-transparent outline-none text-gray-900"
        >
          <option value="All">All Statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
        <button
          onClick={fetchClients}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
        <button
          onClick={syncClients}
          disabled={syncing || loading}
          className="px-4 py-2 text-sm font-medium text-white bg-[#20c858] rounded-lg hover:bg-[#1bb34d] transition-colors disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync"}
        </button>
        <span className="text-sm text-gray-400 ml-auto">
          {filtered.length} client{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Status message */}
      {statusMessage && (
        <div className={`rounded-lg p-3 text-sm ${statusMessage.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {statusMessage.text}
          <button onClick={() => setStatusMessage(null)} className="ml-2 text-xs underline">dismiss</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-gray-400">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm">Loading clients...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && clients.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center">
          <div className="text-gray-300 mb-3">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">No clients yet</p>
          <p className="text-gray-400 text-xs mt-1 mb-4">
            Clients will appear here once they sign up via the app.
          </p>
          <p className="text-gray-400 text-xs mb-4">
            If clients have signed up but are not showing, they may be missing a row in the clients table.
          </p>
          {/* Sync from auth button — requires service role key */}
          <button
            onClick={async () => {
              try {
                const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
                if (authErr) {
                  alert(`Sync failed: ${authErr.message}. Note: this requires a Supabase service role key, not the anon key.`);
                  return;
                }
                if (!authData?.users || authData.users.length === 0) {
                  alert("No auth users found.");
                  return;
                }
                let created = 0;
                for (const u of authData.users) {
                  const { data: existing } = await supabase
                    .from("clients")
                    .select("id")
                    .eq("id", u.id)
                    .maybeSingle();
                  if (!existing) {
                    await supabase.from("clients").insert({
                      id: u.id,
                      email: u.email || "",
                      full_name: (u.user_metadata?.full_name as string) || null,
                      phone: (u.user_metadata?.phone as string) || null,
                    });
                    created++;
                  }
                }
                alert(`Synced ${created} new client(s) from auth users.`);
                await fetchClients();
              } catch (err) {
                alert(`Sync failed: ${err instanceof Error ? err.message : "Unknown error"}. Note: this requires a Supabase service role key configured on the server.`);
              }
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-[#20c858] rounded-lg hover:bg-[#1bb34d] transition-colors"
          >
            Sync from Auth Users
          </button>
          <p className="text-gray-300 text-[10px] mt-2">
            Requires service role key (not anon key)
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && clients.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortHeader label="Name" field="name" />
                  <SortHeader label="Email" field="email" />
                  <SortHeader label="Tier" field="tier" />
                  <SortHeader label="Status" field="status" />
                  <SortHeader label="Joined" field="joined" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((client, idx) => (
                  <ClientRowComponent
                    key={client.id}
                    client={client}
                    isEven={idx % 2 === 1}
                    isExpanded={expandedId === client.id}
                    isSaving={savingTier === client.id}
                    isCreating={creatingSubscription === client.id}
                    isDeleting={deletingClient === client.id}
                    showDeleteConfirm={deleteConfirmId === client.id}
                    onToggle={() =>
                      setExpandedId(
                        expandedId === client.id ? null : client.id
                      )
                    }
                    onChangeTier={changeTier}
                    onCreateSubscription={createSubscription}
                    onDeleteClick={() => setDeleteConfirmId(client.id)}
                    onDeleteConfirm={() => deleteClient(client.id)}
                    onDeleteCancel={() => setDeleteConfirmId(null)}
                    assignedCoachId={coachAssignments[client.id] || (staffMembers[0]?.id ?? "staff-1")}
                    onAssignCoach={handleAssignCoach}
                    staffMembers={staffMembers}
                    onSendMessage={handleSendMessageToClient}
                    isSendingMessage={sendingMessage === client.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">
              No clients found matching your filters.
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  );
}

function ClientRowComponent({
  client,
  isEven,
  isExpanded,
  isSaving,
  isCreating,
  isDeleting,
  showDeleteConfirm,
  onToggle,
  onChangeTier,
  onCreateSubscription,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
  assignedCoachId,
  onAssignCoach,
  staffMembers,
  onSendMessage,
  isSendingMessage,
}: {
  client: Client;
  isEven: boolean;
  isExpanded: boolean;
  isSaving: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  showDeleteConfirm: boolean;
  onToggle: () => void;
  onChangeTier: (clientId: string, subscriptionId: string | null, tier: Tier) => void;
  onCreateSubscription: (clientId: string) => void;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  assignedCoachId: string;
  onAssignCoach: (clientId: string, staffId: string) => void;
  staffMembers: StaffMember[];
  onSendMessage: (clientId: string, clientName: string) => void;
  isSendingMessage: boolean;
}) {
  const assignedStaff = staffMembers.find((s) => s.id === assignedCoachId);
  const isActive = client.status === "active" || client.status === "trial";
  const trialDays = daysUntil(client.trialEndsAt);
  const trialExpiring = client.status === "trial" && trialDays !== null && trialDays <= 7 && trialDays >= 0;

  return (
    <>
      <tr
        className={`cursor-pointer hover:bg-gray-50 transition-colors ${
          isEven ? "bg-gray-50/50" : ""
        }`}
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-sm font-medium text-[#1F2937]">
          {client.name}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{client.email}</td>
        <td className="px-4 py-3">
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
              tierColors[client.tier]
            }`}
          >
            {tierLabels[client.tier]}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                statusColors[client.status]
              }`}
            />
            <span className="text-sm text-gray-600">
              {statusLabels[client.status]}
            </span>
            {trialExpiring && (
              <span className="text-xs text-amber-600 font-medium">
                ({trialDays}d left)
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{client.joined}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="bg-gray-50 px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profile */}
              <div>
                <h4 className="text-sm font-semibold text-[#1F2937] mb-2">
                  Profile
                </h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Phone: {client.phone || "Not provided"}</p>
                  <p>Member since: {client.joined}</p>
                </div>

                {/* Assigned Coach */}
                <h4 className="text-sm font-semibold text-[#1F2937] mb-2 mt-4">
                  Assigned Coach
                </h4>
                <div className="flex items-center gap-2">
                  {assignedStaff && (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${staffRoleColors[assignedStaff.role]}`}>
                      {assignedStaff.avatarInitial}
                    </div>
                  )}
                  <select
                    value={assignedCoachId}
                    onChange={(e) => {
                      e.stopPropagation();
                      onAssignCoach(client.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                  >
                    {staffMembers.filter((s) => s.active).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({staffRoleLabels[s.role]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subscription */}
              <div>
                <h4 className="text-sm font-semibold text-[#1F2937] mb-2">
                  Subscription
                </h4>
                <div className="space-y-2">
                  {client.tier === "none" ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">No active subscription</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateSubscription(client.id);
                        }}
                        disabled={isCreating}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-[#20c858] rounded-lg hover:bg-[#1bb34d] transition-colors disabled:opacity-50"
                      >
                        {isCreating ? "Creating..." : "Create Free Trial"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Tier:</label>
                        <select
                          value={client.tier}
                          onChange={(e) => {
                            e.stopPropagation();
                            onChangeTier(client.id, client.subscriptionId, e.target.value as Tier);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isSaving}
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900 disabled:opacity-50"
                        >
                          {tierOptions.map((t) => (
                            <option key={t} value={t}>
                              {tierLabels[t]}
                            </option>
                          ))}
                        </select>
                        {isSaving && (
                          <span className="text-xs text-gray-400">Saving...</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          Status:{" "}
                          <span className={`font-medium ${
                            client.status === "active" ? "text-green-600" :
                            client.status === "trial" ? "text-yellow-600" :
                            client.status === "cancelled" ? "text-gray-500" :
                            "text-red-500"
                          }`}>
                            {statusLabels[client.status]}
                          </span>
                        </p>
                        {client.trialEndsAt && (
                          <p>
                            Trial ends: {client.trialEndsAt}
                            {trialDays !== null && trialDays >= 0 && (
                              <span className={`ml-1 text-xs font-medium ${trialDays <= 3 ? "text-red-500" : trialDays <= 7 ? "text-amber-500" : "text-gray-400"}`}>
                                ({trialDays} day{trialDays !== 1 ? "s" : ""} remaining)
                              </span>
                            )}
                            {trialDays !== null && trialDays < 0 && (
                              <span className="ml-1 text-xs font-medium text-red-500">
                                (expired)
                              </span>
                            )}
                          </p>
                        )}
                        {client.subscriptionStart && (
                          <p>
                            Period: {client.subscriptionStart}
                            {client.subscriptionEnd ? ` to ${client.subscriptionEnd}` : ""}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div>
                <h4 className="text-sm font-semibold text-[#1F2937] mb-2">
                  Actions
                </h4>
                <button
                  onClick={(e) => { e.stopPropagation(); onSendMessage(client.id, client.name); }}
                  disabled={isSendingMessage}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#20c858] rounded-lg hover:bg-[#1bb34d] transition-colors disabled:opacity-50 mb-2 flex items-center gap-1.5"
                >
                  {isSendingMessage ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Opening...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      Send message
                    </>
                  )}
                </button>
                {showDeleteConfirm ? (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                    <p className="text-sm text-red-700 font-medium">
                      Are you sure you want to permanently delete this client and all their data?
                    </p>
                    <p className="text-xs text-red-500">
                      This will remove their subscriptions, action completions, conversations, and client profile. This cannot be undone.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteConfirm(); }}
                        disabled={isDeleting}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? "Deleting..." : "Yes, delete permanently"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteCancel(); }}
                        disabled={isDeleting}
                        className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteClick(); }}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Delete client
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
