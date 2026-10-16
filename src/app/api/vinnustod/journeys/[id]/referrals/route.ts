// Vera partner contacts on a journey (stored in hc_referrals).
//
// GET  → the rows on this journey, reason/note decrypted (old doctor-path
//        rows included, read-only)
// POST { items: [{ target, reason, note?, suggested_by?, partner_id }], consent: true }
//        → contact one or more Vera partners on the client's behalf
// PATCH { id, action: "resend" | "contacted" }
//
// Medalia split (Mads, 2026-10-16): Lifeline's doctor path is gone — no
// lifeline_doctor assessments, no heilsugæsla / specialist referrals, no
// doctor SMS, no doctor status decisions. Those targets are refused here
// (REFERRAL_TARGETS is the partner list only); old rows stay readable.
//
// reason / note are encrypted at rest (migration-hc-medalia-split.sql: a
// trigger encrypts on write, hc_referrals_decrypted decrypts for reads).
//
// Actor: workstation session or Lifeline staff, limited to their locations.
// Schema: supabase/migration-hc-referrals.sql, migration-hc-partners.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { decryptKennitala, getClientProfile, hcAudit } from "@/lib/hc/server";
import { renderBrandedEmail, sendEmail } from "@/lib/email";
import { loadReferrals } from "@/lib/hc/notes";
import {
  REFERRAL_TARGETS, clientShareEmail, isPartner, partnerEmail,
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
  return NextResponse.json({ referrals: await loadReferrals({ journeyId: id }) });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await reach(req, id);
  if ("error" in r) return r.error;
  const { actor, journey } = r;

  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body.items) ? body.items : [];
  const asked = raw.map((x: Record<string, unknown>) => str(x?.target, 40));
  if (asked.some((t: string | null) => t && !isPartner(t))) {
    return NextResponse.json({ error: "Tilvísanir og mat læknis eru ekki lengur gerð í Lifeline — það er í höndum læknis í Medalia. Hér er aðeins hægt að hafa samband við samstarfsaðila hjá Vera." }, { status: 400 });
  }
  const now = new Date().toISOString();
  const rows = raw
    .map((x: Record<string, unknown>) => ({
      target: str(x.target, 40) as ReferralTarget | null,
      reason: str(x.reason, 300),
      note: str(x.note, 1000),
      suggested_by: str(x.suggested_by, 20) === "ai" ? "ai" : "nurse",
      partner_id: str(x.partner_id, 64),
    }))
    .filter((x: { target: ReferralTarget | null; reason: string | null }) =>
      x.target && x.reason && REFERRAL_TARGETS.includes(x.target))
    .map((x: { target: ReferralTarget; reason: string; note: string | null; suggested_by: string; partner_id: string | null }) => ({
      journey_id: id,
      client_id: journey.client_id,
      target: x.target,
      reason: x.reason,
      note: x.note,
      suggested_by: x.suggested_by,
      requested_by: actor.label,
      partner_id: x.partner_id,
      // 'failed' until the email has actually gone (sendToPartner flips it).
      status: "failed",
      consent_at: now,
      consent_by: actor.label,
    }));
  if (!rows.length) return NextResponse.json({ error: "Engin gild færsla." }, { status: 400 });
  /* Each partner row is a kennitala decrypt and two emails: bounded. */
  if (rows.length > 3) return NextResponse.json({ error: "Í mesta lagi þrír samstarfsaðilar í einu." }, { status: 400 });
  if (body.consent !== true) {
    return NextResponse.json({ error: "Staðfestu að skjólstæðingurinn hafi samþykkt að upplýsingarnar séu sendar." }, { status: 400 });
  }
  if (rows.some((x: { partner_id?: string | null }) => !x.partner_id)) {
    return NextResponse.json({ error: "Veldu meðferðaraðila hjá Vera fyrir hverja færslu." }, { status: 400 });
  }

  // The insert's plaintext reason/note are encrypted by the DB trigger.
  const { data: made, error } = await supabaseAdmin.from("hc_referrals").insert(rows).select("id, client_id, target, partner_id");
  if (error) return NextResponse.json({ error: "Tókst ekki að vista." }, { status: 400 });

  /* Rows start as 'failed' and become 'sent' only when the email did, so a
     crash in between can never look sent. */
  let partnersSent = 0;
  for (const m of made ?? []) {
    if (await sendToPartner(req, actor.label, m, m.partner_id)) partnersSent++;
  }
  await hcAudit(actor.label, "partner_contact_sent", id, { count: made?.length ?? 0, sent: partnersSent, targets: (made ?? []).map((m) => m.target) });
  const fresh = await loadReferrals({ ids: (made ?? []).map((m) => m.id) });
  return NextResponse.json({
    referrals: fresh, partners_sent: partnersSent,
    note: partnersSent === (made?.length ?? 0) ? "Sent. Skjólstæðingurinn fékk afrit." : "Vistað, en tölvupóstur fór ekki. Reyndu „Senda aftur“.",
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await reach(req, id);
  if ("error" in r) return r.error;
  const { actor } = r;
  const body = await req.json().catch(() => ({}));

  /* Partner contacts: any staff member may resend or record contact made.
     The doctor's decision path (PATCH { id, status }) was removed in the
     Medalia split. */
  if (body.action !== "resend" && body.action !== "contacted") {
    return NextResponse.json({ error: "Læknisþátturinn er í Medalia. Hér er aðeins hægt að senda aftur eða skrá að samband sé komið á." }, { status: 410 });
  }
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
      .eq("action", "partner_contact_resent").eq("journey_id", id).gte("at", dayAgo).contains("detail", { referral: ref.id });
    if ((resends ?? 0) >= 3) return NextResponse.json({ error: "Of oft sent í dag. Hafðu samband við meðferðaraðilann beint." }, { status: 429 });
    const ok = await sendToPartner(req, actor.label, ref, ref.partner_id);
    await hcAudit(actor.label, "partner_contact_resent", id, { referral: ref.id, ok });
    if (!ok) return NextResponse.json({ error: "Tölvupósturinn fór ekki. Athugaðu netfang meðferðaraðilans." }, { status: 502 });
  }
  const [fresh] = await loadReferrals({ ids: [ref.id] });
  return NextResponse.json({ referral: fresh ?? null });
}
