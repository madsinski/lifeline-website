// Referrals on a journey.
//
// GET  → the referrals on this journey
// POST { items: [{ target, reason, note?, suggested_by? }] }
//        → propose one or more, and text the responsible doctor once
// PATCH { id, status }  → the doctor decides (doctors only)
//
// One model for everything that needs a doctor: "lifeline_doctor" is the
// in-house assessment (it replaced the journey's request-doctor flag, which
// is kept in step here so the to-do list and old data still read right), and
// an approved Heilsugæsla referral sets the journey's referral flag. A doctor
// may record a referral as already approved ({ decided: true }).
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
import { decryptKennitala, getClientProfile, hcAudit, patchJourney, siteOrigin } from "@/lib/hc/server";
import { sendSms, smsConfigured } from "@/lib/sms";
import { renderBrandedEmail, sendEmail } from "@/lib/email";
import {
  REFERRAL_STATUSES, REFERRAL_TARGETS, clientShareEmail, isPartner, partnerEmail, referralSms,
  type PartnerProfession, type ReferralTarget,
} from "@/lib/hc/referrals";

/*
 * ── Vera partners (Mads, 2026-10-15) ─────────────────────────────────
 *
 * physio / psychologist / nutritionist are not referrals: the nurse emails a
 * registered partner at Vera heilsusetur on the client's behalf, with the
 * client's consent (body.consent, confirmed by the nurse and recorded), and
 * the email carries ONLY name, kennitala and contact details. No doctor step.
 * The row is saved as 'sent' (or 'failed' if the email did not go, with a
 * resend), any staff member can mark contact made ('done'), and the client
 * gets a copy saying what was shared with whom. The reason stays in Lifeline.
 */
async function sendToPartner(req: NextRequest, actorLabel: string, ref: { id: string; client_id: string; target: string }, partnerId: string) {
  const [{ data: partner }, profile] = await Promise.all([
    supabaseAdmin.from("hc_partners").select("id, name, profession, organization, email, active").eq("id", partnerId).maybeSingle(),
    getClientProfile(ref.client_id),
  ]);
  if (!partner?.active || partner.profession !== ref.target || !profile) return false;
  const kennitala = await decryptKennitala(profile.kennitala_encrypted ?? null, {
    actorRole: "workstation", purpose: "partner_contact", subjectId: ref.client_id, req,
  });
  const name = profile.full_name ?? "Skjólstæðingur";
  const mail = partnerEmail({
    partnerName: partner.name, profession: partner.profession as PartnerProfession, clientName: name,
    kennitala, phone: profile.phone ?? null, email: profile.email ?? null, nurse: actorLabel,
  });
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const sent = await sendEmail({
    to: partner.email,
    replyTo: profile.email ?? undefined,
    subject: mail.subject,
    html: renderBrandedEmail({
      title: "Beiðni um samband",
      bodyHtml: `<p style="margin:0 0 12px;">Góðan dag ${esc(partner.name)}.</p><p style="margin:0 0 12px;">${esc(mail.intro)}</p>`
        + `<p style="margin:0 0 12px;">${mail.lines.map(esc).join("<br>")}</p><p style="margin:0;">Kveðja,<br>${esc(actorLabel)}<br>Lifeline Health</p>`,
    }),
    text: mail.text,
  });
  const now = new Date().toISOString();
  await supabaseAdmin.from("hc_referrals").update(sent.ok
    ? { status: "sent", sent_at: now, sent_by: actorLabel }
    : { status: "failed" }).eq("id", ref.id);
  if (sent.ok && profile.email) {
    const copy = clientShareEmail({ clientName: name, partnerName: partner.name, profession: partner.profession as PartnerProfession, organization: partner.organization });
    await sendEmail({
      to: profile.email, subject: copy.subject, text: copy.text,
      html: renderBrandedEmail({ title: copy.subject, bodyHtml: `<p style="margin:0;">${esc(copy.body)}</p>` }),
    });
  }
  return sent.ok;
}

