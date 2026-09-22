// PIN sign-in. Verifies the PIN against this device's row, then mints a
// one-time Supabase magic-link token (admin.generateLink — nothing is
// emailed) which the browser exchanges with supabase.auth.verifyOtp for a
// normal session. 5 wrong PINs remove the device: password login required.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, sameOrigin, sha256, throttle, verifySecret } from "@/lib/hc/secrets";

export const runtime = "nodejs";

const PIN_DEVICE_COOKIE = "ll_pin_device";
const MAX_PIN_FAILURES = 5;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await throttle(`pin:${clientIp(req)}`, 20, 900))) {
    return NextResponse.json({ error: "Of margar tilraunir. Reyndu aftur eftir smá stund." }, { status: 429 });
  }
  const jar = await cookies();
  const token = jar.get(PIN_DEVICE_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "no_device" }, { status: 401 });
  const { pin } = await req.json().catch(() => ({}));

  const { data: device } = await supabaseAdmin
    .from("account_pin_devices")
    .select("id, user_id, pin_hash, pin_failures, expires_at")
    .eq("device_hash", sha256(token))
    .maybeSingle();
  if (!device || new Date(device.expires_at).getTime() < Date.now()) {
    jar.delete(PIN_DEVICE_COOKIE);
    return NextResponse.json({ error: "no_device" }, { status: 401 });
  }

  const ok = await verifySecret(String(pin || ""), device.pin_hash);
  if (!ok) {
    const failures = device.pin_failures + 1;
    if (failures >= MAX_PIN_FAILURES) {
      await supabaseAdmin.from("account_pin_devices").delete().eq("id", device.id);
      jar.delete(PIN_DEVICE_COOKIE);
      return NextResponse.json({ error: "PIN var rangur of oft. Skráðu þig inn með lykilorði.", locked: true }, { status: 401 });
    }
    await supabaseAdmin.from("account_pin_devices").update({ pin_failures: failures }).eq("id", device.id);
    return NextResponse.json({ error: `Rangur PIN. ${MAX_PIN_FAILURES - failures} tilraunir eftir.` }, { status: 401 });
  }

  const { data: u } = await supabaseAdmin.auth.admin.getUserById(device.user_id);
  const email = u?.user?.email;
  if (!email) return NextResponse.json({ error: "no_user" }, { status: 401 });
  const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link?.properties?.hashed_token) return NextResponse.json({ error: "link_failed" }, { status: 500 });

  await supabaseAdmin
    .from("account_pin_devices")
    .update({ pin_failures: 0, last_used_at: new Date().toISOString() })
    .eq("id", device.id);
  return NextResponse.json({ token_hash: link.properties.hashed_token, email });
}
