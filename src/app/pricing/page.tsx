"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import MedaliaButton from "../components/MedaliaButton";

const assessmentColors = [
  { accent: "border-t-4 border-t-[#3B82F6]", iconBg: "bg-blue-50 border border-blue-100", iconText: "text-[#3B82F6]", checkColor: "text-[#3B82F6]" },
  { accent: "border-t-4 border-t-[#10B981]", iconBg: "bg-green-50 border border-green-100", iconText: "text-[#10B981]", checkColor: "text-[#10B981]" },
  { accent: "border-t-4 border-t-[#8B5CF6]", iconBg: "bg-purple-50 border border-purple-100", iconText: "text-[#8B5CF6]", checkColor: "text-[#8B5CF6]" },
];

const assessmentIcons = [
  // Foundational Health - clipboard
  <svg key="foundational" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 011.65 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 3.98 8.25 4.555 8.25 5.438v15.312c0 .966.784 1.75 1.75 1.75h8c.966 0 1.75-.784 1.75-1.75V5.438c0-.883-.845-1.458-1.476-1.522a44.5 44.5 0 00-1.124-.08" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11h4M12 15h4M12 19h4M8.5 11h.01M8.5 15h.01M8.5 19h.01" />
  </svg>,
  // Check-in - chart
  <svg key="checkin" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>,
  // Self Check-in - phone
  <svg key="selfcheckin" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  </svg>,
];

const assessmentPackages = [
  {
    name: "Foundational Health",
    price: "49.900",
    unit: "ISK",
    type: "One-time",
    description: "Complete health screening",
    features: [
      "Full body composition analysis",
      "Targeted blood panel for metabolic health",
      "Lifestyle questionnaire",
      "Doctor-reviewed health report",
      "Personal physician consultation",
      "Personalised recommendations",
    ],
  },
  {
    name: "Check-in",
    price: "19.900",
    unit: "ISK",
    type: "One-time",
    description: "Progress tracking visit",
    features: [
      "Body composition analysis",
      "Progress comparison report",
      "Updated health score",
      "Brief physician review",
      "Updated recommendations",
    ],
  },
  {
    name: "Self Check-in",
    price: "Free",
    unit: "",
    type: "Online",
    description: "Questionnaire from home",
    features: [
      "Online health questionnaire",
      "Self-reported metrics",
      "Basic health score",
      "No visit required",
    ],
  },
];

