"use client";

// OAuth return for the mobile app (Google sign-in started in the app).
// The ?code= / #access_token here belong to the app, so on a phone we hand
// them straight to it via the lifelinehealth:// scheme, as before.
//
// On a computer that scheme goes nowhere, and the page used to sit on an
// English spinner forever. There it explains and offers the web app.
// This page makes no Supabase call of its own: the code is the app's.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import AuthShell, { authPrimary, authSecondary } from "@/app/components/AuthShell";
import { useI18n } from "@/lib/i18n";

function appUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  // Authorization code flow: Google returns ?code= in query string
  if (code) return `lifelinehealth://auth?code=${encodeURIComponent(code)}`;
  // Legacy implicit flow: token in URL fragment (#access_token=...)
  const hash = window.location.hash;
  if (hash) return `lifelinehealth://auth${hash}`;
  return null;
}

export default function AuthCallbackPage() {
  const { t } = useI18n();
  const [state, setState] = useState<{ mobile: boolean; url: string | null } | null>(null);

  useEffect(() => {
    const url = appUrl();
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (mobile && url) window.location.href = url;
    const t = setTimeout(() => setState({ mobile, url }), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <AuthShell>
      {!state || (state.mobile && state.url) ? (
        <section className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-hc-brand-text" aria-hidden />
          <h1 className="mt-4 text-xl font-bold text-hc-ink">{t("auth.cb.connecting", "Tengist Lifeline…")}</h1>
          <p className="mt-1 text-sm text-hc-ink-2">{t("auth.cb.back-to-app", "Við sendum þig aftur í appið.")}</p>
          {state?.url && (
            <div className="mt-6 space-y-2.5">
              <a href={state.url} className={authPrimary}>{t("auth.open-app", "Opna appið")}</a>
              <Link href="/account" className={authSecondary}>{t("auth.continue-web", "Halda áfram á vefnum")}</Link>
            </div>
          )}
        </section>
      ) : (
        <section className="text-center">
          <h1 className="text-xl font-bold text-hc-ink">{t("auth.cb.finish-in-app", "Ljúktu innskráningunni í appinu")}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-hc-ink-2">
            {t("auth.cb.finish-in-app.body", "Þessi innskráning hófst í Lifeline-appinu og klárast þar. Ef þú vilt frekar nota vefinn geturðu skráð þig inn þar.")}
          </p>
          <div className="mt-6 space-y-2.5">
            {state.url && <a href={state.url} className={authSecondary}>{t("auth.open-app", "Opna appið")}</a>}
            <Link href="/account" className={authPrimary}>{t("auth.continue-web", "Halda áfram á vefnum")}</Link>
          </div>
        </section>
      )}
    </AuthShell>
  );
}
