// Vera heilsusetur partners the workstation can contact on a client's behalf.
// GET → active partners (name, profession, organization). Emails stay
// server-side: the workstation picks a partner, the referrals route sends.
// Actor: workstation session or Lifeline staff. Schema: migration-hc-partners.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("hc_partners")
    .select("id, name, profession, organization").eq("active", true).order("name");
  if (error) return NextResponse.json({ error: "Ekki tókst að sækja samstarfsaðila." }, { status: 500 });
  return NextResponse.json({ partners: data ?? [] });
}
