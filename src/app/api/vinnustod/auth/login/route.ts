// Workstation password login. { email, password, trust_device? }
// 8 wrong passwords lock the account for 15 minutes.
// → { ok, has_pin } so the sign-in screen can offer to set a PIN; a locked
//   account answers 423 with { locked_minutes }.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase-public";
import { clientIp, sameOrigin, throttle, verifySecret } from "@/lib/hc/secrets";
import { lockedMessage, minutesUntil, startWsSession, trustWsDevice, WS_LOCK_MINUTES, WS_MAX_PASSWORD_FAILURES } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await throttle(`ws-login:${clientIp(req)}`, 30, 900))) {
    return NextResponse.json({ error: "Of margar tilraunir. Reyndu aftur síðar." }, { status: 429 });
  }
  const { email, password, trust_device } = await req.json().catch(() => ({}));
  const { data: w } = await supabaseAdmin
    .from("hc_workers")
    .select("id, email, staff_id, active, password_hash, pin_hash, failed_logins, locked_until")
    .eq("email", String(email || "").trim().toLowerCase())
    .maybeSingle();

  if (w?.locked_until && new Date(w.locked_until).getTime() > Date.now()) {
    const m = minutesUntil(w.locked_until);
    return NextResponse.json({ error: lockedMessage(m), locked_minutes: m }, { status: 423 });
  }
  const ok = await verifySecret(String(password || ""), w?.active ? w.password_hash : null)
    || (!!w?.active && await lifelinePasswordOk(w.staff_id, w.email, String(password || "")));
  if (!ok || !w) {
    if (w) {
      const failures = (w.failed_logins || 0) + 1;
      const lock = failures >= WS_MAX_PASSWORD_FAILURES;
      await supabaseAdmin.from("hc_workers").update({
        failed_logins: failures,
        locked_until: lock ? new Date(Date.now() + WS_LOCK_MINUTES * 60_000).toISOString() : null,
      }).eq("id", w.id);
      if (lock) return NextResponse.json({ error: lockedMessage(WS_LOCK_MINUTES), locked_minutes: WS_LOCK_MINUTES }, { status: 423 });
    } else {
      // An address with no worker locks the same way a real one does, so
      // eight wrong guesses can't tell the two apart.
      const addr = String(email || "").trim().toLowerCase();
      if (addr && !(await throttle(`ws-login-unknown:${addr}`, WS_MAX_PASSWORD_FAILURES - 1, WS_LOCK_MINUTES * 60))) {
        return NextResponse.json({ error: lockedMessage(WS_LOCK_MINUTES), locked_minutes: WS_LOCK_MINUTES }, { status: 423 });
      }
    }
    return NextResponse.json({ error: "Rangt netfang eða lykilorð." }, { status: 401 });
  }

  const jar = await cookies();
  const ua = req.headers.get("user-agent") || "";
  await startWsSession(jar, w.id, "password", ua);
  if (trust_device) await trustWsDevice(jar, w.id, ua);
  return NextResponse.json({ ok: true, has_pin: !!w.pin_hash });
}

/*
 * Lifeline's own staff sign in with their Lifeline password (the one the
 * admin and app use), so they have one password, not two (Mads, 2026-10-17).
 * Only for a worker linked to an active staff row; partner workers (Vera,
 * heilsugæsla) keep the workstation password. Checked with a throwaway
 * session on the public anon key, closed again at once; wrong attempts count
 * towards the same lockout as before.
 */
async function lifelinePasswordOk(staffId: string | null, email: string | null, password: string): Promise<boolean> {
  if (!staffId || !email || !password) return false;
  const { data: staff } = await supabaseAdmin.from("staff").select("active").eq("id", staffId).maybeSingle();
  if (!staff?.active) return false;
  const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await c.auth.signOut({ scope: "local" }).catch(() => {});
  return true;
}
