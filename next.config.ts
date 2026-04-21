import type { NextConfig } from "next";

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

export default nextConfig;
