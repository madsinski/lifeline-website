"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import BusinessHeader from "../BusinessHeader";

export default function BusinessLoginPage() {
  return (
    <Suspense>
      <BusinessLoginInner />
    </Suspense>
  );
}

function BusinessLoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/business";
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(next.startsWith("/") ? next : "/business");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
      <BusinessHeader
        crumbs={[{ label: t("b2b.login.crumb", "Contact person sign in") }]}
        minimal
      />

      <main className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-semibold mb-2">
            {t("b2b.login.title", "Contact person sign in")}
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            {t("b2b.login.subtitle", "Manage your company's roster and invitations.")}
          </p>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">
                {t("b2b.login.email", "Email")}
              </span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">
                {t("b2b.login.password", "Password")}
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </label>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? t("b2b.login.signing_in", "Signing in…") : t("b2b.login.submit", "Sign in")}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-600 mb-2">
              {t("b2b.login.no_company", "Not set up yet?")}
            </p>
            <Link href="/business/signup" className="text-sm text-blue-600 hover:underline">
              {t("b2b.login.create_company", "Create your company →")}
            </Link>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .input { width:100%; padding:0.625rem 0.875rem; border:1px solid #e5e7eb; border-radius:0.5rem; outline:none; }
        .input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
        .btn-primary { background:linear-gradient(135deg,#3b82f6,#10b981); color:white; padding:0.75rem 1rem; border-radius:0.75rem; font-weight:600; }
        .btn-primary:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>
    </div>
  );
}
