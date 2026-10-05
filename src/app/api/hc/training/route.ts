// The participant's own training settings (level, plus-minus load, injuries)
// for the adaptive programme on /account/heilsuferd/aaetlun.
// GET ?journey=<id> → settings; POST → save. Own journey only.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, hcAudit, requireUser } from "@/lib/hc/server";
import { loadPlanPrefs, saveTraining } from "@/lib/hc/training-server";

export const runtime = "nodejs";

async function ownJourney(req: NextRequest, userId: string): Promise<string | null> {
  const id = req.nextUrl.searchParams.get("journey");
  if (!id) return (await currentJourney(userId))?.id ?? null;
  const { data } = await supabaseAdmin.from("hc_journeys").select("id").eq("id", id).eq("client_id", userId).maybeSingle();
  return data?.id ?? null;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journeyId = await ownJourney(req, user.id);
  if (!journeyId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const prefs = await loadPlanPrefs(journeyId);
  // The gym behind their location, for the "í hóptímum" branch of the setup.
  // A name and a link to the gym's own live timetable — never a copy of it.
  const { data: loc } = await supabaseAdmin
    .from("hc_journeys").select("hc_locations(gym_name, gym_url, gym_info)")
    .eq("id", journeyId).maybeSingle<{ hc_locations: { gym_name: string | null; gym_url: string | null; gym_info: string | null } | null }>();
  return NextResponse.json({
    ...prefs,
    gym: loc?.hc_locations
      ? { name: loc.hc_locations.gym_name, url: loc.hc_locations.gym_url, info: loc.hc_locations.gym_info }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journeyId = await ownJourney(req, user.id);
  if (!journeyId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const { settings, personal } = await saveTraining(journeyId, user.id, await req.json().catch(() => ({})), "client");
    await hcAudit("client", "training_settings", journeyId, { level: settings.level, load: settings.load, injuries: settings.injuries });
    return NextResponse.json({ settings, personal });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
