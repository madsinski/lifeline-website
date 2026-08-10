// CMS model for the home page (/).
//
// Fields + reorderable sections + built-in defaults. The defaults reproduce the
// page EXACTLY as it ships today: fields the page reads through t() carry the
// current translations table values (is/en); fields the page hard-codes carry
// that hard-coded English in both locales, so an empty CMS changes nothing.
// From there, Mads localises and reorders in /admin/website and publishes.

import type { SiteField, SiteSection, LocaleContent } from "./types";

// The bands the visitor can reorder / hide. The hero is structural and always
// renders first, so it is not listed here.
export const HOME_SECTIONS: SiteSection[] = [
  { id: "whatsnew", label: "Það nýjasta" },
  { id: "how", label: "Hvernig það virkar" },
  { id: "method", label: "Af hverju Lifeline" },
  { id: "assessment", label: "Heilsumat" },
  { id: "app", label: "Appið" },
  { id: "team", label: "Teymið" },
  { id: "partners", label: "Samstarfsaðilar" },
  { id: "cta", label: "Ákall til aðgerða" },
];

const G_HERO = "Hetja (efst)";
const G_HOW = "Hvernig það virkar";
const G_METHOD = "Af hverju Lifeline";
const G_ASSESS = "Heilsumat";
const G_APP = "Appið";
const G_TEAM = "Teymið";
const G_PARTNERS = "Samstarfsaðilar";
const G_CTA = "Ákall til aðgerða";

