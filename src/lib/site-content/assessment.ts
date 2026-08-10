// CMS model for the assessment page (/assessment).
//
// Same approach as home.ts/coaching.ts. The Sameind station list is data-driven
// from @/lib/sameind-locations and is NOT edited here; the Lifeline station list
// IS editable. Prices stay hidden (only the "Free"/"coming soon" labels are
// editable) — pricing strategy is deliberately not published yet.

import type { SiteField, SiteSection, LocaleContent } from "./types";

export const ASSESSMENT_SECTIONS: SiteSection[] = [
  { id: "process", label: "Ferlið" },
  { id: "results", label: "Niðurstöður útskýrðar" },
  { id: "track", label: "Fylgstu með framvindu" },
  { id: "packages", label: "Pakkar" },
  { id: "locations", label: "Prófunarstaðir" },
  { id: "faq", label: "Algengar spurningar" },
  { id: "cta", label: "Ákall til aðgerða" },
];

// Declared background per band (matches the current page exactly); on reorder,
// a wave separator is inserted only between adjacent light bands of differing
// colour. "grey" = #ecf0f3.
export const ASSESSMENT_BG: Record<string, "white" | "grey" | "dark"> = {
  process: "white",
  results: "white",
  track: "grey",
  packages: "white",
  locations: "white",
  faq: "grey",
  cta: "dark",
};

const G_HERO = "Hetja (efst)";
const G_PROCESS = "Ferlið";
const G_RESULTS = "Niðurstöður útskýrðar";
const G_TRACK = "Fylgstu með framvindu";
const G_PACKAGES = "Pakkar";
const G_LOCATIONS = "Prófunarstaðir";
const G_FAQ = "Algengar spurningar";
const G_CTA = "Ákall til aðgerða";

const bulletsCol = [{ key: "bullet", label: "Punktur", kind: "text" as const }];
const includesCol = [{ key: "item", label: "Atriði", kind: "text" as const }];

export const ASSESSMENT_FIELDS: SiteField[] = [
  // Hero
  { key: "hero_title", label: "Fyrirsögn", group: G_HERO, type: "text" },
  { key: "hero_subtitle", label: "Undirtexti", group: G_HERO, type: "textarea" },
  { key: "hero_cta", label: "Hnappur", group: G_HERO, type: "text" },
  { key: "hero_cta_href", label: "Hnappur — hlekkur", group: G_HERO, type: "link" },

  // Process
  { key: "process_title", label: "Fyrirsögn", group: G_PROCESS, type: "text" },
  { key: "process_subtitle", label: "Undirtexti", group: G_PROCESS, type: "text" },
  ...[1, 2, 3, 4, 5].flatMap((n) => [
    { key: `s${n}_title`, label: `Skref ${n} — titill`, group: G_PROCESS, type: "text" as const },
    { key: `s${n}_desc`, label: `Skref ${n} — texti`, group: G_PROCESS, type: "textarea" as const },
  ]),

  // Results explained
  { key: "results_title", label: "Fyrirsögn", group: G_RESULTS, type: "heading" },
  { key: "results_body", label: "Texti", group: G_RESULTS, type: "textarea" },
  { key: "results_bullets", label: "Punktar", group: G_RESULTS, type: "list", help: "Einn punktur í hverri línu.", columns: bulletsCol },
  { key: "results_note", label: "Athugasemd (Medalia hlekkjað sjálfkrafa)", group: G_RESULTS, type: "textarea" },
  { key: "results_device", label: "Tæki (sími/fartölva)", group: G_RESULTS, type: "select", options: [{ value: "phone", label: "Sími" }, { value: "laptop", label: "Fartölva" }] },
  { key: "results_screenshot", label: "Skjámynd", group: G_RESULTS, type: "image" },

  // Track progress
  { key: "track_title", label: "Fyrirsögn", group: G_TRACK, type: "heading" },
  { key: "track_body", label: "Texti", group: G_TRACK, type: "textarea" },
  { key: "track_bullets", label: "Punktar", group: G_TRACK, type: "list", help: "Einn punktur í hverri línu.", columns: bulletsCol },
  { key: "track_note", label: "Athugasemd (Medalia hlekkjað sjálfkrafa)", group: G_TRACK, type: "textarea" },
  { key: "track_device", label: "Tæki (sími/fartölva)", group: G_TRACK, type: "select", options: [{ value: "phone", label: "Sími" }, { value: "laptop", label: "Fartölva" }] },
  { key: "track_screenshot", label: "Skjámynd", group: G_TRACK, type: "image" },

  // Packages
  { key: "packages_title", label: "Fyrirsögn", group: G_PACKAGES, type: "text" },
  { key: "packages_subtitle", label: "Undirtexti", group: G_PACKAGES, type: "text" },
  { key: "packages_includes_label", label: "Merki — innifalið", group: G_PACKAGES, type: "text" },
  { key: "packages_ideal_label", label: "Merki — hentar", group: G_PACKAGES, type: "text" },
  { key: "packages_cta", label: "Hnappur", group: G_PACKAGES, type: "text" },
  { key: "packages_cta_href", label: "Hnappur — hlekkur", group: G_PACKAGES, type: "link" },
  { key: "price_free_label", label: "Verð — ókeypis", group: G_PACKAGES, type: "text" },
  { key: "price_soon_label", label: "Verð — væntanlegt", group: G_PACKAGES, type: "text" },
  ...[1, 2, 3].flatMap((n) => [
    { key: `pkg${n}_name`, label: `Pakki ${n} — heiti`, group: G_PACKAGES, type: "text" as const },
    { key: `pkg${n}_desc`, label: `Pakki ${n} — lýsing`, group: G_PACKAGES, type: "text" as const },
    { key: `pkg${n}_includes`, label: `Pakki ${n} — innifalið`, group: G_PACKAGES, type: "list" as const, help: "Eitt atriði í hverri línu.", columns: includesCol },
    { key: `pkg${n}_ideal`, label: `Pakki ${n} — hentar fyrir`, group: G_PACKAGES, type: "textarea" as const },
  ]),

  // Locations
  { key: "locations_title", label: "Fyrirsögn", group: G_LOCATIONS, type: "text" },
  { key: "locations_subtitle", label: "Undirtexti", group: G_LOCATIONS, type: "text" },
  { key: "loc_lifeline_heading", label: "Lifeline — fyrirsögn", group: G_LOCATIONS, type: "text" },
  { key: "loc_lifeline_desc", label: "Lifeline — texti", group: G_LOCATIONS, type: "textarea" },
  { key: "loc_lifeline_stations", label: "Lifeline stöðvar", group: G_LOCATIONS, type: "list", help: "Ein stöð í hverri línu.", columns: [
    { key: "name", label: "Nafn", kind: "text" },
    { key: "address", label: "Heimilisfang", kind: "text" },
    { key: "hours", label: "Opnunartími", kind: "text" },
  ] },
  { key: "loc_sameind_heading", label: "Sameind — fyrirsögn", group: G_LOCATIONS, type: "text" },
  { key: "loc_sameind_desc", label: "Sameind — texti", group: G_LOCATIONS, type: "textarea" },

  // FAQ
  { key: "faq_title", label: "Fyrirsögn", group: G_FAQ, type: "text" },
  { key: "faq_subtitle", label: "Undirtexti", group: G_FAQ, type: "text" },
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [
    { key: `q${n}_q`, label: `Spurning ${n}`, group: G_FAQ, type: "text" as const },
    { key: `q${n}_a`, label: `Svar ${n}`, group: G_FAQ, type: "textarea" as const },
  ]),

  // CTA
  { key: "cta_title", label: "Fyrirsögn", group: G_CTA, type: "text" },
  { key: "cta_desc", label: "Texti", group: G_CTA, type: "textarea" },
  { key: "cta_button", label: "Hnappur", group: G_CTA, type: "text" },
  { key: "cta_button_href", label: "Hnappur — hlekkur", group: G_CTA, type: "link" },
];

