// The visitor's language: shared constants + the cookie writer.
// Client- and server-safe (no React, no Supabase).

export type Locale = "is" | "en";

export const LOCALE_COOKIE = "ll-locale";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function isLocale(v: unknown): v is Locale {
  return v === "is" || v === "en";
}

/** Read the ll-locale cookie in the browser. */
export function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)ll-locale=(is|en)(?:;|$)/);
  return m ? (m[1] as Locale) : null;
}

/** Write the ll-locale cookie (1 year, whole site, SameSite=Lax). */
export function writeLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; Max-Age=${ONE_YEAR_S}; Path=/; SameSite=Lax${secure}`;
}

/**
 * Routes that stay Icelandic for now and never show the language chooser:
 * the app (/app is Icelandic-only until it is translated), staff tools and
 * token links that render their own documents.
 */
const NO_CHOOSER_PREFIXES = [
  "/app", "/admin", "/vinnustod", "/present", "/survey", "/research",
  "/verkefnalysing", "/radningarsamningur", "/legal-review", "/security-review",
  "/business/onboard", "/business/claim", "/account/partner-invite", "/leidbeiningar",
];

export function chooserHiddenOn(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  return NO_CHOOSER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Paths that always render in Icelandic, whatever the cookie says: the app
 *  (not translated yet) and the nurse workstation. */
export function icelandicOnly(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ["/app", "/vinnustod"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