export const HOME_FIELDS: SiteField[] = [
  // ── Hero ──────────────────────────────────────────────────────────────────
  { key: "hero_title", label: "Fyrirsögn", group: G_HERO, type: "heading" },
  { key: "hero_subtitle", label: "Undirtexti", group: G_HERO, type: "textarea" },
  { key: "hero_cta_signup", label: "Hnappur 1 (skráning)", group: G_HERO, type: "text" },
  { key: "hero_cta_app", label: "Hnappur 2 (app)", group: G_HERO, type: "text" },

  // ── How it works ────────────────────────────────────────────────────────
  { key: "how_title", label: "Fyrirsögn", group: G_HOW, type: "text" },
  { key: "how_subtitle", label: "Undirtexti", group: G_HOW, type: "text" },
  { key: "how_s1_title", label: "Skref 1 — titill", group: G_HOW, type: "text" },
  { key: "how_s1_desc", label: "Skref 1 — texti", group: G_HOW, type: "textarea" },
  { key: "how_s2_title", label: "Skref 2 — titill", group: G_HOW, type: "text" },
  { key: "how_s2_desc", label: "Skref 2 — texti", group: G_HOW, type: "textarea" },
  { key: "how_s3_title", label: "Skref 3 — titill", group: G_HOW, type: "text" },
  { key: "how_s3_desc", label: "Skref 3 — texti", group: G_HOW, type: "textarea" },

  // ── Why Lifeline (method) ─────────────────────────────────────────────────
  { key: "method_kicker", label: "Yfirtexti", group: G_METHOD, type: "text" },
  { key: "method_title", label: "Fyrirsögn", group: G_METHOD, type: "heading" },
  { key: "method_intro", label: "Inngangur", group: G_METHOD, type: "textarea" },
  {
    key: "method_chips",
    label: "Traustmerki",
    group: G_METHOD,
    type: "list",
    help: "Eitt merki í hverri línu.",
    columns: [{ key: "label", label: "Merki", kind: "text" }],
  },
  { key: "method_l1_title", label: "Lag 1 — titill", group: G_METHOD, type: "text" },
  { key: "method_l1_body", label: "Lag 1 — texti", group: G_METHOD, type: "textarea" },
  { key: "method_l2_title", label: "Lag 2 — titill", group: G_METHOD, type: "text" },
  { key: "method_l2_body", label: "Lag 2 — texti", group: G_METHOD, type: "textarea" },
  { key: "method_l3_title", label: "Lag 3 — titill", group: G_METHOD, type: "text" },
  { key: "method_l3_body", label: "Lag 3 — texti", group: G_METHOD, type: "textarea" },
  { key: "method_bottom_label", label: "Niðurstaða — yfirtexti", group: G_METHOD, type: "text" },
  { key: "method_bottom_text", label: "Niðurstaða — texti", group: G_METHOD, type: "textarea" },

  // ── Assessment ─────────────────────────────────────────────────────────────
  { key: "assess_title", label: "Fyrirsögn", group: G_ASSESS, type: "text" },
  { key: "assess_subtitle", label: "Undirtexti", group: G_ASSESS, type: "text" },
  { key: "assess_c1_title", label: "Spjald 1 — titill", group: G_ASSESS, type: "text" },
  { key: "assess_c1_desc", label: "Spjald 1 — texti", group: G_ASSESS, type: "textarea" },
  { key: "assess_c2_title", label: "Spjald 2 — titill", group: G_ASSESS, type: "text" },
  { key: "assess_c2_desc", label: "Spjald 2 — texti", group: G_ASSESS, type: "textarea" },
  { key: "assess_c3_title", label: "Spjald 3 — titill", group: G_ASSESS, type: "text" },
  { key: "assess_c3_desc", label: "Spjald 3 — texti", group: G_ASSESS, type: "textarea" },
  { key: "assess_c4_title", label: "Spjald 4 — titill", group: G_ASSESS, type: "text" },
  { key: "assess_c4_desc", label: "Spjald 4 — texti", group: G_ASSESS, type: "textarea" },
  { key: "assess_medalia_title", label: "Medalia — titill", group: G_ASSESS, type: "text" },
  { key: "assess_medalia_desc", label: "Medalia — texti", group: G_ASSESS, type: "textarea" },
  { key: "assess_medalia_cta", label: "Medalia — hnappur", group: G_ASSESS, type: "text" },

  // ── The app ─────────────────────────────────────────────────────────────────
  { key: "app_label", label: "Yfirtexti", group: G_APP, type: "text" },
  { key: "app_title", label: "Fyrirsögn", group: G_APP, type: "heading" },
  { key: "app_desc", label: "Texti", group: G_APP, type: "textarea" },
  { key: "app_f1_title", label: "Eiginleiki 1 — titill", group: G_APP, type: "text" },
  { key: "app_f1_desc", label: "Eiginleiki 1 — texti", group: G_APP, type: "textarea" },
  { key: "app_f2_title", label: "Eiginleiki 2 — titill", group: G_APP, type: "text" },
  { key: "app_f2_desc", label: "Eiginleiki 2 — texti", group: G_APP, type: "textarea" },
  { key: "app_f3_title", label: "Eiginleiki 3 — titill", group: G_APP, type: "text" },
  { key: "app_f3_desc", label: "Eiginleiki 3 — texti", group: G_APP, type: "textarea" },
  { key: "app_f4_title", label: "Eiginleiki 4 — titill", group: G_APP, type: "text" },
  { key: "app_f4_desc", label: "Eiginleiki 4 — texti", group: G_APP, type: "textarea" },
  { key: "app_cta_app", label: "Hnappur 1", group: G_APP, type: "text" },
  { key: "app_cta_coaching", label: "Hnappur 2", group: G_APP, type: "text" },

  // ── Team ────────────────────────────────────────────────────────────────────
  { key: "team_kicker", label: "Yfirtexti", group: G_TEAM, type: "text" },
  { key: "team_title", label: "Fyrirsögn", group: G_TEAM, type: "text" },
  { key: "team_subtitle", label: "Undirtexti", group: G_TEAM, type: "text" },
  {
    key: "team_list",
    label: "Teymismeðlimir",
    group: G_TEAM,
    type: "list",
    help: "Ein manneskja í hverri línu.",
    columns: [
      { key: "name", label: "Nafn", kind: "text" },
      { key: "role", label: "Titill", kind: "text" },
      { key: "photo", label: "Mynd", kind: "asset" },
      { key: "flag", label: "Merki", kind: "text" },
    ],
  },

  // ── Partners ────────────────────────────────────────────────────────────────
  { key: "partners_title", label: "Fyrirsögn", group: G_PARTNERS, type: "text" },
  { key: "partners_subtitle", label: "Undirtexti", group: G_PARTNERS, type: "text" },
  {
    key: "partner_list",
    label: "Samstarfsaðilar",
    group: G_PARTNERS,
    type: "list",
    help: "Einn samstarfsaðili í hverri línu.",
    columns: [
      { key: "name", label: "Nafn", kind: "text" },
      { key: "role", label: "Hlutverk", kind: "text" },
      { key: "url", label: "Vefslóð", kind: "url" },
      { key: "logo", label: "Merki", kind: "asset" },
    ],
  },

  // ── CTA ─────────────────────────────────────────────────────────────────────
  { key: "cta_title", label: "Fyrirsögn", group: G_CTA, type: "text" },
  { key: "cta_desc", label: "Texti", group: G_CTA, type: "textarea" },
  { key: "cta_signup", label: "Hnappur 1 (skráning)", group: G_CTA, type: "text" },
  { key: "cta_app", label: "Hnappur 2 (app)", group: G_CTA, type: "text" },
];

