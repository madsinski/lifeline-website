"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { supabase } from "@/lib/supabase";

/*
  SQL to create the staff table (also in /supabase/staff.sql):

  CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('coach', 'doctor', 'nurse', 'psychologist', 'admin')),
    permissions TEXT[] DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    invited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Allow all staff operations" ON staff USING (true) WITH CHECK (true);
*/

// ─── Types ───────────────────────────────────────────────────

type StaffRole = "coach" | "doctor" | "nurse" | "psychologist" | "admin";
type Permission = "manage_clients" | "manage_programs" | "manage_team" | "view_analytics" | "send_messages" | "app_user_access";

const allPermissions: { key: Permission; label: string; description: string }[] = [
  { key: "manage_clients", label: "Manage Clients", description: "View, edit, and delete client profiles" },
  { key: "manage_programs", label: "Manage Programs", description: "Create and edit coaching programs" },
  { key: "manage_team", label: "Manage Team", description: "Add, edit, and remove team members" },
  { key: "view_analytics", label: "View Analytics", description: "Access analytics and reports" },
  { key: "send_messages", label: "Send Messages", description: "Message clients directly" },
  { key: "app_user_access", label: "Access Lifeline as a user", description: "Can use the Lifeline app as a regular member (grants free subscription)" },
];

const defaultPermissions: Record<StaffRole, Permission[]> = {
  admin: ["manage_clients", "manage_programs", "manage_team", "view_analytics", "send_messages"],
  coach: ["manage_clients", "manage_programs", "send_messages"],
  doctor: ["manage_clients", "view_analytics"],
  nurse: ["manage_clients", "send_messages"],
  psychologist: ["manage_clients", "send_messages"],
};

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  active: boolean;
  permissions: Permission[];
  invited: boolean;
}

const roleLabels: Record<StaffRole, string> = {
  coach: "Coach",
  doctor: "Doctor",
  nurse: "Nurse",
  psychologist: "Psychologist",
  admin: "Admin",
};

const roleColors: Record<StaffRole, string> = {
  coach: "bg-emerald-100 text-emerald-700",
  doctor: "bg-blue-100 text-blue-700",
  nurse: "bg-purple-100 text-purple-700",
  psychologist: "bg-amber-100 text-amber-700",
  admin: "bg-gray-100 text-gray-700",
};

const roleOptions: StaffRole[] = ["coach", "doctor", "nurse", "psychologist", "admin"];

// ─── Fallback mock data ───────────────────────────────────────

const fallbackTeam: TeamMember[] = [
  { id: "staff-1", name: "Coach Sarah", email: "sarah@lifeline.is", phone: "+354 555 1001", role: "coach", active: true, permissions: defaultPermissions.coach, invited: true },
  { id: "staff-2", name: "Dr. Gudmundur Sigurdsson", email: "gudmundur@lifeline.is", phone: "+354 555 1002", role: "doctor", active: true, permissions: defaultPermissions.doctor, invited: true },
  { id: "staff-3", name: "Helga Jonsdottir", email: "helga@lifeline.is", phone: "+354 555 1003", role: "nurse", active: true, permissions: defaultPermissions.nurse, invited: true },
  { id: "staff-4", name: "Dr. Anna Kristjansdottir", email: "anna.k@lifeline.is", phone: "+354 555 1004", role: "psychologist", active: true, permissions: defaultPermissions.psychologist, invited: true },
];

// ─── Connection status type ───────────────────────────────────

type ConnectionStatus = "loading" | "connected" | "offline";

// ─── Component ──────────────────────────────────────────────

