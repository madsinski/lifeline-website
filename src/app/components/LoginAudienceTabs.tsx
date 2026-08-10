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
    { key: "personal" as const, href: "/account/login", label: "Personal" },
    { key: "business" as const, href: "/business/login", label: "Business" },
  ].filter((t) => avail[t.key]);

  if (tabs.length < 2) return null;

  const base = "flex-1 py-2 px-4 text-sm font-medium rounded-full text-center transition-all duration-200";
  const activeCls = "bg-white text-[#1F2937] shadow-sm";
  const inactiveCls = "text-[#6B7280] hover:text-[#1F2937]";

  return (
    <div className="flex mb-5 bg-[#E2E8F0]/70 rounded-full p-1" role="tablist" aria-label="Account type">
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
