"use client";

import Link from "next/link";
import qrcode from "qrcode-generator";
import { useI18n } from "@/lib/i18n";

// Medalia patient portal — where the health check is booked and viewed.
// Same URL drives the CTA link and the QR a phone camera can open directly.
const PORTAL_URL = "https://app.medalia.is/7ca0ca21-8947-46cb-afbd-2e2d15efef6e";

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
    <svg
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      aria-hidden
      className={className}
    >
      <rect width={n} height={n} fill="#ffffff" />
      <path d={d} fill="#0b1220" />
    </svg>
  );
}

const COPY = {
  is: {
    badge: "NÝTT",
    partner: "Í samstarfi við Lyfju",
    title: "Heilsufarsskoðun Lifeline hjá Lyfju",
    desc: "Heildræn kortlagning á heilsu þinni með sérstakri áherslu á svefn, hreyfingu, næringu og andlega líðan.",
    items: [
      "Heildrænn heilsuspurningalisti",
      "Mælingar á mælistöð Lyfju í Smáratorgi — blóðþrýstingur og líkamssamsetning",
      "Efnaskiptatengd blóðprufa hjá Sameind",
      "Ítarleg skýrsla með niðurstöðum úr öllum þáttum",
      "20 mínútna viðtal við lækni og persónuleg aðgerðaáætlun",
    ],
    price: "49.990 kr.",
    cta: "Opna sjúklingagátt",
    qrCaption: "Skannaðu til að opna í símanum",
    qrHint: "Skoðunin lítur best út í símanum þínum.",
  },
  en: {
    badge: "NEW",
    partner: "In partnership with Lyfja",
    title: "Lifeline Health Check at Lyfja",
    desc: "A holistic mapping of your health, with special focus on sleep, exercise, nutrition and mental wellness.",
    items: [
      "Holistic health questionnaire",
      "Measurements at the Lyfja station in Smáratorg — blood pressure and body composition",
      "Metabolic blood panel at Sameind",
      "A detailed report covering every part of the check",
      "20-minute doctor consultation and a personal action plan",
    ],
    price: "49,990 ISK",
    cta: "Open patient portal",
    qrCaption: "Scan to open on your phone",
    qrHint: "The health check looks best on your phone.",
  },
} as const;

export default function HealthCheckTeaser({
  href = PORTAL_URL,
  qrUrl = PORTAL_URL,
  ctaOverride,
  className = "",
}: {
  href?: string;
  qrUrl?: string;
  /** Replace the default "Open patient portal" label (e.g. on the portal itself). */
  ctaOverride?: { is: string; en: string };
  className?: string;
}) {
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "is";
  const c = COPY[lang];
  const ctaLabel = ctaOverride ? ctaOverride[lang] : c.cta;
  const isExternal = /^https?:\/\//.test(href);

  return (
    <section
      className={`relative overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-black/5 ${className}`}
    >
      {/* Emerald gradient accent bar */}
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#10B981] to-[#0D9488]" />
      {/* Soft radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_100%_0%,rgba(16,185,129,0.10),transparent)]" />

      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12 lg:p-10">
        {/* Left: content */}
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#10B981] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
              {c.badge}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {c.partner}
            </span>
          </div>

          <h2 className="text-2xl font-bold leading-tight text-[#1F2937] sm:text-3xl">
            {c.title}
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-[#6B7280]">
            {c.desc}
          </p>

          <ul className="mt-6 space-y-2.5">
            {c.items.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm leading-relaxed text-[#374151]">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            {isExternal ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-[#10B981] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-green-500/25 transition-all duration-200 hover:bg-[#047857]"
              >
                {ctaLabel}
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            ) : (
              <Link
                href={href}
                className="inline-flex items-center justify-center rounded-full bg-[#10B981] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-green-500/25 transition-all duration-200 hover:bg-[#047857]"
              >
                {ctaLabel}
                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            )}
            <span className="text-lg font-bold text-[#1F2937]">{c.price}</span>
          </div>
        </div>

        {/* Right: QR panel */}
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#f0f9f5] p-6 lg:w-56">
          <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <QrSvg value={qrUrl} className="h-32 w-32 sm:h-36 sm:w-36" />
          </div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#047857]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v16a1 1 0 001 1z" />
            </svg>
            {c.qrCaption}
          </div>
          <p className="text-center text-xs leading-relaxed text-[#6B7280]">{c.qrHint}</p>
        </div>
      </div>
    </section>
  );
}
