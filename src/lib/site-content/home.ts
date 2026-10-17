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
  { id: "einstaklingar", label: "Fyrir einstaklinga" },
  { id: "fyrirtaeki", label: "Fyrir fyrirtæki" },
  { id: "method", label: "Af hverju Lifeline" },
  { id: "app", label: "Appið" },
  { id: "team", label: "Teymið" },
  { id: "partners", label: "Samstarfsaðilar" },
  { id: "cta", label: "Ákall til aðgerða" },
];

const G_HERO = "Hetja (efst)";
const G_HOW = "Hvernig það virkar";
const G_IND = "Fyrir einstaklinga";
const G_BIZ = "Fyrir fyrirtæki";
const G_METHOD = "Af hverju Lifeline";
const G_APP = "Appið";
const G_TEAM = "Teymið";
const G_PARTNERS = "Samstarfsaðilar";
const G_CTA = "Ákall til aðgerða";

export const HOME_FIELDS: SiteField[] = [
  // ── Hero ──────────────────────────────────────────────────────────────────
  { key: "hero_title", label: "Fyrirsögn", group: G_HERO, type: "heading" },
  { key: "hero_subtitle", label: "Undirtexti", group: G_HERO, type: "textarea" },
  { key: "hero_cta_signup", label: "Hnappur 1 (skráning)", group: G_HERO, type: "text" },
  { key: "hero_cta_signup_href", label: "Hnappur 1 — hlekkur", group: G_HERO, type: "link" },
  { key: "hero_cta_app", label: "Hnappur 2 (app)", group: G_HERO, type: "text" },
  { key: "hero_cta_app_href", label: "Hnappur 2 — hlekkur", group: G_HERO, type: "link" },

  // ── How it works ────────────────────────────────────────────────────────
  { key: "how_title", label: "Fyrirsögn", group: G_HOW, type: "text" },
  { key: "how_subtitle", label: "Undirtexti", group: G_HOW, type: "text" },
  { key: "how_s1_title", label: "Skref 1 — titill", group: G_HOW, type: "text" },
  { key: "how_s1_desc", label: "Skref 1 — texti", group: G_HOW, type: "textarea" },
  { key: "how_s2_title", label: "Skref 2 — titill", group: G_HOW, type: "text" },
  { key: "how_s2_desc", label: "Skref 2 — texti", group: G_HOW, type: "textarea" },
  { key: "how_s3_title", label: "Skref 3 — titill", group: G_HOW, type: "text" },
  { key: "how_s3_desc", label: "Skref 3 — texti", group: G_HOW, type: "textarea" },

  // ── For individuals (teaser → /assessment) ───────────────────────────────
  { key: "ind_kicker", label: "Yfirtexti", group: G_IND, type: "text" },
  { key: "ind_title", label: "Fyrirsögn", group: G_IND, type: "heading" },
  { key: "ind_body", label: "Texti", group: G_IND, type: "textarea" },
  { key: "ind_bullets", label: "Punktar", group: G_IND, type: "list", help: "Einn punktur í hverri línu.", columns: [{ key: "b", label: "Punktur", kind: "text" }] },
  { key: "ind_cta", label: "Hnappur", group: G_IND, type: "text" },
  { key: "ind_cta_href", label: "Hnappur — hlekkur", group: G_IND, type: "link" },

  // ── For companies (teaser → /business) ───────────────────────────────────
  { key: "biz_kicker", label: "Yfirtexti", group: G_BIZ, type: "text" },
  { key: "biz_title", label: "Fyrirsögn", group: G_BIZ, type: "heading" },
  { key: "biz_body", label: "Texti", group: G_BIZ, type: "textarea" },
  { key: "biz_bullets", label: "Punktar", group: G_BIZ, type: "list", help: "Einn punktur í hverri línu.", columns: [{ key: "b", label: "Punktur", kind: "text" }] },
  { key: "biz_cta", label: "Hnappur", group: G_BIZ, type: "text" },
  { key: "biz_cta_href", label: "Hnappur — hlekkur", group: G_BIZ, type: "link" },

  // ── Why Lifeline (method) ─────────────────────────────────────────────────
  { key: "method_kicker", label: "Yfirtexti", group: G_METHOD, type: "text" },
  { key: "method_title", label: "Fyrirsögn", group: G_METHOD, type: "heading" },
  { key: "method_intro", label: "Inngangur", group: G_METHOD, type: "textarea" },
  { key: "method_l1_title", label: "Þrep 1 — titill", group: G_METHOD, type: "text" },
  { key: "method_l1_body", label: "Þrep 1 — texti", group: G_METHOD, type: "textarea" },
  { key: "method_l2_title", label: "Þrep 2 — titill", group: G_METHOD, type: "text" },
  { key: "method_l2_body", label: "Þrep 2 — texti", group: G_METHOD, type: "textarea" },
  { key: "method_l3_title", label: "Þrep 3 — titill", group: G_METHOD, type: "text" },
  { key: "method_l3_body", label: "Þrep 3 — texti", group: G_METHOD, type: "textarea" },
  { key: "method_bottom_text", label: "Niðurstaða", group: G_METHOD, type: "textarea" },

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
  { key: "app_cta_app_href", label: "Hnappur 1 — hlekkur", group: G_APP, type: "link" },
  { key: "app_cta_coaching", label: "Hnappur 2", group: G_APP, type: "text" },
  { key: "app_cta_coaching_href", label: "Hnappur 2 — hlekkur", group: G_APP, type: "link" },
  { key: "app_device", label: "Tæki (sími/fartölva)", group: G_APP, type: "select", options: [{ value: "phone", label: "Sími" }, { value: "laptop", label: "Fartölva" }] },
  { key: "app_screenshot", label: "Skjámynd", group: G_APP, type: "image" },

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
  { key: "cta_signup_href", label: "Hnappur 1 — hlekkur", group: G_CTA, type: "link" },
  { key: "cta_app", label: "Hnappur 2 (app)", group: G_CTA, type: "text" },
  { key: "cta_app_href", label: "Hnappur 2 — hlekkur", group: G_CTA, type: "link" },
];

