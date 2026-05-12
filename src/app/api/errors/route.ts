// POST /api/errors
//
// Authenticated error-capture endpoint for the RN app (and any
// future first-party client). Writes a row to public.app_errors
// via service role with runtime='mobile' so /admin/errors shows
// app-side errors alongside server + browser ones.
//
// Auth: requires a Supabase user JWT. user_id + user_email are
// stamped server-side from the token so callers can't forge them.
//
// Rate limit: 30 errors per minute per user. Anything over that
// gets dropped silently — error spam shouldn't DOS the table.
//
// Safety: message + stack are truncated to bounded lengths. The
// metadata blob is rejected if it's larger than 8KB to keep the
// table reasonable.

import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 10;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

// Module-scoped sliding-window counter keyed by user id. Memory
// resets on every cold start which is fine — bursty errors during
// a single function instance are what we want to suppress.
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional().nullable(),
  // Mobile-specific path / route name the error fired on.
  pathname: z.string().max(500).optional().nullable(),
  // App version + platform — populated client-side from app.config.
  user_agent: z.string().max(500).optional().nullable(),
  fingerprint: z.string().max(200).optional().nullable(),
  level: z.enum(["error", "warning", "fatal", "info"]).optional(),
  // Free-form context bag. Capped at ~8KB serialised.
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

function authToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: `Invalid body: ${parsed.error.message}` }, { status: 400 });
  }

  const token = authToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  if (!userData.user) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  const user = userData.user;

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded", rate_limited: true }, { status: 429 });
  }

  // Metadata size guard so the JSONB blob doesn't blow up the row.
  const metadataStr = parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null;
  if (metadataStr && metadataStr.length > 8000) {
    return NextResponse.json({ ok: false, error: "metadata too large (>8KB)" }, { status: 400 });
  }

  const { error: insertErr } = await supabaseAdmin.from("app_errors").insert({
    message: parsed.data.message,
    stack: parsed.data.stack || null,
    pathname: parsed.data.pathname || null,
    runtime: "mobile",
    user_agent: parsed.data.user_agent || null,
    user_id: user.id,
    user_email: user.email || null,
    fingerprint: parsed.data.fingerprint || null,
    level: parsed.data.level || "error",
    metadata: parsed.data.metadata || null,
  });

  if (insertErr) {
    return NextResponse.json({ ok: false, error: `Insert failed: ${insertErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
