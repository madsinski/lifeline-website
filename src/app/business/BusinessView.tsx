"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import InquiryForm from "./InquiryForm";
import { resolveContent, resolveSections, resolveHiddenSections } from "@/lib/site-content/registry";
import { layoutBands } from "@/lib/site-content/layout";
import { parseListField } from "@/lib/site-content/home";
import WaveSeparator from "../components/WaveSeparator";
import type { Locale, LocaleContent, SiteContentBlob } from "@/lib/site-content/types";

export interface BusinessViewProps {
  signedIn?: boolean;
  c?: LocaleContent;
  order?: string[];
  hidden?: string[];
  locale?: Locale;
  /** Published blob loaded on the server (SSR), so no flash of defaults. */
  initialBlob?: SiteContentBlob | null;
}

// Hero title: \n → line break; ==phrase== → blue→emerald gradient text.
function HeroTitle({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(==[^=]+==)/g).map((p, i) =>
            p.startsWith("==") && p.endsWith("==") ? (
              <span key={i} className="bg-gradient-to-r from-[#3B82F6] to-[#10B981] bg-clip-text text-transparent">{p.slice(2, -2)}</span>
            ) : (
              <Fragment key={i}>{p}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}

function MethodTitle({ text }: { text: string }) {
  return <>{text.split(/(==[^=]+==)/g).map((p, i) => (p.startsWith("==") && p.endsWith("==") ? <span key={i} className="text-[#10B981]">{p.slice(2, -2)}</span> : <Fragment key={i}>{p}</Fragment>))}</>;
}

const medicalIcon = (
  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 512 512" aria-hidden><path d="M447.1 112c-34.2.5-62.3 28.4-63 62.6-.5 24.3 12.5 45.6 32 56.8V344c0 57.3-50.2 104-112 104-60 0-109.2-44.1-111.9-99.2C265 333.8 320 269.2 320 192V36.6c0-11.4-8.1-21.3-19.3-23.5L237.8.5c-13-2.6-25.6 5.8-28.2 18.8L206.4 35c-2.6 13 5.8 25.6 18.8 28.2l30.7 6.1v121.4c0 52.9-42.2 96.7-95.1 97.2-53.4.5-96.9-42.7-96.9-96V69.4l30.7-6.1c13-2.6 21.4-15.2 18.8-28.2l-3.1-15.7C107.7 6.4 95.1-2 82.1.6L19.3 13C8.1 15.3 0 25.1 0 36.6V192c0 77.3 55.1 142 128.1 156.8C130.7 439.2 208.6 512 304 512c97 0 176-75.4 176-168V231.4c19.1-11.1 32-31.7 32-55.4 0-35.7-29.2-64.5-64.9-64zm.9 80c-8.8 0-16-7.2-16-16s7.2-16 16-16 16 7.2 16 16-7.2 16-16 16z" /></svg>
);
const whyStyles = [
  { color: "text-[#3B82F6]", bg: "bg-blue-50", border: "border-blue-100", icon: medicalIcon },
  { color: "text-[#10B981]", bg: "bg-emerald-50", border: "border-emerald-100", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { color: "text-[#0D9488]", bg: "bg-teal-50", border: "border-teal-100", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6m-8 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v13a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13l3-3 3 3 4-4 5 5" /></svg> },
  { color: "text-[#8B5CF6]", bg: "bg-violet-50", border: "border-violet-100", icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
];

const pkgStyles = [
  { accent: "from-[#3B82F6] to-[#10B981]", tone: "border-blue-100 bg-blue-50/40", dot: "text-[#3B82F6]" },
  { accent: "from-[#10B981] to-[#14B8A6]", tone: "border-emerald-100 bg-emerald-50/40", dot: "text-[#10B981]" },
  { accent: "from-[#8B5CF6] to-[#0EA5E9]", tone: "border-violet-100 bg-violet-50/40", dot: "text-[#8B5CF6]" },
];

const bangIcons = [
  medicalIcon,
  <svg key="c" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  <svg key="b" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
];

function renderBand(id: string, c: LocaleContent, bg: string): ReactNode {
  switch (id) {
    case "why":
      return (
        <section className="py-20 sm:py-24" style={{ backgroundColor: bg }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">{c.why_title}</h2>
              <p className="text-base text-[#475569] mt-4 leading-relaxed">{c.why_intro}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n, i) => (
                <div key={n} className={`rounded-2xl border ${whyStyles[i].border} ${whyStyles[i].bg} p-5`}>
                  <div className={`w-12 h-12 rounded-xl bg-white flex items-center justify-center mb-3 ${whyStyles[i].color}`}>{whyStyles[i].icon}</div>
                  <h3 className={`font-semibold ${whyStyles[i].color}`}>{c[`why_p${n}_title`]}</h3>
                  <p className="text-sm text-[#475569] mt-1.5 leading-relaxed">{c[`why_p${n}_desc`]}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case "how":
      return (
        <section className="py-20 sm:py-24" style={{ backgroundColor: bg }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#10B981] mb-2">{c.how_kicker}</div>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">{c.how_title}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white font-bold flex items-center justify-center mb-3">{n}</div>
                  <h3 className="font-semibold text-[#0F172A]">{c[`how_s${n}_title`]}</h3>
                  <p className="text-sm text-[#475569] mt-1.5 leading-relaxed">{c[`how_s${n}_desc`]}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-[#64748B] mt-8 max-w-3xl">{c.how_footnote}</p>
          </div>
        </section>
      );

    case "method":
      return (
        <section className="py-20 sm:py-24" style={{ backgroundColor: bg }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#10B981] mb-2">{c.method_kicker}</div>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight leading-tight"><MethodTitle text={c.method_title} /></h2>
              <p className="text-base text-[#475569] mt-4 leading-relaxed">{c.method_intro}</p>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex gap-5 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white font-bold text-lg flex items-center justify-center">{n}</div>
                  <div>
                    <h3 className="font-semibold text-[#0F172A] text-lg">{c[`method_l${n}_title`]}</h3>
                    <p className="text-sm sm:text-base text-[#475569] mt-1.5 leading-relaxed">{c[`method_l${n}_body`]}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-[#0F172A] text-white p-6 sm:p-8">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300 mb-2">{c.method_bottom_label}</div>
              <p className="text-lg sm:text-xl font-semibold leading-snug">{c.method_bottom_text}</p>
            </div>
          </div>
        </section>
      );

    case "packages": {
      const tiers = parseListField(c.coach_tiers).map(([label = "", sub = ""]) => ({ label, sub }));
      return (
        <section className="py-20 sm:py-24" style={{ backgroundColor: bg }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#10B981] mb-2">{c.packages_kicker}</div>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">{c.packages_title}</h2>
              <p className="text-base text-[#475569] mt-4 leading-relaxed">{c.packages_intro}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((n, i) => {
                const includes = parseListField(c[`pkg${n}_includes`]).map((r) => r[0]);
                const footnote = c[`pkg${n}_footnote`];
                return (
                  <div key={n} className={`relative overflow-hidden rounded-2xl border ${pkgStyles[i].tone} bg-white shadow-sm`}>
                    <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${pkgStyles[i].accent}`} />
                    <div className="p-6">
                      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 mb-3">{c[`pkg${n}_tag`]}</div>
                      <h3 className="text-xl font-bold text-[#0F172A]">{c[`pkg${n}_name`]}</h3>
                      <p className="text-sm text-[#475569] mt-2 leading-relaxed">{c[`pkg${n}_desc`]}</p>
                      <ul className="mt-5 space-y-2">
                        {includes.map((x) => (
                          <li key={x} className="flex items-start gap-2 text-sm text-[#334155]">
                            <svg className={`w-4 h-4 mt-0.5 shrink-0 ${pkgStyles[i].dot}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            {x}
                          </li>
                        ))}
                      </ul>
                      {footnote?.trim() && (
                        <div className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-[11px] font-medium text-[#475569]">
                          <svg className={`w-3.5 h-3.5 ${pkgStyles[i].dot}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {footnote}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Coaching add-on */}
            <div className="mt-8 relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-[#f5f9ff] via-white to-[#ecfdf5] shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] via-[#0D9488] via-[#8B5CF6] to-[#06B6D4]" />
              <div className="p-6 sm:p-8">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-sm">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#3B82F6] mb-1">{c.coach_kicker}</div>
                    <h3 className="text-xl sm:text-2xl font-bold text-[#0F172A]">{c.coach_title}</h3>
                    <p className="text-sm text-[#475569] mt-2 leading-relaxed max-w-3xl">{c.coach_desc}</p>
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {tiers.map((row) => (
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

            <p className="text-sm text-[#64748B] mt-6 max-w-3xl">{c.packages_footnote}</p>
          </div>
        </section>
      );
    }

    case "bang":
      return (
        <section className="relative py-20 sm:py-24 text-white overflow-hidden" style={{ background: "linear-gradient(135deg, #0B3D91 0%, #0E7490 50%, #047857 100%)" }}>
          <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/25 backdrop-blur-sm text-white mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]" />
                <span className="text-xs font-semibold uppercase tracking-wide">{c.bang_kicker}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold leading-tight">{c.bang_title}</h2>
              <p className="text-white/75 mt-5 leading-relaxed">{c.bang_intro}</p>
            </div>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((n, i) => (
                <div key={n} className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm p-5 shadow-lg shadow-blue-900/20">
                  <div className="w-10 h-10 rounded-xl bg-white text-[#0B3D91] flex items-center justify-center mb-3 shadow-sm">{bangIcons[i]}</div>
                  <div className="text-lg font-semibold">{c[`bang_c${n}_title`]}</div>
                  <div className="text-sm text-white/85 mt-1 leading-relaxed">{c[`bang_c${n}_body`]}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case "inquiry": {
      const bullets = parseListField(c.inquiry_bullets).map((r) => r[0]);
      return (
        <section id="inquiry" className="py-20 sm:py-24" style={{ backgroundColor: bg }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
              <div className="lg:col-span-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-700 mb-4">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  <span className="text-xs font-semibold uppercase tracking-wide">{c.inquiry_kicker}</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">{c.inquiry_title}</h2>
                <p className="text-base text-[#475569] mt-4 leading-relaxed">{c.inquiry_intro}</p>
                <ul className="mt-6 space-y-3 text-sm text-[#334155]">
                  {bullets.map((x) => (
                    <li key={x} className="flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 shrink-0 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {x}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 rounded-xl border border-gray-100 bg-[#f8fafc] p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-1">{c.inquiry_talk_label}</div>
                  <a href={`mailto:${c.inquiry_email}`} className="text-sm font-semibold text-[#0F172A] hover:text-[#10B981]">{c.inquiry_email}</a>
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

    case "faq":
      return (
        <section className="py-20 sm:py-24" style={{ backgroundColor: bg }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#10B981] mb-2">{c.faq_kicker}</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">{c.faq_title}</h2>
            <div className="mt-8 space-y-3">
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const q = c[`q${n}_q`];
                if (!q?.trim()) return null;
                return (
                  <details key={n} className="group bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-sm">
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <span className="font-semibold text-[#0F172A]">{q}</span>
                      <svg className="w-5 h-5 text-[#64748B] group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <p className="text-sm text-[#475569] mt-3 leading-relaxed">{c[`q${n}_a`]}</p>
                  </details>
                );
              })}
            </div>
          </div>
        </section>
      );

    default:
      return null;
  }
}

const DARK_IDS = new Set(["bang"]);

export default function BusinessView(props: BusinessViewProps) {
  const { locale: i18nLocale } = useI18n();
  const controlled = props.c !== undefined;
  const signedIn = !!props.signedIn;

  const blob = props.initialBlob ?? null;

  const locale: Locale = controlled ? props.locale ?? "is" : i18nLocale;
  const c = useMemo(() => (controlled ? props.c! : resolveContent("business", blob, locale)), [controlled, props.c, blob, locale]);
  const order = controlled ? props.order ?? resolveSections("business", null) : resolveSections("business", blob);
  const hidden = useMemo(() => (controlled ? new Set(props.hidden ?? []) : resolveHiddenSections("business", blob)), [controlled, props.hidden, blob]);
  const visible = order.filter((id) => !hidden.has(id));

  return (
    <main className="bg-white">
      {/* Hero (structural, always first) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#eff6ff] via-white to-[#ecfdf5]">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] via-[#0D9488] to-[#10B981]" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 sm:pt-28 sm:pb-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-700 mb-5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              <span className="text-xs font-semibold uppercase tracking-wide">{c.hero_badge}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#0F172A] leading-[1.05] tracking-tight"><HeroTitle text={c.hero_title} /></h1>
            <p className="text-lg sm:text-xl text-[#475569] mt-6 leading-relaxed max-w-2xl">{c.hero_subtitle}</p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#0F766E] bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {c.hero_note}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={c.hero_cta1_href || "#inquiry"} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981] text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:opacity-95">
                {c.hero_cta1}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </a>
              {!signedIn && (
                <Link href={c.hero_cta2_href || "/business/signup"} className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-[#10B981] text-[#10B981] bg-white text-sm font-semibold hover:bg-[#10B981] hover:text-white transition-colors shadow-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  {c.hero_cta2}
                </Link>
              )}
              {!signedIn && (
                <Link href={c.hero_login_href || "/business/login"} className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-semibold text-[#3B82F6] hover:text-[#1D4ED8] transition-colors">
                  {c.hero_login}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                </Link>
              )}
            </div>
            {!signedIn && <p className="text-sm text-[#475569] mt-3 max-w-xl leading-relaxed">{c.hero_helper}</p>}
            <p className="text-xs text-[#64748B] mt-5">{c.hero_trust}</p>
          </div>
        </div>
      </section>

      {layoutBands(visible, DARK_IDS).map((b) => (
        <Fragment key={b.id}>
          {b.wave && <WaveSeparator from={b.wave.from} to={b.wave.to} />}
          {renderBand(b.id, c, b.bg)}
        </Fragment>
      ))}
    </main>
  );
}
