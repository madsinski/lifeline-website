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
    // F3 · Clients & collaborations
    s({ type: "cards", theme: "light", brand: "fjarlaekningar", columns: 2,
      kicker: "Fjarlækningar · Clients & collaborations",
      heading: "From the health service to your ==doorstep.==",
      cards: [
        { icon: "shield", title: "Clients", body: "Heilbrigðisstofnun Suðurlands (HSU) — the Health Care Institution of South Iceland — with collaborations expanding to the North, West and East." },
        { icon: "leaf", title: "Collaborations", body: "Lyfja, Iceland's largest pharmacy chain — bringing home delivery of medication and home-test kits, and a new level of service to the patient." },
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
      tagline: "Bætt heilsa — betra líf." }),
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
    // 3 · Nutrition station at Laugar
    s({ type: "bullets", theme: "dark", brand: "worldclass",
      kicker: "At the gym · Nutrition",
      heading: "A nutrition station at ==Laugar.==",
      lead: "World Class Laugar already has an in-house restaurant serving clean food — together we make it a Lifeline nutrition station.",
      bullets: [
        "Clean, healthy food already on site.",
        "Nutrition guidance tied to your own results.",
        "Eat to your plan, right after you train.",
      ] }),
    // 4 · The app, community & classes
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
    // 5 · In-app programs linked to gym classes
    s({ type: "feature-rows", theme: "light", brand: "lifeline",
      kicker: "The app · Programs",
      heading: "Your plan, ==in the class schedule.==",
      rows: [
        { icon: "cal", title: "Programs map to classes", body: "Each step in your Lifeline program links to a real World Class class." },
        { icon: "dumbbell", title: "Matched to your plan", body: "Spinning, strength, yoga, HIIT — the right class for the right day." },
        { icon: "users", title: "Train together", body: "Follow your plan in a room full of people, with a coach up front." },
      ] }),
    // 6 · Co-marketing health events
    s({ type: "bullets", theme: "dark", brand: "worldclass",
      kicker: "Together · Marketing",
      heading: "Health events, ==co-hosted.==",
      lead: "Lifeline and World Class run joint health events — building awareness, members and momentum for both brands.",
      bullets: [
        "Co-branded health challenges and pop-ups.",
        "Shared reach across both communities.",
        "One message: better health, better life.",
      ] }),
    // 7 · Closing
    s({ type: "closing", theme: "dark", brand: "worldclass",
      kicker: "Together",
      heading: "Better health, ==built into the gym.==",
      lead: "Lifeline × World Class — clinical health, nutrition and coaching, where Iceland already trains.",
      tagline: "Bætt heilsa — betra líf." }),
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
