"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getMyStaffRole } from "@/lib/staff-role";

export type AccountContext = "personal" | "business" | "staff";

const ICONS: Record<AccountContext, string> = {
  // user
  personal: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  // building
  business:
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  // id badge / clipboard
  staff:
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
};

const META: Record<AccountContext, { label: string; href: string }> = {
  personal: { label: "Personal", href: "/account" },
  business: { label: "Business", href: "/business" },
  staff: { label: "Staff", href: "/admin" },
};

function Icon({ ctx }: { ctx: AccountContext }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={ICONS[ctx]} />
    </svg>
  );
}

/**
 * Segmented control to switch between the account contexts a user actually has:
 * their personal account, a company/business account (if they're a contact
 * person or co-admin), and the staff app (if they're active staff). Renders
 * nothing unless the user has at least two contexts to move between.
 *
 * Self-contained: it detects the available contexts itself, so it can be
 * dropped into any of the three surfaces with just `current`.
 */
export default function ContextSwitcher({ current }: { current: AccountContext }) {
  const [hasBusiness, setHasBusiness] = useState(false);
  const [hasStaff, setHasStaff] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setReady(true); return; }
      const [staff, primary, coadmin] = await Promise.all([
        getMyStaffRole(user.email).catch(() => null),
        supabase.from("companies").select("id").eq("contact_person_id", user.id).limit(1),
        supabase.from("company_admins").select("company_id").eq("user_id", user.id).limit(1),
      ]);
      if (cancelled) return;
      setHasStaff(!!staff);
      setHasBusiness((primary.data?.length || 0) > 0 || (coadmin.data?.length || 0) > 0);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const available: AccountContext[] = [
    "personal",
    ...(hasBusiness ? (["business"] as const) : []),
    ...(hasStaff ? (["staff"] as const) : []),
  ];

  // Nothing to switch to — don't render the control at all.
  if (!ready || available.length < 2) return null;

  return (
    <div
      role="group"
      aria-label="Switch account"
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm"
    >
      {available.map((ctx) => {
        const active = ctx === current;
        const base = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors";
        if (active) {
          return (
            <span key={ctx} aria-current="page" className={`${base} bg-[#10B981] text-white`}>
              <Icon ctx={ctx} />
              {META[ctx].label}
            </span>
          );
        }
        return (
          <Link
            key={ctx}
            href={META[ctx].href}
            className={`${base} text-[#6B7280] hover:bg-gray-100 hover:text-[#1F2937]`}
          >
            <Icon ctx={ctx} />
            {META[ctx].label}
          </Link>
        );
      })}
    </div>
  );
}