const SHARED = {
  hero_cta: "Create your Lifeline account",
  hero_cta_href: "/account/login?mode=signup",
  packages_cta_href: "/account/login?mode=signup",
  cta_button_href: "/account/login?mode=signup",
  results_device: "phone",
  results_screenshot: "/app-screenshot-health-static.png",
  track_device: "phone",
  track_screenshot: "/app-screenshot-blood-static.png",

  s1_title: "Book your assessment", s1_desc: "Open the patient portal and choose the Foundational Health or Check-in package. Pick a time that suits you.",
  s2_title: "Visit our station", s2_desc: "Come to our Lagmula 5 station in Reykjavik for your body composition scan and measurements. Takes about 20 minutes.",
  s3_title: "Blood test at Sameind", s3_desc: "Visit any Sameind blood collection station for your blood panel. Results are sent directly to Lifeline.",
  s4_title: "Results reviewed", s4_desc: "A Lifeline physician reviews all your results and prepares your personalised health report.",
  s5_title: "Doctor interview", s5_desc: "Meet with your doctor (in-person or video) to discuss your results, health score, and personalised recommendations.",

  results_title: "Your results, ==explained==",
  results_body: "After your assessment, receive a comprehensive health report with scores across all key health categories. Your doctor reviews every result and meets with you to discuss findings and next steps.",
  results_bullets: ["Health score across 6 categories", "Blood test results with clinical context", "Body composition breakdown", "Personalised recommendations", "Direct access in the Lifeline app"].join("\n"),
  results_note: "All results are stored securely in your Medalia patient portal.",

  track_title: "Track your ==progress==",
  track_body: "Your measurements, blood test results and health scores in one place. See how your numbers change over time and understand what they mean for your metabolic health.",
  track_bullets: ["Body composition: weight, fat mass, muscle mass, BMI", "Blood pressure", "Targeted blood test markers with clinical context", "Health scores across all categories", "Progress charts comparing previous check-ups"].join("\n"),
  track_note: "Your health data is stored securely in Medalia. The Lifeline app is a secure window into your records.",

  packages_includes_label: "What's included:",
  packages_ideal_label: "Ideal for:",
  packages_cta: "Create your Lifeline account",
  price_free_label: "Free",
  price_soon_label: "Pricing coming soon",
  pkg1_name: "Foundational Health", pkg1_desc: "Our foundational health screening for new members",
  pkg1_includes: ["Body composition analysis with clinical accuracy", "Targeted blood panel for metabolic health", "Blood pressure screening", "Lifestyle and nutrition questionnaire", "Doctor-reviewed health report", "30-minute personal consultation with physician", "Personalised health score and recommendations", "Access to patient portal for results"].join("\n"),
  pkg1_ideal: "First-time members who want a complete picture of their health",
  pkg2_name: "Check-in", pkg2_desc: "Track your progress with repeat measurements",
  pkg2_includes: ["Body composition analysis", "Progress comparison with previous results", "Updated health score", "Brief physician review", "Updated recommendations"].join("\n"),
  pkg2_ideal: "Existing members who want to measure improvement after 3-6 months of coaching",
  pkg3_name: "Self Check-in", pkg3_desc: "Complete a health questionnaire from home",
  pkg3_includes: ["Comprehensive online health questionnaire", "Self-reported health metrics", "Basic health score calculation", "Lifestyle and habit tracking", "No visit to station required"].join("\n"),
  pkg3_ideal: "Anyone who wants to start tracking their health before committing to a full assessment",

  loc_lifeline_heading: "Lifeline Station",
  loc_lifeline_desc: "Visit our station for body composition analysis and measurements.",
  loc_lifeline_stations: ["Reykjavik | Lagmula 5, 108 Reykjavik | Monday - Friday: 08:00 - 17:00", "Akureyri | Coming soon | ", "Selfoss | Coming soon | "].join("\n"),
  loc_sameind_heading: "Sameind Blood Test Stations",
  loc_sameind_desc: "Walk in at any Sameind station in the capital area or Reykjanesbær. Your referral is valid at all stations.",

  faq_subtitle: "Everything you need to know about assessments",
  q1_q: "How long does the Foundational Health assessment take?",
  q1_a: "The station visit takes about 20 minutes. The blood test at Sameind takes 10-15 minutes. Your doctor consultation is 30 minutes. In total, expect about 1 hour spread across two visits plus the consultation.",
  q2_q: "Do I need to fast before the blood test?",
  q2_a: "Yes, we recommend fasting for 10-12 hours before your blood test for the most accurate results. Water and black coffee are fine.",
  q3_q: "How quickly will I get my results?",
  q3_a: "Body composition results are available immediately. Blood test results typically take 3-5 business days. Once all results are in, your doctor will review them within 2 business days and schedule your consultation.",
  q4_q: "Can I do the blood test at any Sameind station?",
  q4_a: "Yes. After booking your assessment through our patient portal, your referral is valid at every Sameind station — see the list above for addresses and opening hours.",
  q5_q: "What does the blood panel include?",
  q5_a: "We select only the markers that matter for assessing metabolic health — no unnecessary tests. You get the most relevant insights for the best value, covering key areas like lipids, blood sugar, thyroid function, and essential vitamins.",
  q6_q: "How often should I do a Check-in?",
  q6_a: "We recommend a Check-in every 3-6 months to track your progress. This allows enough time for meaningful changes to show in your body composition results.",

  cta_title: "Ready to know your numbers?",
  cta_desc: "Create your Lifeline account — book your assessment from inside.",
  cta_button: "Create your Lifeline account",
};

