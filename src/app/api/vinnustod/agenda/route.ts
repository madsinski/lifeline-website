// What is already booked, so a new booking does not land on top of it.
//
// The clinic's diary rather than one person's: the mini calendar in a client's
// panel needs to know that 10:30 next Tuesday is taken, whoever is taking it.
// Scoped to the actor's locations for the same reason the queue is.
//
// GET ?days=60 → { busy: [{ at, minutes, what, client }] }
// Actor: workstation session or Lifeline staff.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

/** An interview runs 45 minutes, a follow-up 30. Same as the calendar feed. */
const MINUTES = { interview: 45, followup: 30 } as const;

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const days = Math.min(120, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 60));
  const from = new Date(Date.now() - 86400_000).toISOString();
  const to = new Date(Date.now() + days * 86400_000).toISOString();

  let q = supabaseAdmin
    .from("hc_journeys")
    .select("id, location_id, interview_booked_for, interview_done_at, followup_booked_for, followup_done_at")
    .is("cancelled_at", null)
    .or(`interview_booked_for.gte.${from},followup_booked_for.gte.${from}`)
    .limit(500);
  const locs = actorLocationFilter(actor);
  if (locs) q = q.in("location_id", locs);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const busy: { at: string; minutes: number; what: string; journey_id: string }[] = [];
  for (const r of data ?? []) {
    if (r.interview_booked_for && !r.interview_done_at && r.interview_booked_for >= from && r.interview_booked_for <= to) {
      busy.push({ at: r.interview_booked_for, minutes: MINUTES.interview, what: "Viðtal", journey_id: r.id });
    }
    if (r.followup_booked_for && !r.followup_done_at && r.followup_booked_for >= from && r.followup_booked_for <= to) {
      busy.push({ at: r.followup_booked_for, minutes: MINUTES.followup, what: "Eftirfylgd", journey_id: r.id });
    }
  }
  /*
   * What clients booked themselves.
   *
   * The agenda read the journey's own interview and followup columns and
   * nothing else, so a video call or a measurement somebody booked on their
   * Þjálfari page was invisible here — the coach's diary showed free time
   * that was not free. Same window, same location scoping.
   */
  const MEASURE_IS: Record<string, string> = {
    bodycomp: "líkamssamsetning", bloodpressure: "blóðþrýstingur",
    vo2max: "þrekpróf", strength: "styrkur",
  };
  const journeyIds = (data ?? []).map((r) => r.id as string);
  if (journeyIds.length) {
    const { data: bk } = await supabaseAdmin
      .from("hc_bookings")
      .select("journey_id, kind, items, starts_at, minutes")
      .in("journey_id", journeyIds)
      .neq("status", "cancelled")
      .gte("starts_at", from).lte("starts_at", to);
    for (const b of bk ?? []) {
      const items = Array.isArray(b.items) ? (b.items as string[]) : [];
      busy.push({
        at: b.starts_at as string,
        minutes: (b.minutes as number) ?? 30,
        what: b.kind === "video"
          ? "Myndsímtal"
          : `Mæling: ${items.map((k) => MEASURE_IS[k] ?? k).join(", ") || "á staðnum"}`,
        journey_id: b.journey_id as string,
      });
    }
  }

  busy.sort((a, b) => a.at.localeCompare(b.at));
  return NextResponse.json({ busy });
}
