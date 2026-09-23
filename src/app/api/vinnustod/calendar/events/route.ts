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
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { APPT_MINUTES, type ApptKind } from "@/lib/hc/appointment-kinds";

export const runtime = "nodejs";

const FIELD: Record<ApptKind, { at: string; done: string }> = {
  measure: { at: "measurements_booked_for", done: "measurements_done_at" },
  interview: { at: "interview_booked_for", done: "interview_done_at" },
  followup: { at: "followup_booked_for", done: "followup_done_at" },
};

export interface CalEvent {
  journey_id: string;
  client_id: string;
  client: string | null;
  kind: ApptKind;
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
  const meId = actor.kind === "worker" ? actor.worker.id : null;

  let q = supabaseAdmin
    .from("hc_journeys")
    .select("id, client_id, location_id, interviewer_id, measurements_booked_for, measurements_done_at, interview_booked_for, interview_mode, interview_done_at, meeting_url, followup_booked_for, followup_done_at")
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
        journey_id: r.id,
        client_id: r.client_id,
        client: name.get(r.client_id) ?? null,
        kind,
        at,
        minutes: APPT_MINUTES[kind],
        done: !!row[FIELD[kind].done],
        mine,
        mode: kind === "interview" ? r.interview_mode : null,
        meeting_url: kind === "interview" ? r.meeting_url : null,
        location: r.location_id ? place.get(r.location_id) ?? null : null,
      });
    }
  }
  events.sort((a, b) => a.at.localeCompare(b.at));
  return NextResponse.json({ events, scope: mineOnly ? "mine" : "all" });
}
