// The customer's journey hub: everything /account/heilsuferd needs in one call.
// GET  ?stadur=<location slug>  → creates the journey on first visit.
// POST { action: "welcome_seen" } | { action: "set_booking", kind, at }
// Schema: supabase/migration-health-journey.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getClientProfile, getOrCreateJourney, isProfileComplete, patchJourney, requireUser,
} from "@/lib/hc/server";
import { journeySteps } from "@/lib/hc/stages";
import type { HcJourney } from "@/lib/hc/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const stadur = req.nextUrl.searchParams.get("stadur");
  let journey = await getOrCreateJourney(user.id, stadur);
  const profile = await getClientProfile(user.id);
  const complete = isProfileComplete(profile);
  if (complete && !journey.profile_completed_at) {
    journey = (await patchJourney(journey.id, { profile_completed_at: new Date().toISOString() }, `client:${user.id}`, "profile_complete")) ?? journey;
  }

  const [loc, pkgs, orders, claims, lectures, progress, plan, feed, history] = await Promise.all([
    journey.location_id
      ? supabaseAdmin.from("hc_locations").select("*").eq("id", journey.location_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from("hc_packages").select("*").eq("active", true).order("sort"),
    supabaseAdmin.from("hc_orders").select("*").eq("client_id", user.id).order("created_at", { ascending: false }),
    supabaseAdmin.from("hc_union_claims").select("id, order_id, union_id, reimbursable_isk, status, sent_at, sent_to").eq("client_id", user.id),
    supabaseAdmin.from("hc_lectures").select("id, slug, title, subtitle, kind, duration_min, pillar, is_welcome, sort").eq("published", true).order("sort"),
    supabaseAdmin.from("hc_lecture_progress").select("lecture_id, completed_at").eq("client_id", user.id),
    supabaseAdmin.from("hc_action_plans").select("id, headline, published_at, review_date").eq("journey_id", journey.id).eq("status", "published").maybeSingle(),
    supabaseAdmin.from("account_calendar_feeds").select("token").eq("user_id", user.id).maybeSingle(),
    supabaseAdmin.from("hc_journeys").select("id, created_at, completed_at, plan_published_at").eq("client_id", user.id).neq("id", journey.id).order("created_at", { ascending: false }),
  ]);

  const packages = (pkgs.data || []).filter((p) => !p.location_id || p.location_id === journey.location_id);
  let kennitalaLast4: string | null = null;
  if (profile?.kennitala_encrypted) {
    const { data } = await supabaseAdmin.rpc("kennitala_last4", { p_enc: profile.kennitala_encrypted });
    kennitalaLast4 = typeof data === "string" ? data : null;
  }
  let companyName: string | null = null;
  if (profile?.company_id) {
    const { data } = await supabaseAdmin.from("companies").select("name").eq("id", profile.company_id).maybeSingle();
    companyName = data?.name ?? null;
  }

  const unionIds = Array.from(new Set((claims.data || []).map((c) => c.union_id)));
  const unionNames: Record<string, string> = {};
  if (unionIds.length) {
    const { data } = await supabaseAdmin.from("hc_unions").select("id, name").in("id", unionIds);
    for (const u of data || []) unionNames[u.id] = u.name;
  }

  return NextResponse.json({
    journey,
    steps: journeySteps(journey, complete),
    profile: {
      email: profile?.email ?? user.email,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      address: profile?.address ?? null,
      kennitala_last4: kennitalaLast4,
      complete,
      company_name: companyName,
    },
    location: loc.data,
    packages,
    orders: orders.data || [],
    claims: (claims.data || []).map((c) => ({ ...c, union_name: unionNames[c.union_id] ?? null })),
    lectures: (lectures.data || []).map((l) => ({
      ...l,
      completed_at: (progress.data || []).find((p) => p.lecture_id === l.id)?.completed_at ?? null,
    })),
    plan: plan.data,
    calendar_connected: !!feed.data,
    history: history.data || [],
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => ({}));
  const { data: journey } = await supabaseAdmin
    .from("hc_journeys")
    .select("*")
    .eq("client_id", user.id)
    .is("cancelled_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!journey) return NextResponse.json({ error: "no_journey" }, { status: 404 });
  const actor = `client:${user.id}`;

  if (body.action === "welcome_seen") {
    const j = journey.welcome_seen_at ? journey : await patchJourney(journey.id, { welcome_seen_at: new Date().toISOString() }, actor, "welcome_seen");
    return NextResponse.json({ journey: j });
  }

  // The customer confirms they entered the activation code in the patient
  // portal. The portal's partner API sets the same field when it is wired;
  // this lets people move on without waiting for it.
  if (body.action === "confirm_activated") {
    if (!journey.paid_at) return NextResponse.json({ error: "Greiðsla vantar." }, { status: 409 });
    const j = journey.protocol_activated_at ? journey : await patchJourney(journey.id, { protocol_activated_at: new Date().toISOString() }, actor, "protocol_confirmed_by_client");
    return NextResponse.json({ journey: j });
  }

  // The customer books blood test / measurements in the patient portal and
  // may note the time here so it lands in their calendar feed. The partner
  // API overwrites it when the portal reports the real booking.
  if (body.action === "set_booking") {
    const field: Record<string, keyof HcJourney> = {
      blood: "blood_test_booked_for",
      measurements: "measurements_booked_for",
    };
    const key = field[body.kind as string];
    if (!key) return NextResponse.json({ error: "bad_kind" }, { status: 400 });
    const at = body.at ? new Date(body.at) : null;
    if (at && Number.isNaN(at.getTime())) return NextResponse.json({ error: "bad_date" }, { status: 400 });
    const j = await patchJourney(journey.id, { [key]: at ? at.toISOString() : null } as Partial<HcJourney>, actor, "set_booking", { kind: body.kind });
    return NextResponse.json({ journey: j });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
