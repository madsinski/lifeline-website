"use client";

/*
 * First-visit language chooser.
 *
 * Shown only while the visitor has no ll-locale cookie (the layout decides),
 * and never on the app, staff tools or token links (chooserHiddenOn). It is
 * deliberately non-blocking: a bottom sheet on a phone, a small card in the
 * lower left corner on a computer, nothing behind it is dimmed and focus is
 * not taken. The page underneath is fully usable.
 *
 * The heading and buttons are bilingual because we do not yet know which
 * language the reader has. The proxy's Accept-Language guess is the
 * highlighted button; closing the card (✕ or Escape) keeps that guess, so
 * the question is asked once.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { chooserHiddenOn, readLocaleCookie, type Locale } from "@/lib/locale";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "is", label: "Íslenska" },
  { value: "en", label: "English" },
];

export default function LanguageChooser({ guess }: { guess: Locale }) {
  const pathname = usePathname();
  const { setLocale } = useI18n();
  const [open, setOpen] = useState(false);

  /* After hydration, and a beat later, so it does not compete with the
     page's first paint. Skipped if a choice exists after all (a cookie
     written by another tab, or migrated from localStorage). */
  useEffect(() => {
    const t = setTimeout(() => {
      let legacy: string | null = null;
      try { legacy = localStorage.getItem("ll-locale"); } catch { /* private mode */ }
      if (!readLocaleCookie() && legacy !== "is" && legacy !== "en") setOpen(true);
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const choose = (l: Locale) => {
    setOpen(false);
    setLocale(l);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") choose(guess); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // choose is recreated each render; guess and open are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guess]);

  if (!open || chooserHiddenOn(pathname)) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="ll-lang-title"
      className="fixed inset-x-0 bottom-0 z-[60] rounded-t-2xl border-t border-gray-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-80 sm:rounded-2xl sm:border sm:pb-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="ll-lang-title" className="pt-2 text-base font-semibold text-gray-900">
          <span lang="is">Veldu tungumál</span>
          <span aria-hidden className="mx-1.5 text-gray-400">·</span>
          <span lang="en">Choose your language</span>
        </h2>
        <button
          type="button"
          onClick={() => choose(guess)}
          aria-label={guess === "en" ? "Close" : "Loka"}
          className="-mr-1 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map((o) => {
          const suggested = o.value === guess;
          return (
            <button
              key={o.value}
              type="button"
              lang={o.value}
              onClick={() => choose(o.value)}
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${
                suggested
                  ? "bg-[#047857] text-white hover:bg-[#065f46]"
                  : "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
