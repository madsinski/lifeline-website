"use client";

// /account/login — sign in, and nothing else.
//
// New accounts are made at /byrja: ?mode=signup (still linked from CMS rows,
// /app, /heilsuskodun and B2B hc codes) and ?ref= are forwarded there with
// next/leid/ref preserved. The old signup here — six fields, a terms stage
// with two scroll panes, then a browser insert into clients_decrypted that
// silently failed without a session — is gone; consent now travels in the
// signUp() metadata and is copied server side on the first signed-in load
// (ensureSignupConsentRecorded, called below after sign-in).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AuthShell, { authInput, authLabel, authLink, authPrimary } from "@/app/components/AuthShell";
import LoginAudienceTabs from "@/app/components/LoginAudienceTabs";
import PinPad from "@/app/components/hc/PinPad";
import { useI18n } from "@/lib/i18n";
import { authErrorIs, isEmailNotConfirmed } from "@/lib/auth-errors-is";
import { ensureSignupConsentRecorded, safeNextPath } from "@/lib/signup-consent";
import { ResendConfirmation } from "@/app/byrja/CheckEmail";

export default function AccountLoginPage() {
  return (
    <Suspense>
      <LoginOrReset />
    </Suspense>
  );
}

function LoginOrReset() {
  const params = useSearchParams();
  if (params.get("nytt") === "1") return <NewPassword />;
  if (params.get("mode") === "signup" || params.get("ref")) return <ToSignup />;
  return <AccountLoginContent />;
}

/** ?mode=signup / ?ref= → /byrja, keeping where they were headed. */
function ToSignup() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const q = new URLSearchParams();
    const next = safeNextPath(params.get("next"));
    if (next) q.set("next", next);
    for (const k of ["leid", "ref", "email"]) {
      const v = params.get(k);
      if (v) q.set(k, v);
    }
    const qs = q.toString();
    router.replace(`/byrja${qs ? `?${qs}` : ""}`);
  }, [params, router]);
  return (
    <AuthShell>
      <p className="flex items-center justify-center gap-2 text-sm text-hc-ink-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Augnablik…
      </p>
    </AuthShell>
  );
}

/**
 * Landing for the password-reset link (?nytt=1). Supabase signs the person in
 * with a recovery session from the link; they choose a new password here.
 */
