"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import DeviceMockup from "./components/DeviceMockup";
import TeamCircles from "./components/TeamCircles";
import WaveSeparator from "./components/WaveSeparator";
import WhatsNew from "./components/WhatsNew";
import { resolveContent, resolveSections, resolveHiddenSections } from "@/lib/site-content/registry";
import { layoutBands } from "@/lib/site-content/layout";
import { parseListField } from "@/lib/site-content/home";
import type { Locale, LocaleContent, SiteContentBlob } from "@/lib/site-content/types";
import type { WhatsNewCard } from "@/lib/whats-new";

// Presentational home page, driven by the CMS content map. Two modes:
//  • Public (no props): fetches the PUBLISHED blob and resolves it in the
//    visitor's i18n locale. An unpublished/empty CMS falls back to the built-in
//    defaults, so the page looks exactly as it did before the CMS existed.
//  • Preview (props supplied): the admin editor renders it with a draft content
//    map, order, hidden set and locale, so edits show live.
export interface HomeViewProps {
  c?: LocaleContent;
  order?: string[];
  hidden?: string[];
  locale?: Locale;
  /** Published blob loaded on the server (SSR), so no flash of defaults. */
  initialBlob?: SiteContentBlob | null;
  /** "What's new" cards, loaded server-side so the carousel doesn't flash. */
  whatsNewCards?: WhatsNewCard[];
}

// Emerald highlight for ==word== spans inside heading fields.
function Highlight({ text }: { text: string }) {
  const parts = text.split(/(==[^=]+==)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("==") && p.endsWith("==") ? (
          <span key={i} className="text-[#10B981]">
            {p.slice(2, -2)}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

const stepStyles = [
  { color: "#3B82F6", icon: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
  ) },
  { color: "#10B981", icon: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
  ) },
  { color: "#8B5CF6", icon: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  ) },
];

const appFeatureStyles = [
  { color: "#3B82F6", icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
  ) },
  { color: "#10B981", icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
  ) },
  { color: "#8B5CF6", icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
  ) },
  { color: "#F59E0B", icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
  ) },
];

const btnPrimary =
  "inline-flex items-center justify-center px-10 py-4 text-base font-semibold text-white bg-[#10B981] rounded-full hover:bg-[#047857] transition-all duration-200 shadow-lg shadow-green-500/25";
const btnSecondary =
  "inline-flex items-center justify-center px-10 py-4 text-base font-semibold border-2 border-[#10B981] text-[#10B981] rounded-full hover:bg-[#10B981] hover:text-white transition-all duration-200";

