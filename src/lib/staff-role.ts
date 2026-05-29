import { supabase } from "@/lib/supabase";

// Resolve the current user's staff role on the client.
//
// The staff table's RLS is id-match (id = auth.uid()), so a raw
// `select role from staff where email = ...` returns nothing for invited
// admins whose staff.id was generated independently of their
// auth.users.id (see migration-staff-helpers-email-match.sql). That made
// invited admins resolve to a null role and miss role-gated UI. Use the
// SECURITY DEFINER get_my_staff_profile() RPC, with the legacy raw select
// only as a migration-window fallback (same approach as useStaffGuard).
export async function getMyStaffRole(email?: string | null): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_my_staff_profile").single();
  const profile = data as { role: string | null; active: boolean | null } | null;
  if (!error && profile?.active) return profile.role ?? null;

  if (!email) return null;
  const { data: row } = await supabase
    .from("staff")
    .select("role")
    .eq("email", email)
    .maybeSingle();
  return (row?.role as string) ?? null;
}
