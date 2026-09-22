// scrypt hashing, tokens, throttling and CSRF checks shared by the account
// PIN login and the nurse workstation. Ported from
// Fjarlaekningar/src/lib/hsu/auth.ts. Server-only.

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

function scrypt(secret: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(secret, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

const N = 16384, R = 8, P = 1, KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(secret, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifySecret(secret: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // Same time spent whether or not the account exists.
    await scrypt(secret || "x", randomBytes(16), KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
    return false;
  }
  const [alg, n, r, p, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(keyB64, "base64url");
  const got = await scrypt(secret, Buffer.from(saltB64, "base64url"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
  });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function pinProblem(pin: string): string | null {
  if (!/^\d{4}$/.test(pin || "")) return "PIN þarf að vera fjórir tölustafir.";
  if (/^(\d)\1{3}$/.test(pin) || ["1234", "4321", "0123", "9876"].includes(pin)) return "Veldu PIN sem er ekki augljós.";
  return null;
}

export function passwordProblem(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < 10) return "Lykilorð þarf að vera minnst 10 stafir.";
  if (pw.length > 200) return "Lykilorðið er of langt.";
  if (!/[A-Za-zÁÐÉÍÓÚÝÞÆÖáðéíóúýþæö]/.test(pw) || !/[0-9]/.test(pw)) return "Lykilorð þarf að innihalda bæði bókstafi og tölustafi.";
  return null;
}

/** CSRF: cookie-authenticated mutations must come from this same site. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

/** Records an attempt and says whether it's within limits. Counted in the DB (serverless instances are many). */
export async function throttle(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("account_auth_throttle")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .gte("at", since);
  if ((count ?? 0) >= limit) return false;
  await supabaseAdmin.from("account_auth_throttle").insert({ key });
  if (Math.random() < 0.02) {
    void supabaseAdmin.from("account_auth_throttle").delete().lt("at", new Date(Date.now() - 86400_000).toISOString()).then(() => {});
  }
  return true;
}

export const isProd = process.env.NODE_ENV === "production";
