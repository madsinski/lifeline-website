// The participant's own surfaces, for a coach, on a chosen journey.
//
// Three parts, mirroring the three endpoints the client's own plan page
// loads, so the coach screen can render the client's own components:
//
//   GET  (no part)        /api/hc/actions — plan, ticks, prefs, flags, report
//                         plus the consent state of that report
//   GET  ?part=plan       /api/hc/plan — the published plan, lectures,
//                         appointments
//   GET  ?part=training   /api/hc/training — settings, their own arrangement,
//                         meal picks, gym
//   POST (no part)        a reordered section, a tick, per-action adjustments
//   POST ?part=training   the arrangement: days, swaps, meal picks, favourites
//
// All of it resolved for THIS journey under workstation auth, instead of the
// signed-in client's session.
//
// Why a separate route rather than letting staff call /api/hc/actions.
//
// That route answers "my own journey" and proves it with
// `.eq("client_id", userId)`. Teaching it to also mean "a journey I am the
// coach for" would put two different authorisation models in one handler,
// where the cost of getting the branch wrong is one client reading
// another's blood results. This route is the staff model only, and the
// participant route stays exactly as narrow as it was.
//
// The views are reused untouched: the coach screen hands them an `api`
// wrapper that rewrites /api/hc/actions to this path, so MyActions does not
// know or care which one it is talking to. See CoachAsClient.tsx.
//
// Auth: workstation actor (staff Bearer+AAL2, or a worker session), and the
// journey must be at a location that actor may see.
// Schema: supabase/migration-hc-action-logs.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isoDay, lastDays } from "@/lib/hc/adherence";
import { trafficLights } from "@/lib/hc/analyze";
import { loadReport } from "@/lib/hc/report-store";
import { sexOf } from "@/lib/hc/sex";
import { hcAudit } from "@/lib/hc/server";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { getClientProfile } from "@/lib/hc/server";
import { loadPlanPrefs, saveTraining } from "@/lib/hc/training-server";
import { upcomingAppointments } from "@/lib/hc/upcoming";
import { withWhen } from "@/lib/hc/plan-when";
import type { HcJourney } from "@/lib/hc/types";
import type { KnowledgeEntry } from "@/lib/hc/knowledge";

export const runtime = "nodejs";

/** The journey, only if this actor is allowed to see it. */
async function visibleJourney(req: NextRequest, journeyId: string) {
  const actor = await getHcActor(req);
  if (!actor) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  let q = supabaseAdmin.from("hc_journeys")
    .select("id, client_id, location_id, report_generated_at, own_report_at")
    .eq("id", journeyId);
  /* A partner worker only sees their own sites. An empty list means "no
     sites assigned", which must deny rather than match everything. */
  const locs = actorLocationFilter(actor);
  if (locs !== null) {
    if (locs.length === 0) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
    q = q.in("location_id", locs);
  }
  const { data } = await q.maybeSingle<{
    id: string; client_id: string; location_id: string | null;
    report_generated_at: string | null; own_report_at: string | null;
  }>();
  if (!data) return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  return { actor, journey: data };
}

/**
 * What the coach is allowed to know about the client's consent, and nothing
 * more.
 *
 * Dates and flags only — never the report's contents, which travel by their
 * own path. The point is to let a coach see whether the client has confirmed
 * a report somebody else entered for them, because that governs whether the
 * client can see it on their own screens. It does NOT govern whether staff
 * may read it: that is Art. 9(2)(h), processing for care, and it is why a
 * clinician can open results during the consultation they are in. Posture
 * v1.15.
 */
