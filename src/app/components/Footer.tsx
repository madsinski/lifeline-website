"use client";

import { useState } from "react";
import Link from "next/link";
import LifelineLogo from "./LifelineLogo";
import { useI18n } from "@/lib/i18n";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || t("footer.newsletter.error", "Could not subscribe. Try again."));
        setSubmitting(false);
        return;
      }
      setSubscribed(true);
      setEmail("");
      setTimeout(() => setSubscribed(false), 4000);
    } catch {
      setError(t("footer.newsletter.error", "Could not subscribe. Try again."));
    }
    setSubmitting(false);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-[#1F2937] text-white">
      {/* Newsletter bar */}
      <div className="border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-lg font-semibold text-white mb-1">
                {t('footer.newsletter.title', 'Stay up to date')}
              </h3>
              <p className="text-sm text-gray-400">
                {t('footer.newsletter.desc', 'Get health tips and Lifeline news delivered to your inbox.')}
              </p>
            </div>
            {subscribed ? (
              <div className="flex items-center gap-2 text-[#10B981] font-medium">
                <svg className="w-5 h-5 success-checkmark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('footer.newsletter.success', 'Thanks for subscribing!')}
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1 w-full md:w-auto">
                <form onSubmit={handleNewsletterSubmit} className="flex w-full md:w-auto gap-2">
                  <input
                    type="email"
                    placeholder={t('footer.newsletter.placeholder', 'your@email.com')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={submitting}
                    className="newsletter-input flex-1 md:w-64 px-4 py-2.5 rounded-full bg-gray-800 border border-gray-600 text-white text-sm placeholder:text-gray-500 outline-none transition-all disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2.5 bg-[#10B981] text-white text-sm font-semibold rounded-full hover:bg-[#047857] transition-all duration-200 whitespace-nowrap disabled:opacity-60"
                  >
                    {submitting ? "…" : t('footer.newsletter.submit', 'Subscribe')}
                  </button>
                </form>
                {error && <p className="text-xs text-red-400">{error}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="mb-2 flex items-start" style={{ marginLeft: '-2cm' }}>
              <LifelineLogo size="sm" variant="white" />
            </div>
            <p className="text-gray-400 text-sm font-semibold mb-1">Lifeline Health ehf.</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              {t('footer.tagline', 'Comprehensive health assessments and personalised daily coaching.')}
            </p>
          </div>

          {/* Pages */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              {t('footer.pages', 'PAGES')}
            </h3>
            <ul className="space-y-3">
              {[
                { href: "/", key: "footer.home", fallback: "Home" },
                { href: "/assessment", key: "footer.health_assessment", fallback: "Health Assessment" },
                { href: "/coaching", key: "footer.coaching", fallback: "Coaching" },
                { href: "/pricing", key: "footer.pricing", fallback: "Pricing" },
                { href: "/contact", key: "footer.contact_link", fallback: "Contact" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-gray-300 hover:text-white transition-colors duration-200">
                    {t(link.key, link.fallback)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              {t('footer.services', 'SERVICES')}
            </h3>
            <ul className="space-y-3">
              <li>
                <Link href="/assessment" className="text-sm text-gray-300 hover:text-white transition-colors duration-200">
                  {t('footer.health_assessment', 'Health Assessments')}
                </Link>
              </li>
              <li>
                <Link href="/coaching" className="text-sm text-gray-300 hover:text-white transition-colors duration-200">
                  {t('footer.health_coaching_app', 'Health Coaching App')}
                </Link>
              </li>
              <li>
                <span className="text-sm text-gray-300">{t('nav.patient_portal', 'Patient Portal')}</span>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
              {t('footer.contact', 'CONTACT')}
            </h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li>Lifeline Health ehf.</li>
              <li>Lagmula 5, 108 Reykjavik</li>
              <li>
                <a
                  href="mailto:contact@lifelinehealth.is"
                  className="hover:text-white transition-colors duration-200"
                >
                  contact@lifelinehealth.is
                </a>
              </li>
            </ul>
            {/* Social icons */}
            <div className="flex gap-4 mt-5">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="text-gray-400 hover:text-white transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            {t('footer.copyright', '© 2026 Lifeline Health ehf. All rights reserved.')}
          </p>
          <div className="flex items-center gap-4">
            <a href="/admin" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 border border-gray-600 rounded-full hover:bg-gray-700 hover:text-white transition-all duration-200">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Admin Panel
            </a>
            <button
              onClick={scrollToTop}
              className="back-to-top flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors duration-200"
              aria-label="Back to top"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {t('footer.back_to_top', 'Back to top')}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
