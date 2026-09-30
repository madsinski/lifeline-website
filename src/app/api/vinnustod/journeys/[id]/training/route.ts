// A participant's training settings, seen and changed from the workstation
// (level, plus-minus load, injuries). Same row the participant edits.
// Actor: workstation session or Lifeline staff (Bearer + AAL2).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hcAudit } from "@/lib/hc/server";
import { sameOrigin } from "@/lib/hc/secrets";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { loadTraining, saveTraining } from "@/lib/hc/training-server";

export const runtime = "nodejs";

async function gate(req: NextRequest, id: string, write: boolean) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (write && actor.kind === "worker" && !sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data } = await supabaseAdmin.from("hc_journeys").select("id, client_id, location_id").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const locs = actorLocationFilter(actor);
  if (locs && (!data.location_id || !locs.includes(data.location_id))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return { actor, journey: data as { id: string; client_id: string } };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, (await ctx.params).id, false);
  if (g instanceof NextResponse) return g;
  return NextResponse.json({ settings: await loadTraining(g.journey.id) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, (await ctx.params).id, true);
  if (g instanceof NextResponse) return g;
  try {
    const settings = await saveTraining(g.journey.id, g.journey.client_id, await req.json().catch(() => ({})), g.actor.label);
    await hcAudit(g.actor.label, "training_settings", g.journey.id, { level: settings.level, load: settings.load, injuries: settings.injuries });
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
