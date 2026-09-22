// Invite / reset link redemption: /vinnustod/virkja/<token>.
// GET ?token= → { name, email } if valid.   POST { token, password } → sets
// the password, clears the link, signs in and trusts the device.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, hashSecret, passwordProblem, sameOrigin, sha256, throttle } from "@/lib/hc/secrets";
import { startWsSession, trustWsDevice } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

async function byToken(token: string) {
  if (!token || token.length < 20) return null;
  const { data } = await supabaseAdmin
    .from("hc_workers")
    .select("id, name, email, active, invite_expires_at")
    .eq("invite_token_hash", sha256(token))
    .maybeSingle();
  if (!data?.active || !data.invite_expires_at || new Date(data.invite_expires_at).getTime() < Date.now()) return null;
  return data;
}

export async function GET(req: NextRequest) {
  const w = await byToken(req.nextUrl.searchParams.get("token") || "");
  if (!w) return NextResponse.json({ error: "Hlekkurinn er útrunninn eða ógildur." }, { status: 404 });
  return NextResponse.json({ name: w.name, email: w.email });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await throttle(`ws-activate:${clientIp(req)}`, 20, 900))) return NextResponse.json({ error: "Of margar tilraunir." }, { status: 429 });
  const { token, password } = await req.json().catch(() => ({}));
  const w = await byToken(String(token || ""));
  if (!w) return NextResponse.json({ error: "Hlekkurinn er útrunninn eða ógildur." }, { status: 404 });
  const problem = passwordProblem(String(password || ""));
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  await supabaseAdmin.from("hc_workers").update({
    password_hash: await hashSecret(String(password)),
    invite_token_hash: null,
    invite_expires_at: null,
    failed_logins: 0,
    locked_until: null,
  }).eq("id", w.id);
  const jar = await cookies();
  const ua = req.headers.get("user-agent") || "";
  await startWsSession(jar, w.id, "invite", ua);
  await trustWsDevice(jar, w.id, ua);
  return NextResponse.json({ ok: true });
}
