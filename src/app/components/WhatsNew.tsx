"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import qrcode from "qrcode-generator";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_WHATS_NEW, VARIANTS, type Lang, type WhatsNewCard } from "@/lib/whats-new";

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

export function CardView({ card, lang }: { card: WhatsNewCard; lang: Lang }) {
  const v = VARIANTS[card.variant] ?? VARIANTS.emerald;
  const external = /^https?:\/\//.test(card.href);
  const cta = (
    <>
      {card.cta[lang]}
      <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </>
  );
  const ctaClass = `inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 ${v.cta}`;

  return (
    <article className={`relative flex h-full snap-start flex-col overflow-hidden rounded-3xl ${v.card}`}>
      {v.accentBar && <div className={`absolute inset-x-0 top-0 h-1.5 ${v.accentBar}`} />}
      {v.glow && <div className={`pointer-events-none absolute inset-0 ${v.glow}`} />}

      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {card.badge[lang] && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm ${v.badge}`}>
              {card.badge[lang]}
            </span>
          )}
          {card.partner?.[lang] && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${v.partner}`}>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {card.partner[lang]}
            </span>
          )}
        </div>

        <h3 className={`text-xl font-bold leading-tight sm:text-2xl ${v.title}`}>{card.title[lang]}</h3>
        <p className={`mt-2.5 text-sm leading-relaxed ${v.desc}`}>{card.desc[lang]}</p>

        <ul className="mt-5 space-y-2.5">
          {card.bullets[lang].filter(Boolean).map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <svg className={`mt-0.5 h-5 w-5 flex-shrink-0 ${v.bulletIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`text-sm leading-relaxed ${v.bulletText}`}>{item}</span>
            </li>
          ))}
        </ul>

        {/* Footer pinned to the bottom so cards align */}
        <div className="mt-auto pt-6">
          {card.emailCapture ? (
            <EmailCapture card={card} lang={lang} ctaClass={ctaClass} />
          ) : (
            <div className="flex items-end justify-between gap-4">
              <div>
                {card.price?.[lang] && <div className={`mb-3 text-base font-bold ${v.price}`}>{card.price[lang]}</div>}
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
                <div className={`hidden shrink-0 rounded-xl p-2 shadow-sm sm:block ${v.qrWrap}`}>
                  <QrSvg value={card.qrUrl} className="h-20 w-20" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/** Inline email signup used by cards with `emailCapture` (e.g. app early access).
 *  Posts to /api/subscribe tagged by card key so signups show in /admin/email-list. */
function EmailCapture({ card, lang, ctaClass }: { card: WhatsNewCard; lang: Lang; ctaClass: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const doneMsg = lang === "en" ? "Thanks! We'll email you when early access opens." : "Takk! Við sendum þér boð um leið og snemma aðgangur opnast.";
  const placeholder = lang === "en" ? "Your email" : "Netfangið þitt";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: `whatsnew-${card.key}` }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
        {doneMsg}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
      />
      <button type="submit" disabled={state === "loading"} className={`shrink-0 ${ctaClass} disabled:opacity-60`}>
        {state === "loading" ? "…" : card.cta[lang]}
      </button>
      {state === "error" && (
        <span className="self-center text-xs text-red-500">{lang === "en" ? "Try again" : "Reyndu aftur"}</span>
      )}
    </form>
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
