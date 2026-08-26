// ============================================================================
// Five from-scratch template decks. Each re-composes the SAME employee-intro
// content into a different set of layouts, order and emphasis — paired with a
// distinct design in templates.ts. These are genuinely different decks, not
// re-skins of the standard one.
// ============================================================================
import type { Slide } from "./types";

const IMG = {
  hero: "/presentation-images/eyjar-running.png",
  banner: "/presentation-images/banner.png",
  clinic: "/presentation-images/victor-clinic-bw.jpg",
  victor: "/team/victor.png", mads: "/team/mads.png", vignir: "/team/vignir.png", dagbjort: "/team/dagbjort.png",
  // Fjarlækningar headshots (Canon EOS R5 portraits, shared with the joint deck)
  fjarVictor: "/team/fjar-victor.jpg", fjarMads: "/team/fjar-mads.jpg", fjarDagbjort: "/team/fjar-dagbjort.jpg",
  fjarGudbjartur: "/team/fjar-gudbjartur.jpg", fjarElvar: "/team/fjar-elvar.jpg",
  fjarApp: "/presentation-images/fjarlaekningar-app.png",
  lifelineApp: "/presentation-images/lifeline-app-myhealth-cropped.jpg",
  appHealth: "/app-screenshot-health.jpg", appReport: "/app-screenshot-report.jpg",
  appCommunity: "/app-screenshot-community.jpg", appMeasurements: "/app-screenshot-measurements.jpg",
  appCoach: "/app-screenshot-coach.jpg",
};

const TEAM: Slide["members"] = [
  { photo: IMG.victor, flag: "Co-founder", name: "Victor Guðmundsson", role: "CEO · Medical Doctor & Coach" },
  { photo: IMG.mads, flag: "Co-founder", name: "Mads C. Aanesen", role: "CTO · Medical Doctor & Coach" },
  { photo: IMG.vignir, flag: "Advisor", name: "Vignir Sigurðsson", role: "Chief Medical Advisor · Pediatrician" },
  { photo: IMG.dagbjort, flag: "Clinical", name: "Dagbjört Guðbrandsdóttir", role: "Medical Doctor" },
];

let _c = 0;
const id = () => `t${_c++}`;
const s = (slide: Omit<Slide, "id">): Slide => ({ id: id(), ...slide });

// ── 1. EDITORIAL — magazine feel: photo cover, pull-quotes, feature rows ─────
export function editorialDeck(): Slide[] {
  return [
    s({ type: "title", theme: "dark", bg: IMG.hero, kicker: "Lifeline · for the team", heading: "Your health,\n==written by you.==", lead: "A 30-minute introduction to the health benefit your workplace is giving you.", tagline: "Ahead of yourself." }),
    s({ type: "statement", theme: "light", kicker: "Why we're here", heading: "Healthcare is brilliant at ==treatment.== It does almost nothing for ==prevention.==", lead: "The years before something goes wrong are left entirely to us. That's the gap Lifeline fills." }),
    s({ type: "hero-image", theme: "dark", image: IMG.clinic, kicker: "Our story", heading: "Born on the clinic floor.", lead: "Two physicians — Victor Guðmundsson and Mads Christian Aanesen — kept meeting patients who arrived too late, for problems years of small choices could have prevented.", tagline: "So they built the tool they wished existed." }),
    s({ type: "feature-rows", theme: "light", kicker: "What Lifeline is", heading: "The missing layer between healthcare and daily life.", rows: [
      { icon: "clip", title: "A real assessment", body: "Clinical-grade blood work, body composition and lifestyle — reviewed by a physician." },
      { icon: "target", title: "A personal plan", body: "Built from your actual results across four pillars of health." },
      { icon: "pulse", title: "Daily action", body: "Small, specific things to do each day — that adapt as you improve." },
    ] }),
    s({ type: "team", theme: "light", kicker: "The team", heading: "How we became this team.", lead: "Physicians at the core — surrounded by coaches, nurses and engineers.", members: TEAM, footnote: "Swap in your own line-up here." }),
    s({ type: "pillars", theme: "dark", kicker: "The model", heading: "Four pillars. One connected system.", lead: "Sleep affects training, training affects mood, mood affects eating. We treat all four together.", pillars: [
      { key: "exercise", icon: "dumbbell", title: "Exercise", body: "Strength, cardio, mobility." },
      { key: "nutrition", icon: "leaf", title: "Nutrition", body: "Sustainable, not crash diets." },
      { key: "sleep", icon: "moon", title: "Sleep", body: "The foundation of it all." },
      { key: "mental", icon: "brain", title: "Mental wellness", body: "Stress, resilience, clarity." },
    ] }),
    s({ type: "checklist", theme: "light", columns: 2, kicker: "The assessment", heading: "See what's actually happening inside your body.", items: [
      "50+ blood markers — reviewed by a physician", "Body composition, measured properly",
      "A lifestyle questionnaire across all four pillars", "Your Lifestyle Score (0–10)",
      "Plain-language results, no jargon", "A personalised plan built from your numbers",
    ] }),
    s({ type: "phone-feature", theme: "dark", kicker: "What you get out of it", heading: "Clarity — and a starting line.", phone: IMG.appHealth, bullets: [
      "Your real numbers, explained simply.", "Your Lifestyle Score across all four pillars.",
      "A plan calibrated to your results and goals.", "A physician has looked at your health.",
    ] }),
    s({ type: "quote", theme: "light", kicker: "Why it sticks", quote: "Knowing was never the problem. Lifeline turns it into a daily plan that ==actually happens.==", lead: "Small daily wins, streaks, community and a coach in your corner — ~65% more likely to reach your goals with an accountability partner." }),
    s({ type: "statement", theme: "dark", kicker: "Privacy", heading: "Your data stays yours. Your employer ==never sees your numbers.==", lead: "They fund the benefit; they only ever see anonymous, aggregate participation. GDPR-compliant, encrypted, clinically governed." }),
    s({ type: "app-showcase", theme: "dark", tag: "Coming soon", kicker: "The Lifeline app", heading: "Everything in your pocket.", phones: [IMG.appReport, IMG.appCommunity, IMG.appMeasurements], bullets: [
      "Today — daily actions by time of day.", "My Health — score, biomarkers, trends.",
      "Health Coach — programs and lessons.", "Wearables — Apple Health & Android sync.",
      "Community — friends, challenges, streaks.", "Wellness Pulse — a monthly check-in.",
    ] }),
    s({ type: "coaching", theme: "light", kicker: "Coaching", heading: "Smart guidance, and real humans.", lead: "An AI coach handles the day-to-day; a human coach is there for what matters.", phone: IMG.appCoach, cards: [
      { icon: "spark", title: "AI coach — always on", body: "The right next action, every day." },
      { icon: "users", title: "Personal coach", body: "Reviews your data, adjusts your plan." },
      { icon: "cal", title: "Quarterly doctor call", body: "Optional — four times a year, by video." },
    ] }),
    s({ type: "hero-image", theme: "dark", image: IMG.banner, kicker: "Getting started", heading: "The next best time is ==today.==", lead: "Book your assessment, and we'll take it from there.", tagline: "Ahead of yourself." }),
  ];
}

