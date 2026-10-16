// Password re-check before a destructive admin action (DeleteConfirmModal,
// SlotsBulkDeleteModal). { password } → { ok: true } | 401/403/429.
//
// Why this exists: the modals used to call supabase.auth.signInWithPassword
// in the browser. That REPLACES the browser session with a fresh AAL1 one,
// so the delete that followed (and every AAL2-gated admin API after it)
// failed with mfa_required until the person stepped up again.
//
// Here the password is checked with a throwaway server-side client that has
// no storage, and that sign-in's session is revoked straight away (scope
// "local" = only that one session). The caller's browser session and its
// AAL2 level are never touched.
//
// Gate: a valid bearer token for active staff at AAL2. The email comes from
// the token, never from the request body, so this can only confirm the
// caller's own password. Throttled per user and per IP (same DB-backed
// counter as the other password routes) so it cannot be used as an oracle.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { aalFromToken } from "@/lib/auth-helpers";
import { clientIp, throttle } from "@/lib/hc/secrets";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
// Public anon key (same value the browser client ships with).
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmliZnh6bHR4aXJpcXh2dnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQxMDgsImV4cCI6MjA5MDQ1MDEwOH0.LHBADsUdW7SBtrxZ9KikTmAl5brBGPb3gFTMuPYrmD8";

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: auth } = await supabaseAdmin.auth.getUser(token);
  const user = auth.user;
  if (!user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (aalFromToken(token) !== "aal2") return NextResponse.json({ error: "mfa_required" }, { status: 403 });

  // Active staff, matched by id or by email (invited staff can have a
  // staff.id that differs from their auth id).
  const byId = await supabaseAdmin.from("staff").select("role").eq("id", user.id).eq("active", true).maybeSingle();
  const staff = byId.data
    ?? (await supabaseAdmin.from("staff").select("role").ilike("email", user.email).eq("active", true).maybeSingle()).data;
  if (!staff || staff.role === "lawyer" || staff.role === "medical_advisor") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!(await throttle(`admin-reauth:${user.id}`, 5, 900)) || !(await throttle(`admin-reauth-ip:${clientIp(req)}`, 20, 900))) {
    return NextResponse.json({ error: "Of margar tilraunir. Bíddu í korter og reyndu aftur." }, { status: 429 });
  }

  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Sláðu inn lykilorðið þitt." }, { status: 400 });
  }

  const probe = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: signIn, error } = await probe.auth.signInWithPassword({ email: user.email, password });
  if (error || !signIn.session) {
    return NextResponse.json({ error: "Rangt lykilorð." }, { status: 401 });
  }
  // Revoke only the probe session; "local" leaves every other session alone.
  try { await probe.auth.signOut({ scope: "local" }); } catch { /* best effort */ }

  return NextResponse.json({ ok: true });
}
