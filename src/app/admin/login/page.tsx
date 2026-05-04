"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Invite-link state. Supabase invite emails redirect here with a
  // session in the URL hash (#access_token=…&type=invite). The JS
  // client picks that up automatically, but the page would still
  // render a useless "sign in" form because the user has no password
  // yet. Detect the just-arrived session and either (a) prompt them
  // to set a password if it's an invite/recovery, or (b) bounce to
  // /admin so the layout can route them by role (lawyer →
  // /admin/legal/drafts).
  const [setupMode, setSetupMode] = useState<null | "invite" | "recovery" | "signed-in">(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Inspect URL hash BEFORE Supabase strips it (it can race with the
      // session check below, so we read the hash synchronously).
      let hashType: string | null = null;
      if (typeof window !== "undefined" && window.location.hash) {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        hashType = params.get("type");
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) return;
      if (hashType === "invite" || hashType === "recovery") {
        setSetupMode(hashType as "invite" | "recovery");
      } else {
        // Already signed in — let the admin layout do role-based routing.
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
    // Strip the invite hash so reloads don't re-trigger setup mode.
    if (typeof window !== "undefined") history.replaceState(null, "", window.location.pathname);
    router.replace("/admin");
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

        {/* Card */}
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
                placeholder="Enter your password"
              />
            </div>

            {error && (
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
