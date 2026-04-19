"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface CompanyRow {
  id: string;
  name: string;
  role: "primary" | "co-admin";
  created_at: string;
}

type AuthState = "checking" | "anon" | "dashboard";

export default function BusinessIndexPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthState("anon"); return; }
      const [{ data: primary }, { data: coAdminRows }] = await Promise.all([
        supabase.from("companies").select("id, name, created_at").eq("contact_person_id", user.id),
        supabase.from("company_admins").select("company_id, added_at, companies:company_id(id, name, created_at)").eq("user_id", user.id),
      ]);
      const list: CompanyRow[] = [];
      for (const c of primary || []) list.push({ id: c.id, name: c.name, role: "primary", created_at: c.created_at });
      for (const row of coAdminRows || []) {
        const raw = (row as { companies?: unknown }).companies;
        const c = Array.isArray(raw) ? raw[0] : raw;
        if (c && typeof c === "object" && "id" in c) {
          const company = c as { id: string; name: string; created_at: string };
          if (!list.find((x) => x.id === company.id)) {
            list.push({ id: company.id, name: company.name, role: "co-admin", created_at: company.created_at });
          }
        }
      }
      list.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
      setCompanies(list);
      if (list.length === 1) { router.replace(`/business/${list[0].id}`); return; }
      setAuthState("dashboard");
    })();
  }, [router]);

  if (authState === "checking") {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  if (authState === "dashboard") {
    return <CompanySwitcher companies={companies} />;
  }

  return <PublicBusinessPage />;
}

