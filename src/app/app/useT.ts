"use client";

// Look up app copy in the language the person has already chosen.
//
// The locale comes from the site's own I18nProvider, so the toggle in the app
// and the one in the marketing navbar are the same switch and there is one
// answer to "what language is this person reading". Only the strings are
// local. See strings.ts for why.

import { useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { STRINGS, type StringKey } from "./strings";

export function useT() {
  const { locale } = useI18n();
  return useCallback((key: StringKey) => STRINGS[key][locale === "en" ? "en" : "is"], [locale]);
}

/** The date, written out, in the reader's language. */
const DAYS = {
  is: ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
const MONTHS = {
  is: ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/**
 * A date and time, short, in the reader's language. Hand-formatted for the
 * same reason as the long one below.
 */
export function useShortDateTime() {
  const { locale } = useI18n();
  const l = locale === "en" ? "en" : "is";
  return useCallback((iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return l === "is"
      ? `${d.getDate()}. ${MONTHS.is[d.getMonth()]} kl. ${hh}:${mm}`
      : `${MONTHS.en[d.getMonth()]} ${d.getDate()}, ${hh}:${mm}`;
  }, [l]);
}

/**
 * Hand-formatted in both languages.
 *
 * Intl is not an option here: Vercel's runtime has no Icelandic locale data,
 * so toLocaleDateString("is-IS") silently returns English — which is exactly
 * how the app home shipped "THURSDAY, OCTOBER 8" on an Icelandic surface.
 */
export function useLongDate() {
  const { locale } = useI18n();
  const l = locale === "en" ? "en" : "is";
  return useCallback((d: Date = new Date()) =>
    l === "is"
      ? `${DAYS.is[d.getDay()]} ${d.getDate()}. ${MONTHS.is[d.getMonth()]}`
      : `${DAYS.en[d.getDay()]}, ${MONTHS.en[d.getMonth()]} ${d.getDate()}`, [l]);
}