// ── Lifeline + Fjarlækningar — joint showcase ────────────────────────────────
// Lifeline content (the Health Check assessment process, the four pillars of
// health, and why coaching works), then Fjarlækningar, then a team slide per
// company. Each slide carries its own `brand`, so the header wordmark + accent
// colours switch between the two companies (see DeckAssets `Logo`, deck-css
// brand-fjar). Copy is drawn from the lifelinehealth.is assessment + coaching
// pages and the Fjarlækningar concept.
export function lifelineFjarlaekningarDeck(): Slide[] {
  return [
    // 1 · Lifeline — the Health Check (assessment process)
    s({ type: "steps", theme: "light", brand: "lifeline",
      kicker: "Lifeline Health · The Health Check",
      heading: "The assessment process",
      steps: [
        { title: "Book your assessment", body: "Open the patient portal and choose the Foundational Health or Check-in package, at a time that suits you." },
        { title: "Visit our station", body: "Come to our Lágmúla 5 station in Reykjavík for your body-composition scan and measurements — about 20 minutes." },
        { title: "Blood test at Sameind", body: "Visit any Sameind collection station for your blood panel. Results are sent directly to Lifeline." },
        { title: "Results reviewed", body: "A Lifeline physician reviews all your results and prepares your personalised health report." },
        { title: "Doctor interview", body: "Meet your doctor — in person or by video — to discuss your results, your health score across the four pillars, and personalised recommendations." },
      ] }),
    // 2 · Lifeline — the four pillars of health (coaching framework)
    s({ type: "pillars", theme: "dark", brand: "lifeline",
      kicker: "Lifeline Health · Coaching",
      heading: "The four pillars of health",
      lead: "Knowledge alone doesn't create change. Coaching bridges the gap between knowing and doing.",
      pillars: [
        { key: "exercise", icon: "dumbbell", title: "Exercise", body: "Personalised programs for your level — strength, cardio and mobility — that progress as you do." },
        { key: "nutrition", icon: "apple", title: "Nutrition", body: "Guidance from your blood work and body composition. Sustainable habits, not fad diets." },
        { key: "sleep", icon: "moon", title: "Sleep", body: "Science-backed optimisation for better recovery, energy and focus." },
        { key: "mental", icon: "smile", title: "Mental wellness", body: "Mindfulness, breathing and stress tools — with a supportive community." },
      ] }),
    // 3 · Lifeline — why coaching works (beside the app)
    s({ type: "phone-feature", theme: "dark", brand: "lifeline",
      kicker: "Lifeline Health · Coaching",
      heading: "Why health coaching works",
      bullets: [
        "Create real change — programs built on your blood work and body composition, not generic templates.",
        "Daily action plans — a clear plan every day across exercise, nutrition, sleep and mental wellness.",
        "Connect with coaches — message your coach for answers, adjustments and support when you need it.",
        "Join the community — events, challenges and a network on the same journey.",
        "Motivation that lasts — progress tracking, streaks and health scores keep you engaged.",
      ],
      phone: IMG.lifelineApp }),
    // 4 · Fjarlækningar elevator pitch — laptop screenshot of the web app
    s({ type: "report", theme: "dark", brand: "fjarlaekningar",
      kicker: "Fjarlækningar",
      heading: "Care that skips the ==waiting room.==",
      lead: "An asynchronous telemedicine service, built by Icelandic doctors and specialists. Pick your concern, answer a focused questionnaire, and a physician reviews it and prescribes treatment — no appointment needed.",
      bullets: [
        "Choose from a menu of common medical problems.",
        "Answer a focused questionnaire — with a home test where it helps: urine stick, strep, CRP.",
        "A doctor reviews your answers and prescribes the right treatment.",
        "First pilot underway with South Iceland Primary Health Care.",
      ],
      image: IMG.fjarApp }),
    // 5 · The teams — both companies on one page
    s({ type: "team-branch", theme: "light", brand: "lifeline",
      kicker: "The teams",
      heading: "The people behind both companies.",
      branch1Brand: "lifeline", branch1Label: "",
      branch1: [
        { photo: IMG.fjarVictor, flag: "Co-founder & CEO", name: "Victor Guðmundsson", role: "Medical Doctor" },
        { photo: IMG.fjarMads, flag: "Co-founder & CTO", name: "Mads Christian Aanesen", role: "Medical Doctor" },
        { photo: IMG.vignir, flag: "Chief Medical Advisor", name: "Vignir Sigurðsson", role: "Pediatrician" },
        { photo: IMG.fjarDagbjort, flag: "Clinical", name: "Dagbjört Guðbrandsdóttir", role: "Medical Doctor" },
      ],
      branch2Brand: "fjarlaekningar", branch2Label: "",
      branch2: [
        { photo: IMG.fjarVictor, flag: "Co-founder & CEO", name: "Victor Guðmundsson", role: "Medical Doctor" },
        { photo: IMG.fjarMads, flag: "Co-founder & CTO", name: "Mads Christian Aanesen", role: "Medical Doctor" },
        { photo: IMG.fjarGudbjartur, flag: "Chief Medical Officer", name: "Guðbjartur Ólafsson", role: "Specialist Doctor" },
        { photo: IMG.fjarElvar, flag: "Chief Marketing Officer", name: "Elvar Páll Sigurðsson", role: "Marketing" },
      ] }),
  ];
}

