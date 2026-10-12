// A coach's own clients.
//
// GET → the people assigned to the acting worker, with how they are doing.
//
// ── Why this exists ──────────────────────────────────────────────────
//
// The workstation's client list is the queue, and the queue is a pipeline:
// it groups by health-check stage (tests → report → interview → plan) and
// excludes the coaching and app-only tracks on purpose, so that somebody
// who never asked for a workup does not sit in a clinical worklist waiting
// for a nurse.
//
// The consequence was that a coaching client appeared nowhere at all.
// Nobody could service them, because nothing listed them. This is the list.
//
// ── Why it is "assigned to me" and not "coaching tracks" ─────────────
//
// A coach's caseload is the people they are responsible for, whatever they
// bought. A health-check customer with a coach needs following up exactly
// as much as an app subscriber does, and splitting the list by product would
// hand a coach two lists to remember to look at.
//
// ── What it reports ──────────────────────────────────────────────────
//
// Days with at least one tick, over a week and four weeks — days rather
// than ticks, so somebody with six habits does not look better than
// somebody with two, which is the same measure the participant sees on
// their own page. Plus the last thing they said, and whether it is waiting
// for an answer, because an unanswered message is the one thing in a
// coaching relationship that must not sit.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

/** Days back for the two adherence figures. */
const SHORT = 7;
const LONG = 28;

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  /*
   * Which worker is "me".
   *
   * A workstation session is a worker. Lifeline staff coming from /admin
   * have a worker row of their own (workerForStaff), which is what coach_id
   * points at — without it a staff member would see an empty caseload and
   * conclude they had no clients.
   */
  const meId = actor.kind === "worker" ? actor.worker.id : actor.workerId;
  if (!meId) {
    return NextResponse.json({ clients: [], me: null, reason: "no_worker_row" });
  }

  const locs = actorLocationFilter(actor);
  let q = supabaseAdmin.from("hc_journeys")
    .select("id, client_id, location_id, entry, stage, coach_id, plan_published_at, interview_done_at, followup_booked_for, updated_at")
    .eq("coach_id", meId)
    .is("cancelled_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (locs) q = q.in("location_id", locs);
  const { data: journeys, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = [...new Set((journeys ?? []).map((j) => j.client_id as string))];
  if (!ids.length) return NextResponse.json({ clients: [], me: meId });

  const [names, logs, chats] = await Promise.all([
    supabaseAdmin.from("clients_decrypted").select("id, full_name, phone").in("id", ids),
    // Ticks for everybody at once, then counted per person below: one query
    // beats one per client on a caseload of any size.
    /* done_on, not date. hc_action_logs calls the column done_on — I wrote
       `date` and shipped it, which meant the query errored and every client
       showed nought days active. Caught by running the same question in
       SQL rather than trusting the endpoint's shape. */
    supabaseAdmin.from("hc_action_logs")
      .select("client_id, done_on").in("client_id", ids).gte("done_on", isoDaysAgo(LONG)),
    supabaseAdmin.from("hc_chat_decrypted")
      .select("journey_id, author_kind, body, created_at, read_by_coach_at")
      .in("journey_id", (journeys ?? []).map((j) => j.id as string))
      .order("created_at", { ascending: false }).limit(400),
  ]);

  const nameById = new Map((names.data ?? []).map((c) => [c.id as string, c]));

  /** date strings per client, deduped — days, not ticks. */
  const daysByClient = new Map<string, Set<string>>();
  for (const l of logs.data ?? []) {
    const k = l.client_id as string;
    if (!daysByClient.has(k)) daysByClient.set(k, new Set());
    daysByClient.get(k)!.add(l.done_on as string);
  }

  const shortCut = isoDaysAgo(SHORT);
  const lastByJourney = new Map<string, { body: string; at: string; fromClient: boolean; unread: boolean }>();
  for (const c of chats.data ?? []) {
    const k = c.journey_id as string;
    if (lastByJourney.has(k)) continue; // newest first, so the first is the last
    lastByJourney.set(k, {
      body: String(c.body ?? "").slice(0, 120),
      at: c.created_at as string,
      fromClient: c.author_kind === "client",
      unread: c.author_kind === "client" && !c.read_by_coach_at,
    });
  }

  const clients = (journeys ?? []).map((j) => {
    const days = daysByClient.get(j.client_id as string) ?? new Set<string>();
    const last = lastByJourney.get(j.id as string) ?? null;
    return {
      journey_id: j.id,
      client_id: j.client_id,
      name: nameById.get(j.client_id as string)?.full_name ?? null,
      phone: nameById.get(j.client_id as string)?.phone ?? null,
      entry: j.entry,
      stage: j.stage,
      has_plan: !!j.plan_published_at,
      // Days with at least one tick, so six habits do not beat two.
      days_7: [...days].filter((d) => d >= shortCut).length,
      days_28: days.size,
      last_message: last,
      /** The one thing that must not sit in a coaching relationship. */
      needs_reply: !!last?.unread,
      updated_at: j.updated_at,
    };
  });

  // Unanswered first, then whoever is slipping, then the rest. A caseload is
  // read top-down and the order is the triage.
  clients.sort((a, b) =>
    Number(b.needs_reply) - Number(a.needs_reply)
    || a.days_7 - b.days_7
    || String(b.updated_at).localeCompare(String(a.updated_at)));

  return NextResponse.json({ clients, me: meId, window: { short: SHORT, long: LONG } });
}