function CompanySwitcher({ companies }: { companies: CompanyRow[] }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Your companies</h1>
            <p className="text-sm text-gray-600 mt-1">Pick a company to manage, or create a new one.</p>
          </div>
          <Link href="/business/signup" className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-500 hover:opacity-95">+ New company</Link>
        </div>
        {companies.length === 0 ? (
          <section className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <p className="text-gray-600 mb-5">You haven&apos;t set up a company yet.</p>
            <Link href="/business/signup" className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-emerald-500 hover:opacity-95">Create your first company</Link>
          </section>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {companies.map((c) => (
              <Link
                key={c.id}
                href={`/business/${c.id}`}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-transparent hover:border-blue-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold tracking-wider uppercase text-gray-400">
                    {c.role === "primary" ? "Primary admin" : "Co-admin"}
                  </span>
                </div>
                <h3 className="font-semibold text-lg text-gray-900">{c.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Created {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </Link>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function PublicBusinessPage() {
  return (
    <main className="bg-white">
      <Hero />
      <WhyLifeline />
      <HowItWorks />
      <Packages />
      <BangForBuck />
      <InquirySection />
      <FAQ />
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#eff6ff] via-white to-[#ecfdf5]">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] via-[#0D9488] to-[#10B981]" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 sm:pt-28 sm:pb-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-700 mb-5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wide">For companies</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#0F172A] leading-[1.05] tracking-tight">
            Invest in your people.<br />
            <span className="bg-gradient-to-r from-[#3B82F6] to-[#10B981] bg-clip-text text-transparent">Become a health-forward company.</span>
          </h1>
          <p className="text-lg sm:text-xl text-[#475569] mt-6 leading-relaxed max-w-2xl">
            Lifeline combines medical-grade health assessments, on-location measurements, intuitive reports and ongoing coaching — so your team can build real, measurable change with the least amount of effort.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#inquiry"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981] text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:opacity-95"
            >
              Request a proposal
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            <Link
              href="/business/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-[#3B82F6] text-[#3B82F6] bg-white text-sm font-semibold hover:bg-[#3B82F6] hover:text-white transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Contact person sign in
            </Link>
          </div>
          <p className="text-xs text-[#64748B] mt-5">
            Medical doctors in the team · On-location scans · Confidential reporting · GDPR &amp; HIPAA-aligned
          </p>
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function WhyLifeline() {
  const pillars = [
    {
      title: "Medical background",
      desc: "Built by physicians, not marketers. Every report is reviewed by a doctor — your employees get real clinical answers, not generic wellness tips.",
      color: "text-[#3B82F6]",
      bg: "bg-blue-50",
      border: "border-blue-100",
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 512 512" aria-hidden>
          <path d="M447.1 112c-34.2.5-62.3 28.4-63 62.6-.5 24.3 12.5 45.6 32 56.8V344c0 57.3-50.2 104-112 104-60 0-109.2-44.1-111.9-99.2C265 333.8 320 269.2 320 192V36.6c0-11.4-8.1-21.3-19.3-23.5L237.8.5c-13-2.6-25.6 5.8-28.2 18.8L206.4 35c-2.6 13 5.8 25.6 18.8 28.2l30.7 6.1v121.4c0 52.9-42.2 96.7-95.1 97.2-53.4.5-96.9-42.7-96.9-96V69.4l30.7-6.1c13-2.6 21.4-15.2 18.8-28.2l-3.1-15.7C107.7 6.4 95.1-2 82.1.6L19.3 13C8.1 15.3 0 25.1 0 36.6V192c0 77.3 55.1 142 128.1 156.8C130.7 439.2 208.6 512 304 512c97 0 176-75.4 176-168V231.4c19.1-11.1 32-31.7 32-55.4 0-35.7-29.2-64.5-64.9-64zm.9 80c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z" />
        </svg>
      ),
    },
    {
      title: "On-location measurements",
      desc: "Our team comes to you. Body-composition scans happen on-site, so nobody loses half a workday travelling to a clinic.",
      color: "text-[#10B981]",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      title: "Intuitive reports",
      desc: "One page, three numbers that matter, a clear plan. No jargon, no 20-page PDFs that nobody reads.",
      color: "text-[#0D9488]",
      bg: "bg-teal-50",
      border: "border-teal-100",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-8 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v13a2 2 0 002 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13l3-3 3 3 4-4 5 5" />
        </svg>
      ),
    },
    {
      title: "Smooth employee journey",
      desc: "A dedicated onboarding flow, SMS + email reminders, secure patient portal, and an admin dashboard that does the paperwork for you.",
      color: "text-[#8B5CF6]",
      bg: "bg-violet-50",
      border: "border-violet-100",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">The best of all worlds — under one roof</h2>
          <p className="text-base text-[#475569] mt-4 leading-relaxed">
            Most wellness providers do one thing. Lifeline covers the whole chain: medical expertise, on-site measurements, modern reporting, a coaching app, and the admin tooling to run it at scale.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {pillars.map((p) => (
            <div key={p.title} className={`rounded-2xl border ${p.border} ${p.bg} p-5`}>
              <div className={`w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-3 ${p.color}`}>{p.icon}</div>
              <h3 className={`font-semibold ${p.color}`}>{p.title}</h3>
              <p className="text-sm text-[#475569] mt-1.5 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { num: "1", title: "Kick-off call", desc: "We scope the programme with you — headcount, locations, timing, and which packages fit." },
    { num: "2", title: "Roster & onboarding", desc: "Upload your employee list. We send consent-first invitations; signup takes each employee under 2 minutes." },
    { num: "3", title: "On-site measurement day", desc: "Our nurse comes on-site — blood pressure, height, weight, and full body composition per person in about 5 minutes." },
    { num: "4", title: "Blood test", desc: "Employees walk in on a day that works — a Lifeline partner lab in the capital area, or we'll arrange one near your office elsewhere in the country." },
    { num: "5", title: "Report + doctor review", desc: "Each employee gets an intuitive personal report and a 1:1 doctor consultation to agree an action plan." },
    { num: "6", title: "Coaching in the app (optional)", desc: "Daily actions, a health coach, community and events — so change actually sticks, not just the check-up box." },
  ];

  return (
    <section className="py-20 sm:py-24 bg-[#f8fafc]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#10B981] mb-2">How it works</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">From kick-off to action plan in weeks, not quarters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {steps.map((s) => (
            <div key={s.num} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white font-bold flex items-center justify-center mb-3">{s.num}</div>
              <h3 className="font-semibold text-[#0F172A]">{s.title}</h3>
              <p className="text-sm text-[#475569] mt-1.5 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-[#64748B] mt-8 max-w-3xl">
          Outside the capital area? We coordinate with a partner lab near your office — employees never have to drive far for a blood draw.
        </p>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

type Pkg = {
  name: string;
  tag: string;
  desc: string;
  includes: string[];
  footnote?: string;
  accent: string;
  tone: string;
  dot: string;
};

function Packages() {
  const assessments: Pkg[] = [
    {
      name: "Foundational Health",
      tag: "Start here",
      desc: "The full programme — the fastest way to give every employee a clear, medical-grade picture of their health.",
      includes: [
        "On-site measurements (5 min) — blood pressure, body composition",
        "Targeted blood panel",
        "Full health questionnaire",
        "Doctor-reviewed personal report",
        "1:1 doctor consultation + action plan",
      ],
      footnote: "Doctor consultation in person or as a secure video meeting.",
      accent: "from-[#3B82F6] to-[#10B981]",
      tone: "border-blue-100 bg-blue-50/40",
      dot: "text-[#3B82F6]",
    },
    {
      name: "Check-in",
      tag: "Follow-up",
      desc: "3–12 months after the foundational assessment — track what changed, adjust the plan, celebrate progress.",
      includes: [
        "On-site measurements — blood pressure, body composition",
        "Progress report vs baseline",
        "Updated health score",
        "Brief doctor review",
        "Refreshed action plan",
      ],
      footnote: "Doctor review in person or as a secure video meeting.",
      accent: "from-[#10B981] to-[#14B8A6]",
      tone: "border-emerald-100 bg-emerald-50/40",
      dot: "text-[#10B981]",
    },
    {
      name: "Self Check-in",
      tag: "Free",
      desc: "A self-guided check-in to track your own progress through the year and get updated insight — no site visit, no Lifeline team involvement unless something is flagged.",
      includes: [
        "Online health questionnaire — rerun any time",
        "Self-reported metrics you control",
        "Updated personal health score",
        "Instant, private insight into your trends",
        "If something is flagged, Lifeline reaches out",
      ],
      accent: "from-[#8B5CF6] to-[#0EA5E9]",
      tone: "border-violet-100 bg-violet-50/40",
      dot: "text-[#8B5CF6]",
    },
  ];

  return (
    <section className="py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#10B981] mb-2">Assessment packages</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">Three packages. Mix and match for your team.</h2>
          <p className="text-base text-[#475569] mt-4 leading-relaxed">
            Every Lifeline programme is priced per employee, and only for what you actually use. Most companies start with a Foundational Health round for everyone, then run Check-ins every 6–12 months.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {assessments.map((a) => (
            <div key={a.name} className={`relative overflow-hidden rounded-2xl border ${a.tone} bg-white shadow-sm`}>
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${a.accent}`} />
              <div className="p-6">
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 mb-3">{a.tag}</div>
                <h3 className="text-xl font-bold text-[#0F172A]">{a.name}</h3>
                <p className="text-sm text-[#475569] mt-2 leading-relaxed">{a.desc}</p>
                <ul className="mt-5 space-y-2">
                  {a.includes.map((x) => (
                    <li key={x} className="flex items-start gap-2 text-sm text-[#334155]">
                      <svg className={`w-4 h-4 mt-0.5 shrink-0 ${a.dot}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {x}
                    </li>
                  ))}
                </ul>
                {a.footnote && (
                  <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-[11px] font-medium text-[#475569]">
                    <svg className={`w-3.5 h-3.5 ${a.dot}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {a.footnote}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Coaching as a company perk */}
        <div className="mt-8 relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-[#f5f9ff] via-white to-[#ecfdf5] shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] via-[#0D9488] via-[#8B5CF6] to-[#06B6D4]" />
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#3B82F6] mb-1">Coaching app — add-on</div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#0F172A]">Turn insight into action every day</h3>
                <p className="text-sm text-[#475569] mt-2 leading-relaxed max-w-3xl">
                  Offer the Lifeline app as a company perk. Daily actions built on each employee&apos;s report, a real health coach, community and events, education, and advanced macro tracking — across sleep, exercise, nutrition and mental wellbeing. Companies can cover a specific tier, or let employees upgrade on their own.
                </p>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Free", sub: "community + education" },
                    { label: "Self-maintained", sub: "full app tools" },
                    { label: "Full Access", sub: "personal coach" },
                    { label: "Volume rates", sub: "for 10+ seats" },
                  ].map((row) => (
                    <div key={row.label} className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm">
                      <div className="font-semibold text-[#0F172A]">{row.label}</div>
                      <div className="text-xs text-[#64748B]">{row.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-[#64748B] mt-6 max-w-3xl">
          Final pricing depends on headcount, location, and package mix. <a href="#inquiry" className="font-semibold text-[#10B981] hover:underline">Request a proposal</a> and we&apos;ll come back within 2 working days.
        </p>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function BangForBuck() {
  return (
    <section className="py-20 sm:py-24 bg-[#0F172A] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wide">The Lifeline approach</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight">Most bang for buck — because everything we measure is built to drive change.</h2>
          <p className="text-white/75 mt-5 leading-relaxed">
            Lifeline is clinically focused on what actually moves with lifestyle: targeted blood markers, body-composition trends, and wellbeing self-report. Every number on the report has a purpose — and every purpose maps to a concrete action. So your team pays for insight that turns into real change, not data that sits in a drawer.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Doctor led",
              body: "Every programme is built and reviewed by physicians — not a wellness vendor. Clinical judgement, not box-ticking.",
              icon: (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 512 512" aria-hidden>
                  <path d="M447.1 112c-34.2.5-62.3 28.4-63 62.6-.5 24.3 12.5 45.6 32 56.8V344c0 57.3-50.2 104-112 104-60 0-109.2-44.1-111.9-99.2C265 333.8 320 269.2 320 192V36.6c0-11.4-8.1-21.3-19.3-23.5L237.8.5c-13-2.6-25.6 5.8-28.2 18.8L206.4 35c-2.6 13 5.8 25.6 18.8 28.2l30.7 6.1v121.4c0 52.9-42.2 96.7-95.1 97.2-53.4.5-96.9-42.7-96.9-96V69.4l30.7-6.1c13-2.6 21.4-15.2 18.8-28.2l-3.1-15.7C107.7 6.4 95.1-2 82.1.6L19.3 13C8.1 15.3 0 25.1 0 36.6V192c0 77.3 55.1 142 128.1 156.8C130.7 439.2 208.6 512 304 512c97 0 176-75.4 176-168V231.4c19.1-11.1 32-31.7 32-55.4 0-35.7-29.2-64.5-64.9-64zm.9 80c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z" />
                </svg>
              ),
            },
            {
              title: "Only what you need",
              body: "Targeted markers and measurements that actually respond to lifestyle. No pricey vanity tests that don't change the plan.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ),
            },
            {
              title: "Then take action",
              body: "Every report comes with a clear, doable plan — and the Lifeline app turns that plan into daily habits that compound.",
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ),
            },
          ].map((s) => (
            <div key={s.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white flex items-center justify-center mb-3">
                {s.icon}
              </div>
              <div className="text-lg font-semibold">{s.title}</div>
              <div className="text-sm text-white/75 mt-1 leading-relaxed">{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function InquirySection() {
  return (
    <section id="inquiry" className="py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-700 mb-4">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wide">Next steps</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">Ready to invest in your team?</h2>
            <p className="text-base text-[#475569] mt-4 leading-relaxed">
              Tell us a little about your company and what you&apos;re interested in. A Lifeline team member will reach out within 2 working days with a tailored proposal — including logistics for your location and headcount.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-[#334155]">
              {[
                "Completely free, zero commitment",
                "We come back with a clear proposal",
                "No bulk-package upsell — only what fits your team",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {x}
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-xl border border-gray-100 bg-[#f8fafc] p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-1">Prefer to talk?</div>
              <a href="mailto:contact@lifelinehealth.is" className="text-sm font-semibold text-[#0F172A] hover:text-[#10B981]">contact@lifelinehealth.is</a>
            </div>
          </div>
          <div className="lg:col-span-3">
            <InquiryForm />
          </div>
        </div>
      </div>
    </section>
  );
}

function InquiryForm() {
  const [companyName, setCompanyName] = useState("");
  const [kennitala, setKennitala] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [location, setLocation] = useState("");
  const [interest, setInterest] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const toggleInterest = (k: string) =>
    setInterest((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/business/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          kennitala,
          contact_name: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          employee_count: employeeCount ? Number(employeeCount) : null,
          location,
          interest: Array.from(interest),
          message,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || "Could not submit. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setError("Could not submit. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-white p-8 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#10B981] to-[#3B82F6]" />
        <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mb-4">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-[#0F172A]">Thanks — we&apos;ve got it.</h3>
        <p className="text-sm text-[#475569] mt-2 leading-relaxed">
          A Lifeline team member will reach out within 2 working days at <span className="font-semibold text-[#0F172A]">{contactEmail}</span>. Watch your inbox — and check spam just in case.
        </p>
      </div>
    );
  }

  const interests = [
    { key: "foundational", label: "Foundational Health" },
    { key: "checkin", label: "Check-in" },
    { key: "self-checkin", label: "Self Check-in" },
    { key: "coaching", label: "Coaching app" },
    { key: "other", label: "Not sure yet" },
  ];

  return (
    <form onSubmit={submit} className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm space-y-5">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] to-[#10B981]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block sm:col-span-2">
          <span className="block text-sm font-medium text-gray-700 mb-1">Company name <span className="text-red-500">*</span></span>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
            placeholder="Your company"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Kennitala (optional)</span>
          <input
            type="text"
            value={kennitala}
            onChange={(e) => setKennitala(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
            placeholder="6 digits-4 digits"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Approx. employees</span>
          <input
            type="number"
            min={1}
            value={employeeCount}
            onChange={(e) => setEmployeeCount(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
            placeholder="e.g. 45"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Your name <span className="text-red-500">*</span></span>
          <input
            type="text"
            required
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Work email <span className="text-red-500">*</span></span>
          <input
            type="email"
            required
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
            placeholder="you@company.is"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</span>
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Location (office / city)</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
            placeholder="e.g. Reykjavík"
          />
        </label>
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">What are you interested in?</span>
        <div className="flex flex-wrap gap-2">
          {interests.map((i) => {
            const selected = interest.has(i.key);
            return (
              <button
                key={i.key}
                type="button"
                onClick={() => toggleInterest(i.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600 hover:border-blue-300"}`}
              >
                {i.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-gray-700 mb-1">Anything we should know? (optional)</span>
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
          placeholder="Timing, priorities, questions — anything helpful for the proposal."
        />
      </label>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981] text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:opacity-95 disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Send inquiry"}
        {status !== "submitting" && (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>
      <p className="text-xs text-[#64748B] text-center">
        By submitting you agree to be contacted by Lifeline Health about your inquiry. We never share your details with third parties.
      </p>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

function FAQ() {
  const items = [
    { q: "How quickly can you start?", a: "Most companies go from kick-off call to on-site measurement day in 3–6 weeks. Smaller teams can move even faster." },
    { q: "What happens if we have employees outside Reykjavík?", a: "We coordinate with a partner lab near their office — employees never drive far for a blood draw. The measurement day and doctor consultations can be fully remote when needed." },
    { q: "What sees the company, and what stays with the employee?", a: "All clinical data stays in each employee's personal patient portal. The company only sees anonymised group metrics — participation, programme progress, wellbeing averages. We mask any metric where fewer than 5 employees responded, so nobody can be re-identified." },
    { q: "Is the coaching app mandatory?", a: "No. The assessment is the foundation. Coaching is optional — the company can cover it for everyone, cover it for specific groups, or leave it as a personal choice." },
    { q: "How is billing handled?", a: "One consolidated PayDay invoice per round, delivered electronically to your company kennitala. You pay per completed assessment — no-shows don't count." },
  ];

  return (
    <section className="py-20 sm:py-24 bg-[#f8fafc]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#10B981] mb-2">Questions</div>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">What companies usually ask</h2>
        <div className="mt-8 space-y-3">
          {items.map((x) => (
            <details key={x.q} className="group bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-sm">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-semibold text-[#0F172A]">{x.q}</span>
                <svg className="w-5 h-5 text-[#64748B] group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="text-sm text-[#475569] mt-3 leading-relaxed">{x.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
