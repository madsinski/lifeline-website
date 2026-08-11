"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ContextSwitcher from "../../components/ContextSwitcher";

// The business ACCOUNT (company list / management entry). Reached from the
// account pillbox dropdown, ContextSwitcher, and post-login/onboarding flows.
// The public "Companies" info page lives at /business.

interface CompanyRow {
  id: string;
  name: string;
  role: "primary" | "co-admin";
  created_at: string;
}

export default function BusinessAccountPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"checking" | "ready">("checking");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      // The business account requires a login.
      if (!user) { router.replace("/business/login?next=/business/account"); return; }
      const [{ data: primary }, { data: coAdminRows }] = await Promise.all([
        supabase.from("companies").select("id, name, created_at").eq("contact_person_id", user.id),
        supabase.from("company_admins").select("company_id, added_at, companies:company_id(id, name, created_at)").eq("user_id", user.id),
      ]);
      // A freshly-invited co-admin (no company of their own, hasn't finished
      // setting a password + details) is sent to complete their profile first.
      if ((coAdminRows?.length || 0) > 0 && (primary?.length || 0) === 0
          && user.user_metadata?.coadmin_setup_complete !== true) {
        router.replace("/business/co-admin-setup");
        return;
      }
      const list: CompanyRow[] = [];
      for (const c of primary || []) list.push({ id: c.id, name: c.name, role: "primary", created_at: c.created_at });
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
      // No company of their own: a regular employee (clients.company_id set) is
      // sent to their member dashboard; a brand-new signup sees "create your
      // first company" below.
      if (list.length === 0) {
        const { data: client } = await supabase
          .from("clients_decrypted")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();
        if (client?.company_id) {
          router.replace("/account");
          return;
        }
      }
      if (list.length === 1) { router.replace(`/business/${list[0].id}`); return; }
      setCompanies(list);
      setPhase("ready");
    })();
  }, [router]);

  if (phase === "checking") {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#ecf0f3]">
      <CompaniesPanel companies={companies} />
    </div>
  );
}

function CompaniesPanel({ companies }: { companies: CompanyRow[] }) {
  const hasCompanies = companies.length > 0;
  return (
    <section id="companies" className="bg-[#f8fafc]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[#10B981] mb-1">Your account</div>
            <h2 className="text-2xl font-bold text-[#0F172A]">{hasCompanies ? "Your companies" : "Set up your company"}</h2>
            <p className="text-sm text-[#475569] mt-1">
              {hasCompanies
                ? "Pick a company to manage, or add another."
                : "You’re signed in — create your first company to start onboarding your team."}
            </p>
          </div>
          <ContextSwitcher current="business" />
        </div>
        {hasCompanies ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((c) => (
                <Link
                  key={c.id}
                  href={`/business/${c.id}`}
                  className="group flex flex-col bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow border border-gray-100 hover:border-blue-200"
                >
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-gray-400">
                    {c.role === "primary" ? "Primary admin" : "Co-admin"}
                  </span>
                  <h3 className="font-semibold text-lg text-[#0F172A] mt-1 group-hover:text-[#10B981] transition-colors">{c.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Created {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#3B82F6]">
                    Manage
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  </span>
                </Link>
              ))}
              <Link
                href="/business/signup"
                className="group flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed border-gray-300 bg-white/60 p-5 min-h-[9rem] hover:border-[#10B981] hover:bg-emerald-50/40 transition-colors"
              >
                <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white flex items-center justify-center mb-2 shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </span>
                <span className="font-semibold text-[#0F172A]">Add another company</span>
                <span className="text-xs text-gray-500 mt-1">Set up a new company account</span>
              </Link>
            </div>
            <p className="mt-4 text-sm text-[#64748B]">
              Need a quote for a new programme?{" "}
              <Link href="/business#inquiry" className="font-semibold text-[#10B981] hover:underline">Request a proposal</Link>.
            </p>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Self-serve — create now */}
            <Link
              href="/business/signup"
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] to-[#10B981]" />
              <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#10B981] text-white flex items-center justify-center mb-3 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </span>
              <h3 className="font-semibold text-lg text-[#0F172A]">Create your first company</h3>
              <p className="text-sm text-[#475569] mt-1.5 leading-relaxed flex-1">Set it up and manage it yourself now — registering takes a couple of minutes.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#10B981]">
                Create company account
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </span>
            </Link>
            {/* Sales — request a proposal */}
            <Link
              href="/business#inquiry"
              className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="w-11 h-11 rounded-xl bg-blue-50 text-[#3B82F6] flex items-center justify-center mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </span>
              <h3 className="font-semibold text-lg text-[#0F172A]">Request a proposal</h3>
              <p className="text-sm text-[#475569] mt-1.5 leading-relaxed flex-1">Prefer a tailored quote? Tell us about your team and we’ll come back within 2 working days.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6]">
                Request a proposal
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