// Locale-independent defaults (links + device/media). Spread into both locale
// default maps so they resolve the same in every language and are never sent to
// the translator.
const HOME_HREFS: LocaleContent = {
  hero_cta_signup_href: "/byrja",
  hero_cta_app_href: "/assessment",
  app_cta_app_href: "/coaching#download",
  app_cta_coaching_href: "/coaching",
  cta_signup_href: "/byrja",
  cta_app_href: "/assessment",
  ind_cta_href: "/assessment",
  biz_cta_href: "/business",
  app_device: "phone",
  app_screenshot: "/app-screenshot-home-static.png",
};

// Icelandic defaults = what an Icelandic visitor sees today.
export const HOME_DEFAULTS_IS: LocaleContent = {
  ...HOME_HREFS,
  hero_title: "Taktu stjórnina á heilsu þinni",
  hero_subtitle:
    "Lifeline Health sameinar markvissa heilsufarsskoðun og persónulega daglega þjálfun. Þekktu tölurnar þínar, byggðu upp betri venjur og fylgstu með framförunum.",
  hero_cta_signup: "Stofna aðgang",
  hero_cta_app: "Skoða pakka",

  how_title: "Hvernig Lifeline virkar",
  how_subtitle: "Þrjú einföld skref",
  how_s1_title: "Farðu í heilsufarsskoðun",
  how_s1_desc:
    "Ljúktu líkamssamsetningarmælingu, blóðprufum og lífsstílsgreiningu á stöðvum okkar eða í gegnum Sameind.",
  how_s2_title: "Fáðu skýrsluna þína",
  how_s2_desc:
    "Lifeline-læknir fer yfir niðurstöðurnar þínar og hittir þig til að ræða þær og næstu skref.",
  how_s3_title: "Byrjaðu þjálfun",
  how_s3_desc:
    "Sæktu appið fyrir daglegar aðgerðaáætlanir, æfingakerfi, næringarráðgjöf og eftirfylgni með framförum.",

  ind_kicker: "Fyrir einstaklinga",
  ind_title: "Heilsufarsskoðun fyrir þig",
  ind_body:
    "Einföld og hagkvæm leið til að þekkja heilsuna þína. Þú mætir í mælingar, ferð í blóðprufu og hittir lækni í myndsímtali — allt á þínum forsendum.",
  ind_bullets: [
    "Mælingar á mælingastöðinni í Lyfju, Smáratorgi í Kópavogi",
    "Blóðprufur hjá Sameind",
    "Læknisviðtal í myndsímtali",
    "Á viðráðanlegu verði og einstaklega þægilegt",
  ].join("\n"),
  ind_cta: "Skoða pakka",

  biz_kicker: "Fyrir fyrirtæki",
  biz_title: "Fjárfestu í ==starfsfólkinu þínu==",
  biz_body:
    "Lifeline kemur til fyrirtækisins og gerir heilsufarsskoðun einfalda fyrir allt starfsfólkið. Starfsfólk fær skýra mynd af eigin heilsu og stuðning við að fylgja henni eftir.",
  biz_bullets: [
    "Lifeline kemur og gerir mælingar á staðnum",
    "Starfsfólk fer í blóðprufu á völdum dögum",
    "Stjórnandi fær eigin fyrirtækjaaðgang til að skrá starfsfólk",
    "Einstaklega snurðulaust og þægilegt ferli",
  ].join("\n"),
  biz_cta: "Lausnir fyrir fyrirtæki",

  method_kicker: "Af hverju Lifeline",
  method_title: "Tölur eru ekki nóg. Þú færð ==áætlun til að vinna eftir.==",
  method_intro:
    "Stök blóðprufa sýnir þér stöðuna — en ekki hvað þú átt að gera. Lifeline byggir á þremur einföldum þrepum, læknastýrt frá upphafi til enda.",
  method_l1_title: "Grunnurinn",
  method_l1_body:
    "Spurningalisti kortleggur svefn, næringu, hreyfingu og andlega líðan — daglegu venjurnar sem skipta mestu máli.",
  method_l2_title: "Mælingarnar",
  method_l2_body:
    "Líkamssamsetning, blóðþrýstingur og markvissar blóðprufur gefa skýra mynd sem byggir á gögnum.",
  method_l3_title: "Yfirferð læknis",
  method_l3_body:
    "Læknir tengir allt saman og skrifar skýra áætlun með forgangsröðuðum skrefum.",
  method_bottom_text:
    "Þriðja þrepið tengir tölurnar við daglegt líf — skýr næstu skref sem þú getur fylgt eftir.",

  app_label: "Lifeline-appið",
  app_title: "Stuðningur við ==daglegar venjur==",
  app_desc:
    "Lifeline-appið sameinar niðurstöður heilsufarsskoðunarinnar, æfingakerfi og daglegar aðgerðir á einum stað — svo auðveldara sé að halda í góðar venjur.",
  app_f1_title: "Persónulegar aðgerðaáætlanir",
  app_f1_desc:
    "Dagleg verkefni þvert á hreyfingu, næringu, svefn og andlega líðan — byggð á niðurstöðunum þínum.",
  app_f2_title: "Kerfi og fræðsla",
  app_f2_desc:
    "Skipulögð kerfi og fræðsluefni sem styðja þig frá fyrsta degi. Persónulegur heilsuþjálfari fylgir Lifeline-þjálfun í Vestmannaeyjum.",
  app_f3_title: "Fylgstu með þróuninni",
  app_f3_desc:
    "Sjáðu hvernig heilsueinkunnirnar þínar þróast með hverri skráningu og lokinni aðgerð.",
  app_f4_title: "Samfélag",
  app_f4_desc: "Taktu þátt í áskorunum, haltu dampinum dag eftir dag og tengstu öðrum á sömu heilsuvegferð.",
  app_cta_app: "Skoða appið",
  app_cta_coaching: "Kynntu þér þjálfunina",

  team_kicker: "Teymið",
  team_title: "Teymið okkar",
  team_subtitle: "Sérfræðingarnir á bak við heilsuvegferðina þína",
  team_list: [
    "Victor Guðmundsson | Forstjóri · Læknir og þjálfari | /team/victor.jpg | Meðstofnandi",
    "Mads C. Aanesen | Tæknistjóri · Læknir og þjálfari | /team/mads.jpg | Meðstofnandi",
    "Vignir Sigurðsson | Aðallæknisráðgjafi · Barnalæknir | /team/vignir.png | Ráðgjafi",
    "Dagbjört Guðbrandsdóttir | Læknir | /team/dagbjort.jpg | Klíník",
    "Snorri Arnar Viðarsson | Viðskiptaráðgjafi | /team/snorri.png | Ráðgjafi",
    "Ragnar Björgvinsson | Lögfræðiráðgjafi | /team/ragnar.png | Ráðgjafi",
  ].join("\n"),

  partners_title: "Samstarfsaðilar okkar",
  partners_subtitle: "Fólkið og stofnanirnar á bak við Lifeline Health",
  partner_list: [
    "Læknastofur Akureyrar | Samstarfsklíník | https://lak.is | /partner-lak.svg",
    "Medalia | Sjúklingagátt og sjúkraskrá | https://medalia.is | /partner-medalia.png",
    "Sameind | Blóðprufustöðvar | https://sameind.is | /partner-sameind.svg",
    "Lyfja | Mælingastöð | https://www.lyfja.is/ | /partner-lyfja.png",
  ].join("\n"),

  cta_title: "Viltu taka fyrsta skrefið í átt að betri heilsu?",
  cta_desc:
    "Stofnaðu aðgang og veldu svo hvort þú byrjir á heilsufarsskoðun eða í appinu.",
  cta_signup: "Stofna aðgang",
  cta_app: "Skoða pakka",
};

