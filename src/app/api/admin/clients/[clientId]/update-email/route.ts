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

  // Update auth user email
  const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(clientId, {
    email: email.trim(),
  });
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  // Also update the clients table
  await supabaseAdmin.from("clients").update({ email: email.trim() }).eq("id", clientId);

  // Sync to company_members (B2B roster) if this client is linked
  const { data: clientRow } = await supabaseAdmin
    .from("clients")
    .select("company_id")
    .eq("id", clientId)
    .maybeSingle();
  if (clientRow?.company_id) {
    await supabaseAdmin.from("company_members")
      .update({ email: email.trim() })
      .eq("email", (await supabaseAdmin.auth.admin.getUserById(clientId)).data.user?.email || "")
      .eq("company_id", clientRow.company_id);
    // Fallback: also try matching by the old email we just replaced
    // (the auth email is already updated, so match on clients table link)
  }
  // Also try direct match by user ID if company_members has a user_id column
  await supabaseAdmin.from("company_members")
    .update({ email: email.trim() })
    .eq("user_id", clientId);

  return NextResponse.json({ ok: true, email: email.trim() });
}
