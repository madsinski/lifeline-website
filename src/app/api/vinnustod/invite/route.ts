// Invite someone who has no report yet.
//
// The workstation could only take on a new person by dropping their health
// report in — which is right when the report is what arrived first, and
// useless when a coach has just spoken to somebody on the phone. This is the
// other door: a name and an email or a phone number, and they get a link.
//
// Built from the same parts as intake/commit rather than beside them: the
// auth user, the clients_decrypted write (which is where the encryption
// trigger lives — writing to `clients` directly would store plaintext), the
// Supabase invite link, and the branded email. A second implementation of
// "create a client" would be a second place for that trigger to be missed.
//
// POST { name, email?, phone?, locationId? } -> { ok, clientId, journeyId, sent }
//
// Email and phone are both optional on their own but one is required: an
// invitation nobody can receive is not an invitation. SMS goes out only when
// Twilio is configured — see the `sent` field, which says what actually left.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor } from "@/lib/hc/ws-auth";
import { DEFAULT_LOCATION, getOrCreateJourney, hcAudit, siteOrigin } from "@/lib/hc/server";
import { renderBrandedEmail, sendEmail } from "@/lib/email";
import { sendSms, smsConfigured, toE164 } from "@/lib/sms";
import { fillName, inviteTemplate } from "@/lib/hc/invite-templates";

export const runtime = "nodejs";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = str(body?.name, 120);
  const email = str(body?.email, 160).toLowerCase();
  const phoneRaw = str(body?.phone, 40);
  const phone = phoneRaw ? toE164(phoneRaw) : null;

  if (!name) return NextResponse.json({ error: "Nafn vantar." }, { status: 400 });
  if (!email && !phone) {
    return NextResponse.json({ error: "Sláðu inn netfang eða símanúmer." }, { status: 400 });
  }
  if (phoneRaw && !phone) {
    return NextResponse.json({ error: "Símanúmerið er ekki gilt." }, { status: 400 });
  }
  /* An SMS invite still needs an address, because the link Supabase issues
     is tied to one. Said plainly rather than failing later. */
  if (!email) {
    return NextResponse.json({ error: "Netfang þarf til að búa til aðgang — símanúmerið er til viðbótar." }, { status: 400 });
  }

  // Already known? Then invite the person we have rather than a second copy.
  const { data: existing } = await supabaseAdmin.from("clients_decrypted")
    .select("id").eq("email", email).maybeSingle();

  let clientId = existing?.id as string | undefined;
  let created = false;

  if (!clientId) {
    const { data: made, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name: name, created_by_workstation: true },
    });
    if (error || !made.user) {
      return NextResponse.json({ error: `Gat ekki búið til aðgang: ${error?.message ?? "óþekkt"}` }, { status: 400 });
    }
    clientId = made.user.id;
    created = true;

    /* Through the view, never the table: clients_decrypted carries the
       INSTEAD OF trigger that encrypts, and a write straight to `clients`
       would store this in plaintext. */
    const row = { email, full_name: name, phone: phoneRaw || null };
    const { data: existingRow } = await supabaseAdmin.from("clients_decrypted")
      .select("id").eq("id", clientId).maybeSingle();
    const { error: rowErr } = existingRow
      ? await supabaseAdmin.from("clients_decrypted").update(row).eq("id", clientId)
      : await supabaseAdmin.from("clients_decrypted").insert({ id: clientId, ...row });
    if (rowErr) {
      // Never leave an auth user behind with no usable client record.
      await supabaseAdmin.auth.admin.deleteUser(clientId).catch(() => {});
      return NextResponse.json({ error: `Gat ekki vistað skjólstæðing: ${rowErr.message}` }, { status: 400 });
    }
  } else if (phoneRaw) {
    await supabaseAdmin.from("clients_decrypted").update({ phone: phoneRaw }).eq("id", clientId);
  }

  const locationId = str(body?.locationId, 60) || DEFAULT_LOCATION;
  const journey = await getOrCreateJourney(clientId, locationId);

  const origin = siteOrigin(req);
  const { data: link } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: `${origin}/account/heilsuferd` },
  });
  const url = link?.properties?.action_link ?? `${origin}/account/heilsuferd`;

  const sent: string[] = [];
  const first = name.split(" ")[0];
  /* Fixed text from a list rather than free text. The same first contact
     should read the same way every time, and SMS to Icelandic numbers is
     filtered on content as well as sender — see invite-templates.ts. */
  const tpl = inviteTemplate(typeof body?.template === "string" ? body.template : "");
  const channels = Array.isArray(body?.channels)
    ? (body.channels as unknown[]).filter((c): c is string => c === "email" || c === "sms")
    : ["email"];

  if (channels.includes("email")) {
    const mail = await sendEmail({
      to: email,
      subject: tpl.subject,
      html: renderBrandedEmail({
        title: tpl.subject,
        preheader: "Aðgangurinn þinn hjá Lifeline er tilbúinn.",
        bodyHtml: `<p>Hæ ${first}.</p><p>${tpl.email}</p>`,
        ctaLabel: "Opna aðganginn",
        ctaUrl: url,
        footerNote: "Ef þú áttir ekki von á þessum pósti er óhætt að hunsa hann.",
      }),
      text: `Hæ ${first}. ${tpl.email} ${url}`,
    }).catch(() => ({ ok: false }));
    if (mail.ok) sent.push("email");
  }

  if (channels.includes("sms") && phone && smsConfigured()) {
    const r = await sendSms({
      to: phone,
      body: `${fillName(tpl.sms, name)} ${url}`,
    }).catch(() => ({ ok: false }));
    if (r.ok) sent.push("sms");
  }

  await hcAudit(actor.label, created ? "client_invited" : "client_reinvited", journey.id, { sent });

  return NextResponse.json({
    ok: true,
    clientId,
    journeyId: journey.id,
    created,
    sent,
    /* Said out loud so the UI can tell the coach the text did not go,
       rather than implying it did. */
    smsConfigured: smsConfigured(),
  });
}
