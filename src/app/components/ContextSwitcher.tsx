"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

export type AccountContext = "personal" | "business";

const ICONS: Record<AccountContext, string> = {
  // user
  personal: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  // building
  business:
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
};

const META: Record<AccountContext, { key: string; label: string; href: string }> = {
  personal: { key: "comp.ctx.personal", label: "Mínar síður", href: "/account" },
  business: { key: "comp.ctx.business", label: "Fyrirtækjastjórnun", href: "/business/account" },
};

function Icon({ ctx }: { ctx: AccountContext }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={ICONS[ctx]} />
    </svg>
  );
}

/**
 * Segmented control to switch between the two customer contexts a user can
 * hold: their own account (`/account` — the member experience, whether personal
 * or employer-linked) and the company-admin experience (`/business`), shown
 * only if they're a company contact person or co-admin. Renders nothing unless
 * the user is a company admin — a plain member has just one context.
 *
 * Self-contained: it detects the available contexts itself, so it can be
 * dropped into either surface with just `current`.
 */
export default function ContextSwitcher({ current }: { current: AccountContext }) {
  const { t } = useI18n();
  const [hasBusiness, setHasBusiness] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setReady(true); return; }
      const [primary, coadmin] = await Promise.all([
        supabase.from("companies").select("id").eq("contact_person_id", user.id).limit(1),
        supabase.from("company_admins").select("company_id").eq("user_id", user.id).limit(1),
      ]);
      if (cancelled) return;
      setHasBusiness((primary.data?.length || 0) > 0 || (coadmin.data?.length || 0) > 0);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const available: AccountContext[] = [
    "personal",
    ...(hasBusiness ? (["business"] as const) : []),
  ];

  // Nothing to switch to — don't render the control at all.
  if (!ready || available.length < 2) return null;

  return (
    <div
      role="group"
      aria-label={t("comp.ctx.switch", "Skipta á milli aðganga")}
      className="inline-flex items-center gap-1 rounded-hc-element bg-hc-surface p-1 shadow-hc-card ring-1 ring-slate-200"
    >
      {available.map((ctx) => {
        const active = ctx === current;
        const base = "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand";
        if (active) {
          return (
            <span key={ctx} aria-current="page" className={`${base} bg-hc-brand-dark text-white`}>
              <Icon ctx={ctx} />
              {t(META[ctx].key, META[ctx].label)}
            </span>
          );
        }
        return (
          <Link
            key={ctx}
            href={META[ctx].href}
            className={`${base} text-hc-ink-2 hover:bg-hc-brand-surface hover:text-hc-brand-text`}
          >
            <Icon ctx={ctx} />
            {t(META[ctx].key, META[ctx].label)}
          </Link>
        );
      })}
    </div>
  );
}
