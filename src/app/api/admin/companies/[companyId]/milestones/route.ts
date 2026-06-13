// Per-employee process milestones for the company roster view.
//
// GET  /api/admin/companies/[companyId]/milestones
//      → { members: [{ member_id, client_id, measurement, blood_test,
//          questionnaire, doctor_review, app_access }] } where each
//          milestone is { done: boolean, source: 'auto'|'manual'|null }.
//      Merges auto-detected signals (station/doctor slots completed,
//      biody activation, journey_checks) with admin ticks.
// POST { member_id, milestone, done } — set/clear an admin tick.
//
// Tables: supabase/migration-member-milestones.sql.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";

const MILESTONES = ["measurement", "blood_test", "questionnaire", "doctor_review", "app_access"] as const;
type Milestone = (typeof MILESTONES)[number];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Cell = { done: boolean; source: "auto" | "manual" | null; auto: boolean };

export async function GET(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!UUID_RE.test(companyId)) return NextResponse.json({ error: "bad_company" }, { status: 400 });

  const { data: members, error: mErr } = await supabaseAdmin
    .from("company_members")
    .select("id, client_id")
    .eq("company_id", companyId);
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const memberIds = (members || []).map((m) => m.id as string);
  const clientIds = (members || []).map((m) => m.client_id as string | null).filter(Boolean) as string[];

  // Auto signals keyed by client_id
  const measuredClients = new Set<string>();
  const doctorClients = new Set<string>();
  const appClients = new Set<string>();
  const bloodClients = new Set<string>();
  const questionnaireClients = new Set<string>();

  if (clientIds.length > 0) {
    const [stationRes, doctorRes, clientsRes] = await Promise.all([
      supabaseAdmin.from("station_slots").select("client_id").in("client_id", clientIds).not("completed_at", "is", null),
      supabaseAdmin.from("doctor_slots").select("client_id").in("client_id", clientIds).not("completed_at", "is", null),
      supabaseAdmin.from("clients").select("id, biody_patient_id, journey_checks").in("id", clientIds),
    ]);
    for (const r of stationRes.data || []) if (r.client_id) measuredClients.add(r.client_id as string);
    for (const r of doctorRes.data || []) if (r.client_id) doctorClients.add(r.client_id as string);
    for (const c of clientsRes.data || []) {
      if (c.biody_patient_id) appClients.add(c.id as string);
      const jc = (c.journey_checks as Record<string, unknown> | null) || {};
      if (jc["blood_test"]) bloodClients.add(c.id as string);
      if (jc["questionnaire"]) questionnaireClients.add(c.id as string);
    }
  }

  // Manual ticks keyed by member_id+milestone
  const manual = new Set<string>();
  if (memberIds.length > 0) {
    const { data: ticks } = await supabaseAdmin
      .from("company_member_milestones")
      .select("member_id, milestone")
      .in("member_id", memberIds);
    for (const t of ticks || []) manual.add(`${t.member_id}:${t.milestone}`);
  }

  const cell = (memberId: string, milestone: Milestone, autoDone: boolean): Cell => {
    if (manual.has(`${memberId}:${milestone}`)) return { done: true, source: "manual", auto: autoDone };
    if (autoDone) return { done: true, source: "auto", auto: true };
    return { done: false, source: null, auto: false };
  };

  const result = (members || []).map((m) => {
    const cid = m.client_id as string | null;
    return {
      member_id: m.id as string,
      client_id: cid,
      measurement: cell(m.id as string, "measurement", !!cid && measuredClients.has(cid)),
      blood_test: cell(m.id as string, "blood_test", !!cid && bloodClients.has(cid)),
      questionnaire: cell(m.id as string, "questionnaire", !!cid && questionnaireClients.has(cid)),
      doctor_review: cell(m.id as string, "doctor_review", !!cid && doctorClients.has(cid)),
      app_access: cell(m.id as string, "app_access", !!cid && appClients.has(cid)),
    };
  });

  return NextResponse.json({ members: result });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  await params; // companyId not needed for the write (member_id is the key)
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const milestone = String(body?.milestone || "");
  const done = body?.done === true;
  const ids: string[] = Array.isArray(body?.member_ids)
    ? body.member_ids.map((x: unknown) => String(x))
    : body?.member_id ? [String(body.member_id)] : [];
  if (ids.length === 0 || ids.some((id) => !UUID_RE.test(id)) || !(MILESTONES as readonly string[]).includes(milestone)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (done) {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("company_member_milestones")
      .upsert(ids.map((id) => ({ member_id: id, milestone, done_at: now, marked_by: auth.id })),
        { onConflict: "member_id,milestone" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin
      .from("company_member_milestones")
      .delete()
      .in("member_id", ids)
      .eq("milestone", milestone);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
