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
import { getUserFromRequest, requireStaffAAL2 } from "@/lib/auth-helpers";

type ResearchUser = NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>;

const READ_ROLES = ["admin", "doctor", "medical_advisor"];

/** Read access: active admin, doctor or medical advisor, with AAL2. */
export async function requireResearchRead(req: NextRequest): Promise<ResearchUser | null> {
  // Patient-level cohort data: MFA (AAL2) for reads too, not only writes.
  const r = await requireStaffAAL2(req, { roles: READ_ROLES });
  return typeof r === "string" ? null : r;
}

/** Write access: admin or medical advisor, with AAL2. */
export async function requireResearchWrite(
  req: NextRequest,
): Promise<ResearchUser | "unauthorized" | "forbidden" | "mfa_required"> {
  return requireStaffAAL2(req, { roles: ["admin", "medical_advisor"] });
}
