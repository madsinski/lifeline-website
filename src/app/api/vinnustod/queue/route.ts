// Workstation queue: journeys grouped by stage, limited to the actor's
// locations. Names come from clients_decrypted; no kennitala here.
// Actor: workstation session or Lifeline staff (Bearer + AAL2).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const locs = actorLocationFilter(actor);
  if (locs && locs.length === 0) return NextResponse.json({ journeys: [] });

  const BASE = "id, client_id, location_id, stage, entry, paid_at, protocol_activated_at, blood_test_booked_for, blood_test_done_at, blood_results_at, measurements_booked_for, measurements_done_at, report_generated_at, report_sms_sent_at, report_imported_at, interview_booked_for, interview_mode, interviewer_id, interview_done_at, meeting_url, plan_published_at, followup_booked_for, followup_done_at, followup_mode, followup_meeting_url, referral_to_heilsugaesla, doctor_review_requested_at, doctor_reviewed_at, updated_at";
  // Medalia split columns (migration-hc-medalia-split.sql). If they are not
  // there yet, the queue still loads without them.
  const SPLIT = ", own_report_at, doctor_interview_done_at, staff_import_consent_at";
  const query = (cols: string) => {
    let q = supabaseAdmin
    .from("hc_journeys")
    .select(cols)
    .is("cancelled_at", null)
    /*
     * The coaching track is not clinical work.
     *
     * Its steps end at a plan the participant writes themselves, so such a
     * journey sits at stage 'plan' and then 'action' — both inside the
     * filter below. Without this they would queue up in the workstation
     * waiting for a nurse to write something nobody asked her for.
     *
     * The same mistake own_report_at made and that this file already warns
     * about: a stage is not by itself evidence that Lifeline has taken
     * somebody on. If they later add the health check, entry flips back to
     * b2c/b2b and they appear here as they should.
     */
    .not("entry", "in", "(coach,app)")
    // Anyone mid-journey, plus anyone whose report is already in hand: a
    // client the nurse created from a report has not done the customer-facing
    // steps (profile, payment), so their stage still reads "profile" — they
    // must still appear in the queue.
    // "doctor" = waiting for the doctor's interview in Medalia.
    .or("stage.in.(tests,report,doctor,interview,plan,action,protocol),report_generated_at.not.is.null,report_imported_at.not.is.null")
    .order("updated_at", { ascending: false })
    .limit(400);
    if (locs) q = q.in("location_id", locs);
    return q;
  };
  let res = await query(BASE + SPLIT);
  if (res.error) res = await query(BASE);
  const { error } = res;
  const journeys = (res.data ?? []) as unknown as ({ id: string; client_id: string; plan_published_at: string | null } & Record<string, unknown>)[];
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = Array.from(new Set((journeys || []).map((j) => j.client_id)));
  const names: Record<string, { full_name: string | null; phone: string | null; date_of_birth: string | null }> = {};
  if (ids.length) {
    const { data: clients } = await supabaseAdmin.from("clients_decrypted").select("id, full_name, phone, date_of_birth").in("id", ids);
    for (const c of clients || []) names[c.id] = { full_name: c.full_name, phone: c.phone, date_of_birth: c.date_of_birth };
  }
  const { data: plans } = await supabaseAdmin
    .from("hc_action_plans_decrypted")
    .select("journey_id, status")
    .in("journey_id", (journeys || []).map((j) => j.id));
  const planStatus: Record<string, string> = {};
  for (const p of plans || []) planStatus[p.journey_id] = p.status;
  // Vera partner contacts whose email did not go — something to resend.
  // (The doctor-referral path this used to count was removed in the
  // Medalia split.)
  const openRefs: Record<string, number> = {};
  if ((journeys || []).length) {
    const { data: refs } = await supabaseAdmin.from("hc_referrals").select("journey_id").eq("status", "failed")
      .in("target", ["physio", "psychologist", "nutritionist"]).in("journey_id", (journeys || []).map((j) => j.id));
    for (const r of refs || []) openRefs[r.journey_id] = (openRefs[r.journey_id] ?? 0) + 1;
  }
  // Plan use in the last week, for "needs a nudge" on the to-do list.
  const live = (journeys || []).filter((j) => j.plan_published_at).map((j) => j.id);
  const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const week = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const lastTick: Record<string, string> = {}, ticks7: Record<string, number> = {};
  if (live.length) {
    const { data: logs } = await supabaseAdmin.from("hc_action_logs").select("journey_id, done_on").in("journey_id", live).gte("done_on", since);
    for (const l of logs || []) {
      if (!lastTick[l.journey_id] || l.done_on > lastTick[l.journey_id]) lastTick[l.journey_id] = l.done_on;
      if (l.done_on >= week) ticks7[l.journey_id] = (ticks7[l.journey_id] ?? 0) + 1;
    }
  }

  /* "Lifeline þjálfun" subscribers, for the Þjálfun badge: an active row,
     or a cancelled one still inside its paid period. One query for all. */
  const coachingClients = new Set<string>();
  if (ids.length) {
    const { data: subs } = await supabaseAdmin.from("subscriptions")
      .select("client_id, status, current_period_end").eq("tier", "coaching").in("status", ["active", "cancelled"]).in("client_id", ids);
    const now = Date.now();
    for (const s of subs || []) {
      if (s.status === "active" || (s.current_period_end && Date.parse(s.current_period_end) > now)) coachingClients.add(s.client_id);
    }
  }

  return NextResponse.json({
    journeys: (journeys || []).map((j) => ({
      ...j,
      coaching: coachingClients.has(j.client_id),
      /*
       * A journey whose client row is gone is a fault, not a nameless
       * person, and the coach's queue should say which.
       *
       * This rendered as "—" and looked like a display bug. It is not:
       * victor@lifelinehealth.is has an auth user, a journey and a
       * published plan but no row in `clients` at all, so there is nothing
       * to show and nothing a coach can do with the row. Labelling it means
       * somebody can actually fix it instead of scrolling past a dash.
       */
      client_name: names[j.client_id]?.full_name ?? "Vantar skjólstæðingsgögn",
      client_missing: !names[j.client_id],
      client_phone: names[j.client_id]?.phone ?? null,
      client_dob: names[j.client_id]?.date_of_birth ?? null,
      plan_status: planStatus[j.id] ?? null,
      last_tick_on: lastTick[j.id] ?? null,
      open_referrals: openRefs[j.id] ?? 0,
      // A Vera partner contact whose email did not go: resend it.
      partner_failed: (openRefs[j.id] ?? 0) > 0,
      ticks_7d: ticks7[j.id] ?? 0,
    })),
  });
}
