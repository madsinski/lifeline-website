"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LifelineLogo from "./LifelineLogo";
import MedaliaButton from "./MedaliaButton";
import { supabase } from "@/lib/supabase";
import { LanguagePicker, useI18n } from "@/lib/i18n";

const navLinkDefs = [
  { href: "/assessment", key: "nav.assessment", fallback: "Assessment" },
  { href: "/coaching", key: "nav.coaching", fallback: "Coaching" },
  { href: "/pricing", key: "nav.pricing", fallback: "Pricing" },
  { href: "/business", key: "nav.companies", fallback: "Companies" },
  { href: "/contact", key: "nav.contact", fallback: "Contact" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Check auth state and load name from clients table
  useEffect(() => {
    const loadUserName = async (userId: string, email?: string) => {
      try {
        const { data } = await supabase
          .from("clients_decrypted")
          .select("full_name")
          .eq("id", userId)
          .single();
        if (data?.full_name) {
          const firstNamePart = data.full_name.split(" ")[0];
          setUserName(firstNamePart);
        } else {
          setUserName(email?.split("@")[0] || null);
        }
      } catch {
        setUserName(email?.split("@")[0] || null);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserName(session.user.id, session.user.email ?? undefined);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserName(session.user.id, session.user.email ?? undefined);
      } else {
        setUserName(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close mobile menu and refresh user name on route change
  useEffect(() => {
    setMobileOpen(false);
    // Refresh name from DB when navigating (catches profile edits)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase
          .from("clients_decrypted")
          .select("full_name")
          .eq("id", session.user.id)
          .single()
          .then(({ data }) => {
            if (data?.full_name) {
              setUserName(data.full_name.split(" ")[0]);
            }
          });
      }
    });
  }, [pathname]);

  return (
    <>
    <nav
      className={`sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-200 transition-shadow duration-300 ${
        scrolled ? "shadow-md" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[4.5rem]">
          {/* Logo */}
          <Link href="/" className="flex items-center mr-8">
            <LifelineLogo size="sm" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-5 xl:gap-7 flex-nowrap">
            {navLinkDefs.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors relative whitespace-nowrap ${
                    isActive
                      ? "text-[#10B981]"
                      : "text-[#6B7280] hover:text-[#1F2937]"
                  }`}
                >
                  {t(link.key, link.fallback)}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#10B981] rounded-full" />
                  )}
                </Link>
              );
            })}
            <MedaliaButton label="Patient Portal" size="sm" />
            <LanguagePicker />
            <Link
              href="/account"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors whitespace-nowrap"
            >
              {userName ? (
                <>
                  <span className="w-7 h-7 rounded-full bg-[#10B981] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-semibold text-[#1F2937]">{userName.split(' ')[0]}</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span>{t('nav.my_account', 'Account')}</span>
                </>
              )}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 text-[#1F2937]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

    </nav>

    {/* Mobile menu rendered OUTSIDE nav to avoid bg-white/95 inheritance */}
    {mobileOpen && (
      <div className="lg:hidden fixed inset-0 top-[4.5rem]" style={{ zIndex: 9999 }}>
        <div
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setMobileOpen(false)}
        />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '320px', maxWidth: '85vw', backgroundColor: '#ffffff', zIndex: 10, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', borderLeft: '1px solid #e5e7eb' }}>
          <div className="px-6 py-6 space-y-2">
            {navLinkDefs.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "text-[#10B981] bg-[#10B981]/5"
                      : "text-[#6B7280] hover:text-[#1F2937] hover:bg-gray-50"
                  }`}
                >
                  {t(link.key, link.fallback)}
                </Link>
              );
            })}
            <div className="pt-4 space-y-3 border-t border-gray-100">
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-lg text-[#6B7280] hover:text-[#1F2937] hover:bg-gray-50 transition-colors"
              >
                {userName ? (
                  <>
                    <span className="w-6 h-6 rounded-full bg-[#10B981] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{userName}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {t('nav.my_account', 'My Account')}
                  </>
                )}
              </Link>
              <MedaliaButton label="Patient Portal" size="sm" className="w-full" />
              <Link
                href="/coaching#download"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center px-5 py-2.5 text-sm font-semibold border-2 border-[#10B981] text-[#10B981] rounded-full hover:bg-[#10B981] hover:text-white transition-all duration-200"
              >
                {t('nav.download_app', 'Download App')}
              </Link>
              <LanguagePicker className="w-full justify-center" />
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
