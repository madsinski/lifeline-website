"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Top-level Personal / Business switcher shown above the login card on
// both /account/login and /business/login. An audience that has been
// disabled in admin (system_settings) is hidden here; if fewer than two
// audiences remain, the switcher hides entirely (direct links still work).
export default function LoginAudienceTabs({ active }: { active: "personal" | "business" }) {
  const [avail, setAvail] = useState<{ personal: boolean; business: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/account-availability")
      .then((r) => r.json())
      .then((d) => setAvail({ personal: d.personal !== false, business: d.business !== false }))
      .catch(() => setAvail({ personal: true, business: true }));
  }, []);

  // Until loaded, render nothing to avoid flashing an option that's disabled.
  if (!avail) return null;

  const tabs = [
    { key: "personal" as const, href: "/account/login", label: "Einstaklingar" },
    { key: "business" as const, href: "/business/login", label: "Fyrirtæki" },
  ].filter((t) => avail[t.key]);

  if (tabs.length < 2) return null;

  const base = "flex min-h-10 flex-1 items-center justify-center rounded-hc-element px-4 text-sm font-semibold text-center transition-all duration-200";
  const activeCls = "bg-hc-surface text-hc-ink shadow-hc-card";
  const inactiveCls = "text-hc-ink-2 hover:text-hc-ink";

  return (
    <div className="flex rounded-hc-element bg-hc-sunken-2 p-1 ring-1 ring-hc-hairline" role="tablist" aria-label="Tegund aðgangs">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          role="tab"
          aria-selected={active === t.key}
          className={`${base} ${active === t.key ? activeCls : inactiveCls}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
