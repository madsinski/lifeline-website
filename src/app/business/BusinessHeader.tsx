"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BackButton from "@/app/components/BackButton";
import { LanguagePicker, useI18n } from "@/lib/i18n";

interface SwitcherCompany {
  id: string;
  name: string;
}

interface Props {
  // Breadcrumb pieces — left to right
  crumbs?: Array<{ label: string; href?: string }>;
  // If provided, render a company switcher (shows current company with
  // dropdown of other companies the user manages).
  currentCompanyId?: string | null;
  // Hide the user-related controls on unauthed pages (login, signup).
  minimal?: boolean;
}

export default function BusinessHeader({ crumbs = [], currentCompanyId, minimal }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<SwitcherCompany[]>([]);

  useEffect(() => {
    if (minimal) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || null);
      if (currentCompanyId) {
        // Load every company this user manages, so the switcher can expose them
        const [{ data: primary }, { data: coAdminRows }] = await Promise.all([
          supabase.from("companies").select("id, name").eq("contact_person_id", user.id),
          supabase
            .from("company_admins")
            .select("companies:company_id(id, name)")
            .eq("user_id", user.id),
        ]);
        const list: SwitcherCompany[] = [];
        for (const c of (primary || []) as SwitcherCompany[]) list.push(c);
        for (const row of coAdminRows || []) {
          const raw = (row as { companies?: unknown }).companies;
          const c = Array.isArray(raw) ? raw[0] : raw;
          if (c && typeof c === "object" && "id" in c) {
            const company = c as SwitcherCompany;
            if (!list.find((x) => x.id === company.id)) list.push(company);
          }
        }
        setCompanies(list);
      }
    })();
  }, [minimal, currentCompanyId]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/business/login");
  };

  return (
    <header className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white/70 backdrop-blur">
      <div className="flex items-center gap-3">
        <BackButton fallback="/business" />
        <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-100 text-blue-800">
          {t("b2b.header.label", "For business")}
        </span>
        {crumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-sm text-gray-500 min-w-0">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <span className="text-gray-300">›</span>}
                {c.href ? (
                  <Link href={c.href} className="hover:text-gray-800 truncate">{c.label}</Link>
                ) : (
                  <span className="font-medium text-gray-900 truncate">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {currentCompanyId && companies.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="ml-2 text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1"
            >
              {t("b2b.header.switch", "Switch company")}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {open && (
              <div className="absolute left-0 top-7 z-50 w-60 bg-white border border-gray-200 rounded-xl shadow-lg py-2">
                {companies.map((c) => (
                  <Link
                    key={c.id}
                    href={`/business/${c.id}`}
                    className={`block px-4 py-2 text-sm hover:bg-gray-50 ${c.id === currentCompanyId ? "font-semibold text-blue-700" : "text-gray-700"}`}
                    onClick={() => setOpen(false)}
                  >
                    {c.name} {c.id === currentCompanyId && "✓"}
                  </Link>
                ))}
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <Link href="/business" className="block px-4 py-2 text-xs text-gray-500 hover:bg-gray-50" onClick={() => setOpen(false)}>
                    {t("b2b.header.all_companies", "All companies →")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {!minimal && email && (
          <span className="hidden md:inline text-sm text-gray-500">{email}</span>
        )}
        <LanguagePicker />
        {!minimal && email && (
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t("b2b.header.signout", "Sign out")}
          </button>
        )}
      </div>
    </header>
  );
}
