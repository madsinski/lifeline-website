// One journey in the workstation.
// GET  → patient card (name, kennitala, contact), timeline, orders, audit
// POST { event, at?, mode?, note? } → record a milestone. Doctor-only events
//      (report_generated, referral_heilsugaesla) need a doctor/admin actor.
// Actor: workstation session or Lifeline staff (Bearer + AAL2).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { applyJourneyEvent, DOCTOR_ONLY, isJourneyEvent } from "@/lib/hc/events";
import { decryptKennitala, getClientProfile, siteOrigin } from "@/lib/hc/server";
import { actorLocationFilter, getHcActor, type HcActor } from "@/lib/hc/ws-auth";
import { sameOrigin } from "@/lib/hc/secrets";
import type { HcJourney } from "@/lib/hc/types";

export const runtime = "nodejs";

async function loadAllowed(actor: HcActor, id: string): Promise<HcJourney | null> {
  const { data } = await supabaseAdmin.from("hc_journeys").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const locs = actorLocationFilter(actor);
  if (locs && (!data.location_id || !locs.includes(data.location_id))) return null;
  return data as HcJourney;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const journey = await loadAllowed(actor, (await ctx.params).id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const profile = await getClientProfile(journey.client_id);
  const kennitala = await decryptKennitala(profile?.kennitala_encrypted ?? null, {
    actorRole: actor.kind === "staff" ? "staff" : `ws_${actor.worker.role}`,
    purpose: "workstation_patient_card",
    subjectId: journey.client_id,
    req,
  });
  const [{ data: orders }, { data: audit }, { data: plan }, { data: loc }, { data: workers }] = await Promise.all([
    supabaseAdmin.from("hc_orders").select("id, package_key, kind, payment_route, price_isk, amount_charged_isk, paid_at, activation_code, activation_redeemed_at").eq("journey_id", journey.id).order("created_at"),
    supabaseAdmin.from("hc_audit").select("actor, action, at, detail").eq("journey_id", journey.id).order("at", { ascending: false }).limit(60),
    supabaseAdmin.from("hc_action_plans").select("id, status, published_at, updated_at, headline").eq("journey_id", journey.id).maybeSingle(),
    journey.location_id ? supabaseAdmin.from("hc_locations").select("id, name").eq("id", journey.location_id).maybeSingle() : Promise.resolve({ data: null }),
    supabaseAdmin.from("hc_workers").select("id, name, organization, role").eq("active", true),
  ]);

  return NextResponse.json({
    journey,
    patient: {
      full_name: profile?.full_name ?? null,
      kennitala,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      address: profile?.address ?? null,
      date_of_birth: profile?.date_of_birth ?? null,
    },
    orders: orders || [],
    audit: (audit || []).map((a) => ({ actor: a.actor, action: a.action, at: a.at, note: (a.detail as { note?: string } | null)?.note ?? null })),
    plan,
    location: loc,
    workers: workers || [],
    actor: { label: actor.label, isDoctor: actor.isDoctor },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (actor.kind === "worker" && !sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const journey = await loadAllowed(actor, (await ctx.params).id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!isJourneyEvent(body.event)) return NextResponse.json({ error: "bad_event" }, { status: 400 });
  if (DOCTOR_ONLY.includes(body.event) && !actor.isDoctor) {
    return NextResponse.json({ error: "Aðeins læknir getur skráð þetta." }, { status: 403 });
  }
  if (body.at && Number.isNaN(new Date(body.at).getTime())) return NextResponse.json({ error: "bad_date" }, { status: 400 });

  const updated = await applyJourneyEvent(journey, body.event, {
    at: body.at ?? null,
    actor: actor.label,
    mode: body.mode === "video" ? "video" : body.mode === "in_person" ? "in_person" : null,
    note: typeof body.note === "string" ? body.note.slice(0, 2000) : null,
    interviewerId: typeof body.interviewer_id === "string" ? body.interviewer_id : actor.kind === "worker" ? actor.worker.id : null,
    origin: siteOrigin(req),
  });
  if (!updated) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ journey: updated });
}
