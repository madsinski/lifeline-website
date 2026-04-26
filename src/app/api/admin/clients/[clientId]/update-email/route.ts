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

  const { email } = await req.json().catch(() => ({ email: "" }));
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const newEmail = email.trim();

  // Get the OLD email before updating anything
  const { data: oldClient } = await supabaseAdmin
    .from("clients")
    .select("email, company_id")
    .eq("id", clientId)
    .maybeSingle();
  const oldEmail = oldClient?.email || "";
  const companyId = oldClient?.company_id;

  // Update auth user email
  const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(clientId, {
    email: newEmail,
  });
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  // Update clients table
  await supabaseAdmin.from("clients").update({ email: newEmail }).eq("id", clientId);

  // Sync to company_members using the OLD email to find the row
  if (companyId && oldEmail) {
    await supabaseAdmin.from("company_members")
      .update({ email: newEmail })
      .eq("email", oldEmail)
      .eq("company_id", companyId);
  }

  return NextResponse.json({ ok: true, email: newEmail });
}