const coachingPlans = [
  {
    name: "Free Plan",
    monthlyPrice: "0",
    annualPrice: "0",
    period: "",
    description: "Get started with Lifeline",
    features: [
      "Basic health questionnaire",
      "Sample action plans",
      "Limited exercise programs",
      "Community access",
    ],
  },
  {
    name: "Self-maintained",
    monthlyPrice: "9.900",
    annualPrice: "7.900",
    period: "per month",
    description: "Full tools, self-guided",
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
    monthlyPrice: "29.900",
    annualPrice: "23.900",
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

const faqs = [
  {
    question: "What is the difference between assessments and coaching?",
    answer:
      "Assessments are one-time health screenings (body composition, blood tests, doctor consultation) booked through our patient portal. Coaching is a monthly app subscription that provides daily action plans, exercise programs, and nutrition guidance based on your assessment results.",
  },
  {
    question: "Do I need an assessment to use the coaching app?",
    answer:
      "You can start the coaching app with the free plan without an assessment. However, for the best personalised experience, we recommend completing at least the Self Check-in questionnaire. The Foundational Health assessment provides the best data for personalised coaching.",
  },
  {
    question: "How do I book an assessment?",
    answer:
      "Click any 'Book Now' button to open our patient portal powered by Medalia. You can choose your package, pick a time slot, and complete any required questionnaires online.",
  },
  {
    question: "How do I subscribe to coaching?",
    answer:
      "Coaching subscriptions are managed on our website. Create an account, then subscribe from the pricing page or your account page. You can start with the free plan.",
  },
  {
    question: "Can I cancel my coaching subscription?",
    answer:
      "Yes, you can cancel anytime from your account page on the website. You will keep access until the end of your current billing period. No cancellation fees.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "Assessments can be paid via the patient portal (credit/debit cards). Coaching subscriptions are managed through our website.",
  },
  {
    question: "How often should I do a Check-in assessment?",
    answer:
      "We recommend every 3-6 months to track meaningful progress in body composition and update your coaching program.",
  },
];

export default function PricingPage() {
  const { t } = useI18n();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3] py-24 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1F2937] tracking-tight">
              {t('pricing.hero.title', 'Simple, transparent pricing')}{" "}
              <span className="text-[#10B981]">pricing</span>
            </h1>
            <p className="mt-6 text-lg text-[#6B7280]">
              Health assessments are one-time bookings. Coaching is a monthly app
              subscription. No hidden fees.
            </p>
          </div>
        </div>
      </section>

      {/* Assessment packages */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">
              {t('pricing.assessments.title', 'Health Assessment Packages')}
            </h2>
            <p className="mt-3 text-[#6B7280]">
              One-time payments &middot; Book via patient portal
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {assessmentPackages.map((pkg, i) => {
              const color = assessmentColors[i];
              return (
                <div
                  key={pkg.name}
                  className={`bg-[#e6ecf4] rounded-2xl p-8 flex flex-col shadow-sm hover:shadow-xl hover:scale-[1.03] transition-all duration-200 ${color.accent}`}
                >
                  <div className={`w-16 h-16 rounded-xl ${color.iconBg} ${color.iconText} flex items-center justify-center mb-6`}>
                    {assessmentIcons[i]}
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-semibold text-[#1F2937]">
                      {pkg.name}
                    </h3>
                    <span className="text-xs font-medium text-[#10B981] bg-[#10B981]/10 px-2 py-1 rounded-full">
                      {pkg.type}
                    </span>
                  </div>
                  <p className="text-sm text-[#6B7280] mb-4">
                    {pkg.description}
                  </p>
                  <div className="mb-6">
                    <span className="text-3xl font-bold text-[#1F2937]">
                      {pkg.price}
                    </span>
                    {pkg.unit && (
                      <span className="text-sm text-[#6B7280] ml-2">
                        {pkg.unit}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-2 mb-8 flex-1">
                    {pkg.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <svg
                          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${color.checkColor}`}
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
                  <MedaliaButton label="Book Now" size="md" className="w-full" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Wave separator */}
      <div className="relative bg-white">
        <svg className="w-full h-16 sm:h-24 text-[#ecf0f3]" viewBox="0 0 1440 100" preserveAspectRatio="none" fill="currentColor">
          <path d="M0,0 C360,100 1080,0 1440,100 L1440,100 L0,100 Z" />
        </svg>
      </div>

      {/* Coaching subscriptions */}
      <section className="py-24 sm:py-28 bg-[#ecf0f3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1F2937]">
              {t('pricing.coaching.title', 'Coaching Subscriptions')}
            </h2>
            <p className="mt-3 text-[#6B7280] mb-8">
              Monthly subscriptions &middot; Manage on our website
            </p>

            {/* Monthly / Annual toggle */}
            <div className="inline-flex items-center gap-3 bg-white rounded-full p-1.5 shadow-sm">
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  !isAnnual
                    ? "bg-[#10B981] text-white shadow-md"
                    : "text-[#6B7280] hover:text-[#1F2937]"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  isAnnual
                    ? "bg-[#10B981] text-white shadow-md"
                    : "text-[#6B7280] hover:text-[#1F2937]"
                }`}
              >
                Annual
                <span className="ml-1.5 text-xs font-bold text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded-full">
                  -20%
                </span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto items-stretch">
            {coachingPlans.map((plan) => {
              const displayPrice = isAnnual ? plan.annualPrice : plan.monthlyPrice;
              return (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl p-8 transition-all duration-200 flex flex-col ${
                    plan.popular
                      ? "bg-[#1F2937] text-white ring-2 ring-[#10B981] md:scale-105 shadow-2xl md:-my-4"
                      : "bg-white shadow-sm hover:shadow-xl hover:-translate-y-1"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#10B981] text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-lg shadow-green-500/30">
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
                      {displayPrice}
                    </span>
                    <span
                      className={`text-sm ml-2 ${
                        plan.popular ? "text-gray-300" : "text-[#6B7280]"
                      }`}
                    >
                      {displayPrice === "0" ? "ISK / month" : `ISK / ${plan.period}`}
                    </span>
                    {isAnnual && plan.monthlyPrice !== "0" && (
                      <div className={`text-xs mt-1 ${plan.popular ? "text-gray-400" : "text-[#6B7280]"}`}>
                        <span className="line-through">{plan.monthlyPrice}</span>
                        <span className="ml-1.5 text-[#10B981] font-medium">Save 20%</span>
                      </div>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <svg
                          className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#10B981]"
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
                  {plan.monthlyPrice === "0" ? (
                    <Link
                      href="/account/login"
                      className={`block w-full text-center py-3.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                        plan.popular
                          ? "bg-[#10B981] text-white shadow-lg shadow-green-500/30 hover:bg-[#047857]"
                          : "bg-[#1F2937] text-white hover:bg-[#374151]"
                      }`}
                    >
                      Get started
                    </Link>
                  ) : (
                    <Link
                      href={`/account?upgrade=${plan.name === "Self-maintained" ? "self-maintained" : "full-access"}`}
                      className={`block w-full text-center py-3.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                        plan.popular
                          ? "bg-[#10B981] text-white shadow-lg shadow-green-500/30 hover:bg-[#047857]"
                          : "bg-[#1F2937] text-white hover:bg-[#374151]"
                      }`}
                    >
                      Subscribe
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">
              {t('pricing.faq.title', 'Frequently asked questions')}
            </h2>
            <p className="mt-4 text-lg text-[#6B7280]">
              Everything you need to know
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-[#e6ecf4] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-[#dce3ee] transition-colors duration-200"
                >
                  <span className="font-medium text-[#1F2937] pr-4">
                    {faq.question}
                  </span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    openFaq === i ? "bg-[#10B981] text-white rotate-180" : "bg-white text-[#6B7280]"
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

      {/* Gradient CTA */}
      <section className="py-24 sm:py-28 bg-gradient-to-br from-[#1a3a2a] via-[#1F2937] to-[#111827] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(32,200,88,0.15),transparent)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to start your health journey?
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Get the health data that matters with our targeted assessments, or start building better habits with personalised coaching.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <MedaliaButton label="Book Assessment" size="lg" />
            <Link
              href="/account/login"
              className="px-8 py-3.5 rounded-full text-sm font-semibold bg-white text-[#1F2937] hover:bg-gray-100 transition-all duration-200 shadow-lg"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