async function consentState(journeyId: string) {
  const { data } = await supabaseAdmin.from("hc_reports")
    .select("source, imported_by, created_at, on_behalf_consent_at, approval_requested_at, client_approved_at, self_consent_at")
    .eq("journey_id", journeyId)
    .order("created_at", { ascending: false }).limit(1)
    .maybeSingle<{
      source: string | null; imported_by: string | null; created_at: string;
      on_behalf_consent_at: string | null; approval_requested_at: string | null;
      client_approved_at: string | null; self_consent_at: string | null;
    }>();
  if (!data) return { has_report: false } as const;
  const onBehalf = data.source !== "self";
  return {
    has_report: true,
    /** Did staff enter this, or the client themselves? */
    on_behalf: onBehalf,
    imported_at: data.created_at,
    /** The client's own confirmation, in their own session. */
    client_confirmed_at: data.client_approved_at ?? data.self_consent_at ?? null,
    confirmation_requested_at: data.approval_requested_at,
    /**
     * Visible to the client on their own surfaces?
     *
     * A staff-entered report is held off them until they confirm it came
     * from where it says. Their own upload needs no confirmation.
     */
    visible_to_client: onBehalf ? !!data.client_approved_at : true,
    on_behalf_consent_at: data.on_behalf_consent_at,
  } as const;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const got = await visibleJourney(req, id);
  if ("error" in got) return got.error;
  const { journey } = got;
  const part = req.nextUrl.searchParams.get("part");

  /*
   * The published plan, as /api/hc/plan answers it.
   *
   * Every client_id filter in that route becomes the journey's own client
   * rather than the caller's — the caller is staff, and filtering by them
   * would find nothing at all.
   */
  if (part === "plan") {
    const { data: plan } = await supabaseAdmin
      .from("hc_action_plans_decrypted").select("*")
      .eq("journey_id", journey.id).eq("client_id", journey.client_id)
      .eq("status", "published").maybeSingle();
    const profile = await getClientProfile(journey.client_id);
    const slugs: string[] = plan?.lecture_slugs ?? [];
    const { data: lecs } = slugs.length
      ? await supabaseAdmin.from("hc_lectures").select("slug, title, subtitle, kind, duration_min, pillar").in("slug", slugs).eq("published", true)
      : { data: [] };
    const lectures = slugs.map((x) => (lecs || []).find((l) => l.slug === x)).filter(Boolean);
    const { data: done } = lectures.length
      ? await supabaseAdmin.from("hc_lecture_progress").select("lecture_id, hc_lectures!inner(slug)").eq("client_id", journey.client_id)
      : { data: [] };
    const doneSlugs = new Set((done || []).map((x) => (x as unknown as { hc_lectures: { slug: string } }).hc_lectures.slug));
    const { data: j } = await supabaseAdmin.from("hc_journeys").select("*").eq("id", journey.id).maybeSingle();
    const { data: loc } = j?.location_id
      ? await supabaseAdmin.from("hc_locations").select("*").eq("id", j.location_id).maybeSingle()
      : { data: null };
    return NextResponse.json({
      plan: plan ? { ...plan, modules: await withWhen(plan.modules) } : plan,
      client_name: profile?.full_name ?? null,
      lectures: lectures.map((l) => ({ ...l, completed: doneSlugs.has(l!.slug) })),
      appointments: j ? upcomingAppointments(j as HcJourney, loc) : [],
      has_report: !!j?.report_generated_at,
    });
  }

  /* Their settings and their own arrangement, as /api/hc/training answers it. */
  if (part === "training") {
    const prefs = await loadPlanPrefs(journey.id);
    const { data: loc } = await supabaseAdmin
      .from("hc_journeys").select("hc_locations(gym_name, gym_url, gym_info)")
      .eq("id", journey.id).maybeSingle<{ hc_locations: { gym_name: string | null; gym_url: string | null; gym_info: string | null } | null }>();
    return NextResponse.json({
      ...prefs,
      gym: loc?.hc_locations
        ? { name: loc.hc_locations.gym_name, url: loc.hc_locations.gym_url, info: loc.hc_locations.gym_info }
        : null,
    });
  }

  const since = lastDays(28)[0];
  const [{ data: plan }, { data: logs }, { data: prefs }, { data: results }, { data: entries }, { data: profile }, consent] =
    await Promise.all([
      supabaseAdmin.from("hc_action_plans_decrypted").select("id, modules, headline, published_at, review_date").eq("journey_id", journey.id).eq("status", "published").maybeSingle(),
      supabaseAdmin.from("hc_action_logs").select("action_uid, done_on").eq("journey_id", journey.id).gte("done_on", since),
      supabaseAdmin.from("hc_action_prefs").select("action_uid, hidden, note, sort_index, at_time").eq("journey_id", journey.id),
      supabaseAdmin.from("hc_results_decrypted").select("marker, value, unit, measured_at, note").eq("journey_id", journey.id),
      supabaseAdmin.from("hc_knowledge").select("slug, category, title, aliases, unit, summary, body_md, bands, higher_better, sources, tags, sort").eq("active", true),
      supabaseAdmin.from("clients_decrypted").select("sex").eq("id", journey.client_id).maybeSingle(),
      consentState(journey.id),
    ]);

  const rows = (results || []).map((r) => ({ marker: r.marker, value: Number(r.value), unit: r.unit }));
  const flagged = journey.report_generated_at ? trafficLights(rows, (entries || []) as KnowledgeEntry[], sexOf(profile?.sex)) : [];
  /* Read for the consultation, under 9(2)(h) — not gated on the client's
     confirmation, which is about their own copy. consent.visible_to_client
     tells the screen what the client can see, so the coach is never
     surprised by a report the client has not got. */
  const report = journey.report_generated_at || journey.own_report_at
    ? await loadReport(journey.id, journey.client_id, true)
    : null;

  return NextResponse.json({
    journey_id: journey.id,
    plan: plan ?? null,
    logs: logs || [],
    prefs: prefs || [],
    flagged,
    report,
    consent,
    today: isoDay(),
  });
}