// ── Investor deck — 4 slides per company (History · Concept · Clients · Team)
// Informational and boastful, no metrics. Reuses the team photos, app
// screenshots, brand colours and four-pillars content from the showcase deck.
export function investorDeck(): Slide[] {
  return [
    // ===== OPENING, ADDRESSED TO KRY =====
    // 1 · Title. A full-bleed slide because the composed image carries its own
    // wordmarks and title, and fullbleed is the one type that suppresses the
    // corner logo — two logos in the corner and two in the middle would clash.
    s({ type: "fullbleed", theme: "dark", fit: "cover",
      image: "/presentation-images/intro-kry.svg" }),

    // 2 · Where the two sides differ, in one look. Kry's own description of
    // itself is "digi-physical" — the breadth of a primary care centre across
    // app and its own clinics (kry.se, kry.health/technology). The contrast
    // worth drawing is therefore not better-or-worse but shape: they cover
    // everything synchronously; we go deep on a narrow scope with no
    // appointment at all, and on prevention that continues afterwards.
    s({ type: "fan", theme: "light",
      kicker: "Where we fit",
      heading: "Two things that happen ==outside the appointment.==",
      lead: "Kry covers the whole of primary care, digitally and in its own clinics. We do the two parts that sit either side of a booked consultation: care that needs no appointment at all, and prevention that keeps going after it ends.",
      hideLogo: "hide",
      fan1Title: "", fan1Logo: "/presentation-images/head-kry.svg",
      fan1: [
        { value: "Breadth", body: "A primary care centre's full range.",
          points: "Doctors, nurses, psychologists, physiotherapists, midwives, dietitians\nSpecialist care, vaccination and health checks\nOne record across app and clinic" },
        { value: "Digi-physical", body: "Digital support blended with physical clinics, across several markets." },
        { value: "In the appointment", body: "Care is delivered in a booked meeting — video, chat or in person." },
      ],
      fan2Title: "", fan2Logo: "/presentation-images/head-fjar-lifeline.svg",
      fan2: [
        { value: "No appointment at all", body: "Written care, start to finish.",
          points: "A defined list of erindi, each with its own clinical questionnaire\nPatient answers, a doctor decides, answer within two hours\nPrescription straight to the lyfjagátt" },
        { value: "Prevention with follow-up", body: "Blood panel, body composition and a doctor's report — then months of coaching, not a single consultation." },
        { value: "Inside the public system", body: "Built with HSU, referring back into ordinary care whenever a case needs examining." },
      ] }),

    // ===== FJARLÆKNINGAR =====
    // F1 · Company / history
    s({ type: "bullets", theme: "dark", brand: "fjarlaekningar",
      kicker: "Fjarlækningar · Company",
      heading: "Icelandic telemedicine, built for ==primary care.==",
      lead: "Fjarlækningar is an Icelandic telemedicine company focused on primary health care — a doctor's assessment, reachable from home.",
      chips: [{ label: "Established 2021" }, { label: "Primary care" }],
      bullets: [
        "Focused on primary health care, delivered remotely.",
        "In close collaboration with Lyfja — Iceland's largest pharmacy chain.",
        "Bringing a doctor's care within reach, from anywhere in the country.",
      ] }),
    // F2 · Concept — how it works (laptop screenshot)
    s({ type: "report", theme: "dark", brand: "fjarlaekningar",
      kicker: "Fjarlækningar · How it works",
      heading: "Care that skips the ==waiting room.==",
      lead: "An asynchronous telemedicine service, built by Icelandic doctors and specialists. Pick your concern, answer a focused questionnaire, and a physician reviews it and prescribes treatment — no appointment needed.",
      bullets: [
        "Log in from your PC or phone, and choose from a menu of common medical problems.",
        "Answer a focused questionnaire — with a home test where it helps: urine stick, strep, CRP.",
        "A doctor reviews your answers and prescribes the right treatment.",
        "First pilot underway with South Iceland Primary Health Care.",
      ],
      image: IMG.fjarApp }),
    // F3 · Clients & collaborations — two groups of cards
    s({ type: "fan", theme: "light", brand: "fjarlaekningar",
      kicker: "Fjarlækningar · Clients & collaborations",
      heading: "From the health service to your ==doorstep.==",
      fan1Title: "Clients", fan1Icon: "shield",
      fan1: [
        { value: "HSU — South Iceland", body: "Heilbrigðisstofnun Suðurlands, the Health Care Institution of South Iceland — our first pilot." },
        { value: "Expanding nationwide", body: "Collaborations underway with the North, West and East of Iceland." },
      ],
      fan2Title: "Collaborations", fan2Icon: "leaf",
      fan2: [
        { value: "Lyfja", body: "Iceland's largest pharmacy chain — over 40 pharmacies nationwide.",
          points: "Home delivery of medication and home-test kits, straight to the patient.\nA new level of service — convenience and care, end to end." },
      ] }),
    // F4 · Team
    s({ type: "team", theme: "light", brand: "fjarlaekningar",
      kicker: "Fjarlækningar · Team",
      heading: "The people behind ==Fjarlækningar.==",
      members: [
        { photo: IMG.fjarVictor, flag: "Co-founder & CEO", name: "Victor Guðmundsson", role: "Medical Doctor" },
        { photo: IMG.fjarMads, flag: "Co-founder & CTO", name: "Mads Christian Aanesen", role: "Medical Doctor" },
        { photo: IMG.fjarGudbjartur, flag: "Chief Medical Officer", name: "Guðbjartur Ólafsson", role: "Specialist Doctor" },
        { photo: IMG.fjarElvar, flag: "Chief Marketing Officer", name: "Elvar Páll Sigurðsson", role: "Marketing" },
      ] }),

    // ===== LIFELINE =====
    // L1 · Company / history (the four pillars)
    s({ type: "pillars", theme: "dark", brand: "lifeline",
      kicker: "Lifeline Health · Company",
      heading: "Holistic health, ==proactive by design.==",
      lead: "Lifeline Health helps people take care of their health across the four pillars — proactive, not reactive.",
      pillars: [
        { key: "exercise", icon: "dumbbell", title: "Exercise", body: "Programs for your level — strength, cardio and mobility." },
        { key: "nutrition", icon: "apple", title: "Nutrition", body: "Guidance built on your results — sustainable, not fad diets." },
        { key: "sleep", icon: "moon", title: "Sleep", body: "Better recovery, energy and focus." },
        { key: "mental", icon: "smile", title: "Mental health", body: "Mindfulness, resilience and a supportive community." },
      ] }),
    // L2 · Health assessment — the assessment process (numbered) + report laptop
    s({ type: "report", theme: "dark", brand: "lifeline", numbered: true,
      kicker: "Lifeline Health · Health assessment",
      heading: "The assessment process",
      lead: "Health checks by nurses and doctors — on-site and remotely — turned into a personal health report.",
      bullets: [
        "Book your assessment — choose the Foundational Health or Check-in package.",
        "Visit our station in Reykjavík for a body-composition scan and measurements.",
        "Blood test at Sameind — results sent directly to Lifeline.",
        "A Lifeline physician reviews everything and prepares your personal health report.",
        "A doctor interview to discuss your results, score and recommendations.",
      ],
      image: IMG.appReport }),
    // L3 · Health coaching — why coaching works (reworded header)
    s({ type: "phone-feature", theme: "dark", brand: "lifeline",
      kicker: "Lifeline Health · Health coaching",
      heading: "Coaching that turns knowing into ==doing.==",
      lead: "Knowledge alone doesn't create change — coaching bridges the gap between knowing and doing.",
      bullets: [
        "Create real change — programs built on your blood work and body composition, not generic templates.",
        "Daily action plans — a clear plan every day across exercise, nutrition, sleep and mental wellness.",
        "Connect with coaches — message your coach for answers, adjustments and support.",
        "Join the community — events, challenges and a network on the same journey.",
        "Motivation that lasts — progress tracking, streaks and health scores keep you engaged.",
      ],
      phone: IMG.lifelineApp }),
    // L4 · Clients & partners — one card per client / municipality / partner
    s({ type: "cards", theme: "light", brand: "lifeline", columns: 4,
      kicker: "Lifeline Health · Clients & partners",
      heading: "Growing across ==Iceland.==",
      cards: [
        { icon: "shield", title: "Hafnarfjörður", body: "Municipality" },
        { icon: "shield", title: "Vestmannaeyjabær", body: "Municipality" },
        { icon: "users", title: "Companies", body: "Capital region & beyond" },
        { icon: "spark", title: "Pharmacies & gyms", body: "B2C — launching soon" },
        { icon: "leaf", title: "Lyfja", body: "Pharmacy chain" },
        { icon: "chart", title: "Sameind", body: "Blood-work clinic" },
        { icon: "doc", title: "LAK · Akureyri", body: "Clinicians, the North" },
        { icon: "phone", title: "Remote", body: "Nationwide reach" },
      ] }),
    // L5 · Team
    s({ type: "team", theme: "light", brand: "lifeline",
      kicker: "Lifeline Health · Team",
      heading: "The people behind ==Lifeline.==",
      members: [
        { photo: IMG.fjarVictor, flag: "Co-founder & CEO", name: "Victor Guðmundsson", role: "Medical Doctor" },
        { photo: IMG.fjarMads, flag: "Co-founder & CTO", name: "Mads Christian Aanesen", role: "Medical Doctor" },
        { photo: IMG.vignir, flag: "Chief Medical Advisor", name: "Vignir Sigurðsson", role: "Pediatrician" },
        { photo: IMG.fjarDagbjort, flag: "Clinical", name: "Dagbjört Guðbrandsdóttir", role: "Medical Doctor" },
      ] }),
    // L6 · Future plans (the App + the Health House)
    s({ type: "feature-rows", theme: "light", brand: "lifeline",
      kicker: "Lifeline Health · Future plans",
      heading: "Where Lifeline is ==headed.==",
      rows: [
        { icon: "phone", title: "Lifeline Health — the App", body: "A health club, community and coach. All your data and health in one place — exercise, nutrition, sleep and mental wellbeing — with a living plan tailored to you, daily." },
        { icon: "leaf", title: "Lifeline Health — Health House", body: "Heilsuhús / Lífstílsklíník — a lifestyle clinic bringing the whole experience together under one roof." },
      ] }),
    // L7 · Our goal — a health revolution
    s({ type: "timeline", theme: "dark", brand: "lifeline",
      kicker: "Lifeline Health · Our goal",
      heading: "A health revolution starts in ==people.==",
      nodes: [
        { icon: "spark", title: "One person", body: "More energy." },
        { icon: "target", title: "A better life", body: "At home and at work." },
        { icon: "users", title: "It spreads", body: "To partner, children, friends and family." },
        { icon: "pulse", title: "Society shifts", body: "Communities start to change." },
        { icon: "shield", title: "All of Iceland", body: "A healthier nation." },
      ],
      lead: "Healthier individuals create healthier families, workplaces and communities — and that changes a country." }),
  ];
}

