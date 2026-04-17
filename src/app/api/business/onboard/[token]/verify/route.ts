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
    return NextResponse.json({ error: "token and password required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("verify_member_invite", {
    p_token: token,
    p_password: password,
  });
  if (error) {
    if (error.message?.startsWith("locked:")) {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Try again later." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
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