/** Logs and prefs as they now stand — what every mutation answers with. */
async function currentState(journeyId: string) {
  const [{ data: logs }, { data: prefs }] = await Promise.all([
    supabaseAdmin.from("hc_action_logs").select("action_uid, done_on").eq("journey_id", journeyId).gte("done_on", lastDays(28)[0]),
    supabaseAdmin.from("hc_action_prefs").select("action_uid, hidden, note, sort_index, at_time").eq("journey_id", journeyId),
  ]);
  return { logs: logs || [], prefs: prefs || [], today: isoDay() };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const got = await visibleJourney(req, id);
  if ("error" in got) return got.error;
  const { actor, journey } = got;
  const body = await req.json().catch(() => ({}));

  /*
   * client_id is the CLIENT's, never the actor's.
   *
   * These rows are the client's own plan state. Stamping a coach's id here
   * would attribute their habits to a member of staff and, worse, make the
   * rows invisible to the client's own queries, which filter by client_id.
   */
  const clientId = journey.client_id;
  const who = actor.kind === "staff" ? `staff:${actor.staffId}` : `worker:${actor.worker.id}`;

  /*
   * The arrangement: training days, swaps, meal picks, favourites.
   *
   * saveTraining takes the client id and an "updated_by", so the coach is
   * recorded as the author of the change without the row stopping being the
   * client's. No calendar sync here, unlike the client's own route: that
   * pushes to the CLIENT's Google calendar, and a coach tidying somebody's
   * week should not rewrite their calendar as a side effect.
   */
  if (req.nextUrl.searchParams.get("part") === "training") {
    try {
      const out = await saveTraining(journey.id, clientId, body, who);
      await hcAudit(who, "coach_training_settings", journey.id, {
        keys: Object.keys(body ?? {}).slice(0, 12),
      });
      return NextResponse.json(out);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  if (Array.isArray(body.order)) {
    const uids = (body.order as unknown[]).map(String).filter(Boolean).slice(0, 200);
    if (uids.length) {
      const now = new Date().toISOString();
      const rows = uids.map((uid, i) => ({
        journey_id: journey.id, client_id: clientId, action_uid: uid,
        sort_index: i, updated_at: now,
      }));
      const { error } = await supabaseAdmin
        .from("hc_action_prefs").upsert(rows, { onConflict: "journey_id,action_uid" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      /* Audited because it is somebody acting on another person's plan.
         The client's own reorder is not audited — it is their plan — but
         this one has an actor who is not them. */
      await hcAudit(who, "coach_reorder_plan", journey.id, { count: uids.length });
    }
    return NextResponse.json(await currentState(journey.id));
  }

  const actionUid = typeof body.action_uid === "string" ? body.action_uid.slice(0, 64) : "";
  if (!actionUid) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (typeof body.done === "boolean") {
    const day = typeof body.done_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.done_on) ? body.done_on : isoDay();
    if (!lastDays(7).includes(day)) return NextResponse.json({ error: "Dagsetning utan marka." }, { status: 400 });
    if (body.done) {
      await supabaseAdmin.from("hc_action_logs")
        .upsert({ journey_id: journey.id, client_id: clientId, action_uid: actionUid, done_on: day }, { onConflict: "journey_id,action_uid,done_on" });
    } else {
      await supabaseAdmin.from("hc_action_logs").delete()
        .eq("journey_id", journey.id).eq("action_uid", actionUid).eq("done_on", day);
    }
    await hcAudit(who, "coach_tick_action", journey.id, { action_uid: actionUid, done_on: day, done: body.done });
  }

  if (typeof body.hidden === "boolean" || typeof body.note === "string" || "at_time" in body) {
    const patch: Record<string, unknown> = {
      journey_id: journey.id, client_id: clientId, action_uid: actionUid,
      updated_at: new Date().toISOString(),
    };
    if (typeof body.hidden === "boolean") patch.hidden = body.hidden;
    if (typeof body.note === "string") patch.note = body.note.trim().slice(0, 300) || null;
    if ("at_time" in body) {
      const t = body.at_time;
      patch.at_time = typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null;
    }
    const { error } = await supabaseAdmin.from("hc_action_prefs").upsert(patch, { onConflict: "journey_id,action_uid" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await hcAudit(who, "coach_adjust_action", journey.id, { action_uid: actionUid });
  }

  return NextResponse.json(await currentState(journey.id));
}
