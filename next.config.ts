import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next/image quality whitelist (Next 16 defaults to [75] only). 90 is used
  // by the app-mockup screenshots (StaticPhone) so their UI text stays crisp.
  images: {
    qualities: [75, 90],
    // Allow next/image to load uploaded assets from Supabase Storage (the CMS
    // mockup screenshots are cropped + uploaded to the presentation-assets
    // bucket, then rendered via <Image> in StaticPhone/StaticLaptop).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cfnibfxzltxiriqxvvru.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
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

// Migrated off @sentry/nextjs after the trial expired and the free
// plan's 5K/mo quota started cutting events off. Error capture now
// happens directly via instrumentation-client.ts (browser) +
// instrumentation.ts onRequestError (server) writing to
// public.app_errors. /admin/errors triages from there.
export default nextConfig;
