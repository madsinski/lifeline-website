// Curated catalogue of imagery already shipped in /public, offered in the
// image picker's "Existing" tab. URLs are site-absolute so they resolve in
// both the admin preview and the public /present route.
export interface ExistingImage {
  url: string;
  label: string;
  category: "Backgrounds" | "Editorial" | "Team" | "App screenshots";
}

// Full-slide cover artwork. These are complete 16:9 lockups (logos, event
// title, date baked in), so they are offered as named presets on the
// full-bleed image field rather than left to be found by eye in the picker.
export const COVER_PRESETS: { value: string; label: string }[] = [
  { value: "/presentation-images/nyskopunardagur-intro.svg", label: "Nýsköpunardagur — dökk" },
  { value: "/presentation-images/nyskopunardagur-intro-light.svg", label: "Nýsköpunardagur — ljós" },
  { value: "/presentation-images/nyskopunardagur-intro-soft.svg", label: "Nýsköpunardagur — ljósgrá" },
  // The hringrás diagram is a full-slide artwork too, and it lives on a
  // full-bleed slide alongside these — without it in the list, picking a
  // lockup by mistake left no way back to the diagram.
  { value: "/presentation-images/hringras-hsu-lifeline.svg", label: "Hringrás — HSU × Lifeline" },
];

export const EXISTING_IMAGES: ExistingImage[] = [
  // Full-slide covers
  { url: "/presentation-images/nyskopunardagur-intro.svg", label: "Nýsköpunardagur lockup (dark)", category: "Backgrounds" },
  { url: "/presentation-images/nyskopunardagur-intro-light.svg", label: "Nýsköpunardagur lockup (light)", category: "Backgrounds" },
  { url: "/presentation-images/nyskopunardagur-intro-soft.svg", label: "Nýsköpunardagur lockup (soft light)", category: "Backgrounds" },
  { url: "/presentation-images/hringras-hsu-lifeline.svg", label: "Hringrás — HSU × Lifeline (skýringarmynd)", category: "Backgrounds" },
  { url: "/presentation-images/heilsuskyrsla-svefn-is.svg", label: "Heilsuskýrsla — svefn (íslensk)", category: "App screenshots" },

  // Backgrounds (landscape)
  { url: "/presentation-images/eyjar-running.png", label: "Community run (Vestmannaeyjar)", category: "Backgrounds" },
  { url: "/presentation-images/banner.png", label: "Vestmannaeyjar aerial", category: "Backgrounds" },

  // Editorial / clinical (portrait-ish)
  { url: "/presentation-images/health-report.jpg", label: "Health check report (screenshot)", category: "App screenshots" },
  { url: "/presentation-images/victor-clinic-bw.jpg", label: "Physician on clinic floor (b&w)", category: "Editorial" },
  { url: "/presentation-images/victor-surgery.jpg", label: "In the clinic", category: "Editorial" },
  { url: "/presentation-images/victor-fjarlaekningar.jpg", label: "Telemedicine", category: "Editorial" },
  { url: "/presentation-images/victor-family.jpg", label: "Family", category: "Editorial" },

  // Team headshots
  { url: "/team/victor.png", label: "Victor Guðmundsson", category: "Team" },
  { url: "/team/mads.png", label: "Mads C. Aanesen", category: "Team" },
  { url: "/team/vignir.png", label: "Vignir Sigurðsson", category: "Team" },
  { url: "/team/dagbjort.png", label: "Dagbjört Guðbrandsdóttir", category: "Team" },

  // App screenshots (phone aspect)
  { url: "/app-screenshot-health.jpg", label: "My Health — overview", category: "App screenshots" },
  { url: "/app-screenshot-report.jpg", label: "Health report — scores", category: "App screenshots" },
  { url: "/app-screenshot-community.jpg", label: "Community — accountability", category: "App screenshots" },
  { url: "/app-screenshot-measurements.jpg", label: "Measurements", category: "App screenshots" },
  { url: "/app-screenshot-coach.jpg", label: "Coach messaging", category: "App screenshots" },
  { url: "/app-screenshot-home.jpg", label: "Home", category: "App screenshots" },
  { url: "/app-screenshot-blood.jpg", label: "Blood panel", category: "App screenshots" },
];
