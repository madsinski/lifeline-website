"use client";

// The promo card at the top of the client dashboard (/account).
//
// Everything it shows — whether it shows at all — comes from the website CMS
// (/admin/website → "Aðgangur (Mínar síður)", see lib/site-content/account.ts).
// It renders nothing until an admin sets "Sýna spjaldið" to Já and publishes,
// so no offer can go stale on a customer's dashboard.

import { useEffect, useState } from "react";
import Link from "next/link";
import qrcode from "qrcode-generator";
import { useI18n } from "@/lib/i18n";
import { resolveContent } from "@/lib/site-content/registry";
import type { SiteContentBlob } from "@/lib/site-content/types";

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

const ARROW = (
  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

export default function AccountPromoCard({ className = "" }: { className?: string }) {
  const { locale } = useI18n();
  const [blob, setBlob] = useState<SiteContentBlob | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    fetch("/api/site-content/account")
      .then((r) => r.json())
      .then((j) => { if (live) setBlob((j?.published as SiteContentBlob) ?? null); })
      .catch(() => { if (live) setBlob(null); });
    return () => { live = false; };
  }, []);

  // Nothing published yet, still loading, or switched off in the CMS.
  if (blob === undefined) return null;
  const c = resolveContent("account", blob, locale === "en" ? "en" : "is");
  if (c.promo_enabled !== "yes") return null;

  const href = c.promo_cta_url?.trim();
  const items = (c.promo_items ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const isExternal = !!href && /^https?:\/\//.test(href);
  const cta = c.promo_cta?.trim();

  return (
    <section className={`relative overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-black/5 ${className}`}>
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#10B981] to-[#0D9488]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_100%_0%,rgba(16,185,129,0.10),transparent)]" />

      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12 lg:p-10">
        <div>
          {(c.promo_badge || c.promo_partner) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {c.promo_badge && (
                <span className="inline-flex items-center rounded-full bg-[#10B981] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                  {c.promo_badge}
                </span>
              )}
              {c.promo_partner && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  {c.promo_partner}
                </span>
              )}
            </div>
          )}

          {c.promo_title && <h2 className="text-2xl font-bold leading-tight text-[#1F2937] sm:text-3xl">{c.promo_title}</h2>}
          {c.promo_desc && <p className="mt-3 max-w-xl text-base leading-relaxed text-[#6B7280]">{c.promo_desc}</p>}

          {items.length > 0 && (
            <ul className="mt-6 space-y-2.5">
              {items.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm leading-relaxed text-[#374151]">{item}</span>
                </li>
              ))}
            </ul>
          )}

          {(cta || c.promo_price) && (
            <div className="mt-7 flex flex-wrap items-center gap-4">
              {cta && href && (isExternal ? (
                <a href={href} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-[#10B981] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-green-500/25 transition-all duration-200 hover:bg-[#047857]">
                  {cta}{ARROW}
                </a>
              ) : (
                <Link href={href}
                  className="inline-flex items-center justify-center rounded-full bg-[#10B981] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-green-500/25 transition-all duration-200 hover:bg-[#047857]">
                  {cta}{ARROW}
                </Link>
              ))}
              {c.promo_price && <span className="text-lg font-bold text-[#1F2937]">{c.promo_price}</span>}
            </div>
          )}
        </div>

        {c.promo_qr !== "no" && href && (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#f0f9f5] p-6 lg:w-56">
            <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
              <QrSvg value={href} className="h-32 w-32 sm:h-36 sm:w-36" />
            </div>
            {c.promo_qr_caption && (
              <div className="flex items-center gap-1.5 text-center text-sm font-semibold text-[#047857]">
                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v16a1 1 0 001 1z" />
                </svg>
                {c.promo_qr_caption}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
