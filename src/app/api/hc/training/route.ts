// The participant's own training settings (level, plus-minus load, injuries)
// for the adaptive programme on /account/heilsuferd/aaetlun.
// GET ?journey=<id> → settings; POST → save. Own journey only.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, hcAudit, requireUser } from "@/lib/hc/server";
import { loadTraining, saveTraining } from "@/lib/hc/training-server";

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
  return NextResponse.json({ settings: await loadTraining(journeyId) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journeyId = await ownJourney(req, user.id);
  if (!journeyId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const settings = await saveTraining(journeyId, user.id, await req.json().catch(() => ({})), "client");
    await hcAudit("client", "training_settings", journeyId, { level: settings.level, load: settings.load, injuries: settings.injuries });
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
