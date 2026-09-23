// The client's own action plan, from /account.
//
// GET  ?journey=<id>  → plan actions, the last 28 days of ticks, preferences,
//                       and the measured values with their traffic lights.
// POST { journey_id, action_uid, done_on, done }     → tick / untick a day
// POST { journey_id, action_uid, hidden?, note? }    → the client's own adjustments
//
// Auth: the signed-in client, own journeys only.
// Schema: supabase/migration-hc-action-logs.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";
import { isoDay, lastDays } from "@/lib/hc/adherence";
import { trafficLights } from "@/lib/hc/analyze";
import { sexOf } from "@/lib/hc/sex";
import type { KnowledgeEntry } from "@/lib/hc/knowledge";

export const runtime = "nodejs";

/** The journey, only if it belongs to this user. */
async function ownJourney(userId: string, journeyId: string | null) {
  const q = supabaseAdmin.from("hc_journeys").select("id, client_id").eq("client_id", userId);
  const { data } = journeyId
    ? await q.eq("id", journeyId).maybeSingle()
    : await q.is("cancelled_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await ownJourney(user.id, req.nextUrl.searchParams.get("journey"));
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const since = lastDays(28)[0];
  const [{ data: plan }, { data: logs }, { data: prefs }, { data: results }, { data: entries }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("hc_action_plans").select("id, modules, headline, published_at, review_date").eq("journey_id", journey.id).eq("status", "published").maybeSingle(),
    supabaseAdmin.from("hc_action_logs").select("action_uid, done_on").eq("journey_id", journey.id).gte("done_on", since),
    supabaseAdmin.from("hc_action_prefs").select("action_uid, hidden, note").eq("journey_id", journey.id),
    supabaseAdmin.from("hc_results").select("marker, value, unit, measured_at, note").eq("journey_id", journey.id),
    supabaseAdmin.from("hc_knowledge").select("slug, category, title, aliases, unit, summary, body_md, bands, higher_better, sources, tags, sort").eq("active", true),
    supabaseAdmin.from("clients_decrypted").select("sex").eq("id", user.id).maybeSingle(),
  ]);

  const rows = (results || []).map((r) => ({ marker: r.marker, value: Number(r.value), unit: r.unit }));
  const flagged = trafficLights(rows, (entries || []) as KnowledgeEntry[], sexOf(profile?.sex));

  return NextResponse.json({
    journey_id: journey.id,
    plan: plan ?? null,
    logs: logs || [],
    prefs: prefs || [],
    flagged,
    today: isoDay(),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const body = await req.json().catch(() => ({}));
  const journey = await ownJourney(user.id, typeof body.journey_id === "string" ? body.journey_id : null);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const actionUid = typeof body.action_uid === "string" ? body.action_uid.slice(0, 64) : "";
  if (!actionUid) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // A tick for one day.
  if (typeof body.done === "boolean") {
    const day = typeof body.done_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.done_on) ? body.done_on : isoDay();
    // Only today and the six days behind it — no filling in the future.
    if (!lastDays(7).includes(day)) return NextResponse.json({ error: "Dagsetning utan marka." }, { status: 400 });
    if (body.done) {
      await supabaseAdmin.from("hc_action_logs")
        .upsert({ journey_id: journey.id, client_id: user.id, action_uid: actionUid, done_on: day }, { onConflict: "journey_id,action_uid,done_on" });
    } else {
      await supabaseAdmin.from("hc_action_logs").delete()
        .eq("journey_id", journey.id).eq("action_uid", actionUid).eq("done_on", day);
    }
  }

  // The client's own adjustment to the plan.
  if (typeof body.hidden === "boolean" || typeof body.note === "string") {
    const patch: Record<string, unknown> = { journey_id: journey.id, client_id: user.id, action_uid: actionUid, updated_at: new Date().toISOString() };
    if (typeof body.hidden === "boolean") patch.hidden = body.hidden;
    if (typeof body.note === "string") patch.note = body.note.trim().slice(0, 300) || null;
    await supabaseAdmin.from("hc_action_prefs").upsert(patch, { onConflict: "journey_id,action_uid" });
  }

  const [{ data: logs }, { data: prefs }] = await Promise.all([
    supabaseAdmin.from("hc_action_logs").select("action_uid, done_on").eq("journey_id", journey.id).gte("done_on", lastDays(28)[0]),
    supabaseAdmin.from("hc_action_prefs").select("action_uid, hidden, note").eq("journey_id", journey.id),
  ]);
  return NextResponse.json({ logs: logs || [], prefs: prefs || [] });
}
