"use client";

// Company login + account creation for the B2B contact person. On the
// shared AuthShell like /account/login and /byrja, Icelandic first: the t()
// fallbacks are the Icelandic copy; English comes from the translations
// table (supabase/migration-b2b-auth-translations.sql).

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import AuthShell, { authInput, authLabel, authLink, authPrimary } from "@/app/components/AuthShell";
import LoginAudienceTabs from "@/app/components/LoginAudienceTabs";
import { authErrorIs } from "@/lib/auth-errors-is";
import { safeNextPath } from "@/lib/signup-consent";
import PasswordField, { B2B_MIN_PW } from "../PasswordField";
import ResendB2BConfirmation from "../signup/ResendConfirmation";

export default function BusinessLoginPage() {
  return (
    <Suspense>
      <BusinessLoginInner />
    </Suspense>
  );
}

function BusinessLoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  /* Same-origin only: "//evil.example" also starts with "/". */
  // Without a next, the business account — /business is the marketing page,
  // and landing back on it after signing in looked like nothing happened.
  const next = safeNextPath(search.get("next")) || "/business/account";
  const initialMode = search.get("mode") === "signup" ? "signup" : "login";
  const { t } = useI18n();

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  // /business/claim sends people here with ?email=…&claimed=1.
  const [email, setEmail] = useState(() => search.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(() => search.get("claimed") === "1"
    ? t("b2b.login.claimed", "Aðgangurinn er tilbúinn. Skráðu þig inn með lykilorðinu sem þú valdir.")
    : "");
  const [signupSent, setSignupSent] = useState(false);

  const switchMode = (m: "login" | "signup") => {
    if (loading) return;
    setMode(m);
    setSignupSent(false);
    setError("");
    setInfo("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setInfo("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setLoading(false);
      setError(authErrorIs(err));
      return;
    }
    // Stays "Skrái inn…" until the next page takes over.
    router.push(next);
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setInfo("");
    if (password.length < B2B_MIN_PW) {
      setError(t("b2b.signup.password_short", "Lykilorðið þarf að vera minnst 12 stafir."));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("b2b.signup.password_mismatch", "Lykilorðin stemma ekki."));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/business/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, full_name: fullName.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409 && j.error === "email_already_registered") {
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setError(t(
          "b2b.login.email_exists",
          "Netfangið er þegar með Lifeline-aðgang. Skráðu þig inn með lykilorðinu sem þú notar nú þegar.",
        ));
        return;
      }
      if (!res.ok) {
        /* The route answers with codes, not sentences. */
        setError(res.status === 400
          ? t("b2b.signup.invalid", "Athugaðu netfangið og að lykilorðið sé minnst 12 stafir.")
          : t("b2b.signup.failed", "Ekki tókst að stofna aðganginn. Reyndu aftur eftir smástund."));
        return;
      }
      // Account created UNCONFIRMED. A confirmation link was emailed (via
      // Resend). The user must click it to verify their address before they
      // can sign in and continue — so we don't auto-sign-in here.
      setSignupSent(true);
    } catch {
      setError(t("b2b.signup.offline", "Engin tenging. Athugaðu netið og reyndu aftur."));
    } finally {
      setLoading(false);
    }
  };

  const [resetBusy, setResetBusy] = useState(false);
  const handleForgotPassword = async () => {
    if (resetBusy) return;
    if (!email.trim()) {
      setError(t("b2b.login.enter_email_first", "Sláðu fyrst inn netfangið þitt."));
      return;
    }
    setError("");
    setInfo("");
    setResetBusy(true);
    /* The link has to land somewhere that asks for the new password. It
       used to land on /business, the marketing page, which signed the
       person in and never let them choose one. */
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/account/login?nytt=1&next=${encodeURIComponent("/business/account")}`,
    });
    setResetBusy(false);
    if (resetError) {
      setError(authErrorIs(resetError));
    } else {
      setInfo(t("b2b.login.reset_sent", "Við sendum þér hlekk til að velja nýtt lykilorð."));
    }
  };

  const errorBox = error && (
    <p role="alert" className="rounded-hc-element bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">{error}</p>
  );
  const infoBox = info && (
    <p role="status" className="rounded-hc-element bg-hc-ok-surface px-3 py-2 text-sm text-hc-ok-ink">{info}</p>
  );

  return (
    <AuthShell
      above={<LoginAudienceTabs active="business" />}
      footer={signupSent ? undefined : mode === "login" ? (
        <>
          {t("b2b.login.no_account", "Fyrirtækið ekki með aðgang?")}{" "}
          <button type="button" onClick={() => switchMode("signup")} className={authLink}>
            {t("b2b.login.tab.signup", "Stofna fyrirtækjaaðgang")}
          </button>
        </>
      ) : (
        <>
          {t("b2b.signup.have_account", "Ertu þegar með aðgang?")}{" "}
          <button type="button" onClick={() => switchMode("login")} className={authLink}>
            {t("b2b.login.tab.login", "Skrá inn")}
          </button>
        </>
      )}
    >
      {mode === "signup" && signupSent ? (
        <section className="text-center">
          <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-hc-brand-surface text-hc-brand-text">
            <Mail className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-hc-ink">
            {t("b2b.signup.sent.title", "Opnaðu póstinn þinn")}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-hc-ink-2">
            {t("b2b.signup.sent.body", "Við sendum staðfestingarhlekk á netfangið hér fyrir neðan. Smelltu á hann til að staðfesta netfangið og halda áfram að skrá fyrirtækið.")}
          </p>
          <p className="mt-4 break-all rounded-hc-element bg-hc-sunken px-4 py-3 text-sm font-semibold text-hc-ink">{email.trim()}</p>
          <p className="mt-3 text-xs leading-relaxed text-hc-ink-3">
            {t("b2b.signup.sent.spam", "Finnurðu hann ekki? Athugaðu ruslpóstinn.")}
          </p>
          <ResendB2BConfirmation email={email} className="mt-5" />
          <p className="mt-5 text-sm text-hc-ink-2">
            {t("b2b.signup.sent.wrong_email", "Rangt netfang?")}{" "}
            <button type="button" onClick={() => setSignupSent(false)} className={authLink}>
              {t("b2b.signup.sent.change", "Breyta")}
            </button>
          </p>
          <button type="button" onClick={() => switchMode("login")} className={`mt-3 text-sm ${authLink}`}>
            {t("b2b.signup.sent.back", "Til baka í innskráningu")}
          </button>
        </section>
      ) : mode === "login" ? (
        <>
          <h1 className="text-2xl font-bold text-hc-ink">{t("b2b.login.title", "Innskráning fyrirtækja")}</h1>
          <p className="mt-1 text-sm text-hc-ink-2">
            {t("b2b.login.tagline", "Fyrir stjórnendur sem halda utan um heilsuverkefni fyrirtækisins hjá Lifeline Health.")}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className={authLabel}>{t("b2b.login.email", "Netfang")}</span>
              <input
                type="email" required autoFocus value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" placeholder="nafn@fyrirtaeki.is"
                onInvalid={(e) => e.currentTarget.setCustomValidity("Sláðu inn gilt netfang.")}
                onInput={(e) => e.currentTarget.setCustomValidity("")}
                className={authInput}
              />
            </label>
            <PasswordField
              label={t("b2b.login.password", "Lykilorð")}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />

            {errorBox}
            {infoBox}

            <button type="submit" disabled={loading} aria-busy={loading} className={authPrimary}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {loading ? t("b2b.login.signing_in", "Skrái inn…") : t("b2b.login.submit", "Skrá inn")}
            </button>
          </form>

          <button
            type="button"
            onClick={() => void handleForgotPassword()}
            disabled={resetBusy}
            aria-busy={resetBusy}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 text-sm font-medium text-hc-ink-2 hover:text-hc-ink disabled:opacity-60"
          >
            {resetBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("b2b.login.forgot", "Gleymt lykilorð?")}
          </button>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-hc-ink">{t("b2b.signup.title", "Stofna fyrirtækjaaðgang")}</h1>
          <p className="mt-1 text-sm text-hc-ink-2">
            {t("b2b.signup.subtitle", "Þú verður tengiliður fyrirtækisins hjá Lifeline Health. Fyrst stofnarðu aðganginn þinn og staðfestir netfangið.")}
          </p>

          <form onSubmit={submitSignup} className="mt-6 space-y-4">
            <label className="block">
              <span className={authLabel}>{t("b2b.signup.full_name", "Fullt nafn")}</span>
              <input
                type="text" required autoFocus value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name" placeholder="Jón Jónsson"
                onInvalid={(e) => e.currentTarget.setCustomValidity("Sláðu inn nafnið þitt.")}
                onInput={(e) => e.currentTarget.setCustomValidity("")}
                className={authInput}
              />
            </label>
            <label className="block">
              <span className={authLabel}>{t("b2b.signup.email", "Netfang í vinnu")}</span>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" placeholder="nafn@fyrirtaeki.is"
                onInvalid={(e) => e.currentTarget.setCustomValidity("Sláðu inn gilt netfang.")}
                onInput={(e) => e.currentTarget.setCustomValidity("")}
                className={authInput}
              />
            </label>
            <PasswordField
              label={t("b2b.signup.password", "Lykilorð")}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={B2B_MIN_PW}
              hint={t("b2b.signup.password_placeholder", "Minnst 12 stafir")}
            />
            <PasswordField
              label={t("b2b.signup.confirm_password", "Endurtaktu lykilorðið")}
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              minLength={B2B_MIN_PW}
            />

            {errorBox}
            {infoBox}

            <button type="submit" disabled={loading} aria-busy={loading} className={authPrimary}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {loading ? t("b2b.signup.creating", "Stofna aðgang…") : t("b2b.signup.submit", "Stofna aðgang")}
            </button>

            <p className="text-center text-xs leading-relaxed text-hc-ink-3">
              {t(
                "b2b.signup.footer_note",
                "Næstu skref: þú staðfestir netfangið, samþykkir notkunarskilmála og vinnslusamning, skráir fyrirtækið og býður starfsfólki.",
              )}
            </p>
          </form>
        </>
      )}
    </AuthShell>
  );
}
