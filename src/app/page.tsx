import Link from "next/link";
import MedaliaButton from "./components/MedaliaButton";
import PhoneMockup from "./components/PhoneMockup";
import { ExerciseIcon, NutritionIcon, SleepIcon, MentalIcon, PillarCircle } from "./components/PillarIcons";

const steps = [
  {
    step: "1",
    title: "Get assessed",
    description:
      "Complete body composition, blood tests and lifestyle screening at our stations or through Sameind.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
        />
      </svg>
    ),
  },
  {
    step: "2",
    title: "Get your report",
    description:
      "A Lifeline doctor reviews your results and meets with you to discuss findings and recommendations.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    ),
  },
  {
    step: "3",
    title: "Start coaching",
    description:
      "Download the app for daily action plans, exercise programs, nutrition guidance and progress tracking.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
        />
      </svg>
    ),
  },
];

const packages = [
  {
    name: "Foundational Health",
    price: "49.900",
    description: "Full screening, body composition, blood tests",
    featured: true,
    features: [
      "Complete body composition analysis",
      "Comprehensive blood panel",
      "Lifestyle & nutrition questionnaire",
      "Doctor-reviewed health report",
      "Personal consultation with physician",
      "Personalised recommendations",
    ],
  },
  {
    name: "Check-in",
    price: "19.900",
    description: "Body composition for progress tracking",
    featured: false,
    features: [
      "Body composition analysis",
      "Progress comparison report",
      "Updated health score",
      "Brief physician review",
    ],
  },
  {
    name: "Self Check-in",
    price: "Free",
    description: "Questionnaire from home",
    featured: false,
    features: [
      "Online health questionnaire",
      "Self-reported metrics tracking",
      "Basic health score update",
      "No visit required",
    ],
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
    color: "#20c858",
    lightBg: "bg-green-50",
    textColor: "text-[#20c858]",
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

const teamQuotes = [
  {
    name: "Dr. Guðmundur Sigurðsson",
    role: "Medical Director",
    quote:
      "We built Lifeline because preventive health should be accessible to everyone. By combining medical-grade assessments with daily coaching, we help people catch issues early and build habits that last.",
  },
  {
    name: "Coach Sarah",
    role: "Head of Coaching",
    quote:
      "Most health programs focus on one thing — a diet, a workout plan. Lifeline addresses all four pillars: exercise, nutrition, sleep, and mental wellness. That holistic approach is what drives real, lasting change.",
  },
  {
    name: "Dr. Anna Kristjánsdóttir",
    role: "Clinical Psychologist",
    quote:
      "Mental wellness is the foundation everything else is built on. Our programs use evidence-based techniques — mindfulness, cognitive restructuring, stress management — tailored to each individual.",
  },
];

const approach = [
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

function WaveSeparator({ from = "#ffffff", to = "#ecf0f3" }: { from?: string; to?: string }) {
  return (
    <div className="relative h-16 sm:h-24 -mb-px" style={{ backgroundColor: from }}>
      <svg
        className="absolute bottom-0 w-full h-full"
        viewBox="0 0 1440 96"
        preserveAspectRatio="none"
        fill={to}
      >
        <path d="M0,64 C360,96 720,32 1080,64 C1260,80 1380,48 1440,64 L1440,96 L0,96 Z" />
      </svg>
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
              Lifeline Health combines comprehensive health assessments
              with personalised daily coaching. Know your numbers, build better
              habits, track your progress.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <MedaliaButton label="Book Health Assessment" size="lg" />
              <Link
                href="/coaching#download"
                className="inline-flex items-center justify-center px-10 py-4 text-base font-semibold border-2 border-[#20c858] text-[#20c858] rounded-full hover:bg-[#20c858] hover:text-white transition-all duration-200"
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
                <svg className="w-4 h-4 text-[#20c858] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          <div className="space-y-16 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-0 relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden sm:block absolute top-10 left-[16.67%] right-[16.67%] h-[2px] bg-gradient-to-r from-[#20c858]/20 via-[#20c858] to-[#20c858]/20" />

            {steps.map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center relative">
                {/* Step number */}
                <div className="w-20 h-20 rounded-2xl bg-white border-2 border-[#20c858]/20 flex items-center justify-center mb-6 shadow-sm relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-[#20c858]/10 text-[#20c858] flex items-center justify-center">
                    {s.icon}
                  </div>
                </div>
                <span className="text-xs font-bold text-[#20c858] tracking-widest uppercase mb-2">Step {s.step}</span>
                <h3 className="text-xl font-semibold text-[#1F2937] mb-3">
                  {s.title}
                </h3>
                <p className="text-sm text-[#6B7280] leading-relaxed max-w-[260px]">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#ffffff" to="#ecf0f3" />

      {/* Health Assessment Packages */}
      <section className="py-24 sm:py-28 bg-[#ecf0f3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              Health Assessment Packages
            </h2>
            <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">
              Choose the assessment that fits your needs
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {packages.map((pkg) => (
              <div
                key={pkg.name}
                className={`bg-[#e6ecf4] rounded-2xl p-8 flex flex-col transition-all duration-200 hover:shadow-xl hover:scale-[1.03] ${
                  pkg.featured ? "ring-2 ring-[#20c858] shadow-lg" : "hover:shadow-lg"
                }`}
              >
                {pkg.featured && (
                  <div className="text-xs font-bold text-[#20c858] bg-[#20c858]/10 px-3 py-1 rounded-full self-start mb-3">
                    RECOMMENDED
                  </div>
                )}
                <h3 className="text-lg font-semibold text-[#1F2937] mb-1">
                  {pkg.name}
                </h3>
                <p className="text-sm text-[#6B7280] mb-4">{pkg.description}</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-[#1F2937]">
                    {pkg.price}
                  </span>
                  {pkg.price !== "Free" && (
                    <span className="text-sm text-[#6B7280] ml-2">ISK</span>
                  )}
                </div>
                <ul className="space-y-2 mb-8 flex-1">
                  {pkg.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <svg
                        className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#20c858]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-[#6B7280]">{f}</span>
                    </li>
                  ))}
                </ul>
                <MedaliaButton
                  label="Book Now"
                  size="md"
                  className={`w-full ${pkg.featured ? "shadow-lg shadow-green-500/30" : ""}`}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#ecf0f3" to="#ffffff" />

      {/* Health coaching / 4 pillars */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937] mb-6">
                Your daily health coach
              </h2>
              <p className="text-lg text-[#6B7280] mb-8 leading-relaxed">
                The Lifeline app delivers personalised daily action plans across
                four pillars of health. Get exercise programs, nutrition
                guidance, sleep optimisation, and mental wellness support
                tailored to your assessment results.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {pillars.map((p) => (
                  <div
                    key={p.title}
                    className={`${p.lightBg} rounded-2xl p-5 hover:shadow-md transition-all duration-200 pillar-glow ${p.glowColor} relative overflow-hidden`}
                  >
                    <div className="mb-3">
                      <PillarCircle color={p.color} size="sm">
                        <div className="w-5 h-5 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">{p.icon}</div>
                      </PillarCircle>
                    </div>
                    <h3 className={`text-base font-semibold ${p.textColor} mb-1`}>
                      {p.title}
                    </h3>
                    <p className="text-xs text-[#6B7280] leading-relaxed">
                      {p.description}
                    </p>
                  </div>
                ))}
              </div>
              <div className="text-center lg:text-left">
                <Link
                  href="/coaching#download"
                  className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold border-2 border-[#20c858] text-[#20c858] rounded-full hover:bg-[#20c858] hover:text-white transition-all duration-200"
                >
                  Download the App
                </Link>
              </div>
            </div>
          </div>

          {/* Single large phone mockup */}
          <div className="mt-16 flex justify-center">
            <div className="flex flex-col items-center max-w-[400px] w-full">
              <div className="relative w-full aspect-[9/16] overflow-hidden">
                {/* Phone frame */}
                <div className="absolute inset-0 bg-[#1a1a1a] rounded-t-[3rem] border-x-[3px] border-t-[3px] border-[#2a2a2a]" />
                {/* Inner bezel */}
                <div className="absolute inset-[4px] bg-[#111] rounded-t-[2.8rem]" />
                {/* Screen */}
                <div className="absolute inset-[6px] rounded-t-[2.6rem] overflow-hidden bg-[#ecf0f3]">
                  <img
                    src="/app-screenshot-home.jpg"
                    alt="Lifeline Health app"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                {/* Side buttons */}
                <div className="absolute -right-[2px] top-[28%] w-[3px] h-14 bg-[#333] rounded-r-sm" />
                <div className="absolute -left-[2px] top-[22%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
                <div className="absolute -left-[2px] top-[36%] w-[3px] h-9 bg-[#333] rounded-l-sm" />
                {/* Bottom fade */}
                <div className="absolute bottom-0 left-[6px] right-[6px] h-28 bg-gradient-to-t from-[#1a1a1a] to-transparent z-10" />
              </div>
              <p className="text-sm text-[#6B7280] mt-4 text-center">Your personalised daily health coaching</p>
            </div>
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#ffffff" to="#f3f5f8" />

      {/* Trusted by health professionals */}
      <section className="py-16 sm:py-20 bg-[#f3f5f8]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#6B7280] mb-6">
              Trusted by
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
              {["Medalia.is", "Sameind", "Lifeline Medical"].map((partner) => (
                <span
                  key={partner}
                  className="text-lg sm:text-xl font-semibold text-[#1F2937]/40 hover:text-[#1F2937]/70 transition-colors duration-200"
                >
                  {partner}
                </span>
              ))}
            </div>
          </div>
          <div className="max-w-2xl mx-auto text-center mt-10 border-t border-gray-200 pt-10">
            <blockquote className="text-lg sm:text-xl text-[#1F2937] leading-relaxed italic">
              &ldquo;Lifeline Health takes a holistic approach to preventive health that we fully endorse.&rdquo;
            </blockquote>
            <p className="mt-4 text-sm text-[#6B7280]">
              &mdash; Dr. Gu&eth;mundur Sigur&eth;sson, Lifeline Medical
            </p>
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#f3f5f8" to="#ffffff" />

      {/* Our approach */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              Our approach
            </h2>
            <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">
              What makes Lifeline Health different
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {approach.map((a) => (
              <div
                key={a.title}
                className="bg-[#e6ecf4] rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-200 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#20c858]/10 text-[#20c858] flex items-center justify-center mx-auto mb-5">
                  {a.icon}
                </div>
                <h3 className="text-lg font-semibold text-[#1F2937] mb-3">
                  {a.title}
                </h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">
                  {a.description}
                </p>
              </div>
            ))}
          </div>

          {/* Team quotes */}
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-[#1F2937]">
              From our team
            </h3>
            <p className="mt-2 text-[#6B7280]">
              The professionals behind your health journey
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {teamQuotes.map((t) => (
              <div
                key={t.name}
                className="bg-[#e6ecf4] rounded-2xl p-8 shadow-sm hover:shadow-lg transition-all duration-200 relative"
              >
                <div className="absolute top-4 right-6 text-6xl leading-none text-[#20c858]/10 font-serif select-none">
                  &ldquo;
                </div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-full bg-[#20c858]/10 flex items-center justify-center text-[#20c858] font-bold text-lg">
                    {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-semibold text-[#1F2937] text-sm">
                      {t.name}
                    </div>
                    <div className="text-xs font-medium text-[#20c858]">
                      {t.role}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-[#6B7280] leading-relaxed italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#ffffff" to="#ecf0f3" />

      {/* Patient Portal */}
      <section className="py-24 sm:py-28 bg-[#ecf0f3]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937] mb-6">
            Access your health records
          </h2>
          <p className="text-lg text-[#6B7280] max-w-2xl mx-auto mb-4 leading-relaxed">
            View your assessment results, questionnaire responses and health
            reports through our secure patient portal powered by Medalia.
          </p>
          <p className="text-sm text-[#6B7280] mb-10">
            In partnership with{" "}
            <a
              href="https://medalia.is"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#20c858] hover:underline"
            >
              Medalia.is
            </a>
          </p>
          <MedaliaButton label="Open Patient Portal" size="lg" />
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
              className="inline-flex items-center justify-center px-10 py-4 text-base font-semibold border-2 border-[#20c858] text-[#20c858] rounded-full hover:bg-[#20c858] hover:text-white transition-all duration-200"
            >
              Download App
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