export const runtime = "nodejs";

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** The journey, if this actor is allowed to see it. */
async function reach(req: NextRequest, id: string) {
  const actor = await getHcActor(req);
  if (!actor) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const { data: journey } = await supabaseAdmin
    .from("hc_journeys")
    .select("id, client_id, location_id, referral_to_heilsugaesla")
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
      partner_id: str(x.partner_id, 64),
    }))
    .filter((x: { target: ReferralTarget | null; reason: string | null }) =>
      x.target && x.reason && (REFERRAL_TARGETS as readonly string[]).includes(x.target))
    .map((x: { target: ReferralTarget; reason: string; note: string | null; suggested_by: string; partner_id: string | null }) => ({
      journey_id: id,
      client_id: journey.client_id,
      target: x.target,
      reason: x.reason,
      note: x.note,
      suggested_by: x.suggested_by,
      requested_by: actor.label,
      ...(isPartner(x.target)
        ? { partner_id: x.partner_id, status: "failed", consent_at: new Date().toISOString(), consent_by: actor.label }
        // A doctor recording it has decided already.
        : actor.isDoctor && body.decided === true ? { status: "approved", decided_by: actor.label, decided_at: new Date().toISOString() } : {}),
    }));
  if (!rows.length) return NextResponse.json({ error: "Engin gild færsla." }, { status: 400 });
  const partnerRows = rows.filter((x: { target: string }) => isPartner(x.target));
  if (partnerRows.length) {
    /* Each partner row is a kennitala decrypt and two emails: bounded. */
    if (partnerRows.length > 3) return NextResponse.json({ error: "Í mesta lagi þrír samstarfsaðilar í einu." }, { status: 400 });
    if (body.consent !== true) {
      return NextResponse.json({ error: "Staðfestu að skjólstæðingurinn hafi samþykkt að upplýsingarnar séu sendar." }, { status: 400 });
    }
    if (partnerRows.some((x: { partner_id?: string | null }) => !x.partner_id)) {
      return NextResponse.json({ error: "Veldu meðferðaraðila hjá Vera fyrir hverja færslu." }, { status: 400 });
    }
  }

  const { data: made, error } = await supabaseAdmin.from("hc_referrals").insert(rows).select("*");
  if (error) return NextResponse.json({ error: "Tókst ekki að vista." }, { status: 400 });
  await mirrorOnJourney(id, actor.label, (made ?? []).filter((m) => !isPartner(m.target)));

  /* Partner contacts go out now; rows start as 'failed' and become 'sent'
     only when the email did, so a crash in between can never look sent. */
  let partnersSent = 0;
  for (const m of (made ?? []).filter((x) => isPartner(x.target))) {
    if (await sendToPartner(req, actor.label, m, m.partner_id)) partnersSent++;
  }
  const doctorRows = (made ?? []).filter((x) => !isPartner(x.target));
  if (!doctorRows.length) {
    await hcAudit(actor.label, "partner_contact_sent", id, { count: made?.length ?? 0, sent: partnersSent, targets: (made ?? []).map((m) => m.target) });
    const { data: fresh } = await supabaseAdmin.from("hc_referrals").select("*").in("id", (made ?? []).map((m) => m.id));
    return NextResponse.json({
      referrals: fresh ?? made ?? [], partners_sent: partnersSent,
      note: partnersSent === (made?.length ?? 0) ? "Sent. Skjólstæðingurinn fékk afrit." : "Vistað, en tölvupóstur fór ekki. Reyndu „Senda aftur“.",
    });
  }

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
    const first = doctorRows[0];
    const text = referralSms({
      clientName: (client?.full_name ?? "Skjólstæðingur").split(" ").slice(0, 2).join(" "),
      target: first.target as ReferralTarget,
      reason: first.reason,
      count: doctorRows.length,
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
        .in("id", doctorRows.map((m) => m.id));
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
  const { data: fresh } = await supabaseAdmin.from("hc_referrals").select("*").in("id", (made ?? []).map((m) => m.id));
  return NextResponse.json({ referrals: fresh ?? made ?? [], notified, partners_sent: partnersSent, note: smsNote });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await reach(req, id);
  if ("error" in r) return r.error;
  const { actor } = r;
  const body = await req.json().catch(() => ({}));

  /* Partner contacts: any staff member may resend or record contact made. */
  if (body.action === "resend" || body.action === "contacted") {
    const refId = str(body.id, 64);
    const { data: ref } = refId
      ? await supabaseAdmin.from("hc_referrals").select("id, client_id, target, partner_id, status, consent_at, sent_at").eq("id", refId).eq("journey_id", id).maybeSingle()
      : { data: null };
    if (!ref || !isPartner(ref.target)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (body.action === "contacted") {
      await supabaseAdmin.from("hc_referrals").update({ status: "done", contacted_at: new Date().toISOString(), decided_by: actor.label, decided_at: new Date().toISOString() }).eq("id", ref.id);
      await hcAudit(actor.label, "partner_contact_done", id, { referral: ref.id });
    } else {
      if (!ref.partner_id) return NextResponse.json({ error: "Enginn meðferðaraðili skráður." }, { status: 400 });
      /* Never without a recorded consent, and not as a way to spam a partner:
         at most once per two minutes and three times a day per contact. */
      if (!ref.consent_at) return NextResponse.json({ error: "Ekkert samþykki skráð fyrir þessari sendingu." }, { status: 400 });
      if (ref.sent_at && Date.now() - Date.parse(ref.sent_at) < 120_000) {
        return NextResponse.json({ error: "Nýbúið að senda. Bíddu í tvær mínútur." }, { status: 429 });
      }
      const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
      const { count: resends } = await supabaseAdmin.from("hc_audit").select("id", { count: "exact", head: true })
        .eq("action", "partner_contact_resent").eq("journey_id", id).gte("created_at", dayAgo).contains("detail", { referral: ref.id });
      if ((resends ?? 0) >= 3) return NextResponse.json({ error: "Of oft sent í dag. Hafðu samband við meðferðaraðilann beint." }, { status: 429 });
      const ok = await sendToPartner(req, actor.label, ref, ref.partner_id);
      await hcAudit(actor.label, "partner_contact_resent", id, { referral: ref.id, ok });
      if (!ok) return NextResponse.json({ error: "Tölvupósturinn fór ekki. Athugaðu netfang meðferðaraðilans." }, { status: 502 });
    }
    const { data: fresh } = await supabaseAdmin.from("hc_referrals").select("*").eq("id", ref.id).maybeSingle();
    return NextResponse.json({ referral: fresh });
  }

  // A referral is a clinical decision; only a doctor closes one.
  if (!actor.isDoctor) {
    return NextResponse.json({ error: "Aðeins læknir getur afgreitt tilvísun." }, { status: 403 });
  }

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
  if (data) await mirrorOnJourney(id, actor.label, [data]);
  await hcAudit(actor.label, "referral_decided", id, { referral: refId, status });
  return NextResponse.json({ referral: data });
}

/**
 * Keep the journey's older flags in step with the referrals, so the to-do
 * list, the queue and the participant's journey read the same thing.
 */
async function mirrorOnJourney(journeyId: string, actor: string, refs: { target: string; reason: string; note: string | null; status: string; decided_at: string | null; created_at: string }[]) {
  const patch: Record<string, unknown> = {};
  for (const r of refs) {
    if (r.target === "lifeline_doctor") {
      if (r.status === "requested") {
        patch.doctor_review_requested_at = r.created_at;
        patch.doctor_review_note = [r.reason, r.note].filter(Boolean).join(" — ");
        patch.doctor_reviewed_at = null;
      } else {
        patch.doctor_reviewed_at = r.decided_at ?? new Date().toISOString();
      }
    }
    if (r.target === "heilsugaesla" && (r.status === "approved" || r.status === "done")) {
      patch.referral_to_heilsugaesla = true;
      patch.referral_note = [r.reason, r.note].filter(Boolean).join(" — ");
      patch.referred_at = r.decided_at ?? new Date().toISOString();
    }
  }
  if (Object.keys(patch).length) await patchJourney(journeyId, patch, actor, "referral_mirror");
}
