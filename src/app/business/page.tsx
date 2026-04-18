"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import BusinessHeader from "./BusinessHeader";

interface CompanyRow {
  id: string;
  name: string;
  role: "primary" | "co-admin";
  created_at: string;
}

export default function BusinessIndexPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/business/login");
        return;
      }
      // Primary contact
      const { data: primary } = await supabase
        .from("companies")
        .select("id, name, created_at")
        .eq("contact_person_id", user.id);

      // Co-admin companies
      const { data: coAdminRows } = await supabase
        .from("company_admins")
        .select("company_id, added_at, companies:company_id(id, name, created_at)")
        .eq("user_id", user.id);

      const list: CompanyRow[] = [];
      for (const c of primary || []) {
        list.push({ id: c.id, name: c.name, role: "primary", created_at: c.created_at });
      }
      for (const row of coAdminRows || []) {
        const raw = (row as { companies?: unknown }).companies;
        const c = Array.isArray(raw) ? raw[0] : raw;
        if (c && typeof c === "object" && "id" in c) {
          const company = c as { id: string; name: string; created_at: string };
          if (!list.find((x) => x.id === company.id)) {
            list.push({ id: company.id, name: company.name, role: "co-admin", created_at: company.created_at });
          }
        }
      }
      list.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
      setCompanies(list);

      // If exactly one company, jump straight to it
      if (list.length === 1) {
        router.replace(`/business/${list[0].id}`);
        return;
      }
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        {t("b2b.index.loading", "Loading…")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <BusinessHeader
        crumbs={[{ label: t("b2b.index.title", "Your companies") }]}
      />

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t("b2b.index.title", "Your companies")}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {t("b2b.index.subtitle", "Pick a company to manage its roster, or create a new one.")}
            </p>
          </div>
          <Link href="/business/signup" className="btn-primary text-sm">
            {t("b2b.index.create_new", "+ New company")}
          </Link>
        </div>

        {companies.length === 0 ? (
          <section className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <p className="text-gray-600 mb-5">
              {t("b2b.index.empty", "You haven't set up a company yet.")}
            </p>
            <Link href="/business/signup" className="btn-primary">
              {t("b2b.index.get_started", "Create your first company")}
            </Link>
          </section>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {companies.map((c) => (
              <Link
                key={c.id}
                href={`/business/${c.id}`}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-transparent hover:border-blue-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold tracking-wider uppercase text-gray-400">
                    {c.role === "primary"
                      ? t("b2b.index.role.primary", "Primary admin")
                      : t("b2b.index.role.co_admin", "Co-admin")}
                  </span>
                </div>
                <h3 className="font-semibold text-lg text-gray-900">{c.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {t("b2b.index.created", "Created")} {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </Link>
            ))}
          </section>
        )}
      </main>

      <style jsx global>{`
        .btn-primary {
          display: inline-block;
          background: linear-gradient(135deg,#3b82f6,#10b981);
          color: white;
          padding: 0.625rem 1.125rem;
          border-radius: 0.625rem;
          font-weight: 600;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
