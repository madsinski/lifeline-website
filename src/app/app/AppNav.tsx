"use client";

// The app's own navigation.
//
// Phone-first on purpose: this surface exists because the heilsuferð pages
// already feel like an app on a phone, and the thing that makes them feel
// that way is a thumb-reachable bar that does not move. Five destinations,
// no "Meira" — if a sixth is ever needed, something else has earned its way
// out rather than everything getting smaller.
//
// On a wide screen it becomes a rail down the left, because a bottom bar on a
// laptop is a phone layout someone forgot to finish.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, HeartPulse, Home, MessageCircle, Users } from "lucide-react";
import { useT } from "./useT";
import type { StringKey } from "./strings";

interface Tab {
  href: string;
  /** Key into the app's own dictionary — see strings.ts. */
  label: StringKey;
  Icon: typeof Home;
  /** Only "Heima" matches exactly; the rest own their subtree. */
  exact?: boolean;
}

/**
 * The app's own five tabs, not an invention.
 *
 * src/components/BottomNav.tsx:63-68 in fhir-health-dashboard:
 * home · assessment · health · coach · community. The second was relabelled
 * to Clinic on 2026-05-20 when HealthAssessmentScreen was folded into
 * ClinicInfoScreen (HomeScreen.tsx:191-193), so it is Stofan here.
 */
export const APP_TABS: Tab[] = [
  { href: "/app", label: "nav.home", Icon: Home, exact: true },
  { href: "/app/stofan", label: "nav.clinic", Icon: Building2 },
  { href: "/app/heilsan", label: "nav.health", Icon: HeartPulse },
  { href: "/app/thjalfari", label: "nav.coach", Icon: MessageCircle },
  { href: "/app/samfelag", label: "nav.community", Icon: Users },
];

export default function AppNav() {
  const path = usePathname();
  const t = useT();
  const on = (t: Tab) =>
    t.exact ? path === t.href : path.startsWith(t.href);

  return (
    <>
      {/* Phone: fixed to the bottom, clear of the system bar. */}
      <nav aria-label="Lifeline" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {APP_TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} aria-current={on(tab) ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition ${
              on(tab) ? "text-hc-brand-dark" : "text-slate-500"}`}>
            <tab.Icon className="h-6 w-6" strokeWidth={on(tab) ? 2.4 : 2} aria-hidden />
            {t(tab.label)}
          </Link>
        ))}
      </nav>

      {/* Desktop: a rail, so the content is not stuck in a phone column. */}
      <nav aria-label="Lifeline" className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col gap-1 border-r border-slate-200 bg-white p-3 lg:flex">
        <p className="px-3 pb-3 pt-2 text-sm font-bold tracking-tight text-hc-ink">Lifeline</p>
        {APP_TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} aria-current={on(tab) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              on(tab) ? "bg-emerald-50 text-hc-brand-dark" : "text-slate-600 hover:bg-slate-50"}`}>
            <tab.Icon className="h-5 w-5" aria-hidden />{t(tab.label)}
          </Link>
        ))}
      </nav>
    </>
  );
}
