import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = (body?.email || "").trim().toLowerCase();
  const password: string | undefined = body?.password;
  const fullName = (body?.full_name || "").trim();

  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  // Check if a user already exists
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = (list?.users || []).find((u) => (u.email || "").toLowerCase() === email);

  let userId: string;
  if (existing) {
    userId = existing.id;
    // Refresh password + confirm email so the user can sign in immediately
    const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || email.split("@")[0] },
    });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || "user create failed" }, { status: 500 });
    }
    userId = data.user.id;
  }

  // Ensure a clients row exists (idempotent)
  await supabaseAdmin.from("clients").upsert(
    {
      id: userId,
      email,
      full_name: fullName || email.split("@")[0],
      created_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  return NextResponse.json({ ok: true, id: userId });
}
