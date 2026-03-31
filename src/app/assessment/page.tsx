"use client";

import { useState } from "react";
import MedaliaButton from "../components/MedaliaButton";

const packages = [
  {
    name: "Foundational Health",
    price: "49.900",
    description: "Our comprehensive health screening for new members",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 011.65 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 3.98 8.25 4.555 8.25 5.438v15.312c0 .966.784 1.75 1.75 1.75h8c.966 0 1.75-.784 1.75-1.75V5.438c0-.883-.845-1.458-1.476-1.522a44.5 44.5 0 00-1.124-.08" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11h4M12 15h4M12 19h4M8.5 11h.01M8.5 15h.01M8.5 19h.01" />
      </svg>
    ),
    includes: [
      "Full body composition analysis (InBody 770)",
      "Comprehensive blood panel (40+ biomarkers)",
      "Blood pressure and resting heart rate",
      "Lifestyle and nutrition questionnaire",
      "Doctor-reviewed comprehensive health report",
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
      "Body composition analysis (InBody 770)",
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

const processSteps = [
  {
    step: "1",
    title: "Book your assessment",
    description:
      "Open the patient portal and choose the Foundational Health or Check-in package. Pick a time that suits you.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M5 14.5l-1.43 1.43a2.25 2.25 0 00-.659 1.591v2.228c0 1.243 1.007 2.25 2.25 2.25h13.676a2.25 2.25 0 002.25-2.25v-2.228c0-.597-.237-1.17-.659-1.591L19 14.5" />
      </svg>
    ),
  },
  {
    step: "4",
    title: "Results reviewed",
    description:
      "A Lifeline physician reviews all your results and prepares your comprehensive health report.",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    question: "What biomarkers are included in the blood panel?",
    answer:
      "Our comprehensive panel includes 40+ biomarkers covering lipid profile, metabolic markers, thyroid function, liver and kidney function, complete blood count, vitamins (D, B12, folate), iron studies, inflammatory markers, and hormone levels.",
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
              Health Assessment{" "}
              <span className="text-[#20c858]">Packages</span>
            </h1>
            <p className="mt-6 text-lg text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
              Get a complete picture of your health with our comprehensive
              screening packages. Know your numbers, understand your body, and
              get personalised recommendations from a physician.
            </p>
            <div className="mt-8">
              <MedaliaButton label="Book Assessment" size="lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Your assessment journey - horizontal stepper */}
      <section className="py-16 sm:py-20 bg-white overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">
              Your assessment journey
            </h2>
            <p className="mt-3 text-[#6B7280]">
              Six simple steps from booking to your personalised report
            </p>
          </div>

          {/* Desktop: horizontal stepper */}
          <div className="hidden md:block">
            <div className="flex items-start justify-between relative">
              {/* Connecting line */}
              <div className="absolute top-[18px] left-[calc(8.33%)] right-[calc(8.33%)] h-[2px] bg-gray-200">
                <div className="h-full bg-[#20c858] border-dashed" style={{ borderTop: "2px dashed #20c858", background: "transparent" }} />
              </div>
              {[
                { step: "1", title: "Book online", desc: "Schedule via patient portal" },
                { step: "2", title: "Visit station", desc: "Body scan & measurements" },
                { step: "3", title: "Blood test", desc: "At any Sameind location" },
                { step: "4", title: "Questionnaire", desc: "Lifestyle & habits survey" },
                { step: "5", title: "Doctor review", desc: "Physician analyses results" },
                { step: "6", title: "Your report", desc: "Personalised health plan" },
              ].map((s) => (
                <div key={s.step} className="flex flex-col items-center text-center relative z-10" style={{ width: "16.666%" }}>
                  <div className="w-9 h-9 rounded-full bg-[#20c858] text-white flex items-center justify-center font-bold text-sm shadow-md shadow-green-500/20 mb-3">
                    {s.step}
                  </div>
                  <h3 className="text-sm font-semibold text-[#1F2937] mb-1">{s.title}</h3>
                  <p className="text-xs text-[#6B7280] leading-snug px-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: simple numbered list, no connecting lines */}
          <div className="md:hidden">
            <div className="space-y-6">
              {[
                { step: "1", title: "Book online", desc: "Schedule via patient portal" },
                { step: "2", title: "Visit station", desc: "Body scan & measurements" },
                { step: "3", title: "Blood test", desc: "At any Sameind location" },
                { step: "4", title: "Questionnaire", desc: "Lifestyle & habits survey" },
                { step: "5", title: "Doctor review", desc: "Physician analyses results" },
                { step: "6", title: "Your report", desc: "Personalised health plan" },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#20c858] text-white flex items-center justify-center font-bold text-sm shadow-md shadow-green-500/20 flex-shrink-0">
                    {s.step}
                  </div>
                  <div className="pt-1">
                    <h3 className="text-sm font-semibold text-[#1F2937] mb-0.5">{s.title}</h3>
                    <p className="text-xs text-[#6B7280] leading-snug">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Packages detail */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {packages.map((pkg) => (
              <div
                key={pkg.name}
                className="bg-[#e6ecf4] rounded-2xl p-8 flex flex-col shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
              >
                <div className="w-14 h-14 rounded-xl bg-[#20c858]/10 text-[#20c858] flex items-center justify-center mb-4">
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
            ))}
          </div>
        </div>
      </section>

      {/* Process - Visual Timeline */}
      <section className="py-24 sm:py-28 bg-[#ecf0f3]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              The assessment process
            </h2>
            <p className="mt-4 text-lg text-[#6B7280]">
              From booking to personalised recommendations
            </p>
          </div>
          {/* Desktop: vertical timeline with connecting line */}
          <div className="hidden md:block space-y-0">
            {processSteps.map((s, i) => (
              <div
                key={s.step}
                className="relative pl-14 pb-10 last:pb-0"
              >
                {/* Vertical connecting line */}
                {i < processSteps.length - 1 && (
                  <div className="absolute left-[1.19rem] top-[3.25rem] bottom-0 w-0.5 bg-gradient-to-b from-[#20c858] to-[#20c858]/20" />
                )}
                {/* Step number circle — aligned to top of card */}
                <div className="absolute left-0 top-3 w-10 h-10 rounded-full bg-[#20c858] text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-green-500/25 z-10">
                  {s.step}
                </div>
                {/* Content card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#20c858]/10 text-[#20c858] flex items-center justify-center">
                      {s.icon}
                    </div>
                    <h3 className="font-semibold text-[#1F2937]">
                      {s.title}
                    </h3>
                  </div>
                  <p className="text-sm text-[#6B7280] leading-relaxed ml-11">
                    {s.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: simple list without connecting lines */}
          <div className="md:hidden space-y-6">
            {processSteps.map((s) => (
              <div key={s.step} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#20c858] text-white flex items-center justify-center font-bold text-sm shadow-lg shadow-green-500/25 flex-shrink-0">
                  {s.step}
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#20c858]/10 text-[#20c858] flex items-center justify-center">
                      {s.icon}
                    </div>
                    <h3 className="font-semibold text-[#1F2937]">
                      {s.title}
                    </h3>
                  </div>
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Locations */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-2xl font-bold text-[#1F2937] mb-4">
                Lifeline Station
              </h2>
              <p className="text-[#6B7280] mb-4 leading-relaxed">
                Visit our station for body composition analysis and
                measurements.
              </p>
              <div className="bg-[#e6ecf4] rounded-2xl p-6 mb-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#20c858]/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-[#20c858]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1F2937] mb-1">
                      Reykjavik
                    </h3>
                    <p className="text-sm text-[#6B7280]">
                      Lagmula 5, 108 Reykjavik
                    </p>
                    <p className="text-xs text-[#6B7280] mt-1">
                      Monday - Friday: 08:00 - 17:00
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-[#6B7280] italic">
                Additional locations coming soon.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#1F2937] mb-4">
                Sameind Blood Test Stations
              </h2>
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
