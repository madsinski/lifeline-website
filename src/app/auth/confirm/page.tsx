"use client";

// Where Supabase lands an email confirmation that was started from the
// mobile app (its emailRedirectTo). Supabase has already verified the
// address server side by the time anyone sees this page.
//
// On a phone it still hands over to the app (lifelinehealth://), as before.
// But people open mail on a computer too, and a countdown to a URL scheme a
// desktop browser cannot open stranded them on an English "Account
// confirmed!" with nowhere to go. So: on a phone, the deep link (automatic,
// with a button); everywhere, a way on to the web app.
//
// This page makes no Supabase call of its own: a ?code= on this URL belongs
// to the app's PKCE flow.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import AuthShell, { authPrimary, authSecondary } from "@/app/components/AuthShell";

const APP_URL = "lifelinehealth://auth?confirmed=true";

export default function ConfirmPage() {
  const [mobile, setMobile] = useState<boolean | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = setTimeout(() => setMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)), 0);
    return () => clearTimeout(t);
  }, []);

  // On a phone, hand over to the app after a short countdown.
  useEffect(() => {
    if (!mobile) return;
    if (countdown <= 0) { window.location.href = APP_URL; return; }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [mobile, countdown]);

  return (
    <AuthShell>
      <section className="text-center">
        <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-hc-brand-surface text-hc-brand-text">
          <Check className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-hc-ink">Netfangið er staðfest</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-hc-ink-2">
          Aðgangurinn þinn er tilbúinn. Haltu áfram í appinu eða á vefnum.
        </p>
        {mobile && countdown > 0 && (
          <p className="mt-3 text-xs text-hc-ink-3">Opna appið eftir {countdown} s…</p>
        )}
        <div className="mt-6 space-y-2.5">
          {mobile !== false && (
            <a href={APP_URL} className={authPrimary}>Opna appið</a>
          )}
          <Link href="/app" className={mobile === false ? authPrimary : authSecondary}>Halda áfram á vefnum</Link>
        </div>
      </section>
    </AuthShell>
  );
}
