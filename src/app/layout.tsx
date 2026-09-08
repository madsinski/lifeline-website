import type { Metadata } from "next";
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

// Title/description follow the serving host (Lifeline vs Fjarlækningar).
export async function generateMetadata(): Promise<Metadata> {
  const tenant = tenantForHost((await headers()).get("host"));
  if (tenant.id === "fjarlaekningar") {
    return { title: "Fjarlækningar", description: "Íslensk fjarlækningaþjónusta." };
  }
  return {
    title: "Lifeline Health",
    description:
      "Comprehensive health assessments and personalised daily coaching. Know your numbers, build better habits, track your progress.",
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
  const navItems = showMarketingChrome ? resolveNav(await getPublishedBlob("nav")) : undefined;
  return (
    <html lang="en" className={`${inter.variable} ${signature.variable} ${nunitoSans.variable} ${schibsted.variable} ${newsreader.variable} ${publicSans.variable} ${archivo.variable} ${plexSans.variable} ${plexMono.variable} antialiased`} style={{ overflow: "auto" }}>
      <body className="min-h-screen flex flex-col font-sans" style={{ overflow: "auto" }}>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("ll-brand-theme")==="classic")document.documentElement.dataset.theme="classic"}catch(e){}`,
          }}
        />
        <I18nProvider>
        <ErrorHandlerClient />
        <ScrollToTop />
        <ScrollDebug />
        <AuthSync />
        {showMarketingChrome && <Navbar initialItems={navItems} />}
        <main className="flex-1">{children}</main>
        {showMarketingChrome && <Footer />}
        <BetaFeedback />
        </I18nProvider>
      </body>
    </html>
  );
}
