"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LifelineLogo from "./LifelineLogo";
import { supabase } from "@/lib/supabase";
import { LanguagePicker, useI18n } from "@/lib/i18n";
import { NAV_ITEMS, type NavItem } from "@/lib/site-content/nav";

// `initialItems` is resolved on the server (layout) from the published nav
// config, so the menu renders in its final order/visibility on first paint —
// no flash of the default setup.
export default function Navbar({ initialItems }: { initialItems?: NavItem[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [acctOpen, setAcctOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Only company admins see the business account link.
  const [hasBusiness, setHasBusiness] = useState(false);
  const navItems = initialItems ?? NAV_ITEMS;
  const pathname = usePathname();
  const { t, locale } = useI18n();

  // CMS label override (per locale) wins; otherwise the translations key / built-in.
  const navLabel = (link: NavItem) =>
    (locale === "en" ? link.labelEn : link.labelIs) || t(link.key, link.fallback);

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

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSignedIn(!!session?.user);
      if (session?.user) {
        loadUserName(session.user.id, session.user.email ?? undefined);
        const [primary, coadmin] = await Promise.all([
          supabase.from("companies").select("id").eq("contact_person_id", session.user.id).limit(1),
          supabase.from("company_admins").select("company_id").eq("user_id", session.user.id).limit(1),
        ]);
        setHasBusiness((primary.data?.length || 0) > 0 || (coadmin.data?.length || 0) > 0);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session?.user);
      if (session?.user) {
        loadUserName(session.user.id, session.user.email ?? undefined);
      } else {
        setUserName(null);
        setHasBusiness(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close mobile menu and refresh user name on route change
  useEffect(() => {
    const close = setTimeout(() => { setMobileOpen(false); setAcctOpen(false); }, 0);
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
    return () => clearTimeout(close);
  }, [pathname]);

  // Survey/research/contract pages and the standalone legal pages each
  // render their own self-contained header (logo + back button), so the
  // marketing nav must not also render — otherwise the header doubles up.
  // Placed after all hooks so the rules of hooks are respected.
  /*
   * /app is an app, not a page of the site.
   *
   * It already carries its own navigation — the bottom bar with Í dag,
   * Æfingar, Næring, Þjálfari — and it was being wrapped in the marketing
   * header and footer as well. Measured on Æfingar: 1300 of 2292px, more
   * than half the page, was site chrome. A participant checking today's
   * training scrolled past their plan into a newsletter signup, "SÍÐUR /
   * Heim / Hafa samband" and the social icons.
   *
   * The sign-in / signup screens (/byrja, /account/login, /auth/*, the B2B
   * onboarding and the partner invite) render AuthShell, which carries its
   * own logo — with the Navbar too there were two.
   */
  const chromeFree = ["/survey", "/research", "/verkefnalysing", "/radningarsamningur", "/present", "/security-review", "/leidbeiningar", "/legal-review", "/privacy", "/terms", "/sales-terms", "/soluskilmalar", "/vinnustod", "/app", "/byrja", "/account/login", "/auth", "/business/onboard", "/account/partner-invite"];
  if (chromeFree.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <>
    <nav
      className={`sticky top-0 z-50 pt-[env(safe-area-inset-top)] bg-white/95 backdrop-blur-lg border-b border-gray-200 transition-shadow duration-300 ${
        scrolled ? "shadow-md" : ""
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[4.5rem]">
          {/* Logo — a slight negative left offset so the mark sits visually
              flush with the page gutter (the wordmark is right-heavy, so
              anchoring the mark at x=0 makes the whole logo read shifted
              right).
              
              Not on a phone. There the gutter is 20px and the pull left
              12px, which stops reading as optical alignment and starts
              reading as touching the edge. The trick needs room to be a
              trick. */}
          <Link href="/" className="flex items-center mr-8 sm:-ml-2">
            <LifelineLogo size="sm" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-5 xl:gap-7 flex-nowrap">
            {navItems.map((link) => {
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
                  {navLabel(link)}
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#10B981] rounded-full" />
                  )}
                </Link>
              );
            })}
            <LanguagePicker />
            <div className="relative">
              <button
                type="button"
                onClick={() => setAcctOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={acctOpen}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#10B981] rounded-full hover:bg-[#047857] transition-colors whitespace-nowrap shadow-sm"
              >
                {userName ? (
                  <span className="w-6 h-6 rounded-full bg-white/25 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
                <span>{userName ? userName.split(" ")[0] : t("nav.my_account", "Mínar síður")}</span>
                <svg className={`w-3.5 h-3.5 transition-transform ${acctOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {acctOpen && (
                <>
                  <button type="button" aria-label="Loka" onClick={() => setAcctOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                  <div role="menu" className="absolute right-0 mt-2 w-60 rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden z-50">
                    <Link href="/account" onClick={() => setAcctOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      {t("nav.my_account", "Mínar síður")}
                    </Link>
                    {hasBusiness && <Link href="/business/account" onClick={() => setAcctOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 border-t border-gray-100">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                      {t("nav.business_account", "Fyrirtækjaaðgangur")}
                    </Link>}
                    {/* Signed out, "Skrá út" did nothing visible; offer the way in instead. */}
                    {signedIn ? (
                      <button type="button" disabled={signingOut}
                        onClick={async () => {
                          setSigningOut(true);
                          await supabase.auth.signOut().catch(() => null);
                          setAcctOpen(false);
                          window.location.href = "/account/login";
                        }}
                        className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-3 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-60">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        {signingOut ? t("nav.signingout", "Skrái út…") : t("nav.signout", "Skrá út")}
                      </button>
                    ) : (
                      <Link href="/account/login" onClick={() => setAcctOpen(false)}
                        className="flex items-center gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-800 hover:bg-gray-50">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                        {t("nav.signin", "Skrá inn")}
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={mobileOpen ? t("nav.close_menu", "Loka valmynd") : t("nav.open_menu", "Opna valmynd")}
            aria-expanded={mobileOpen}
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
      <div className="lg:hidden fixed inset-0 top-[var(--hc-site-nav-h)]" style={{ zIndex: 9999 }}>
        <div
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setMobileOpen(false)}
        />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '320px', maxWidth: '85vw', backgroundColor: '#ffffff', zIndex: 10, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', borderLeft: '1px solid #e5e7eb' }}>
          <div className="px-6 py-6 space-y-2">
            {navItems.map((link) => {
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
                  {navLabel(link)}
                </Link>
              );
            })}
            <div className="pt-4 space-y-3 border-t border-gray-100">
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg text-white bg-[#10B981] hover:bg-[#047857] transition-colors"
              >
                {userName ? (
                  <>
                    <span className="w-6 h-6 rounded-full bg-white/25 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{userName}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {t('nav.my_account', 'Mínar síður')}
                  </>
                )}
              </Link>
              {hasBusiness && <Link
                href="/business/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg border border-[#10B981] text-[#10B981] hover:bg-[#10B981]/5 transition-colors"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {t('nav.business_account', 'Fyrirtækjaaðgangur')}
              </Link>}
              <Link
                href="/coaching#download"
                onClick={() => setMobileOpen(false)}
                className="block w-full text-center px-5 py-2.5 text-sm font-semibold border-2 border-[#10B981] text-[#10B981] rounded-full hover:bg-[#10B981] hover:text-white transition-all duration-200"
              >
                {t('nav.check_app', 'Skoða appið')}
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
