"use client";

import { useState } from "react";
import MedaliaButton from "../components/MedaliaButton";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3] py-24 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1F2937] tracking-tight">
              Get in <span className="text-[#20c858]">touch</span>
            </h1>
            <p className="mt-6 text-lg text-[#6B7280]">
              Have a question or want to learn more? We would love to hear from
              you.
            </p>
          </div>
        </div>
      </section>

      {/* Contact form + info */}
      <section className="py-24 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Form */}
            <div>
              <h2 className="text-2xl font-bold text-[#1F2937] mb-6">
                Send us a message
              </h2>

              {submitted ? (
                <div className="bg-[#20c858]/5 border border-[#20c858]/20 rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-[#20c858]/10 flex items-center justify-center mx-auto mb-4 success-checkmark">
                    <svg className="w-8 h-8 text-[#20c858]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                    Message sent!
                  </h3>
                  <p className="text-sm text-[#6B7280] mb-6">
                    Thank you for reaching out. We will get back to you within 1-2 business days.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-sm font-medium text-[#20c858] hover:text-[#1ab34d] transition-colors duration-200"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-[#1F2937] mb-2"
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-[#e6ecf4] border-2 border-transparent focus:border-[#20c858] focus:ring-2 focus:ring-[#20c858]/20 outline-none transition-all duration-200 text-[#1F2937] placeholder:text-[#6B7280]/60"
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-[#1F2937] mb-2"
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-[#e6ecf4] border-2 border-transparent focus:border-[#20c858] focus:ring-2 focus:ring-[#20c858]/20 outline-none transition-all duration-200 text-[#1F2937] placeholder:text-[#6B7280]/60"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="subject"
                      className="block text-sm font-medium text-[#1F2937] mb-2"
                    >
                      Subject
                    </label>
                    <input
                      type="text"
                      id="subject"
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData({ ...formData, subject: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-[#e6ecf4] border-2 border-transparent focus:border-[#20c858] focus:ring-2 focus:ring-[#20c858]/20 outline-none transition-all duration-200 text-[#1F2937] placeholder:text-[#6B7280]/60"
                      placeholder="How can we help?"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="message"
                      className="block text-sm font-medium text-[#1F2937] mb-2"
                    >
                      Message
                    </label>
                    <textarea
                      id="message"
                      rows={5}
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-[#e6ecf4] border-2 border-transparent focus:border-[#20c858] focus:ring-2 focus:ring-[#20c858]/20 outline-none transition-all duration-200 text-[#1F2937] placeholder:text-[#6B7280]/60 resize-none"
                      placeholder="Tell us more..."
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-8 py-3.5 bg-[#20c858] text-white font-semibold rounded-full hover:bg-[#1ab34d] transition-all duration-200 shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
                  >
                    Send Message
                  </button>
                </form>
              )}
            </div>

            {/* Info */}
            <div>
              <h2 className="text-2xl font-bold text-[#1F2937] mb-6">
                Contact information
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#20c858]/10 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-[#20c858]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1F2937]">Email</h3>
                    <a
                      href="mailto:contact@lifelinehealth.is"
                      className="text-[#6B7280] hover:text-[#20c858] transition-colors duration-200"
                    >
                      contact@lifelinehealth.is
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#20c858]/10 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-[#20c858]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1F2937]">Address</h3>
                    <p className="text-[#6B7280]">
                      Lagmula 5
                      <br />
                      108 Reykjavik
                      <br />
                      Iceland
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#20c858]/10 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-[#20c858]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1F2937]">
                      Office hours
                    </h3>
                    <p className="text-[#6B7280]">
                      Monday - Friday: 08:00 - 17:00
                    </p>
                  </div>
                </div>
              </div>

              {/* Patient portal */}
              <div className="mt-10 bg-[#e6ecf4] rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold text-[#1F2937] mb-2">
                  Access the Patient Portal
                </h3>
                <p className="text-sm text-[#6B7280] mb-4">
                  View your assessment results, book appointments, or complete
                  questionnaires.
                </p>
                <MedaliaButton
                  label="Open Patient Portal"
                  size="sm"
                  className="w-full sm:w-auto"
                />
              </div>

              {/* Map placeholder */}
              <div className="mt-6 bg-gradient-to-br from-[#e6ecf4] to-[#dce3ee] rounded-2xl aspect-[4/3] flex items-center justify-center relative overflow-hidden shadow-sm">
                {/* Decorative map-like elements */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-[20%] left-[30%] w-32 h-0.5 bg-[#6B7280] rotate-12" />
                  <div className="absolute top-[40%] left-[20%] w-48 h-0.5 bg-[#6B7280] -rotate-6" />
                  <div className="absolute top-[60%] left-[40%] w-24 h-0.5 bg-[#6B7280] rotate-45" />
                  <div className="absolute top-[30%] right-[25%] w-36 h-0.5 bg-[#6B7280] rotate-[30deg]" />
                  <div className="absolute bottom-[30%] left-[35%] w-40 h-0.5 bg-[#6B7280] -rotate-12" />
                </div>
                {/* Location pin */}
                <div className="text-center relative z-10">
                  <div className="w-12 h-12 rounded-full bg-[#20c858]/20 flex items-center justify-center mx-auto mb-3">
                    <div className="w-8 h-8 rounded-full bg-[#20c858]/40 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-[#20c858] shadow-lg shadow-green-500/50" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-[#1F2937]">Lagmula 5, 108 Reykjavik</p>
                  <p className="text-xs text-[#6B7280] mt-1">Lifeline Health Club</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
