// Workstation password login. { email, password, trust_device? }
// 8 wrong passwords lock the account for 15 minutes.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, sameOrigin, throttle, verifySecret } from "@/lib/hc/secrets";
import { startWsSession, trustWsDevice, WS_LOCK_MINUTES, WS_MAX_PASSWORD_FAILURES } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await throttle(`ws-login:${clientIp(req)}`, 30, 900))) {
    return NextResponse.json({ error: "Of margar tilraunir. Reyndu aftur síðar." }, { status: 429 });
  }
  const { email, password, trust_device } = await req.json().catch(() => ({}));
  const { data: w } = await supabaseAdmin
    .from("hc_workers")
    .select("id, active, password_hash, failed_logins, locked_until")
    .eq("email", String(email || "").trim().toLowerCase())
    .maybeSingle();

  if (w?.locked_until && new Date(w.locked_until).getTime() > Date.now()) {
    return NextResponse.json({ error: `Aðgangi læst tímabundið. Reyndu aftur eftir ${WS_LOCK_MINUTES} mínútur.` }, { status: 423 });
  }
  const ok = await verifySecret(String(password || ""), w?.active ? w.password_hash : null);
  if (!ok || !w) {
    if (w) {
      const failures = (w.failed_logins || 0) + 1;
      await supabaseAdmin.from("hc_workers").update({
        failed_logins: failures,
        locked_until: failures >= WS_MAX_PASSWORD_FAILURES ? new Date(Date.now() + WS_LOCK_MINUTES * 60_000).toISOString() : null,
      }).eq("id", w.id);
    }
    return NextResponse.json({ error: "Rangt netfang eða lykilorð." }, { status: 401 });
  }

  const jar = await cookies();
  const ua = req.headers.get("user-agent") || "";
  await startWsSession(jar, w.id, "password", ua);
  if (trust_device) await trustWsDevice(jar, w.id, ua);
  return NextResponse.json({ ok: true });
}
