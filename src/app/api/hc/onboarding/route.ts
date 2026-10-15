// The composed onboarding flow, as the person walking it sees it.
//
// GET  -> { flow, stepIndex, answers, done }  or { flow: null } when there
//         is no published arrangement, which is the normal state until an
//         admin publishes one and must not break the app.
//
// Also returns `context` — the journey's track, whether terms are already
// accepted and whether training settings exist — so the player can skip
// what has been answered elsewhere (OnboardingPlayer, stepApplies()).
// Answers given on /byrja (user_metadata.start_answers) are seeded in, so
// they are never asked a second time.
//
// POST { action }
//   "answer"  { key, value }   record one question's answer
//   "goto"    { index }        move to a step (the player skips steps that
//                              no longer apply, so "next" is not always +1)
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
import type { User } from "@supabase/supabase-js";
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

/**
 * What /byrja already asked, in the shape the player stores answers in.
 *
 * Only known keys and short strings: user_metadata is whatever the signup
 * form sent, and the caller controls it.
 */
function seedAnswers(user: User): Record<string, string> {
  const raw = (user.user_metadata?.start_answers ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of ["goal", "move", "age"]) {
    const v = raw[k];
    if (typeof v === "string" && /^[a-z0-9]{1,20}$/.test(v)) out[k] = v;
  }
  const lim = raw.limits;
  const list = Array.isArray(lim) ? lim : typeof lim === "string" ? lim.split(",") : [];
  const clean = list.filter((x): x is string => typeof x === "string" && /^[a-z]{1,20}$/.test(x)).slice(0, 10);
  if (clean.length) out.limits = clean.join(",");
  return out;
}

/** The person's track, terms and training state, for skipping what is answered. */
async function contextFor(user: User) {
  const [{ data: journey }, { data: client }] = await Promise.all([
    supabaseAdmin.from("hc_journeys").select("id, entry").eq("client_id", user.id).is("cancelled_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("clients_decrypted").select("terms_accepted_at").eq("id", user.id).maybeSingle(),
  ]);
  let trainingSaved = false;
  if (journey?.id) {
    const { data: t } = await supabaseAdmin.from("hc_training_settings").select("journey_id").eq("journey_id", journey.id).maybeSingle();
    trainingSaved = !!t;
  }
  const entry = journey?.entry === "coach" || journey?.entry === "app" ? journey.entry : journey ? "check" : null;
  return {
    entry,
    terms_accepted: !!client?.terms_accepted_at || !!user.user_metadata?.terms_accepted_at,
    training_saved: trainingSaved,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [flow, context] = await Promise.all([flowFor(user.id), contextFor(user)]);
  const seeds = seedAnswers(user);
  /* No published flow is still a flow with nothing in it: the coaching
     track's training screen does not depend on an admin having published
     anything, so the player is told the context either way. */
  if (!flow) return NextResponse.json({ flow: null, answers: seeds, context });

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
    answers: { ...seeds, ...(sameFlow ? (p?.answers ?? {}) : {}) },
    done: sameFlow ? !!p?.done_at : false,
    context,
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
  const answers: Record<string, unknown> = { ...seedAnswers(user), ...(sameFlow ? (cur?.answers ?? {}) : {}) };

  const row: Record<string, unknown> = {
    client_id: user.id, flow_slug: flow.slug, updated_at: new Date().toISOString(),
  };

  if (action === "answer") {
    const key = typeof body?.key === "string" ? body.key.slice(0, 40) : null;
    if (!key) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    answers[key] = typeof body?.value === "string" ? body.value.slice(0, 120) : body?.value ?? null;
    row.answers = answers;
    row.step_index = at;
  } else if (action === "goto") {
    const to = Math.round(Number(body?.index));
    if (!Number.isFinite(to)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
    row.answers = answers;
    row.step_index = Math.max(0, Math.min(to, flow.steps.length));
    if (to >= flow.steps.length) row.done_at = new Date().toISOString();
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