// ── World Class × Lifeline — gym-chain partnership deck ──────────────────────
// Pitches the Lifeline collaboration to the World Class gym chain. World Class
// slides carry brand "worldclass" (red), Lifeline app slides carry "lifeline".
export function worldclassDeck(): Slide[] {
  return [
    // 1 · Title
    s({ type: "title", theme: "dark", brand: "worldclass",
      kicker: "A health partnership",
      heading: "Lifeline × ==World Class==",
      lead: "Bringing clinical-grade health checks, coaching and nutrition into Iceland's largest gym network.",
      tagline: "Better health, better life." }),
    // 2 · Measurements at the gym
    s({ type: "bullets", theme: "light", brand: "worldclass",
      kicker: "At the gym · Measurements",
      heading: "Your health check, ==where you train.==",
      lead: "Members measure their body composition and blood pressure right at World Class — no clinic visit needed.",
      chips: [{ label: "Body composition" }, { label: "Blood pressure" }],
      bullets: [
        "A body-composition scan, on site at the gym.",
        "Blood-pressure measurement alongside it.",
        "Results flow straight into the Lifeline app — scored and explained.",
      ] }),
    // 3 · The health assessment — the gym measurement is step one
    s({ type: "report", theme: "light", brand: "lifeline", numbered: true,
      kicker: "Health assessment",
      heading: "The first step in a full ==health assessment.==",
      lead: "The measurement station at World Class is step one — the start of a complete Lifeline health assessment.",
      bullets: [
        "Measurements at the gym — body composition and blood pressure.",
        "A blood test for a full panel of markers.",
        "A health questionnaire, designed by our doctors.",
        "Your personal health report — every marker scored and explained.",
        "A doctor interview to walk through your results and plan.",
      ],
      image: IMG.appReport }),
    // 4 · Nutrition station at Laugar
    s({ type: "bullets", theme: "dark", brand: "worldclass",
      kicker: "At the gym · Nutrition",
      heading: "A nutrition station at ==Laugar.==",
      lead: "World Class Laugar already has an in-house restaurant serving clean food — together we make it a Lifeline nutrition station.",
      bullets: [
        "Clean, healthy food already on site.",
        "Nutrition guidance tied to your own results.",
        "Eat to your plan, right after you train.",
      ] }),
    // 5 · The app, community & classes
    s({ type: "phone-feature", theme: "dark", brand: "lifeline",
      kicker: "The app · Community",
      heading: "The Lifeline app, ==connected to World Class.==",
      lead: "Your Lifeline community links straight to World Class — the classes, trainers and people you train with.",
      bullets: [
        "Discover and book World Class group classes.",
        "Connect with World Class personal trainers.",
        "One community across the gym and the app.",
      ],
      phone: IMG.appCommunity }),
    // 6 · In-app programs linked to gym classes
    s({ type: "feature-rows", theme: "light", brand: "lifeline",
      kicker: "The app · Programs",
      heading: "Your plan, ==in the class schedule.==",
      rows: [
        { icon: "cal", title: "Programs map to classes", body: "Each step in your Lifeline program links to a real World Class class." },
        { icon: "dumbbell", title: "Matched to your plan", body: "Spinning, strength, yoga, HIIT — the right class for the right day." },
        { icon: "users", title: "Train together", body: "Follow your plan in a room full of people, with a coach up front." },
      ] }),
    // 7 · Co-marketing health events
    s({ type: "bullets", theme: "dark", brand: "worldclass",
      kicker: "Together · Marketing",
      heading: "Health events, ==co-hosted.==",
      lead: "Lifeline and World Class run joint health events — building awareness, members and momentum for both brands.",
      bullets: [
        "Co-branded health challenges and pop-ups.",
        "Shared reach across both communities.",
        "One message: better health, better life.",
      ] }),
    // 8 · Closing
    s({ type: "closing", theme: "dark", brand: "worldclass",
      kicker: "Together",
      heading: "Better health, ==built into the gym.==",
      lead: "Lifeline × World Class — clinical health, nutrition and coaching, where Iceland already trains.",
      tagline: "Better health, better life." }),
  ];
}

// ── 2. KEYNOTE — minimal, one idea per slide: statements + metrics ───────────
export function keynoteDeck(): Slide[] {
  return [
    s({ type: "title", theme: "dark", kicker: "Lifeline", heading: "Ahead of\n==yourself.==", lead: "A 30-minute introduction.", tagline: "Welcome." }),
    s({ type: "statement", theme: "dark", heading: "Most health apps give you a step counter and call it a day." }),
    s({ type: "statement", theme: "light", kicker: "Lifeline is different", heading: "It starts with your ==real health data.==" }),
    s({ type: "metric", theme: "dark", kicker: "The problem", value: "80%", heading: "of chronic disease is preventable.", lead: "Yet the decade before illness goes completely unmanaged." }),
    s({ type: "metric", theme: "light", kicker: "Iceland", value: "59%", heading: "are overweight or obese — the highest rate in Europe.", lead: "Prevention has never mattered more." }),
    s({ type: "statement", theme: "dark", kicker: "Our purpose", heading: "Create ==real, lasting change== — not more information." }),
    s({ type: "pillars", theme: "light", kicker: "The model", heading: "Four pillars.", pillars: [
      { key: "exercise", icon: "dumbbell", title: "Exercise", body: "" },
      { key: "nutrition", icon: "leaf", title: "Nutrition", body: "" },
      { key: "sleep", icon: "moon", title: "Sleep", body: "" },
      { key: "mental", icon: "brain", title: "Mental wellness", body: "" },
    ] }),
    s({ type: "statement", theme: "dark", kicker: "The assessment", heading: "See what's actually happening ==inside your body.==", lead: "Blood panel, body composition, lifestyle — reviewed by a physician." }),
    s({ type: "metric", theme: "light", kicker: "Your number", value: "7.6", heading: "Your Lifestyle Score.", lead: "One 0–10 number across all four pillars — that you can watch move." }),
    s({ type: "statement", theme: "dark", kicker: "Privacy", heading: "Your employer ==never sees your numbers.==", lead: "Anonymous, aggregate participation only. GDPR-compliant, encrypted." }),
    s({ type: "phone-feature", theme: "dark", tag: "Coming soon", kicker: "The app", heading: "Everything in your pocket.", phone: IMG.appHealth, bullets: [
      "Daily actions, score and trends.", "An AI coach, plus a human one.", "Community, streaks and a monthly pulse.",
    ] }),
    s({ type: "statement", theme: "light", kicker: "Getting started", heading: "The best time was years ago.\nThe next best time is ==today.==", lead: "Questions? Now's the time." }),
  ];
}

// ── 3. CLINICAL — data/report feel: metrics, checklists, steps ───────────────
export function clinicalDeck(): Slide[] {
  return [
    s({ type: "title", theme: "dark", kicker: "Lifeline Health · Employee programme", heading: "A clinical-grade health benefit, ==explained.==", lead: "What it is, how the assessment works, and what you get.", tagline: "30 minutes." }),
    s({ type: "feature-rows", theme: "light", kicker: "Overview", heading: "Three things Lifeline gives you.", rows: [
      { icon: "clip", title: "Assessment", body: "Blood panel, body composition and a lifestyle questionnaire, reviewed by a physician." },
      { icon: "target", title: "Plan", body: "A personalised programme across exercise, nutrition, sleep and mental wellness." },
      { icon: "pulse", title: "Daily action", body: "Specific actions each day that adapt as your results improve." },
    ] }),
    s({ type: "metric", theme: "dark", kicker: "Why prevention", value: "80%", heading: "of chronic disease is preventable through daily habits.", lead: "Lifeline is the complement to the healthcare system — the part that keeps you out of it." }),
    s({ type: "steps", theme: "light", kicker: "The assessment process", heading: "Six steps, mostly done for you.", steps: [
      { title: "Book", body: "A clinic station, or on-site at your workplace." },
      { title: "Blood test", body: "A quick, standard draw; results return into Lifeline." },
      { title: "Body composition", body: "A short, non-invasive measurement." },
      { title: "Questionnaire", body: "About 10 minutes in the app." },
      { title: "Physician review", body: "A doctor confirms what's safe and where to focus." },
      { title: "Results", body: "Your numbers, your score and your plan." },
    ] }),
    s({ type: "checklist", theme: "dark", columns: 2, kicker: "What's measured", heading: "Your assessment, in detail.", items: [
      "Cholesterol & lipid panel", "Blood sugar & metabolic markers", "Inflammation (CRP)", "Liver & kidney function",
      "Thyroid function", "Body fat & lean mass", "Blood pressure", "50+ markers in total",
    ] }),
    s({ type: "metric", theme: "light", kicker: "Your result", value: "0–10", heading: "The Lifestyle Score.", lead: "A single number across all four pillars, with a per-pillar breakdown you can track over time.", footnote: "Known in the app as Lífstílseinkunn." }),
    s({ type: "feature-rows", theme: "light", kicker: "After the assessment", heading: "From numbers to change.", rows: [
      { icon: "chart", title: "Structured programmes", body: "4–12 weeks per pillar, matched to your level." },
      { icon: "target", title: "A daily action plan", body: "Morning, midday and evening — and it adapts." },
      { icon: "doc", title: "Quarterly doctor review", body: "Optional video check-in, four times a year." },
    ] }),
    s({ type: "bullets", theme: "dark", kicker: "Privacy & security", heading: "Your data stays yours.", lead: "Health data is the most personal data there is.", chips: [{ label: "GDPR" }, { label: "Encrypted" }, { label: "Clinically governed" }], bullets: [
      "Your employer never sees individual results — only anonymous, aggregate participation.",
      "You control what the app reads from your phone or wearable.",
      "Only your care team can see your health data, under clinical confidentiality.",
    ] }),
    s({ type: "app-showcase", theme: "dark", tag: "Coming soon", kicker: "The app", heading: "Your data, in your pocket.", phones: [IMG.appReport, IMG.appHealth, IMG.appMeasurements], bullets: [
      "My Health — score, biomarkers, body composition.", "Programs across all four pillars.",
      "Wearable sync — steps, heart rate, HRV, sleep.", "Coach messaging and video consultations.",
    ] }),
    s({ type: "statement", theme: "light", kicker: "Getting started", heading: "Book your assessment to ==begin.==", lead: "It's the starting line — the rest follows from your numbers." }),
  ];
}

