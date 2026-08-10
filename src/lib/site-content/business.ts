// CMS model for the Companies landing (/business). The page is entirely English
// today (no translations keys), so defaults are English in both locales — Mads
// localises via the editor + Þýða. The signed-in CompaniesPanel, the auth
// redirects and the inquiry form stay in code (BusinessView renders the form
// component); the CMS drives all the marketing copy + section order.

import type { SiteField, SiteSection, LocaleContent } from "./types";

export const BUSINESS_SECTIONS: SiteSection[] = [
  { id: "why", label: "Af hverju Lifeline" },
  { id: "how", label: "Hvernig það virkar" },
  { id: "method", label: "Aðferðin" },
  { id: "packages", label: "Pakkar" },
  { id: "bang", label: "Virði fyrir peninginn" },
  { id: "inquiry", label: "Fyrirspurn" },
  { id: "faq", label: "Algengar spurningar" },
];

const G_HERO = "Hetja (efst)";
const G_WHY = "Af hverju Lifeline";
const G_HOW = "Hvernig það virkar";
const G_METHOD = "Aðferðin";
const G_PACKAGES = "Pakkar";
const G_BANG = "Virði fyrir peninginn";
const G_INQUIRY = "Fyrirspurn";
const G_FAQ = "Algengar spurningar";

const listCol = (label: string) => [{ key: "item", label, kind: "text" as const }];

