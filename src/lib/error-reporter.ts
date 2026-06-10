// Server-side error reporter — drop-in replacement for the
// @sentry/nextjs captureException + captureMessage APIs that
// writes directly into public.app_errors via service role.
//
// We migrated off Sentry after the trial expired and the free
// Developer plan's 5K/mo quota started cutting off events. Our
// observability needs (admin/errors triage UI + email digest)
// were already served from app_errors anyway — Sentry was just
// the middleman.
//
// Call signature mirrors Sentry's so the existing call sites in
// API routes (e.g. Sentry.captureException(e, { tags: ... }))
// keep working with no code changes — just swap the import.

import { supabaseAdmin } from "./supabase-admin";

export type CaptureLevel = "error" | "warning" | "fatal" | "info";

interface CaptureOpts {
  tags?: Record<string, string>;
  contexts?: Record<string, Record<string, unknown>>;
  extra?: Record<string, unknown>;
  level?: CaptureLevel;
}

function flattenMetadata(opts: CaptureOpts): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  if (opts.tags) out.tags = opts.tags;
  if (opts.contexts) out.contexts = opts.contexts;
  if (opts.extra) out.extra = opts.extra;
  return Object.keys(out).length > 0 ? out : null;
}

// Same PII redaction the browser ingestion path (/api/errors/capture)
// applies: error messages can interpolate user data ("user X not
// found"), and app_errors must never hold kennitalas or emails.
function redact(s: string): string {
  return s
    .replace(/\b\d{6}-?\d{4}\b/g, "[kennitala-redacted]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[email-redacted]");
}

export async function captureException(err: unknown, opts: CaptureOpts = {}): Promise<void> {
  try {
    const error = err instanceof Error ? err : new Error(typeof err === "string" ? err : String(err));
    await supabaseAdmin.from("app_errors").insert({
      message: redact(error.message || "(no message)").slice(0, 2000),
      stack: error.stack ? redact(error.stack).slice(0, 8000) : null,
      runtime: "server",
      level: opts.level || "error",
      metadata: flattenMetadata(opts),
    });
  } catch { /* never throw from the reporter */ }
}

export async function captureMessage(message: string, opts: CaptureOpts = {}): Promise<void> {
  try {
    await supabaseAdmin.from("app_errors").insert({
      message: redact(message).slice(0, 2000),
      runtime: "server",
      level: opts.level || "warning",
      metadata: flattenMetadata(opts),
    });
  } catch { /* never throw from the reporter */ }
}

// No-op helpers so any leftover Sentry.X() calls don't crash if we
// missed one during the migration. Safe to remove later.
export function setUser(): void { /* no-op */ }
export function setTag(): void { /* no-op */ }
export function setContext(): void { /* no-op */ }