// ── 4. ENERGETIC — motivational, punchy: bold statements + metrics ───────────
export function energeticDeck(): Slide[] {
  return [
    s({ type: "title", theme: "dark", bg: IMG.hero, kicker: "Let's go", heading: "Your best decade ==starts now.==", lead: "A 30-minute look at the health benefit built for you.", tagline: "Ahead of yourself." }),
    s({ type: "statement", theme: "light", heading: "You already know what to do. Lifeline makes it ==actually happen.==" }),
    s({ type: "metric", theme: "dark", value: "3–5", kicker: "Every day", heading: "small actions, calibrated to you.", lead: "Achievable beats overwhelming, every single time." }),
    s({ type: "pillars", theme: "light", kicker: "Four pillars", heading: "Train all of you.", pillars: [
      { key: "exercise", icon: "dumbbell", title: "Move", body: "Strength, cardio, mobility." },
      { key: "nutrition", icon: "leaf", title: "Fuel", body: "Sustainable eating." },
      { key: "sleep", icon: "moon", title: "Recover", body: "Sleep is the foundation." },
      { key: "mental", icon: "brain", title: "Focus", body: "A clearer, calmer mind." },
    ] }),
    s({ type: "metric", theme: "dark", value: "65%", kicker: "The science of sticking", heading: "more likely to hit your goals with an accountability partner.", lead: "Streaks, community and a coach — Lifeline builds it in." }),
    s({ type: "statement", theme: "light", kicker: "It starts with data", heading: "Real blood work. Real body composition. A ==real plan.==" }),
    s({ type: "phone-feature", theme: "dark", tag: "Coming soon", kicker: "Your pocket coach", heading: "Wake up knowing exactly what to do.", phone: IMG.appHealth, bullets: [
      "Daily actions and quick workouts.", "Your Lifestyle Score, climbing.", "Friends, challenges and streaks.",
    ] }),
    s({ type: "checklist", theme: "light", columns: 2, kicker: "What you get", heading: "All of this.", items: [
      "Your real numbers", "Your Lifestyle Score", "A four-pillar plan", "A coach in your corner",
      "Community & streaks", "A physician review",
    ] }),
    s({ type: "statement", theme: "dark", kicker: "Your call", heading: "Book the assessment. ==Start today.==", lead: "Your employer never sees your numbers — this one's just for you." }),
  ];
}

// ── 5. BROCHURE — wellness brochure: image-led, soft, checklists + cards ──────
export function brochureDeck(): Slide[] {
  return [
    s({ type: "title", theme: "dark", bg: IMG.banner, kicker: "Welcome to Lifeline", heading: "Health, made\n==human.==", lead: "A gentle 30-minute introduction to the benefit your workplace is giving you.", tagline: "Ahead of yourself." }),
    s({ type: "hero-image", theme: "light", image: IMG.hero, kicker: "What we do", heading: "Prevention, made part of daily life.", lead: "Lifeline is the layer between the healthcare system and the habits that decide whether you ever need it.", tagline: "Born in Iceland." }),
    s({ type: "pillars", theme: "light", kicker: "Four pillars", heading: "One connected system.", lead: "Treated together, not in isolation.", pillars: [
      { key: "exercise", icon: "dumbbell", title: "Exercise", body: "Matched to your level." },
      { key: "nutrition", icon: "leaf", title: "Nutrition", body: "Sustainable eating." },
      { key: "sleep", icon: "moon", title: "Sleep", body: "The foundation." },
      { key: "mental", icon: "brain", title: "Mental wellness", body: "A clearer mind." },
    ] }),
    s({ type: "checklist", theme: "light", columns: 1, kicker: "The assessment", heading: "It all starts here.", items: [
      "A blood panel of 50+ markers, reviewed by a physician",
      "Body composition, measured properly",
      "A lifestyle questionnaire across all four pillars",
      "Your Lifestyle Score and a personalised plan",
    ] }),
    s({ type: "cards", theme: "light", columns: 2, kicker: "What you get out of it", heading: "Clarity, and a starting line.", cards: [
      { icon: "chart", title: "Your numbers", body: "Explained in plain language — no jargon." },
      { icon: "target", title: "Your plan", body: "Calibrated to your results and goals." },
      { icon: "spark", title: "Your score", body: "One 0–10 number to watch move." },
      { icon: "doc", title: "Peace of mind", body: "A physician has looked at your health." },
    ] }),
    s({ type: "phone-feature", theme: "dark", tag: "Coming soon", kicker: "The Lifeline app", heading: "Your gentle daily companion.", phone: IMG.appHealth, bullets: [
      "Small daily actions, organised for you.", "Your score and trends, beautifully simple.",
      "A coach when you want one.", "Community, at your own pace.",
    ] }),
    s({ type: "coaching", theme: "light", kicker: "Coaching", heading: "Guidance, whenever you want it.", lead: "An AI coach for every day; a human coach for the moments that matter.", phone: IMG.appCoach, cards: [
      { icon: "spark", title: "AI coach", body: "Always-on recommendations." },
      { icon: "users", title: "Personal coach", body: "Message anytime." },
      { icon: "cal", title: "Quarterly doctor call", body: "Optional, four times a year." },
    ] }),
    s({ type: "bullets", theme: "dark", kicker: "Your privacy", heading: "Your data stays yours.", lead: "Your employer never sees your individual results — only anonymous participation.", chips: [{ label: "GDPR" }, { label: "Encrypted" }], bullets: [
      "You control what the app can access.", "Only your care team sees your health data.", "Built in Europe, under European rules.",
    ] }),
    s({ type: "hero-image", theme: "dark", image: IMG.banner, kicker: "Getting started", heading: "We'd love to ==meet you.==", lead: "Book your assessment, and we'll take it from there.", tagline: "Ahead of yourself." }),
  ];
}


