// Server-side Sentry init (Node runtime in Next.js routes).
//
// Health data hygiene: sendDefaultPii=false strips IPs, cookies, and
// user identifiers. The beforeSend hook additionally redacts request
// query strings (which can carry client_id) and clears request body
// payloads on routes that touch health data, so a bug in those routes
// can never leak Art. 9 content into Sentry.

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

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV || "development",
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
