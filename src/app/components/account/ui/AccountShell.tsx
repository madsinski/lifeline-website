"use client";

// The frame of "Mínar síður": a header (context switch, sign out), the
// section navigation — a side rail on desktop, a tab strip on a phone — and
// the page. Both navigations carry "Opna appið", because somebody who only
// wants the app should not have to read a page about it first.
//
// White ground, white cards with a real edge: no grey backdrop.

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { hcKicker } from "@/app/components/hc/ui";

export interface ShellNavItem<Id extends string> {
  id: Id;
  label: string;
  /** Shown in the phone tab strip, where five full labels do not fit. */
  shortLabel: string;
  icon: LucideIcon;
  href: string;
}

export function AccountShell<Id extends string>({ kicker, headerActions, nav, active, appHref = "/app", appLabel, appShortLabel, navLabel, children }: {
  kicker: string;
  headerActions?: ReactNode;
  nav: ShellNavItem<Id>[];
  active: Id;
  appHref?: string;
  appLabel: string;
  appShortLabel: string;
  navLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-b from-hc-brand-surface to-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
          <p className={`${hcKicker} text-hc-brand-text`}>{kicker}</p>
          <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
        </div>
      </div>

      <div id="account-content" className="mx-auto max-w-6xl scroll-mt-4 px-4 pb-24 sm:px-6 lg:px-8">
        {/* Phone: one row of tabs, pinned under the site header. */}
        <nav aria-label={navLabel} className="sticky top-[var(--hc-site-nav-h)] z-20 -mx-4 mb-4 border-b border-hc-hairline bg-white/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:hidden">
          <ul className="grid grid-cols-5 gap-1">
            {nav.map((item) => {
              const on = item.id === active;
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Link href={item.href} scroll={false} replace aria-current={on ? "page" : undefined}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-hc-element px-1 text-center text-[11px] font-semibold leading-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${
                      on ? "bg-hc-brand-dark text-white shadow-hc-card" : "text-hc-ink-2 hover:bg-hc-brand-surface hover:text-hc-brand-text"}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                    <span>{item.shortLabel}</span>
                  </Link>
                </li>
              );
            })}
            <li>
              <Link href={appHref}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-hc-element bg-hc-brand-surface px-1 text-center text-[11px] font-semibold leading-tight text-hc-brand-text ring-1 ring-emerald-200 transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
                <ArrowUpRight className="h-5 w-5" aria-hidden />
                <span>{appShortLabel}</span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="hidden shrink-0 lg:block lg:w-60">
            <nav aria-label={navLabel} className="sticky top-24 rounded-hc-card bg-hc-surface p-2 shadow-hc-card ring-1 ring-slate-200">
              <ul className="flex flex-col gap-1">
                {nav.map((item) => {
                  const on = item.id === active;
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <Link href={item.href} scroll={false} replace aria-current={on ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-hc-element px-3.5 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${
                          on ? "bg-hc-brand-dark text-white" : "text-hc-ink-2 hover:bg-hc-brand-surface hover:text-hc-brand-text"}`}>
                        <Icon className="h-5 w-5 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <Link href={appHref}
                className="mt-2 flex items-center gap-3 rounded-hc-element bg-hc-brand-surface px-3.5 py-2.5 text-sm font-semibold text-hc-brand-text ring-1 ring-emerald-200 transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
                <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden />
                {appLabel}
              </Link>
            </nav>
          </aside>

          <main className="min-w-0 flex-1 space-y-5">{children}</main>
        </div>
      </div>
    </div>
  );
}

/** Full-page spinner in the shell's colours. */
export function AccountLoading({ label = "Hleð…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white" role="status" aria-label={label}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-hc-brand-dark border-t-transparent" />
    </div>
  );
}
