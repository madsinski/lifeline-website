// Gate for /api/admin/hc/* — reads need any active staff, writes need
// requireAdminAAL2 (write role + MFA). Server-only.

import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";

export async function adminGate(req: NextRequest, write: boolean): Promise<User | NextResponse> {
  if (write) {
    const r = await requireAdminAAL2(req);
    if (typeof r === "string") {
      return NextResponse.json({ error: r }, { status: r === "unauthorized" ? 401 : 403 });
    }
    return r;
  }
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAnyActiveStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return user;
}
