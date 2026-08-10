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
  hero_cta_signup_href: "/account/login?mode=signup",
  hero_cta_app_href: "/coaching#download",
  app_cta_app_href: "/coaching#download",
  app_cta_coaching_href: "/coaching",
  cta_signup_href: "/account/login?mode=signup",
  cta_app_href: "/coaching#download",
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
    "Lifeline Health sameinar markvisst heilsumat og persónulega daglega þjálfun. Þekktu tölurnar þínar, byggðu upp betri venjur og fylgstu með framförunum.",
  hero_cta_signup: "Stofnaðu Lifeline-aðgang",
  hero_cta_app: "Sækja appið",

  how_title: "Hvernig Lifeline virkar",
  how_subtitle: "Þrjú skref til að umbreyta heilsu þinni",
  how_s1_title: "Farðu í heilsumat",
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
    "Mælingar á mælingastöðinni í Lyfju, Smáratorgi í Reykjavík",
    "Blóðprufur hjá Sameind",
    "Læknisviðtal í myndsímtali",
    "Á viðráðanlegu verði og einstaklega þægilegt",
  ].join("\n"),
  ind_cta: "Skoða heilsufarsskoðun",

  biz_kicker: "Fyrir fyrirtæki",
  biz_title: "Fjárfestu í ==starfsfólkinu þínu==",
  biz_body:
    "Lifeline kemur til fyrirtækisins og gerir heilsufarsskoðun einfalda fyrir allt starfsfólkið. Fjárfesting í heilsu starfsfólks er fjárfesting í fyrirtækinu — færri veikindadagar og betri líkamleg og andleg líðan.",
  biz_bullets: [
    "Lifeline kemur og gerir mælingar á staðnum",
    "Starfsfólk fer í blóðprufu á völdum dögum",
    "Stjórnandi fær eigin fyrirtækjaaðgang til að skrá starfsfólk",
    "Einstaklega snurðulaust og þægilegt ferli",
  ].join("\n"),
  biz_cta: "Lausnir fyrir fyrirtæki",

  method_kicker: "Af hverju Lifeline",
  method_title: "Hver sem er getur rétt þér tölur. Við réttum þér ==áætlun sem breytir þeim.==",
  method_intro:
    "Stök blóðprufa segir þér hvar þú stendur — ekki hvað þú átt að gera í því eða hvernig þú lætur það endast. Lifeline er byggt upp í þremur hagnýtum lögum, læknastýrt frá upphafi til enda, svo þú grípir það sem skiptir máli snemma og bregst raunverulega við því.",
  method_chips:
    "Læknastýrt\nGagnreynt\nHeildræn nálgun\nMarkvisst — engar óþarfa rannsóknir\nEftirfylgni innifalin",
  method_l1_title: "Undirstöður — þar sem breytingin verður",
  method_l1_body:
    "Ítarlegur spurningalisti kortleggur svefn, næringu, hreyfingu og andlega líðan: daglegu venjurnar sem búa að baki flestum langtímaáhrifum á heilsuna. Þetta er lagið sem þú getur raunverulega haft áhrif á.",
  method_l2_title: "Mælingar og blóðprufur — sönnunargögnin",
  method_l2_body:
    "Líkamssamsetning, blóðþrýstingur og markvissir blóðmælar bæta við hlutlægri dýpt og smáatriðum — svo heildarmyndin byggi á gögnum, ekki ágiskunum.",
  method_l3_title: "Yfirferð læknis — áætlunin sem knýr breytinguna",
  method_l3_body:
    "Læknir tengir öll lögin saman, útskýrir helstu heilsuáskoranir þínar á mannamáli og skrifar forgangsraðaða aðgerðaáætlun: mestu áhrifin fyrir minnstan tíma og fyrirhöfn.",
  method_bottom_label: "Niðurstaðan",
  method_bottom_text:
    "Þriðja lagið er það sem raunverulega breytir hegðun — og það er einmitt það sem ódýrari skoðanir sleppa. Þú ert ekki að borga fyrir fleiri rannsóknir. Þú ert að borga fyrir breytingu sem þú munt raunverulega ná fram.",

  app_label: "Lifeline appið",
  app_title: "Félagi þinn í ==heilsubreytingunni==",
  app_desc:
    "Lifeline appið sameinar heilsumatsgögnin þín, þjálfunarkerfi og daglegar aðgerðir á einum stað — og gerir raunverulega heilsubreytingu einfalda og sjálfbæra.",
  app_f1_title: "Persónulegar aðgerðaáætlanir",
  app_f1_desc:
    "Dagleg verkefni þvert á hreyfingu, næringu, svefn og andlega líðan — byggð á niðurstöðunum þínum.",
  app_f2_title: "Heilsuþjálfun og fræðsla",
  app_f2_desc:
    "Skipulögð kerfi, fræðslunámskeið og persónulegur þjálfari sem leiðir þig frá fyrsta degi.",
  app_f3_title: "Fylgstu með framförum",
  app_f3_desc:
    "Sjáðu heilsueinkunnirnar þínar batna með tímanum við hverja skráningu og lokna aðgerð.",
  app_f4_title: "Samfélag",
  app_f4_desc: "Taktu þátt í áskorunum, safnaðu röðum og tengstu öðrum á sömu heilsuvegferð.",
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

  cta_title: "Tilbúin að byrja?",
  cta_desc:
    "Veldu leiðina að betri heilsu. Farðu í yfirgripsmikið heilsumat eða byrjaðu þjálfun strax með appinu.",
  cta_signup: "Stofnaðu Lifeline-aðgang",
  cta_app: "Sækja appið",
};

// English defaults = what an English visitor sees today.
export const HOME_DEFAULTS_EN: LocaleContent = {
  ...HOME_HREFS,
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

  ind_kicker: "For individuals",
  ind_title: "A health assessment for you",
  ind_body:
    "A simple, affordable way to get to know your health. Take your measurements, get your blood tests, and meet a doctor over video — all on your schedule.",
  ind_bullets: [
    "Measurements at the Lyfja station, Smáratorg, Reykjavík",
    "Blood tests at Sameind",
    "Doctor consultation over video call",
    "Affordable and remarkably convenient",
  ].join("\n"),
  ind_cta: "Explore the assessment",

  biz_kicker: "For companies",
  biz_title: "Invest in ==your people==",
  biz_body:
    "Lifeline comes to your company and makes health assessments effortless for your whole team. Investing in your staff's health is investing in your company — fewer sick days and better physical and mental wellbeing.",
  biz_bullets: [
    "Lifeline visits and does measurements on-site",
    "Employees do blood tests on allocated days",
    "The manager gets their own company account to onboard staff",
    "A remarkably smooth, convenient process",
  ].join("\n"),
  biz_cta: "Solutions for companies",

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
