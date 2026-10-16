// One journey in the workstation.
// GET  → patient card (name, kennitala, contact), timeline, orders, audit
// POST { event, at?, mode?, note? } → record a milestone (incl.
//      doctor_interview_done — the Medalia interview happened; any staff).
// PATCH { interview_notes | followup_notes } → lifestyle notes, encrypted.
//
// Medalia split (2026-10-16): the Lifeline doctor workflow is gone — no
// report confirmation, no doctor review (request_doctor / doctor_reviewed),
// no share_report (Medalia releases the report). Those actions answer 410.
// Actor: workstation session or Lifeline staff (Bearer + AAL2).

import { NextRequest, NextResponse } from "next/server";
import { compareJourneys } from "@/lib/hc/compare";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { applyJourneyEvent, isJourneyEvent } from "@/lib/hc/events";
import { decryptKennitala, getClientProfile, hcAudit, siteOrigin } from "@/lib/hc/server";
import { loadReferrals, saveJourneyNote, withJourneyNotes } from "@/lib/hc/notes";
import { loadReport } from "@/lib/hc/report-store";

import { supabaseAdmin as db } from "@/lib/supabase-admin";
import { sendEmail, renderBrandedEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { actorLocationFilter, actorWorkerId, getHcActor, type HcActor } from "@/lib/hc/ws-auth";
import { sameOrigin } from "@/lib/hc/secrets";
import type { HcJourney } from "@/lib/hc/types";
import { notifyClient } from "@/lib/hc/notify";
import { coachingRemaining, coachingSubscription, coachingPackage } from "@/lib/hc/coaching";

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
    supabaseAdmin.from("hc_action_plans_decrypted").select("id, status, published_at, updated_at, headline, modules").eq("journey_id", journey.id).maybeSingle(),
    journey.location_id ? supabaseAdmin.from("hc_locations").select("id, name").eq("id", journey.location_id).maybeSingle() : Promise.resolve({ data: null }),
    supabaseAdmin.from("hc_workers").select("id, name, organization, role").eq("active", true),
    supabaseAdmin.from("hc_messages").select("id, channel, recipient, template, subject, body, status, error, sent_by, sent_at").eq("journey_id", journey.id).order("sent_at", { ascending: false }).limit(50),
    loadReferrals({ journeyId: journey.id }).then((data) => ({ data })),
    supabaseAdmin.from("hc_ai_proposals").select("output, input, created_at").eq("journey_id", journey.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const since = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10);
  const [{ data: logs }, { data: prefs }] = await Promise.all([
    supabaseAdmin.from("hc_action_logs").select("action_uid, done_on").eq("journey_id", journey.id).gte("done_on", since),
    supabaseAdmin.from("hc_action_prefs").select("action_uid, hidden, note").eq("journey_id", journey.id),
  ]);
  const storedReport = await loadReport(journey.id, journey.client_id);

  /**
   * The provenance of the report, for the nurse to see — and to show later
   * if anyone asks how a Medalia report came to be in Lifeline.
   *
   * Three states: the client entered it themselves, a member of staff
   * entered it on their behalf and the client confirmed (with the time they
   * did), or it is still waiting on them.
   */
  const { data: rep } = await supabaseAdmin
    .from("hc_reports")
    .select("source, imported_by, report_date, approval_requested_at, approval_requested_by, client_approved_at, created_at")
    .eq("journey_id", journey.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const reportProvenance = rep
    ? {
        source: rep.source as string,
        reportDate: (rep.report_date as string) ?? null,
        enteredBy: (rep.imported_by as string) ?? null,
        requestedBy: (rep.approval_requested_by as string) ?? null,
        requestedAt: (rep.approval_requested_at as string) ?? null,
        approvedAt: (rep.client_approved_at as string) ?? null,
        state: rep.client_approved_at
          ? (rep.source === "self" ? "self" : "confirmed")
          : rep.approval_requested_at ? "awaiting" : "staff",
      }
    : null;
  const { data: results } = await supabaseAdmin
    .from("hc_results_decrypted")
    .select("marker, value, unit, measured_at, source, note, entered_by, updated_at")
    .eq("journey_id", journey.id);

  /* "Lifeline þjálfun": what is left of this month's call and the
     measurement interval, so the coach books inside the tier. */
  const coachingSub = await coachingSubscription(journey.client_id);
  const coaching = coachingSub
    ? await (async () => {
        const pkg = await coachingPackage();
        const left = await coachingRemaining(journey.client_id, pkg.quota);
        return { ...left, service_weekday: pkg.quota.service_weekday, ends_at: coachingSub.status === "cancelled" ? coachingSub.current_period_end : null };
      })()
    : null;

  return NextResponse.json({
    reportProvenance,
    coaching,
    // Notes decrypted in place (lifestyle notes; stored encrypted), and no
    // ciphertext columns in the response.
    journey: await withJourneyNotes(journey),
    // Whether the client has allowed a nurse to put the report in for them.
    staff_import_consent_at: journey.staff_import_consent_at ?? null,
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
    compare: await compareJourneys(journey.client_id, journey.id, profile?.sex === "male" ? "m" : profile?.sex === "female" ? "f" : null).catch(() => null),
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
  if (body.at && Number.isNaN(new Date(body.at).getTime())) return NextResponse.json({ error: "bad_date" }, { status: 400 });

  const updated = await applyJourneyEvent(journey, body.event, {
    at: body.at ?? null,
    actor: actor.label,
    mode: body.mode === "video" ? "video" : body.mode === "in_person" ? "in_person" : null,
    note: typeof body.note === "string" ? body.note.slice(0, 2000) : null,
    // Moving a colleague's appointment must not take it over: the actor only
    // becomes the interviewer when there is none yet (or it is asked for).
    interviewerId: typeof body.interviewer_id === "string" ? body.interviewer_id
      : !journey.interviewer_id ? actorWorkerId(actor) : null,
    // A pasted https link sets it; "" clears it (Google mints a new one);
    // anything else (null, junk) leaves the current link alone.
    meetingUrl: typeof body.meeting_url === "string"
      ? (/^https:\/\//.test(body.meeting_url.trim()) ? body.meeting_url.trim().slice(0, 500) : body.meeting_url.trim() === "" ? null : undefined)
      : undefined,
    origin: siteOrigin(req),
  });
  if (!updated) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ journey: await withJourneyNotes(updated) });
}

// ── Save Áætlunarsamtal notes (autosave from the guided session) ───────────
// Lifestyle notes for the plan, one field per topic. No clinical content —
// that is Medalia's. Stored encrypted (src/lib/hc/notes.ts).
const NOTE_KEYS = ["sleep", "exercise", "nutrition", "mental", "measurements", "goals", "other"] as const;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (actor.kind === "worker" && !sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const journey = await loadAllowed(actor, (await ctx.params).id);
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  // The first interview and the follow-up keep separate notes.
  const field = body.followup_notes && typeof body.followup_notes === "object" ? "followup_notes" : "interview_notes";
  const src = (body[field] && typeof body[field] === "object" ? body[field] : {}) as Record<string, unknown>;
  const notes: Record<string, string> = {};
  for (const k of NOTE_KEYS) if (typeof src[k] === "string") notes[k] = (src[k] as string).slice(0, 6000);
  // Not a milestone — no audit per keystroke. The DB trigger encrypts.
  const error = await saveJourneyNote(journey.id, field, notes);
  if (error) return NextResponse.json({ error }, { status: 500 });
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
          <p style="margin:0;">Þá er blóðprufan pöntuð fyrir þig. Mælingartímann bókar þú í Lifeline appinu.</p>`,
        ctaLabel: "Opna heilsuferðina",
        ctaUrl: `${origin}/app`,
      }),
      text: `Virkjunarkóðinn þinn er ${order.activation_code}. ${origin}/app`,
    });
    if (!r.ok) return NextResponse.json({ error: r.error || "Sending mistókst." }, { status: 502 });
    await hcAudit(actor.label, "reminder_sent", journey.id);
    return NextResponse.json({ ok: true });
  }

  /*
   * Ask the client for leave to put their report in (staff import is
   * consent-gated). In-app: the notification + red dots light from
   * staff_import_consent_requested_at until they look; push and SMS go as
   * the client's "Tilkynningar frá Lifeline" allow. Once a day at most.
   */
  if (body.action === "request_staff_import_consent") {
    const j = journey as HcJourney & { staff_import_consent_at?: string | null; staff_import_consent_requested_at?: string | null };
    if (j.staff_import_consent_at) return NextResponse.json({ error: "Leyfið er þegar veitt." }, { status: 409 });
    if (j.staff_import_consent_requested_at && Date.now() - Date.parse(j.staff_import_consent_requested_at) < 86_400_000) {
      return NextResponse.json({ error: "Beiðni var send síðasta sólarhringinn. Bíddu aðeins." }, { status: 429 });
    }
    const now = new Date().toISOString();
    const { error } = await db.from("hc_journeys")
      .update({ staff_import_consent_requested_at: now, staff_import_consent_request_seen_at: null }).eq("id", journey.id);
    if (error) return NextResponse.json({ error: "Tókst ekki að vista beiðnina." }, { status: 500 });
    const sent = await notifyClient(journey.client_id, {
      title: "Má hjúkrunarfræðingur setja skýrsluna inn?",
      body: "Opnaðu appið til að veita leyfi eða setja skýrsluna inn.",
      url: "/app?leyfi=1",
      tag: `consent-${journey.id}`,
      sms: `Lifeline: Hjúkrunarfræðingurinn þinn biður um leyfi til að setja skýrsluna þína úr sjúklingagáttinni inn í appið. Opnaðu ${origin}/app?leyfi=1`,
    });
    await hcAudit(actor.label, "staff_import_consent_requested", journey.id, { pushed: sent.pushed, texted: sent.texted });
    return NextResponse.json({ ok: true, requested_at: now, pushed: sent.pushed, texted: sent.texted });
  }

  // Removed in the Medalia split: the Lifeline doctor workflow (review
  // requests, review ticks) and sharing the report — Medalia releases it.
  if (body.action === "request_doctor" || body.action === "doctor_reviewed" || body.action === "share_report") {
    return NextResponse.json({ error: "Þetta er ekki lengur gert í Lifeline. Læknisþátturinn og skýrslan eru í Medalia." }, { status: 410 });
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
          ctaUrl: `${origin}/app`,
        });
        const r = await sendEmail({ to: email, subject, html, text: `${text}\n\n${origin}/app`, replyTo: actor.kind === "worker" ? actor.worker.email : actor.email ?? undefined });
        const status = r.id === "dev-log" ? "dry-run" : r.ok ? "sent" : "failed";
        results.push({ channel: "email", ok: r.ok, to: email, error: r.error, status });
        await db.from("hc_messages").insert({ journey_id: journey.id, client_id: journey.client_id, channel: "email", recipient: email, template, subject, body: text, status, error: r.error ?? null, provider_id: r.id ?? null, sent_by: actor.label });
      }
    }
    await hcAudit(actor.label, "message_sent", journey.id, { channels, template, results: results.map((r) => ({ channel: r.channel, status: r.status })) });
    const ok = results.some((r) => r.ok);
    return NextResponse.json({ ok, results }, { status: ok ? 200 : 502 });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

function escapeHtml(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
