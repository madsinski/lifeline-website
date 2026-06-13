// Bulk per-company milestone completion counts, for the journey strip
// on every company card (Assessments = measurement+blood+questionnaire,
// Follow-up = doctor_review). One pass over all rosters; merges the
// auto signals with admin ticks exactly like the per-company route.
//
// GET → { summary: { [companyId]: { total, measurement, blood_test,
//         questionnaire, doctor_review, app_access } } }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff } from "@/lib/auth-helpers";

type Counts = { total: number; measurement: number; blood_test: number; questionnaire: number; doctor_review: number; followup: number; app_access: number };

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data: members } = await supabaseAdmin
    .from("company_members").select("id, company_id, client_id");
  const list = members || [];
  const clientIds = list.map((m) => m.client_id as string | null).filter(Boolean) as string[];

  const measured = new Set<string>();   // client_ids
  const doctored = new Set<string>();
  const apped = new Set<string>();
  const blooded = new Set<string>();
  const questioned = new Set<string>();
  if (clientIds.length > 0) {
    const [st, dr, cl] = await Promise.all([
      supabaseAdmin.from("station_slots").select("client_id").in("client_id", clientIds).not("completed_at", "is", null),
      supabaseAdmin.from("doctor_slots").select("client_id").in("client_id", clientIds).not("completed_at", "is", null),
      supabaseAdmin.from("clients").select("id, biody_patient_id, journey_checks").in("id", clientIds),
    ]);
    for (const r of st.data || []) if (r.client_id) measured.add(r.client_id as string);
    for (const r of dr.data || []) if (r.client_id) doctored.add(r.client_id as string);
    for (const c of cl.data || []) {
      if (c.biody_patient_id) apped.add(c.id as string);
      const jc = (c.journey_checks as Record<string, unknown> | null) || {};
      if (jc["blood_test"]) blooded.add(c.id as string);
      if (jc["questionnaire"]) questioned.add(c.id as string);
    }
  }

  // Manual ticks keyed by member_id:milestone
  const manual = new Set<string>();
  const { data: ticks } = await supabaseAdmin.from("company_member_milestones").select("member_id, milestone");
  for (const t of ticks || []) manual.add(`${t.member_id}:${t.milestone}`);

  const summary: Record<string, Counts> = {};
  const bump = (cid: string): Counts => (summary[cid] ||= { total: 0, measurement: 0, blood_test: 0, questionnaire: 0, doctor_review: 0, followup: 0, app_access: 0 });
  const done = (memberId: string, milestone: string, autoDone: boolean) => manual.has(`${memberId}:${milestone}`) || autoDone;

  for (const m of list) {
    const cid = m.company_id as string;
    const clientId = m.client_id as string | null;
    const c = bump(cid);
    c.total += 1;
    if (done(m.id as string, "measurement", !!clientId && measured.has(clientId))) c.measurement += 1;
    if (done(m.id as string, "blood_test", !!clientId && blooded.has(clientId))) c.blood_test += 1;
    if (done(m.id as string, "questionnaire", !!clientId && questioned.has(clientId))) c.questionnaire += 1;
    if (done(m.id as string, "doctor_review", !!clientId && doctored.has(clientId))) c.doctor_review += 1;
    if (done(m.id as string, "followup", false)) c.followup += 1;
    if (done(m.id as string, "app_access", !!clientId && apped.has(clientId))) c.app_access += 1;
  }

  return NextResponse.json({ summary });
}
