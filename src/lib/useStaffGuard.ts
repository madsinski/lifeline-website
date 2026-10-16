"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type StaffRole = "coach" | "doctor" | "nurse" | "psychologist" | "admin" | "lawyer" | "medical_advisor";
export type StaffPermission = "manage_clients" | "manage_programs" | "manage_team" | "view_analytics" | "send_messages" | "app_user_access" | "view_legal";

interface StaffProfile {
  role: StaffRole;
  permissions: StaffPermission[];
  isAdmin: boolean;
  isMedicalAdvisor: boolean;
  loading: boolean;
  authorized: boolean;
}

export interface MyStaffProfile {
  role: StaffRole;
  permissions: StaffPermission[];
}

/**
 * The signed-in user's active staff row, or null when they are not active
 * staff. Throws when the lookup itself failed (network, RPC missing AND the
 * fallback failed) so callers can tell "not staff" from "could not check".
 *
 * Uses the SECURITY DEFINER get_my_staff_profile() RPC. A raw
 * `select from staff` is subject to the id = auth.uid() RLS policy and
 * returns nothing — or a null role — for invited admins whose staff.id was
 * generated independently of their auth id (see
 * migration-staff-helpers-email-match.sql). The raw select is kept only as a
 * fallback for when the RPC itself errors (migration window).
 */
export async function fetchMyStaffProfile(email?: string | null): Promise<MyStaffProfile | null> {
  const { data: profileRaw, error: rpcErr } = await supabase.rpc("get_my_staff_profile").maybeSingle();
  if (!rpcErr) {
    const profile = profileRaw as { role: string | null; permissions: string[] | null; active: boolean | null } | null;
    if (!profile || !profile.active || !profile.role) return null;
    return { role: profile.role as StaffRole, permissions: (profile.permissions as StaffPermission[]) || [] };
  }
  if (!email) throw rpcErr;
  const { data, error } = await supabase
    .from("staff")
    .select("role, permissions")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.role) return null;
  return { role: data.role as StaffRole, permissions: (data.permissions as StaffPermission[]) || [] };
}

/**
 * Hook that verifies the current user is an active staff member.
 * Optionally checks for a required role or permission.
 *
 * Medical advisor: this role is granted *view* access to every
 * admin-gated page in the app. They pass any role or permission
 * check at the UI level. Writes are blocked at the DB level by
 * RLS (UPDATE/INSERT/DELETE policies still exclude
 * is_active_medical_advisor()), so passing them through here is
 * safe — the data they receive is read-only and any attempt to
 * mutate it will fail at the API/Postgres boundary.
 *
 * Usage:
 *   const { authorized, loading } = useStaffGuard();                    // any active staff
 *   const { authorized, loading } = useStaffGuard({ role: "admin" });   // admin only
 *   const { authorized, loading } = useStaffGuard({ permission: "manage_programs" }); // specific perm
 */
export function useStaffGuard(opts?: { role?: StaffRole; permission?: StaffPermission }): StaffProfile {
  const needRole = opts?.role;
  const needPermission = opts?.permission;
  const [state, setState] = useState<StaffProfile>({
    role: "coach",
    permissions: [],
    isAdmin: false,
    isMedicalAdvisor: false,
    loading: true,
    authorized: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          setState((s) => ({ ...s, loading: false, authorized: false }));
          return;
        }

        const profile = await fetchMyStaffProfile(user.email);
        if (!profile) {
          setState((s) => ({ ...s, loading: false, authorized: false }));
          return;
        }
        const { role, permissions } = profile;
        const isAdmin = role === "admin";
        const isMedicalAdvisor = role === "medical_advisor";

        // Medical advisor passes any UI guard — they get view access
        // to every page the layout lets them open. RLS prevents writes
        // independently.
        let authorized = true;
        if (needRole && role !== needRole && !isAdmin && !isMedicalAdvisor) authorized = false;
        if (needPermission && !permissions.includes(needPermission) && !isAdmin && !isMedicalAdvisor) authorized = false;

        setState({ role, permissions, isAdmin, isMedicalAdvisor, loading: false, authorized });
      } catch {
        setState((s) => ({ ...s, loading: false, authorized: false }));
      }
    })();
  }, [needRole, needPermission]);

  return state;
}
