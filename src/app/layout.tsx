import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Caveat, Nunito_Sans, Schibsted_Grotesk, Newsreader, Public_Sans, Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { tenantForHost } from "@/lib/tenant";
import { getPublishedBlob } from "@/lib/site-content/server";
import { resolveNav } from "@/lib/site-content/nav";
import ScrollToTop from "./components/ScrollToTop";
import ScrollDebug from "./components/ScrollDebug";
import AuthSync from "./components/AuthSync";
import BetaFeedback from "./components/BetaFeedback";
import ErrorHandlerClient from "./components/ErrorHandlerClient";
import { I18nProvider } from "@/lib/i18n";
import { getRequestLocale, getTranslations } from "@/lib/i18n-server";
import LanguageChooser from "./components/LanguageChooser";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const signature = Caveat({
  variable: "--font-signature",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

// Used by the Lifeline wordmark logo (200 = ExtraLight for "health",
// 800 = ExtraBold for "lifeline"). Loaded once at the root so the
// logo renders identically across every page without a font-flash.
const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["200", "800"],
  display: "swap",
});

// Deck typography options (see DESIGNS in src/lib/presentations/types.ts).
// The "latin" subset covers Icelandic — ð, þ, æ and the accented vowels all
// live in Latin-1, so no latin-ext is needed.
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

// viewport-fit=cover lets the page run under the notch / home indicator so
// env(safe-area-inset-*) reports real values — without it every inset is 0
// and JourneyNav's bottom padding and --hc-dock-offset never clear the home
// bar. width/initialScale restate Next's defaults, which this object replaces.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Title/description follow the serving host (Lifeline vs Fjarlækningar).
export async function generateMetadata(): Promise<Metadata> {
  const tenant = tenantForHost((await headers()).get("host"));
  if (tenant.id === "fjarlaekningar") {
    return { title: "Fjarlækningar", description: "Íslensk fjarlækningaþjónusta." };
  }
  const { locale } = await getRequestLocale();
  return {
    title: "Lifeline Health",
    description: locale === "en"
      ? "Health checks and personalised daily coaching. Know your numbers, build better habits, track your progress."
      : "Heilsufarsskoðun og persónuleg dagleg þjálfun. Þekktu tölurnar þínar, byggðu upp betri venjur og fylgstu með framförunum.",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The Fjarlækningar host is an app-only host (admin + shared decks); it has no
  // marketing pages, so suppress the Lifeline marketing Navbar/Footer there.
  const tenant = tenantForHost((await headers()).get("host"));
  const showMarketingChrome = tenant.id === "lifeline";
  // Resolve the published navbar config on the server so the menu paints in its
  // final order/visibility (no flash of the default setup).
  // The visitor's language (ll-locale cookie) and its strings are resolved
  // here too, so the first paint is already in that language. No cookie:
  // Icelandic, and the LanguageChooser asks.
  const [navItems, req] = await Promise.all([
    showMarketingChrome ? getPublishedBlob("nav").then(resolveNav) : Promise.resolve(undefined),
    getRequestLocale(),
  ]);
  const translations = await getTranslations(req.locale);
  return (
    <html lang={req.locale}className={`${inter.variable} ${signature.variable} ${nunitoSans.variable} ${schibsted.variable} ${newsreader.variable} ${publicSans.variable} ${archivo.variable} ${plexSans.variable} ${plexMono.variable} antialiased`} style={{ overflow: "auto" }}>
      <body className="min-h-screen flex flex-col font-sans" style={{ overflow: "auto" }}>
        <script
          dangerouslySetInnerHTML={{
            /* Both before paint. The scheme has to be here rather than in a
               component: React mounts after the first paint, so a dark-mode
               reader would get a white flash on every navigation. */
            __html: `try{if(localStorage.getItem("ll-brand-theme")==="classic")document.documentElement.dataset.theme="classic";var s=localStorage.getItem("ll-scheme");if(s==="dark"||s==="light")document.documentElement.dataset.scheme=s}catch(e){}`,
          }}
        />
        <I18nProvider initialLocale={req.locale} initialTranslations={translations} chosen={req.chosen}>
        <ErrorHandlerClient />
        <ScrollToTop />
        <ScrollDebug />
        <AuthSync />
        {showMarketingChrome && <Navbar initialItems={navItems} />}
        <main className="flex-1">{children}</main>
        {showMarketingChrome && <Footer />}
        {showMarketingChrome && !req.chosen && <LanguageChooser guess={req.guess} />}
        <BetaFeedback />
        </I18nProvider>
      </body>
    </html>
  );
}
