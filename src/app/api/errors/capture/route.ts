// Mirror error events from Sentry into our own app_errors table so
// the admin panel can show them and Claude can query them by SQL when
// asked to investigate.
//
// Called by the Sentry beforeSend hook (both browser + server) as
// fire-and-forget. If this endpoint fails, Sentry still gets the event
// — the local mirror is purely for admin convenience.
//
// Auth: none. We trust the payload because:
//  - It's only used to populate a triage view that the admin reviews
//    manually anyway
//  - Spam is not a meaningful threat — we'd just delete the rows
//  - Sentry remains the source of truth for real error counts
// We DO redact obvious PII before storing (kennitalas, emails in
// stack traces, request bodies).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

interface CaptureBody {
  message?: string;
  stack?: string;
  url?: string;
  pathname?: string;
  runtime?: "browser" | "server" | "edge";
  user_agent?: string;
  user_id?: string;
  user_email?: string;
  fingerprint?: string;
  level?: "error" | "warning" | "fatal" | "info";
  metadata?: Record<string, unknown>;
}

// Strip kennitalas (10-digit Icelandic SSN) and email addresses from
// arbitrary text — these can leak into error messages / stack traces.
function redact(s: string | undefined | null): string | undefined {
  if (!s) return undefined;
  return s
    .replace(/\b\d{6}-?\d{4}\b/g, "[kennitala-redacted]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[email-redacted]");
}

export async function POST(req: Request) {
  let body: CaptureBody = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.message) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Truncate large fields defensively.
  const trunc = (s: string | undefined, n: number) => s ? s.slice(0, n) : null;

  await supabaseAdmin.from("app_errors").insert({
    message: trunc(redact(body.message), 2000),
    stack: trunc(redact(body.stack), 8000),
    url: trunc(body.url, 1000),
    pathname: trunc(body.pathname, 500),
    runtime: body.runtime || null,
    user_agent: trunc(body.user_agent, 500),
    user_id: body.user_id || null,
    user_email: body.user_email ? trunc(redact(body.user_email), 200) : null,
    fingerprint: trunc(body.fingerprint, 200),
    level: body.level || "error",
    metadata: body.metadata || null,
  });

  return NextResponse.json({ ok: true });
}
