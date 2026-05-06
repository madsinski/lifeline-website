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
 * Decode the `aal` (authenticator assurance level) claim from a Supabase
 * access token without verifying its signature. The signature has already
 * been verified by `supabaseAdmin.auth.getUser()`; we just need to read the
 * AAL claim. Returns 'aal1' | 'aal2' | null.
 *
 * Use isAdminWithMFA() rather than this directly when gating admin APIs.
 */
export function aalFromToken(token: string): "aal1" | "aal2" | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Standard base64url decode for JWT payloads.
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), "=");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    const aal = payload?.aal;
    return aal === "aal2" ? "aal2" : aal === "aal1" ? "aal1" : null;
  } catch {
    return null;
  }
}

/**
 * Hard gate for admin mutation endpoints: requires (a) a valid session,
 * (b) admin-write role, and (c) AAL2 (MFA-stepped-up) on the token.
 *
 * /admin layout enforces AAL2 in the UI, so any session reaching an admin
 * API normally has it. This guard catches the case where a leaked AAL1
 * session token is used to call admin APIs directly. Returns the user on
 * success, or a string error code: 'unauthorized' | 'forbidden' | 'mfa_required'.
 */
export async function requireAdminAAL2(req: NextRequest): Promise<User | "unauthorized" | "forbidden" | "mfa_required"> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return "unauthorized";
  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data.user) return "unauthorized";
  const ok = await isStaff(data.user.id);
  if (!ok) return "forbidden";
  if (aalFromToken(token) !== "aal2") return "mfa_required";
  return data.user;
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
