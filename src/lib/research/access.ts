// Access helpers for the research module.
//
// Policy: the medical_advisor role has FULL research access (read + write).
// medical_advisor is exempt from the in-app MFA gate (handled via engagement
// letter, like lawyer), so research writes for that role do NOT require AAL2.
// Admins still go through requireAdminAAL2; other write-authorized staff
// (clinicians, coach) get read-only; lawyer is excluded.

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff, requireAdminAAL2 } from "@/lib/auth-helpers";

type ResearchUser = NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>;

async function isActiveMedicalAdvisor(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("staff").select("active, role").eq("id", userId).maybeSingle();
  return !!data && data.active === true && data.role === "medical_advisor";
}

/** Read access: write-authorized staff (admin/clinicians/coach) OR medical advisor. */
export async function requireResearchRead(req: NextRequest): Promise<ResearchUser | null> {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  if (await isStaff(user.id)) return user;            // admin, doctor, nurse, psychologist, coach
  if (await isActiveMedicalAdvisor(user.id)) return user;
  return null;
}

/** Write access: admin (with AAL2) OR active medical advisor (no AAL2 required). */
export async function requireResearchWrite(
  req: NextRequest,
): Promise<ResearchUser | "unauthorized" | "forbidden" | "mfa_required"> {
  const auth = await requireAdminAAL2(req);
  if (typeof auth !== "string") return auth;          // admin with AAL2
  const user = await getUserFromRequest(req);
  if (user && (await isActiveMedicalAdvisor(user.id))) return user;
  return auth;                                        // original error string
}
