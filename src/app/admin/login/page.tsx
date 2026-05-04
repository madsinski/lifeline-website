"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Three flows live on this page:
//
// 1. Normal sign-in: email + password → /admin (then admin layout
//    routes by role).
//
// 2. Forgot-password request: user clicks the link below the form,
//    enters their email, we call resetPasswordForEmail() which sends
//    an email with a recovery link back to this same page.
//
// 3. Recovery / invite landing: the user clicks the link in the
//    email and lands here with either:
//      - URL hash:  #access_token=...&type=recovery|invite      (legacy implicit flow)
//      - URL query: ?token_hash=...&type=recovery|invite        (newer PKCE flow)
//    We detect either one, establish the session (verifyOtp for the
//    PKCE form; the JS client auto-handles the hash form), and then
//    show the "Set your password" card. After save we strip the URL
//    so a refresh doesn't re-trigger the flow.

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Setup-password card state (recovery / invite landing).
  const [setupMode, setSetupMode] = useState<null | "invite" | "recovery">(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Forgot-password request state.
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Read URL synchronously before Supabase strips it. We support
      // both the legacy hash flow and the PKCE query-string flow.
      let detected: "invite" | "recovery" | null = null;
      let queryTokenHash: string | null = null;

      if (typeof window !== "undefined") {
        if (window.location.hash) {
          const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const t = params.get("type");
          if (t === "invite" || t === "recovery") detected = t;
        }
        if (!detected && window.location.search) {
          const qs = new URLSearchParams(window.location.search);
          const t = qs.get("type");
          if (t === "invite" || t === "recovery") {
            detected = t;
            queryTokenHash = qs.get("token_hash");
          }
        }
      }

      // PKCE branch: we have a token_hash, exchange it for a session.
      if (detected && queryTokenHash) {
        const { error: otpErr } = await supabase.auth.verifyOtp({
          token_hash: queryTokenHash,
          type: detected,
        });
        if (cancelled) return;
        if (otpErr) {
          setError(`Recovery link invalid or expired: ${otpErr.message}`);
          return;
        }
        setSetupMode(detected);
        return;
      }

      // Hash branch: the JS client has already established the session
      // from the URL fragment. Just check we have one.
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) return;
      if (detected) {
        setSetupMode(detected);
      } else {
        // Already signed in by some other means (open in another tab,
        // refreshed after sign-in) — let the admin layout route by role.
        router.replace("/admin");
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push("/admin");
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    setSavingPassword(true);
    const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
    if (updErr) {
      setError(updErr.message);
      setSavingPassword(false);
      return;
    }
    // Strip token + hash so a refresh doesn't re-trigger the flow and
    // so the URL bar looks clean.
    if (typeof window !== "undefined") history.replaceState(null, "", window.location.pathname);
    router.replace("/admin");
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    if (!forgotEmail.trim()) {
      setForgotMsg({ type: "err", text: "Enter the email you sign in with." });
      return;
    }
    setForgotSending(true);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/admin/login` },
    );
    setForgotSending(false);
    if (resetErr) {
      setForgotMsg({ type: "err", text: resetErr.message });
      return;
    }
    // We deliberately do NOT confirm the email exists — that would
    // leak which addresses are valid admin accounts. Generic success.
    setForgotMsg({
      type: "ok",
      text: "If that email is registered, a recovery link is on its way. Check your inbox (and spam) — the link expires in an hour.",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1F2937] px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Lifeline <span className="text-[#10B981]">Admin</span>
          </h1>
          <p className="mt-2 text-gray-400 text-sm">
            Sign in to manage your platform
          </p>
        </div>

        {/* Setup-password card (invite / recovery flow) */}
        {setupMode && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {setupMode === "invite" ? "Welcome — set your password" : "Reset your password"}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              {setupMode === "invite"
                ? "You've accepted your invitation. Choose a password to finish creating your account."
                : "Choose a new password to continue."}
            </p>
            <form onSubmit={handleSetPassword} className="space-y-5">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  minLength={12}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none transition-all text-gray-900"
                  placeholder="At least 12 characters"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={savingPassword}
                className="w-full bg-[#10B981] hover:bg-[#047857] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPassword ? "Saving..." : "Save password & continue"}
              </button>
            </form>
          </div>
        )}

        {/* Forgot-password request card */}
        {forgotOpen && !setupMode && (
          <div className="bg-white rounded-xl shadow-lg p-8 mb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Reset your password</h2>
                <p className="text-sm text-gray-500 mb-5">
                  Enter your admin email — we&apos;ll send a recovery link that lands here so you can set a new password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setForgotOpen(false); setForgotMsg(null); }}
                className="text-gray-400 hover:text-gray-600 text-sm"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="forgotEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="forgotEmail"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none transition-all text-gray-900"
                  placeholder="admin@lifeline.is"
                />
              </div>
              {forgotMsg && (
                <div className={`px-4 py-3 rounded-lg text-sm ${
                  forgotMsg.type === "ok"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}>
                  {forgotMsg.text}
                </div>
              )}
              <button
                type="submit"
                disabled={forgotSending}
                className="w-full bg-[#10B981] hover:bg-[#047857] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {forgotSending ? "Sending..." : "Send recovery email"}
              </button>
            </form>
          </div>
        )}

        {/* Sign-in card */}
        <div className={`bg-white rounded-xl shadow-lg p-8 ${setupMode ? "opacity-60" : ""}`}>
          <form onSubmit={handleSubmit} className="space-y-5">
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
                placeholder="admin@lifeline.is"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setForgotOpen(true); setForgotEmail(email); setForgotMsg(null); }}
                  className="text-xs text-[#10B981] hover:text-[#047857] font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none transition-all text-gray-900"
                placeholder="Enter your password"
              />
            </div>

            {error && !setupMode && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#10B981] hover:bg-[#047857] text-white font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          Lifeline Health &mdash; Admin Portal
        </p>
      </div>
    </div>
  );
}
