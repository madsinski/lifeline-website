"use client";

import { useState } from "react";
import MedaliaButton from "../components/MedaliaButton";
import { PhoneMockup } from "../components/PhoneMockup";
import ScrollPhone from "../components/ScrollPhone";
import WaveSeparator from "../components/WaveSeparator";

const packageColors = [
  { accent: "border-t-4 border-t-[#20c858]", iconBg: "bg-green-50 border border-green-100", iconText: "text-[#20c858]" },
  { accent: "border-t-4 border-t-[#3B82F6]", iconBg: "bg-blue-50 border border-blue-100", iconText: "text-[#3B82F6]" },
  { accent: "border-t-4 border-t-[#8B5CF6]", iconBg: "bg-purple-50 border border-purple-100", iconText: "text-[#8B5CF6]" },
];

const packages = [
  {
    name: "Foundational Health",
    price: "49.900",
    description: "Our foundational health screening for new members",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 011.65 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 3.98 8.25 4.555 8.25 5.438v15.312c0 .966.784 1.75 1.75 1.75h8c.966 0 1.75-.784 1.75-1.75V5.438c0-.883-.845-1.458-1.476-1.522a44.5 44.5 0 00-1.124-.08" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11h4M12 15h4M12 19h4M8.5 11h.01M8.5 15h.01M8.5 19h.01" />
      </svg>
    ),
    includes: [
      "Body composition analysis with clinical accuracy",
      "Targeted blood panel for metabolic health",
      "Blood pressure screening",
      "Lifestyle and nutrition questionnaire",
      "Doctor-reviewed health report",
      "30-minute personal consultation with physician",
      "Personalised health score and recommendations",
      "Access to patient portal for results",
    ],
    ideal: "First-time members who want a complete picture of their health",
  },
  {
    name: "Check-in",
    price: "19.900",
    description: "Track your progress with repeat measurements",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    includes: [
      "Body composition analysis",
      "Progress comparison with previous results",
      "Updated health score",
      "Brief physician review",
      "Updated recommendations",
    ],
    ideal:
      "Existing members who want to measure improvement after 3-6 months of coaching",
  },
  {
    name: "Self Check-in",
    price: "Free",
    description: "Complete a health questionnaire from home",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    includes: [
      "Comprehensive online health questionnaire",
      "Self-reported health metrics",
      "Basic health score calculation",
      "Lifestyle and habit tracking",
      "No visit to station required",
    ],
    ideal:
      "Anyone who wants to start tracking their health before committing to a full assessment",
  },
];

const stepColors = [
  { bg: "bg-blue-50", border: "border-blue-100", text: "text-[#3B82F6]", badge: "bg-[#3B82F6]" },
  { bg: "bg-green-50", border: "border-green-100", text: "text-[#20c858]", badge: "bg-[#20c858]" },
  { bg: "bg-purple-50", border: "border-purple-100", text: "text-[#8B5CF6]", badge: "bg-[#8B5CF6]" },
  { bg: "bg-amber-50", border: "border-amber-100", text: "text-[#F59E0B]", badge: "bg-[#F59E0B]" },
  { bg: "bg-cyan-50", border: "border-cyan-100", text: "text-[#06B6D4]", badge: "bg-[#06B6D4]" },
];

