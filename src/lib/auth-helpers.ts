import { NextRequest } from "next/server";
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
