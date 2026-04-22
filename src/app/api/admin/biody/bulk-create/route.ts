import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff, findAuthUserByEmail } from "@/lib/auth-helpers";
import { activateBiodyForClient } from "@/lib/biody";

// Admin bulk-create Biody patients from a minimal HR roster.
//
// Usecase: a company has shared a list of employees but hasn't run the
// full B2B onboarding wizard yet. We need Biody patients NOW so the
// nurse can measure them on-site, but we don't have sex / height /
// activity level. We fill those with sensible defaults and mark the
// client row with biody_placeholder_data = true so a follow-up pass
// can collect the real data via the normal onboarding flow.
//
// Defaults used:
//   height_cm      = 170
//   activity_level = "moderate"
//   sex            = whatever the CSV said, else "male" (kennitala
//                    doesn't encode sex in Iceland; admin can override
//                    per row with a Kyn column)
//   date_of_birth  = parsed from kennitala (century digit at pos 10)
//   patient_group  = the chosen company's Biody group (biody-sync
//                    attaches automatically based on clients.company_id)

export const maxDuration = 180;

type Invitee = {
  full_name?: string;
  email?: string;
  phone?: string;
  kennitala?: string;
  sex?: "male" | "female";
};

type ResultRow = {
  email: string;
  status: "created" | "updated" | "biody_existed" | "failed";
  biody_patient_id?: number | string | null;
  error?: string;
};

function parseKennitalaToDob(kt: string): string | null {
  const digits = kt.replace(/\D/g, "");
  if (digits.length !== 10) return null;
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yy = digits.slice(4, 6);
  const century = digits[9];
  let yyyy: string;
  if (century === "9") yyyy = `19${yy}`;
  else if (century === "0") yyyy = `20${yy}`;
  else if (century === "8") yyyy = `18${yy}`;
  else return null;
  const isoCandidate = `${yyyy}-${mm}-${dd}`;
  const parsed = new Date(`${isoCandidate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return isoCandidate;
}

async function createOne(companyId: string, row: Invitee): Promise<ResultRow> {
  const email = (row.email || "").trim().toLowerCase();
  const fullName = (row.full_name || "").trim();
  const phone = (row.phone || "").trim() || null;
  const ktRaw = (row.kennitala || "").replace(/\D/g, "");
  const ktLast4 = ktRaw.slice(-4) || null;
  const sex: "male" | "female" = row.sex === "female" ? "female" : "male";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { email: email || "(missing)", status: "failed", error: "invalid_email" };
  }
  if (!fullName) {
    return { email, status: "failed", error: "missing_name" };
  }
  if (ktRaw.length !== 10) {
    return { email, status: "failed", error: "invalid_kennitala" };
  }
  const dob = parseKennitalaToDob(ktRaw);
  if (!dob) {
    return { email, status: "failed", error: "kennitala_parse_failed" };
  }

  try {
    // Find or create auth user.
    let userId: string;
    const existing = await findAuthUserByEmail(email);
    let newUser = false;
    if (existing) {
      userId = existing.id;
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { full_name: fullName, biody_placeholder: true, admin_created: true },
      });
      if (createErr || !created?.user) {
        return { email, status: "failed", error: createErr?.message || "create_user_failed" };
      }
      userId = created.user.id;
      newUser = true;
    }

    // Upsert clients row with placeholder Biody fields + company link.
    // Only fill in fields that are currently blank so we don't overwrite
    // real data the user or another admin already entered.
    const nowIso = new Date().toISOString();
    const { data: existingClient } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, kennitala_last4, sex, height_cm, weight_kg, activity_level, date_of_birth, company_id, biody_patient_id, biody_placeholder_data")
      .eq("id", userId)
      .maybeSingle();
    if (!existingClient) {
      const { error: insErr } = await supabaseAdmin.from("clients").insert({
        id: userId,
        email,
        full_name: fullName,
        phone,
        kennitala_last4: ktLast4,
        sex,
        date_of_birth: dob,
        height_cm: 170,
        activity_level: "moderate",
        company_id: companyId,
        biody_placeholder_data: true,
        created_at: nowIso,
        updated_at: nowIso,
      });
      if (insErr) return { email, status: "failed", error: insErr.message };
    } else {
      const patch: Record<string, unknown> = { updated_at: nowIso };
      if (!existingClient.full_name) patch.full_name = fullName;
      if (!existingClient.phone) patch.phone = phone;
      if (!existingClient.kennitala_last4) patch.kennitala_last4 = ktLast4;
      if (!existingClient.sex) patch.sex = sex;
      if (!existingClient.date_of_birth) patch.date_of_birth = dob;
      if (!existingClient.height_cm) patch.height_cm = 170;
      if (!existingClient.activity_level) patch.activity_level = "moderate";
      if (!existingClient.company_id) patch.company_id = companyId;
      // Flag as placeholder ONLY if we had to fill any of the body-comp
      // fields ourselves (height / activity level). If the client already
      // had them, treat the row as real data and leave the flag as-is.
      if (!existingClient.height_cm || !existingClient.activity_level) {
        patch.biody_placeholder_data = true;
      }
      const { error: upErr } = await supabaseAdmin
        .from("clients")
        .update(patch)
        .eq("id", userId);
      if (upErr) return { email, status: "failed", error: upErr.message };
    }

    // Activate Biody. If the client already has a biody_patient_id, the
    // helper returns { existing: true } and we mark it as biody_existed.
    const activation = await activateBiodyForClient(userId);
    if (!activation.ok) {
      return { email, status: "failed", error: activation.error || "biody_activation_failed" };
    }
    return {
      email,
      status: activation.existing ? "biody_existed" : (newUser ? "created" : "updated"),
      biody_patient_id: activation.biody_patient_id ?? null,
    };
  } catch (e) {
    return { email, status: "failed", error: (e as Error).message };
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const companyId: string | undefined = body?.company_id;
  const invitees: Invitee[] = Array.isArray(body?.invitees) ? body.invitees : [];
  if (!companyId) return NextResponse.json({ error: "company_id required" }, { status: 400 });
  if (invitees.length === 0) return NextResponse.json({ error: "invitees_empty" }, { status: 400 });
  if (invitees.length > 200) return NextResponse.json({ error: "too_many", detail: "max 200 per batch" }, { status: 400 });

  // Verify company exists (cheap sanity check)
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "company_not_found" }, { status: 404 });

  const results: ResultRow[] = [];
  for (const row of invitees) {
    results.push(await createOne(companyId, row));
  }
  const counts = {
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    biody_existed: results.filter((r) => r.status === "biody_existed").length,
    failed: results.filter((r) => r.status === "failed").length,
  };
  return NextResponse.json({ ok: true, company_name: company.name, counts, results });
}
