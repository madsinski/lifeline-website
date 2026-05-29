"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

// Pricing is not public yet. The full package + tier breakdown lived
// here previously; it's kept in git history and can be restored when
// pricing is finalised. For now this route renders a coming-soon
// placeholder so existing links / nav don't 404.
export default function PricingComingSoon() {
  const { t } = useI18n();
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-24 bg-white">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0]">
          <svg className="h-8 w-8 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-[#111827] mb-3">
          {t("pricing.soon.title", "Pricing coming soon")}
        </h1>
        <p className="text-[#6B7280] text-sm leading-relaxed mb-8">
          {t(
            "pricing.soon.body",
            "We're finalising our plans. In the meantime, take the free health assessment or get in touch and we'll talk you through the options.",
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/assessment"
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-[#10B981] rounded-full hover:bg-[#047857] transition-colors"
          >
            {t("pricing.soon.cta_assessment", "Take the assessment")}
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-[#1F2937] bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
          >
            {t("pricing.soon.cta_contact", "Contact us")}
          </Link>
        </div>
      </div>
    </main>
  );
}
