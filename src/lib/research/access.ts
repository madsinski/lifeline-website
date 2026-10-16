// Access helpers for the research module.
//
// The research module exposes patient-level longitudinal cohort data
// (incl. exports), so access is deliberately narrow:
//   read  — active admin, doctor or medical_advisor (no coaches / nurses /
//           psychologists, no lawyer)
//   write — active admin or medical_advisor, both with an AAL2 (MFA) session.
//           The admin layout enforces MFA for medical_advisor (only lawyer is
//           exempt), so they always hold an AAL2 token.

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, requireStaffAAL2 } from "@/lib/auth-helpers";

type ResearchUser = NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>;

const READ_ROLES = ["admin", "doctor", "medical_advisor"];

/** Read access: active admin, doctor or medical advisor. */
export async function requireResearchRead(req: NextRequest): Promise<ResearchUser | null> {
  const user = await getUserFromRequest(req);
  if (!user) return null;
  const { data } = await supabaseAdmin.from("staff").select("active, role").eq("id", user.id).maybeSingle();
  if (!data || data.active !== true || !READ_ROLES.includes(String(data.role))) return null;
  return user;
}

/** Write access: admin or medical advisor, with AAL2. */
export async function requireResearchWrite(
  req: NextRequest,
): Promise<ResearchUser | "unauthorized" | "forbidden" | "mfa_required"> {
  return requireStaffAAL2(req, { roles: ["admin", "medical_advisor"] });
}