// ── HSU × Lifeline — "Heilsa til framtíðar" public-health partnership deck ───
// Board pitch to Heilbrigðisstofnun Suðurlands for a pilot in Vestmannaeyjar:
// HSU opens the blood panel and a sjúkraliði measurement slot, Lifeline does
// the heilsumat, the læknisviðtal and the lifestyle follow-up, and refers
// anything medical back into hefðbundna þjónustu.
//
// Source text is English (repo convention); the Icelandic the board actually
// sees is hand-written in hsuDeckIs() rather than machine-translated, using the
// vocabulary our own doctor-edited documents use — heilsumat, læknisviðtal,
// blóðrannsókn, líkamssamsetningarmæling, "vísað aftur í hefðbundna þjónustu".
// The deck viewer defaults to Icelandic whenever an overlay exists.
//
// Deliberately makes NO promise of health outcomes or savings for HSU: one
// slide states outright that the population-health effect is the hypothesis
// the pilot exists to measure. Keep it that way — it is the honest position
// and the one that survives a room full of clinicians.
export function hsuDeck(): Slide[] {
  return [
    // 1 · Title
    s({ type: "title", theme: "dark", bg: IMG.hero,
      kicker: "Partnership proposal · Pilot project",
      heading: "Heilsa til ==framtíðar==",
      lead: "A health assessment, measurements and a lifestyle plan for the people of Vestmannaeyjar — built on top of the heilsugæsla that is already there.",
      tagline: "HSU × Lifeline Health" }),

    // 2 · The problem
    s({ type: "cards", theme: "light", columns: 3,
      kicker: "Where we are",
      heading: "Lifestyle walks into the heilsugæsla and never properly walks out.",
      cards: [
        { icon: "cal", title: "The appointment is too short", body: "Sleep, nutrition, movement and stress do not fit into an ordinary consultation — and they sit underneath a large share of what comes through the door." },
        { icon: "target", title: "Nobody follows the change", body: "Advice is given, but there is no structured way to follow it up month after month. Without follow-up, little changes." },
        { icon: "users", title: "People go and find it themselves", body: "Residents already buy measurements and health assessments privately — mostly in the capital, with no link back to their own heilsugæsla." },
      ] }),

    // 3 · The idea
    s({ type: "statement", theme: "dark",
      kicker: "The idea",
      heading: "One visit. A doctor's assessment. ==A plan somebody follows up on.==",
      lead: "HSU keeps what is medical — diagnosis, treatment, medication and chronic disease. Lifeline takes the lifestyle work, with follow-up that runs for months. Neither party takes on what the other does better, and the resident does not have to choose between them." }),

    // 4 · The journey
    s({ type: "timeline", theme: "light",
      kicker: "The route",
      heading: "Five steps from measurement to plan.",
      nodes: [
        { icon: "drop", title: "One visit", body: "Blood panel, blood pressure and a body-composition measurement. HSU sjúkraliði, about 25 minutes." },
        { icon: "clip", title: "Questionnaire", body: "Sleep, nutrition, movement, mental wellbeing and history — answered at home in Medalia." },
        { icon: "doc", title: "The assessment", body: "A Lifeline doctor works the measurements and the answers into a single clinical risk assessment." },
        { icon: "phone", title: "Doctor consultation", body: "Thirty minutes by video, where the doctor goes through the assessment with the participant." },
        { icon: "spark", title: "The plan", body: "Lifestyle plan, follow-up and motivational support from Lifeline, month after month." },
      ],
      lead: "Should the participant need examination or further investigation, the case goes to HSU — with the measurements and the assessment attached." }),

    // 5 · The circular model, drawn
    s({ type: "fullbleed", theme: "dark", fit: "contain",
      image: "/presentation-images/hringras-hsu-lifeline.svg",
      kicker: "The model",
      heading: "A circle, ==not a one-way street.==" }),

    // 6 · Division of labour
    s({ type: "cards", theme: "light", columns: 3,
      kicker: "Division of labour",
      heading: "Who does what.",
      cards: [
        { icon: "doc", title: "HSU", body: "Opens access to the blood panel. A sjúkraliði measures blood pressure and body composition. Receives referrals from Lifeline. Diagnoses, treats and follows up. Supports the submission to Landlæknir." },
        { icon: "spark", title: "Lifeline", body: "Questionnaire and platform. The doctor's assessment and report. A thirty-minute consultation. Lifestyle plan and motivational support. Refers back into ordinary care where needed." },
        { icon: "users", title: "The participant", body: "Comes to one measurement visit. Answers the questionnaire at home. Takes the thirty-minute consultation. Carries out the plan with support. Returns for re-measurement." },
      ] }),

    // 7 · Clinical and regulatory footing — what a clinician board wants to hear
    s({ type: "cards", theme: "dark", columns: 2,
      kicker: "Professional footing",
      heading: "This is clinical work, on clinical foundations.",
      cards: [
        { icon: "chart", title: "Recognised risk algorithms", body: "The assessment uses established standardised risk instruments such as SCORE2, alongside risk models developed by Lifeline's own medical team." },
        { icon: "doc", title: "A doctor carries the assessment", body: "Interpretation of results and all recommendations are made by a physician working for Lifeline Health — not by an algorithm and not by a coach." },
        { icon: "lock", title: "Recorded in a sjúkraskrárkerfi", body: "Everything is recorded and retained in the Medalia medical-records system as part of the person's health record, under lög nr. 55/2009 um sjúkraskrár." },
        { icon: "shield", title: "Data protection", body: "Processing follows lög nr. 90/2018 and the GDPR. Lifeline Health is the controller; Medalia is a processor." },
      ] }),

    // 8 · Who pays what
    s({ type: "cards", theme: "light", columns: 3,
      kicker: "Money flow",
      heading: "Who pays for what.",
      lead: "HSU pays nothing towards the assessment itself. Its contribution is access to investigations the institution already runs, and measurement time that already exists in the building.",
      cards: [
        { icon: "drop", title: "HSU pays", body: "The cardiometabolic blood panel, and about 25 minutes of sjúkraliða time per participant. A share of these tests is drawn anyway." },
        { icon: "users", title: "The participant pays", body: "40.000 kr. for the assessment, the report and the doctor consultation. It counts as heilsufræðsla, and the unions in Vestmannaeyjar cover a large share — the exact proportion to be confirmed with each union." },
        { icon: "spark", title: "Lifeline pays", body: "Doctor time, the platform, the report, the plan and months of follow-up. Development and operation of the service." },
      ] }),

    // 9 · What it actually costs HSU
    s({ type: "stats", theme: "dark",
      kicker: "Size of the contribution",
      heading: "What this actually costs HSU.",
      lead: "Against a target of 250 participants over twelve months — about 6% of the population of Vestmannaeyjar.",
      stats: [
        { value: "~25", label: "minutes of sjúkraliða time per participant" },
        { value: "~104", label: "hours in total across the whole year" },
        { value: "~2", label: "hours per week on average" },
      ],
      footnote: "Plus the cost of the blood panel — [X kr. per participant] on HSU's own tariff, part of which would have fallen due anyway for those already under follow-up. Proposed panel, to be agreed with HSU's laboratory: lipids, HbA1c, inflammatory markers, liver and kidney function, thyroid, iron status and vitamin D." }),

    // 10 · What HSU gets back
    s({ type: "feature-rows", theme: "light",
      kicker: "The return",
      heading: "What HSU gets back.",
      rows: [
        { icon: "target", title: "The lifestyle work leaves the desk — without disappearing", body: "Work the heilsugæsla has neither the time nor the structure for gets its own channel, with follow-up that continues for months." },
        { icon: "clip", title: "Referrals arrive worked up", body: "If the assessment finds something, it reaches HSU as a defined referral with measurements and a clinical assessment attached — not as a vague complaint that has to be worked up from zero." },
        { icon: "pulse", title: "A service otherwise only available in the capital", body: "People in Vestmannaeyjar get an assessment that is largely confined to the capital area, without having to travel for it." },
        { icon: "chart", title: "A measurable picture of risk in the islands", body: "The project hands HSU aggregated data on risk factors in the community that the institution does not have today." },
      ] }),

    // 11 · The honest boundary
    s({ type: "statement", theme: "dark",
      kicker: "What we do not promise",
      heading: "We are not promising ==a healthier population.==",
      lead: "We promise no particular health outcome and no saving for HSU. That a healthier population comes back is precisely the hypothesis this pilot is built to test and measure — which is why the next slides are about what gets measured, and why the decision point sits twelve months out." }),

    // 12 · The ask
    s({ type: "steps", theme: "light",
      kicker: "The ask",
      heading: "Three things we need from HSU.",
      steps: [
        { title: "Access to the blood tests", body: "That participants can have the cardiometabolic panel drawn at the heilsugæsla in Vestmannaeyjar, to a panel defined together with HSU's laboratory." },
        { title: "Measurements in the same visit", body: "About 25 minutes of sjúkraliða time per participant: blood pressure and a body-composition measurement, taken in the same visit as the blood draw." },
        { title: "Support for the submission to Landlæknir", body: "Help getting Medalia's built-in video consultation approved for use. This is a precondition for starting, and the one item HSU can unlock and Lifeline cannot on its own." },
      ] }),

    // 13 · Phases
    s({ type: "timeline", theme: "dark",
      kicker: "Delivery",
      heading: "Vestmannaeyjar, about 4.000 residents.",
      nodes: [
        { icon: "lock", title: "Phase 0 · Preparation", body: "Landlæknir approval for the video consultation. The blood panel defined. Procedure and referral routes agreed. Conversations with the unions." },
        { icon: "users", title: "Phase 1 · 30 participants", body: "The whole route tested from measurement to plan, and the procedure corrected before opening to everyone." },
        { icon: "spark", title: "Phase 2 · Open to residents", body: "A target of 250 participants over twelve months. Re-measurement at six and twelve months." },
        { icon: "chart", title: "Phase 3 · Review and decision", body: "Results put to the board of HSU. A decision on continuation and roll-out." },
      ],
      lead: "A contained community with one heilsugæsla, a known population and strong unions — everything needed to measure whether the model works. Phase timing follows the Landlæknir decision." }),

    // 14 · Metrics
    s({ type: "feature-rows", theme: "light",
      kicker: "Evaluation",
      heading: "What will be measured.",
      rows: [
        { icon: "users", title: "Participation", body: "Number of participants, age distribution and sex ratio — whether the service reaches beyond those who already think most about their health." },
        { icon: "cal", title: "Process", body: "Time from measurement to consultation, and the share who complete the route — whether the procedure holds up in real use." },
        { icon: "doc", title: "Clinical", body: "The share of participants in whom something is found that warrants referral to HSU — whether the assessment finds what it is meant to find." },
        { icon: "pulse", title: "Follow-up", body: "Re-measurement at six and twelve months: blood pressure, lipids, HbA1c and body composition — whether the plan produces measurable change." },
        { icon: "smile", title: "Experience", body: "Satisfaction among participants and among HSU staff — whether this relieves the heilsugæsla or burdens it." },
      ] }),

    // 15 · Scaling
    s({ type: "cards", theme: "dark", columns: 3,
      kicker: "Roll-out",
      heading: "From the islands to the whole country.",
      lead: "Every new heilsugæsla only has to open two things: the blood tests, and 25 minutes of measurement.",
      cards: [
        { icon: "target", title: "Vestmannaeyjar", body: "The pilot. About 4.000 residents, one heilsugæsla, a population you can actually count." },
        { icon: "users", title: "Other HSU sites", body: "The same procedure and the same platform, once there is experience from the islands." },
        { icon: "pulse", title: "The whole country", body: "Other health institutions, on the same partnership model." },
      ] }),

    // 16 · Closing
    s({ type: "closing", theme: "dark", bg: IMG.banner,
      kicker: "Next steps",
      heading: "What we are asking for ==today.==",
      lead: "One: approval for a pilot project in Vestmannaeyjar on the terms set out here, with review and a decision on continuation after twelve months. Two: a named contact at HSU to work with us on procedure, blood panel and referral routes. Three: a joint submission to Landlæknir on the Medalia video consultation — it sits on the critical path and should go first.",
      tagline: "Heilsa til framtíðar",
      footnote: "Lifeline Health ehf. · [contact and date]" }),
  ];
}

