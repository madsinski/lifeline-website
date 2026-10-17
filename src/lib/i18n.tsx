"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "./supabase";
import { icelandicOnly, isLocale, readLocaleCookie, writeLocaleCookie, type Locale } from "./locale";

interface TranslationMap {
  [key: string]: { en: string; is: string };
}

interface SetLocaleOptions {
  /** Also store it on the signed-in account (default true). */
  saveToAccount?: boolean;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale, opts?: SetLocaleOptions) => void;
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
  // Icelandic: a component rendered outside the provider should not quietly
  // fall back to English.
  locale: "is",
  setLocale: () => {},
  t: (_key: string, fallback?: string) => fallback || "",
  tv: (_key: string, fallback: string, vars: Record<string, string | number>) =>
    fallback.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(vars[k] ?? "")),
  loading: true,
});

/*
 * The language comes from the server.
 *
 * The root layout reads the ll-locale cookie (src/lib/i18n-server.ts),
 * renders <html lang> with it and passes the language plus that language's
 * translations in here, so server and client agree on the first render. The
 * old localStorage read in a post-mount effect painted Icelandic for a frame
 * and then swapped; reading it any earlier tore hydration (React #418).
 *
 * Changing language writes the cookie and asks the server for the page again
 * (router.refresh), which brings the other language's strings. Until they
 * arrive the inline fallbacks show.
 *
 * /app is Icelandic-only for now, whatever the cookie says.
 */
export function I18nProvider({ children, initialLocale = "is", initialTranslations, chosen = true }: {
  children: ReactNode;
  initialLocale?: Locale;
  /** That language's strings, { key: text }, fetched on the server. */
  initialTranslations?: Record<string, string>;
  /** False when the visitor has not picked a language yet (no cookie). */
  chosen?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [picked, setPicked] = useState<Locale>(initialLocale);
  /* A new server render (after router.refresh, or a cookie copied from the
     account on login) brings a new initialLocale: follow it. Adjusted during
     render, the documented way to reset state from a prop. */
  const [seenInitial, setSeenInitial] = useState<Locale>(initialLocale);
  if (seenInitial !== initialLocale) {
    setSeenInitial(initialLocale);
    setPicked(initialLocale);
  }
  const locale: Locale = icelandicOnly(pathname) ? "is" : picked;

  /* Fallback only: when the server could not load translations, fetch both
     languages in the browser as before. */
  const serverHasMap = !!initialTranslations && Object.keys(initialTranslations).length > 0;
  const [clientMap, setClientMap] = useState<TranslationMap | null>(null);
  const [loading, setLoading] = useState(!serverHasMap);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  /* Visitors from before the cookie existed have their choice in
     localStorage: move it into the cookie once, and render in it. */
  useEffect(() => {
    if (chosen || readLocaleCookie()) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem("ll-locale"); } catch { /* private mode */ }
    if (!isLocale(saved)) return;
    writeLocaleCookie(saved);
    if (saved !== initialLocale) router.refresh();
  }, [chosen, initialLocale, router]);

  const setLocale = useCallback((l: Locale, opts?: SetLocaleOptions) => {
    setPicked(l);
    writeLocaleCookie(l);
    try { localStorage.setItem("ll-locale", l); } catch { /* private mode */ }
    document.documentElement.lang = l;
    router.refresh();
    if (opts?.saveToAccount !== false) {
      void supabase.auth.getSession().then(({ data }) => {
        const u = data.session?.user;
        if (u && u.user_metadata?.locale !== l) {
          void supabase.auth.updateUser({ data: { locale: l } }).catch(() => null);
        }
      }).catch(() => null);
    }
  }, [router]);

  /*
   * Load translations from Supabase, in pages — only when the server did not.
   *
   * PostgREST caps a response at max-rows (1000 by default) and says nothing
   * about it, so this is ordered by key and paged; an unordered range query
   * can return the same row twice and miss another.
   */
  useEffect(() => {
    if (serverHasMap) return;
    let alive = true;
    (async () => {
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
            map[r.key] = { en: r.en, is: r.is_text || r.en };
          }
          if (data.length < PAGE) break;
        }
        if (alive && Object.keys(map).length) setClientMap(map);
      } catch { /* inline fallbacks stay */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [serverHasMap]);

  const t = useCallback((key: string, fallback?: string) => {
    if (serverHasMap && initialTranslations && locale === initialLocale) {
      return initialTranslations[key] ?? (fallback || key);
    }
    const entry = clientMap?.[key];
    if (entry) return locale === "is" ? entry.is : entry.en;
    return fallback || key;
  }, [serverHasMap, locale, initialLocale, initialTranslations, clientMap]);

  const tv = useCallback(
    (key: string, fallback: string, vars: Record<string, string | number>) =>
      t(key, fallback).replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(vars[k] ?? "")),
    [t]);

  const value = useMemo(() => ({ locale, setLocale, t, tv, loading }), [locale, setLocale, t, tv, loading]);

  return (
    <I18nContext.Provider value={value}>
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
const LOCALE_OPTIONS: { value: Locale; label: string; name: string }[] = [
  { value: "is", label: "IS", name: "Íslenska" },
  { value: "en", label: "EN", name: "English" },
];

export function LanguagePicker({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      role="group"
      aria-label="Tungumál / Language"
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
            aria-label={o.name}
            title={o.name}
            lang={o.value}
            className={`inline-flex min-h-9 flex-1 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              active
                ? "bg-[#047857] text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