// English defaults = what an English visitor sees today.
export const HOME_DEFAULTS_EN: LocaleContent = {
  ...HOME_HREFS,
  hero_title: "Take control of your health",
  hero_subtitle:
    "Lifeline Health combines targeted health checks with personalised daily coaching. Know your numbers, build better habits, track your progress.",
  hero_cta_signup: "Create account",
  hero_cta_app: "View packages",

  how_title: "How Lifeline works",
  how_subtitle: "Three simple steps",
  how_s1_title: "Get a health check",
  how_s1_desc:
    "Complete body composition, blood tests and lifestyle screening at our stations or through Sameind.",
  how_s2_title: "Get your report",
  how_s2_desc:
    "A Lifeline doctor reviews your results and meets with you to discuss findings and recommendations.",
  how_s3_title: "Start coaching",
  how_s3_desc:
    "Download the app for daily action plans, exercise programs, nutrition guidance and progress tracking.",

  ind_kicker: "For individuals",
  ind_title: "A health assessment for you",
  ind_body:
    "A simple, affordable way to get to know your health. Take your measurements, get your blood tests, and meet a doctor over video — all on your schedule.",
  ind_bullets: [
    "Measurements at the Lyfja station, Smáratorg, Kópavogur",
    "Blood tests at Sameind",
    "Doctor consultation over video call",
    "Affordable and remarkably convenient",
  ].join("\n"),
  ind_cta: "View packages",

  biz_kicker: "For companies",
  biz_title: "Invest in ==your people==",
  biz_body:
    "Lifeline comes to your company and makes health checks effortless for your whole team. Employees get a clear picture of their own health and support to follow it up.",
  biz_bullets: [
    "Lifeline visits and does measurements on-site",
    "Employees do blood tests on allocated days",
    "The manager gets their own company account to onboard staff",
    "A remarkably smooth, convenient process",
  ].join("\n"),
  biz_cta: "Solutions for companies",

  method_kicker: "Why Lifeline",
  method_title: "Numbers aren't enough. You get ==a plan to act on.==",
  method_intro:
    "A one-off blood test shows you where you stand — not what to do about it. Lifeline is built in three simple steps, doctor-led from start to finish.",
  method_l1_title: "The foundation",
  method_l1_body:
    "A questionnaire maps your sleep, nutrition, movement and mental wellbeing — the daily habits that matter most.",
  method_l2_title: "The measurements",
  method_l2_body:
    "Body composition, blood pressure and targeted blood tests give a clear picture grounded in data.",
  method_l3_title: "Doctor review",
  method_l3_body:
    "A doctor ties it all together and writes a clear plan with prioritised steps.",
  method_bottom_text:
    "The third step connects the numbers to daily life — clear next steps you can follow up on.",

  app_label: "The Lifeline app",
  app_title: "Support for your ==daily habits==",
  app_desc:
    "The Lifeline app brings your health check results, training programmes and daily actions into one place — making good habits easier to keep.",
  app_f1_title: "Personalised action plans",
  app_f1_desc:
    "Daily tasks across exercise, nutrition, sleep and mental wellness — built on your results.",
  app_f2_title: "Programmes and education",
  app_f2_desc:
    "Structured programmes and educational content to support you from day one. A personal health coach is part of Lifeline coaching in Vestmannaeyjar.",
  app_f3_title: "Follow your progress",
  app_f3_desc:
    "See how your health scores change with every check-in and completed action.",
  app_f4_title: "Community",
  app_f4_desc: "Join challenges, keep your momentum day after day, and connect with others on the same health journey.",
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

  cta_title: "Want to take the first step towards better health?",
  cta_desc:
    "Create an account, then choose whether to start with a health check or in the app.",
  cta_signup: "Create account",
  cta_app: "View packages",
};

/** Split a "list"-type field value into rows of trimmed pipe-separated cells. */
export function parseListField(value: string): string[][] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((c) => c.trim()));
}
