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
  loading: boolean;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (_key: string, fallback?: string) => fallback || "",
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

  // Load translations from Supabase
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("translations")
          .select("key, en, is_text, approved");
        if (data) {
          const map: TranslationMap = {};
          for (const row of data) {
            const r = row as { key: string; en: string; is_text: string | null; approved: boolean };
            map[r.key] = {
              en: r.en,
              is: r.is_text || r.en,
            };
          }
          setTranslations(map);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const t = useCallback((key: string, fallback?: string) => {
    const entry = translations[key];
    if (!entry) return fallback || key;
    return locale === "is" ? entry.is : entry.en;
  }, [translations, locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, loading }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

// Language picker component
export function LanguagePicker({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <button
      onClick={() => setLocale(locale === "en" ? "is" : "en")}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
        locale === "is"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      } ${className}`}
      title={locale === "en" ? "Switch to Icelandic" : "Switch to English"}
    >
      <span className="text-sm leading-none">{locale === "en" ? "🇬🇧" : "🇮🇸"}</span>
      <span>{locale === "en" ? "EN" : "IS"}</span>
    </button>
  );
}
