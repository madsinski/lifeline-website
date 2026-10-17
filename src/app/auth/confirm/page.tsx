"use client";

// Where Supabase lands an email confirmation that was started from the
// mobile app (its emailRedirectTo). Supabase has already verified the
// address server side by the time anyone sees this page.
//
// Nothing opens by itself. The page used to hand over to the app
// (lifelinehealth://) after a five-second countdown on any phone — which
// also fired for people who had signed up on the web and simply opened the
// mail on their phone, throwing them into an app they might not have, or
// into the store. Now: on a phone, „Opna appið“ is a button next to
// „Halda áfram á vefnum“; on a computer only the web way on is offered.
// The web way on is /account, where a new account chooses where to start.
//
// This page makes no Supabase call of its own: a ?code= on this URL belongs
// to the app's PKCE flow.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import AuthShell, { authPrimary, authSecondary } from "@/app/components/AuthShell";
import { useI18n } from "@/lib/i18n";

const APP_URL = "lifelinehealth://auth?confirmed=true";

export default function ConfirmPage() {
  const { t } = useI18n();
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AuthShell>
      <section className="text-center">
        <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-hc-brand-surface text-hc-brand-text">
          <Check className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-hc-ink">{t("auth.confirm.title", "Netfangið er staðfest")}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-hc-ink-2">
          {t("auth.confirm.body", "Aðgangurinn þinn er tilbúinn. Haltu áfram á vefnum eða opnaðu appið.")}
        </p>
        <div className="mt-6 space-y-2.5">
          <Link href="/account" className={authPrimary}>{t("auth.continue-web", "Halda áfram á vefnum")}</Link>
          {mobile && (
            <a href={APP_URL} className={authSecondary}>{t("auth.open-app", "Opna appið")}</a>
          )}
        </div>
      </section>
    </AuthShell>
  );
}