// Icelandic defaults = what an Icelandic visitor sees today.
export const HOME_DEFAULTS_IS: LocaleContent = {
  hero_title: "Taktu stjórnina á heilsu þinni",
  hero_subtitle:
    "Lifeline Health sameinar markviss heilsumat og persónulega dagþjálfun. Þekktu tölurnar þínar, byggðu betri venjur, fylgstu með framförum.",
  hero_cta_signup: "Create your Lifeline account",
  hero_cta_app: "Sækja appið",

  how_title: "Hvernig Lifeline virkar",
  how_subtitle: "Þrjú skref til að umbreyta heilsu þinni",
  how_s1_title: "Farðu í heilsumat",
  how_s1_desc:
    "Ljúktu líkamssamsetningargreiningu, blóðprufum og lífsstílsgreiningu hjá okkar stöðvum eða í gegnum Sameind.",
  how_s2_title: "Fáðu skýrsluna þína",
  how_s2_desc:
    "Lifeline læknir fer yfir niðurstöður þínar og hittir þig til að ræða niðurstöður og tillögur.",
  how_s3_title: "Byrjaðu þjálfun",
  how_s3_desc:
    "Sæktu appið fyrir daglegar aðgerðaáætlanir, æfingaforrit, næringarráðgjöf og framvindueftirlit.",

  method_kicker: "Why Lifeline",
  method_title: "Anyone can hand you numbers. We hand you a ==plan that changes them.==",
  method_intro:
    "A one-off blood test tells you where you stand — not what to do about it, or how to make it stick. Lifeline is built in three practical layers, doctor-led from start to finish, so you catch what matters early and actually act on it.",
  method_chips:
    "Doctor-led\nEvidence-based\nWhole-person\nTargeted — no wasted tests\nFollow-up included",
  method_l1_title: "Foundations — where change happens",
  method_l1_body:
    "A deep questionnaire maps your sleep, nutrition, movement and mental wellbeing: the daily habits behind most long-term health outcomes. This is the layer you can actually adjust.",
  method_l2_title: "Measurements & bloodwork — the evidence",
  method_l2_body:
    "Body composition, blood pressure and targeted blood markers add objective depth and detail — so your picture is grounded in data, not guesswork.",
  method_l3_title: "Doctor review — the plan that drives change",
  method_l3_body:
    "A physician ties every layer together, explains your core health challenges in plain language, and writes a prioritised action plan: the highest-impact changes for the least time and effort.",
  method_bottom_label: "The bottom line",
  method_bottom_text:
    "That third layer is what actually changes behaviour — and it's exactly what cheaper checks skip. You're not paying for more tests. You're paying for change you'll actually make.",

  assess_title: "Heilsumatið þitt",
  assess_subtitle: "Markviss skoðun sem beinist að því sem skiptir mestu máli",
  assess_c1_title: "Body composition analysis",
  assess_c1_desc:
    "Clinical-accuracy body composition measurement — muscle mass, body fat, water balance and more. Far beyond what a scale can tell you.",
  assess_c2_title: "Targeted blood panel",
  assess_c2_desc:
    "We test the markers that matter for metabolic health — no unnecessary tests. Maximum insight, best value.",
  assess_c3_title: "Doctor-reviewed health report",
  assess_c3_desc:
    "A Lifeline physician reviews your results and prepares a personalised report with your health score and actionable recommendations.",
  assess_c4_title: "Personal consultation",
  assess_c4_desc:
    "Meet with your doctor in-person or over video to discuss your findings, ask questions, and get personalised recommendations.",
  assess_medalia_title: "Securely stored in Medalia",
  assess_medalia_desc:
    "All your health data, assessment results, blood tests and questionnaires are stored securely in your personal patient portal powered by Medalia.is.",
  assess_medalia_cta: "View Packages",

  app_label: "Lifeline appið",
  app_title: "Your health change ==partner==",
  app_desc:
    "The Lifeline app brings your assessment data, coaching programs, and daily actions into one place — making real health change simple and sustainable.",
  app_f1_title: "Personalised action plans",
  app_f1_desc:
    "Daily tasks across exercise, nutrition, sleep and mental wellness — built on your results.",
  app_f2_title: "Health coaching and education",
  app_f2_desc:
    "Structured programs, educational courses, and a personal coach to guide your journey from day one.",
  app_f3_title: "Track your progress",
  app_f3_desc:
    "See your health scores improve over time with every check-in and completed action.",
  app_f4_title: "Community",
  app_f4_desc: "Join challenges, earn streaks, and connect with others on the same health journey.",
  app_cta_app: "Check out the app",
  app_cta_coaching: "Explore coaching",

  team_kicker: "The team",
  team_title: "Teymið okkar",
  team_subtitle: "Sérfræðingarnir á bak við heilsuferðalagið þitt",
  team_list: [
    "Victor Guðmundsson | CEO · Medical Doctor & Coach | /team/victor.jpg | Co-founder",
    "Mads C. Aanesen | CTO · Medical Doctor & Coach | /team/mads.jpg | Co-founder",
    "Vignir Sigurðsson | Chief Medical Advisor · Pediatrician | /team/vignir.png | Advisor",
    "Dagbjört Guðbrandsdóttir | Medical Doctor | /team/dagbjort.jpg | Clinical",
    "Snorri Arnar Viðarsson | Business Advisor | /team/snorri.png | Advisor",
    "Ragnar Björgvinsson | Legal Advisor | /team/ragnar.png | Advisor",
  ].join("\n"),

  partners_title: "Samstarfsaðilar okkar",
  partners_subtitle: "Fólkið og stofnanirnar á bak við Lifeline Health",
  partner_list: [
    "Læknastofur Akureyrar | Medical clinic partner | https://lak.is | /partner-lak.svg",
    "Medalia | Patient portal & health records | https://medalia.is | /partner-medalia.png",
    "Sameind | Blood test collection stations | https://sameind.is | /partner-sameind.svg",
    "Lyfja | Measurement station | https://www.lyfja.is/ | /partner-lyfja.png",
  ].join("\n"),

  cta_title: "Tilbúin/n til að byrja?",
  cta_desc:
    "Veldu leiðina að betri heilsu. Farðu í yfirgripsmikið heilsumat eða byrjaðu þjálfun strax með appinu.",
  cta_signup: "Create your Lifeline account",
  cta_app: "Sækja app",
};

