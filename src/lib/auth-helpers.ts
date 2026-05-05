import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "./supabase-admin";

export async function getUserFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user || null;
}

/**
 * Returns true if the user is an active staff member with WRITE
 * authorization for general admin operations. Excludes the two
 * read-only roles — `medical_advisor` and `lawyer` — who get
 * view access to admin pages but must not be able to mutate
 * client / business / clinical data through the admin APIs.
 *
 * Use this for any admin API that performs a write
 * (POST/PUT/DELETE). For surfaces those roles legitimately own
 * (surveys for medical_advisor, legal-doc drafts for lawyer)
 * the route does its own explicit role check and can accept
 * those roles independently.
 *
 * Use isAnyActiveStaff() if a route only reads and just needs
 * to confirm the user is on staff.
 */
export async function isStaff(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, active, role")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.active !== true) return false;
  if (data.role === "medical_advisor" || data.role === "lawyer") return false;
  return true;
}

/**
 * Returns true if the user is any active staff member, including
 * the read-only roles. Use only on routes that don't write — the
 * caller is responsible for ensuring the response is read-only.
 */
export async function isAnyActiveStaff(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("staff")
    .select("id, active")
    .eq("id", userId)
    .maybeSingle();
  return !!data && data.active === true;
}

/**
 * Find an auth user by email. Paginates through listUsers until found or
 * exhausted. Supabase's SDK caps perPage at 200, so past 200 users a single-
 * page lookup silently misses.
 */
export async function findAuthUserByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const PER_PAGE = 200;
  for (let page = 1; page < 100; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (!data?.users?.length) return null;
    const match = data.users.find((u) => (u.email || "").toLowerCase() === normalized);
    if (match) return match;
    if (data.users.length < PER_PAGE) return null;
  }
  return null;
}
