// CMS model for the coaching page (/coaching).
//
// Same approach as home.ts: fields the page reads through t() carry the current
// translations-table values; fields the page hard-codes carry that English in
// both locales, so an empty CMS reproduces today's page. The comparison feature
// matrix (booleans per tier) stays in code — only its heading is editable.

import type { SiteField, SiteSection, LocaleContent } from "./types";

export const COACHING_SECTIONS: SiteSection[] = [
  { id: "why", label: "Af hverju þjálfun" },
  { id: "pillars", label: "Fjórar stoðir" },
  { id: "day", label: "Dæmigerður dagur" },
  { id: "how", label: "Hvernig þjálfun virkar" },
  { id: "pricing", label: "Áskriftir" },
  { id: "compare", label: "Samanburður" },
  { id: "download", label: "Sækja appið" },
  { id: "assessment_link", label: "Ákall — heilsumat" },
];

const G_HERO = "Hetja (efst)";
const G_WHY = "Af hverju þjálfun";
const G_PILLARS = "Fjórar stoðir";
const G_DAY = "Dæmigerður dagur";
const G_HOW = "Hvernig þjálfun virkar";
const G_PRICING = "Áskriftir";
const G_COMPARE = "Samanburður";
const G_DOWNLOAD = "Sækja appið";
const G_AL = "Ákall — heilsumat";

const featuresCol = [{ key: "feature", label: "Eiginleiki", kind: "text" as const }];

export const COACHING_FIELDS: SiteField[] = [
  // Hero
  { key: "hero_title", label: "Fyrirsögn", group: G_HERO, type: "text" },
  { key: "hero_subtitle", label: "Undirtexti", group: G_HERO, type: "textarea" },

  // Why coaching
  { key: "why_title", label: "Fyrirsögn", group: G_WHY, type: "text" },
  { key: "why_subtitle", label: "Undirtexti", group: G_WHY, type: "textarea" },
  ...[1, 2, 3, 4, 5].flatMap((n) => [
    { key: `why_c${n}_title`, label: `Spjald ${n} — titill`, group: G_WHY, type: "text" as const },
    { key: `why_c${n}_desc`, label: `Spjald ${n} — texti`, group: G_WHY, type: "textarea" as const },
  ]),

  // Pillars
  { key: "pillars_title", label: "Fyrirsögn", group: G_PILLARS, type: "text" },
  { key: "pillars_subtitle", label: "Undirtexti", group: G_PILLARS, type: "text" },
  { key: "pillars_features_label", label: "Merki eiginleikalista", group: G_PILLARS, type: "text" },
  ...[1, 2, 3, 4].flatMap((n) => [
    { key: `p${n}_title`, label: `Stoð ${n} — titill`, group: G_PILLARS, type: "text" as const },
    { key: `p${n}_desc`, label: `Stoð ${n} — texti`, group: G_PILLARS, type: "textarea" as const },
    { key: `p${n}_features`, label: `Stoð ${n} — eiginleikar`, group: G_PILLARS, type: "list" as const, help: "Einn eiginleiki í hverri línu.", columns: featuresCol },
  ]),

  // Typical day
  { key: "day_title", label: "Fyrirsögn", group: G_DAY, type: "text" },
  { key: "day_subtitle", label: "Undirtexti", group: G_DAY, type: "text" },
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [
    { key: `d${n}_title`, label: `Liður ${n} — titill`, group: G_DAY, type: "text" as const },
    { key: `d${n}_desc`, label: `Liður ${n} — texti`, group: G_DAY, type: "text" as const },
  ]),

  // How it works
  { key: "how_title", label: "Fyrirsögn", group: G_HOW, type: "text" },
  { key: "how_subtitle", label: "Undirtexti", group: G_HOW, type: "text" },
  ...[1, 2, 3, 4].flatMap((n) => [
    { key: `h${n}_title`, label: `Skref ${n} — titill`, group: G_HOW, type: "text" as const },
    { key: `h${n}_desc`, label: `Skref ${n} — texti`, group: G_HOW, type: "textarea" as const },
  ]),

  // Pricing
  { key: "pricing_title", label: "Fyrirsögn", group: G_PRICING, type: "text" },
  { key: "pricing_subtitle", label: "Undirtexti", group: G_PRICING, type: "text" },
  { key: "pricing_popular_badge", label: "Merki — vinsælast", group: G_PRICING, type: "text" },
  { key: "pricing_cta", label: "Hnappur", group: G_PRICING, type: "text" },
  { key: "pricing_free_label", label: "Verð — ókeypis", group: G_PRICING, type: "text" },
  { key: "pricing_soon_label", label: "Verð — væntanlegt", group: G_PRICING, type: "text" },
  ...[1, 2, 3].flatMap((n) => [
    { key: `plan${n}_name`, label: `Áætlun ${n} — heiti`, group: G_PRICING, type: "text" as const },
    { key: `plan${n}_desc`, label: `Áætlun ${n} — lýsing`, group: G_PRICING, type: "text" as const },
    { key: `plan${n}_features`, label: `Áætlun ${n} — eiginleikar`, group: G_PRICING, type: "list" as const, help: "Einn eiginleiki í hverri línu.", columns: featuresCol },
  ]),

  // Compare (matrix stays in code)
  { key: "compare_title", label: "Fyrirsögn", group: G_COMPARE, type: "text" },
  { key: "compare_subtitle", label: "Undirtexti", group: G_COMPARE, type: "text" },
  { key: "compare_h_feature", label: "Dálkur — eiginleiki", group: G_COMPARE, type: "text" },
  { key: "compare_h_free", label: "Dálkur — ókeypis", group: G_COMPARE, type: "text" },
  { key: "compare_h_self", label: "Dálkur — sjálfstýrt", group: G_COMPARE, type: "text" },
  { key: "compare_h_premium", label: "Dálkur — Premium", group: G_COMPARE, type: "text" },
  { key: "compare_best", label: "Merki — best", group: G_COMPARE, type: "text" },

  // Download
  { key: "download_title", label: "Fyrirsögn", group: G_DOWNLOAD, type: "text" },
  { key: "download_desc", label: "Texti", group: G_DOWNLOAD, type: "textarea" },

  // Assessment link
  { key: "al_title", label: "Fyrirsögn", group: G_AL, type: "text" },
  { key: "al_desc", label: "Texti", group: G_AL, type: "textarea" },
  { key: "al_cta", label: "Hnappur", group: G_AL, type: "text" },
];

