// Server-side Sentry init (Node runtime in Next.js routes).
//
// Health data hygiene: sendDefaultPii=false strips IPs, cookies, and
// user identifiers. The beforeSend hook additionally redacts request
// query strings (which can carry client_id) and clears request body
// payloads on routes that touch health data, so a bug in those routes
// can never leak Art. 9 content into Sentry.

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";

const HEALTH_ROUTE_PREFIXES = [
  "/api/admin/clients",
  "/api/admin/messages",
  "/api/admin/conversations",
  "/api/admin/biody",
  "/api/biody",
  "/api/messages",
  "/api/conversations",
  "/api/account/body-comp",
  "/api/account/weight",
];

// Direct supabase admin client for the error mirror — using the Proxy
// supabaseAdmin from src/lib could pull React/server-only code into the
// Sentry init bundle, which Sentry's instrumentation chokes on.
function mirrorAdmin() {
  const url = process.env.SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    // 30% of traces — bumped from 10% so onboarding / signup paths
    // produce enough span data to debug slowness without exploding
    // the Sentry quota. Errors are unaffected (sampled 100% by
    // default).
    tracesSampleRate: 0.3,
    environment: process.env.VERCEL_ENV || "development",
    sendDefaultPii: false,
    beforeSend(event, hint) {
      const req = event.request;
      if (req?.query_string) req.query_string = "[redacted]";
      if (req?.url && HEALTH_ROUTE_PREFIXES.some((p) => req.url!.includes(p))) {
        if (req.data) req.data = "[redacted: health route]";
        if (req.headers) {
          delete (req.headers as Record<string, unknown>).authorization;
          delete (req.headers as Record<string, unknown>).cookie;
        }
      }

      // Fire-and-forget mirror to public.app_errors so the admin panel
      // can show recent errors. Never block the actual Sentry send.
      try {
        const admin = mirrorAdmin();
        if (admin) {
          const err = (hint?.originalException as Error | undefined) || null;
          const message =
            event.message ||
            err?.message ||
            event.exception?.values?.[0]?.value ||
            "(no message)";
          const stack =
            err?.stack ||
            event.exception?.values?.[0]?.stacktrace?.frames
              ?.map((f) => `${f.filename || ""}:${f.lineno || ""}:${f.colno || ""} ${f.function || ""}`)
              .join("\n") ||
            null;
          let pathname: string | null = null;
          try { if (req?.url) pathname = new URL(req.url).pathname; } catch {}
          admin.from("app_errors").insert({
            message: message.slice(0, 2000),
            stack: stack ? stack.slice(0, 8000) : null,
            url: req?.url ? String(req.url).slice(0, 1000) : null,
            pathname,
            runtime: "server",
            user_agent: typeof req?.headers === "object" && req.headers
              ? ((req.headers as Record<string, string>)["user-agent"] || null)
              : null,
            fingerprint: event.fingerprint?.[0] || null,
            level: event.level || "error",
          }).then(() => undefined, () => undefined);
        }
      } catch { /* never block Sentry */ }

      return event;
    },
  });
}
