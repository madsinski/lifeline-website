import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import BetaFeedback from "./components/BetaFeedback";
import { I18nProvider } from "@/lib/i18n";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lifeline Health",
  description:
    "Comprehensive health assessments and personalised daily coaching. Know your numbers, build better habits, track your progress.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
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
        <ScrollToTop />
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <BetaFeedback />
        </I18nProvider>
      </body>
    </html>
  );
}