// Icelandic defaults = what an Icelandic visitor sees today (keyed strings from
// the translations table; hard-coded blocks stay English until localised).
export const COACHING_DEFAULTS_IS: LocaleContent = {
  hero_title: "Daglegur heilsuþjálfari þinn",
  hero_subtitle:
    "Lifeline appið veitir persónulega dagþjálfun yfir fjórar stoðir heilsu. Byggt á heilsumatsniðurstöðum þínum, aðlagast þjálfunin eftir framförum.",

  why_title: "Af hverju heilsuþjálfun virkar",
  why_subtitle: "Knowledge alone doesn't create change. Coaching bridges the gap between knowing and doing.",
  why_c1_title: "Create real change",
  why_c1_desc: "Programs built on your blood work and body composition data — not generic templates.",
  why_c2_title: "Daily action plans",
  why_c2_desc: "Wake up to a clear plan every day — exercise, meals, sleep habits, and mental wellness.",
  why_c3_title: "Connect with coaches",
  why_c3_desc: "Message your health coach directly. Get answers, adjustments, and support when you need it.",
  why_c4_title: "Join the community",
  why_c4_desc: "Events, challenges, and a network of people on the same journey. You are not doing this alone.",
  why_c5_title: "Motivation that lasts",
  why_c5_desc: "Progress tracking, streaks, health scores, and coaching keep you engaged week after week.",

  pillars_title: "Fjórar stoðir heilsu",
  pillars_subtitle: "A holistic approach to lasting well-being",
  pillars_features_label: "Features",
  p1_title: "Exercise",
  p1_desc: "Personalised exercise programs designed for your fitness level and goals. From strength training to cardio, mobility work to sport-specific training. Programs adapt as you progress.",
  p1_features: ["Custom workout programs", "Video exercise demonstrations", "Progressive overload tracking", "Rest day recommendations", "Mobility and flexibility routines"].join("\n"),
  p2_title: "Nutrition",
  p2_desc: "Evidence-based nutrition guidance tailored to your blood work results and body composition. No fad diets, just sustainable eating habits that fuel your body properly.",
  p2_features: ["Personalised meal suggestions", "Macro and micronutrient guidance", "Hydration tracking", "Supplement recommendations", "Meal timing optimisation"].join("\n"),
  p3_title: "Sleep",
  p3_desc: "Science-backed sleep optimisation to improve your recovery, energy, and cognitive function. Track your sleep quality and get personalised recommendations.",
  p3_features: ["Sleep schedule optimisation", "Evening wind-down routines", "Sleep environment tips", "Quality tracking and trends", "Circadian rhythm alignment"].join("\n"),
  p4_title: "Mental Wellness",
  p4_desc: "Build mental resilience with guided mindfulness, breathing exercises, and stress management techniques. Connect with a supportive community of like-minded individuals.",
  p4_features: ["Guided mindfulness sessions", "Breathing exercises", "Stress management tools", "Mood tracking", "Community support"].join("\n"),

  day_title: "Hvernig dæmigerður dagur lítur út",
  day_subtitle: "Your app guides you through the day with personalised nudges",
  d1_title: "Morning routine", d1_desc: "Vitamins, hydration, and movement",
  d2_title: "Educational snippet", d2_desc: "A short health insight pops up",
  d3_title: "Lunch suggestion", d3_desc: "Meal idea with macro guidance",
  d4_title: "Breathing exercise", d4_desc: "Afternoon reset reminder",
  d5_title: "Workout plan", d5_desc: "Today's exercise session",
  d6_title: "Sleep wind-down", d6_desc: "Evening routine for better rest",

  how_title: "Hvernig þjálfun virkar",
  how_subtitle: "Your assessment powers your coaching experience",
  h1_title: "Assessment first", h1_desc: "Your coaching program starts with a health assessment. Your results inform every recommendation the app makes.",
  h2_title: "Daily action plans", h2_desc: "Each day you receive a personalised set of actions across exercise, nutrition, sleep, and mental wellness.",
  h3_title: "Track and adapt", h3_desc: "Log your activities, track your progress, and watch your health score improve over time. The app adapts to your journey.",
  h4_title: "Regular check-ins", h4_desc: "Schedule periodic Check-in assessments to measure real physiological changes and update your program.",

  pricing_title: "Þjálfunaráskriftir",
  pricing_subtitle: "Choose the plan that fits your goals",
  pricing_popular_badge: "Most popular",
  pricing_cta: "Get started",
  pricing_free_label: "Free",
  pricing_soon_label: "Pricing coming soon",
  plan1_name: "Free Plan", plan1_desc: "Try Lifeline risk-free",
  plan1_features: ["Basic health questionnaire", "Sample action plans", "Limited exercise programs", "Community access", "App access"].join("\n"),
  plan2_name: "Self-maintained", plan2_desc: "Full tools for self-guided health",
  plan2_features: ["Daily action plans", "Full exercise library", "Nutrition guidance", "Sleep tracking", "Progress tracking", "Community access"].join("\n"),
  plan3_name: "Premium", plan3_desc: "Personal coach included",
  plan3_features: ["Everything in Self-maintained", "Dedicated personal coach", "Weekly check-ins", "Custom meal plans", "Priority support", "Advanced analytics"].join("\n"),

  compare_title: "Bera saman áætlanir",
  compare_subtitle: "See what each tier includes",
  compare_h_feature: "Feature",
  compare_h_free: "Free",
  compare_h_self: "Self-maintained",
  compare_h_premium: "Premium",
  compare_best: "Best",

  download_title: "Sæktu Lifeline appið",
  download_desc: "Available on iOS and Android. Start with the free plan and experience personalised health coaching powered by your assessment data.",

  al_title: "Betri þjálfun byrjar á betri gögnum",
  al_desc: "Your health assessment results power every recommendation in the app. Get assessed first for the best coaching experience.",
  al_cta: "View Assessment Packages",
};

