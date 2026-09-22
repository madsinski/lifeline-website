// Lifeline workstation (/vinnustod) auth for nurses and doctors — Lifeline's
// own and partners' (Vera). Same design as the Fjarlækningar HSU/vinnustöð:
// own tables (hc_workers / hc_ws_sessions / hc_ws_devices), httpOnly
// cookies, password + 4-digit PIN on a trusted device.
//
// Deliberately NOT Supabase Auth: partner nurses must never become
// auth.users in the Lifeline project, and they get no /admin access at all.
// Server-only.

import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { aalFromToken } from "@/lib/auth-helpers";
import { isProd, newToken, sha256 } from "./secrets";

export const WS_SESSION_COOKIE = "llws_session";
export const WS_DEVICE_COOKIE = "llws_device";
export const WS_SESSION_HOURS = 12;
export const WS_DEVICE_DAYS = 90;
export const WS_MAX_PASSWORD_FAILURES = 8;
export const WS_LOCK_MINUTES = 15;
export const WS_MAX_PIN_FAILURES = 5;
export const WS_INVITE_DAYS = 14;

// Method syntax on purpose: bivariant parameters, so Next's cookies() store
// (with its overloaded set) is assignable.
export interface CookieJar {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, opts: Record<string, unknown>): unknown;
  delete(name: string): unknown;
}

export interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  organization: "lifeline" | "vera" | "heilsugaesla";
  role: "nurse" | "doctor" | "admin";
  location_ids: string[];
  has_pin: boolean;
}

export async function startWsSession(jar: CookieJar, workerId: string, method: "password" | "pin" | "invite", userAgent: string) {
  const token = newToken();
  const expires = new Date(Date.now() + WS_SESSION_HOURS * 3600_000);
  await supabaseAdmin.from("hc_ws_sessions").insert({
    worker_id: workerId,
    token_hash: sha256(token),
    method,
    user_agent: userAgent.slice(0, 300),
    expires_at: expires.toISOString(),
  });
  await supabaseAdmin
    .from("hc_workers")
    .update({ last_login_at: new Date().toISOString(), failed_logins: 0, locked_until: null })
    .eq("id", workerId);
  jar.set(WS_SESSION_COOKIE, token, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", expires });
}

export async function trustWsDevice(jar: CookieJar, workerId: string, userAgent: string) {
  const expires = new Date(Date.now() + WS_DEVICE_DAYS * 86400_000);
  const existing = jar.get(WS_DEVICE_COOKIE)?.value;
  if (existing) {
    const { data } = await supabaseAdmin
      .from("hc_ws_devices")
      .update({ expires_at: expires.toISOString(), last_used_at: new Date().toISOString(), pin_failures: 0 })
      .eq("token_hash", sha256(existing))
      .eq("worker_id", workerId)
      .select("id");
    if (data?.length) {
      jar.set(WS_DEVICE_COOKIE, existing, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", expires });
      return;
    }
  }
  const token = newToken();
  await supabaseAdmin.from("hc_ws_devices").insert({
    worker_id: workerId,
    token_hash: sha256(token),
    user_agent: userAgent.slice(0, 300),
    expires_at: expires.toISOString(),
  });
  jar.set(WS_DEVICE_COOKIE, token, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", expires });
}

const WORKER_COLS = "id, name, email, phone, organization, role, location_ids, active, pin_hash";

function toWorker(d: Record<string, unknown>): Worker {
  return {
    id: d.id as string,
    name: d.name as string,
    email: d.email as string,
    phone: (d.phone as string) ?? null,
    organization: d.organization as Worker["organization"],
    role: d.role as Worker["role"],
    location_ids: (d.location_ids as string[]) ?? [],
    has_pin: Boolean(d.pin_hash),
  };
}

export async function getWorkerSession(): Promise<Worker | null> {
  const jar = await cookies();
  const token = jar.get(WS_SESSION_COOKIE)?.value;
  if (!token || token.length < 20) return null;
  const { data: s } = await supabaseAdmin
    .from("hc_ws_sessions")
    .select("id, worker_id, expires_at, last_seen_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!s || new Date(s.expires_at).getTime() < Date.now()) return null;
  const { data: d } = await supabaseAdmin.from("hc_workers").select(WORKER_COLS).eq("id", s.worker_id).maybeSingle();
  if (!d || !d.active) return null;
  if (Date.now() - new Date(s.last_seen_at).getTime() > 300_000) {
    void supabaseAdmin.from("hc_ws_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", s.id).then(() => {});
  }
  return toWorker(d);
}

export async function endWsSession(jar: CookieJar) {
  const token = jar.get(WS_SESSION_COOKIE)?.value;
  if (token) await supabaseAdmin.from("hc_ws_sessions").delete().eq("token_hash", sha256(token));
  jar.delete(WS_SESSION_COOKIE);
}

/** One-time activation/reset link. Only the SHA-256 is stored. */
export async function issueWorkerLink(workerId: string, kind: "invite" | "reset", origin: string): Promise<string> {
  const token = newToken();
  const hours = kind === "invite" ? WS_INVITE_DAYS * 24 : 2;
  const patch: Record<string, unknown> = {
    invite_token_hash: sha256(token),
    invite_expires_at: new Date(Date.now() + hours * 3600_000).toISOString(),
  };
  if (kind === "invite") patch.invited_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from("hc_workers").update(patch).eq("id", workerId);
  if (error) throw new Error(error.message);
  return `${origin}/vinnustod/virkja/${token}`;
}

/**
 * Who is acting on a plan or journey: a workstation worker (cookie) or a
 * Lifeline staff member from /admin (Bearer token, write role + AAL2).
 */
export type HcActor =
  | { kind: "worker"; worker: Worker; label: string; isDoctor: boolean }
  | { kind: "staff"; staffId: string; label: string; isDoctor: boolean };

export async function getHcActor(req: Request): Promise<HcActor | null> {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (data.user?.id) {
      const { data: staff } = await supabaseAdmin
        .from("staff")
        .select("id, name, role, active")
        .eq("id", data.user.id)
        .maybeSingle();
      if (staff?.active && staff.role !== "lawyer" && staff.role !== "medical_advisor" && aalFromToken(token) === "aal2") {
        return { kind: "staff", staffId: staff.id, label: `${staff.name ?? data.user.email} (Lifeline)`, isDoctor: staff.role === "doctor" || staff.role === "admin" };
      }
    }
  }
  const worker = await getWorkerSession();
  if (worker) return { kind: "worker", worker, label: `${worker.name} (${worker.organization})`, isDoctor: worker.role === "doctor" || worker.role === "admin" };
  return null;
}

/** A worker only sees journeys at their own locations; staff and worker-admins see all. */
export function actorLocationFilter(actor: HcActor): string[] | null {
  if (actor.kind === "staff") return null;
  if (actor.worker.role === "admin") return null;
  // Lifeline's own staff with no locations set cover every site; a partner
  // (Vera, heilsugæsla) with none set sees nothing until one is assigned.
  if (actor.worker.location_ids.length === 0) return actor.worker.organization === "lifeline" ? null : [];
  return actor.worker.location_ids;
}
