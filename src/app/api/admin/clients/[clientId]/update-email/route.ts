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

  // Update auth user email
  const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(clientId, {
    email: newEmail,
  });
  if (authErr) {
    return NextResponse.json({ error: authErr.message }, { status: 400 });
  }

  // Update clients table (the login / account email)
  await supabaseAdmin.from("clients_decrypted").update({ email: newEmail }).eq("id", clientId);

  // NOTE: we intentionally do NOT touch company_members.email here.
  // That column is the employee's WORK / roster email (where the invite was
  // sent, kept for HR), which is decoupled from the login email — an employee
  // can sign up with a personal email. The company link is by
  // company_members.client_id, not email, so the two are allowed to differ.
  // To change the roster's work email, edit the roster directly.

  return NextResponse.json({ ok: true, email: newEmail });
}
