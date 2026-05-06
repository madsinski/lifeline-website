// Browser-side Sentry init. Only boots when SENTRY_DSN is set, so no
// noise in local dev unless you explicitly configure it.
//
// Health data hygiene: same redaction policy as the server config —
// query strings stripped, request bodies cleared on health routes.

import * as Sentry from "@sentry/nextjs";

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

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",
    // Never ship PII.
    sendDefaultPii: false,
    // Drop self-resolving Supabase auth-lock chatter that fires when
    // a user has the app open in two tabs. Auth still works; the
    // message is informational. Hydration errors stay visible.
    ignoreErrors: [
      /Lock .* was released because another request stole it/,
      /Lock broken by another request with the 'steal' option/,
    ],
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

      // Fire-and-forget mirror to /api/errors/capture so the admin
      // panel can surface recent errors. Never blocks Sentry send.
      try {
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
        const url = typeof window !== "undefined" ? window.location.href : null;
        const pathname = typeof window !== "undefined" ? window.location.pathname : null;
        fetch("/api/errors/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            stack,
            url,
            pathname,
            runtime: "browser",
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            fingerprint: event.fingerprint?.[0] || null,
            level: event.level || "error",
          }),
          keepalive: true,
        }).catch(() => undefined);
      } catch { /* never block Sentry */ }

      return event;
    },
  });
}
