// 4-digit PIN for quicker sign-in on a trusted device (same design as the
// Fjarlækningar HSU PIN). The PIN only works together with the httpOnly
// device cookie set here — on a new device the person signs in with their
// password again.
//
// GET              → { enabled, email_hint } for this device (no auth; cookie)
// POST { pin }     → set up the PIN on this device (Bearer)
// DELETE           → remove PIN from all devices (Bearer)
// Schema: supabase/migration-health-journey.sql (account_pin_devices)

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { hashSecret, isProd, newToken, pinProblem, sameOrigin, sha256 } from "@/lib/hc/secrets";

export const runtime = "nodejs";

const PIN_DEVICE_COOKIE = "ll_pin_device";
const DEVICE_DAYS = 180;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export async function GET() {
  const jar = await cookies();
  const token = jar.get(PIN_DEVICE_COOKIE)?.value;
  if (!token) return NextResponse.json({ enabled: false });
  const { data } = await supabaseAdmin
    .from("account_pin_devices")
    .select("user_id, expires_at")
    .eq("device_hash", sha256(token))
    .maybeSingle();
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return NextResponse.json({ enabled: false });
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
  return NextResponse.json({ enabled: true, email_hint: u?.user?.email ? maskEmail(u.user.email) : null });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { pin } = await req.json().catch(() => ({}));
  const problem = pinProblem(String(pin || ""));
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const jar = await cookies();
  const old = jar.get(PIN_DEVICE_COOKIE)?.value;
  if (old) await supabaseAdmin.from("account_pin_devices").delete().eq("device_hash", sha256(old));

  const token = newToken();
  const expires = new Date(Date.now() + DEVICE_DAYS * 86400_000);
  const { error } = await supabaseAdmin.from("account_pin_devices").insert({
    user_id: user.id,
    device_hash: sha256(token),
    pin_hash: await hashSecret(String(pin)),
    user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
    expires_at: expires.toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  jar.set(PIN_DEVICE_COOKIE, token, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", expires });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await supabaseAdmin.from("account_pin_devices").delete().eq("user_id", user.id);
  (await cookies()).delete(PIN_DEVICE_COOKIE);
  return NextResponse.json({ ok: true });
}
