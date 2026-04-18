import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff, findAuthUserByEmail } from "@/lib/auth-helpers";

async function canManageCompany(companyId: string, userId: string): Promise<boolean> {
  const { data: c } = await supabaseAdmin
    .from("companies").select("contact_person_id").eq("id", companyId).maybeSingle();
  if (c?.contact_person_id === userId) return true;
  return await isStaff(userId);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canManageCompany(companyId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = (body?.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  // Find or create the user
  let target = await findAuthUserByEmail(email);
  if (!target) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (createErr || !created.user) {
      return NextResponse.json({ error: "co_admin_invite_failed" }, { status: 500 });
    }
    target = created.user;
  }

  const { error } = await supabaseAdmin.from("company_admins").upsert({
    company_id: companyId,
    user_id: target.id,
    added_by: user.id,
  }, { onConflict: "company_id, user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, user_id: target.id, email });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canManageCompany(companyId, user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("company_admins")
    .delete()
    .eq("company_id", companyId)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
