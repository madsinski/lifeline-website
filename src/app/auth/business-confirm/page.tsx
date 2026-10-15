"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Loader2, X } from "lucide-react";
import AuthShell, { authPrimary } from "@/app/components/AuthShell";

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
      const next = nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\")
        ? nextParam : "/business/signup";

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
    <AuthShell>
      {status === "verifying" ? (
        <section className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-hc-brand-text" aria-hidden />
          <h1 className="mt-4 text-xl font-bold text-hc-ink">Staðfesti netfangið…</h1>
          <p className="mt-1 text-sm text-hc-ink-2">Augnablik — við skráum þig inn.</p>
        </section>
      ) : (
        <section className="text-center">
          <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-hc-bad-surface text-hc-bad-ink">
            <X className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-hc-ink">Hlekkurinn er útrunninn</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-hc-ink-2">
            Hlekkurinn hefur annaðhvort verið notaður eða er útrunninn. Biddu um nýjan staðfestingarpóst,
            eða skráðu þig inn ef netfangið er þegar staðfest.
          </p>
          <Link href="/business/login?mode=login&next=/business/signup" className={`mt-6 ${authPrimary}`}>
            Fara í innskráningu
          </Link>
        </section>
      )}
    </AuthShell>
  );
}
