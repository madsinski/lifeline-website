"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import LifelineLogo from "@/app/components/LifelineLogo";

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
  const [info, setInfo] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(next.startsWith("/") ? next : "/business");
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError(t("b2b.login.enter_email_first", "Enter your email address first."));
      return;
    }
    setError("");
    setInfo("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/business`,
    });
    if (resetError) {
      setError(resetError.message);
    } else {
      setInfo(t("b2b.login.reset_sent", "Password reset link sent to your email."));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white via-[#eff4fa] to-[#e2ebf5] px-4 py-16">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <LifelineLogo size="lg" />
          </Link>
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wide">
              {t("b2b.login.badge", "For companies")}
            </span>
          </div>
          <p className="mt-3 text-[#6B7280] text-sm max-w-sm mx-auto">
            {t("b2b.login.tagline", "Sign in to manage your company roster, measurement days, and billing.")}
          </p>
        </div>

        {/* Card */}
        <div className="relative overflow-hidden bg-white rounded-2xl shadow-lg">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] to-[#10B981]" />
          <div className="p-8">
            <h1 className="text-xl font-semibold text-[#1F2937]">
              {t("b2b.login.title", "Company account log in")}
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              {t("b2b.login.subtitle", "Manage your company's roster and invitations.")}
            </p>

            <form onSubmit={submit} className="space-y-5 mt-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  {t("b2b.login.email", "Email")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
                  placeholder="you@company.is"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  {t("b2b.login.password", "Password")}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
                  placeholder={t("b2b.login.password_placeholder", "Enter your password")}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {info && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                  {info}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[#3B82F6] to-[#10B981] hover:opacity-95 shadow-sm"
              >
                {loading ? t("b2b.login.signing_in", "Signing in…") : t("b2b.login.submit", "Sign in")}
              </button>
            </form>

            <button
              onClick={handleForgotPassword}
              className="block w-full text-center text-sm text-[#6B7280] hover:text-blue-600 mt-4 transition-colors"
            >
              {t("b2b.login.forgot", "Forgot your password?")}
            </button>

            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-sm text-[#6B7280] text-center">
                {t("b2b.login.no_company", "Not set up yet?")}{" "}
                <Link href="/business/signup" className="font-semibold text-blue-600 hover:text-blue-700">
                  {t("b2b.login.create_company", "Create your company →")}
                </Link>
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-[#6B7280] text-xs mt-6 space-x-3">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            {t("b2b.login.back_home", "Back to Lifeline Health")}
          </Link>
          <span className="text-[#C7CDD4]">·</span>
          <Link href="/account/login" className="hover:text-[#10B981] transition-colors">
            {t("b2b.login.personal_login", "Personal account sign in →")}
          </Link>
        </p>
      </div>
    </div>
  );
}