const processSteps = [
  {
    step: "1",
    title: "Book your assessment",
    description:
      "Open the patient portal and choose the Foundational Health or Check-in package. Pick a time that suits you.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    step: "2",
    title: "Visit our station",
    description:
      "Come to our Lagmula 5 station in Reykjavik for your body composition scan and measurements. Takes about 20 minutes.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
  {
    step: "3",
    title: "Blood test at Sameind",
    description:
      "Visit any Sameind blood collection station for your blood panel. Results are sent directly to Lifeline.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M5 14.5l-1.43 1.43a2.25 2.25 0 00-.659 1.591v2.228c0 1.243 1.007 2.25 2.25 2.25h13.676a2.25 2.25 0 002.25-2.25v-2.228c0-.597-.237-1.17-.659-1.591L19 14.5" />
      </svg>
    ),
  },
  {
    step: "4",
    title: "Results reviewed",
    description:
      "A Lifeline physician reviews all your results and prepares your personalised health report.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    step: "5",
    title: "Doctor interview",
    description:
      "Meet with your doctor (in-person or video) to discuss your results, health score, and personalised recommendations.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

const sameindLocations = [
  { name: "Sameind - Sudurlandsbraut 34, Reykjavik", type: "main" },
  { name: "Sameind - Akureyri Hospital", type: "hospital" },
  { name: "Sameind - Selfoss Health Centre", type: "clinic" },
  { name: "Sameind - Isafjordur Hospital", type: "hospital" },
  { name: "Sameind - Husavik Health Centre", type: "clinic" },
];

const faqs = [
  {
    question: "How long does the Foundational Health assessment take?",
    answer:
      "The station visit takes about 20 minutes. The blood test at Sameind takes 10-15 minutes. Your doctor consultation is 30 minutes. In total, expect about 1 hour spread across two visits plus the consultation.",
  },
  {
    question: "Do I need to fast before the blood test?",
    answer:
      "Yes, we recommend fasting for 10-12 hours before your blood test for the most accurate results. Water and black coffee are fine.",
  },
  {
    question: "How quickly will I get my results?",
    answer:
      "Body composition results are available immediately. Blood test results typically take 3-5 business days. Once all results are in, your doctor will review them within 2 business days and schedule your consultation.",
  },
  {
    question: "Can I do the blood test at any Sameind location?",
    answer:
      "Yes. After booking your assessment through our patient portal, you will receive a referral that is valid at all Sameind blood collection stations across Iceland.",
  },
  {
    question: "What does the blood panel include?",
    answer:
      "We select only the markers that matter for assessing metabolic health — no unnecessary tests. You get the most relevant insights for the best value, covering key areas like lipids, blood sugar, thyroid function, and essential vitamins.",
  },
  {
    question: "How often should I do a Check-in?",
    answer:
      "We recommend a Check-in every 3-6 months to track your progress. This allows enough time for meaningful changes to show in your body composition results.",
  },
];

export default function AssessmentPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3] py-24 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1F2937] tracking-tight">
              Health{" "}
              <span className="text-[#20c858]">Assessment</span>
            </h1>
            <p className="mt-6 text-lg text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
              Get the health data that matters most. Our targeted screening
              packages focus on metabolic health markers that drive real
              change — no unnecessary tests, maximum value.
            </p>
            <div className="mt-8">
              <MedaliaButton label="Book Assessment" size="lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#ecf0f3" to="#ffffff" />

      {/* Process - Visual Timeline */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              The assessment process
            </h2>
            <p className="mt-4 text-lg text-[#6B7280]">
              From booking to personalised recommendations
            </p>
          </div>
          {/* Process steps */}
          <div className="max-w-3xl mx-auto space-y-6">
            {processSteps.map((s, i) => {
              const color = stepColors[i];
              return (
                <div
                  key={s.step}
                  className="bg-[#e6ecf4] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start gap-6">
                    <div className="relative flex-shrink-0">
                      <div className={`w-24 h-24 rounded-3xl ${color.bg} border ${color.border} ${color.text} flex items-center justify-center`}>
                        {s.icon}
                      </div>
                      <div className={`absolute -top-2 -right-2 w-8 h-8 ${color.badge} rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg`}>
                        {s.step}
                      </div>
                    </div>
                    <div className="flex-1 pt-2">
                      <h3 className="font-semibold text-[#1F2937] text-lg mb-2">
                        {s.title}
                      </h3>
                      <p className="text-sm text-[#6B7280] leading-relaxed">
                        {s.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Results preview + scroll phone */}
      <section className="bg-white" style={{ height: "220vh" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-16 h-full">
            {/* Left: text content, static on mobile, sticky on desktop */}
            <div className="pt-24 sm:pt-28 lg:pt-0 lg:sticky lg:top-0 lg:h-screen flex items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937] mb-6">
                  Your results, <span className="text-[#20c858]">explained</span>
                </h2>
                <p className="text-lg text-[#6B7280] mb-6 leading-relaxed">
                  After your assessment, receive a comprehensive health report with scores across all key health categories. Your doctor reviews every result and meets with you to discuss findings and next steps.
                </p>
                <ul className="space-y-3 mb-6">
                  {["Health score across 6 categories", "Blood test results with clinical context", "Body composition breakdown", "Personalised recommendations", "Direct access in the Lifeline app"].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-[#6B7280]">
                      <svg className="w-5 h-5 text-[#20c858] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex items-start gap-3 bg-[#ecf0f3] rounded-xl p-4">
                  <svg className="w-5 h-5 text-[#20c858] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    All results are stored securely in your <a href="https://medalia.is" target="_blank" rel="noopener noreferrer" className="text-[#20c858] hover:underline font-medium">Medalia</a> patient portal. The Lifeline app provides secure access to view your data.
                  </p>
                </div>
              </div>
            </div>
            {/* Right: scroll phone mockup */}
            <div className="flex justify-center flex-1 lg:flex-none lg:h-auto">
              <ScrollPhone
                inline
                screenshot="/app-screenshot-health-scroll.jpg"
                alt="Your health results in the app"
                initialOffset={3}
                maxTranslate={35}
                phoneHeight="75vh"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Track your health + scroll phone */}
      <section className="bg-[#ecf0f3]" style={{ height: "220vh" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-16 h-full">
            {/* Left: scroll phone mockup — below text on mobile */}
            <div className="flex justify-center flex-1 lg:flex-none lg:h-auto order-2 lg:order-1">
              <ScrollPhone
                inline
                screenshot="/app-screenshot-myhealth-scroll.jpg"
                alt="Track measurements and blood tests"
                initialOffset={1}
                maxTranslate={35}
                phoneHeight="75vh"
              />
            </div>
            {/* Right: text content, static on mobile, sticky on desktop */}
            <div className="pt-24 sm:pt-28 lg:pt-0 lg:sticky lg:top-0 lg:h-screen flex items-center order-1 lg:order-2">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937] mb-6">
                  Track your <span className="text-[#20c858]">progress</span>
                </h2>
                <p className="text-lg text-[#6B7280] mb-6 leading-relaxed">
                  Your measurements, blood test results and health scores in one place. See how your numbers change over time and understand what they mean for your metabolic health.
                </p>
                <ul className="space-y-3 mb-6">
                  {["Body composition: weight, fat mass, muscle mass, BMI", "Blood pressure", "Targeted blood test markers with clinical context", "Health scores across all categories", "Progress charts comparing previous check-ups"].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-[#6B7280]">
                      <svg className="w-5 h-5 text-[#20c858] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex items-start gap-3 bg-white/80 rounded-xl p-4">
                  <svg className="w-5 h-5 text-[#20c858] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    Your health data is stored securely in <a href="https://medalia.is" target="_blank" rel="noopener noreferrer" className="text-[#20c858] hover:underline font-medium">Medalia</a>. The Lifeline app is a secure window into your records — your data never leaves the portal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#ecf0f3" to="#ffffff" />

      {/* Packages */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              Assessment <span className="text-[#20c858]">Packages</span>
            </h2>
            <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">
              Choose the assessment that fits your needs
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {packages.map((pkg, i) => {
              const color = packageColors[i];
              return (
                <div
                  key={pkg.name}
                  className={`bg-[#e6ecf4] rounded-2xl p-8 flex flex-col shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-200 ${color.accent}`}
                >
                  <div className={`w-14 h-14 rounded-xl ${color.iconBg} ${color.iconText} flex items-center justify-center mb-4`}>
                    {pkg.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-[#1F2937] mb-1">
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
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-[#1F2937] mb-3">
                      What&apos;s included:
                    </h4>
                    <ul className="space-y-2">
                      {pkg.includes.map((item) => (
                        <li key={item} className="flex items-start gap-3">
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
                          <span className="text-sm text-[#6B7280]">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white/60 rounded-xl p-4 mb-6">
                    <p className="text-xs text-[#6B7280]">
                      <span className="font-semibold text-[#1F2937]">
                        Ideal for:{" "}
                      </span>
                      {pkg.ideal}
                    </p>
                  </div>
                  <div className="mt-auto">
                    <MedaliaButton
                      label="Book Now"
                      size="md"
                      className="w-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Test locations */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              Test <span className="text-[#20c858]">locations</span>
            </h2>
            <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">
              Where to complete your assessment
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <h3 className="text-xl font-bold text-[#1F2937] mb-4">
                Lifeline Station
              </h3>
              <p className="text-[#6B7280] mb-4 leading-relaxed">
                Visit our station for body composition analysis and
                measurements.
              </p>
              <div className="space-y-3">
                {[
                  { name: "Reykjavik", address: "Lagmula 5, 108 Reykjavik", hours: "Monday - Friday: 08:00 - 17:00" },
                  { name: "Akureyri", address: "Coming soon", hours: null },
                  { name: "Selfoss", address: "Coming soon", hours: null },
                ].map((station) => (
                  <div key={station.name} className="bg-[#e6ecf4] rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#20c858]/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-[#20c858]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#1F2937] mb-0.5">{station.name}</h3>
                        <p className="text-sm text-[#6B7280]">{station.address}</p>
                        {station.hours && <p className="text-xs text-[#6B7280] mt-1">{station.hours}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1F2937] mb-4">
                Sameind Blood Test Stations
              </h3>
              <p className="text-[#6B7280] mb-4 leading-relaxed">
                Get your blood drawn at any Sameind location across Iceland.
                Your referral is valid at all stations.
              </p>
              <div className="space-y-3">
                {sameindLocations.map((loc) => (
                  <div
                    key={loc.name}
                    className="bg-[#e6ecf4] rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    {loc.type === "main" ? (
                      <div className="w-8 h-8 rounded-lg bg-[#20c858]/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#20c858]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                        </svg>
                      </div>
                    ) : loc.type === "hospital" ? (
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#3B82F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#8B5CF6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                      </div>
                    )}
                    <span className="text-sm text-[#6B7280]">{loc.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <WaveSeparator from="#ffffff" to="#ecf0f3" />

      {/* FAQ */}
      <section className="py-24 sm:py-28 bg-[#ecf0f3]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              Frequently asked questions
            </h2>
            <p className="mt-4 text-lg text-[#6B7280]">
              Everything you need to know about assessments
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50/50 transition-colors duration-200"
                >
                  <span className="font-medium text-[#1F2937] pr-4">
                    {faq.question}
                  </span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    openFaq === i ? "bg-[#20c858] text-white rotate-180" : "bg-[#e6ecf4] text-[#6B7280]"
                  }`}>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 accordion-content">
                    <p className="text-sm text-[#6B7280] leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 sm:py-28 bg-gradient-to-br from-[#1a3a2a] via-[#1F2937] to-[#111827] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(32,200,88,0.15),transparent)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to know your numbers?
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Book your health assessment today through our secure patient portal.
          </p>
          <MedaliaButton label="Book Assessment" size="lg" />
        </div>
      </section>
    </div>
  );
}
