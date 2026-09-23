// Second half of "drop a report in": open the right client's workspace.
//
// POST { client_id }                       → use this client
//   or { create: { full_name, email, kennitala?, phone? } } → make the client
// plus { values?, measured_at?, location? }
//
// Creating a client makes the same thing the bulk invite makes: an auth user,
// a clients row, and an invite email — so the person can open /account and
// see their plan. The journey is stamped as "report in hand" because that is
// what having the report means.
//
// Actor: workstation session or Lifeline staff.
// Schema: supabase/migration-health-journey.sql, migration-hc-results.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { DEFAULT_LOCATION, getOrCreateJourney, hcAudit, patchJourney, siteOrigin } from "@/lib/hc/server";
import { renderBrandedEmail, sendEmail } from "@/lib/email";

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
      const { error: rowErr } = await supabaseAdmin.from("clients_decrypted").insert({
        id: clientId,
        email,
        full_name: fullName,
        phone: str(c.phone, 40),
        kennitala_encrypted: enc ?? null,
      });
      if (rowErr) {
        // Never leave an auth user behind without the client row that makes
        // it usable — roll the account back so the nurse can simply retry.
        await supabaseAdmin.auth.admin.deleteUser(clientId).catch(() => {});
        return NextResponse.json({ error: `Gat ekki vistað skjólstæðing: ${rowErr.message}` }, { status: 400 });
      }

      // Invite, so the person can reach their plan in /account.
      const origin = siteOrigin(req);
      const { data: link } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: `${origin}/account/heilsuferd` },
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

  const journey = await getOrCreateJourney(clientId, str(body.location, 60) || DEFAULT_LOCATION);
  const locs = actorLocationFilter(actor);
  if (locs && (!journey.location_id || !locs.includes(journey.location_id))) {
    return NextResponse.json({ error: "Skjólstæðingurinn er ekki á þínu svæði." }, { status: 403 });
  }

  // Having the report means the tests are done and the report exists.
  const measuredAt = /^\d{4}-\d{2}-\d{2}$/.test(String(body.measured_at)) ? `${body.measured_at}T09:00:00.000Z` : new Date().toISOString();
  const patch: Record<string, string> = {};
  if (!journey.blood_results_at && !journey.blood_test_done_at) patch.blood_results_at = measuredAt;
  if (!journey.measurements_done_at) patch.measurements_done_at = measuredAt;
  if (!journey.report_generated_at) patch.report_generated_at = new Date().toISOString();
  if (Object.keys(patch).length) await patchJourney(journey.id, patch, actor.label, "report_intake");

  // Store the values the nurse kept.
  const values = Array.isArray(body.values) ? body.values : [];
  const rows = values
    .filter((v: Record<string, unknown>) => v && typeof v === "object" && Number.isFinite(Number(v.value)))
    .map((v: Record<string, unknown>) => ({
      journey_id: journey.id,
      client_id: clientId,
      marker: str(v.marker, 60) || "x:unknown",
      value: Number(v.value),
      unit: str(v.unit, 30),
      measured_at: /^\d{4}-\d{2}-\d{2}$/.test(String(body.measured_at)) ? String(body.measured_at) : null,
      source: "medalia",
      note: str(v.note, 300),
      entered_by: actor.label,
      updated_at: new Date().toISOString(),
    }));
  if (rows.length) {
    const { error } = await supabaseAdmin.from("hc_results").upsert(rows, { onConflict: "journey_id,marker" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await hcAudit(actor.label, created ? "client_created_from_report" : "report_intake", journey.id, { values: rows.length });
  return NextResponse.json({ journey_id: journey.id, client_id: clientId, created, saved: rows.length });
}
