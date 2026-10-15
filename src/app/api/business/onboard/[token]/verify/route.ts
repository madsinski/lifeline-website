import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const password: string | undefined = body?.password;
  if (!token || !password) {
    return NextResponse.json({ error: "Sláðu inn kóðann úr boðspóstinum." }, { status: 400 });
  }

  // M5: per-IP rate limit before hitting the verify function itself.
  // 20 verify attempts per hour per IP — complements the per-member lockout.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || "unknown";
  const { data: allowed } = await supabaseAdmin.rpc("check_rate_limit", {
    p_key: `invite_verify:${ip}`,
    p_max: 20,
    p_window: "01:00:00",
  });
  if (allowed === false) {
    return NextResponse.json(
      { error: "Of margar tilraunir. Reyndu aftur síðar." },
      { status: 429 },
    );
  }

  // Pre-check token state before attempting password verification. This
  // prevents expired or completed tokens from consuming verify_member_invite
  // attempts (which would otherwise leak existence-of-token information
  // through timing) and stops enumeration via long-lived leaked invites.
  const { data: tokenRow } = await supabaseAdmin
    .from("company_members")
    .select("invite_token_expires_at, completed_at")
    .eq("invite_token", token)
    .maybeSingle();
  if (!tokenRow) {
    return NextResponse.json({ error: "Rangur kóði." }, { status: 401 });
  }
  if (tokenRow.completed_at) {
    return NextResponse.json(
      { error: "Þetta boð hefur þegar verið notað. Skráðu þig inn í staðinn." },
      { status: 410 },
    );
  }
  if (tokenRow.invite_token_expires_at && new Date(tokenRow.invite_token_expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Boðið er útrunnið. Biddu tengilið fyrirtækisins um að senda það aftur." },
      { status: 410 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc("verify_member_invite", {
    p_token: token,
    p_password: password,
  });
  if (error) {
    if (error.message?.startsWith("locked:")) {
      return NextResponse.json(
        { error: "Of margar rangar tilraunir. Reyndu aftur síðar." },
        { status: 429 },
      );
    }
    console.error("[onboard-verify] verify_member_invite:", error.message);
    return NextResponse.json({ error: "Ekki tókst að staðfesta boðið. Reyndu aftur." }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: "Rangur kóði." }, { status: 401 });

  const ua = req.headers.get("user-agent") || "";
  await supabaseAdmin.rpc("log_kennitala_access", {
    p_actor_role: "onboarding",
    p_scope: "full",
    p_purpose: "invite_verify",
    p_subject_kind: "company_member",
    p_subject_id: row.id,
    p_ip: ip,
    p_user_agent: ua,
  });

  return NextResponse.json({
    id: row.id,
    company_id: row.company_id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    kennitala: row.kennitala,
    completed_at: row.completed_at,
  });
}
