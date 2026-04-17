import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const memberId: string | undefined = body?.member_id;
  const password: string | undefined = body?.password;
  if (!memberId || !password) {
    return NextResponse.json({ error: "member_id and password required" }, { status: 400 });
  }

  const { data: member } = await supabaseAdmin
    .from("company_members")
    .select("id, company_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("contact_person_id")
    .eq("id", member.company_id)
    .maybeSingle();
  const isOwner = company?.contact_person_id === user.id;
  if (!isOwner) {
    const { data: staff } = await supabaseAdmin.from("staff").select("id").eq("id", user.id).eq("active", true).maybeSingle();
    if (!staff) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin.rpc("set_member_invite_password", {
    p_member_id: memberId,
    p_password: password,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
