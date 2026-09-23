// Referrals on a journey.
//
// GET  → the referrals on this journey
// POST { items: [{ target, reason, note?, suggested_by? }] }
//        → propose one or more, and text the responsible doctor once
// PATCH { id, status }  → the doctor decides (doctors only)
//
// The nurse proposes, the doctor decides: a nurse cannot set a status, and
// the doctor is told by SMS because a referral sitting unseen in a web page
// is the failure mode this is meant to prevent.
//
// Actor: workstation session or Lifeline staff, limited to their locations.
// Schema: supabase/migration-hc-referrals.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { hcAudit, siteOrigin } from "@/lib/hc/server";
import { sendSms, smsConfigured } from "@/lib/sms";
import { REFERRAL_STATUSES, REFERRAL_TARGETS, referralSms, type ReferralTarget } from "@/lib/hc/referrals";

export const runtime = "nodejs";

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** The journey, if this actor is allowed to see it. */
async function reach(req: NextRequest, id: string) {
  const actor = await getHcActor(req);
  if (!actor) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const { data: journey } = await supabaseAdmin
    .from("hc_journeys")
    .select("id, client_id, location_id")
    .eq("id", id)
    .maybeSingle();
  const locs = actorLocationFilter(actor);
  if (!journey || (locs && (!journey.location_id || !locs.includes(journey.location_id)))) {
    return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  }
  return { actor, journey };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await reach(req, id);
  if ("error" in r) return r.error;
  const { data } = await supabaseAdmin
    .from("hc_referrals")
    .select("*")
    .eq("journey_id", id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ referrals: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await reach(req, id);
  if ("error" in r) return r.error;
  const { actor, journey } = r;

  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body.items) ? body.items : [];
  const rows = raw
    .map((x: Record<string, unknown>) => ({
      target: str(x.target, 40) as ReferralTarget | null,
      reason: str(x.reason, 300),
      note: str(x.note, 1000),
      suggested_by: str(x.suggested_by, 20) === "ai" ? "ai" : "nurse",
    }))
    .filter((x: { target: ReferralTarget | null; reason: string | null }) =>
      x.target && x.reason && (REFERRAL_TARGETS as readonly string[]).includes(x.target))
    .map((x: { target: ReferralTarget; reason: string; note: string | null; suggested_by: string }) => ({
      journey_id: id,
      client_id: journey.client_id,
      target: x.target,
      reason: x.reason,
      note: x.note,
      suggested_by: x.suggested_by,
      requested_by: actor.label,
    }));
  if (!rows.length) return NextResponse.json({ error: "Engin gild tilvísun." }, { status: 400 });

  const { data: made, error } = await supabaseAdmin.from("hc_referrals").insert(rows).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Tell the doctor. One message however many referrals were added, because
  // five texts about one client is how an alert gets muted.
  let notified = 0;
  let smsNote: string | null = null;
  try {
    const [{ data: doctors }, { data: client }] = await Promise.all([
      supabaseAdmin.from("hc_workers").select("name, phone").eq("role", "doctor").eq("active", true),
      supabaseAdmin.from("clients_decrypted").select("full_name").eq("id", journey.client_id).maybeSingle(),
    ]);
    const url = `${siteOrigin(req)}/vinnustod`;
    const first = made?.[0];
    const text = referralSms({
      clientName: (client?.full_name ?? "Skjólstæðingur").split(" ").slice(0, 2).join(" "),
      target: first.target as ReferralTarget,
      reason: first.reason,
      count: made?.length ?? 1,
      url,
    });
    for (const doc of doctors ?? []) {
      if (!doc.phone) continue;
      const res = await sendSms({ to: doc.phone, body: text });
      if (res.ok) notified++;
    }
    if (notified) {
      await supabaseAdmin
        .from("hc_referrals")
        .update({ doctor_notified_at: new Date().toISOString() })
        .in("id", (made ?? []).map((m) => m.id));
    }
    if (!smsConfigured()) smsNote = "Twilio er ekki uppsett, svo skeytið var skráð í annál en ekki sent.";
    else if (!notified) smsNote = "Enginn læknir með símanúmer er skráður, svo ekkert skeyti fór út.";
  } catch {
    smsNote = "Tilvísunin er skráð en ekki náðist að senda skeyti.";
  }

  await hcAudit(actor.label, "referral_requested", id, {
    count: made?.length ?? 0,
    targets: (made ?? []).map((m) => m.target),
    notified,
  });
  return NextResponse.json({ referrals: made ?? [], notified, note: smsNote });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await reach(req, id);
  if ("error" in r) return r.error;
  const { actor } = r;
  // A referral is a clinical decision; only a doctor closes one.
  if (!actor.isDoctor) {
    return NextResponse.json({ error: "Aðeins læknir getur afgreitt tilvísun." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const refId = str(body.id, 64);
  const status = str(body.status, 20);
  if (!refId || !status || !(REFERRAL_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hc_referrals")
    .update({ status, decided_by: actor.label, decided_at: new Date().toISOString() })
    .eq("id", refId)
    .eq("journey_id", id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await hcAudit(actor.label, "referral_decided", id, { referral: refId, status });
  return NextResponse.json({ referral: data });
}
