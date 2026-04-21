"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import LifelineLogo from "@/app/components/LifelineLogo";
import LoginAudienceTabs from "@/app/components/LoginAudienceTabs";

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
  const initialMode = search.get("mode") === "signup" ? "signup" : "login";
  const { t } = useI18n();

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
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

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/business/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const j = await res.json();
      if (res.status === 409 && j.error === "email_already_registered") {
        setError(t(
          "b2b.login.email_exists",
          "This email already has a Lifeline account. Switch to Log in and sign in with your existing password.",
        ));
        setMode("login");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(j.detail || j.error || "Signup failed");
      // Account created — sign in automatically and continue to signup flow
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
      router.push("/business/signup");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
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
            {t("b2b.login.tagline", "Sign in to your company's Lifeline Health workspace — manage the programme or complete your assessment.")}
          </p>
        </div>

        {/* Audience switch */}
        <LoginAudienceTabs active="business" />

        {/* Card */}
        <div className="relative overflow-hidden bg-white rounded-2xl shadow-lg">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] to-[#10B981]" />

          {/* Tab bar */}
          <div className="flex border-b border-gray-100 pt-2" role="tablist">
            {([
              { key: "login", label: t("b2b.login.tab.login", "Log in") },
              { key: "signup", label: t("b2b.login.tab.signup", "Create account") },
            ] as const).map((tab) => {
              const active = mode === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setMode(tab.key); setError(""); setInfo(""); }}
                  className={`flex-1 py-4 text-sm font-semibold transition-colors relative ${
                    active ? "text-[#1F2937]" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab.label}
                  {active && (
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-12 h-0.5 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#10B981]" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-8">
            <h1 className="text-xl font-semibold text-[#1F2937]">
              {mode === "login"
                ? t("b2b.login.title", "Company account log in")
                : t("b2b.signup.title", "Create a company account")}
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              {mode === "login"
                ? t("b2b.login.subtitle", "Access for managers and employees.")
                : t("b2b.signup.subtitle", "Start the 4-step setup for Lifeline Health at your workplace.")}
            </p>

            {mode === "login" ? (
              <>
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
              </>
            ) : (
              <form onSubmit={submitSignup} className="space-y-5 mt-6">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("b2b.signup.full_name", "Your full name")}
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    required
                    autoFocus
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
                    placeholder="Jón Jónsson"
                  />
                </div>
                <div>
                  <label htmlFor="signupEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("b2b.signup.email", "Work email")}
                  </label>
                  <input
                    id="signupEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
                    placeholder="you@company.is"
                  />
                </div>
                <div>
                  <label htmlFor="signupPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("b2b.signup.password", "Password")}
                  </label>
                  <input
                    id="signupPassword"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900"
                    placeholder={t("b2b.signup.password_placeholder", "At least 8 characters")}
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
                  {loading ? t("b2b.signup.creating", "Creating account…") : t("b2b.signup.submit", "Create account & continue →")}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  {t(
                    "b2b.signup.footer_note",
                    "Next steps: accept platform terms & DPA → create your company → invite your team.",
                  )}
                </p>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-[#6B7280] text-xs mt-6">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            {t("b2b.login.back_home", "Back to Lifeline Health")}
          </Link>
        </p>
      </div>
    </div>
  );
}