function AppTextContent({ c }: { c: LocaleContent }) {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.15em] uppercase text-[#10B981] mb-4">{c.app_label}</p>
      <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937] mb-6"><Highlight text={c.app_title} /></h2>
      <p className="text-lg text-[#6B7280] mb-8 leading-relaxed">{c.app_desc}</p>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((n, i) => (
          <div key={n} className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${appFeatureStyles[i].color}15`, color: appFeatureStyles[i].color }}>{appFeatureStyles[i].icon}</div>
            <div>
              <h3 className="text-sm font-semibold text-[#1F2937] mb-0.5">{c[`app_f${n}_title`]}</h3>
              <p className="text-xs text-[#6B7280] leading-relaxed">{c[`app_f${n}_desc`]}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={c.app_cta_app_href || "/coaching#download"} className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white bg-[#10B981] rounded-full hover:bg-[#047857] transition-all duration-200 shadow-lg shadow-green-500/25">{c.app_cta_app}</Link>
        <Link href={c.app_cta_coaching_href || "/coaching"} className="inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold border-2 border-[#10B981] text-[#10B981] rounded-full hover:bg-[#10B981] hover:text-white transition-all duration-200">{c.app_cta_coaching}</Link>
      </div>
    </div>
  );
}

// Each band renderer takes the resolved content and its computed background.
// Audience teaser band (individuals / companies). Kicker + heading (==word==
// highlighted in the accent colour) + body + bullet list + CTA, all driven by
// the `${prefix}_*` content keys.
function Teaser({ c, bg, accent, prefix, href }: { c: LocaleContent; bg: string; accent: string; prefix: string; href: string }) {
  const title = c[`${prefix}_title`] ?? "";
  const bullets = parseListField(c[`${prefix}_bullets`]).map((r) => r[0]);
  return (
    <section className="py-24 sm:py-28" style={{ backgroundColor: bg }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.18em] mb-3" style={{ color: accent }}>{c[`${prefix}_kicker`]}</div>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937] tracking-tight">
          {title.split(/(==[^=]+==)/g).map((p, i) =>
            p.startsWith("==") && p.endsWith("==") ? (
              <span key={i} style={{ color: accent }}>{p.slice(2, -2)}</span>
            ) : (
              <Fragment key={i}>{p}</Fragment>
            ),
          )}
        </h2>
        <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto leading-relaxed">{c[`${prefix}_body`]}</p>
        <ul className="mt-8 grid sm:grid-cols-2 gap-x-6 gap-y-3 max-w-2xl mx-auto text-left">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" stroke={accent} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" /></svg>
              <span className="text-sm text-[#4b5563]">{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <Link href={href} className="inline-flex items-center justify-center px-10 py-4 text-base font-semibold text-white rounded-full transition-all duration-200 shadow-lg" style={{ backgroundColor: accent }}>
            {c[`${prefix}_cta`]}
          </Link>
        </div>
      </div>
    </section>
  );
}

function renderBand(id: string, c: LocaleContent, bg: string, whatsNewCards?: WhatsNewCard[]): ReactNode {
  switch (id) {
    case "whatsnew":
      return (
        <section className="py-16 sm:py-20" style={{ backgroundColor: bg }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <WhatsNew initialCards={whatsNewCards} />
          </div>
        </section>
      );

    case "how":
      return (
        <section className="py-24 sm:py-28" style={{ backgroundColor: bg }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">{c.how_title}</h2>
              <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">{c.how_subtitle}</p>
            </div>
            <div className="space-y-8 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-12 relative">
              <div className="hidden sm:block absolute top-12 left-[30%] w-[12%] h-0.5 bg-gradient-to-r from-[#EA580C]/40 to-[#84CC16]/40" />
              <div className="hidden sm:block absolute top-12 left-[58%] w-[12%] h-0.5 bg-gradient-to-r from-[#84CC16]/40 to-[#767194]/40" />
              {[1, 2, 3].map((n, i) => (
                <div key={n} className="flex flex-col items-center text-center relative">
                  <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-lg" style={{ backgroundColor: `${stepStyles[i].color}10`, border: `2px solid ${stepStyles[i].color}25` }}>
                      <div style={{ color: stepStyles[i].color }}>{stepStyles[i].icon}</div>
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md" style={{ backgroundColor: stepStyles[i].color }}>{n}</div>
                  </div>
                  <h3 className="text-xl font-semibold text-[#1F2937] mb-3">{c[`how_s${n}_title`]}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed max-w-[280px]">{c[`how_s${n}_desc`]}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case "einstaklingar":
      return <Teaser c={c} bg={bg} accent="#10B981" prefix="ind" href={c.ind_cta_href || "/assessment"} />;

    case "fyrirtaeki":
      return <Teaser c={c} bg={bg} accent="#3B82F6" prefix="biz" href={c.biz_cta_href || "/business"} />;

    case "method":
      return (
        <section className="py-24 sm:py-28" style={{ backgroundColor: bg }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-8">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#10B981] mb-3">{c.method_kicker}</div>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937] tracking-tight leading-tight"><Highlight text={c.method_title} /></h2>
              <p className="text-lg text-[#6B7280] mt-4 leading-relaxed">{c.method_intro}</p>
            </div>
            <div className="mb-8 flex flex-wrap gap-2.5">
              {parseListField(c.method_chips).map((row, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/70 px-3.5 py-1.5 text-sm font-medium text-[#065f46]">
                  <svg className="h-4 w-4 flex-shrink-0 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" /></svg>
                  {row[0]}
                </span>
              ))}
            </div>
            <div className="relative">
              <div className="absolute left-[46px] top-8 bottom-14 w-0.5 bg-gradient-to-b from-[#3B82F6] via-[#10B981] to-[#047857] opacity-40" aria-hidden />
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="relative flex gap-5 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-2xl">
                    <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white font-bold text-lg flex items-center justify-center ring-4 ring-white">{n}</div>
                    <div>
                      <h3 className="font-semibold text-[#1F2937] text-lg">{c[`method_l${n}_title`]}</h3>
                      <p className="text-sm sm:text-base text-[#6B7280] mt-1.5 leading-relaxed">{c[`method_l${n}_body`]}</p>
                    </div>
                  </div>
                ))}
                <div className="relative flex gap-5 rounded-2xl bg-[#111827] p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-2xl">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-[#10B981] to-[#047857] text-white flex items-center justify-center ring-4 ring-[#111827]">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300 mb-1">{c.method_bottom_label}</div>
                    <p className="text-base sm:text-lg font-semibold leading-snug text-white">{c.method_bottom_text}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      );

    case "app":
      return (
        <>
          <section className="hidden lg:block py-24 sm:py-28" style={{ backgroundColor: bg }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 gap-16 items-center">
                <div><AppTextContent c={c} /></div>
                <div className="flex justify-center">
                  <DeviceMockup device={c.app_device} screenshot={c.app_screenshot || "/app-screenshot-home-static.png"} alt="Lifeline Health app" phoneHeight="70vh" />
                </div>
              </div>
            </div>
          </section>
          <section className="lg:hidden py-24 sm:py-28" style={{ backgroundColor: bg }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6"><AppTextContent c={c} /></div>
          </section>
          <div className="lg:hidden pb-20" style={{ backgroundColor: bg }}>
            <div className="max-w-md mx-auto px-4">
              <DeviceMockup device={c.app_device} screenshot={c.app_screenshot || "/app-screenshot-home-static.png"} alt="Lifeline Health app" phoneHeight="62vh" />
            </div>
          </div>
        </>
      );

    case "team": {
      const members = parseListField(c.team_list).map(([name = "", role = "", photo = "", flag = ""]) => ({ name, role, photo, flag }));
      return (
        <section className="py-24 sm:py-28" style={{ backgroundColor: bg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#10B981]">{c.team_kicker}</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-[#1F2937]">{c.team_title}</h2>
              <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">{c.team_subtitle}</p>
            </div>
            <TeamCircles members={members} />
          </div>
        </section>
      );
    }

    case "partners": {
      const partners = parseListField(c.partner_list).map(([name = "", role = "", url = "", logo = ""]) => ({ name, role, url, logo }));
      return (
        <section className="py-24 sm:py-28" style={{ backgroundColor: bg }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#1F2937]">{c.partners_title}</h2>
              <p className="mt-4 text-lg text-[#6B7280] max-w-2xl mx-auto">{c.partners_subtitle}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {partners.map((p) => (
                <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-200 text-center group">
                  <div className="w-full h-20 flex items-center justify-center mb-4 px-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.logo} alt={p.name} className="max-h-16 max-w-full object-contain" />
                  </div>
                  <h3 className="font-semibold text-[#1F2937] mb-1 group-hover:text-[#10B981] transition-colors">{p.name}</h3>
                  <p className="text-xs text-[#6B7280] mb-2">{p.role}</p>
                  <p className="text-xs text-[#10B981] font-medium">{p.url.replace("https://", "")}</p>
                </a>
              ))}
            </div>
          </div>
        </section>
      );
    }

    case "cta":
      return (
        <section className="py-24 sm:py-28 bg-gradient-to-br from-[#1a3a2a] via-[#1F2937] to-[#111827] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(32,200,88,0.15),transparent)]" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">{c.cta_title}</h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">{c.cta_desc}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={c.cta_signup_href || "/account/login?mode=signup"} className={btnPrimary}>{c.cta_signup}</Link>
              <Link href={c.cta_app_href || "/coaching#download"} className={btnSecondary}>{c.cta_app}</Link>
            </div>
          </div>
        </section>
      );

    default:
      return null;
  }
}

const DARK_IDS = new Set(["cta"]);

export default function HomeView(props: HomeViewProps) {
  const { locale: i18nLocale } = useI18n();
  const controlled = props.c !== undefined;

  const blob = props.initialBlob ?? null;
  const locale: Locale = controlled ? props.locale ?? "is" : i18nLocale;
  const c = useMemo(
    () => (controlled ? props.c! : resolveContent("home", blob, locale)),
    [controlled, props.c, blob, locale],
  );
  const order = controlled ? props.order ?? resolveSections("home", null) : resolveSections("home", blob);
  const hidden = useMemo(
    () => (controlled ? new Set(props.hidden ?? []) : resolveHiddenSections("home", blob)),
    [controlled, props.hidden, blob],
  );

  const visible = order.filter((id) => !hidden.has(id));

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(32,200,88,0.12),transparent)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 sm:py-36 lg:py-44">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#1F2937] leading-[1.1]"><Highlight text={c.hero_title} /></h1>
            <p className="mt-8 text-lg sm:text-xl text-[#6B7280] max-w-2xl mx-auto leading-relaxed">{c.hero_subtitle}</p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href={c.hero_cta_signup_href || "/account/login?mode=signup"} className={btnPrimary}>{c.hero_cta_signup}</Link>
              <Link href={c.hero_cta_app_href || "/coaching#download"} className={btnSecondary}>{c.hero_cta_app}</Link>
            </div>
          </div>
        </div>
      </section>

      {layoutBands(visible, DARK_IDS).map((b) => (
        <Fragment key={b.id}>
          {b.wave && <WaveSeparator from={b.wave.from} to={b.wave.to} />}
          {renderBand(b.id, c, b.bg, props.whatsNewCards)}
        </Fragment>
      ))}
    </div>
  );
}
