// Invite / reset link redemption: /vinnustod/virkja/<token>.
// GET ?token= → { name, email, kind } if valid. kind is "reset" when the
//   worker already has a password (forgotten password, or an admin re-sent
//   a link), else "invite".
// POST { token, password } → sets the password, clears the link, signs the
//   worker out everywhere else (old sessions and trusted devices are
//   revoked — whoever had the old password must not keep a way in), then
//   signs in and trusts this device.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, hashSecret, passwordProblem, sameOrigin, sha256, throttle } from "@/lib/hc/secrets";
import { revokeWorkerAccess, startWsSession, trustWsDevice } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

const EXPIRED = "Hlekkurinn er útrunninn eða hefur þegar verið notaður.";

async function byToken(token: string) {
  if (!token || token.length < 20) return null;
  const { data } = await supabaseAdmin
    .from("hc_workers")
    .select("id, name, email, active, invite_expires_at, password_hash, pin_hash")
    .eq("invite_token_hash", sha256(token))
    .maybeSingle();
  if (!data?.active || !data.invite_expires_at || new Date(data.invite_expires_at).getTime() < Date.now()) return null;
  return data;
}

export async function GET(req: NextRequest) {
  const w = await byToken(req.nextUrl.searchParams.get("token") || "");
  if (!w) return NextResponse.json({ error: EXPIRED }, { status: 404 });
  return NextResponse.json({ name: w.name, email: w.email, kind: w.password_hash ? "reset" : "invite" });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await throttle(`ws-activate:${clientIp(req)}`, 20, 900))) return NextResponse.json({ error: "Of margar tilraunir. Reyndu aftur síðar." }, { status: 429 });
  const { token, password } = await req.json().catch(() => ({}));
  const w = await byToken(String(token || ""));
  if (!w) return NextResponse.json({ error: EXPIRED }, { status: 404 });
  const problem = passwordProblem(String(password || ""));
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  await supabaseAdmin.from("hc_workers").update({
    password_hash: await hashSecret(String(password)),
    invite_token_hash: null,
    invite_expires_at: null,
    failed_logins: 0,
    locked_until: null,
  }).eq("id", w.id);
  await revokeWorkerAccess(w.id);
  const jar = await cookies();
  const ua = req.headers.get("user-agent") || "";
  await startWsSession(jar, w.id, "invite", ua);
  await trustWsDevice(jar, w.id, ua);
  return NextResponse.json({ ok: true, has_pin: !!w.pin_hash });
}
