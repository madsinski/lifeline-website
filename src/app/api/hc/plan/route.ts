// The customer's published action plan. GET ?journey=<id> (defaults to the
// current journey). Drafts are never returned to the customer.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, getClientProfile, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journeyId = req.nextUrl.searchParams.get("journey") || (await currentJourney(user.id))?.id;
  if (!journeyId) return NextResponse.json({ plan: null });
  const { data: plan } = await supabaseAdmin
    .from("hc_action_plans")
    .select("*")
    .eq("journey_id", journeyId)
    .eq("client_id", user.id)
    .eq("status", "published")
    .maybeSingle();
  const profile = await getClientProfile(user.id);
  return NextResponse.json({ plan, client_name: profile?.full_name ?? null });
}
