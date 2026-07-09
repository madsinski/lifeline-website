import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Caveat, Nunito_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { tenantForHost } from "@/lib/tenant";
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
  return (
    <html lang="en" className={`${inter.variable} ${signature.variable} ${nunitoSans.variable} antialiased`} style={{ overflow: "auto" }}>
      <body className="min-h-screen flex flex-col font-sans" style={{ overflow: "auto" }}>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("ll-brand-theme")==="classic")document.documentElement.dataset.theme="classic"}catch(e){}`,
          }}
        />
        <Script
          src="https://app.medalia.is/sdk.js"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        <I18nProvider>
        <ErrorHandlerClient />
        <ScrollToTop />
        <ScrollDebug />
        <AuthSync />
        {showMarketingChrome && <Navbar />}
        <main className="flex-1">{children}</main>
        {showMarketingChrome && <Footer />}
        <BetaFeedback />
        </I18nProvider>
      </body>
    </html>
  );
}