const STAFF_TABLE_SQL = `CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('coach', 'doctor', 'nurse', 'psychologist', 'admin')),
  permissions TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  invited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all staff operations" ON staff USING (true) WITH CHECK (true);`;

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<TeamMember>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("loading");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ type: "success" | "error" | "sql"; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  // Add member form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<StaffRole>("coach");
  const [newPermissions, setNewPermissions] = useState<Permission[]>(defaultPermissions.coach);
  const [sendInvite, setSendInvite] = useState(true);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState(false);

  // Update permissions when role changes
  const handleRoleChange = (role: StaffRole) => {
    setNewRole(role);
    setNewPermissions(defaultPermissions[role]);
  };

  const togglePermission = (perm: Permission) => {
    setNewPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  // ─── Load staff from Supabase on mount ───────────────────

  const loadStaff = useCallback(async () => {
    setConnectionStatus("loading");
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.log("[Team] Supabase error loading staff:", error.message);
        setConnectionStatus("offline");
        setTeam(fallbackTeam);
        return;
      }

      if (data && data.length > 0) {
        setTeam(
          data.map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone || "",
            role: row.role as StaffRole,
            active: row.active ?? true,
            permissions: (row.permissions as Permission[]) || defaultPermissions[row.role as StaffRole] || [],
            invited: row.invited ?? false,
          }))
        );
        setConnectionStatus("connected");
      } else {
        // Table exists but is empty — use fallback and seed the table
        setTeam(fallbackTeam);
        setConnectionStatus("connected");
        // Seed fallback data into Supabase
        for (const member of fallbackTeam) {
          await supabase.from("staff").insert({
            name: member.name,
            email: member.email,
            phone: member.phone,
            role: member.role,
            active: member.active,
          });
        }
        // Reload to get proper UUIDs
        const { data: seededData } = await supabase
          .from("staff")
          .select("*")
          .order("created_at", { ascending: true });
        if (seededData && seededData.length > 0) {
          setTeam(
            seededData.map((row) => ({
              id: row.id,
              name: row.name,
              email: row.email,
              phone: row.phone || "",
              role: row.role as StaffRole,
              active: row.active ?? true,
              permissions: (row.permissions as Permission[]) || defaultPermissions[row.role as StaffRole] || [],
              invited: row.invited ?? false,
            }))
          );
        }
      }
    } catch {
      console.log("[Team] Failed to connect to Supabase, using fallback data");
      setConnectionStatus("offline");
      setTeam(fallbackTeam);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // ─── Handlers ────────────────────────────────────────────

  const handleAdd = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setSaveError(null);
    setInviteStatus(null);

    const memberData = {
      name: newName.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim(),
      role: newRole,
      permissions: newPermissions,
      active: true,
      invited: false,
    };

    let addedMember: TeamMember | null = null;

    if (connectionStatus === "connected") {
      const { data, error } = await supabase
        .from("staff")
        .insert(memberData)
        .select()
        .single();

      if (error) {
        setSaveError(`Failed to add: ${error.message}`);
        return;
      }

      if (data) {
        addedMember = {
          id: data.id,
          name: data.name,
          email: data.email,
          phone: data.phone || "",
          role: data.role as StaffRole,
          active: data.active ?? true,
          permissions: (data.permissions as Permission[]) || newPermissions,
          invited: data.invited ?? false,
        };
        setTeam((prev) => [...prev, addedMember!]);
      }
    } else {
      addedMember = {
        id: `staff-${Date.now()}`,
        ...memberData,
      };
      setTeam((prev) => [...prev, addedMember!]);
    }

    // Send invite email via Edge Function
    if (sendInvite && addedMember) {
      setInviteSending(true);
      setInviteStatus("Sending invite...");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const resp = await fetch(
            "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/invite-team",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ email: newEmail.trim(), name: newName.trim(), role: newRole }),
            },
          );
          const result = await resp.json();
          if (resp.ok) {
            if (connectionStatus === "connected" && addedMember.id) {
              await supabase.from("staff").update({ invited: true }).eq("id", addedMember.id);
            }
            setTeam(prev => prev.map(m => m.id === addedMember!.id ? { ...m, invited: true } : m));
            setInviteStatus(`Invite email sent to ${newEmail.trim()}`);
          } else {
            setInviteStatus(`Invite failed: ${result.error || "Unknown error"}`);
          }
        } else {
          setInviteStatus(`Not authenticated — could not send invite.`);
        }
      } catch {
        setInviteStatus(`Could not send invite email.`);
      }
      setInviteSending(false);
    }

    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewRole("coach");
    setNewPermissions(defaultPermissions.coach);
    setShowAddModal(false);
  };

  const handleRemoveClick = (member: TeamMember) => {
    setDeleteTarget(member);
    setDeleteConfirmName("");
  };

  const handleRemoveConfirm = async () => {
    if (!deleteTarget) return;
    setSaveError(null);

    if (connectionStatus === "connected") {
      // Delete from staff table
      const { error } = await supabase.from("staff").delete().eq("id", deleteTarget.id);
      if (error) {
        setSaveError(`Failed to remove: ${error.message}`);
        setDeleteTarget(null);
        setDeleteConfirmName("");
        return;
      }

      // Also delete from auth.users via Edge Function
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch(
            "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/delete-user",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
                "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmliZnh6bHR4aXJpcXh2dnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQxMDgsImV4cCI6MjA5MDQ1MDEwOH0.LHBADsUdW7SBtrxZ9KikTmAl5brBGPb3gFTMuPYrmD8",
              },
              body: JSON.stringify({ userId: deleteTarget.id }),
            },
          );
        }
      } catch {
        // Auth deletion is best-effort — staff row is already gone
      }

      // Clean up: delete conversations and messages where this staff was coach
      try {
        await supabase.from("conversations").delete().eq("coach_id", deleteTarget.id);
      } catch {}
    }

    setTeam((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleteConfirmName("");
  };

  const toggleActive = async (id: string) => {
    setSaveError(null);
    const member = team.find((m) => m.id === id);
    if (!member) return;

    const newActive = !member.active;

    if (connectionStatus === "connected") {
      const { error } = await supabase
        .from("staff")
        .update({ active: newActive })
        .eq("id", id);
      if (error) {
        setSaveError(`Failed to update: ${error.message}`);
        return;
      }
    }

    setTeam((prev) =>
      prev.map((m) => (m.id === id ? { ...m, active: newActive } : m))
    );
  };

  const startEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setEditValues({ name: member.name, email: member.email, phone: member.phone, role: member.role, permissions: member.permissions });
  };

  const saveEdit = async (id: string) => {
    setSaveError(null);

    if (connectionStatus === "connected") {
      const { error } = await supabase
        .from("staff")
        .update({
          name: editValues.name,
          email: editValues.email,
          phone: editValues.phone,
          role: editValues.role,
          permissions: editValues.permissions,
        })
        .eq("id", id);
      if (error) {
        setSaveError(`Failed to save: ${error.message}`);
        return;
      }
    }

    setTeam((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, ...editValues }
          : m
      )
    );
    setEditingId(null);
    setEditValues({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const syncStaff = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { error: tableErr } = await supabase.from("staff").select("id").limit(1);
      if (tableErr) {
        // Table doesn't exist — show SQL
        setSyncResult({ type: "sql", text: STAFF_TABLE_SQL });
        setSyncing(false);
        return;
      }
      // Table exists — show status
      setSyncResult({ type: "success", text: `Staff table connected. ${team.length} member(s) loaded.` });
    } catch {
      setSyncResult({ type: "error", text: "Failed to check staff table." });
    }
    setSyncing(false);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-[#1F2937]">Team Management</h2>
            {/* Connection status indicator */}
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-green-500"
                    : connectionStatus === "loading"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-400"
                }`}
              />
              <span className="text-xs text-gray-400">
                {connectionStatus === "connected"
                  ? "Synced with Supabase"
                  : connectionStatus === "loading"
                  ? "Connecting..."
                  : "Offline (local only)"}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage staff members who can be assigned to clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncStaff}
            disabled={syncing}
            className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {syncing ? "Checking..." : "Sync"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#1bb34d] transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add team member
          </button>
        </div>
      </div>

      {/* Invite status */}
      {inviteStatus && (
        <div className={`rounded-lg p-3 text-sm flex items-center justify-between ${
          inviteSending ? "bg-yellow-50 border border-yellow-200 text-yellow-700" :
          inviteStatus.startsWith("Invite email sent") ? "bg-green-50 border border-green-200 text-green-700" :
          inviteStatus.includes("failed") || inviteStatus.includes("Could not") || inviteStatus.includes("Not authenticated") ? "bg-red-50 border border-red-200 text-red-700" :
          "bg-blue-50 border border-blue-200 text-blue-700"
        }`}>
          <span className="flex items-center gap-2">
            {inviteSending && <span className="inline-block w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />}
            {inviteStatus}
          </span>
          {!inviteSending && <button onClick={() => setInviteStatus(null)} className="text-gray-400 hover:text-gray-600 ml-2">&times;</button>}
        </div>
      )}

      {/* Sync result */}
      {syncResult && (
        <div className={`rounded-lg p-3 text-sm ${
          syncResult.type === "success" ? "bg-green-50 border border-green-200 text-green-700" :
          syncResult.type === "error" ? "bg-red-50 border border-red-200 text-red-700" :
          "bg-blue-50 border border-blue-200 text-blue-700"
        }`}>
          {syncResult.type === "sql" ? (
            <div>
              <p className="font-medium mb-2">Staff table not found. Run this SQL in the Supabase SQL Editor:</p>
              <pre className="bg-white rounded p-2 text-xs overflow-x-auto whitespace-pre-wrap mb-2">{syncResult.text}</pre>
              <button
                onClick={() => { navigator.clipboard.writeText(syncResult.text); setSyncResult({ type: "success", text: "SQL copied to clipboard!" }); }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Copy SQL
              </button>
            </div>
          ) : (
            <>
              {syncResult.text}
              <button onClick={() => setSyncResult(null)} className="ml-2 text-xs underline">dismiss</button>
            </>
          )}
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold text-[#1F2937]">{team.length}</p>
          <p className="text-xs text-gray-500">Total members</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold text-green-600">{team.filter((m) => m.active).length}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold text-gray-400">{team.filter((m) => !m.active).length}</p>
          <p className="text-xs text-gray-500">Inactive</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-2xl font-bold text-[#1F2937]">{new Set(team.map((m) => m.role)).size}</p>
          <p className="text-xs text-gray-500">Roles</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {team.map((member, idx) => {
                const isEditing = editingId === member.id;
                return (
                  <Fragment key={member.id}>
                  <tr className={idx % 2 === 1 ? "bg-gray-50/50" : ""}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${roleColors[member.role]}`}>
                          {getInitials(member.name)}
                        </div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.name ?? ""}
                            onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900 w-40"
                          />
                        ) : (
                          <span className="text-sm font-medium text-[#1F2937]">{member.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="email"
                          value={editValues.email ?? ""}
                          onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900 w-48"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">{member.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editValues.phone ?? ""}
                          onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900 w-36"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">{member.phone || "Not set"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editValues.role ?? member.role}
                          onChange={(e) => setEditValues({ ...editValues, role: e.target.value as StaffRole })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#0D9488] outline-none text-gray-900"
                        >
                          {roleOptions.map((r) => (
                            <option key={r} value={r}>{roleLabels[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[member.role]}`}>
                          {roleLabels[member.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(member.id)}
                        className="flex items-center gap-2 group"
                      >
                        <div className={`relative w-9 h-5 rounded-full transition-colors ${member.active ? "bg-[#0D9488]" : "bg-gray-300"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${member.active ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                        <span className={`text-xs ${member.active ? "text-green-600" : "text-gray-400"}`}>
                          {member.active ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(member.id)}
                              className="px-3 py-1 text-xs font-medium text-white bg-[#0D9488] rounded hover:bg-[#1bb34d] transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(member)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const { error } = await supabase.auth.resetPasswordForEmail(member.email, {
                                    redirectTo: `${window.location.origin}/admin/login`,
                                  });
                                  if (error) {
                                    alert(`Failed: ${error.message}`);
                                  } else {
                                    alert(`Password reset email sent to ${member.email}`);
                                  }
                                } catch {
                                  alert("Failed to send reset email");
                                }
                              }}
                              className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
                              title="Resend login details"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRemoveClick(member)}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Permissions</p>
                        <div className="flex flex-wrap gap-3">
                          {allPermissions.map((perm) => (
                            <label key={perm.key} className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                              <input
                                type="checkbox"
                                checked={(editValues.permissions || []).includes(perm.key)}
                                onChange={() => {
                                  const current = editValues.permissions || [];
                                  const updated = current.includes(perm.key)
                                    ? current.filter((p: Permission) => p !== perm.key)
                                    : [...current, perm.key];
                                  setEditValues({ ...editValues, permissions: updated });
                                }}
                                className="w-3.5 h-3.5 text-[#0D9488] border-gray-300 rounded focus:ring-[#0D9488]"
                              />
                              <span className="text-xs font-medium text-gray-700">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {team.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No team members yet. Click &quot;Add team member&quot; to get started.
          </div>
        )}
      </div>

      {/* Connection info note */}
      {connectionStatus === "offline" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
          <strong>Offline mode:</strong> Changes are stored locally and will not persist after page reload.
          To enable persistence, run the SQL in <code>/supabase/staff.sql</code> in the Supabase SQL editor.
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-600">Remove team member</h3>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${roleColors[deleteTarget.role]}`}>
                  {getInitials(deleteTarget.name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{deleteTarget.name}</p>
                  <p className="text-xs text-gray-500">{roleLabels[deleteTarget.role]}</p>
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">
                  This will permanently remove <strong>{deleteTarget.name}</strong> from the team. Any assigned clients will need to be reassigned.
                </p>
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <strong>{deleteTarget.name}</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteTarget.name}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-gray-900"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveConfirm}
                disabled={deleteConfirmName !== deleteTarget.name}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#1F2937]">Add team member</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@lifeline.is"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+354 555 0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0D9488] focus:border-transparent outline-none text-gray-900"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>{roleLabels[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="space-y-2">
                  {allPermissions.map((perm) => (
                    <label key={perm.key} className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPermissions.includes(perm.key)}
                        onChange={() => togglePermission(perm.key)}
                        className="mt-0.5 w-4 h-4 text-[#0D9488] border-gray-300 rounded focus:ring-[#0D9488]"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">{perm.label}</span>
                        <p className="text-xs text-gray-400">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendInvite}
                    onChange={(e) => setSendInvite(e.target.checked)}
                    className="w-4 h-4 text-[#0D9488] border-gray-300 rounded focus:ring-[#0D9488]"
                  />
                  <span className="text-sm font-medium text-gray-700">Send invite email</span>
                </label>
                <p className="text-xs text-gray-400 ml-6.5 mt-0.5">The team member will receive an email to set up their account</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newEmail.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#1bb34d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendInvite ? "Add & Send Invite" : "Add Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
