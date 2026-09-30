// Installable web app for participants: "Add to home screen" opens the
// heilsuferð "Í dag" screen directly (the daily plan), full screen.

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lifeline Health – heilsuferðin mín",
    short_name: "Lifeline",
    description: "Áætlunin þín, dagurinn í dag og næsti tími hjá Lifeline Health.",
    lang: "is",
    start_url: "/account/heilsuferd/aaetlun?tab=today",
    scope: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#10B981",
    icons: [
      { src: "/heilsuferd-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/heilsuferd-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/heilsuferd-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
