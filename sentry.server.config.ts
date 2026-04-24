// Server-side Sentry init (Node runtime in Next.js routes).

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV || "development",
    sendDefaultPii: false,
  });
}
