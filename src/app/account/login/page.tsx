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
  const [mode, setMode] = useState<"login" | "signup">(refCode ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      router.push("/account");
    } else {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
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
            email,
            full_name: fullName || email.split('@')[0],
            phone: phone.trim() || null,
            created_at: new Date().toISOString(),
          });
          // Handle re-created account (same email, new auth ID)
          if (insertErr?.code === '23505') {
            const { data: old } = await supabase.from('clients').select('id').eq('email', email).single();
            if (old && old.id !== signUpData.user.id) {
              await supabase.from('subscriptions').delete().eq('client_id', old.id);
              await supabase.from('clients').delete().eq('id', old.id);
              await supabase.from('clients').insert({
                id: signUpData.user.id,
                email,
                full_name: fullName || email.split('@')[0],
                phone: phone.trim() || null,
                created_at: new Date().toISOString(),
              });
            }
          }
          await supabase.from('subscriptions').insert({
            client_id: signUpData.user.id,
            tier: 'free-trial',
            status: 'active',
            current_period_start: new Date().toISOString(),
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
            <LifelineLogo size="sm" showHealth />
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