export const ASSESSMENT_DEFAULTS_IS: LocaleContent = {
  ...SHARED,
  hero_title: "Heilsumat",
  hero_subtitle: "Fáðu heilsugögnin sem skipta mestu máli. Markvissir skoðunarpakkar okkar beinast að efnaskiptamerkjum sem skila raunverulegum breytingum — engar óþarfa rannsóknir, hámarks gildi.",
  process_title: "Heilsumatsferlið",
  process_subtitle: "From booking to personalised recommendations",
  packages_title: "Heilsumatspakkar",
  packages_subtitle: "Veldu heilsumatið sem hentar þínum þörfum",
  locations_title: "Prófunarstaðir",
  locations_subtitle: "Hvar á að ljúka heilsumatinu þínu",
  faq_title: "Algengar spurningar",
};

export const ASSESSMENT_DEFAULTS_EN: LocaleContent = {
  ...SHARED,
  hero_title: "Health Assessment",
  hero_subtitle: "Get the health data that matters most. Our targeted screening packages focus on metabolic health markers that drive real change — no unnecessary tests, maximum value.",
  process_title: "The assessment process",
  process_subtitle: "From booking to personalised recommendations",
  packages_title: "Assessment Packages",
  packages_subtitle: "Choose the assessment that fits your needs",
  locations_title: "Test locations",
  locations_subtitle: "Where to complete your assessment",
  faq_title: "Frequently asked questions",
};