// English defaults = what an English visitor sees today.
export const COACHING_DEFAULTS_EN: LocaleContent = {
  hero_title: "Your daily health coach",
  hero_subtitle:
    "The Lifeline app delivers personalised daily coaching across four pillars of health. Built on your assessment results, it adapts as you improve.",

  why_title: "Why health coaching works",
  why_subtitle: "Knowledge alone doesn't create change. Coaching bridges the gap between knowing and doing.",
  why_c1_title: "Create real change",
  why_c1_desc: "Programs built on your blood work and body composition data — not generic templates.",
  why_c2_title: "Daily action plans",
  why_c2_desc: "Wake up to a clear plan every day — exercise, meals, sleep habits, and mental wellness.",
  why_c3_title: "Connect with coaches",
  why_c3_desc: "Message your health coach directly. Get answers, adjustments, and support when you need it.",
  why_c4_title: "Join the community",
  why_c4_desc: "Events, challenges, and a network of people on the same journey. You are not doing this alone.",
  why_c5_title: "Motivation that lasts",
  why_c5_desc: "Progress tracking, streaks, health scores, and coaching keep you engaged week after week.",

  pillars_title: "The four pillars of health",
  pillars_subtitle: "A holistic approach to lasting well-being",
  pillars_features_label: "Features",
  p1_title: "Exercise",
  p1_desc: "Personalised exercise programs designed for your fitness level and goals. From strength training to cardio, mobility work to sport-specific training. Programs adapt as you progress.",
  p1_features: ["Custom workout programs", "Video exercise demonstrations", "Progressive overload tracking", "Rest day recommendations", "Mobility and flexibility routines"].join("\n"),
  p2_title: "Nutrition",
  p2_desc: "Evidence-based nutrition guidance tailored to your blood work results and body composition. No fad diets, just sustainable eating habits that fuel your body properly.",
  p2_features: ["Personalised meal suggestions", "Macro and micronutrient guidance", "Hydration tracking", "Supplement recommendations", "Meal timing optimisation"].join("\n"),
  p3_title: "Sleep",
  p3_desc: "Science-backed sleep optimisation to improve your recovery, energy, and cognitive function. Track your sleep quality and get personalised recommendations.",
  p3_features: ["Sleep schedule optimisation", "Evening wind-down routines", "Sleep environment tips", "Quality tracking and trends", "Circadian rhythm alignment"].join("\n"),
  p4_title: "Mental Wellness",
  p4_desc: "Build mental resilience with guided mindfulness, breathing exercises, and stress management techniques. Connect with a supportive community of like-minded individuals.",
  p4_features: ["Guided mindfulness sessions", "Breathing exercises", "Stress management tools", "Mood tracking", "Community support"].join("\n"),

  day_title: "What a typical day looks like",
  day_subtitle: "Your app guides you through the day with personalised nudges",
  d1_title: "Morning routine", d1_desc: "Vitamins, hydration, and movement",
  d2_title: "Educational snippet", d2_desc: "A short health insight pops up",
  d3_title: "Lunch suggestion", d3_desc: "Meal idea with macro guidance",
  d4_title: "Breathing exercise", d4_desc: "Afternoon reset reminder",
  d5_title: "Workout plan", d5_desc: "Today's exercise session",
  d6_title: "Sleep wind-down", d6_desc: "Evening routine for better rest",

  how_title: "How coaching works",
  how_subtitle: "Your assessment powers your coaching experience",
  h1_title: "Assessment first", h1_desc: "Your coaching program starts with a health assessment. Your results inform every recommendation the app makes.",
  h2_title: "Daily action plans", h2_desc: "Each day you receive a personalised set of actions across exercise, nutrition, sleep, and mental wellness.",
  h3_title: "Track and adapt", h3_desc: "Log your activities, track your progress, and watch your health score improve over time. The app adapts to your journey.",
  h4_title: "Regular check-ins", h4_desc: "Schedule periodic Check-in assessments to measure real physiological changes and update your program.",

  pricing_title: "Coaching subscriptions",
  pricing_subtitle: "Choose the plan that fits your goals",
  pricing_popular_badge: "Most popular",
  pricing_cta: "Get started",
  pricing_free_label: "Free",
  pricing_soon_label: "Pricing coming soon",
  plan1_name: "Free Plan", plan1_desc: "Try Lifeline risk-free",
  plan1_features: ["Basic health questionnaire", "Sample action plans", "Limited exercise programs", "Community access", "App access"].join("\n"),
  plan2_name: "Self-maintained", plan2_desc: "Full tools for self-guided health",
  plan2_features: ["Daily action plans", "Full exercise library", "Nutrition guidance", "Sleep tracking", "Progress tracking", "Community access"].join("\n"),
  plan3_name: "Premium", plan3_desc: "Personal coach included",
  plan3_features: ["Everything in Self-maintained", "Dedicated personal coach", "Weekly check-ins", "Custom meal plans", "Priority support", "Advanced analytics"].join("\n"),

  compare_title: "Compare plans",
  compare_subtitle: "See what each tier includes",
  compare_h_feature: "Feature",
  compare_h_free: "Free",
  compare_h_self: "Self-maintained",
  compare_h_premium: "Premium",
  compare_best: "Best",

  download_title: "Download the Lifeline app",
  download_desc: "Available on iOS and Android. Start with the free plan and experience personalised health coaching powered by your assessment data.",

  al_title: "Better coaching starts with better data",
  al_desc: "Your health assessment results power every recommendation in the app. Get assessed first for the best coaching experience.",
  al_cta: "View Assessment Packages",
};
