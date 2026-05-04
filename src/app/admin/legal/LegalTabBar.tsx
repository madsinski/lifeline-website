"use client";

// Shared tab bar across the three Legal pages so they feel like one
// hub (Documents drafts / Signed acceptances / Posture statements).
// The tabs are independent routes — clicking jumps between them rather
// than toggling state — so each page's deep link still works (e.g.
// the lawyer's auto-redirect to /admin/legal/drafts).
//
// Lawyer-aware: external counsel only sees Documents + Posture (the
// Signed-acceptances tab would be empty for them under RLS anyway).

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Tab {
  href: string;
  label: string;
  description: string;
}

const ALL_TABS: Tab[] = [
  {
    href: "/admin/legal/drafts",
    label: "Documents",
    description: "Drafts + lawyer review for every legal text",
  },
  {
    href: "/admin/legal",
    label: "Signed acceptances",
    description: "Every click-through and B2B agreement signed by clients, employees, contact persons",
  },
  {
    href: "/admin/legal/posture",
    label: "Security posture",
    description: "Audit-ready compliance statement for Persónuvernd and B2B procurement",
  },
];

export default function LegalTabBar() {
  const pathname = usePathname();
  const [isLawyer, setIsLawyer] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { if (!cancelled) setIsLawyer(false); return; }
      const { data } = await supabase
        .from("staff")
        .select("role")
        .eq("email", user.email)
        .maybeSingle();
      if (!cancelled) setIsLawyer((data?.role as string) === "lawyer");
    })();
    return () => { cancelled = true; };
  }, []);

  const tabs = isLawyer === true ? ALL_TABS.filter((t) => t.href !== "/admin/legal") : ALL_TABS;

  return (
    <div className="border-b border-gray-200 -mt-2 mb-5">
      <nav className="flex items-center gap-1 -mb-px" aria-label="Legal sections">
        {tabs.map((t) => {
          const active =
            (t.href === "/admin/legal" && pathname === "/admin/legal") ||
            (t.href !== "/admin/legal" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-emerald-500 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
              title={t.description}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