export const BUSINESS_FIELDS: SiteField[] = [
  // Hero
  { key: "hero_badge", label: "Merki", group: G_HERO, type: "text" },
  { key: "hero_title", label: "Fyrirsögn", group: G_HERO, type: "heading", help: "Notaðu ==orð== til að lita grænt. \\n fyrir línuskil." },
  { key: "hero_subtitle", label: "Undirtexti", group: G_HERO, type: "textarea" },
  { key: "hero_note", label: "Staðsetningarlína", group: G_HERO, type: "text" },
  { key: "hero_cta1", label: "Hnappur 1", group: G_HERO, type: "text" },
  { key: "hero_cta1_href", label: "Hnappur 1 — hlekkur", group: G_HERO, type: "link" },
  { key: "hero_cta2", label: "Hnappur 2 (útskráð)", group: G_HERO, type: "text" },
  { key: "hero_cta2_href", label: "Hnappur 2 — hlekkur", group: G_HERO, type: "link" },
  { key: "hero_login", label: "Innskráning — hnappur", group: G_HERO, type: "text" },
  { key: "hero_login_href", label: "Innskráning — hlekkur", group: G_HERO, type: "link" },
  { key: "hero_helper", label: "Hjálpartexti (útskráð)", group: G_HERO, type: "textarea" },
  { key: "hero_trust", label: "Traustlína", group: G_HERO, type: "text" },

  // Why
  { key: "why_title", label: "Fyrirsögn", group: G_WHY, type: "text" },
  { key: "why_intro", label: "Inngangur", group: G_WHY, type: "textarea" },
  ...[1, 2, 3, 4].flatMap((n) => [
    { key: `why_p${n}_title`, label: `Stólpi ${n} — titill`, group: G_WHY, type: "text" as const },
    { key: `why_p${n}_desc`, label: `Stólpi ${n} — texti`, group: G_WHY, type: "textarea" as const },
  ]),

  // How
  { key: "how_kicker", label: "Yfirtexti", group: G_HOW, type: "text" },
  { key: "how_title", label: "Fyrirsögn", group: G_HOW, type: "text" },
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [
    { key: `how_s${n}_title`, label: `Skref ${n} — titill`, group: G_HOW, type: "text" as const },
    { key: `how_s${n}_desc`, label: `Skref ${n} — texti`, group: G_HOW, type: "textarea" as const },
  ]),
  { key: "how_footnote", label: "Neðanmálstexti", group: G_HOW, type: "textarea" },

  // Method
  { key: "method_kicker", label: "Yfirtexti", group: G_METHOD, type: "text" },
  { key: "method_title", label: "Fyrirsögn", group: G_METHOD, type: "heading" },
  { key: "method_intro", label: "Inngangur", group: G_METHOD, type: "textarea" },
  ...[1, 2, 3].flatMap((n) => [
    { key: `method_l${n}_title`, label: `Lag ${n} — titill`, group: G_METHOD, type: "text" as const },
    { key: `method_l${n}_body`, label: `Lag ${n} — texti`, group: G_METHOD, type: "textarea" as const },
  ]),
  { key: "method_bottom_label", label: "Niðurstaða — yfirtexti", group: G_METHOD, type: "text" },
  { key: "method_bottom_text", label: "Niðurstaða — texti", group: G_METHOD, type: "textarea" },

  // Packages
  { key: "packages_kicker", label: "Yfirtexti", group: G_PACKAGES, type: "text" },
  { key: "packages_title", label: "Fyrirsögn", group: G_PACKAGES, type: "text" },
  { key: "packages_intro", label: "Inngangur", group: G_PACKAGES, type: "textarea" },
  ...[1, 2, 3].flatMap((n) => [
    { key: `pkg${n}_name`, label: `Pakki ${n} — heiti`, group: G_PACKAGES, type: "text" as const },
    { key: `pkg${n}_tag`, label: `Pakki ${n} — merki`, group: G_PACKAGES, type: "text" as const },
    { key: `pkg${n}_desc`, label: `Pakki ${n} — lýsing`, group: G_PACKAGES, type: "textarea" as const },
    { key: `pkg${n}_includes`, label: `Pakki ${n} — innifalið`, group: G_PACKAGES, type: "list" as const, help: "Eitt atriði í hverri línu.", columns: listCol("Atriði") },
    { key: `pkg${n}_footnote`, label: `Pakki ${n} — neðanmáls`, group: G_PACKAGES, type: "text" as const },
  ]),
  { key: "coach_kicker", label: "Þjálfun — yfirtexti", group: G_PACKAGES, type: "text" },
  { key: "coach_title", label: "Þjálfun — fyrirsögn", group: G_PACKAGES, type: "text" },
  { key: "coach_desc", label: "Þjálfun — texti", group: G_PACKAGES, type: "textarea" },
  { key: "coach_tiers", label: "Þjálfun — verðflokkar", group: G_PACKAGES, type: "list", help: "Ein lína: heiti | undirtexti.", columns: [{ key: "label", label: "Heiti", kind: "text" }, { key: "sub", label: "Undirtexti", kind: "text" }] },
  { key: "packages_footnote", label: "Neðanmálstexti", group: G_PACKAGES, type: "textarea" },

  // Bang for buck
  { key: "bang_kicker", label: "Yfirtexti", group: G_BANG, type: "text" },
  { key: "bang_title", label: "Fyrirsögn", group: G_BANG, type: "text" },
  { key: "bang_intro", label: "Inngangur", group: G_BANG, type: "textarea" },
  ...[1, 2, 3].flatMap((n) => [
    { key: `bang_c${n}_title`, label: `Spjald ${n} — titill`, group: G_BANG, type: "text" as const },
    { key: `bang_c${n}_body`, label: `Spjald ${n} — texti`, group: G_BANG, type: "textarea" as const },
  ]),

  // Inquiry (form stays in code; this is the left column)
  { key: "inquiry_kicker", label: "Yfirtexti", group: G_INQUIRY, type: "text" },
  { key: "inquiry_title", label: "Fyrirsögn", group: G_INQUIRY, type: "text" },
  { key: "inquiry_intro", label: "Inngangur", group: G_INQUIRY, type: "textarea" },
  { key: "inquiry_bullets", label: "Punktar", group: G_INQUIRY, type: "list", help: "Einn punktur í hverri línu.", columns: listCol("Punktur") },
  { key: "inquiry_talk_label", label: "„Frekar tala?“ — merki", group: G_INQUIRY, type: "text" },
  { key: "inquiry_email", label: "Netfang", group: G_INQUIRY, type: "text" },

  // FAQ
  { key: "faq_kicker", label: "Yfirtexti", group: G_FAQ, type: "text" },
  { key: "faq_title", label: "Fyrirsögn", group: G_FAQ, type: "text" },
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [
    { key: `q${n}_q`, label: `Spurning ${n}`, group: G_FAQ, type: "text" as const },
    { key: `q${n}_a`, label: `Svar ${n}`, group: G_FAQ, type: "textarea" as const },
  ]),
];

