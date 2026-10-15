"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "./supabase";

type Locale = "en" | "is";

interface TranslationMap {
  [key: string]: { en: string; is: string };
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
  /**
   * A string with values in it.
   *
   * Word order is not the same in every language — "Access from March" and
   * "Aðgangur frá mars" happen to agree, but plenty do not, and a sentence
   * assembled from fragments in JSX can only ever be in one order. So the
   * whole sentence is one translatable string with {{named}} holes, and the
   * translation decides where the holes go.
   */
  tv: (key: string, fallback: string, vars: Record<string, string | number>) => string;
  loading: boolean;
}

const I18nContext = createContext<I18nContextType>({
  // Icelandic, like DEFAULT_LOCALE below: a component rendered outside the
  // provider should not quietly fall back to English.
  locale: "is",
  setLocale: () => {},
  t: (_key: string, fallback?: string) => fallback || "",
  tv: (_key: string, fallback: string, vars: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(vars[k] ?? "")),
  loading: true,
});

// Default locale used on both server and client during the first render.
// The user's saved preference is applied in a post-mount effect — reading
// localStorage inside the useState initializer caused a server/client
// hydration mismatch (server returned "is", client returned the saved
// value), surfacing as React error #418 on virtually every route.
const DEFAULT_LOCALE: Locale = "is";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [translations, setTranslations] = useState<TranslationMap>({});
  const [loading, setLoading] = useState(true);

  // Apply the saved locale only after first render so SSR and the
  // initial hydration agree on `is`. If the user previously picked
  // `en`, the page paints Icelandic for one frame then swaps — that's
  // acceptable and far better than tearing the whole React tree.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ll-locale");
      if (saved === "en" || saved === "is") {
        setLocaleState(saved as Locale);
        document.documentElement.lang = saved;
      }
    } catch { /* ignore */ }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem("ll-locale", l); } catch {}
    document.documentElement.lang = l;
  }, []);

  /*
   * Load translations from Supabase, in pages.
   *
   * This used to be one unpaginated select, which worked right up until the
   * table passed a thousand rows. PostgREST caps a response at max-rows
   * (1000 by default) and says nothing about it: you get 1000 rows and no
   * error. Every key past the cap then fell through to its inline fallback,
   * so the interface silently reverted to Icelandic for part of itself —
   * and which part depended on whatever order Postgres felt like returning.
   *
   * It is ordered by key so the pages tile without gaps or repeats; an
   * unordered range query can return the same row twice and miss another.
   */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const PAGE = 1000;
        const map: TranslationMap = {};
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from("translations")
            .select("key, en, is_text, approved")
            .order("key", { ascending: true })
            .range(from, from + PAGE - 1);
          if (error || !data) break;
          for (const row of data) {
            const r = row as { key: string; en: string; is_text: string | null; approved: boolean };
            map[r.key] = {
              en: r.en,
              is: r.is_text || r.en,
            };
          }
          if (data.length < PAGE) break;
        }
        if (Object.keys(map).length) setTranslations(map);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const t = useCallback((key: string, fallback?: string) => {
    const entry = translations[key];
    if (!entry) return fallback || key;
    return locale === "is" ? entry.is : entry.en;
  }, [translations, locale]);

  const tv = useCallback(
    (key: string, fallback: string, vars: Record<string, string | number>) =>
      t(key, fallback).replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(vars[k] ?? "")),
    [t]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, tv, loading }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

// Language picker — a segmented pill toggle (IS | EN) with a clear active
// state in the brand emerald. `className` is applied to the wrapper so callers
// can stretch it full-width (mobile) or leave it inline (desktop).
const LOCALE_OPTIONS: { value: Locale; flag: string; label: string }[] = [
  { value: "is", flag: "🇮🇸", label: "IS" },
  { value: "en", flag: "🇬🇧", label: "EN" },
];

export function LanguagePicker({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      role="group"
      aria-label="Language / Tungumál"
      className={`inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50/80 p-0.5 ${className}`}
    >
      {LOCALE_OPTIONS.map((o) => {
        const active = locale === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setLocale(o.value)}
            aria-pressed={active}
            title={o.value === "is" ? "Íslenska" : "English"}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              active
                ? "bg-[#10B981] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <span className="text-sm leading-none">{o.flag}</span>
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
