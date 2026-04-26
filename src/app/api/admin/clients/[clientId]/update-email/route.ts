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

  return NextResponse.json({ ok: true, email: email.trim() });
}
