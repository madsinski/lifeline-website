"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type StaffRole = "coach" | "doctor" | "nurse" | "psychologist" | "admin";
export type StaffPermission = "manage_clients" | "manage_programs" | "manage_team" | "view_analytics" | "send_messages";

interface StaffProfile {
  role: StaffRole;
  permissions: StaffPermission[];
  isAdmin: boolean;
  loading: boolean;
  authorized: boolean;
}

/**
 * Hook that verifies the current user is an active staff member.
 * Optionally checks for a required role or permission.
 *
 * Usage:
 *   const { authorized, loading } = useStaffGuard();                    // any active staff
 *   const { authorized, loading } = useStaffGuard({ role: "admin" });   // admin only
 *   const { authorized, loading } = useStaffGuard({ permission: "manage_programs" }); // specific perm
 */
export function useStaffGuard(opts?: { role?: StaffRole; permission?: StaffPermission }): StaffProfile {
  const [state, setState] = useState<StaffProfile>({
    role: "coach",
    permissions: [],
    isAdmin: false,
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

        const { data } = await supabase
          .from("staff")
          .select("role, permissions")
          .eq("email", user.email)
          .eq("active", true)
          .maybeSingle();

        if (!data) {
          setState((s) => ({ ...s, loading: false, authorized: false }));
          return;
        }

        const role = (data.role as StaffRole) || "coach";
        const permissions = (data.permissions as StaffPermission[]) || [];
        const isAdmin = role === "admin";

        let authorized = true;
        if (opts?.role && role !== opts.role && !isAdmin) authorized = false;
        if (opts?.permission && !permissions.includes(opts.permission) && !isAdmin) authorized = false;

        setState({ role, permissions, isAdmin, loading: false, authorized });
      } catch {
        setState((s) => ({ ...s, loading: false, authorized: false }));
      }
    })();
  }, []);

  return state;
}
