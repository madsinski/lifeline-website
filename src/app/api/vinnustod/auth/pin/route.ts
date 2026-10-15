// Workstation PIN: GET → is this a trusted device (and whose)?
// POST { pin } → sign in on the trusted device.
// PUT { pin } → set/replace the PIN (signed-in worker; trusts this device).
// DELETE → forget this device ("Ekki <nafn>? Skrá inn sem annar").
//
// The PIN is per worker, not per device: one PIN on every trusted device.
// A password lockout (locked_until) blocks PIN sign-in too.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, hashSecret, pinProblem, sameOrigin, sha256, throttle, verifySecret } from "@/lib/hc/secrets";
import { getWorkerSession, lockedMessage, minutesUntil, startWsSession, trustWsDevice, WS_DEVICE_COOKIE, WS_MAX_PIN_FAILURES } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

async function deviceRow() {
  const jar = await cookies();
  const token = jar.get(WS_DEVICE_COOKIE)?.value;
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("hc_ws_devices")
    .select("id, worker_id, pin_failures, expires_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

export async function GET() {
  const d = await deviceRow();
  if (!d) return NextResponse.json({ trusted: false });
  const { data: w } = await supabaseAdmin.from("hc_workers").select("name, pin_hash, active").eq("id", d.worker_id).maybeSingle();
  if (!w?.active || !w.pin_hash) return NextResponse.json({ trusted: false });
  return NextResponse.json({ trusted: true, name: w.name });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await throttle(`ws-pin:${clientIp(req)}`, 30, 900))) return NextResponse.json({ error: "Of margar tilraunir. Reyndu aftur síðar." }, { status: 429 });
  const d = await deviceRow();
  if (!d) return NextResponse.json({ error: "Þetta tæki er ekki lengur munað. Skráðu þig inn með lykilorði.", locked: true }, { status: 401 });
  const { pin } = await req.json().catch(() => ({}));
  const { data: w } = await supabaseAdmin.from("hc_workers").select("id, pin_hash, active, locked_until").eq("id", d.worker_id).maybeSingle();
  if (w?.locked_until && new Date(w.locked_until).getTime() > Date.now()) {
    const m = minutesUntil(w.locked_until);
    return NextResponse.json({ error: lockedMessage(m), locked_minutes: m }, { status: 423 });
  }
  const ok = await verifySecret(String(pin || ""), w?.active ? w.pin_hash : null);
  const jar = await cookies();
  if (!ok || !w) {
    const failures = d.pin_failures + 1;
    if (failures >= WS_MAX_PIN_FAILURES) {
      await supabaseAdmin.from("hc_ws_devices").delete().eq("id", d.id);
      jar.delete(WS_DEVICE_COOKIE);
      return NextResponse.json({ error: "Of oft rangt PIN-númer. Skráðu þig inn með lykilorði.", locked: true }, { status: 401 });
    }
    await supabaseAdmin.from("hc_ws_devices").update({ pin_failures: failures }).eq("id", d.id);
    const left = WS_MAX_PIN_FAILURES - failures;
    return NextResponse.json({ error: `Rangt PIN-númer. ${left} ${left === 1 ? "tilraun" : "tilraunir"} eftir.`, attempts_left: left }, { status: 401 });
  }
  await supabaseAdmin.from("hc_ws_devices").update({ pin_failures: 0, last_used_at: new Date().toISOString() }).eq("id", d.id);
  await startWsSession(jar, w.id, "pin", req.headers.get("user-agent") || "");
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const me = await getWorkerSession();
  if (!me) return NextResponse.json({ error: "Lotan rann út. Skráðu þig inn aftur." }, { status: 401 });
  const { pin } = await req.json().catch(() => ({}));
  const problem = pinProblem(String(pin || ""));
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  await supabaseAdmin.from("hc_workers").update({ pin_hash: await hashSecret(String(pin)) }).eq("id", me.id);
  await trustWsDevice(await cookies(), me.id, req.headers.get("user-agent") || "");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const jar = await cookies();
  const token = jar.get(WS_DEVICE_COOKIE)?.value;
  if (token) await supabaseAdmin.from("hc_ws_devices").delete().eq("token_hash", sha256(token));
  jar.delete(WS_DEVICE_COOKIE);
  return NextResponse.json({ ok: true });
}
