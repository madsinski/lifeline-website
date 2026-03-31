"use client";

import Link from "next/link";
import { PhoneMockupCoach } from "../components/PhoneMockup";
import { ExerciseIcon, NutritionIcon, SleepIcon, MentalIcon, PillarCircle } from "../components/PillarIcons";

const pillars = [
  {
    title: "Exercise",
    description:
      "Personalised exercise programs designed for your fitness level and goals. From strength training to cardio, mobility work to sport-specific training. Programs adapt as you progress.",
    features: [
      "Custom workout programs",
      "Video exercise demonstrations",
      "Progressive overload tracking",
      "Rest day recommendations",
      "Mobility and flexibility routines",
    ],
    color: "#3B82F6",
    textColor: "text-[#3B82F6]",
    bgColor: "bg-blue-50",
    borderColor: "border-[#3B82F6]",
    icon: <ExerciseIcon className="w-8 h-8" />,
  },
  {
    title: "Nutrition",
    description:
      "Evidence-based nutrition guidance tailored to your blood work results and body composition. No fad diets, just sustainable eating habits that fuel your body properly.",
    features: [
      "Personalised meal suggestions",
      "Macro and micronutrient guidance",
      "Hydration tracking",
      "Supplement recommendations",
      "Meal timing optimisation",
    ],
    color: "#20c858",
    textColor: "text-[#20c858]",
    bgColor: "bg-green-50",
    borderColor: "border-[#20c858]",
    icon: <NutritionIcon className="w-8 h-8" />,
  },
  {
    title: "Sleep",
    description:
      "Science-backed sleep optimisation to improve your recovery, energy, and cognitive function. Track your sleep quality and get personalised recommendations.",
    features: [
      "Sleep schedule optimisation",
      "Evening wind-down routines",
      "Sleep environment tips",
      "Quality tracking and trends",
      "Circadian rhythm alignment",
    ],
    color: "#8B5CF6",
    textColor: "text-[#8B5CF6]",
    bgColor: "bg-purple-50",
    borderColor: "border-[#8B5CF6]",
    icon: <SleepIcon className="w-8 h-8" />,
  },
  {
    title: "Mental Wellness",
    description:
      "Build mental resilience with guided mindfulness, breathing exercises, and stress management techniques. Connect with a supportive community of like-minded individuals.",
    features: [
      "Guided mindfulness sessions",
      "Breathing exercises",
      "Stress management tools",
      "Mood tracking",
      "Community support",
    ],
    color: "#06B6D4",
    textColor: "text-[#06B6D4]",
    bgColor: "bg-teal-50",
    borderColor: "border-[#06B6D4]",
    icon: <MentalIcon className="w-8 h-8" />,
  },
];

const stats = [
  { label: "Health categories tracked", value: "12", width: "85" },
  { label: "Structured program weeks", value: "8", width: "72" },
  { label: "Coaching levels", value: "3", width: "96" },
  { label: "Daily personalised actions", value: "7+", width: "78" },
];

const subscriptions = [
  {
    name: "Free Plan",
    price: "0",
    period: "",
    description: "Try Lifeline risk-free",
    features: [
      "Basic health questionnaire",
      "Sample action plans",
      "Limited exercise programs",
      "Community access",
      "App access",
    ],
  },
  {
    name: "Self-maintained",
    price: "9.900",
    period: "per month",
    description: "Full tools for self-guided health",
    popular: false,
    features: [
      "Daily action plans",
      "Full exercise library",
      "Nutrition guidance",
      "Sleep tracking",
      "Progress tracking",
      "Community access",
    ],
  },
  {
    name: "Full Access",
    price: "29.900",
    period: "per month",
    description: "Personal coach included",
    popular: true,
    features: [
      "Everything in Self-maintained",
      "Dedicated personal coach",
      "Weekly check-ins",
      "Custom meal plans",
      "Priority support",
      "Advanced analytics",
    ],
  },
];

const howItWorks = [
  {
    title: "Assessment first",
    description:
      "Your coaching program starts with a health assessment. Your results inform every recommendation the app makes.",
  },
  {
    title: "Daily action plans",
    description:
      "Each day you receive a personalised set of actions across exercise, nutrition, sleep, and mental wellness.",
  },
  {
    title: "Track and adapt",
    description:
      "Log your activities, track your progress, and watch your health score improve over time. The app adapts to your journey.",
  },
  {
    title: "Regular check-ins",
    description:
      "Schedule periodic Check-in assessments to measure real physiological changes and update your program.",
  },
];

const typicalDay = [
  { time: "07:00", title: "Morning routine", description: "Vitamins, hydration, and movement", color: "#3B82F6", category: "Exercise" },
  { time: "09:00", title: "Educational snippet", description: "A short health insight pops up", color: "#06B6D4", category: "Mental" },
  { time: "12:00", title: "Lunch suggestion", description: "Meal idea with macro guidance", color: "#20c858", category: "Nutrition" },
  { time: "15:00", title: "Breathing exercise", description: "Afternoon reset reminder", color: "#06B6D4", category: "Mental" },
  { time: "18:00", title: "Workout plan", description: "Today's exercise session", color: "#3B82F6", category: "Exercise" },
  { time: "21:00", title: "Sleep wind-down", description: "Evening routine for better rest", color: "#8B5CF6", category: "Sleep" },
];

