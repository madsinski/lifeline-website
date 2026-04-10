import Link from "next/link";
import MedaliaButton from "./components/MedaliaButton";
import PhoneMockup from "./components/PhoneMockup";
import ScrollPhone from "./components/ScrollPhone";
import { ExerciseIcon, NutritionIcon, SleepIcon, MentalIcon, PillarCircle } from "./components/PillarIcons";
import WaveSeparator from "./components/WaveSeparator";

const steps = [
  {
    step: "1",
    title: "Get assessed",
    description:
      "Complete body composition, blood tests and lifestyle screening at our stations or through Sameind.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: "#3B82F6",
  },
  {
    step: "2",
    title: "Get your report",
    description:
      "A Lifeline doctor reviews your results and meets with you to discuss findings and recommendations.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    color: "#0D9488",
  },
  {
    step: "3",
    title: "Start coaching",
    description:
      "Download the app for daily action plans, exercise programs, nutrition guidance and progress tracking.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: "#8B5CF6",
  },
];

const pillars = [
  {
    title: "Exercise",
    description:
      "Build strength, endurance, and mobility with programs tailored to your level and goals.",
    color: "#3B82F6",
    lightBg: "bg-blue-50",
    textColor: "text-[#3B82F6]",
    glowColor: "text-blue-400",
    icon: <ExerciseIcon />,
  },
  {
    title: "Nutrition",
    description:
      "Personalised meal guidance based on your blood work and body composition results.",
    color: "#0D9488",
    lightBg: "bg-green-50",
    textColor: "text-[#0D9488]",
    glowColor: "text-green-400",
    icon: <NutritionIcon />,
  },
  {
    title: "Sleep",
    description:
      "Optimise your sleep with science-backed routines, tracking, and personalised guidance.",
    color: "#8B5CF6",
    lightBg: "bg-purple-50",
    textColor: "text-[#8B5CF6]",
    glowColor: "text-purple-400",
    icon: <SleepIcon />,
  },
  {
    title: "Mental Wellness",
    description:
      "Build resilience through mindfulness, breathing exercises, and community support.",
    color: "#06B6D4",
    lightBg: "bg-teal-50",
    textColor: "text-[#06B6D4]",
    glowColor: "text-teal-400",
    icon: <MentalIcon />,
  },
];

const teamMembers = [
  { name: "Victor Guðmundsson", role: "Medical Doctor, Coach, CEO & Co-founder", bio: "Victor founded Lifeline to make preventive health accessible. He combines clinical expertise with coaching to help people build lasting health habits." },
  { name: "Mads Christian Aanesen", role: "Medical Doctor, Coach, CTO & Co-founder", bio: "Mads leads the technology behind Lifeline — from the app to the health platform. A physician and coach who believes technology should make health change easier." },
  { name: "Vignir Sigurðsson", role: "Chief Medical Advisor, Pediatrician, Ass. Prof. HA", bio: "Vignir brings decades of clinical and academic experience to Lifeline, ensuring our programs meet the highest medical standards." },
  { name: "Ragnar Björgvinsson", role: "Legal Advisor", bio: "Ragnar advises Lifeline on legal matters, ensuring compliance and protecting the interests of the company and its members." },
  { name: "Snorri Arnar Viðarsson", role: "Business Advisor", bio: "Snorri provides strategic business guidance, helping Lifeline grow sustainably while staying true to its mission." },
  { name: "Arna Hrund Baldursdóttir Bjartmars", role: "Nurse", bio: "Arna performs health assessments at our stations, guiding members through body composition measurements and vital screenings." },
  { name: "Ragnheiður Perla Hjaltadóttir", role: "Nurse", bio: "Ragnheiður supports members through the assessment process, ensuring a comfortable and thorough experience at every visit." },
  { name: "Aníta Adamsdóttir", role: "Nurse", bio: "Aníta brings clinical care and a warm presence to our stations, helping members understand their measurements and next steps." },
  { name: "Health Coach", role: "Health Coach", bio: "Our health coaches work directly with members on daily action plans, exercise programs, nutrition guidance, and accountability." },
  { name: "Health Coach", role: "Health Coach", bio: "Dedicated to helping members build sustainable habits across all four pillars of health — exercise, nutrition, sleep, and mental wellness." },
];

const partners = [
  { name: "Læknastofur Akureyrar", role: "Medical clinic partner", url: "https://lak.is", logo: "/partner-lak.svg" },
  { name: "Medalia", role: "Patient portal & health records", url: "https://medalia.is", logo: "/partner-medalia.png" },
  { name: "Sameind", role: "Blood test collection stations", url: "https://sameind.is", logo: "/partner-sameind.svg" },
  { name: "WorldClass", role: "Fitness & wellness partner", url: "https://worldclass.is", logo: "/partner-worldclass.jpg" },
];

