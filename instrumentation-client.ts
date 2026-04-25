// Browser-side Sentry init. Only boots when SENTRY_DSN is set, so no
// noise in local dev unless you explicitly configure it.

import * as Sentry from "@sentry/nextjs";

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
  });
}
