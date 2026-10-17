// Onboarding profile: everything the union application and the patient
// portal need about the person. Kennitala is encrypted with enc_kennitala
// (service role only) — this is the first place a B2C kennitala is stored.
// POST { full_name, phone, address, postcode, town, kennitala?, accept_health_consent? }
// PUT  { accept_health_consent: true } — consent alone, for people whose
//      profile was complete before consent was part of this step.
// PATCH { address, postcode } — the address alone (AddressFields, the guided
//      setup at /app/uppsetning). The town is never taken from the request:
//      the postcode must be in Pósturinn's list (src/lib/is-postcodes.ts) and
//      the stored town is that list's official name for it.
// GET  → the participant's own profile for "Aðgangur" (kennitala as last four only).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cleanKennitala, isValidKennitala, isValidIcelandicPhone } from "@/lib/kennitala";
import { currentJourney, getClientProfile, hcAudit, isProfileComplete, patchJourney, refreshStage, requireUser, profileTrackOf } from "@/lib/hc/server";
import { hasHealthConsent, recordHealthConsent } from "@/lib/health-consent";
import { isValidPostcode, placeForPostcode } from "@/lib/is-postcodes";
import { formatAddress } from "@/lib/hc/address";

export const runtime = "nodejs";

function dobFromKennitala(kt: string): string | null {
  const c = kt[9];
  const century = c === "9" ? "19" : c === "0" ? "20" : c === "8" ? "18" : null;
  if (!century) return null;
  const dd = Number(kt.slice(0, 2));
  // Kerfiskennitölur (útlendingar) bæta 40 við daginn.
  const day = dd > 40 ? dd - 40 : dd;
  return `${century}${kt.slice(4, 6)}-${kt.slice(2, 4)}-${String(day).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const p = await getClientProfile(user.id);
  // Read once: both the completeness rule and the caller's own step list
  // depend on which product this journey is.
  const journeyForProfile = await currentJourney(user.id);
  const { data: last4 } = p?.kennitala_encrypted ? await supabaseAdmin.rpc("kennitala_last4", { p_enc: p.kennitala_encrypted }) : { data: null };
  return NextResponse.json({
    profile: {
      email: user.email ?? null, full_name: p?.full_name ?? null, phone: p?.phone ?? null, address: p?.address ?? null,
      // Against this journey's own requirements: the coaching track needs a
      // name, the health check needs the kennitala the patient portal and the
      // union application are for.
      kennitala_last4: (last4 as string | null) ?? null,
      complete: isProfileComplete(p, profileTrackOf(journeyForProfile?.entry)),
    },
    health_consent: await hasHealthConsent(user.id),
    has_journey: !!journeyForProfile,
    /** Which product this is, so a surface can leave out what does not apply. */
    entry: journeyForProfile?.entry ?? null,
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({}));

  const fullName = String(b.full_name || "").trim();
  const phone = String(b.phone || "").trim();
  const street = String(b.address || "").trim();
  const postcode = String(b.postcode || "").trim();
  const town = String(b.town || "").trim();
  const ktRaw = b.kennitala ? cleanKennitala(String(b.kennitala)) : "";

  /*
   * Validated against this journey's own requirements.
   *
   * The coaching track asks for a name and nothing else (ProfileForm
   * track="app"), so demanding a phone, an address and a kennitala here made
   * that form impossible to save. Whatever is sent is still checked, so a
   * coaching participant who does give a phone number gives a valid one.
   */
  const journeyBefore = await currentJourney(user.id);
  const appOnly = profileTrackOf(journeyBefore?.entry) === "app";
  const sentAddress = !!(street || postcode || town);

  const errors: Record<string, string> = {};
  if (fullName.length < 3) errors.full_name = "Sláðu inn fullt nafn.";
  if ((!appOnly || phone) && !isValidIcelandicPhone(phone) && !/^\+\d{8,15}$/.test(phone.replace(/\s/g, ""))) errors.phone = "Sláðu inn gilt símanúmer.";
  if (!appOnly || sentAddress) {
    if (street.length < 3) errors.address = "Sláðu inn heimilisfang.";
    if (!/^\d{3}$/.test(postcode)) errors.postcode = "Póstnúmer er þrír tölustafir.";
    else if (!isValidPostcode(postcode)) errors.postcode = "Þetta póstnúmer er ekki til.";
    // The town follows from the postcode and is stored as Pósturinn names
    // it; what was typed only matters when there is no postcode to go on.
    if (!placeForPostcode(postcode) && town.length < 2) errors.town = "Sláðu inn bæjarfélag.";
  }

  const existing = await getClientProfile(user.id);
  if (!appOnly && !ktRaw && !existing?.kennitala_encrypted) errors.kennitala = "Kennitala er nauðsynleg.";
  // Informed consent (GDPR 9. gr.) is part of the health check, once per
  // version — not needed just to correct a name or phone number.
  const consented = await hasHealthConsent(user.id);
  const inJourney = !!journeyBefore;
  if (inJourney && !consented && b.accept_health_consent !== true) errors.consent = "Samþykkið þarf til að halda áfram.";
  if (ktRaw && !isValidKennitala(ktRaw)) errors.kennitala = "Kennitalan er ekki gild.";
  if (Object.keys(errors).length) return NextResponse.json({ error: "validation", errors }, { status: 400 });

  const update: Record<string, unknown> = {
    full_name: fullName,
    updated_at: new Date().toISOString(),
  };
  // Not overwritten with blanks by a form that never showed the fields.
  if (!appOnly || phone) update.phone = phone;
  if (!appOnly || sentAddress) update.address = formatAddress(street, postcode);
  if (ktRaw) {
    const { data: enc, error: encErr } = await supabaseAdmin.rpc("enc_kennitala", { p_text: ktRaw });
    if (encErr || !enc) return NextResponse.json({ error: "encrypt_failed" }, { status: 500 });
    update.kennitala_encrypted = enc;
    const dob = dobFromKennitala(ktRaw);
    if (dob) update.date_of_birth = dob;
  }

  if (existing) {
    const { error } = await supabaseAdmin.from("clients_decrypted").update(update).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin.from("clients_decrypted").insert({ id: user.id, email: user.email, ...update });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!consented && b.accept_health_consent === true) {
    await recordHealthConsent({
      userId: user.id, email: user.email ?? null,
      ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
      userAgent: req.headers.get("user-agent") || null, tag: "hc/profile",
    });
  }
  await hcAudit(`client:${user.id}`, "profile_saved", null, { kennitala_changed: !!ktRaw });

  const profile = await getClientProfile(user.id);
  const journey = await currentJourney(user.id);
  if (journey) {
    if (isProfileComplete(profile, profileTrackOf(journey.entry)) && !journey.profile_completed_at) {
      await patchJourney(journey.id, { profile_completed_at: new Date().toISOString() }, `client:${user.id}`, "profile_complete");
    } else {
      await refreshStage(journey);
    }
  }
  return NextResponse.json({ ok: true, complete: isProfileComplete(profile, profileTrackOf(journey?.entry)) });
}

export async function PUT(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({}));
  if (b.accept_health_consent !== true) return NextResponse.json({ error: "consent_required" }, { status: 400 });
  const ok = await recordHealthConsent({
    userId: user.id, email: user.email ?? null,
    ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
    userAgent: req.headers.get("user-agent") || null, tag: "hc/profile",
  });
  if (!ok) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  await hcAudit(`client:${user.id}`, "health_consent_accepted", null);
  return NextResponse.json({ ok: true });
}

/** The address on its own: street + a postcode from Pósturinn's list. */
export async function PATCH(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const b = await req.json().catch(() => ({}));
  const street = String(b.address || "").trim().slice(0, 120);
  const postcode = String(b.postcode || "").trim();
  const errors: Record<string, string> = {};
  if (street.length < 3) errors.address = "Sláðu inn götu og húsnúmer.";
  if (!/^\d{3}$/.test(postcode)) errors.postcode = "Póstnúmer er þrír tölustafir.";
  else if (!isValidPostcode(postcode)) errors.postcode = "Þetta póstnúmer er ekki til.";
  if (Object.keys(errors).length) return NextResponse.json({ error: "validation", errors }, { status: 400 });

  const address = formatAddress(street, postcode);
  const existing = await getClientProfile(user.id);
  const now = new Date().toISOString();
  const { error } = existing
    ? await supabaseAdmin.from("clients_decrypted").update({ address, updated_at: now }).eq("id", user.id)
    : await supabaseAdmin.from("clients_decrypted").insert({ id: user.id, email: user.email, address, updated_at: now });
  if (error) {
    console.error("[hc/profile] address save failed", error.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  await hcAudit(`client:${user.id}`, "address_saved", null, { postcode });
  const journey = await currentJourney(user.id);
  if (journey) await refreshStage(journey);
  return NextResponse.json({ ok: true, address, postcode, town: placeForPostcode(postcode) });
}
