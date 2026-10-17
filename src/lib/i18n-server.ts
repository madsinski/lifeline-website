// Server-only half of i18n: which language this request renders in, and the
// translations for it, so the first paint is already in the right language
// (no Icelandic frame before an English visitor's strings arrive, and no
// client round trip to Supabase for 1200+ rows on every page load).
//
// The language is the visitor's own choice, stored in the `ll-locale` cookie
// by the LanguageChooser / LanguagePicker. Without a cookie the page renders
// in Icelandic (the site's main language) and the proxy's Accept-Language
// guess (x-ll-locale-guess) only decides which button the chooser highlights.
//
// Import only from Server Components (it pulls in the service-role client).

import { cookies, headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/locale";

export interface RequestLocale {
  /** The language to render. */
  locale: Locale;
  /** True when the visitor has chosen (cookie present). */
  chosen: boolean;
  /** Accept-Language guess, for the chooser's highlighted button. */
  guess: Locale;
}

export async function getRequestLocale(): Promise<RequestLocale> {
  const [store, h] = await Promise.all([cookies(), headers()]);
  const saved = store.get(LOCALE_COOKIE)?.value;
  const rawGuess = h.get("x-ll-locale-guess");
  const guess: Locale = isLocale(rawGuess) ? rawGuess : "is";
  if (isLocale(saved)) return { locale: saved, chosen: true, guess };
  return { locale: "is", chosen: false, guess };
}

/**
 * Every translation for one language as { key: text }. Cached across
 * requests for five minutes: edits in /admin/translations show up within
 * that window. Paginated because PostgREST caps a response at 1000 rows
 * without saying so.
 */
export const getTranslations = unstable_cache(
  async (locale: Locale): Promise<Record<string, string>> => {
    const map: Record<string, string> = {};
    const PAGE = 1000;
    try {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabaseAdmin
          .from("translations")
          .select("key, en, is_text")
          .order("key", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error || !data) break;
        for (const r of data as { key: string; en: string | null; is_text: string | null }[]) {
          const text = locale === "is" ? r.is_text || r.en : r.en;
          if (text) map[r.key] = text;
        }
        if (data.length < PAGE) break;
      }
    } catch {
      /* An empty map makes the client fall back to its own fetch. */
    }
    return map;
  },
  ["translations-by-locale-v1"],
  { revalidate: 300, tags: ["translations"] },
);
