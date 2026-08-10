"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import DeviceMockup from "../components/DeviceMockup";
import WaveSeparator from "../components/WaveSeparator";
import { SAMEIND_STATIONS, fullAddress } from "@/lib/sameind-locations";
import { resolveContent, resolveSections, resolveHiddenSections } from "@/lib/site-content/registry";
import { parseListField } from "@/lib/site-content/home";
import { layoutBands } from "@/lib/site-content/layout";
import type { Locale, LocaleContent, SiteContentBlob } from "@/lib/site-content/types";

export interface AssessmentViewProps {
  c?: LocaleContent;
  order?: string[];
  hidden?: string[];
  locale?: Locale;
  /** Published blob loaded on the server (SSR), so no flash of defaults. */
  initialBlob?: SiteContentBlob | null;
}

// Emerald ==word== highlight for heading fields.
function Highlight({ text }: { text: string }) {
  const parts = text.split(/(==[^=]+==)/g);
  return <>{parts.map((p, i) => (p.startsWith("==") && p.endsWith("==") ? <span key={i} className="text-[#10B981]">{p.slice(2, -2)}</span> : <Fragment key={i}>{p}</Fragment>))}</>;
}

// Render text, linking any occurrence of "Medalia" to the patient portal.
function MedaliaText({ text }: { text: string }) {
  const parts = text.split(/(Medalia)/g);
  return (
    <>
      {parts.map((p, i) =>
        p === "Medalia" ? (
          <a key={i} href="https://medalia.is" target="_blank" rel="noopener noreferrer" className="text-[#10B981] hover:underline font-medium">Medalia</a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

const packageColors = [
  { accent: "border-t-4 border-t-[#10B981]", iconBg: "bg-green-50 border border-green-100", iconText: "text-[#10B981]" },
  { accent: "border-t-4 border-t-[#3B82F6]", iconBg: "bg-blue-50 border border-blue-100", iconText: "text-[#3B82F6]" },
  { accent: "border-t-4 border-t-[#8B5CF6]", iconBg: "bg-purple-50 border border-purple-100", iconText: "text-[#8B5CF6]" },
];
const packageIcons = [
  <svg key="0" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 011.65 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 3.98 8.25 4.555 8.25 5.438v15.312c0 .966.784 1.75 1.75 1.75h8c.966 0 1.75-.784 1.75-1.75V5.438c0-.883-.845-1.458-1.476-1.522a44.5 44.5 0 00-1.124-.08" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11h4M12 15h4M12 19h4M8.5 11h.01M8.5 15h.01M8.5 19h.01" /></svg>,
  <svg key="1" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  <svg key="2" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>,
];

const stepColors = [
  { bg: "bg-blue-50", border: "border-blue-100", text: "text-[#3B82F6]", badge: "bg-[#3B82F6]" },
  { bg: "bg-green-50", border: "border-green-100", text: "text-[#10B981]", badge: "bg-[#10B981]" },
  { bg: "bg-purple-50", border: "border-purple-100", text: "text-[#8B5CF6]", badge: "bg-[#8B5CF6]" },
  { bg: "bg-amber-50", border: "border-amber-100", text: "text-[#F59E0B]", badge: "bg-[#F59E0B]" },
  { bg: "bg-cyan-50", border: "border-cyan-100", text: "text-[#06B6D4]", badge: "bg-[#06B6D4]" },
];
const stepIcons = [
  <svg key="0" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  <svg key="1" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
  <svg key="2" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M5 14.5l-1.43 1.43a2.25 2.25 0 00-.659 1.591v2.228c0 1.243 1.007 2.25 2.25 2.25h13.676a2.25 2.25 0 002.25-2.25v-2.228c0-.597-.237-1.17-.659-1.591L19 14.5" /></svg>,
  <svg key="3" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
  <svg key="4" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>,
];

const CheckList = ({ items }: { items: string[] }) => (
  <ul className="space-y-3 mb-6">
    {items.map((item) => (
      <li key={item} className="flex items-center gap-3 text-sm text-[#6B7280]">
        <svg className="w-5 h-5 text-[#10B981] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        {item}
      </li>
    ))}
  </ul>
);

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-gray-50/50 transition-colors duration-200">
        <span className="font-medium text-[#1F2937] pr-4">{q}</span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${open ? "bg-[#10B981] text-white rotate-180" : "bg-[#e6ecf4] text-[#6B7280]"}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>
      {open && <div className="px-6 pb-5 accordion-content"><p className="text-sm text-[#6B7280] leading-relaxed">{a}</p></div>}
    </div>
  );
}

function renderBand(id: string, c: LocaleContent, bg: string): ReactNode {
  switch (id) {
    case "process":
      return (
        <section className="py-24 sm:py-28" style={{ backgroundColor: bg }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">{c.process_title}</h2>
              <p className="mt-4 text-lg text-[#6B7280]">{c.process_subtitle}</p>
            </div>
            <div className="max-w-3xl mx-auto space-y-6">
              {[1, 2, 3, 4, 5].map((n, i) => (
                <div key={n} className="bg-[#e6ecf4] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-start gap-6">
                    <div className="relative flex-shrink-0">
                      <div className={`w-24 h-24 rounded-3xl ${stepColors[i].bg} border ${stepColors[i].border} ${stepColors[i].text} flex items-center justify-center`}>{stepIcons[i]}</div>
                      <div className={`absolute -top-2 -right-2 w-8 h-8 ${stepColors[i].badge} rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg`}>{n}</div>
                    </div>
                    <div className="flex-1 pt-2">
                      <h3 className="font-semibold text-[#1F2937] text-lg mb-2">{c[`s${n}_title`]}</h3>
                      <p className="text-sm text-[#6B7280] leading-relaxed">{c[`s${n}_desc`]}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case "results": {
      const bullets = parseListField(c.results_bullets).map((r) => r[0]);
      return (
        <>
          <section className="hidden lg:block py-24 sm:py-28" style={{ backgroundColor: bg }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 gap-16 items-center">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937] mb-6"><Highlight text={c.results_title} /></h2>
                  <p className="text-lg text-[#6B7280] mb-6 leading-relaxed">{c.results_body}</p>
                  <CheckList items={bullets} />
                  <div className="flex items-start gap-3 bg-[#ecf0f3] rounded-xl p-4">
                    <svg className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                    <p className="text-xs text-[#6B7280] leading-relaxed"><MedaliaText text={c.results_note} /></p>
                  </div>
                </div>
                <div className="flex justify-center"><DeviceMockup device={c.results_device} screenshot={c.results_screenshot || "/app-screenshot-health-static.png"} alt="Your health results in the app" phoneHeight="70vh" /></div>
              </div>
            </div>
          </section>
          <section className="lg:hidden py-24 sm:py-28" style={{ backgroundColor: bg }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <h2 className="text-3xl font-bold text-[#1F2937] mb-6"><Highlight text={c.results_title} /></h2>
              <p className="text-lg text-[#6B7280] mb-6 leading-relaxed">{c.results_body}</p>
              <CheckList items={bullets} />
            </div>
          </section>
          <div className="lg:hidden pb-16" style={{ backgroundColor: bg }}>
            <div className="max-w-md mx-auto px-4"><DeviceMockup device={c.results_device} screenshot={c.results_screenshot || "/app-screenshot-health-static.png"} alt="Your health results in the app" phoneHeight="62vh" /></div>
          </div>
        </>
      );
    }

    case "track": {
      const bullets = parseListField(c.track_bullets).map((r) => r[0]);
      return (
        <>
          <section className="hidden lg:block py-24 sm:py-28" style={{ backgroundColor: bg }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 gap-16 items-center">
                <div className="flex justify-center"><DeviceMockup device={c.track_device} screenshot={c.track_screenshot || "/app-screenshot-blood-static.png"} alt="Track measurements and blood tests" phoneHeight="70vh" /></div>
                <div>
                  <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937] mb-6"><Highlight text={c.track_title} /></h2>
                  <p className="text-lg text-[#6B7280] mb-6 leading-relaxed">{c.track_body}</p>
                  <CheckList items={bullets} />
                  <div className="flex items-start gap-3 bg-white/80 rounded-xl p-4">
                    <svg className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                    <p className="text-xs text-[#6B7280] leading-relaxed"><MedaliaText text={c.track_note} /></p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section className="lg:hidden py-24 sm:py-28" style={{ backgroundColor: bg }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <h2 className="text-3xl font-bold text-[#1F2937] mb-6"><Highlight text={c.track_title} /></h2>
              <p className="text-lg text-[#6B7280] mb-6 leading-relaxed">{c.track_body}</p>
              <CheckList items={bullets} />
            </div>
          </section>
          <div className="lg:hidden pb-16" style={{ backgroundColor: bg }}>
            <div className="max-w-md mx-auto px-4"><DeviceMockup device={c.track_device} screenshot={c.track_screenshot || "/app-screenshot-blood-static.png"} alt="Track measurements and blood tests" phoneHeight="62vh" /></div>
          </div>
        </>
      );
    }

    case "packages":
      return (
        <section className="py-24 sm:py-28" style={{ backgroundColor: bg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">{c.packages_title}</h2>
              <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">{c.packages_subtitle}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[1, 2, 3].map((n, i) => {
                const color = packageColors[i];
                const includes = parseListField(c[`pkg${n}_includes`]).map((r) => r[0]);
                return (
                  <div key={n} className={`bg-[#e6ecf4] rounded-2xl p-8 flex flex-col shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-200 ${color.accent}`}>
                    <div className={`w-14 h-14 rounded-xl ${color.iconBg} ${color.iconText} flex items-center justify-center mb-4`}>{packageIcons[i]}</div>
                    <h3 className="text-xl font-semibold text-[#1F2937] mb-1">{c[`pkg${n}_name`]}</h3>
                    <p className="text-sm text-[#6B7280] mb-4">{c[`pkg${n}_desc`]}</p>
                    <div className="mb-6">
                      {n === 3 ? (
                        <span className="text-3xl font-bold text-[#1F2937]">{c.price_free_label}</span>
                      ) : (
                        <span className="text-xl font-bold text-[#1F2937]">{c.price_soon_label}</span>
                      )}
                    </div>
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-[#1F2937] mb-3">{c.packages_includes_label}</h4>
                      <ul className="space-y-2">
                        {includes.map((item) => (
                          <li key={item} className="flex items-start gap-3">
                            <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <span className="text-sm text-[#6B7280]">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-white/60 rounded-xl p-4 mb-6">
                      <p className="text-xs text-[#6B7280]"><span className="font-semibold text-[#1F2937]">{c.packages_ideal_label} </span>{c[`pkg${n}_ideal`]}</p>
                    </div>
                    <div className="mt-auto">
                      <Link href={c.packages_cta_href || "/account/login?mode=signup"} className="inline-flex items-center justify-center w-full px-7 py-3 text-base font-semibold text-white bg-[#10B981] rounded-full hover:bg-[#047857] transition-all duration-200 shadow-lg shadow-green-500/25">{c.packages_cta}</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );

    case "locations": {
      const lifelineStations = parseListField(c.loc_lifeline_stations).map(([name = "", address = "", hours = ""]) => ({ name, address, hours }));
      return (
        <section className="py-24 sm:py-28" style={{ backgroundColor: bg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">{c.locations_title}</h2>
              <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">{c.locations_subtitle}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              <div>
                <h3 className="text-xl font-bold text-[#1F2937] mb-4">{c.loc_lifeline_heading}</h3>
                <p className="text-[#6B7280] mb-4 leading-relaxed">{c.loc_lifeline_desc}</p>
                <div className="space-y-3">
                  {lifelineStations.map((station) => (
                    <div key={station.name} className="bg-[#e6ecf4] rounded-2xl p-5 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
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
                <h3 className="text-xl font-bold text-[#1F2937] mb-4">{c.loc_sameind_heading}</h3>
                <p className="text-[#6B7280] mb-4 leading-relaxed">{c.loc_sameind_desc}</p>
                <div className="space-y-3">
                  {SAMEIND_STATIONS.map((s) => (
                    <div key={s.id} className="bg-[#e6ecf4] rounded-xl p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-all duration-200">
                      <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#1F2937]">{s.name}</div>
                        <div className="text-xs text-[#6B7280]">{fullAddress(s)}</div>
                        <div className="text-xs text-[#6B7280]">{s.hours}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    case "faq":
      return (
        <section className="py-24 sm:py-28" style={{ backgroundColor: bg }}>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">{c.faq_title}</h2>
              <p className="mt-4 text-lg text-[#6B7280]">{c.faq_subtitle}</p>
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const q = c[`q${n}_q`];
                if (!q?.trim()) return null;
                return <FaqItem key={n} q={q} a={c[`q${n}_a`]} />;
              })}
            </div>
          </div>
        </section>
      );

    case "cta":
      return (
        <section className="py-24 sm:py-28 bg-gradient-to-br from-[#1a3a2a] via-[#1F2937] to-[#111827] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(32,200,88,0.15),transparent)]" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">{c.cta_title}</h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">{c.cta_desc}</p>
            <Link href={c.cta_button_href || "/account/login?mode=signup"} className="inline-flex items-center justify-center px-10 py-4 text-base font-semibold text-white bg-[#10B981] rounded-full hover:bg-[#047857] transition-all duration-200 shadow-lg shadow-green-500/25">{c.cta_button}</Link>
          </div>
        </section>
      );

    default:
      return null;
  }
}

const DARK_IDS = new Set(["cta"]);

export default function AssessmentView(props: AssessmentViewProps) {
  const { locale: i18nLocale } = useI18n();
  const controlled = props.c !== undefined;

  const blob = props.initialBlob ?? null;

  const locale: Locale = controlled ? props.locale ?? "is" : i18nLocale;
  const c = useMemo(() => (controlled ? props.c! : resolveContent("assessment", blob, locale)), [controlled, props.c, blob, locale]);
  const order = controlled ? props.order ?? resolveSections("assessment", null) : resolveSections("assessment", blob);
  const hidden = useMemo(() => (controlled ? new Set(props.hidden ?? []) : resolveHiddenSections("assessment", blob)), [controlled, props.hidden, blob]);

  const visible = order.filter((id) => !hidden.has(id));

  return (
    <div>
      {/* Hero (structural, always first) */}
      <section className="bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3] py-24 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1F2937] tracking-tight">{c.hero_title}</h1>
            <p className="mt-6 text-lg text-[#6B7280] max-w-2xl mx-auto leading-relaxed">{c.hero_subtitle}</p>
            <div className="mt-8">
              <Link href={c.hero_cta_href || "/account/login?mode=signup"} className="inline-flex items-center justify-center px-10 py-4 text-base font-semibold text-white bg-[#10B981] rounded-full hover:bg-[#047857] transition-all duration-200 shadow-lg shadow-green-500/25">{c.hero_cta}</Link>
            </div>
          </div>
        </div>
      </section>

      {layoutBands(visible, DARK_IDS).map((b) => (
        <Fragment key={b.id}>
          {b.wave && <WaveSeparator from={b.wave.from} to={b.wave.to} />}
          {renderBand(b.id, c, b.bg)}
        </Fragment>
      ))}
    </div>
  );
}
