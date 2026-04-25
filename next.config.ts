import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Ensure the Noto Sans TTFs used by the server-side PDF renderer are
  // traced into the Vercel function bundle (not just served from /public).
  outputFileTracingIncludes: {
    "/api/business/companies/*/sign": [
      "./public/fonts/NotoSans-Regular.ttf",
      "./public/fonts/NotoSans-Bold.ttf",
    ],
    "/api/platform/accept-terms": [
      "./public/fonts/NotoSans-Regular.ttf",
      "./public/fonts/NotoSans-Bold.ttf",
    ],
    "/api/business/onboard/*/complete": [
      "./public/fonts/NotoSans-Regular.ttf",
      "./public/fonts/NotoSans-Bold.ttf",
    ],
  },
};

// Wrap with Sentry. This is what bundles instrumentation-client.ts
// into the browser build and (optionally) uploads source maps.
// Without this wrapper, none of the Sentry init runs in the browser
// and `typeof Sentry === 'undefined'` in DevTools — which is exactly
// what we hit before this commit.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Don't fail the build if source-map upload fails — the runtime
  // SDK still works fine without uploaded source maps.
  errorHandler: (err: Error) => {
    console.warn("[sentry build]", err.message);
  },
  telemetry: false,
});
