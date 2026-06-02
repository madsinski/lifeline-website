"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// Web verify handler for the B2B email-confirmation link.
//
// We email a link to THIS route (carrying the magic-link `token_hash` from
// supabaseAdmin.generateLink) rather than Supabase's raw action_link. The raw
// action_link relies on the PKCE code-verifier flow, but the verifier is never
// stored in the recipient's browser (the link is generated server-side), so
// landing it straight on /business/signup leaves the user without a session
// and bounces them to the login page. verifyOtp({ token_hash, type }) sets the
// session in cookies here, so the user arrives at onboarding already signed in.
export default function BusinessConfirmPage() {
  return (
    <Suspense>
      <BusinessConfirmInner />
    </Suspense>
  );
}

function BusinessConfirmInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "error">("verifying");

  useEffect(() => {
    (async () => {
      const tokenHash = search.get("token_hash");
      const type = (search.get("type") || "magiclink") as EmailOtpType;
      // Only allow same-origin relative paths as the post-confirm destination.
      const nextParam = search.get("next") || "/business/signup";
      const next = nextParam.startsWith("/") ? nextParam : "/business/signup";

      if (!tokenHash) {
        setStatus("error");
        return;
      }

      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        console.error("[b2b confirm] verifyOtp failed", error.message);
        setStatus("error");
        return;
      }
      // Session is now established in cookies; continue into onboarding.
      router.replace(next);
    })();
  }, [router, search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white via-[#eff4fa] to-[#e2ebf5] px-4">
      <div className="max-w-md w-full text-center">
        {status === "verifying" ? (
          <div className="bg-white rounded-2xl shadow-sm p-10">
            <div className="animate-spin w-10 h-10 border-4 border-[#10B981] border-t-transparent rounded-full mx-auto mb-5" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Confirming your email&hellip;</h1>
            <p className="text-gray-500 text-sm">Just a moment &mdash; we&apos;re signing you in.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-10">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirmation link expired</h1>
            <p className="text-gray-500 text-sm mb-6">
              This link may have already been used or expired. Request a new confirmation email, or sign in if your
              account is already verified.
            </p>
            <Link
              href="/business/login?mode=login&next=/business/signup"
              className="inline-block bg-gradient-to-r from-[#3B82F6] to-[#10B981] hover:opacity-95 text-white font-semibold rounded-full px-8 py-3 transition-opacity text-sm"
            >
              Go to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