// English defaults = what an English visitor sees today.
export const HOME_DEFAULTS_EN: LocaleContent = {
  hero_title: "Take control of your health",
  hero_subtitle:
    "Lifeline Health combines targeted health assessments with personalised daily coaching. Know your numbers, build better habits, track your progress.",
  hero_cta_signup: "Create your Lifeline account",
  hero_cta_app: "Download the App",

  how_title: "How Lifeline works",
  how_subtitle: "Three steps to transform your health",
  how_s1_title: "Get assessed",
  how_s1_desc:
    "Complete body composition, blood tests and lifestyle screening at our stations or through Sameind.",
  how_s2_title: "Get your report",
  how_s2_desc:
    "A Lifeline doctor reviews your results and meets with you to discuss findings and recommendations.",
  how_s3_title: "Start coaching",
  how_s3_desc:
    "Download the app for daily action plans, exercise programs, nutrition guidance and progress tracking.",

  method_kicker: "Why Lifeline",
  method_title: "Anyone can hand you numbers. We hand you a ==plan that changes them.==",
  method_intro:
    "A one-off blood test tells you where you stand — not what to do about it, or how to make it stick. Lifeline is built in three practical layers, doctor-led from start to finish, so you catch what matters early and actually act on it.",
  method_chips:
    "Doctor-led\nEvidence-based\nWhole-person\nTargeted — no wasted tests\nFollow-up included",
  method_l1_title: "Foundations — where change happens",
  method_l1_body:
    "A deep questionnaire maps your sleep, nutrition, movement and mental wellbeing: the daily habits behind most long-term health outcomes. This is the layer you can actually adjust.",
  method_l2_title: "Measurements & bloodwork — the evidence",
  method_l2_body:
    "Body composition, blood pressure and targeted blood markers add objective depth and detail — so your picture is grounded in data, not guesswork.",
  method_l3_title: "Doctor review — the plan that drives change",
  method_l3_body:
    "A physician ties every layer together, explains your core health challenges in plain language, and writes a prioritised action plan: the highest-impact changes for the least time and effort.",
  method_bottom_label: "The bottom line",
  method_bottom_text:
    "That third layer is what actually changes behaviour — and it's exactly what cheaper checks skip. You're not paying for more tests. You're paying for change you'll actually make.",

  assess_title: "Your health assessment",
  assess_subtitle: "Targeted screening focused on what matters most",
  assess_c1_title: "Body composition analysis",
  assess_c1_desc:
    "Clinical-accuracy body composition measurement — muscle mass, body fat, water balance and more. Far beyond what a scale can tell you.",
  assess_c2_title: "Targeted blood panel",
  assess_c2_desc:
    "We test the markers that matter for metabolic health — no unnecessary tests. Maximum insight, best value.",
  assess_c3_title: "Doctor-reviewed health report",
  assess_c3_desc:
    "A Lifeline physician reviews your results and prepares a personalised report with your health score and actionable recommendations.",
  assess_c4_title: "Personal consultation",
  assess_c4_desc:
    "Meet with your doctor in-person or over video to discuss your findings, ask questions, and get personalised recommendations.",
  assess_medalia_title: "Securely stored in Medalia",
  assess_medalia_desc:
    "All your health data, assessment results, blood tests and questionnaires are stored securely in your personal patient portal powered by Medalia.is.",
  assess_medalia_cta: "View Packages",

  app_label: "The Lifeline App",
  app_title: "Your health change ==partner==",
  app_desc:
    "The Lifeline app brings your assessment data, coaching programs, and daily actions into one place — making real health change simple and sustainable.",
  app_f1_title: "Personalised action plans",
  app_f1_desc:
    "Daily tasks across exercise, nutrition, sleep and mental wellness — built on your results.",
  app_f2_title: "Health coaching and education",
  app_f2_desc:
    "Structured programs, educational courses, and a personal coach to guide your journey from day one.",
  app_f3_title: "Track your progress",
  app_f3_desc:
    "See your health scores improve over time with every check-in and completed action.",
  app_f4_title: "Community",
  app_f4_desc: "Join challenges, earn streaks, and connect with others on the same health journey.",
  app_cta_app: "Check out the app",
  app_cta_coaching: "Explore coaching",

  team_kicker: "The team",
  team_title: "Our team",
  team_subtitle: "The professionals behind your health journey",
  team_list: [
    "Victor Guðmundsson | CEO · Medical Doctor & Coach | /team/victor.jpg | Co-founder",
    "Mads C. Aanesen | CTO · Medical Doctor & Coach | /team/mads.jpg | Co-founder",
    "Vignir Sigurðsson | Chief Medical Advisor · Pediatrician | /team/vignir.png | Advisor",
    "Dagbjört Guðbrandsdóttir | Medical Doctor | /team/dagbjort.jpg | Clinical",
    "Snorri Arnar Viðarsson | Business Advisor | /team/snorri.png | Advisor",
    "Ragnar Björgvinsson | Legal Advisor | /team/ragnar.png | Advisor",
  ].join("\n"),

  partners_title: "Our partners",
  partners_subtitle: "The people and organisations behind Lifeline Health",
  partner_list: [
    "Læknastofur Akureyrar | Medical clinic partner | https://lak.is | /partner-lak.svg",
    "Medalia | Patient portal & health records | https://medalia.is | /partner-medalia.png",
    "Sameind | Blood test collection stations | https://sameind.is | /partner-sameind.svg",
    "Lyfja | Measurement station | https://www.lyfja.is/ | /partner-lyfja.png",
  ].join("\n"),

  cta_title: "Ready to start?",
  cta_desc:
    "Choose your path to better health. Get a comprehensive assessment or start coaching right away with the app.",
  cta_signup: "Create your Lifeline account",
  cta_app: "Download App",
};

/** Split a "list"-type field value into rows of trimmed pipe-separated cells. */
export function parseListField(value: string): string[][] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((c) => c.trim()));
}
