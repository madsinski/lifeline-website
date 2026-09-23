// Who is using the workstation. Two kinds of actor:
//   • a partner nurse with her own workstation session (/vinnustod)
//   • Lifeline staff on the admin token with MFA (/admin/vinnustod)
// Both are described the same way so the screens do not care which it is.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor, getWorkerSession } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const worker = await getWorkerSession();
  let me: { id: string; name: string; email: string; organization: string; role: "nurse" | "doctor" | "admin"; has_pin: boolean } | null =
    worker ? { ...worker } : null;

  if (!me) {
    const actor = await getHcActor(req);
    if (actor?.kind === "staff") {
      const { data: staff } = await supabaseAdmin
        .from("staff")
        .select("id, name, email, role")
        .eq("id", actor.staffId)
        .maybeSingle();
      me = {
        id: actor.staffId,
        name: staff?.name ?? actor.label,
        email: staff?.email ?? "",
        organization: "lifeline",
        // The workstation only distinguishes "may act as a doctor" from the rest.
        role: actor.isDoctor ? (staff?.role === "admin" ? "admin" : "doctor") : "nurse",
        has_pin: false,
      };
    }
  }

  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: locations } = await supabaseAdmin.from("hc_locations").select("id, slug, name").eq("active", true).order("name");
  return NextResponse.json({ me, locations: locations || [] });
}