function NewPassword() {
  const { t } = useI18n();
  const router = useRouter();
  /* Business admins reset from /business/login with next=/business/account;
     everyone else lands in the app. */
  const next = safeNextPath(useSearchParams().get("next"));
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => setReady((r) => r || !!data.session));
    const t = setTimeout(() => setReady((r) => r ?? false), 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 12) { setErr(t("acct.login.min12", "Lykilorðið þarf að vera minnst 12 stafir.")); return; }
    if (pw !== pw2) { setErr(t("acct.login.nomatch", "Lykilorðin eru ekki eins.")); return; }
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setErr(authErrorIs(error)); return; }
    router.push(next || "/app");
  };
  return (
    <AuthShell>
      <h1 className="text-2xl font-bold text-hc-ink">{t("acct.login.choosenewpw", "Veldu nýtt lykilorð")}</h1>
      {ready === false ? (
        <p className="mt-3 text-sm text-hc-ink-2">
          {t("acct.login.linkexpired", "Hlekkurinn er útrunninn eða hefur verið notaður.")}{" "}
          <Link href="/account/login" className={authLink}>{t("acct.login.requestnew", "Biddu um nýjan")}</Link>.
        </p>
      ) : (
        <form onSubmit={save} className="mt-5 space-y-4">
          <label className="block">
            <span className={authLabel}>Nýtt lykilorð</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className={authInput} />
            <span className="mt-1 block text-xs text-hc-ink-3">Minnst 12 stafir</span>
          </label>
          <label className="block">
            <span className={authLabel}>{t("acct.login.newpwagain", "Nýtt lykilorð aftur")}</span>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" className={authInput} />
          </label>
          {err && <p role="alert" className="rounded-hc-element bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">{err}</p>}
          <button type="submit" disabled={busy || !ready} className={authPrimary}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("acct.login.savenewpw", "Vista nýtt lykilorð")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

function AccountLoginContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const verifyFirst = searchParams.get("verify") === "1";

  const [email, setEmail] = useState(() => searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  /* Set when the address exists but was never confirmed: the error alone
     is a dead end, so the resend button appears with it. */
  const [unconfirmed, setUnconfirmed] = useState(verifyFirst);
  const [info, setInfo] = useState(
    verifyFirst
      ? t("acct.login.verifyfirst", "Staðfestu netfangið þitt áður en þú heldur áfram. Hlekkurinn frá Lifeline Health er í pósthólfinu (athugaðu líka ruslpóst).")
      : "",
  );
  const [loading, setLoading] = useState(false);

  // PIN sign-in on a trusted device (set up from the journey settings).
  const [pinAvailable, setPinAvailable] = useState<{ email_hint: string | null } | null>(null);
  const [usePin, setUsePin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  useEffect(() => {
    fetch("/api/account/pin")
      .then((r) => r.json())
      .then((j) => { if (j.enabled) { setPinAvailable({ email_hint: j.email_hint ?? null }); setUsePin(true); } })
      .catch(() => {});
  }, []);

  /* Where to go once signed in: a validated same-origin next, else the app.
     The consent copy runs first so the opt-outs are on the row before any
     page reads them. */
  const proceed = async () => {
    await ensureSignupConsentRecorded();
    router.push(nextPath || "/app");
  };

  const handlePin = async (value: string) => {
    setPinError("");
    setLoading(true);
    const r = await fetch("/api/account/pin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: value }),
    }).catch(() => null);
    if (!r) {
      setLoading(false);
      setPin("");
      setPinError("Engin tenging. Athugaðu netið og reyndu aftur.");
      return;
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setLoading(false);
      setPin("");
      if (j.locked || j.error === "no_device") {
        setPinError("Of margar rangar tilraunir. Skráðu þig inn með lykilorði.");
        setPinAvailable(null);
        setUsePin(false);
      } else {
        setPinError("Rangt PIN. Reyndu aftur.");
      }
      return;
    }
    const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: j.token_hash, type: "magiclink" });
    if (otpErr) {
      setLoading(false);
      setPin("");
      setPinError(authErrorIs(otpErr));
      return;
    }
    await proceed();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setUnconfirmed(isEmailNotConfirmed(signInError));
      setError(authErrorIs(signInError));
      setLoading(false);
      return;
    }
    await proceed();
  };

  const [resetBusy, setResetBusy] = useState(false);
  const handleForgotPassword = async () => {
    if (resetBusy) return;
    if (!email.trim()) {
      setError(t("acct.login.emailfirst", "Sláðu fyrst inn netfangið þitt."));
      return;
    }
    setError("");
    setInfo("");
    setResetBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/account/login?nytt=1` },
    );
    setResetBusy(false);
    if (resetError) setError(authErrorIs(resetError));
    else setInfo(t("acct.login.resetsent", "Við sendum þér hlekk til að velja nýtt lykilorð."));
  };

  const signupHref = `/byrja${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`;

  return (
    <AuthShell
      above={<LoginAudienceTabs active="personal" />}
      footer={
        <>
          Ekki með aðgang? <Link href={signupHref} className={authLink}>Stofna aðgang</Link>
        </>
      }
    >
      <h1 className="text-2xl font-bold text-hc-ink">{t("acct.login.title", "Innskráning")}</h1>
      <p className="mt-1 text-sm text-hc-ink-2">
        {t("acct.login.lede", "Skráðu þig inn til að sjá áætlunina þína, næsta tíma og hvernig gengur.")}
      </p>

      {usePin && pinAvailable ? (
        <div className="mt-6">
          <p className="text-center text-sm text-hc-ink-2">
            Sláðu inn PIN{pinAvailable.email_hint ? <> {t("acct.q.for", "fyrir")} <span className="font-medium text-hc-ink">{pinAvailable.email_hint}</span></> : null}
          </p>
          <div className="mt-5">
            <PinPad value={pin} onChange={setPin} onComplete={handlePin} disabled={loading} error={!!pinError} accent="#047857" />
          </div>
          {pinError && <p role="alert" className="mt-4 text-center text-sm text-hc-bad-ink">{pinError}</p>}
          <button
            type="button"
            onClick={() => { setUsePin(false); setPinError(""); }}
            className="mt-5 block w-full text-center text-sm font-medium text-hc-ink-2 hover:text-hc-ink"
          >
            {t("acct.login.usepassword", "Nota lykilorð í staðinn")}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className={authLabel}>{t("acct.q.email", "Netfang")}</span>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" placeholder="nafn@netfang.is"
              onInvalid={(e) => e.currentTarget.setCustomValidity("Sláðu inn gilt netfang.")}
              onInput={(e) => e.currentTarget.setCustomValidity("")}
              className={authInput}
            />
          </label>
          <label className="block">
            <span className={authLabel}>{t("acct.password", "Lykilorð")}</span>
            <span className="relative block">
              <input
                type={showPw ? "text" : "password"} required value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                onInvalid={(e) => e.currentTarget.setCustomValidity("Sláðu inn lykilorðið.")}
                onInput={(e) => e.currentTarget.setCustomValidity("")}
                className={`${authInput} pr-12`}
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Fela lykilorð" : "Sýna lykilorð"} aria-pressed={showPw}
                className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-hc-element text-hc-ink-2 hover:bg-hc-sunken-2">
                {showPw ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
              </button>
            </span>
          </label>

          {error && <p role="alert" className="rounded-hc-element bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">{error}</p>}
          {info && <p role="status" className="rounded-hc-element bg-hc-ok-surface px-3 py-2 text-sm text-hc-ok-ink">{info}</p>}

          <button type="submit" disabled={loading} className={authPrimary}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {loading ? t("acct.login.signingin", "Skrái inn…") : t("acct.signin", "Skrá inn")}
          </button>

          {unconfirmed && (
            <ResendConfirmation
              email={email}
              /* No fragment: the confirmation link puts its own tokens in the
                 hash, and a #askrift there would collide with them. */
              redirectTo={typeof window !== "undefined" ? `${window.location.origin}${(nextPath || "/app").split("#")[0]}` : ""}
            />
          )}
        </form>
      )}

      {!usePin && (
        <div className="mt-5 space-y-3 text-center">
          {pinAvailable && (
            <button type="button" onClick={() => setUsePin(true)} className={`block w-full text-sm ${authLink}`}>
              {t("acct.login.pin", "Skrá inn með PIN")}
            </button>
          )}
          <button type="button" onClick={() => void handleForgotPassword()} disabled={resetBusy} aria-busy={resetBusy}
            className="flex w-full items-center justify-center gap-2 text-sm font-medium text-hc-ink-2 hover:text-hc-ink disabled:opacity-60">
            {resetBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("acct.login.forgot", "Gleymt lykilorð?")}
          </button>
        </div>
      )}
    </AuthShell>
  );
}