// The page has no translations today — English in both locales.
const SHARED: LocaleContent = {
  hero_badge: "For companies",
  hero_title: "Invest in your people.\n==Become a health-forward company.==",
  hero_subtitle: "Lifeline combines medical-grade health assessments, on-location measurements, intuitive reports and ongoing coaching — so your team can build real, measurable change with the least amount of effort.",
  hero_note: "Available to companies anywhere in Iceland — capital area and around the country.",
  hero_cta1: "Request a proposal",
  hero_cta1_href: "#inquiry",
  hero_cta2: "Create company account",
  hero_cta2_href: "/business/signup",
  hero_login: "Log in",
  hero_login_href: "/business/login",
  hero_helper: "Request a proposal for a tailored quote and we'll reach out — or create an account to set things up yourself now.",
  hero_trust: "Medical doctors in the team · On-location scans · Confidential reporting · GDPR-aligned",

  why_title: "The best of all worlds — under one roof",
  why_intro: "Most wellness providers do one thing. Lifeline covers the whole chain: medical expertise, on-site measurements, modern reporting, a coaching app, and the admin tooling to run it at scale.",
  why_p1_title: "Medical background",
  why_p1_desc: "Built by physicians, not marketers. Every report is reviewed by a doctor — your employees get real clinical answers, not generic wellness tips.",
  why_p2_title: "On-location measurements",
  why_p2_desc: "Our team comes to you. Body-composition scans happen on-site, so nobody loses half a workday travelling to a clinic.",
  why_p3_title: "Intuitive reports",
  why_p3_desc: "One page, three numbers that matter, a clear plan. No jargon, no 20-page PDFs that nobody reads.",
  why_p4_title: "Smooth employee journey",
  why_p4_desc: "A dedicated onboarding flow, SMS + email reminders, secure patient portal, and an admin dashboard that does the paperwork for you.",

  how_kicker: "How it works",
  how_title: "From kick-off to action plan in weeks, not quarters",
  how_s1_title: "Kick-off call", how_s1_desc: "We scope the programme with you — headcount, locations, timing, and which packages fit.",
  how_s2_title: "Roster & onboarding", how_s2_desc: "Upload your employee list. We send consent-first invitations; signup takes each employee under 2 minutes.",
  how_s3_title: "On-site measurement day", how_s3_desc: "Our nurse comes on-site — blood pressure, height, weight, and full body composition per person in about 5 minutes.",
  how_s4_title: "Blood test", how_s4_desc: "Employees walk in on a day that works — a Lifeline partner lab in the capital area, or we'll arrange one near your office elsewhere in the country.",
  how_s5_title: "Report + doctor review", how_s5_desc: "Each employee gets an intuitive personal report and a 1:1 doctor consultation to agree an action plan.",
  how_s6_title: "Coaching in the app (optional)", how_s6_desc: "Daily actions, a health coach, community and events — so change actually sticks, not just the check-up box.",
  how_footnote: "Outside the capital area? We coordinate with a partner lab near your office — employees never have to drive far for a blood draw.",

  method_kicker: "Why it's worth it",
  method_title: "Anyone can hand you numbers. We hand your people a ==plan that changes them.==",
  method_intro: "A one-off blood panel tells your team where they stand — not what to do about it, or how to make it stick. Lifeline is built in three layers, and each one adds the part most health checks leave out.",
  method_l1_title: "Foundations — where change happens",
  method_l1_body: "A deep questionnaire maps sleep, nutrition, movement and mental wellbeing: the daily habits behind most long-term health outcomes. This is the layer people can actually adjust.",
  method_l2_title: "Measurements & bloodwork — the evidence",
  method_l2_body: "Body composition, blood pressure and targeted blood markers add objective depth and detail — so the picture is grounded in data, not guesswork.",
  method_l3_title: "Doctor review — the plan that drives change",
  method_l3_body: "A physician ties every layer together, explains the core health challenges in plain language, and writes a prioritised action plan: the highest-impact changes for the least time and effort.",
  method_bottom_label: "The bottom line",
  method_bottom_text: "The third layer is the one that changes behaviour — and it's exactly what cheaper checks skip. You're not paying for more tests. You're paying for change your team will actually make.",

  packages_kicker: "Assessment packages",
  packages_title: "Three packages. Mix and match for your team.",
  packages_intro: "Most companies start with a Foundational Health round for everyone, then run Check-ins every 6–12 months. Pricing is tailored to your team — get in touch and we'll put together a quote.",
  pkg1_name: "Foundational Health", pkg1_tag: "Start here",
  pkg1_desc: "The full programme — the fastest way to give every employee a clear, medical-grade picture of their health.",
  pkg1_includes: ["On-site measurements (5 min) — blood pressure, body composition", "Targeted blood panel", "Full health questionnaire", "Doctor-reviewed personal report", "1:1 doctor consultation + action plan"].join("\n"),
  pkg1_footnote: "Doctor consultation in person or as a secure video meeting.",
  pkg2_name: "Check-in", pkg2_tag: "Follow-up",
  pkg2_desc: "3–12 months after the foundational assessment — track what changed, adjust the plan, celebrate progress.",
  pkg2_includes: ["On-site measurements — blood pressure, body composition", "Progress report vs baseline", "Updated health score", "Brief doctor review", "Refreshed action plan"].join("\n"),
  pkg2_footnote: "Doctor review in person or as a secure video meeting.",
  pkg3_name: "Self Check-in", pkg3_tag: "Free",
  pkg3_desc: "A self-guided check-in to track your own progress through the year and get updated insight — no site visit, no Lifeline team involvement unless something is flagged.",
  pkg3_includes: ["Online health questionnaire — rerun any time", "Self-reported metrics you control", "Updated personal health score", "Instant, private insight into your trends", "If something is flagged, Lifeline reaches out"].join("\n"),
  pkg3_footnote: "",
  coach_kicker: "Coaching app — add-on",
  coach_title: "Turn insight into action every day",
  coach_desc: "Offer the Lifeline app as a company perk. Daily actions built on each employee's report, a real health coach, community and events, education, and advanced macro tracking — across sleep, exercise, nutrition and mental wellbeing. Companies can cover a specific tier, or let employees upgrade on their own.",
  coach_tiers: ["Free | community + education", "Self-maintained | full app tools", "Premium | personal coach", "Volume rates | for 10+ seats"].join("\n"),
  packages_footnote: "Final pricing depends on headcount, location, and package mix. Request a proposal and we'll come back within 2 working days.",

  bang_kicker: "The Lifeline approach",
  bang_title: "Most bang for buck — because everything we measure is built to drive change.",
  bang_intro: "Lifeline is clinically focused on what actually moves with lifestyle: targeted blood markers, body-composition trends, and wellbeing self-report. Every number on the report has a purpose — and every purpose maps to a concrete action. So your team pays for insight that turns into real change, not data that sits in a drawer.",
  bang_c1_title: "Doctor led", bang_c1_body: "Every programme is built and reviewed by physicians — not a wellness vendor. Clinical judgement, not box-ticking.",
  bang_c2_title: "Only what you need", bang_c2_body: "Targeted markers and measurements that actually respond to lifestyle. No pricey vanity tests that don't change the plan.",
  bang_c3_title: "Then take action", bang_c3_body: "Every report comes with a clear, doable plan — and the Lifeline app turns that plan into daily habits that compound.",

  inquiry_kicker: "Next steps",
  inquiry_title: "Ready to invest in your team?",
  inquiry_intro: "Tell us a little about your company and what you're interested in. A Lifeline team member will reach out within 2 working days with a tailored proposal — including logistics for your location and headcount.",
  inquiry_bullets: ["Completely free, zero commitment", "We come back with a clear proposal", "No bulk-package upsell — only what fits your team"].join("\n"),
  inquiry_talk_label: "Prefer to talk?",
  inquiry_email: "contact@lifelinehealth.is",

  faq_kicker: "Questions",
  faq_title: "What companies usually ask",
  q1_q: "Where is the service available?", q1_a: "Across all of Iceland. We serve companies in the capital area and around the country. The service is offered in Iceland only.",
  q2_q: "How quickly can you start?", q2_a: "Most companies go from kick-off call to on-site measurement day in 3–6 weeks. Smaller teams can move even faster.",
  q3_q: "What happens if we have employees outside the capital area?", q3_a: "We coordinate with a partner lab near their office — employees never drive far for a blood draw. The measurement day and doctor consultations can be done on-site or remotely (video/phone), whichever suits your team.",
  q4_q: "What sees the company, and what stays with the employee?", q4_a: "All clinical data stays in each employee's personal patient portal. The company only sees anonymised group metrics — participation, programme progress, wellbeing averages. We mask any metric where fewer than 5 employees responded, so nobody can be re-identified.",
  q5_q: "Is the coaching app mandatory?", q5_a: "No. The assessment is the foundation. Coaching is optional — the company can cover it for everyone, cover it for specific groups, or leave it as a personal choice.",
  q6_q: "How is billing handled?", q6_a: "One consolidated PayDay invoice per round, delivered electronically to your company kennitala. You pay per completed assessment — no-shows don't count.",
};

