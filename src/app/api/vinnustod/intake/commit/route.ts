// Second half of "drop a report in": open the right client's workspace.
//
// POST { client_id }                       → use this client
//   or { create: { full_name, email, kennitala?, phone? } } → make the client
// plus { values?, measured_at?, location? }
//
// Creating a client makes the same thing the bulk invite makes: an auth user,
// a clients row, and an invite email — so the person can open /app. Nothing
// from the report is stored for a NEW client: they have not allowed anyone to
// put their report in, so they bring it themselves (or allow a nurse to) from
// the app.
//
// For an EXISTING client the report is stored only if they have allowed a
// nurse to do it (hc_journeys.staff_import_consent_at, set by the client in
// the app; migration-hc-medalia-split.sql) — otherwise 403. It is stored as
// the parsed report (hc_reports, on their behalf, awaiting their
// confirmation) and NOT copied value-by-value into hc_results: surfaces read
// the values from the report payload (loadReport). Blood-test and
// measurement flags are Medalia's and are no longer stamped from a report.
//
// Actor: workstation session or Lifeline staff.
// Schema: supabase/migration-health-journey.sql, migration-hc-results.sql

import { after, NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { DEFAULT_LOCATION, currentJourney, getOrCreateJourney, hcAudit, patchJourney, siteOrigin } from "@/lib/hc/server";
import { STAFF_IMPORT_REFUSED } from "@/lib/hc/consent";
import { renderBrandedEmail, sendEmail } from "@/lib/email";
import { buildProposal } from "@/lib/hc/propose";

/**
 * Start the plan proposal without making anyone wait for it.
 *
 * The nurse's next few minutes go on reading the report, so the model can
 * think while she does and the proposal is waiting when she reaches the plan.
 * after() runs once the response has been sent but inside the same function
 * invocation, which is what keeps it alive on Vercel — a bare floating
 * promise gets killed when the response closes.
 *
 * Failure here is silent on purpose: the nurse can always press the button.
 */
function proposeInBackground(journeyId: string, actorLabel: string) {
  after(async () => {
    try {
      await buildProposal(journeyId, actorLabel);
    } catch {
      // Nothing to report to — the on-demand path will say what went wrong.
    }
  });
}

export const runtime = "nodejs";

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const digits = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  let clientId = str(body.client_id, 64);
  let created = false;

  if (!clientId) {
    const c = (body.create ?? {}) as Record<string, unknown>;
    const fullName = str(c.full_name, 200);
    const email = str(c.email, 200)?.toLowerCase() ?? null;
    if (!fullName || !email) return NextResponse.json({ error: "Nafn og netfang vantar." }, { status: 400 });
    const kt = digits(c.kennitala);
    if (kt && kt.length !== 10) return NextResponse.json({ error: "Kennitala á að vera 10 tölustafir." }, { status: 400 });

    // Already a client under that email? Then just use them.
    const { data: existing } = await supabaseAdmin.from("clients_decrypted").select("id").eq("email", email).maybeSingle();
    if (existing) {
      clientId = existing.id;
    } else {
      const { data: made, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { full_name: fullName, created_by_workstation: true },
      });
      if (error || !made.user) return NextResponse.json({ error: `Gat ekki búið til aðgang: ${error?.message ?? "óþekkt"}` }, { status: 400 });
      clientId = made.user.id;
      created = true;

      const enc = kt ? (await supabaseAdmin.rpc("enc_kennitala", { p_text: kt })).data : null;
      const row = { email, full_name: fullName, phone: str(c.phone, 40), kennitala_encrypted: enc ?? null, kennitala_last4: kt ? kt.slice(-4) : null, updated_at: new Date().toISOString() };
      // Creating the auth user already makes the clients row, so fill that one
      // in rather than inserting a second.
      const { data: existingRow } = await supabaseAdmin.from("clients_decrypted").select("id").eq("id", clientId).maybeSingle();
      const { error: rowErr } = existingRow
        ? await supabaseAdmin.from("clients_decrypted").update(row).eq("id", clientId)
        : await supabaseAdmin.from("clients_decrypted").insert({ id: clientId, ...row });
      if (rowErr) {
        // Never leave an auth user behind without a usable client record —
        // roll the account back so the nurse can simply retry.
        await supabaseAdmin.auth.admin.deleteUser(clientId).catch(() => {});
        return NextResponse.json({ error: `Gat ekki vistað skjólstæðing: ${rowErr.message}` }, { status: 400 });
      }

      // Invite, so the person can reach their plan in /account.
      const origin = siteOrigin(req);
      const { data: link } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: `${origin}/app` },
      });
      const url = link?.properties?.action_link;
      if (url) {
        await sendEmail({
          to: email,
          subject: "Aðgangur að heilsuferðinni þinni hjá Lifeline",
          html: renderBrandedEmail({
            title: "Heilsuferðin þín",
            preheader: "Aðgangurinn þinn hjá Lifeline er tilbúinn.",
            bodyHtml: `<p>Hæ ${fullName.split(" ")[0]}.</p><p>Við höfum sett upp aðganginn þinn hjá Lifeline. Þar sérðu niðurstöðurnar þínar og aðgerðaáætlunina þegar hún er tilbúin.</p>`,
            ctaLabel: "Opna aðganginn",
            ctaUrl: url,
            footerNote: "Ef þú áttir ekki von á þessum pósti er óhætt að hunsa hann.",
          }),
        }).catch(() => {});
      }
    }
  }

  if (!clientId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const hasReportData = !!(body.grunnheilsa && typeof body.grunnheilsa === "object")
    || (Array.isArray(body.values) && body.values.length > 0);

  /*
   * An existing client: their report only with their own permission. Checked
   * before anything is created or changed, so a refusal leaves no trace.
   */
  if (!created && hasReportData) {
    const current = await currentJourney(clientId);
    if (!current?.staff_import_consent_at) {
      await hcAudit(actor.label, "report_intake_refused_no_consent", current?.id ?? null, {});
      return NextResponse.json({ error: STAFF_IMPORT_REFUSED }, { status: 403 });
    }
  }

  const journey = await getOrCreateJourney(clientId, str(body.location, 60) || DEFAULT_LOCATION);
  const locs = actorLocationFilter(actor);
  if (locs && (!journey.location_id || !locs.includes(journey.location_id))) {
    return NextResponse.json({ error: "Skjólstæðingurinn er ekki á þínu svæði." }, { status: 403 });
  }

  // A new client: the account and the invite, nothing from the report.
  if (created) {
    await hcAudit(actor.label, "client_created_from_intake", journey.id, { report_discarded: hasReportData });
    return NextResponse.json({
      journey_id: journey.id, client_id: clientId, created, saved: 0,
      report_stored: false,
      note: hasReportData
        ? "Aðgangur stofnaður og boð sent. Skýrslan var ekki vistuð: skjólstæðingurinn setur hana inn sjálfur í appinu, eða leyfir hjúkrunarfræðingi að gera það."
        : "Aðgangur stofnaður og boð sent.",
    });
  }

  // The report states the client's sex; our reference bands need it.
  if (body.sex === "m" || body.sex === "f") {
    const { data: prof } = await supabaseAdmin.from("clients_decrypted").select("sex").eq("id", clientId).maybeSingle();
    if (!prof?.sex) await supabaseAdmin.from("clients_decrypted").update({ sex: body.sex === "m" ? "male" : "female" }).eq("id", clientId);
  }

  // Keep the whole parsed report: the workstation and the client's account
  // both render it, and the next one gives us the comparison for free.
  // Values are read from this payload; they are not copied into hc_results.
  let stored = false;
  if (body.grunnheilsa && typeof body.grunnheilsa === "object") {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("hc_reports").insert({
      journey_id: journey.id,
      client_id: clientId,
      report_date: /^\d{4}-\d{2}-\d{2}$/.test(String(body.measured_at)) ? String(body.measured_at) : null,
      // "ai-text" and "ai-document" both mean it left the building.
      method: String(body.method ?? "").startsWith("ai") ? "ai" : "local",
      payload: body.grunnheilsa,
      imported_by: actor.label,
      // On their behalf, with their permission; shown to them once they
      // confirm it is theirs (client_approved_at).
      source: "staff_on_behalf",
      approval_requested_at: now,
      approval_requested_by: actor.label,
    });
    if (error) return NextResponse.json({ error: "Tókst ekki að vista skýrsluna." }, { status: 400 });
    stored = true;
    if (!journey.report_imported_at) await patchJourney(journey.id, { report_imported_at: now }, actor.label, "report_intake");
    proposeInBackground(journey.id, actor.label);
  }

  await hcAudit(actor.label, "report_intake", journey.id, { report: stored, consent_at: journey.staff_import_consent_at ?? null });
  return NextResponse.json({
    journey_id: journey.id, client_id: clientId, created, saved: 0, report_stored: stored,
    note: stored ? null : "Aðeins Grunnheilsa-skýrsla úr sjúklingagáttinni er vistuð. Stök gildi eru ekki skráð.",
  });
}
