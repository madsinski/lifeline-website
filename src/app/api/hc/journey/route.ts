// The customer's journey hub: everything /app needs in one call.
// GET  → the current journey, or { journey: null } when there is none.
//      ?stadur=<location slug> or ?start=1 creates it (an explicit start —
//      just looking at the page must not, or an app subscriber who peeks is
//      stuck in the health-check flow).
//      On creation the track is applied at once: ?track=coach|check, else
//      the start_track /byrja stored in user_metadata. A B2B employee
//      (clients.company_id) is always on the health check — their employer
//      bought it — so a coaching track is never applied to them.
//      { journey: null } also carries { b2b, start_track } so /app knows
//      whether it still has to ask.
// POST { action: "welcome_seen" } | { action: "set_booking", kind, at }
//      | { action: "allow_staff_import" } | { action: "revoke_staff_import" }
//        → the participant allows (or stops allowing) a nurse to put their
//          Medalia report in on their behalf (staff_import_consent_at,
//          migration-hc-medalia-split.sql). Staff import routes refuse
//          without it.
// Schema: supabase/migration-health-journey.sql

import { NextRequest, NextResponse } from "next/server";
import { hasHealthConsent } from "@/lib/health-consent";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  currentJourney, getClientProfile, getOrCreateJourney, isProfileComplete, patchJourney, profileTrackOf, requireUser,
} from "@/lib/hc/server";
import { journeySteps } from "@/lib/hc/stages";
import { appAccess } from "@/lib/hc/subscription";
import { STAFF_IMPORT_CONSENT_VERSION } from "@/lib/hc/consent";
import { stripCiphertext } from "@/lib/hc/notes";
import type { HcJourney } from "@/lib/hc/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const stadur = req.nextUrl.searchParams.get("stadur");
  const start = !!stadur || req.nextUrl.searchParams.get("start") === "1";
  const existing = await currentJourney(user.id);
  const metaTrack = user.user_metadata?.start_track;
  const startTrack = metaTrack === "coach" || metaTrack === "check" ? metaTrack : null;
  if (!start && !existing) {
    const p = await getClientProfile(user.id);
    return NextResponse.json({ journey: null, b2b: !!p?.company_id, start_track: startTrack });
  }
  let journey = await getOrCreateJourney(user.id, stadur);
  const profile = await getClientProfile(user.id);
  /* The route is decided once, when the journey is made — not by a second
     request that can arrive before the journey exists (it used to: the
     onboarding player posted choose_track first and got a 404). */
  if (!existing) {
    const asked = req.nextUrl.searchParams.get("track");
    const track = asked === "coach" || asked === "check" ? asked : startTrack;
    if (track === "coach" && !profile?.company_id && journey.entry !== "b2b") {
      journey = (await patchJourney(journey.id, { entry: "coach" }, `client:${user.id}`, "journey_track_coach")) ?? journey;
    }
  }
  const complete = isProfileComplete(profile, profileTrackOf(journey.entry));
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
    supabaseAdmin.from("hc_action_plans_decrypted").select("id, headline, published_at, review_date").eq("journey_id", journey.id).eq("status", "published").maybeSingle(),
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

  /*
   * Whether the app is open to them, and for how long.
   *
   * Served with the journey because every surface that needs it already
   * loads this, and because the rule is not something a client can work out
   * for itself — it depends on a paid order, a published plan and a
   * subscription row the browser can no longer read in full.
   */
  const access = await appAccess(user.id);

  return NextResponse.json({
    access,
    // Ciphertext columns never leave the server. staff_import_consent_at is
    // on the row: whether a nurse may put the report in for them.
    journey: stripCiphertext(journey),
    staff_import_consent_at: journey.staff_import_consent_at ?? null,
    steps: journeySteps(journey, complete),
    profile: {
      email: profile?.email ?? user.email,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      address: profile?.address ?? null,
      kennitala_last4: kennitalaLast4,
      complete,
      company_name: companyName,
      health_consent: await hasHealthConsent(user.id),
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

  /*
   * Pick a track, or change your mind.
   *
   * A track change rather than a new journey, on purpose: somebody who
   * starts with coaching and later wants the workup keeps their habits,
   * their streaks and their plan history. Starting them again would throw
   * all of it away to record a decision.
   *
   * Only ever between the coaching track and the health check, and only
   * while the check has not been paid for — once there is an order, the
   * stage machinery and the money disagree about what this journey is.
   */
  if (body.action === "choose_track") {
    const track = body.track === "coach" ? "coach" : body.track === "app" ? "app" : "check";
    const profile = await getClientProfile(user.id);
    if (track === "coach" || track === "app") {
      if (journey.paid_at) return NextResponse.json({ error: "already_paid" }, { status: 409 });
      /* The employer bought the check. Letting an employee swap it for
         coaching would quietly sideline something somebody else paid for. */
      if (profile?.company_id || journey.entry === "b2b") return NextResponse.json({ error: "b2b" }, { status: 409 });
      await patchJourney(journey.id, { entry: track }, `client:${user.id}`, `journey_track_${track}`);
    } else {
      // Back to whatever this person would have been without the choice.
      await patchJourney(journey.id, { entry: profile?.company_id ? "b2b" : "b2c" }, `client:${user.id}`, "journey_track_check");
    }
    return NextResponse.json({ ok: true, track });
  }

  if (body.action === "welcome_seen") {
    const j = journey.welcome_seen_at ? journey : await patchJourney(journey.id, { welcome_seen_at: new Date().toISOString() }, actor, "welcome_seen");
    return NextResponse.json({ journey: j && stripCiphertext(j) });
  }

  /*
   * The participant allows a nurse to put their Medalia report in for them,
   * or withdraws that. Their own session, their own tap: the staff import
   * routes refuse without it. Withdrawing stops future imports; it does not
   * remove a report already in (they can delete that in Aðgangur).
   */
  if (body.action === "allow_staff_import") {
    const j = await patchJourney(journey.id, {
      staff_import_consent_at: new Date().toISOString(),
      staff_import_consent_version: STAFF_IMPORT_CONSENT_VERSION,
    }, actor, "staff_import_allowed", { version: STAFF_IMPORT_CONSENT_VERSION });
    if (!j) return NextResponse.json({ error: "Tókst ekki að vista." }, { status: 500 });
    return NextResponse.json({ journey: stripCiphertext(j), staff_import_consent_at: j.staff_import_consent_at ?? null });
  }
  if (body.action === "revoke_staff_import") {
    const j = await patchJourney(journey.id, { staff_import_consent_at: null, staff_import_consent_version: null }, actor, "staff_import_revoked");
    if (!j) return NextResponse.json({ error: "Tókst ekki að vista." }, { status: 500 });
    return NextResponse.json({ journey: stripCiphertext(j), staff_import_consent_at: null });
  }

  // The customer confirms they entered the activation code in the patient
  // portal. The portal's partner API sets the same field when it is wired;
  // this lets people move on without waiting for it.
  if (body.action === "confirm_activated") {
    if (!journey.paid_at) return NextResponse.json({ error: "Greiðsla vantar." }, { status: 409 });
    const j = journey.protocol_activated_at ? journey : await patchJourney(journey.id, { protocol_activated_at: new Date().toISOString() }, actor, "protocol_confirmed_by_client");
    return NextResponse.json({ journey: j && stripCiphertext(j) });
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
    return NextResponse.json({ journey: j && stripCiphertext(j) });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
