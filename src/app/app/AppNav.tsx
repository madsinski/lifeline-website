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
import { Activity, CircleUser, HeartPulse, Home, Users } from "lucide-react";

interface Tab {
  href: string;
  label: string;
  Icon: typeof Home;
  /** Only "Heima" matches exactly; the rest own their subtree. */
  exact?: boolean;
}

export const APP_TABS: Tab[] = [
  { href: "/app", label: "Heima", Icon: Home, exact: true },
  { href: "/app/heilsa", label: "Heilsan", Icon: HeartPulse },
  { href: "/app/virkni", label: "Virkni", Icon: Activity },
  { href: "/app/samfelag", label: "Samfélag", Icon: Users },
  { href: "/app/eg", label: "Ég", Icon: CircleUser },
];

export default function AppNav() {
  const path = usePathname();
  const on = (t: Tab) =>
    t.exact ? path === t.href : path.startsWith(t.href);

  return (
    <>
      {/* Phone: fixed to the bottom, clear of the system bar. */}
      <nav aria-label="Lifeline" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {APP_TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={on(t) ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition ${
              on(t) ? "text-hc-brand-dark" : "text-slate-500"}`}>
            <t.Icon className="h-6 w-6" strokeWidth={on(t) ? 2.4 : 2} aria-hidden />
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Desktop: a rail, so the content is not stuck in a phone column. */}
      <nav aria-label="Lifeline" className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col gap-1 border-r border-slate-200 bg-white p-3 lg:flex">
        <p className="px-3 pb-3 pt-2 text-sm font-bold tracking-tight text-hc-ink">Lifeline</p>
        {APP_TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={on(t) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              on(t) ? "bg-emerald-50 text-hc-brand-dark" : "text-slate-600 hover:bg-slate-50"}`}>
            <t.Icon className="h-5 w-5" aria-hidden />{t.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
