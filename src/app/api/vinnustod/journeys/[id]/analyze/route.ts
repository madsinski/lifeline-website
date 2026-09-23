// Propose an action plan from the client's results.
//
// The work lives in src/lib/hc/propose.ts so the same code runs here, on
// demand, and in the background when a report is imported.
//
// POST → { flagged, other, proposal }
// Actor: workstation session or Lifeline staff, limited to their locations.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { hcAudit } from "@/lib/hc/server";
import { buildProposal } from "@/lib/hc/propose";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const { data: journey } = await supabaseAdmin
    .from("hc_journeys")
    .select("id, location_id")
    .eq("id", id)
    .maybeSingle();
  const locs = actorLocationFilter(actor);
  if (!journey || (locs && (!journey.location_id || !locs.includes(journey.location_id)))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const out = await buildProposal(id, actor.label);
  if (!out.ok) {
    const status = out.reason === "no_key" ? 503 : out.reason === "no_values" ? 409 : 502;
    return NextResponse.json({ error: out.reason === "failed" ? `Tillagan mistókst: ${out.message}` : out.message }, { status });
  }
  await hcAudit(actor.label, "plan_proposed", id, { actions: out.proposal.actions.length, referrals: out.proposal.referrals?.length ?? 0 });
  return NextResponse.json({ flagged: out.flagged, other: out.other, proposal: out.proposal });
}