const approach = [
  {
    title: "Preventive",
    description: "We focus on catching health issues before they become problems. Regular check-ins and tracking help you stay ahead, not play catch-up.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "Data-driven",
    description: "Every recommendation is backed by your blood work, body composition, and health questionnaire — not generic advice.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: "Doctor-led",
    description: "A physician reviews every assessment, interprets your results, and meets with you personally. Medical oversight at every step.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    title: "Holistic",
    description: "We address exercise, nutrition, sleep, and mental wellness together — because real health improvement requires all four pillars working in harmony.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    title: "Personalised",
    description: "Your coaching adapts to your results, your goals, and your progress. No two plans are alike — because no two people are alike.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

const appFeatures = [
  { title: "Personalised action plans", description: "Daily tasks across exercise, nutrition, sleep and mental wellness — built on your results.", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>, color: "#3B82F6" },
  { title: "Health coaching and education", description: "Structured programs, educational courses, and a personal coach to guide your journey from day one.", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>, color: "#0D9488" },
  { title: "Track your progress", description: "See your health scores improve over time with every check-in and completed action.", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>, color: "#8B5CF6" },
  { title: "Community", description: "Join challenges, earn streaks, and connect with others on the same health journey.", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>, color: "#F59E0B" },
];

function AppTextContent() {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.15em] uppercase text-[#0D9488] mb-4">The Lifeline App</p>
      <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937] mb-6">Your health change <span className="text-[#0D9488]">partner</span></h2>
      <p className="text-lg text-[#6B7280] mb-8 leading-relaxed">The Lifeline app brings your assessment data, coaching programs, and daily actions into one place — making real health change simple and sustainable.</p>
      <div className="space-y-4">
        {appFeatures.map((item) => (
          <div key={item.title} className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${item.color}15`, color: item.color }}>{item.icon}</div>
            <div>
              <h3 className="text-sm font-semibold text-[#1F2937] mb-0.5">{item.title}</h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/coaching#download" className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white bg-[#0D9488] rounded-xl hover:bg-[#0B7B73] transition-all duration-200 shadow-lg shadow-teal-500/25">Download the App</Link>
        <Link href="/pricing" className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold border-2 border-[#0D9488] text-[#0D9488] rounded-xl hover:bg-[#0D9488] hover:text-white transition-all duration-200">View Subscriptions</Link>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(32,200,88,0.12),transparent)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 sm:py-36 lg:py-44">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#1F2937] leading-[1.1]">
              Take control of your health
            </h1>
            <p className="mt-8 text-lg sm:text-xl text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
              Lifeline Health combines targeted health assessments
              with personalised daily coaching. Know your numbers, build better
              habits, track your progress.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <MedaliaButton label="Book Health Assessment" size="lg" />
              <Link
                href="/coaching#download"
                className="inline-flex items-center justify-center px-10 py-4 text-base font-semibold border-2 border-[#0D9488] text-[#0D9488] rounded-xl hover:bg-[#0D9488] hover:text-white transition-all duration-200"
              >
                Download the App
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-8 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-center">
            {[
              { label: "Doctor-reviewed programs" },
              { label: "Evidence-based coaching" },
              { label: "4 pillars of health" },
              { label: "Founded in Reykjav\u00edk" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#0D9488] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-semibold text-[#1F2937]">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              How Lifeline works
            </h2>
            <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">
              Three steps to transform your health
            </p>
          </div>

          <div className="space-y-8 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-12 relative">
            {/* Connecting arrows (desktop only) */}
            <div className="hidden sm:block absolute top-12 left-[30%] w-[12%] h-0.5 bg-gradient-to-r from-[#3B82F6]/40 to-[#0D9488]/40" />
            <div className="hidden sm:block absolute top-12 left-[58%] w-[12%] h-0.5 bg-gradient-to-r from-[#0D9488]/40 to-[#8B5CF6]/40" />

            {steps.map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center relative">
                {/* Numbered circle + icon */}
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-lg" style={{ backgroundColor: `${(s as any).color}10`, border: `2px solid ${(s as any).color}25` }}>
                    <div className="text-[#1F2937]" style={{ color: (s as any).color }}>
                      {s.icon}
                    </div>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md" style={{ backgroundColor: (s as any).color }}>
                    {s.step}
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-[#1F2937] mb-3">
                  {s.title}
                </h3>
                <p className="text-sm text-[#6B7280] leading-relaxed max-w-[280px]">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#ffffff" to="#ecf0f3" />

      {/* Health Assessment Process */}
      <section className="py-24 sm:py-28 bg-[#ecf0f3]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              Your health assessment
            </h2>
            <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">
              Targeted screening focused on what matters most
            </p>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                title: "Body composition analysis",
                description: "Clinical-accuracy body composition measurement — muscle mass, body fat, water balance and more. Far beyond what a scale can tell you.",
                color: "#3B82F6",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                ),
              },
              {
                title: "Targeted blood panel",
                description: "We test the markers that matter for metabolic health — no unnecessary tests. Maximum insight, best value.",
                color: "#0D9488",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M5 14.5l-1.43 1.43a2.25 2.25 0 00-.659 1.591v2.228c0 1.243 1.007 2.25 2.25 2.25h13.676a2.25 2.25 0 002.25-2.25v-2.228c0-.597-.237-1.17-.659-1.591L19 14.5" />
                  </svg>
                ),
              },
              {
                title: "Doctor-reviewed health report",
                description: "A Lifeline physician reviews your results and prepares a personalised report with your health score and actionable recommendations.",
                color: "#8B5CF6",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                ),
              },
              {
                title: "Personal consultation",
                description: "Meet with your doctor in-person or over video to discuss your findings, ask questions, and get personalised recommendations.",
                color: "#F59E0B",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start gap-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${item.color}10`, border: `2px solid ${item.color}25`, color: item.color }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className="font-semibold text-[#1F2937] text-lg mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#6B7280] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {/* Secure records card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-[#0D9488]/10 border-2 border-[#0D9488]/25 text-[#0D9488]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="font-semibold text-[#1F2937] text-lg mb-1">
                    Securely stored in Medalia
                  </h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed mb-4">
                    All your health data, assessment results, blood tests and questionnaires are stored securely in your personal patient portal powered by Medalia.is.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/assessment"
                      className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-[#0D9488] rounded-xl hover:bg-[#0B7B73] transition-all duration-200 shadow-md shadow-teal-500/25"
                    >
                      View Packages
                    </Link>
                    <MedaliaButton label="Patient Portal" size="sm" variant="outline" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#ecf0f3" to="#ffffff" />

      {/* The app — brings it all together + scroll phone */}
      {/* Desktop: side-by-side layout */}
      <section className="bg-white hidden lg:block" style={{ height: "200vh" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="grid grid-cols-2 gap-16 h-full">
            <div className="sticky top-0 h-screen flex items-center">
              <AppTextContent />
            </div>
            <div className="flex justify-center">
              <ScrollPhone inline screenshot="/app-screenshot-scroll.jpg" alt="Lifeline Health app" initialOffset={0} maxTranslate={35} phoneHeight="75vh" />
            </div>
          </div>
        </div>
      </section>
      {/* Mobile: text then standalone scroll phone */}
      <section className="bg-white lg:hidden py-24 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <AppTextContent />
        </div>
      </section>
      <div className="bg-white lg:hidden">
        <div className="max-w-7xl mx-auto px-4">
          <ScrollPhone screenshot="/app-screenshot-scroll.jpg" alt="Lifeline Health app" />
        </div>
      </div>

      {/* Wave separator */}
      <WaveSeparator from="#ffffff" to="#ecf0f3" />

      {/* Our approach */}
      <section className="py-24 sm:py-28 bg-[#ecf0f3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              Our approach
            </h2>
            <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">
              What makes Lifeline Health different
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 max-w-6xl mx-auto">
            {approach.map((a) => (
              <div
                key={a.title}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-200 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center mx-auto mb-4">
                  {a.icon}
                </div>
                <h3 className="text-sm font-semibold text-[#1F2937] mb-2">
                  {a.title}
                </h3>
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  {a.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#ecf0f3" to="#ffffff" />

      {/* Our team */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              Our team
            </h2>
            <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">
              The professionals behind your health journey
            </p>
          </div>
          <div className="space-y-4 max-w-3xl mx-auto">
            {teamMembers.map((t, i) => (
              <div
                key={t.name + i}
                className="bg-[#e6ecf4] rounded-2xl p-5 flex items-start gap-5 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-[#0D9488]/20 to-[#3B82F6]/10 flex items-center justify-center text-[#0D9488] font-bold text-xl shadow-sm flex-shrink-0">
                  {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#1F2937]">{t.name}</h3>
                  <p className="text-xs text-[#0D9488] font-medium mb-2">{t.role}</p>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{t.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#ffffff" to="#ecf0f3" />

      {/* Partners */}
      <section className="py-24 sm:py-28 bg-[#ecf0f3]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              Our partners
            </h2>
            <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">
              The people and organisations behind Lifeline Health
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {partners.map((p) => (
              <a
                key={p.name}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-200 text-center group"
              >
                <div className="w-full h-20 flex items-center justify-center mb-4 px-4">
                  <img src={p.logo} alt={p.name} className="max-h-16 max-w-full object-contain" />
                </div>
                <h3 className="font-semibold text-[#1F2937] mb-1 group-hover:text-[#0D9488] transition-colors">{p.name}</h3>
                <p className="text-xs text-[#6B7280] mb-2">{p.role}</p>
                <p className="text-xs text-[#0D9488] font-medium">{p.url.replace('https://', '')}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-28 bg-gradient-to-br from-[#1a3a2a] via-[#1F2937] to-[#111827] relative overflow-hidden">
        {/* Subtle green gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(32,200,88,0.15),transparent)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to start?
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Choose your path to better health. Get a comprehensive assessment or
            start coaching right away with the app.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <MedaliaButton label="Book Assessment" size="lg" />
            <Link
              href="/coaching#download"
              className="inline-flex items-center justify-center px-10 py-4 text-base font-semibold border-2 border-[#0D9488] text-[#0D9488] rounded-xl hover:bg-[#0D9488] hover:text-white transition-all duration-200"
            >
              Download App
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
