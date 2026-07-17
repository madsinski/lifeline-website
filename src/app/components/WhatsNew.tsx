"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import qrcode from "qrcode-generator";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_WHATS_NEW, type Lang, type WhatsNewCard } from "@/lib/whats-new";

// Homepage "What's new" (Nýtt hjá Lifeline) carousel. Cards are managed in the
// admin at /admin/whats-new and read from the public /api/whats-new; the
// built-in defaults render immediately and stand in if the API is unreachable.

/** Inline, dependency-light QR code rendered as a single SVG path. */
function QrSvg({ value, className = "" }: { value: string; className?: string }) {
  const qr = qrcode(0, "M");
  qr.addData(value || " ");
  qr.make();
  const n = qr.getModuleCount();
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
  }
  return (
    <svg viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" aria-hidden className={className}>
      <rect width={n} height={n} fill="#ffffff" />
      <path d={d} fill="#0b1220" />
    </svg>
  );
}

function CardView({ card, lang }: { card: WhatsNewCard; lang: Lang }) {
  const external = /^https?:\/\//.test(card.href);
  const cta = (
    <>
      {card.cta[lang]}
      <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </>
  );
  const ctaClass =
    "inline-flex items-center justify-center rounded-full bg-[#10B981] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-green-500/25 transition-all duration-200 hover:bg-[#047857]";

  return (
    <article className="relative flex h-full snap-start flex-col overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-black/5">
      {/* Emerald accent bar */}
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#10B981] to-[#0D9488]" />
      {/* Soft radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_100%_0%,rgba(16,185,129,0.10),transparent)]" />

      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {card.badge[lang] && (
            <span className="inline-flex items-center rounded-full bg-[#10B981] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
              {card.badge[lang]}
            </span>
          )}
          {card.partner?.[lang] && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {card.partner[lang]}
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold leading-tight text-[#1F2937] sm:text-2xl">{card.title[lang]}</h3>
        <p className="mt-2.5 text-sm leading-relaxed text-[#6B7280]">{card.desc[lang]}</p>

        <ul className="mt-5 space-y-2.5">
          {card.bullets[lang].filter(Boolean).map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm leading-relaxed text-[#374151]">{item}</span>
            </li>
          ))}
        </ul>

        {/* Footer pinned to the bottom so cards align */}
        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <div>
            {card.price?.[lang] && <div className="mb-3 text-base font-bold text-[#1F2937]">{card.price[lang]}</div>}
            {external ? (
              <a href={card.href} target="_blank" rel="noopener noreferrer" className={ctaClass}>
                {cta}
              </a>
            ) : (
              <Link href={card.href} className={ctaClass}>
                {cta}
              </Link>
            )}
          </div>
          {card.qrUrl && (
            <div className="hidden shrink-0 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5 sm:block">
              <QrSvg value={card.qrUrl} className="h-20 w-20" />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function WhatsNew() {
  const { t, locale } = useI18n();
  const lang: Lang = locale === "en" ? "en" : "is";
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  // Start from the built-in cards so the section paints instantly; the API
  // response (admin-managed) replaces them once it lands.
  const [cards, setCards] = useState<WhatsNewCard[]>(DEFAULT_WHATS_NEW.cards.filter((c) => c.enabled));

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/whats-new");
        const j = res.ok ? await res.json() : null;
        if (!cancel && Array.isArray(j?.cards)) setCards(j.cards as WhatsNewCard[]);
      } catch {
        /* keep the defaults */
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Only show the arrows when the strip actually overflows (e.g. on desktop
  // once there are enough cards, or on any narrow viewport).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => setScrollable(el.scrollWidth - el.clientWidth > 8);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [cards]);

  const scrollByCard = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const amount = card ? card.offsetWidth + 20 : el.clientWidth * 0.9;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  if (!cards.length) return null;

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#10B981]">
            {t("home.whatsnew.kicker", "What's new")}
          </div>
          <h2 className="mt-2 text-3xl font-bold text-[#1F2937] sm:text-4xl">
            {t("home.whatsnew.title", "New from Lifeline")}
          </h2>
        </div>
        {/* Manual scroll controls — shown only when the strip overflows; no autoplay */}
        <div className={`shrink-0 gap-2 ${scrollable ? "hidden md:flex" : "hidden"}`}>
          <button
            type="button"
            onClick={() => scrollByCard(-1)}
            aria-label={t("home.whatsnew.prev", "Previous")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-[#1F2937] shadow-sm transition-colors hover:border-[#10B981] hover:text-[#10B981]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollByCard(1)}
            aria-label={t("home.whatsnew.next", "Next")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-[#1F2937] shadow-sm transition-colors hover:border-[#10B981] hover:text-[#10B981]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Lateral scroll strip. Negative margins let cards bleed to the screen
          edge on mobile; the padding keeps the first/last card aligned. */}
      <div
        ref={scroller}
        className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card, i) => (
          <div key={card.key + i} data-card className="w-[86%] shrink-0 sm:w-[400px]">
            <CardView card={card} lang={lang} />
          </div>
        ))}
      </div>
    </div>
  );
}
