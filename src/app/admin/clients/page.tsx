"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAllClientsProgress, ProgressIndicator, getNudgeStatus, nudgeConfig, type NudgeStatus } from "./ClientProgressPanel";
import ClientCategoryPanel from "./ClientCategoryPanel";
import { AppointmentsCard, MessagesCard } from "./ClientSidePanels";

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
  terms_accepted_at: string | null;
  terms_version: string | null;
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
  termsAcceptedAt: string | null;
  termsVersion: string | null;
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
    termsAcceptedAt: row.terms_accepted_at || null,
    termsVersion: row.terms_version || null,
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
  const searchParams = useSearchParams();
  const [expandedId, setExpandedId] = useState<string | null>(searchParams.get("expand") || null);
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
  const [expandAll, setExpandAll] = useState(false);
  const [filterNudge, setFilterNudge] = useState<"All" | NudgeStatus>("All");

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

        // Build coach assignments from data
        const assignments: Record<string, string> = {};
        for (const row of clientsData) {
          if ((row as Record<string, unknown>).assigned_coach_id) {
            assignments[row.id as string] = (row as Record<string, unknown>).assigned_coach_id as string;
          }
        }
        setCoachAssignments(prev => ({ ...prev, ...assignments }));

        const normalized = clientsData.map((row) => {
          const clientRow: ClientRow = {
            ...row,
            subscriptions: subsMap[row.id] || [],
          } as ClientRow;
          return normalizeClient(clientRow);
        });

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
                termsAcceptedAt: null,
                termsVersion: null,
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
        // Try with permissions filter first, fall back to all active staff
        let data: Record<string, unknown>[] | null = null;
        const { data: d1, error: e1 } = await supabase
          .from("staff")
          .select("*")
          .eq("active", true)
          .contains("permissions", ["send_messages"]);
        if (!e1 && d1 && d1.length > 0) {
          data = d1;
        } else {
          // Permissions column may not exist yet — load all active staff
          const { data: d2 } = await supabase
            .from("staff")
            .select("*")
            .eq("active", true);
          if (d2 && d2.length > 0) data = d2;
        }

        if (data && data.length > 0) {
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
        const isRealUUID = defaultStaff?.id && !defaultStaff.id.startsWith("staff-");
        const { error: convError } = await supabase
          .from("conversations")
          .insert({
            client_id: clientId,
            coach_id: isRealUUID ? defaultStaff.id : null,
            coach_name: defaultStaff?.name || "Coach",
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

  // Batch progress data for all clients
  const clientIds = useMemo(() => clients.map((c) => c.id), [clients]);
  const { progressMap, loading: progressLoading } = useAllClientsProgress(clientIds);

  const filtered = clients
    .filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase());
      const matchesTier = filterTier === "All" || c.tier === filterTier;
      const matchesStatus = filterStatus === "All" || c.status === filterStatus;
      const matchesNudge = filterNudge === "All" || getNudgeStatus(progressMap[c.id] || null) === filterNudge;
      return matchesSearch && matchesTier && matchesStatus && matchesNudge;
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

  const cleanOrphans = async () => {
    setStatusMessage(null);
    try {
      const { data, error } = await supabase.rpc('clean_orphaned_clients');
      if (error) {
        setStatusMessage({ type: 'error', text: `Cleanup failed: ${error.message}` });
      } else {
        const removed = data ?? 0;
        setStatusMessage({ type: 'success', text: removed > 0 ? `Removed ${removed} orphaned client record(s).` : 'No orphaned records found.' });
        if (removed > 0) await fetchClients();
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Cleanup error: ${err instanceof Error ? err.message : 'Unknown'}` });
    }
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

      // Clean up orphaned clients (exist in clients table but not in auth)
      const authUserIds = (result.authUserIds as string[]) || [];
      let orphansRemoved = 0;
      if (authUserIds.length > 0) {
        const { data: allClients } = await supabase.from("clients").select("id");
        if (allClients) {
          const authSet = new Set(authUserIds);
          const orphans = allClients.filter((c: { id: string }) => !authSet.has(c.id));
          for (const orphan of orphans) {
            const { error: delErr } = await supabase.from("clients").delete().eq("id", orphan.id);
            if (!delErr) orphansRemoved++;
          }
        }
      }
      const orphanMsg = orphansRemoved > 0 ? ` Removed ${orphansRemoved} orphaned record(s).` : '';
      setStatusMessage({ type: "success", text: `Sync complete. ${result.created} new client(s) created from ${result.total} auth user(s).${orphanMsg}` });
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
          <span className="text-[#10B981]">{sortAsc ? "\u2191" : "\u2193"}</span>
        )}
      </div>
    </th>
  );

  const handleAssignCoach = async (clientId: string, staffId: string) => {
    setCoachAssignments((prev) => ({ ...prev, [clientId]: staffId }));
    // Persist to Supabase
    try {
      await supabase.from("clients").update({ assigned_coach_id: staffId }).eq("id", clientId);
    } catch {}
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
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-72 focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
        />
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value as "All" | Tier | "none")}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
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
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
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
        <select
          value={filterNudge}
          onChange={(e) => setFilterNudge(e.target.value as "All" | NudgeStatus)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
        >
          <option value="All">All Progress</option>
          <option value="inactive">Inactive</option>
          <option value="needs-nudge">Needs Nudge</option>
          <option value="on-track">On Track</option>
          <option value="no-program">No Program</option>
        </select>
        <button
          onClick={syncClients}
          disabled={syncing || loading}
          className="px-4 py-2 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#10B981] transition-colors disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync"}
        </button>
        <button
          onClick={() => setExpandAll(!expandAll)}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {expandAll ? "Collapse all" : "Expand all"}
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
            className="px-4 py-2 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#10B981] transition-colors"
          >
            Sync from Auth Users
          </button>
          <button
            onClick={cleanOrphans}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors"
          >
            Clean orphaned records
          </button>
          <p className="text-gray-300 text-[10px] mt-2">
            Sync requires service role key · Clean removes clients deleted from Auth
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Coach</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Terms</th>
                  <SortHeader label="Joined" field="joined" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((client, idx) => (
                  <ClientRowComponent
                    key={client.id}
                    client={client}
                    isEven={idx % 2 === 1}
                    isExpanded={expandAll || expandedId === client.id}
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
                    progress={progressMap[client.id] || null}
                    progressLoading={progressLoading}
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

// ─── Client Row Component ──────────────────────────────────


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
  progress,
  progressLoading,
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
  progress: import("./ClientProgressPanel").ClientProgressData | null;
  progressLoading: boolean;
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
        <td className="px-4 py-3">
          <ProgressIndicator progress={progress} loading={progressLoading} />
        </td>
        <td className="px-4 py-3">
          {assignedStaff ? (
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${staffRoleColors[assignedStaff.role]}`}>{assignedStaff.avatarInitial}</div>
              <span className="text-xs text-gray-600 truncate max-w-[80px]">{assignedStaff.name.split(" ")[0]}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          {client.termsAcceptedAt ? (
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs text-gray-500">v{client.termsVersion || "1.0"}</span>
            </div>
          ) : (
            <span className="text-xs text-red-400 font-medium">Not accepted</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{client.joined}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="bg-gray-50/80 px-5 py-4">
            {/* Profile header card */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-3">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-[#10B981]/10 flex items-center justify-center text-lg font-bold text-[#10B981] flex-shrink-0">
                  {client.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-[#1F2937]">{client.name}</h3>
                  <p className="text-xs text-gray-500">{client.email}{client.phone ? ` · ${client.phone}` : ""}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${tierColors[client.tier]}`}>
                      {tierLabels[client.tier]}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusColors[client.status]}`} />
                      <span className="text-[10px] text-gray-500">{statusLabels[client.status]}</span>
                    </span>
                    {trialExpiring && <span className="text-[10px] text-amber-600 font-medium">({trialDays}d left)</span>}
                    <span className="text-[10px] text-gray-400">Joined {client.joined}</span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {/* Coach selector */}
                  <select value={assignedCoachId} onChange={(e) => onAssignCoach(client.id, e.target.value)}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900">
                    {staffMembers.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {/* Message */}
                  <button onClick={() => onSendMessage(client.id, client.name)} disabled={isSendingMessage}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0EA5E9] border border-[#0EA5E9] rounded-lg hover:bg-[#0EA5E9]/5 transition-colors disabled:opacity-50">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    Message
                  </button>
                  {/* Profile */}
                  <a href={`/admin/clients/${client.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Profile
                  </a>
                  {/* Subscription */}
                  {client.tier === "none" ? (
                    <button onClick={() => onCreateSubscription(client.id)} disabled={isCreating}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-[#10B981] rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                      {isCreating ? "..." : "+ Plan"}
                    </button>
                  ) : (
                    <select value={client.tier} onChange={(e) => onChangeTier(client.id, client.subscriptionId, e.target.value as Tier)} disabled={isSaving}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900 disabled:opacity-50">
                      {tierOptions.map((t) => <option key={t} value={t}>{tierLabels[t]}</option>)}
                    </select>
                  )}
                  {/* Delete */}
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => onDeleteConfirm()} disabled={isDeleting}
                        className="px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg disabled:opacity-50">{isDeleting ? "..." : "Delete"}</button>
                      <button onClick={() => onDeleteCancel()}
                        className="px-2.5 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => onDeleteClick()}
                      className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="Delete client">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Two-column layout: categories (50%) + appointments/messages (50%) */}
            <div className="flex gap-3">
              {/* Left: category panel */}
              <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <ClientCategoryPanel clientId={client.id} clientName={client.name} tier={client.tier} />
              </div>
              {/* Right: appointments + messages stacked */}
              <div className="flex-1 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                <AppointmentsCard clientId={client.id} />
                <MessagesCard clientId={client.id} clientName={client.name} onSendMessage={onSendMessage} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
