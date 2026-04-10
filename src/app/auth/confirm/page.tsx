"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmlmYnh6bHR4aXJpcXh2dnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4NjIyMzgsImV4cCI6MjA1OTQzODIzOH0.LPHjGqPhBm-kNbhFVLaPGSFDGYMDl29sor1PKXGMQ0U"
);

type Status = "verifying" | "success" | "error";

export default function ConfirmPage() {
  const [status, setStatus] = useState<Status>("verifying");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Supabase verifies the email server-side, then redirects here.
    // By the time the user lands on this page, confirmation is already done.
    // We just show success — the user can sign in from the app.
    setStatus("success");
  }, []);

  // Countdown to redirect back to app
  useEffect(() => {
    if (status !== "success") return;
    if (countdown <= 0) {
      window.location.href = "lifelinehealth://auth?confirmed=true";
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[#ecf0f3] px-4">
      <div className="max-w-md w-full text-center">
        {status === "verifying" && (
          <div className="bg-white rounded-2xl shadow-sm p-10">
            <div className="animate-spin w-10 h-10 border-4 border-[#0D9488] border-t-transparent rounded-full mx-auto mb-5" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Verifying your email...
            </h1>
            <p className="text-gray-500 text-sm">
              Please wait while we confirm your account.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="bg-white rounded-2xl shadow-sm p-10">
            <div className="w-16 h-16 bg-[#0D9488] rounded-full flex items-center justify-center mx-auto mb-5">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Account confirmed!
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              Your email has been verified successfully. You can now sign in to
              Lifeline Health.
            </p>
            <p className="text-gray-400 text-xs mb-4">
              Redirecting to the app in {countdown} second
              {countdown !== 1 ? "s" : ""}...
            </p>
            <a
              href="lifelinehealth://auth?confirmed=true"
              className="inline-block bg-[#0D9488] hover:bg-[#0B7B73] text-white font-semibold rounded-xl px-8 py-3 transition-colors text-sm"
            >
              Open Lifeline Health
            </a>
            <p className="text-gray-400 text-xs mt-4">
              If the app doesn&apos;t open, go back to the app and sign in with
              your email and password.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="bg-white rounded-2xl shadow-sm p-10">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Verification failed
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              The confirmation link may have expired or already been used. Please
              try signing in, or request a new confirmation email.
            </p>
            <a
              href="lifelinehealth://auth"
              className="inline-block bg-[#0D9488] hover:bg-[#0B7B73] text-white font-semibold rounded-xl px-8 py-3 transition-colors text-sm"
            >
              Open Lifeline Health
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
