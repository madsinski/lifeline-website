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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

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
