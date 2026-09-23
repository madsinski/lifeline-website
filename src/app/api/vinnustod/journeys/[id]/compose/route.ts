// Compose the exercise or nutrition programme from our own libraries.
//
// POST { kind: "exercise" | "nutrition", template?: key, constraints?: string }
//   → { sessions } or { day_example }, plus a note and how many library ids
//     the model returned that we refused.
//
// The preset fixes the shape; the model fills it with real library rows. See
// src/lib/hc/compose.ts for why nothing it invents survives.
//
// Actor: workstation session or Lifeline staff, limited to their locations.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { hcAudit } from "@/lib/hc/server";
import { composeProgram, type ComposeKind } from "@/lib/hc/compose";
import type { PlanItem } from "@/lib/hc/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const { data: journey } = await supabaseAdmin
    .from("hc_journeys")
    .select("id, client_id, location_id")
    .eq("id", id)
    .maybeSingle();
  const locs = actorLocationFilter(actor);
  if (!journey || (locs && (!journey.location_id || !locs.includes(journey.location_id)))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const kind: ComposeKind = body.kind === "nutrition" ? "nutrition" : "exercise";
  const templateKey = typeof body.template === "string" ? body.template.slice(0, 60) : null;
  const constraints = typeof body.constraints === "string" ? body.constraints.trim().slice(0, 1200) : null;

  const [{ data: template }, { data: plan }] = await Promise.all([
    templateKey
      ? supabaseAdmin
          .from(kind === "exercise" ? "hc_exercise_templates" : "hc_nutrition_templates")
          .select("*").eq("key", templateKey).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from("hc_action_plans").select("modules").eq("journey_id", id).maybeSingle(),
  ]);

  const out = await composeProgram({
    kind,
    journeyId: id,
    clientId: journey.client_id,
    template: template ?? null,
    planItems: ((plan?.modules ?? []) as PlanItem[]),
    constraints,
  });
  if (!out.ok) {
    const status = out.message.includes("ekki uppsett") ? 503 : 502;
    return NextResponse.json({ error: `Samsetningin mistókst: ${out.message}` }, { status });
  }

  await hcAudit(actor.label, "program_composed", id, {
    kind,
    template: templateKey,
    sessions: out.result.sessions?.length ?? 0,
    meals: out.result.day_example?.length ?? 0,
    dropped: out.result.dropped,
  });
  return NextResponse.json(out.result);
}
