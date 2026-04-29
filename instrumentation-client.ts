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
    beforeSend(event) {
      const req = event.request;
      if (req?.query_string) req.query_string = "[redacted]";
      if (req?.url && HEALTH_ROUTE_PREFIXES.some((p) => req.url!.includes(p))) {
        if (req.data) req.data = "[redacted: health route]";
        if (req.headers) {
          delete (req.headers as Record<string, unknown>).authorization;
          delete (req.headers as Record<string, unknown>).cookie;
        }
      }
      return event;
    },
  });
}
