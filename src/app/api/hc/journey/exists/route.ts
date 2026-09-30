// Does this user have a health-check journey? Read-only (unlike GET
// /api/hc/journey, which creates one). /account uses it to send participants
// to their heilsuferð instead of the legacy dashboard.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const j = await currentJourney(user.id);
  // With a published plan, "Í dag" is home: saves the hop through the hub.
  const { data: plan } = j ? await supabaseAdmin.from("hc_action_plans_decrypted").select("id").eq("journey_id", j.id).eq("status", "published").maybeSingle() : { data: null };
  return NextResponse.json({ exists: !!j, has_plan: !!plan });
}
