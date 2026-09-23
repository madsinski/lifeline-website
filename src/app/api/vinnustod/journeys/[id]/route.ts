// One journey in the workstation.
// GET  → patient card (name, kennitala, contact), timeline, orders, audit
// POST { event, at?, mode?, note? } → record a milestone. Doctor-only events
//      (report_generated, referral_heilsugaesla) need a doctor/admin actor.
// Actor: workstation session or Lifeline staff (Bearer + AAL2).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { applyJourneyEvent, DOCTOR_ONLY, isJourneyEvent } from "@/lib/hc/events";
import { decryptKennitala, getClientProfile, hcAudit, patchJourney, siteOrigin } from "@/lib/hc/server";
import { loadReport } from "@/lib/hc/report-store";

import { supabaseAdmin as db } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
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
  const [{ data: orders }, { data: audit }, { data: plan }, { data: loc }, { data: workers }, { data: messages }, { data: referrals }, { data: proposal }] = await Promise.all([
    supabaseAdmin.from("hc_orders").select("id, package_key, kind, payment_route, price_isk, amount_charged_isk, paid_at, activation_code, activation_redeemed_at").eq("journey_id", journey.id).order("created_at"),
    supabaseAdmin.from("hc_audit").select("actor, action, at, detail").eq("journey_id", journey.id).order("at", { ascending: false }).limit(60),
    supabaseAdmin.from("hc_action_plans").select("id, status, published_at, updated_at, headline, modules").eq("journey_id", journey.id).maybeSingle(),
    journey.location_id ? supabaseAdmin.from("hc_locations").select("id, name").eq("id", journey.location_id).maybeSingle() : Promise.resolve({ data: null }),
    supabaseAdmin.from("hc_workers").select("id, name, organization, role").eq("active", true),
    supabaseAdmin.from("hc_messages").select("id, channel, recipient, template, subject, body, status, error, sent_by, sent_at").eq("journey_id", journey.id).order("sent_at", { ascending: false }).limit(50),
    supabaseAdmin.from("hc_referrals").select("*").eq("journey_id", journey.id).order("created_at", { ascending: false }),
    supabaseAdmin.from("hc_ai_proposals").select("output, input, created_at").eq("journey_id", journey.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const since = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10);
  const [{ data: logs }, { data: prefs }] = await Promise.all([
    supabaseAdmin.from("hc_action_logs").select("action_uid, done_on").eq("journey_id", journey.id).gte("done_on", since),
    supabaseAdmin.from("hc_action_prefs").select("action_uid, hidden, note").eq("journey_id", journey.id),
  ]);
  const storedReport = await loadReport(journey.id, journey.client_id);
  const { data: results } = await supabaseAdmin
    .from("hc_results")
    .select("marker, value, unit, measured_at, source, note, entered_by, updated_at")
    .eq("journey_id", journey.id);

  return NextResponse.json({
    journey,
    patient: {
      full_name: profile?.full_name ?? null,
      kennitala,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      address: profile?.address ?? null,
      date_of_birth: profile?.date_of_birth ?? null,
      sex: profile?.sex ?? null,
    },
    results: results || [],
    report: storedReport,
    logs: logs || [],
    prefs: prefs || [],
    orders: orders || [],
    referrals: referrals || [],
    // The last plan proposal. It is usually already here: importing a report
    // starts one in the background, so the nurse does not wait for the model
    // after she has finished reading the results.
    ai_referrals: ((proposal?.output as { referrals?: unknown[] } | null)?.referrals ?? []),
    ai_proposal: proposal
      ? { proposal: proposal.output, flagged: (proposal.input as { flagged?: unknown[] } | null)?.flagged ?? [], at: proposal.created_at }
      : null,
    audit: (audit || []).map((a) => ({ actor: a.actor, action: a.action, at: a.at, note: (a.detail as { note?: string } | null)?.note ?? null })),
    plan,
    location: loc,
    workers: workers || [],
    messages: messages || [],
    actor: { label: actor.label, isDoctor: actor.isDoctor, name: actor.kind === "worker" ? actor.worker.name : null },
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (actor.kind === "worker" && !sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const journey = await loadAllowed(actor, (await ctx.params).id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.action === "string") return handleAction(req, actor, journey, body);
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
    meetingUrl: typeof body.meeting_url === "string"
      ? (/^https:\/\//.test(body.meeting_url.trim()) ? body.meeting_url.trim().slice(0, 500) : null)
      : undefined,
    origin: siteOrigin(req),
  });
  if (!updated) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ journey: updated });
}

// ── Save interview notes (autosave from the guided interview) ──────────────
const NOTE_KEYS = ["sleep", "exercise", "nutrition", "mental", "measurements", "goals", "other"] as const;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (actor.kind === "worker" && !sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const journey = await loadAllowed(actor, (await ctx.params).id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const src = (body.interview_notes && typeof body.interview_notes === "object" ? body.interview_notes : {}) as Record<string, unknown>;
  const notes: Record<string, string> = {};
  for (const k of NOTE_KEYS) if (typeof src[k] === "string") notes[k] = (src[k] as string).slice(0, 6000);
  // Plain update: notes are working text, not a milestone — no audit per keystroke.
  const { error } = await db.from("hc_journeys").update({ interview_notes: notes, updated_at: new Date().toISOString() }).eq("id", journey.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, saved_at: new Date().toISOString() });
}

// ── Workstation actions that are not journey milestones ─────────────────────
async function handleAction(req: NextRequest, actor: HcActor, journey: HcJourney, body: Record<string, unknown>) {
  const origin = siteOrigin(req);

  // Paid but not activated: resend the activation code to the client.
  if (body.action === "remind_client") {
    const [{ data: order }, { data: u }] = await Promise.all([
      db.from("hc_orders").select("activation_code").eq("journey_id", journey.id).in("kind", ["health_check", "reevaluation"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.auth.admin.getUserById(journey.client_id),
    ]);
    const email = u?.user?.email;
    if (!email || !order?.activation_code) return NextResponse.json({ error: "Enginn virkjunarkóði eða netfang fannst." }, { status: 409 });
    const r = await sendEmail({
      to: email,
      subject: "Áminning: virkjaðu heilsufarsskoðunina þína",
      html: renderBrandedEmail({
        title: "Næsta skref bíður þín",
        accentLabel: "Áminning",
        bodyHtml: `<p style="margin:0 0 12px;">Heilsufarsskoðunin þín er greidd. Næsta skref er að virkja hana í sjúklingagáttinni með kóðanum:</p>
          <div style="font-family:ui-monospace,monospace;font-size:24px;letter-spacing:.12em;text-align:center;background:#ECFDF5;border-radius:10px;padding:14px;margin:16px 0;color:#065F46;font-weight:700;">${order.activation_code}</div>
          <p style="margin:0;">Þar bókar þú líka blóðprufu og mælingar.</p>`,
        ctaLabel: "Opna heilsuferðina",
        ctaUrl: `${origin}/account/heilsuferd`,
      }),
      text: `Virkjunarkóðinn þinn er ${order.activation_code}. ${origin}/account/heilsuferd`,
    });
    if (!r.ok) return NextResponse.json({ error: r.error || "Sending mistókst." }, { status: 502 });
    await hcAudit(actor.label, "reminder_sent", journey.id);
    return NextResponse.json({ ok: true });
  }

  // Nurse asks a Lifeline doctor to look at something before or after the interview.
  if (body.action === "request_doctor") {
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
    if (!note) return NextResponse.json({ error: "Lýstu stuttlega hvað læknirinn á að meta." }, { status: 400 });
    const updated = await patchJourney(journey.id, { doctor_review_requested_at: new Date().toISOString(), doctor_review_note: note, doctor_reviewed_at: null }, actor.label, "doctor_review_requested", { note });
    const { data: doctors } = await db.from("hc_workers").select("email, phone, location_ids").in("role", ["doctor", "admin"]).eq("active", true);
    const mine = (doctors || []).filter((d) => !d.location_ids?.length || (journey.location_id && d.location_ids.includes(journey.location_id)));
    await Promise.all(mine.flatMap((d) => [
      d.email ? sendEmail({
        to: d.email,
        subject: "Beiðni um mat læknis – Lifeline",
        html: renderBrandedEmail({ title: "Hjúkrunarfræðingur óskar eftir mati læknis", bodyHtml: `<p style="margin:0;">Opnaðu vinnustöðina til að sjá beiðnina.</p>`, ctaLabel: "Opna vinnustöð", ctaUrl: `${origin}/vinnustod?p=${journey.id}` }),
        text: `Hjúkrunarfræðingur óskar eftir mati læknis. ${origin}/vinnustod?p=${journey.id}`,
      }) : null,
      d.phone ? sendSms({ to: d.phone, body: `Lifeline: Beidni um mat laeknis bidur i vinnustodinni. ${origin}/vinnustod` }) : null,
    ].filter(Boolean)));
    return NextResponse.json({ journey: updated });
  }

  // SMS and/or email to the client, text approved by the nurse in the composer.
  if (body.action === "message") {
    const channels = (Array.isArray(body.channels) ? body.channels : []).filter((c): c is "sms" | "email" => c === "sms" || c === "email");
    const text = typeof body.body === "string" ? body.body.trim().slice(0, 1600) : "";
    const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim().slice(0, 150) : "Skilaboð frá Lifeline";
    const template = typeof body.template === "string" ? body.template.slice(0, 40) : null;
    if (!channels.length) return NextResponse.json({ error: "Veldu SMS, tölvupóst eða hvort tveggja." }, { status: 400 });
    if (text.length < 5) return NextResponse.json({ error: "Skilaboðin eru tóm." }, { status: 400 });

    // Guard against accidental spam: at most 6 messages per client per day.
    const since = new Date(Date.now() - 86400_000).toISOString();
    const { count } = await db.from("hc_messages").select("id", { count: "exact", head: true }).eq("journey_id", journey.id).gte("sent_at", since);
    if ((count ?? 0) + channels.length > 6) return NextResponse.json({ error: "Of mörg skilaboð til þessa skjólstæðings í dag." }, { status: 429 });

    const profile = await getClientProfile(journey.client_id);
    const results: { channel: string; ok: boolean; to: string | null; error?: string; status: string }[] = [];
    for (const ch of channels) {
      if (ch === "sms") {
        if (!profile?.phone) { results.push({ channel: "sms", ok: false, to: null, error: "Ekkert símanúmer skráð.", status: "failed" }); continue; }
        const r = await sendSms({ to: profile.phone, body: text });
        const status = r.dryRun ? "dry-run" : r.ok ? "sent" : "failed";
        results.push({ channel: "sms", ok: r.ok, to: profile.phone, error: r.error, status });
        await db.from("hc_messages").insert({ journey_id: journey.id, client_id: journey.client_id, channel: "sms", recipient: profile.phone, template, body: text, status, error: r.error ?? null, provider_id: r.sid ?? null, sent_by: actor.label });
      } else {
        const email = profile?.email;
        if (!email) { results.push({ channel: "email", ok: false, to: null, error: "Ekkert netfang skráð.", status: "failed" }); continue; }
        const html = renderBrandedEmail({
          title: subject,
          bodyHtml: text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`).join(""),
          ctaLabel: "Opna heilsuferðina",
          ctaUrl: `${origin}/account/heilsuferd`,
        });
        const r = await sendEmail({ to: email, subject, html, text: `${text}\n\n${origin}/account/heilsuferd`, replyTo: actor.kind === "worker" ? actor.worker.email : undefined });
        const status = r.id === "dev-log" ? "dry-run" : r.ok ? "sent" : "failed";
        results.push({ channel: "email", ok: r.ok, to: email, error: r.error, status });
        await db.from("hc_messages").insert({ journey_id: journey.id, client_id: journey.client_id, channel: "email", recipient: email, template, subject, body: text, status, error: r.error ?? null, provider_id: r.id ?? null, sent_by: actor.label });
      }
    }
    await hcAudit(actor.label, "message_sent", journey.id, { channels, template, results: results.map((r) => ({ channel: r.channel, status: r.status })) });
    const ok = results.some((r) => r.ok);
    return NextResponse.json({ ok, results }, { status: ok ? 200 : 502 });
  }

  // Share the confirmed report with the client.
  //
  // Nothing is attached and nothing is copied: the report already renders on
  // their account, so this is a message pointing at it. It reuses the same
  // send path as any other message, which is what keeps the rate limit, the
  // hc_messages record and the audit trail honest.
  if (body.action === "share_report") {
    if (!journey.report_generated_at) {
      return NextResponse.json({ error: "Skýrslan er ekki staðfest enn." }, { status: 409 });
    }
    const profile = await getClientProfile(journey.client_id);
    const first = (profile?.full_name ?? "").split(" ")[0] || "þú";
    const text = `Hæ ${first}. Heilsufarsskýrslan þín er tilbúin og komin á aðganginn þinn hjá Lifeline. Þar sérðu niðurstöðurnar þínar, viðmiðin og hvað hefur áhrif á hvert gildi.`;
    const link = `${origin}/account/heilsuferd/aaetlun`;

    const results: { channel: string; ok: boolean; status: string }[] = [];
    if (profile?.phone) {
      const r = await sendSms({ to: profile.phone, body: `${text}\n\n${link}` });
      const status = r.dryRun ? "dry-run" : r.ok ? "sent" : "failed";
      results.push({ channel: "sms", ok: r.ok, status });
      await db.from("hc_messages").insert({ journey_id: journey.id, client_id: journey.client_id, channel: "sms", recipient: profile.phone, template: "report_shared", body: text, status, error: r.error ?? null, provider_id: r.sid ?? null, sent_by: actor.label });
    }
    if (profile?.email) {
      const subject = "Heilsufarsskýrslan þín er tilbúin";
      const r = await sendEmail({
        to: profile.email,
        subject,
        html: renderBrandedEmail({ title: subject, bodyHtml: `<p style="margin:0 0 12px;">${escapeHtml(text)}</p>`, ctaLabel: "Opna skýrsluna", ctaUrl: link }),
        text: `${text}\n\n${link}`,
      });
      const status = r.id === "dev-log" ? "dry-run" : r.ok ? "sent" : "failed";
      results.push({ channel: "email", ok: r.ok, status });
      await db.from("hc_messages").insert({ journey_id: journey.id, client_id: journey.client_id, channel: "email", recipient: profile.email, template: "report_shared", subject, body: text, status, error: r.error ?? null, provider_id: r.id ?? null, sent_by: actor.label });
    }
    if (!results.length) return NextResponse.json({ error: "Hvorki sími né netfang er skráð." }, { status: 400 });

    const ok = results.some((r) => r.ok);
    if (ok) await patchJourney(journey.id, { report_sms_sent_at: new Date().toISOString() }, actor.label, "report_shared");
    await hcAudit(actor.label, "report_shared", journey.id, { results });
    return NextResponse.json({ ok, results }, { status: ok ? 200 : 502 });
  }

  if (body.action === "doctor_reviewed") {
    if (!actor.isDoctor) return NextResponse.json({ error: "Aðeins læknir getur skráð þetta." }, { status: 403 });
    const updated = await patchJourney(journey.id, { doctor_reviewed_at: new Date().toISOString() }, actor.label, "doctor_reviewed",
      { note: typeof body.note === "string" ? body.note.slice(0, 2000) : null });
    return NextResponse.json({ journey: updated });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

function escapeHtml(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
