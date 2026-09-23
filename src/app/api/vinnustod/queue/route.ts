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

  let q = supabaseAdmin
    .from("hc_journeys")
    .select("id, client_id, location_id, stage, entry, paid_at, protocol_activated_at, blood_test_booked_for, blood_test_done_at, blood_results_at, measurements_booked_for, measurements_done_at, report_generated_at, report_sms_sent_at, interview_booked_for, interview_mode, interviewer_id, interview_done_at, meeting_url, plan_published_at, followup_booked_for, followup_done_at, referral_to_heilsugaesla, doctor_review_requested_at, doctor_reviewed_at, updated_at")
    .is("cancelled_at", null)
    // Anyone mid-journey, plus anyone whose report is already in hand: a
    // client the nurse created from a report has not done the customer-facing
    // steps (profile, payment), so their stage still reads "profile" — they
    // must still appear in the queue.
    .or("stage.in.(tests,report,interview,plan,action,protocol),report_generated_at.not.is.null")
    .order("updated_at", { ascending: false })
    .limit(400);
  if (locs) q = q.in("location_id", locs);
  const { data: journeys, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = Array.from(new Set((journeys || []).map((j) => j.client_id)));
  const names: Record<string, { full_name: string | null; phone: string | null; date_of_birth: string | null }> = {};
  if (ids.length) {
    const { data: clients } = await supabaseAdmin.from("clients_decrypted").select("id, full_name, phone, date_of_birth").in("id", ids);
    for (const c of clients || []) names[c.id] = { full_name: c.full_name, phone: c.phone, date_of_birth: c.date_of_birth };
  }
  const { data: plans } = await supabaseAdmin
    .from("hc_action_plans")
    .select("journey_id, status")
    .in("journey_id", (journeys || []).map((j) => j.id));
  const planStatus: Record<string, string> = {};
  for (const p of plans || []) planStatus[p.journey_id] = p.status;

  return NextResponse.json({
    journeys: (journeys || []).map((j) => ({
      ...j,
      client_name: names[j.client_id]?.full_name ?? "—",
      client_phone: names[j.client_id]?.phone ?? null,
      client_dob: names[j.client_id]?.date_of_birth ?? null,
      plan_status: planStatus[j.id] ?? null,
    })),
  });
}
