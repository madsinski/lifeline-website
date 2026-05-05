"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LifelineLogo from "@/app/components/LifelineLogo";
import LoginAudienceTabs from "@/app/components/LoginAudienceTabs";
import {
  PUBLIC_PRIVACY_VERSION,
  PUBLIC_TERMS_VERSION,
  renderPublicPrivacyPolicy,
  renderPublicTermsOfService,
} from "@/lib/public-pages-content";

export default function AccountLoginPage() {
  return (
    <Suspense>
      <AccountLoginContent />
    </Suspense>
  );
}

function AccountLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") || "";
  const nextPath = searchParams.get("next") || "";
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(refCode ? "signup" : initialMode);
  // Two-stage signup: collect name/email/password first, then take the
  // user to a dedicated review page where they read + accept the TOS
  // and Privacy Policy before the account is actually created.
  const [signupStage, setSignupStage] = useState<"form" | "terms">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [researchOptOut, setResearchOptOut] = useState(false);
  const [marketingOptOut, setMarketingOptOut] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // Versioned together — when either text changes bump both. The
  // public renderers (renderPublicTermsOfService /
  // renderPublicPrivacyPolicy) are the legally binding text the user
  // accepts here; we record the TOS version on the clients row.
  const TERMS_VERSION = `tos-${PUBLIC_TERMS_VERSION}+priv-${PUBLIC_PRIVACY_VERSION}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (mode === "login") {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      // First-time login — route based on B2B vs B2C and onboarding state:
      //   • Anyone (B2B or B2C) without welcome_seen_at → /account/welcome
      //     (the slideshow). Body composition + health consent are
      //     collected later when the user activates Biody, not as a
      //     gate to the dashboard.
      //   • Everyone else → /account or the next path.
      if (signInData?.user?.id) {
        const { data: profile } = await supabase
          .from("clients_decrypted")
          .select("welcome_seen_at")
          .eq("id", signInData.user.id)
          .maybeSingle();
        if (profile && !profile.welcome_seen_at) {
          router.push("/account/welcome");
          return;
        }
      }
      router.push(nextPath && nextPath.startsWith("/") ? nextPath : "/account");
    } else {
      // Stage 1 (form) → just validate + advance to the TOS+Privacy
      // review page. The actual account creation happens after the
      // user reads + accepts the legal documents on stage 2.
      if (signupStage === "form") {
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
          setError("Please fill in name, email and password.");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters.");
          setLoading(false);
          return;
        }
        setSignupStage("terms");
        setError("");
        setLoading(false);
        return;
      }
      // Stage 2 (terms) — actually create the account.
      if (!acceptTerms) {
        setError("Please accept the Terms of Service and Privacy Policy to continue.");
        setLoading(false);
        return;
      }
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const now = new Date().toISOString();
      const clientFields = {
        email,
        full_name: fullName || email.split('@')[0],
        phone: phone.trim() || null,
        terms_accepted_at: now,
        terms_version: TERMS_VERSION,
        research_opt_out: researchOptOut,
        marketing_opt_out: marketingOptOut,
        created_at: now,
      };
      // Redirect confirmed users into the welcome slideshow. The slideshow
      // is the new "intro presentation" — it replaces the in-person/online
      // PPT walkthrough. Body composition + health consent are collected
      // later when the user actually activates Biody, not as a gate to
      // the dashboard. /account and /account/welcome are whitelisted in
      // middleware.ts so they bypass the coming-soon gate.
      const origin = typeof window !== "undefined" ? window.location.origin : "https://www.lifelinehealth.is";
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/account/welcome`,
          data: {
            full_name: fullName,
            ...(refCode ? { referred_by: refCode } : {}),
          },
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      // Create client profile and free subscription
      if (signUpData?.user) {
        try {
          const { error: insertErr } = await supabase.from("clients_decrypted").insert({
            id: signUpData.user.id,
            ...clientFields,
          });
          // Handle re-created account (same email, new auth ID)
          if (insertErr?.code === '23505') {
            const { data: old } = await supabase.from("clients_decrypted").select('id').eq('email', email).single();
            if (old && old.id !== signUpData.user.id) {
              await supabase.from('subscriptions').delete().eq('client_id', old.id);
              await supabase.from("clients_decrypted").delete().eq('id', old.id);
              await supabase.from("clients_decrypted").insert({
                id: signUpData.user.id,
                ...clientFields,
              });
            }
          }
          await supabase.from('subscriptions').insert({
            client_id: signUpData.user.id,
            tier: 'free-trial',
            status: 'active',
            current_period_start: now,
            current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          });
        } catch {}
      }
      setInfo(
        "Account created! Check your email to confirm, then sign in."
      );
      setMode("login");
      setSignupStage("form");
      setPassword("");
      setAcceptTerms(false);
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    setError("");
    setInfo("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/account` }
    );
    if (resetError) {
      setError(resetError.message);
    } else {
      setInfo("Password reset link sent to your email.");
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
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-100 bg-emerald-50 text-emerald-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wide">Personal account</span>
          </div>
          <p className="mt-3 text-[#6B7280] text-sm max-w-sm mx-auto">
            {mode === "login"
              ? "Sign in to your Lifeline account to view your health plan and progress."
              : "Create a Lifeline account to get a medical-grade health assessment and personal plan."}
          </p>
        </div>

        {/* Audience switch */}
        <LoginAudienceTabs active="personal" />

        {/* Card */}
        <div className="relative overflow-hidden bg-white rounded-2xl shadow-lg">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#3B82F6] to-[#10B981]" />

          {/* Inner tabs — match /business/login styling */}
          <div className="flex border-b border-gray-100 pt-2" role="tablist">
            {([
              { key: "login", label: "Sign in" },
              { key: "signup", label: "Create account" },
            ] as const).map((tab) => {
              const active = mode === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setMode(tab.key); setSignupStage("form"); setError(""); setInfo(""); }}
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
          {mode === "signup" && signupStage === "terms" ? (
            <TermsConsentStage
              firstName={firstName}
              email={email}
              acceptTerms={acceptTerms}
              setAcceptTerms={setAcceptTerms}
              researchOptOut={researchOptOut}
              setResearchOptOut={setResearchOptOut}
              marketingOptOut={marketingOptOut}
              setMarketingOptOut={setMarketingOptOut}
              loading={loading}
              error={error}
              info={info}
              onBack={() => { setSignupStage("form"); setError(""); }}
              onConfirm={handleSubmit}
            />
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label
                      htmlFor="firstName"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      First name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none transition-all text-gray-900"
                      placeholder="First name"
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      htmlFor="lastName"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Last name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none transition-all text-gray-900"
                      placeholder="Last name"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none transition-all text-gray-900"
                placeholder="you@example.com"
              />
            </div>

            {mode === "signup" && (
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none transition-all text-gray-900"
                  placeholder="Phone number"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none transition-all text-gray-900"
                placeholder={
                  mode === "signup"
                    ? "Choose a password (min 6 characters)"
                    : "Enter your password"
                }
                minLength={6}
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
              className="w-full bg-[#10B981] hover:bg-[#047857] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                  ? "Sign In"
                  : "Continue"}
            </button>
          </form>
          )}

          {mode === "login" && (
            <button
              onClick={handleForgotPassword}
              className="block w-full text-center text-sm text-[#6B7280] hover:text-[#10B981] mt-4 transition-colors"
            >
              Forgot your password?
            </button>
          )}
          </div>
        </div>

        <p className="text-center text-[#6B7280] text-xs mt-6">
          <Link href="/" className="hover:text-[#10B981] transition-colors">
            Back to Lifeline Health
          </Link>
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Stage 2 of signup: dedicated TOS + Privacy review page. The user
// arrives here after entering name/email/password on stage 1.
// They must read + accept before the account is created.

function TermsConsentStage({
  firstName, email, acceptTerms, setAcceptTerms,
  researchOptOut, setResearchOptOut,
  marketingOptOut, setMarketingOptOut,
  loading, error, info, onBack, onConfirm,
}: {
  firstName: string;
  email: string;
  acceptTerms: boolean;
  setAcceptTerms: (v: boolean) => void;
  researchOptOut: boolean;
  setResearchOptOut: (v: boolean) => void;
  marketingOptOut: boolean;
  setMarketingOptOut: (v: boolean) => void;
  loading: boolean;
  error: string;
  info: string;
  onBack: () => void;
  onConfirm: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onConfirm} className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#0F172A]">
          {firstName ? `Næstum þar, ${firstName}` : "Næstum þar"}
        </h2>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          Áður en aðgangurinn er stofnaður þarftu að lesa og samþykkja
          notkunarskilmála og persónuverndarstefnu Lifeline Health.
        </p>
        {email && (
          <p className="text-xs text-gray-400 mt-1">
            Aðgangurinn verður stofnaður á <span className="font-medium text-gray-600">{email}</span>.
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide mb-2">
          Notkunarskilmálar ({PUBLIC_TERMS_VERSION})
        </p>
        <pre className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-3 text-[11px] leading-relaxed text-gray-800 bg-gray-50/60 whitespace-pre-wrap font-sans">
{renderPublicTermsOfService("is")}
        </pre>
      </div>

      <div>
        <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide mb-2">
          Persónuverndarstefna ({PUBLIC_PRIVACY_VERSION})
        </p>
        <pre className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-3 text-[11px] leading-relaxed text-gray-800 bg-gray-50/60 whitespace-pre-wrap font-sans">
{renderPublicPrivacyPolicy("is")}
        </pre>
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-3">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            required
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#10B981] focus:ring-[#10B981]"
          />
          <span className="text-xs text-gray-700 leading-snug">
            Ég hef lesið og samþykki <strong>notkunarskilmála</strong> Lifeline Health (v{PUBLIC_TERMS_VERSION})
            og <strong>persónuverndarstefnu</strong> (v{PUBLIC_PRIVACY_VERSION}).
            <span className="text-red-500 ml-0.5">*</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={researchOptOut}
            onChange={(e) => setResearchOptOut(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#10B981] focus:ring-[#10B981]"
          />
          <span className="text-xs text-gray-700 leading-snug">
            <strong>Afþakka rannsóknanotkun.</strong>{" "}
            Ekki nota nafnlaus gögn mín til að bæta Lifeline eða í klíníska rannsókn.
          </span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={marketingOptOut}
            onChange={(e) => setMarketingOptOut(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#10B981] focus:ring-[#10B981]"
          />
          <span className="text-xs text-gray-700 leading-snug">
            <strong>Afþakka markaðspóst.</strong>{" "}
            Ekki senda mér vörufréttir eða kynningar frá Lifeline.
          </span>
        </label>
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

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          ← Til baka
        </button>
        <button
          type="submit"
          disabled={loading || !acceptTerms}
          className="flex-1 bg-[#10B981] hover:bg-[#047857] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Stofnar aðgang..." : "Samþykkja og stofna aðgang"}
        </button>
      </div>
    </form>
  );
}
