"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { supabase } from "@/lib/supabase";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import StaffLegalButton from "./StaffLegalButton";

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

// ─── Crop helper ────────────────────────────────────────────

async function getCroppedImg(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve) => { image.onload = () => resolve(); image.src = imageSrc; });
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.9));
}

// ─── Types ───────────────────────────────────────────────────

type StaffRole = "coach" | "doctor" | "nurse" | "psychologist" | "admin" | "lawyer";
type Permission = "manage_clients" | "manage_programs" | "manage_team" | "view_analytics" | "send_messages" | "app_user_access" | "view_legal";

const allPermissions: { key: Permission; label: string; description: string }[] = [
  { key: "manage_clients", label: "Manage Clients", description: "View, edit, and delete client profiles" },
  { key: "manage_programs", label: "Manage Programs", description: "Create and edit coaching programs" },
  { key: "manage_team", label: "Manage Team", description: "Add, edit, and remove team members" },
  { key: "view_analytics", label: "View Analytics", description: "Access analytics and reports" },
  { key: "send_messages", label: "Send Messages", description: "Message clients directly" },
  { key: "app_user_access", label: "Access Lifeline as a user", description: "Can use the Lifeline app as a regular member (grants free subscription)" },
  { key: "view_legal", label: "View Legal Documents", description: "External counsel: read and sign off on legal documents only — no client data access" },
];

const defaultPermissions: Record<StaffRole, Permission[]> = {
  admin: ["manage_clients", "manage_programs", "manage_team", "view_analytics", "send_messages"],
  coach: ["manage_clients", "manage_programs", "send_messages"],
  doctor: ["manage_clients", "view_analytics"],
  nurse: ["manage_clients", "send_messages"],
  psychologist: ["manage_clients", "send_messages"],
  lawyer: ["view_legal"],
};

type EmploymentType = "salaried" | "piece_rate" | "contractor" | "shareholder";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  employment_type: EmploymentType | null;
  active: boolean;
  permissions: Permission[];
  invited: boolean;
  avatar_url?: string | null;
  specialty?: string | null;
  bio?: string | null;
  years_experience?: number | null;
  qualifications?: string[] | null;
}

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  salaried: "Salaried",
  piece_rate: "Piece-rate (2 000 ISK/mæling)",
  contractor: "Independent contractor",
  shareholder: "Shareholder (no payment relationship)",
};

