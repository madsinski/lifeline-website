// The nurse's diary: every booking in a date range, as events.
//
// Three kinds only, because those are the three a nurse actually holds:
// mælingar, viðtal and eftirfylgdarviðtal. The blood draw is booked at
// Heilsugæslan and belongs on their calendar, not hers.
//
// GET ?from=ISO&to=ISO&scope=mine|all
//   mine → the journeys she is the interviewer on
//   all  → everything at her locations, so a stand-in can see the diary
//
// Reads the same three journey columns the .ics feed and the Google push
// read, so the calendar cannot drift from what is actually booked.
//
// Actor: workstation session or Lifeline staff, limited to their locations.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, actorWorkerId, getHcActor } from "@/lib/hc/ws-auth";
import { APPT_MINUTES, type ApptKind, type BookKind, measureLabel } from "@/lib/hc/appointment-kinds";

export const runtime = "nodejs";

const FIELD: Record<ApptKind, { at: string; done: string }> = {
  measure: { at: "measurements_booked_for", done: "measurements_done_at" },
  interview: { at: "interview_booked_for", done: "interview_done_at" },
  followup: { at: "followup_booked_for", done: "followup_done_at" },
};

export interface CalEvent {
  /*
   * Which table it came from. A journey appointment can be dragged to a new
   * time because there is a journey event that books it; a coach booking
   * cannot, so the client needs to tell them apart rather than guess.
   */
  source: "journey" | "booking";
  /** Empty for a booking, which hangs off the client rather than a journey. */
  journey_id: string;
  client_id: string;
  client: string | null;
  kind: ApptKind | BookKind;
  /** Set for bookings: what is actually being measured. */
  title?: string | null;
  at: string;
  minutes: number;
  done: boolean;
  mine: boolean;
  mode: string | null;
  meeting_url: string | null;
  location: string | null;
}

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || new Date(Date.now() - 7 * 86400_000).toISOString();
  const to = url.searchParams.get("to") || new Date(Date.now() + 28 * 86400_000).toISOString();
  const mineOnly = url.searchParams.get("scope") !== "all";
  const meId = actorWorkerId(actor);

  let q = supabaseAdmin
    .from("hc_journeys")
    .select("id, client_id, location_id, interviewer_id, measurements_booked_for, measurements_done_at, interview_booked_for, interview_mode, interview_done_at, meeting_url, followup_booked_for, followup_done_at, followup_mode, followup_meeting_url")
    .is("cancelled_at", null)
    .or(Object.values(FIELD).map((f) => `${f.at}.gte.${from}`).join(","))
    .limit(600);
  const locs = actorLocationFilter(actor);
  if (locs) q = q.in("location_id", locs);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const [{ data: clients }, { data: places }] = await Promise.all([
    rows.length
      ? supabaseAdmin.from("clients_decrypted").select("id, full_name").in("id", Array.from(new Set(rows.map((r) => r.client_id))))
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    supabaseAdmin.from("hc_locations").select("id, name"),
  ]);
  const name = new Map((clients ?? []).map((c) => [c.id, c.full_name]));
  const place = new Map((places ?? []).map((p) => [p.id, p.name]));

  const events: CalEvent[] = [];
  for (const r of rows) {
    const row = r as unknown as Record<string, string | null>;
    for (const kind of Object.keys(FIELD) as ApptKind[]) {
      const at = row[FIELD[kind].at];
      if (!at || at < from || at > to) continue;
      const mine = !!meId && r.interviewer_id === meId;
      if (mineOnly && meId && !mine) continue;
      events.push({
        source: "journey",
        journey_id: r.id,
        client_id: r.client_id,
        client: name.get(r.client_id) ?? null,
        kind,
        at,
        minutes: APPT_MINUTES[kind],
        done: !!row[FIELD[kind].done],
        mine,
        mode: kind === "interview" ? r.interview_mode : kind === "followup" ? r.followup_mode ?? null : null,
        meeting_url: kind === "interview" ? r.meeting_url : kind === "followup" ? r.followup_meeting_url ?? null : null,
        location: r.location_id ? place.get(r.location_id) ?? null : null,
      });
    }
  }
  /*
   * Coach bookings — Þjálfari → Bóka writes these to hc_bookings, which this
   * endpoint never read, so a video call or a measurement the participant
   * booked was invisible in the workstation diary even though it had been
   * pushed to the coach's Google calendar. The two surfaces disagreed about
   * the same day.
   */
  let bq = supabaseAdmin
    .from("hc_bookings")
    .select("id, client_id, coach_id, kind, items, starts_at, minutes, status, meeting_url")
    .gte("starts_at", from)
    .lte("starts_at", to)
    .neq("status", "cancelled")
    .limit(400);
  if (mineOnly && meId) bq = bq.eq("coach_id", meId);
  const { data: books } = await bq;
  const bookRows = books ?? [];

  /*
   * A booking hangs off the client, but the workstation opens people by
   * journey, so resolve one. Without this the event renders and does
   * nothing when clicked, which is worse than not showing it.
   */
  const jid = new Map<string, string>();
  for (const r of rows) jid.set(r.client_id, r.id);
  const noJourney = Array.from(new Set(bookRows.map((b) => b.client_id))).filter((id) => !jid.has(id));
  if (noJourney.length) {
    const { data: js } = await supabaseAdmin
      .from("hc_journeys").select("id, client_id").in("client_id", noJourney).is("cancelled_at", null);
    for (const j of js ?? []) if (!jid.has(j.client_id)) jid.set(j.client_id, j.id);
  }

  // Names for anyone who was not already loaded from a journey above.
  const missing = Array.from(new Set(bookRows.map((b) => b.client_id))).filter((id) => !name.has(id));
  if (missing.length) {
    const { data: more } = await supabaseAdmin.from("clients_decrypted").select("id, full_name").in("id", missing);
    for (const c of more ?? []) name.set(c.id, c.full_name);
  }

  for (const b of bookRows) {
    const kind = b.kind as BookKind;
    events.push({
      source: "booking",
      journey_id: jid.get(b.client_id) ?? "",
      client_id: b.client_id,
      client: name.get(b.client_id) ?? null,
      kind,
      title: kind === "measurement" ? measureLabel(b.items as string[] | null) : null,
      at: b.starts_at,
      minutes: b.minutes ?? 30,
      done: b.status === "done",
      mine: !!meId && b.coach_id === meId,
      mode: kind === "video" ? "video" : null,
      meeting_url: b.meeting_url ?? null,
      location: null,
    });
  }

  events.sort((a, b) => a.at.localeCompare(b.at));
  return NextResponse.json({ events, scope: mineOnly ? "mine" : "all" });
}
