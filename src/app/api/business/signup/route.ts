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

  // Security: refuse to silently overwrite an existing account's password.
  // Paginate all users (listUsers caps at 200 per page).
  let existing: { id: string; email: string | null } | null = null;
  let page = 1;
  // Cap iterations — listUsers returns {users, aud, nextPage, lastPage} shape varies
  // by SDK version; defensive cap.
  while (page < 50) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (!data?.users?.length) break;
    const match = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (match) { existing = { id: match.id, email: match.email || null }; break; }
    if (data.users.length < 200) break;
    page++;
  }

  if (existing) {
    return NextResponse.json({
      error: "email_already_registered",
      detail: "This email already has a Lifeline account. Please sign in instead.",
    }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || email.split("@")[0] },
  });
  if (error || !data.user) {
    return NextResponse.json({ error: "signup_failed" }, { status: 500 });
  }
  const userId = data.user.id;

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
