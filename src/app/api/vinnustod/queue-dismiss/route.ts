// Dismissing an item from "Bíður þín", and undoing it.
//
// The list is derived from journey state rather than stored, so there is
// nothing to delete — this records that one actor has dealt with one task on
// one journey, and the list filters against it. See
// supabase/migration-hc-queue-dismissed.sql.
//
// GET    -> { dismissed: [{ journeyId, taskKey }] } for this actor
// POST   { journeyId, taskKey }  -> dismiss
// DELETE { journeyId, taskKey }  -> undo
//
// Journeys are checked against the actor's location filter on write, so a
// dismissal cannot be recorded for somebody else's caseload.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor, type HcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

/* Both kinds of actor need to dismiss, and neither table holds a key for the
   other, so the key says which kind it is. */
const keyOf = (a: HcActor) => (a.kind === "worker" ? `w:${a.worker.id}` : `s:${a.staffId}`);

async function mayTouch(actor: HcActor, journeyId: string) {
  let q = supabaseAdmin.from("hc_journeys").select("id").eq("id", journeyId);
  const locs = actorLocationFilter(actor);
  if (locs !== null) {
    if (locs.length === 0) return false;
    q = q.in("location_id", locs);
  }
  const { data } = await q.maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin.from("hc_queue_dismissed")
    .select("journey_id, task_key").eq("actor_key", keyOf(actor)).limit(500);
  return NextResponse.json({
    dismissed: (data ?? []).map((d) => ({ journeyId: d.journey_id, taskKey: d.task_key })),
  });
}

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const journeyId = typeof body?.journeyId === "string" ? body.journeyId : null;
  const taskKey = typeof body?.taskKey === "string" ? body.taskKey.slice(0, 40) : null;
  if (!journeyId || !taskKey) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!(await mayTouch(actor, journeyId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin.from("hc_queue_dismissed")
    .upsert({ actor_key: keyOf(actor), journey_id: journeyId, task_key: taskKey },
            { onConflict: "actor_key,journey_id,task_key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const journeyId = typeof body?.journeyId === "string" ? body.journeyId : null;
  const taskKey = typeof body?.taskKey === "string" ? body.taskKey : null;
  if (!journeyId || !taskKey) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await supabaseAdmin.from("hc_queue_dismissed").delete()
    .eq("actor_key", keyOf(actor)).eq("journey_id", journeyId).eq("task_key", taskKey);
  return NextResponse.json({ ok: true });
}
