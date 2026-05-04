"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// MFA gate: enrollment + challenge. /admin/layout redirects here
// when an admin user either has no verified TOTP factor yet or has
// a factor but hasn't stepped up the session to AAL2 this visit.

function MfaPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get("mode") || "challenge") as "enroll" | "challenge";

  const [mode, setMode] = useState<"enroll" | "challenge" | "done">(initialMode);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Figure out current factor state on mount so we recover from refresh.
  useEffect(() => {
    (async () => {
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verified = factors?.totp.find((f) => f.status === "verified");
        if (verified) {
          setFactorId(verified.id);
          setMode("challenge");
          return;
        }
        // Clean up any abandoned unverified factor from a half-completed
        // enroll (otherwise Supabase returns
        // "friendly name already in use").
        for (const f of factors?.totp || []) {
          if (f.status !== "verified") {
            try { await supabase.auth.mfa.unenroll({ factorId: f.id }); } catch { /* ignore */ }
          }
        }
        if (initialMode === "enroll") startEnroll();
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [initialMode]);

  const startEnroll = async () => {
    setErr(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Lifeline Admin ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!factorId) return;
    if (busy || code.length !== 6) return;
    setErr(null);
    setBusy(true);
    try {
      // Enroll path finalises by verifying the code against the factor.
      // Challenge path creates a fresh challenge then verifies.
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) throw verify.error;
      setMode("done");
      setTimeout(() => router.replace("/admin"), 500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-8">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 mb-1">Secure admin access</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Two-factor authentication</h1>
        <p className="text-sm text-gray-600 mb-5">
          {mode === "enroll"
            ? "Set up an authenticator app. We'll ask for a 6-digit code every time you sign in. This protects patient data if your password ever leaks."
            : mode === "challenge"
              ? "Enter the 6-digit code from your authenticator app."
              : "All set."}
        </p>

        {mode === "enroll" && !qrCode && (
          <button
            onClick={startEnroll}
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 text-white font-semibold text-sm disabled:opacity-50"
          >
            {busy ? "Loading…" : "Start enrollment"}
          </button>
        )}

        {mode === "enroll" && qrCode && (
          <form onSubmit={verify} className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col items-center">
              <p className="text-xs text-gray-600 mb-2">Scan this QR in Google Authenticator, Authy, or 1Password.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="TOTP QR code" className="w-48 h-48" />
              {secret && (
                <div className="mt-3 text-[11px] text-gray-500 text-center">
                  Or type this secret manually:
                  <div className="font-mono text-gray-800 mt-0.5 select-all break-all">{secret}</div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Verify with the 6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-base font-mono tracking-[0.4em] text-center focus:ring-2 focus:ring-emerald-200 outline-none"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full py-2.5 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 text-white font-semibold text-sm disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify & finish"}
            </button>
          </form>
        )}

        {mode === "challenge" && (
          <form onSubmit={verify} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-base font-mono tracking-[0.4em] text-center focus:ring-2 focus:ring-emerald-200 outline-none"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full py-2.5 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500 text-white font-semibold text-sm disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => { supabase.auth.signOut(); router.replace("/admin/login"); }}
              className="w-full py-2 text-xs text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </form>
        )}

        {mode === "done" && (
          <div className="text-center py-6 text-emerald-700 text-sm font-medium">
            ✓ MFA verified. Redirecting…
          </div>
        )}

        {err && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{err}</div>
        )}
      </div>
    </div>
  );
}

export default function MfaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <MfaPageInner />
    </Suspense>
  );
}