export const BUSINESS_DEFAULTS_IS: LocaleContent = {
  ...SHARED,
  hero_badge: "Fyrir fyrirtæki",
  hero_title: "Fjárfestu í fólkinu þínu.\n==Verðu heilsumiðað fyrirtæki.==",
  hero_subtitle: "Lifeline sameinar heilsumat á klínísku stigi, mælingar á staðnum, aðgengilegar skýrslur og áframhaldandi þjálfun — svo teymið þitt geti náð raunverulegum, mælanlegum breytingum með sem minnstri fyrirhöfn.",
  hero_note: "Í boði fyrir fyrirtæki hvar sem er á Íslandi — á höfuðborgarsvæðinu og um land allt.",
  hero_cta1: "Óska eftir tilboði",
  hero_cta2: "Stofna fyrirtækjaaðgang",
  hero_login: "Innskráning",
  hero_helper: "Óskaðu eftir tilboði fyrir sérsniðið verð og við höfum samband — eða stofnaðu aðgang og settu allt upp sjálf strax.",
  hero_trust: "Læknar í teyminu · Mælingar á staðnum · Trúnaður í skýrslum · GDPR-samræmt",

  why_title: "Það besta úr öllum heimum — undir einu þaki",
  why_intro: "Flestir vellíðunaraðilar gera eitt. Lifeline nær yfir alla keðjuna: læknisfræðilega sérþekkingu, mælingar á staðnum, nútímalegar skýrslur, þjálfunarapp og umsýsluverkfærin til að reka þetta í stærri skala.",
  why_p1_title: "Læknisfræðilegur grunnur",
  why_p1_desc: "Byggt af læknum, ekki markaðsfólki. Hver skýrsla er yfirfarin af lækni — starfsfólkið þitt fær raunveruleg klínísk svör, ekki almenn vellíðunarráð.",
  why_p2_title: "Mælingar á staðnum",
  why_p2_desc: "Teymið okkar kemur til þín. Líkamssamsetningarmælingar fara fram á staðnum, svo enginn tapar hálfum vinnudegi í ferðalag á heilsugæslu.",
  why_p3_title: "Aðgengilegar skýrslur",
  why_p3_desc: "Ein síða, þrjár tölur sem skipta máli, skýr áætlun. Ekkert hrognamál, engar 20 blaðsíðna skýrslur sem enginn les.",
  why_p4_title: "Snurðulaus upplifun starfsfólks",
  why_p4_desc: "Sérstakt nýliðunarferli, SMS- og tölvupóstsáminningar, örugg sjúklingagátt og stjórnborð sem sér um pappírsvinnuna fyrir þig.",

  how_kicker: "Hvernig það virkar",
  how_title: "Frá upphafsfundi til aðgerðaáætlunar á vikum, ekki mánuðum",
  how_s1_title: "Upphafsfundur", how_s1_desc: "Við mótum verkefnið með þér — fjölda starfsfólks, staðsetningar, tímasetningu og hvaða pakkar henta.",
  how_s2_title: "Starfsmannalisti og nýliðun", how_s2_desc: "Hladdu upp starfsmannalistanum. Við sendum boð sem byrja á samþykki; skráning tekur hvern starfsmann innan við 2 mínútur.",
  how_s3_title: "Mælingadagur á staðnum", how_s3_desc: "Hjúkrunarfræðingur okkar kemur á staðinn — blóðþrýstingur, hæð, þyngd og full líkamssamsetning á hvern einstakling á um 5 mínútum.",
  how_s4_title: "Blóðprufa", how_s4_desc: "Starfsfólk kemur við á degi sem hentar — hjá samstarfsstofu Lifeline á höfuðborgarsvæðinu, eða við útvegum stofu nálægt skrifstofunni annars staðar á landinu.",
  how_s5_title: "Skýrsla og yfirferð læknis", how_s5_desc: "Hver starfsmaður fær aðgengilega persónulega skýrslu og einkaviðtal við lækni til að móta aðgerðaáætlun.",
  how_s6_title: "Þjálfun í appinu (valfrjálst)", how_s6_desc: "Daglegar aðgerðir, heilsuþjálfari, samfélag og viðburðir — svo breytingin festist raunverulega í sessi, ekki bara hakað í skoðunarboxið.",
  how_footnote: "Utan höfuðborgarsvæðisins? Við samræmum við samstarfsstofu nálægt skrifstofunni þinni — starfsfólk þarf aldrei að keyra langt í blóðprufu.",

  method_kicker: "Af hverju það borgar sig",
  method_title: "Hver sem er getur rétt þér tölur. Við réttum fólkinu þínu ==áætlun sem breytir þeim.==",
  method_intro: "Stök blóðprufa segir teyminu þínu hvar það stendur — ekki hvað á að gera í því eða hvernig á að láta það endast. Lifeline er byggt í þremur lögum, og hvert þeirra bætir við þeim hluta sem flestar heilsuskoðanir sleppa.",
  method_l1_title: "Undirstöður — þar sem breytingin verður",
  method_l1_body: "Ítarlegur spurningalisti kortleggur svefn, næringu, hreyfingu og andlega líðan: daglegu venjurnar sem búa að baki flestum langtímaáhrifum á heilsuna. Þetta er lagið sem fólk getur raunverulega haft áhrif á.",
  method_l2_title: "Mælingar og blóðprufur — sönnunargögnin",
  method_l2_body: "Líkamssamsetning, blóðþrýstingur og markvissir blóðmælar bæta við hlutlægri dýpt og smáatriðum — svo heildarmyndin byggi á gögnum, ekki ágiskunum.",
  method_l3_title: "Yfirferð læknis — áætlunin sem knýr breytinguna",
  method_l3_body: "Læknir tengir öll lögin saman, útskýrir helstu heilsuáskoranir á mannamáli og skrifar forgangsraðaða aðgerðaáætlun: mestu áhrifin fyrir minnstan tíma og fyrirhöfn.",
  method_bottom_label: "Niðurstaðan",
  method_bottom_text: "Þriðja lagið er það sem breytir hegðun — og það er einmitt það sem ódýrari skoðanir sleppa. Þið eruð ekki að borga fyrir fleiri rannsóknir. Þið eruð að borga fyrir breytingu sem teymið ykkar mun raunverulega ná fram.",

  packages_kicker: "Heilsumatspakkar",
  packages_title: "Þrír pakkar. Blandaðu saman fyrir teymið þitt.",
  packages_intro: "Flest fyrirtæki byrja á Grunnstoð heilsu fyrir alla og fara svo í Endurmat á 6–12 mánaða fresti. Verð er sniðið að teyminu þínu — hafðu samband og við setjum saman tilboð.",
  pkg1_name: "Grunnstoð heilsu", pkg1_tag: "Byrjaðu hér",
  pkg1_desc: "Allur pakkinn — fljótlegasta leiðin til að gefa hverjum starfsmanni skýra mynd af heilsu sinni á klínísku stigi.",
  pkg1_includes: ["Mælingar á staðnum (5 mín) — blóðþrýstingur, líkamssamsetning", "Markviss blóðprufupakki", "Fullur heilsuspurningalisti", "Persónuleg skýrsla yfirfarin af lækni", "Einkaviðtal við lækni + aðgerðaáætlun"].join("\n"),
  pkg1_footnote: "Læknisviðtal í eigin persónu eða í öruggum fjarfundi.",
  pkg2_name: "Endurmat", pkg2_tag: "Eftirfylgni",
  pkg2_desc: "3–12 mánuðum eftir grunnmatið — fylgstu með því sem breyttist, aðlagaðu áætlunina og fagnaðu árangri.",
  pkg2_includes: ["Mælingar á staðnum — blóðþrýstingur, líkamssamsetning", "Framvinduskýrsla borin saman við grunnlínu", "Uppfærð heilsueinkunn", "Stutt yfirferð læknis", "Endurnýjuð aðgerðaáætlun"].join("\n"),
  pkg2_footnote: "Yfirferð læknis í eigin persónu eða í öruggum fjarfundi.",
  pkg3_name: "Sjálfsmat", pkg3_tag: "Ókeypis",
  pkg3_desc: "Sjálfstýrt endurmat til að fylgjast með eigin framförum yfir árið og fá uppfærða innsýn — engin heimsókn á stöð, engin aðkoma Lifeline nema eitthvað gefi tilefni til.",
  pkg3_includes: ["Heilsuspurningalisti á netinu — endurtakanlegur hvenær sem er", "Sjálfskráðar tölur sem þú stjórnar", "Uppfærð persónuleg heilsueinkunn", "Tafarlaus, persónuleg innsýn í þróunina þína", "Ef eitthvað gefur tilefni hefur Lifeline samband"].join("\n"),
  pkg3_footnote: "",
  coach_kicker: "Þjálfunarapp — viðbót",
  coach_title: "Breyttu innsýn í aðgerðir á hverjum degi",
  coach_desc: "Bjóddu Lifeline appið sem fríðindi fyrir starfsfólk. Daglegar aðgerðir byggðar á skýrslu hvers starfsmanns, alvöru heilsuþjálfari, samfélag og viðburðir, fræðsla og ítarleg næringarskráning — þvert á svefn, hreyfingu, næringu og andlega líðan. Fyrirtæki geta greitt fyrir ákveðið stig eða leyft starfsfólki að uppfæra sjálft.",
  coach_tiers: ["Ókeypis | samfélag + fræðsla", "Sjálfstýrt | öll appverkfæri", "Premium | persónulegur þjálfari", "Magnverð | fyrir 10+ sæti"].join("\n"),
  packages_footnote: "Endanlegt verð fer eftir fjölda starfsfólks, staðsetningu og samsetningu pakka. Óskaðu eftir tilboði og við höfum samband innan 2 virkra daga.",

  bang_kicker: "Lifeline nálgunin",
  bang_title: "Mest fyrir peninginn — því allt sem við mælum er hannað til að knýja breytingu.",
  bang_intro: "Lifeline einbeitir sér klínískt að því sem raunverulega breytist með lífsstíl: markvissum blóðþáttum, þróun líkamssamsetningar og sjálfsmati á líðan. Hver tala í skýrslunni hefur tilgang — og hver tilgangur tengist áþreifanlegri aðgerð. Þannig borgar teymið þitt fyrir innsýn sem verður að raunverulegri breytingu, ekki gögn sem safna ryki í skúffu.",
  bang_c1_title: "Læknastýrt", bang_c1_body: "Hvert kerfi er byggt og yfirfarið af læknum — ekki vellíðunarsala. Klínískt mat, ekki hakað í box.",
  bang_c2_title: "Aðeins það sem þú þarft", bang_c2_body: "Markvissir þættir og mælingar sem raunverulega svara lífsstíl. Engar dýrar sýndarrannsóknir sem breyta engu um áætlunina.",
  bang_c3_title: "Svo grípur þú til aðgerða", bang_c3_body: "Hver skýrsla fylgir skýrri, framkvæmanlegri áætlun — og Lifeline appið breytir henni í daglegar venjur sem hlaðast upp.",

  inquiry_kicker: "Næstu skref",
  inquiry_title: "Tilbúin að fjárfesta í teyminu þínu?",
  inquiry_intro: "Segðu okkur aðeins frá fyrirtækinu þínu og hverju þú hefur áhuga á. Fulltrúi Lifeline hefur samband innan 2 virkra daga með sérsniðnu tilboði — þar á meðal skipulagi fyrir þína staðsetningu og fjölda starfsfólks.",
  inquiry_bullets: ["Algjörlega ókeypis, engin skuldbinding", "Við komum til baka með skýrt tilboð", "Engin þrýstingssala á pökkum — aðeins það sem hentar teyminu þínu"].join("\n"),
  inquiry_talk_label: "Vilt frekar tala?",

  faq_kicker: "Spurningar",
  faq_title: "Það sem fyrirtæki spyrja oftast um",
  q1_q: "Hvar er þjónustan í boði?", q1_a: "Um allt Ísland. Við þjónustum fyrirtæki á höfuðborgarsvæðinu og um land allt. Þjónustan er einungis í boði á Íslandi.",
  q2_q: "Hversu fljótt getið þið byrjað?", q2_a: "Flest fyrirtæki fara frá upphafsfundi að mælingadegi á 3–6 vikum. Smærri teymi geta farið enn hraðar.",
  q3_q: "Hvað ef við erum með starfsfólk utan höfuðborgarsvæðisins?", q3_a: "Við samræmum við samstarfsstofu nálægt skrifstofunni þeirra — starfsfólk keyrir aldrei langt í blóðprufu. Mælingadaginn og læknisviðtölin má gera á staðnum eða í fjarfundi (mynd/sími), eftir því sem hentar teyminu þínu.",
  q4_q: "Hvað sér fyrirtækið og hvað er einkamál starfsmannsins?", q4_a: "Öll klínísk gögn eru í persónulegri sjúklingagátt hvers starfsmanns. Fyrirtækið sér aðeins nafnlausar hóptölur — þátttöku, framvindu og meðaltöl um líðan. Við hyljum allar tölur þar sem færri en 5 starfsmenn svöruðu, svo ekki sé hægt að bera kennsl á neinn.",
  q5_q: "Er þjálfunarappið skylda?", q5_a: "Nei. Heilsumatið er grunnurinn. Þjálfun er valfrjáls — fyrirtækið getur greitt fyrir alla, fyrir tiltekna hópa, eða látið hana vera einkaval.",
  q6_q: "Hvernig fer greiðsla fram?", q6_a: "Einn samanlagður PayDay-reikningur á hverja lotu, sendur rafrænt á kennitölu fyrirtækisins. Þú greiðir fyrir hvert lokið heilsumat — þeir sem mæta ekki teljast ekki með.",
};

export const BUSINESS_DEFAULTS_EN: LocaleContent = { ...SHARED };
