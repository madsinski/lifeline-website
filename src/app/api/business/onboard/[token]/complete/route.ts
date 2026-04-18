import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail, renderWelcomeEmail } from "@/lib/email";

const BIODY_SYNC_URL = process.env.BIODY_SYNC_URL ||
  "https://cfnibfxzltxiriqxvvru.supabase.co/functions/v1/biody-sync";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const {
    password,
    account_password,
    sex,
    height_cm,
    weight_kg,
    activity_level,
    terms_version,
    research_opt_out,
    marketing_opt_out,
  } = body || {};

  if (!token || !password || !account_password) {
    return NextResponse.json({ error: "token, password, and account_password required" }, { status: 400 });
  }
  if (!sex || !height_cm || !weight_kg || !activity_level) {
    return NextResponse.json({ error: "sex, height_cm, weight_kg, activity_level required" }, { status: 400 });
  }

  // Verify invite
  const { data: verifyData, error: verifyErr } = await supabaseAdmin.rpc("verify_member_invite", {
    p_token: token,
    p_password: password,
  });
  if (verifyErr) return NextResponse.json({ error: verifyErr.message }, { status: 500 });
  const member = Array.isArray(verifyData) ? verifyData[0] : verifyData;
  if (!member) return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  if (member.completed_at) {
    return NextResponse.json({ error: "already completed" }, { status: 409 });
  }

  // Load full member row (with encrypted kennitala blob) + company
  const { data: memberRow } = await supabaseAdmin
    .from("company_members")
    .select("id, company_id, kennitala_encrypted, email, full_name, phone")
    .eq("id", member.id)
    .maybeSingle();
  if (!memberRow) return NextResponse.json({ error: "member missing" }, { status: 404 });

  // Create or reuse auth user
  let userId: string | null = null;
  const email = (memberRow.email || member.email || "").toLowerCase();

  const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = (existing?.users || []).find((u) => (u.email || "").toLowerCase() === email);
  if (found) {
    userId = found.id;
    // Update password so employee can sign in with the one they just chose
    await supabaseAdmin.auth.admin.updateUserById(found.id, {
      password: account_password,
      email_confirm: true,
    });
  } else {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: account_password,
      email_confirm: true,
      user_metadata: { full_name: memberRow.full_name },
    });
    if (createErr || !created.user) {
      return NextResponse.json({ error: createErr?.message || "auth create failed" }, { status: 500 });
    }
    userId = created.user.id;
  }
  if (!userId) return NextResponse.json({ error: "no user id" }, { status: 500 });

  // Upsert clients row — copy encrypted kennitala from member
  const now = new Date().toISOString();
  const dobIso = parseKennitalaToDob(member.kennitala);
  const clientPayload: Record<string, unknown> = {
    id: userId,
    email,
    full_name: memberRow.full_name,
    phone: memberRow.phone || null,
    sex,
    height_cm,
    weight_kg,
    activity_level,
    kennitala_encrypted: memberRow.kennitala_encrypted,
    research_opt_out: !!research_opt_out,
    marketing_opt_out: !!marketing_opt_out,
    company_id: memberRow.company_id,
    terms_version,
    terms_accepted_at: now,
    updated_at: now,
  };
  if (dobIso) clientPayload.date_of_birth = dobIso;

  const { error: upErr } = await supabaseAdmin
    .from("clients")
    .upsert(clientPayload, { onConflict: "id" });
  if (upErr) return NextResponse.json({ error: `clients upsert: ${upErr.message}` }, { status: 500 });

  // Mark member completed
  await supabaseAdmin
    .from("company_members")
    .update({ client_id: userId, completed_at: now })
    .eq("id", memberRow.id);

  // Kick off Biody patient creation
  let biodyResult: unknown = null;
  if (SERVICE_ROLE_KEY) {
    try {
      const bRes = await fetch(`${BIODY_SYNC_URL}/create-patient`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // biody-sync accepts service role JWT for staff-level calls; but it expects
          // a normal user JWT. We'll pass the service role and let biody-sync short-circuit.
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          client_id: userId,
          first_name: memberRow.full_name?.split(" ")[0] || memberRow.full_name,
          last_name: memberRow.full_name?.split(" ").slice(1).join(" ") || "-",
          date_of_birth: dobIso,
          sex,
          height_cm,
          activity_level,
        }),
      });
      biodyResult = await bRes.json().catch(() => null);
    } catch (e) {
      biodyResult = { error: (e as Error).message };
    }
  }

  // Send a welcome email — non-blocking; failures don't break the flow.
  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "https://lifelinehealth.is";
    const { data: companyRow } = await supabaseAdmin
      .from("companies").select("name").eq("id", memberRow.company_id).maybeSingle();
    const { text, html } = renderWelcomeEmail({
      companyName: companyRow?.name || null,
      recipientName: (memberRow.full_name || "").split(" ")[0] || "there",
      welcomeUrl: `${origin.replace(/\/$/, "")}/account/login?next=${encodeURIComponent("/account/welcome")}`,
      loginUrl: `${origin.replace(/\/$/, "")}/account/login`,
    });
    await sendEmail({
      to: email,
      subject: `Welcome to Lifeline Health${companyRow?.name ? ` — ${companyRow.name}` : ""}`,
      text,
      html,
    });
  } catch (e) {
    console.error("[onboard-complete] welcome email failed:", (e as Error).message);
  }

  return NextResponse.json({ ok: true, biody: biodyResult });
}

function parseKennitalaToDob(kt: string | null | undefined): string | null {
  if (!kt || kt.length !== 10) return null;
  // kennitala structure: DDMMYY-NNNC where C indicates century:
  // 8 or 9 = 1800s or 1900s, 0 = 2000s.
  const dd = kt.slice(0, 2);
  const mm = kt.slice(2, 4);
  const yy = kt.slice(4, 6);
  const century = kt[9];
  let yyyy: string;
  if (century === "9") yyyy = `19${yy}`;
  else if (century === "0") yyyy = `20${yy}`;
  else if (century === "8") yyyy = `18${yy}`;
  else return null;
  return `${yyyy}-${mm}-${dd}`;
}
