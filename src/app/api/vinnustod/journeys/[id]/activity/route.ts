// What the participant actually did over the last N days, for the
// workstation's Staða tab: workouts (with "Gera annað" substitutions and the
// session they replaced), meals (planned, or described instead) and habit
// ticks, merged and date-sorted.
// GET ?days=14 (1–60).
// Auth: workstation actor (staff Bearer+AAL2, or a worker session); the
// journey must be at a location that actor may see — same gate as the
// journey route. Only this journey's client; no kennitala, no contact data.
// Schema: supabase/migration-session-substitutions.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { clampDays, loadActivity } from "@/lib/hc/activity-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: journey } = await supabaseAdmin.from("hc_journeys")
    .select("id, client_id, location_id").eq("id", (await ctx.params).id).maybeSingle();
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const locs = actorLocationFilter(actor);
  if (locs && (!journey.location_id || !locs.includes(journey.location_id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const days = clampDays(req.nextUrl.searchParams.get("days"));
  try {
    const entries = await loadActivity(journey.client_id as string, journey.id as string, days);
    return NextResponse.json({ days, entries });
  } catch {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
