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

export async function isStaff(userId: string): Promise<boolean> {
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