const comparisonFeatures = [
  { feature: "Daily action plans", free: false, self: true, full: true },
  { feature: "Exercise programs", free: "Limited", self: true, full: true },
  { feature: "Nutrition guidance", free: false, self: true, full: true },
  { feature: "Sleep tracking", free: false, self: true, full: true },
  { feature: "Progress tracking", free: false, self: true, full: true },
  { feature: "Community access", free: true, self: true, full: true },
  { feature: "Dedicated personal coach", free: false, self: false, full: true },
  { feature: "Weekly check-ins", free: false, self: false, full: true },
  { feature: "Custom meal plans", free: false, self: false, full: true },
  { feature: "Priority support", free: false, self: false, full: true },
  { feature: "Advanced analytics", free: false, self: false, full: true },
];

function FeatureCell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <svg className="w-5 h-5 text-[#20c858] mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (value === false) {
    return (
      <svg className="w-5 h-5 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return <span className="text-xs text-[#6B7280] font-medium">{value}</span>;
}

export default function CoachingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3] py-24 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1F2937] tracking-tight">
              Your daily <span className="text-[#20c858]">health coach</span>
            </h1>
            <p className="mt-6 text-lg text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
              The Lifeline app delivers personalised daily coaching across four
              pillars of health. Built on your assessment results, it adapts as
              you improve.
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-[#1F2937] mb-1">
                  {stat.value}
                </div>
                <div className="text-xs text-[#6B7280] mb-3">{stat.label}</div>
                <div className="h-1.5 bg-[#e6ecf4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#20c858] to-[#20c858]/60 rounded-full progress-bar-fill"
                    style={{ ["--progress-width" as string]: `${stat.width}%`, width: `${stat.width}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Four pillars in detail */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              The four pillars of health
            </h2>
            <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">
              A holistic approach to lasting well-being
            </p>
          </div>
          <div className="space-y-8">
            {pillars.map((pillar, i) => (
              <div
                key={pillar.title}
                className={`${pillar.bgColor} rounded-2xl p-8 lg:p-10 shadow-sm hover:shadow-md transition-all duration-200`}
              >
                <div
                  className={`grid grid-cols-1 lg:grid-cols-2 gap-8 items-start ${
                    i % 2 === 1 ? "lg:direction-rtl" : ""
                  }`}
                >
                  <div>
                    <div className="mb-4">
                      <PillarCircle color={pillar.color}>
                        {pillar.icon}
                      </PillarCircle>
                    </div>
                    <h3
                      className={`text-2xl font-bold ${pillar.textColor} mb-3`}
                    >
                      {pillar.title}
                    </h3>
                    <p className="text-[#6B7280] leading-relaxed mb-6">
                      {pillar.description}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1F2937] mb-4 uppercase tracking-wider">
                      Features
                    </h4>
                    <ul className="space-y-3">
                      {pillar.features.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                          <svg
                            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${pillar.textColor}`}
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What a typical day looks like */}
      <section className="py-20 sm:py-24 bg-[#ecf0f3]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">
              What a typical day looks like
            </h2>
            <p className="mt-3 text-[#6B7280]">
              Your app guides you through the day with personalised nudges
            </p>
          </div>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[1.19rem] top-3 bottom-3 w-0.5 bg-gradient-to-b from-[#3B82F6] via-[#20c858] to-[#8B5CF6]" />
            <div className="space-y-6">
              {typicalDay.map((item) => (
                <div key={item.time} className="relative pl-14 flex items-start">
                  {/* Colored dot */}
                  <div
                    className="absolute left-2 top-1.5 w-5 h-5 rounded-full border-[3px] border-white shadow-md z-10"
                    style={{ backgroundColor: item.color }}
                  />
                  {/* Time */}
                  <div className="w-14 flex-shrink-0 text-sm font-bold text-[#1F2937] pt-0.5">
                    {item.time}
                  </div>
                  {/* Card */}
                  <div className="flex-1 bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm text-[#1F2937]">
                        {item.title}
                      </h3>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${item.color}15`,
                          color: item.color,
                        }}
                      >
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280]">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How coaching works with assessment */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              How coaching works
            </h2>
            <p className="mt-4 text-lg text-[#6B7280]">
              Your assessment powers your coaching experience
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {howItWorks.map((item, i) => (
              <div
                key={item.title}
                className="bg-[#e6ecf4] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-full bg-[#20c858] text-white flex items-center justify-center font-bold text-sm mb-4 shadow-lg shadow-green-500/25">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-[#1F2937] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-[#6B7280] leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Subscription tiers */}
      <section className="py-24 sm:py-28 bg-[#ecf0f3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              Coaching subscriptions
            </h2>
            <p className="mt-4 text-lg text-[#6B7280]">
              Sign up directly in the app
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
            {subscriptions.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 transition-all duration-200 ${
                  plan.popular
                    ? "bg-[#1F2937] text-white ring-2 ring-[#20c858] md:scale-105 shadow-2xl md:-my-4"
                    : "bg-white shadow-sm hover:shadow-lg hover:-translate-y-1"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#20c858] text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-lg shadow-green-500/30">
                    Most popular
                  </div>
                )}
                <div className="mb-6">
                  <h3
                    className={`text-lg font-semibold ${
                      plan.popular ? "text-white" : "text-[#1F2937]"
                    }`}
                  >
                    {plan.name}
                  </h3>
                  <p
                    className={`text-sm mt-1 ${
                      plan.popular ? "text-gray-300" : "text-[#6B7280]"
                    }`}
                  >
                    {plan.description}
                  </p>
                </div>
                <div className="mb-6">
                  <span
                    className={`text-4xl font-bold ${
                      plan.popular ? "text-white" : "text-[#1F2937]"
                    }`}
                  >
                    {plan.price === "0" ? "0" : plan.price}
                  </span>
                  <span
                    className={`text-sm ml-2 ${
                      plan.popular ? "text-gray-300" : "text-[#6B7280]"
                    }`}
                  >
                    {plan.price === "0" ? "ISK" : `ISK / ${plan.period}`}
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
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
                      <span
                        className={`text-sm ${
                          plan.popular ? "text-gray-200" : "text-[#6B7280]"
                        }`}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <div
                  className={`block w-full text-center py-3.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-default ${
                    plan.popular
                      ? "bg-[#20c858] text-white shadow-lg shadow-green-500/30"
                      : "bg-[#1F2937] text-white"
                  }`}
                >
                  Sign up in the app
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">
              Compare plans
            </h2>
            <p className="mt-3 text-[#6B7280]">
              See what each tier includes
            </p>
          </div>
          <div className="bg-[#e6ecf4] rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-6 py-4 font-semibold text-[#1F2937]">Feature</th>
                    <th className="text-center px-4 py-4 font-semibold text-[#1F2937]">Free Plan</th>
                    <th className="text-center px-4 py-4 font-semibold text-[#1F2937]">Self-maintained</th>
                    <th className="text-center px-4 py-4 font-semibold text-[#20c858]">Full Access</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 0 ? "bg-white/50" : ""}>
                      <td className="px-6 py-3 text-[#6B7280]">{row.feature}</td>
                      <td className="px-4 py-3 text-center"><FeatureCell value={row.free} /></td>
                      <td className="px-4 py-3 text-center"><FeatureCell value={row.self} /></td>
                      <td className="px-4 py-3 text-center"><FeatureCell value={row.full} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Phone mockup / Download */}
      <section
        id="download"
        className="py-24 sm:py-28 bg-gradient-to-br from-[#1a3a2a] via-[#1F2937] to-[#111827] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(32,200,88,0.15),transparent)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="text-center lg:text-left">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Download the Lifeline app
              </h2>
              <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                Available on iOS and Android. Start with the free plan and
                experience personalised health coaching powered by your
                assessment data.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                {/* App Store badge */}
                <a
                  href="#"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-black text-white rounded-xl font-semibold hover:bg-gray-900 transition-all duration-200 border border-gray-700 hover:border-gray-600 shadow-lg"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-wider opacity-70">Download on the</div>
                    <div className="text-lg font-semibold leading-tight">App Store</div>
                  </div>
                </a>
                {/* Google Play badge */}
                <a
                  href="#"
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-black text-white rounded-xl font-semibold hover:bg-gray-900 transition-all duration-200 border border-gray-700 hover:border-gray-600 shadow-lg"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.4l2.443 1.413a1 1 0 010 1.56l-2.443 1.414-2.536-2.536 2.536-2.852zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-wider opacity-70">Get it on</div>
                    <div className="text-lg font-semibold leading-tight">Google Play</div>
                  </div>
                </a>
              </div>
            </div>
            {/* Phone mockup */}
            <div className="flex items-center justify-center">
              <PhoneMockupCoach />
            </div>
          </div>
        </div>
      </section>

      {/* Link to assessment */}
      <section className="py-24 sm:py-28 bg-[#ecf0f3]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937] mb-6">
            Better coaching starts with better data
          </h2>
          <p className="text-lg text-[#6B7280] max-w-2xl mx-auto mb-10 leading-relaxed">
            Your health assessment results power every recommendation in the
            app. Get assessed first for the best coaching experience.
          </p>
          <Link
            href="/assessment"
            className="inline-flex items-center justify-center px-10 py-4 text-base font-semibold text-white bg-[#20c858] rounded-full hover:bg-[#1ab34d] transition-all duration-200 shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
          >
            View Assessment Packages
          </Link>
        </div>
      </section>
    </div>
  );
}
