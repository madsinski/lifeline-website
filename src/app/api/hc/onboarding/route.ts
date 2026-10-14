// The composed onboarding flow, as the person walking it sees it.
//
// GET  -> { flow, stepIndex, answers, done }  or { flow: null } when there
//         is no published arrangement, which is the normal state until an
//         admin publishes one and must not break the app.
//
// POST { action }
//   "answer"  { key, value }   record one question's answer
//   "advance"                  move on by one
//   "back"                     move back by one
//   "done"                     finish
//
// Progress lives in hc_onboarding_progress, keyed by client, deliberately
// separate from the flow: editing an arrangement must not rewrite anybody's
// position in it, and republishing must not throw somebody halfway through
// back to the start.
//
// The step index is clamped on read rather than trusted. A flow that loses a
// step while somebody is standing on it would otherwise leave them pointing
// past the end — a blank screen with no way forward.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import type { FlowStep } from "@/lib/hc/onboarding-modules";

export const runtime = "nodejs";

interface FlowRow { slug: string; name: string; audience: string; steps: FlowStep[] }

/** The flow for this person: their own track first, then the general one. */
async function flowFor(clientId: string): Promise<FlowRow | null> {
  const { data: journey } = await supabaseAdmin
    .from("hc_journeys").select("entry").eq("client_id", clientId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  const entry = journey?.entry === "coach" ? "coach" : journey?.entry ? "check" : null;
  const { data: rows } = await supabaseAdmin
    .from("hc_onboarding_flows").select("slug, name, audience, steps").eq("active", true);
  const all = (rows ?? []) as FlowRow[];
  /* A flow aimed at this person's track beats the general one; the general
     one is the fallback, not the default. */
  return all.find((f) => f.audience === entry) ?? all.find((f) => f.audience === "all") ?? null;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const flow = await flowFor(user.id);
  if (!flow) return NextResponse.json({ flow: null });

  const { data: p } = await supabaseAdmin.from("hc_onboarding_progress")
    .select("flow_slug, step_index, answers, done_at").eq("client_id", user.id).maybeSingle();

  /* A different flow than last time means starting it, not resuming at
     whatever index the previous one had reached. */
  const sameFlow = p?.flow_slug === flow.slug;
  const raw = sameFlow ? (p?.step_index ?? 0) : 0;
  const stepIndex = Math.max(0, Math.min(raw, Math.max(flow.steps.length - 1, 0)));

  return NextResponse.json({
    flow: { slug: flow.slug, name: flow.name, steps: flow.steps },
    stepIndex,
    answers: sameFlow ? (p?.answers ?? {}) : {},
    done: sameFlow ? !!p?.done_at : false,
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  const flow = await flowFor(user.id);
  if (!flow) return NextResponse.json({ error: "no_flow" }, { status: 409 });

  const { data: cur } = await supabaseAdmin.from("hc_onboarding_progress")
    .select("flow_slug, step_index, answers").eq("client_id", user.id).maybeSingle();
  const sameFlow = cur?.flow_slug === flow.slug;
  const at = sameFlow ? (cur?.step_index ?? 0) : 0;
  const answers: Record<string, unknown> = sameFlow ? { ...(cur?.answers ?? {}) } : {};

  const row: Record<string, unknown> = {
    client_id: user.id, flow_slug: flow.slug, updated_at: new Date().toISOString(),
  };

  if (action === "answer") {
    const key = typeof body?.key === "string" ? body.key.slice(0, 40) : null;
    if (!key) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    answers[key] = typeof body?.value === "string" ? body.value.slice(0, 120) : body?.value ?? null;
    row.answers = answers;
    row.step_index = at;
  } else if (action === "advance") {
    row.answers = answers;
    row.step_index = Math.min(at + 1, flow.steps.length);
    /* Running off the end IS finishing — a flow whose last step is answered
       should not need a separate "done" that the client might never send. */
    if (at + 1 >= flow.steps.length) row.done_at = new Date().toISOString();
  } else if (action === "back") {
    row.answers = answers;
    row.step_index = Math.max(at - 1, 0);
  } else if (action === "done") {
    row.answers = answers;
    row.step_index = flow.steps.length;
    row.done_at = new Date().toISOString();
  } else {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("hc_onboarding_progress")
    .upsert(row, { onConflict: "client_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, stepIndex: row.step_index, done: !!row.done_at });
}