const EMPLOYMENT_COLORS: Record<EmploymentType, string> = {
  salaried: "bg-sky-100 text-sky-800 border-sky-200",
  piece_rate: "bg-emerald-100 text-emerald-800 border-emerald-200",
  contractor: "bg-amber-100 text-amber-800 border-amber-200",
  shareholder: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

function defaultEmploymentTypeFor(role: StaffRole): EmploymentType {
  if (role === "admin" || role === "coach") return "salaried";
  if (role === "lawyer") return "contractor";
  return "piece_rate";
}

const roleLabels: Record<StaffRole, string> = {
  coach: "Coach",
  doctor: "Doctor",
  nurse: "Nurse",
  psychologist: "Psychologist",
  admin: "Admin",
  lawyer: "External counsel (lawyer)",
};

const roleColors: Record<StaffRole, string> = {
  coach: "bg-emerald-100 text-emerald-700",
  doctor: "bg-blue-100 text-blue-700",
  nurse: "bg-purple-100 text-purple-700",
  psychologist: "bg-amber-100 text-amber-700",
  admin: "bg-gray-100 text-gray-700",
  lawyer: "bg-indigo-100 text-indigo-700",
};

const roleOptions: StaffRole[] = ["coach", "doctor", "nurse", "psychologist", "admin", "lawyer"];

// ─── Fallback mock data ───────────────────────────────────────

const fallbackTeam: TeamMember[] = [
  { id: "staff-1", name: "Coach Sarah", email: "sarah@lifeline.is", phone: "+354 555 1001", role: "coach", employment_type: "salaried", active: true, permissions: defaultPermissions.coach, invited: true },
  { id: "staff-2", name: "Dr. Gudmundur Sigurdsson", email: "gudmundur@lifeline.is", phone: "+354 555 1002", role: "doctor", employment_type: "piece_rate", active: true, permissions: defaultPermissions.doctor, invited: true },
  { id: "staff-3", name: "Helga Jonsdottir", email: "helga@lifeline.is", phone: "+354 555 1003", role: "nurse", employment_type: "piece_rate", active: true, permissions: defaultPermissions.nurse, invited: true },
  { id: "staff-4", name: "Dr. Anna Kristjansdottir", email: "anna.k@lifeline.is", phone: "+354 555 1004", role: "psychologist", employment_type: "piece_rate", active: true, permissions: defaultPermissions.psychologist, invited: true },
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

  // Crop state
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropMemberId, setCropMemberId] = useState<string | null>(null);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  // Add member form state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<StaffRole>("coach");
  const [newEmployment, setNewEmployment] = useState<EmploymentType>(defaultEmploymentTypeFor("coach"));
  const [newPermissions, setNewPermissions] = useState<Permission[]>(defaultPermissions.coach);
  const [sendInvite, setSendInvite] = useState(true);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState(false);

  // Update permissions + employment default when role changes
  const handleRoleChange = (role: StaffRole) => {
    setNewRole(role);
    setNewPermissions(defaultPermissions[role]);
    setNewEmployment(defaultEmploymentTypeFor(role));
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
            employment_type: (row.employment_type as EmploymentType | null) ?? null,
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
              employment_type: (row.employment_type as EmploymentType | null) ?? null,
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

    if (connectionStatus !== "connected") {
      // Offline / fallback mode — insert into local state only.
      setTeam((prev) => [
        ...prev,
        {
          id: `staff-${Date.now()}`,
          name: newName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim(),
          role: newRole,
          employment_type: newEmployment,
          active: true,
          permissions: newPermissions,
          invited: false,
        },
      ]);
      setShowAddModal(false);
      return;
    }

    setInviteSending(true);
    setInviteStatus(sendInvite ? "Creating account and sending invite…" : "Creating account…");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setSaveError("Not authenticated.");
        setInviteSending(false);
        return;
      }
      const resp = await fetch("/api/admin/staff/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim(),
          role: newRole,
          employment_type: newEmployment,
          permissions: newPermissions,
          send_invite: sendInvite,
        }),
      });
      const result = await resp.json();
      if (!resp.ok || !result.ok) {
        setSaveError(`Failed to add: ${result.error || resp.statusText}`);
        setInviteSending(false);
        return;
      }

      const data = result.staff;
      const addedMember: TeamMember = {
        id: data.id,
        name: data.name,
        email: data.email,
        phone: data.phone || "",
        role: data.role as StaffRole,
        employment_type: (data.employment_type as EmploymentType | null) ?? newEmployment,
        active: data.active ?? true,
        permissions: (data.permissions as Permission[]) || newPermissions,
        invited: data.invited ?? false,
      };
      setTeam((prev) => {
        const idx = prev.findIndex((m) => m.id === addedMember.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = addedMember;
          return next;
        }
        return [...prev, addedMember];
      });

      setInviteStatus(
        sendInvite
          ? `Invite email sent to ${addedMember.email}. Auth user id is aligned with staff.id (RLS-ready).`
          : `Auth user + staff row created (no invite email).`,
      );
    } catch (e) {
      setSaveError(`Could not create staff: ${(e as Error).message}`);
    } finally {
      setInviteSending(false);
    }

    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewRole("coach");
    setNewEmployment(defaultEmploymentTypeFor("coach"));
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
    setEditValues({ name: member.name, email: member.email, phone: member.phone, role: member.role, employment_type: member.employment_type, permissions: member.permissions, avatar_url: member.avatar_url, specialty: member.specialty, bio: member.bio, years_experience: member.years_experience, qualifications: member.qualifications });
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
          employment_type: editValues.employment_type ?? null,
          permissions: editValues.permissions,
          avatar_url: editValues.avatar_url || null,
          specialty: editValues.specialty || null,
          bio: editValues.bio || null,
          years_experience: editValues.years_experience || null,
          qualifications: editValues.qualifications || null,
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
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#10B981] transition-colors shadow-sm"
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
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.name} className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${roleColors[member.role]}`}>
                            {getInitials(member.name)}
                          </div>
                        )}
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.name ?? ""}
                            onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900 w-40"
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
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900 w-48"
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
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900 w-36"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">{member.phone || "Not set"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={editValues.role ?? member.role}
                            onChange={(e) => setEditValues({ ...editValues, role: e.target.value as StaffRole })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900"
                          >
                            {roleOptions.map((r) => (
                              <option key={r} value={r}>{roleLabels[r]}</option>
                            ))}
                          </select>
                          <select
                            value={editValues.employment_type ?? member.employment_type ?? defaultEmploymentTypeFor(editValues.role ?? member.role)}
                            onChange={(e) => setEditValues({ ...editValues, employment_type: e.target.value as EmploymentType })}
                            className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900"
                            title="Drives which contract doc they sign at onboarding"
                          >
                            <option value="salaried">Salaried</option>
                            <option value="piece_rate">Piece-rate (2 000 ISK/mæling)</option>
                            <option value="contractor">Contractor</option>
                            <option value="shareholder">Shareholder (no payment)</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[member.role]}`}>
                              {roleLabels[member.role]}
                            </span>
                            {member.specialty && (
                              <span className="text-[10px] text-gray-400">{member.specialty}</span>
                            )}
                          </div>
                          {member.employment_type && (
                            <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${EMPLOYMENT_COLORS[member.employment_type]}`}>
                              {EMPLOYMENT_LABELS[member.employment_type]}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(member.id)}
                        className="flex items-center gap-2 group"
                      >
                        <div className={`relative w-9 h-5 rounded-full transition-colors ${member.active ? "bg-[#10B981]" : "bg-gray-300"}`}>
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
                              className="px-3 py-1 text-xs font-medium text-white bg-[#10B981] rounded hover:bg-[#10B981] transition-colors"
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
                            <StaffLegalButton staffId={member.id} staffName={member.name} />
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
                                className="w-3.5 h-3.5 text-[#10B981] border-gray-300 rounded focus:ring-[#10B981]"
                              />
                              <span className="text-xs font-medium text-gray-700">{perm.label}</span>
                            </label>
                          ))}
                        </div>

                        {/* ─── Profile fields ─── */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Coach Profile (shown in app)</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Avatar Upload */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Profile Photo</label>
                              <div className="flex items-center gap-3">
                                {editValues.avatar_url ? (
                                  <img src={editValues.avatar_url} alt="Avatar" className="w-12 h-12 rounded-full object-cover border-2 border-gray-200" />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                  </div>
                                )}
                                <div className="flex flex-col gap-1">
                                  <label className="cursor-pointer px-3 py-1.5 text-xs font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#0b7e73] transition-colors inline-flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    Upload photo
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                          setCropImage(reader.result as string);
                                          setCropMemberId(member.id);
                                          setCropPos({ x: 0, y: 0 });
                                          setCropZoom(1);
                                        };
                                        reader.readAsDataURL(file);
                                        e.target.value = "";
                                      }}
                                    />
                                  </label>
                                  {editValues.avatar_url && (
                                    <button
                                      type="button"
                                      onClick={() => setEditValues({ ...editValues, avatar_url: null })}
                                      className="text-[10px] text-red-400 hover:text-red-600 text-left"
                                    >
                                      Remove photo
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Specialty */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Specialty</label>
                              <input
                                type="text"
                                value={editValues.specialty ?? ""}
                                onChange={(e) => setEditValues({ ...editValues, specialty: e.target.value })}
                                placeholder="e.g. Nutrition, Exercise Science, Mental Health"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900"
                              />
                            </div>
                            {/* Bio */}
                            <div className="md:col-span-2">
                              <label className="block text-xs font-medium text-gray-600 mb-1">Bio</label>
                              <textarea
                                value={editValues.bio ?? ""}
                                onChange={(e) => setEditValues({ ...editValues, bio: e.target.value })}
                                placeholder="Short bio about the coach..."
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900 resize-none"
                              />
                            </div>
                            {/* Years Experience */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Years of Experience</label>
                              <input
                                type="number"
                                value={editValues.years_experience ?? ""}
                                onChange={(e) => setEditValues({ ...editValues, years_experience: e.target.value ? parseInt(e.target.value) : null })}
                                placeholder="e.g. 5"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900"
                              />
                            </div>
                            {/* Qualifications */}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Qualifications (one per line)</label>
                              <textarea
                                value={(editValues.qualifications || []).join("\n")}
                                onChange={(e) => setEditValues({ ...editValues, qualifications: e.target.value.split("\n").filter(s => s.trim()) })}
                                placeholder={"e.g.\nMSc Exercise Science\nCertified Personal Trainer\nNutrition Coach Level 3"}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none text-gray-900 resize-none"
                              />
                            </div>
                          </div>
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

      {/* 3-step delete confirmation: warning → type "delete" → admin password */}
      {deleteTarget && (
        <DeleteConfirmModal
          title={`Remove ${deleteTarget.name}`}
          description={`This will permanently remove ${deleteTarget.name} (${roleLabels[deleteTarget.role]}) from the Lifeline team. Any clients assigned to them will need to be reassigned. This cannot be undone.`}
          onCancel={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}
          onConfirm={async () => { await handleRemoveConfirm(); }}
        />
      )}

      {/* Crop modal */}
      {cropImage && (
        <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Crop profile photo</h3>
              <button onClick={() => setCropImage(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="relative w-full" style={{ height: 350 }}>
              <Cropper
                image={cropImage}
                crop={cropPos}
                zoom={cropZoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCropPos}
                onZoomChange={setCropZoom}
                onCropComplete={(_, area) => setCroppedArea(area)}
              />
            </div>
            <div className="px-5 py-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-wider">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={cropZoom}
                onChange={(e) => setCropZoom(Number(e.target.value))}
                className="w-full accent-[#10B981]"
              />
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setCropImage(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!croppedArea || !cropMemberId) return;
                  try {
                    const blob = await getCroppedImg(cropImage, croppedArea);
                    const path = `${cropMemberId}.jpg`;
                    await supabase.storage.from("staff-avatars").remove([path]);
                    const { error: uploadErr } = await supabase.storage.from("staff-avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
                    if (uploadErr) { alert(`Upload failed: ${uploadErr.message}`); return; }
                    const { data: urlData } = supabase.storage.from("staff-avatars").getPublicUrl(path);
                    const publicUrl = urlData.publicUrl + "?t=" + Date.now();
                    setEditValues((prev) => ({ ...prev, avatar_url: publicUrl }));
                    setCropImage(null);
                  } catch (err) {
                    alert("Crop failed. Try again.");
                  }
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#0b7e73] transition-colors"
              >
                Save photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md my-8 max-h-[calc(100vh-4rem)] flex flex-col">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 flex-shrink-0">
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
            <div className="space-y-4 overflow-y-auto p-6 pt-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@lifeline.is"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+354 555 0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>{roleLabels[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment type</label>
                <select
                  value={newEmployment}
                  onChange={(e) => setNewEmployment(e.target.value as EmploymentType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none text-gray-900"
                >
                  <option value="salaried">Salaried — fixed monthly wage (ráðningarsamningur uploaded as bespoke PDF)</option>
                  <option value="piece_rate">Piece-rate — 2 000 ISK per measurement (lausráðningarsamningur, click-through)</option>
                  <option value="contractor">Independent contractor — self-employed, own tax (verktakasamningur, click-through)</option>
                  <option value="shareholder">Shareholder — no payment relationship (e.g. external counsel doing pro bono work; no contract)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1 leading-snug">
                  Decides which contract doc they sign at onboarding. Pick <strong>piece_rate</strong> for clinicians paid per measurement (Lifeline is the employer of record, withholds tax + pays tryggingagjald + pension). Pick <strong>salaried</strong> for full-time / fixed-salary staff — you upload the bespoke ráðningarsamningur PDF via the Legal panel on the row. Pick <strong>contractor</strong> for genuinely independent paid work (IT, marketing, etc.). Pick <strong>shareholder</strong> for someone with no payment relationship (e.g. an investor doing pro bono legal work).
                </p>
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
                        className="mt-0.5 w-4 h-4 text-[#10B981] border-gray-300 rounded focus:ring-[#10B981]"
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
                    className="w-4 h-4 text-[#10B981] border-gray-300 rounded focus:ring-[#10B981]"
                  />
                  <span className="text-sm font-medium text-gray-700">Send invite email</span>
                </label>
                <p className="text-xs text-gray-400 ml-6.5 mt-0.5">The team member will receive an email to set up their account</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || !newEmail.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#10B981] rounded-lg hover:bg-[#10B981] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
