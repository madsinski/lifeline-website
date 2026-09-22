// Onboarding profile: everything the union application and the patient
// portal need about the person. Kennitala is encrypted with enc_kennitala
// (service role only) — this is the first place a B2C kennitala is stored.
// POST { full_name, phone, address, postcode, town, kennitala? }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cleanKennitala, isValidKennitala, isValidIcelandicPhone } from "@/lib/kennitala";
import { currentJourney, getClientProfile, hcAudit, isProfileComplete, patchJourney, refreshStage, requireUser } from "@/lib/hc/server";

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

  const errors: Record<string, string> = {};
  if (fullName.length < 3) errors.full_name = "Sláðu inn fullt nafn.";
  if (!isValidIcelandicPhone(phone) && !/^\+\d{8,15}$/.test(phone.replace(/\s/g, ""))) errors.phone = "Sláðu inn gilt símanúmer.";
  if (street.length < 3) errors.address = "Sláðu inn heimilisfang.";
  if (!/^\d{3}$/.test(postcode)) errors.postcode = "Póstnúmer er þrír tölustafir.";
  if (town.length < 2) errors.town = "Sláðu inn bæjarfélag.";

  const existing = await getClientProfile(user.id);
  if (!ktRaw && !existing?.kennitala_encrypted) errors.kennitala = "Kennitala er nauðsynleg.";
  if (ktRaw && !isValidKennitala(ktRaw)) errors.kennitala = "Kennitalan er ekki gild.";
  if (Object.keys(errors).length) return NextResponse.json({ error: "validation", errors }, { status: 400 });

  const update: Record<string, unknown> = {
    full_name: fullName,
    phone,
    address: `${street}, ${postcode} ${town}`,
    updated_at: new Date().toISOString(),
  };
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
  await hcAudit(`client:${user.id}`, "profile_saved", null, { kennitala_changed: !!ktRaw });

  const profile = await getClientProfile(user.id);
  const journey = await currentJourney(user.id);
  if (journey) {
    if (isProfileComplete(profile) && !journey.profile_completed_at) {
      await patchJourney(journey.id, { profile_completed_at: new Date().toISOString() }, `client:${user.id}`, "profile_complete");
    } else {
      await refreshStage(journey);
    }
  }
  return NextResponse.json({ ok: true, complete: isProfileComplete(profile) });
}