// Hand-authored Icelandic for hsuDeck(), aligned by slide index. Paths follow
// the TextMap convention: "heading", "cards.0.body", "nodes.2.title", …
// Vocabulary follows our doctor-edited documents: heilsumat, læknisviðtal,
// blóðrannsókn, líkamssamsetningarmæling, skjólstæðingur/þátttakandi, and
// Fjarlækningar' phrasing "vísað aftur í hefðbundna þjónustu".
export function hsuDeckIs(): Record<string, string>[] {
  return [
    // 1 · Titill
    {
      kicker: "Samstarfstillaga · Tilraunaverkefni",
      heading: "Heilsa til ==framtíðar==",
      lead: "Heilsumat, mælingar og lífsstílsáætlun fyrir íbúa Vestmannaeyja — byggt ofan á þá heilsugæslu sem þegar er til staðar.",
      tagline: "HSU × Lifeline Health",
    },
    // 2 · Staðan
    {
      kicker: "Staðan",
      heading: "Lífsstíllinn kemur inn á heilsugæsluna en fer aldrei almennilega út aftur.",
      "cards.0.title": "Viðtalið er of stutt",
      "cards.0.body": "Svefn, næring, hreyfing og álag komast ekki fyrir í venjulegu viðtali — og liggja þó undir stórum hluta þeirra erinda sem berast.",
      "cards.1.title": "Enginn fylgir breytingunni eftir",
      "cards.1.body": "Ráðleggingar eru gefnar en engin skipulögð leið er til að fylgja þeim eftir mánuðum saman. Án eftirfylgni breytist fátt.",
      "cards.2.title": "Fólk leitar þetta uppi sjálft",
      "cards.2.body": "Íbúar kaupa nú þegar mælingar og heilsumat á almennum markaði — að mestu á höfuðborgarsvæðinu og án tengingar við sína heilsugæslu.",
    },
    // 3 · Hugmyndin
    {
      kicker: "Hugmyndin",
      heading: "Ein heimsókn. Heilsumat læknis. ==Áætlun sem einhver fylgir eftir.==",
      lead: "HSU heldur því sem er læknisfræðilegt — greiningu, meðferð, lyfjum og langvinnum sjúkdómum. Lifeline tekur að sér lífsstílsvinnuna, með eftirfylgni sem stendur mánuðum saman. Hvorugur aðilinn tekur að sér það sem hinn gerir betur, og skjólstæðingurinn þarf ekki að velja á milli þeirra.",
    },
    // 4 · Leiðin
    {
      kicker: "Leiðin",
      heading: "Fimm skref frá mælingu að áætlun.",
      "nodes.0.title": "Ein heimsókn",
      "nodes.0.body": "Blóðrannsókn, blóðþrýstingur og líkamssamsetningarmæling. Sjúkraliði HSU, um 25 mínútur.",
      "nodes.1.title": "Spurningalisti",
      "nodes.1.body": "Svefn, næring, hreyfing, andleg líðan og heilsufarssaga — svarað heiman frá í Medalia.",
      "nodes.2.title": "Heilsumatið",
      "nodes.2.body": "Læknir Lifeline vinnur klínískt áhættumat úr mælingunum og svörunum.",
      "nodes.3.title": "Læknisviðtal",
      "nodes.3.body": "Þrjátíu mínútur í fjarfundi þar sem læknir fer yfir niðurstöðurnar með þátttakanda.",
      "nodes.4.title": "Áætlunin",
      "nodes.4.body": "Lífsstílsáætlun, eftirfylgd og hvatning frá Lifeline, mánuð eftir mánuð.",
      lead: "Þurfi þátttakandi skoðun eða frekari rannsókn fer erindið til HSU — með mælingum og mati sem fylgja með.",
    },
    // 5 · Hringrásin (myndin ber efnið)
    {
      kicker: "Líkanið",
      heading: "Hringrás, ==ekki einstefna.==",
    },
    // 6 · Verkaskipting
    {
      kicker: "Verkaskipting",
      heading: "Hver gerir hvað.",
      "cards.0.title": "HSU",
      "cards.0.body": "Opnar aðgang að blóðrannsóknunum. Sjúkraliði mælir blóðþrýsting og líkamssamsetningu. Tekur við tilvísunum frá Lifeline. Greinir, meðhöndlar og fylgir eftir. Styður erindi til Landlæknis.",
      "cards.1.title": "Lifeline",
      "cards.1.body": "Spurningalisti og kerfi. Heilsumat læknis og skýrsla. Þrjátíu mínútna læknisviðtal. Lífsstílsáætlun og hvatning. Vísar aftur í hefðbundna þjónustu þegar við á.",
      "cards.2.title": "Þátttakandinn",
      "cards.2.body": "Mætir í eina heimsókn. Svarar spurningalistanum heima. Tekur þrjátíu mínútna viðtalið. Framkvæmir áætlunina með stuðningi. Kemur í endurmælingu.",
    },
    // 7 · Faglegur grunnur
    {
      kicker: "Faglegur grunnur",
      heading: "Þetta er klínísk vinna, á klínískum grunni.",
      "cards.0.title": "Viðurkennd áhættureiknirit",
      "cards.0.body": "Við heilsumatið er stuðst við viðurkennd stöðluð áhættureiknirit, svo sem SCORE2, auk sérhannaðra áhættulíkana þróaðra af læknateymi Lifeline Health.",
      "cards.1.title": "Læknir ber matið",
      "cards.1.body": "Túlkun niðurstaðna og allar ráðleggingar eru framkvæmdar af lækni á vegum Lifeline Health — ekki af reiknilíkani og ekki af þjálfara.",
      "cards.2.title": "Skráð í sjúkraskrárkerfi",
      "cards.2.body": "Allar upplýsingar eru skráðar og varðveittar í Medalia sjúkraskrárkerfinu sem hluti af sjúkraskrá viðkomandi, í samræmi við lög nr. 55/2009 um sjúkraskrár.",
      "cards.3.title": "Persónuvernd",
      "cards.3.body": "Vinnslan fer fram í samræmi við lög nr. 90/2018 og GDPR. Lifeline Health er ábyrgðaraðili og Medalia ehf. vinnsluaðili.",
    },
    // 8 · Greiðsluflæði
    {
      kicker: "Greiðsluflæði",
      heading: "Hver borgar hvað.",
      lead: "HSU greiðir ekkert fyrir heilsumatið sjálft. Framlag stofnunarinnar er aðgangur að rannsóknum sem hún framkvæmir hvort eð er, og mælitími sem þegar er til í húsinu.",
      "cards.0.title": "HSU greiðir",
      "cards.0.body": "Efnaskipta- og hjartaáhættupakkann, og um 25 mínútur af tíma sjúkraliða á hvern þátttakanda. Hluti þessara rannsókna er tekinn hvort eð er.",
      "cards.1.title": "Þátttakandinn greiðir",
      "cards.1.body": "40.000 kr. fyrir heilsumatið, skýrsluna og læknisviðtalið. Þjónustan telst heilsufræðsla og stéttarfélögin í Eyjum greiða stóran hluta — endanlegt hlutfall staðfest með hverju félagi fyrir sig.",
      "cards.2.title": "Lifeline greiðir",
      "cards.2.body": "Læknistíma, kerfið, skýrslugerðina, áætlunina og eftirfylgni mánuðum saman. Þróun og rekstur þjónustunnar.",
    },
    // 9 · Kostnaður
    {
      kicker: "Umfang framlagsins",
      heading: "Hvað þetta kostar HSU í raun.",
      lead: "Miðað við markmið um 250 þátttakendur á tólf mánuðum — um 6% íbúa Vestmannaeyja.",
      "stats.0.label": "mínútur af tíma sjúkraliða á hvern þátttakanda",
      "stats.1.label": "klukkustundir samtals yfir allt árið",
      "stats.2.label": "klukkustundir á viku að jafnaði",
      footnote: "Þar við bætist kostnaður blóðrannsóknanna — [X kr. á þátttakanda] samkvæmt gjaldskrá HSU, og hluti hans hefði fallið til hvort eð er hjá þeim sem þegar eru í eftirliti. Tillaga að pakka, staðfest með rannsóknarstofu HSU: blóðfitur, HbA1c, bólgumælingar, lifrar- og nýrnastarfsemi, skjaldkirtill, járnbúskapur og D-vítamín.",
    },
    // 10 · Ávinningur
    {
      kicker: "Ávinningurinn",
      heading: "Hvað HSU fær til baka.",
      "rows.0.title": "Lífsstílsvinnan fer af borðinu — en hverfur ekki",
      "rows.0.body": "Sú vinna sem heilsugæslan hefur hvorki tíma né umgjörð fyrir fær sinn eigin farveg, með eftirfylgni sem heldur áfram mánuðum saman.",
      "rows.1.title": "Tilvísanir berast fullunnar",
      "rows.1.body": "Finnist eitthvað í matinu berst það HSU sem skilgreind tilvísun með mælingum og klínísku mati — ekki sem óljóst erindi sem þarf að greina frá grunni.",
      "rows.2.title": "Þjónusta sem er annars bundin við höfuðborgarsvæðið",
      "rows.2.body": "Íbúar Vestmannaeyja fá heilsumat sem er að mestu aðeins í boði fyrir sunnan, án þess að þurfa að ferðast eftir því.",
      "rows.3.title": "Mælanleg mynd af áhættuþáttum í Eyjum",
      "rows.3.body": "Verkefnið skilar HSU samandregnum gögnum um áhættuþætti í samfélaginu sem stofnunin hefur ekki í dag.",
    },
    // 11 · Það sem við lofum ekki
    {
      kicker: "Það sem við lofum ekki",
      heading: "Við lofum ekki ==hraustari íbúahópi.==",
      lead: "Við lofum hvorki tilteknum heilsufarslegum árangri né sparnaði fyrir HSU. Sú tilgáta að hraustari íbúahópur skili sér til baka er einmitt það sem þetta tilraunaverkefni er byggt til að prófa og mæla — þess vegna fjalla næstu skyggnur um hvað verður mælt, og þess vegna liggur ákvörðunin eftir tólf mánuði.",
    },
    // 12 · Beiðnin
    {
      kicker: "Beiðnin",
      heading: "Þrennt sem við þurfum frá HSU.",
      "steps.0.title": "Aðgang að blóðrannsóknum",
      "steps.0.body": "Að þátttakendur geti fengið efnaskipta- og hjartaáhættupakkann tekinn á heilsugæslunni í Vestmannaeyjum, samkvæmt pakka sem skilgreindur er með rannsóknarstofu HSU.",
      "steps.1.title": "Mælingar í sömu heimsókn",
      "steps.1.body": "Um 25 mínútur af tíma sjúkraliða á hvern þátttakanda: blóðþrýstingur og líkamssamsetningarmæling, tekið í sömu heimsókn og blóðsýnið.",
      "steps.2.title": "Stuðning við erindi til Landlæknis",
      "steps.2.body": "Aðstoð við að fá innbyggða fjarfundavirkni Medalia samþykkta til notkunar. Þetta er forsenda þess að verkefnið geti hafist og sá liður sem HSU getur greitt fyrir en Lifeline ekki eitt og sér.",
    },
    // 13 · Áfangar
    {
      kicker: "Framkvæmd",
      heading: "Vestmannaeyjar, um 4.000 íbúar.",
      "nodes.0.title": "Áfangi 0 · Undirbúningur",
      "nodes.0.body": "Samþykki Landlæknis fyrir fjarfundum. Blóðrannsóknarpakki skilgreindur. Verklag og tilvísanaleiðir ákveðnar. Samtal við stéttarfélögin.",
      "nodes.1.title": "Áfangi 1 · 30 þátttakendur",
      "nodes.1.body": "Allt ferlið prófað frá mælingu að áætlun og verklagið lagfært áður en opnað er fyrir alla.",
      "nodes.2.title": "Áfangi 2 · Opnað fyrir íbúa",
      "nodes.2.body": "Markmið um 250 þátttakendur á tólf mánuðum. Endurmæling eftir sex og tólf mánuði.",
      "nodes.3.title": "Áfangi 3 · Mat og ákvörðun",
      "nodes.3.body": "Niðurstöður lagðar fyrir stjórn HSU. Ákvörðun um framhald og útbreiðslu.",
      lead: "Afmarkað samfélag með eina heilsugæslu, þekktan íbúafjölda og sterk stéttarfélög — allt sem þarf til að mæla hvort líkanið virkar. Tímasetning áfanga ræðst af afgreiðslu Landlæknis.",
    },
    // 14 · Mælikvarðar
    {
      kicker: "Mat á árangri",
      heading: "Hvað verður mælt.",
      "rows.0.title": "Þátttaka",
      "rows.0.body": "Fjöldi þátttakenda, aldursdreifing og kynjahlutfall — hvort þjónustan nái til fleiri en þeirra sem hugsa mest um heilsuna fyrir.",
      "rows.1.title": "Ferli",
      "rows.1.body": "Tími frá mælingu að viðtali og hlutfall sem lýkur ferlinu — hvort verklagið haldi í raunverulegri notkun.",
      "rows.2.title": "Klínískt",
      "rows.2.body": "Hlutfall þátttakenda þar sem eitthvað finnst sem kallar á tilvísun til HSU — hvort matið finni það sem því er ætlað að finna.",
      "rows.3.title": "Eftirfylgd",
      "rows.3.body": "Endurmæling eftir sex og tólf mánuði: blóðþrýstingur, blóðfitur, HbA1c og líkamssamsetning — hvort áætlunin skili mælanlegri breytingu.",
      "rows.4.title": "Upplifun",
      "rows.4.body": "Ánægja þátttakenda og starfsfólks HSU — hvort þetta létti á heilsugæslunni eða íþyngi henni.",
    },
    // 15 · Útbreiðsla
    {
      kicker: "Útbreiðsla",
      heading: "Frá Eyjum til landsins alls.",
      lead: "Hver ný heilsugæsla þarf aðeins að opna fyrir tvennt: blóðrannsóknirnar og 25 mínútur af mælingum.",
      "cards.0.title": "Vestmannaeyjar",
      "cards.0.body": "Tilraunaverkefnið. Um 4.000 íbúar, ein heilsugæsla og íbúafjöldi sem hægt er að telja.",
      "cards.1.title": "Aðrar starfsstöðvar HSU",
      "cards.1.body": "Sama verklag og sama kerfi, að fenginni reynslu úr Eyjum.",
      "cards.2.title": "Landið allt",
      "cards.2.body": "Aðrar heilbrigðisstofnanir, á sama samstarfslíkani.",
    },
    // 16 · Ákvörðun
    {
      kicker: "Næstu skref",
      heading: "Það sem óskað er eftir ==í dag.==",
      lead: "Eitt: samþykki fyrir tilraunaverkefni í Vestmannaeyjum á þeim forsendum sem hér hafa verið lagðar fram, með mati og ákvörðun um framhald að tólf mánuðum liðnum. Tvö: tengiliður hjá HSU sem vinnur með okkur að verklagi, blóðrannsóknarpakka og tilvísanaleiðum. Þrjú: sameiginlegt erindi til Landlæknis um fjarfundavirkni Medalia — það liggur á gagnrýnu leiðinni og ætti að fara af stað fyrst.",
      tagline: "Heilsa til framtíðar",
      footnote: "Lifeline Health ehf. · [tengiliður og dagsetning]",
    },
  ];
}
