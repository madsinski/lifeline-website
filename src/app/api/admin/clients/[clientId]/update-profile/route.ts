import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { full_name, email, phone, address, date_of_birth, sex } = body;

  // Get old client data for matching company_members
  const { data: oldClient } = await supabaseAdmin
    .from("clients")
    .select("email, company_id, full_name")
    .eq("id", clientId)
    .maybeSingle();

  if (!oldClient) {
    return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  }

  const oldEmail = oldClient.email;
  const companyId = oldClient.company_id;

  // 1. Update clients table
  const clientUpdate: Record<string, unknown> = {};
  if (full_name) clientUpdate.full_name = full_name;
  if (phone !== undefined) clientUpdate.phone = phone;
  if (address !== undefined) clientUpdate.address = address;
  if (date_of_birth !== undefined) clientUpdate.date_of_birth = date_of_birth;
  if (sex !== undefined) clientUpdate.sex = sex;

  if (Object.keys(clientUpdate).length > 0) {
    const { error } = await supabaseAdmin.from("clients").update(clientUpdate).eq("id", clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 2. Update auth email if changed
  if (email && email !== oldEmail) {
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(clientId, { email });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 });
    await supabaseAdmin.from("clients").update({ email }).eq("id", clientId);
  }

  // 3. Sync to company_members (B2B roster) using OLD email for matching
  if (companyId && oldEmail) {
    const memberUpdate: Record<string, unknown> = {};
    if (full_name) memberUpdate.full_name = full_name;
    if (phone !== undefined) memberUpdate.phone = phone;
    if (email && email !== oldEmail) memberUpdate.email = email;

    if (Object.keys(memberUpdate).length > 0) {
      await supabaseAdmin.from("company_members")
        .update(memberUpdate)
        .eq("email", oldEmail)
        .eq("company_id", companyId);
    }
  }

  return NextResponse.json({ ok: true });
}
