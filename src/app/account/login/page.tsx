"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LifelineLogo from "@/app/components/LifelineLogo";

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
  const [mode, setMode] = useState<"login" | "signup">(refCode ? "signup" : "login");
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

  const TERMS_VERSION = "1.2";

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
      // First-time login — if the client has never seen the welcome page, send them there.
      if (signInData?.user?.id) {
        const { data: profile } = await supabase
          .from("clients")
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
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
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
          const { error: insertErr } = await supabase.from('clients').insert({
            id: signUpData.user.id,
            ...clientFields,
          });
          // Handle re-created account (same email, new auth ID)
          if (insertErr?.code === '23505') {
            const { data: old } = await supabase.from('clients').select('id').eq('email', email).single();
            if (old && old.id !== signUpData.user.id) {
              await supabase.from('subscriptions').delete().eq('client_id', old.id);
              await supabase.from('clients').delete().eq('id', old.id);
              await supabase.from('clients').insert({
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
      setPassword("");
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white via-[#f0f3f6] to-[#ecf0f3] px-4 py-16">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <LifelineLogo size="lg" />
          </Link>
          <p className="mt-2 text-[#6B7280] text-sm">
            {mode === "login"
              ? "Sign in to your account"
              : "Create your account"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Toggle tabs */}
          <div className="flex mb-6 bg-[#ecf0f3] rounded-full p-1">
            <button
              onClick={() => {
                setMode("login");
                setError("");
                setInfo("");
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                mode === "login"
                  ? "bg-white text-[#1F2937] shadow-sm"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setError("");
                setInfo("");
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                mode === "signup"
                  ? "bg-white text-[#1F2937] shadow-sm"
                  : "text-[#6B7280] hover:text-[#1F2937]"
              }`}
            >
              Create Account
            </button>
          </div>

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

            {mode === "signup" && (
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
                    I accept the Lifeline Health{" "}
                    <Link href="/terms" className="text-[#10B981] underline" target="_blank">Terms of Service</Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-[#10B981] underline" target="_blank">Privacy Policy</Link>
                    <span className="text-gray-400"> (v{TERMS_VERSION})</span>.
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
                    <strong>Opt out of research use.</strong>{" "}
                    Don&apos;t use my anonymised data to improve Lifeline or for clinical research.
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
                    <strong>Opt out of marketing emails.</strong>{" "}
                    Don&apos;t send me product news or promotions.
                  </span>
                </label>
              </div>
            )}

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
              disabled={loading || (mode === "signup" && !acceptTerms)}
              className="w-full bg-[#10B981] hover:bg-[#047857] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          {mode === "login" && (
            <button
              onClick={handleForgotPassword}
              className="block w-full text-center text-sm text-[#6B7280] hover:text-[#10B981] mt-4 transition-colors"
            >
              Forgot your password?
            </button>
          )}
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
