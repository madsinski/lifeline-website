"use client";

// "Opnaðu póstinn" — what a new account sees after signUp() when email
// confirmation is on. Shared by /byrja and /account/login (?verify=1 and the
// "Email not confirmed" error).
//
// Three things the old screen did not do: resend the mail, let a typo be
// corrected, and tell the truth when the address already had an account
// (Supabase answers that signUp() with a fake success and an empty
// identities list, and the page used to say "account created").

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Loader2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { authErrorIs } from "@/lib/auth-errors-is";
import { useI18n } from "@/lib/i18n";
import { authLink, authPrimary, authSecondary } from "@/app/components/AuthShell";

const COOLDOWN_S = 60;

/** A "Senda aftur" button with a cooldown. */
export function ResendConfirmation({ email, redirectTo, className = "" }: {
  email: string; redirectTo: string; className?: string;
}) {
  const { t, tv } = useI18n();
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  const send = async () => {
    if (!email.trim()) { setMsg({ ok: false, text: t("byrja.ce.email-first", "Sláðu fyrst inn netfangið þitt.") }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: authErrorIs(error) }); return; }
    setLeft(COOLDOWN_S);
    setMsg({ ok: true, text: t("byrja.ce.resent", "Nýr staðfestingarpóstur er á leiðinni.") });
  };

  return (
    <div className={className}>
      <button type="button" onClick={() => void send()} disabled={busy || left > 0} className={authSecondary}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {left > 0
          ? tv("byrja.ce.resend-wait", "Senda aftur ({{s}} s)", { s: left })
          : t("byrja.ce.resend", "Senda staðfestingarpóst aftur")}
      </button>
      {msg && (
        <p role="status" className={`mt-2 text-center text-sm ${msg.ok ? "text-hc-ok-ink" : "text-hc-bad-ink"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export default function CheckEmail({ email, redirectTo, alreadyRegistered, onChangeEmail, loginHref }: {
  email: string;
  /** Where the confirmation link should land (absolute URL). */
  redirectTo: string;
  /** signUp() returned a user with no identities: the address is taken. */
  alreadyRegistered?: boolean;
  onChangeEmail: () => void;
  /** Login link, with next preserved. */
  loginHref: string;
}) {
  const { t, tv } = useI18n();
  const [resetState, setResetState] = useState<"idle" | "busy" | "sent" | string>("idle");

  if (alreadyRegistered) {
    const sendReset = async () => {
      setResetState("busy");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/account/login?nytt=1`,
      });
      setResetState(error ? authErrorIs(error) : "sent");
    };
    const sep = loginHref.includes("?") ? "&" : "?";
    return (
      <section className="text-center">
        <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-hc-info-surface text-hc-info-ink">
          <Mail className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-hc-ink">{t("byrja.ce.exists.title", "Netfangið er þegar skráð")}</h1>
        <p className="mx-auto mt-2 max-w-sm break-words text-sm leading-relaxed text-hc-ink-2">
          {tv("byrja.ce.exists.body", "Það er þegar til aðgangur á {{email}}. Skráðu þig inn, eða fáðu hlekk til að velja nýtt lykilorð ef þú manst það ekki.", { email })}
        </p>
        <div className="mt-6 space-y-2.5">
          <Link href={`${loginHref}${sep}email=${encodeURIComponent(email)}`} className={authPrimary}>{t("byrja.signin", "Skrá inn")}</Link>
          {resetState === "sent" ? (
            <p role="status" className="flex items-center justify-center gap-1.5 text-sm text-hc-ok-ink">
              <Check className="h-4 w-4" aria-hidden /> {t("byrja.ce.reset-sent", "Hlekkurinn er á leiðinni í pósthólfið.")}
            </p>
          ) : (
            <button type="button" onClick={() => void sendReset()} disabled={resetState === "busy"} className={authSecondary}>
              {resetState === "busy" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("byrja.ce.forgot", "Gleymt lykilorð? Fá hlekk")}
            </button>
          )}
          {resetState !== "idle" && resetState !== "busy" && resetState !== "sent" && (
            <p role="alert" className="text-sm text-hc-bad-ink">{resetState}</p>
          )}
        </div>
        <p className="mt-5 text-sm text-hc-ink-2">
          {t("byrja.ce.wrong-email", "Rangt netfang?")}{" "}
          <button type="button" onClick={onChangeEmail} className={`${authLink} min-h-11`}>{t("byrja.ce.change", "Breyta")}</button>
        </p>
      </section>
    );
  }

  return (
    <section className="text-center">
      <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-hc-brand-surface text-hc-brand-text">
        <Mail className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-hc-ink">{t("byrja.ce.title", "Opnaðu póstinn þinn")}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-hc-ink-2">
        {t("byrja.ce.body", "Við sendum staðfestingarhlekk á netfangið hér fyrir neðan. Smelltu á hann til að ljúka skráningunni og opna aðganginn þinn.")}
      </p>
      <p className="mt-4 break-all rounded-hc-element bg-hc-sunken px-4 py-3 text-sm font-semibold text-hc-ink">{email}</p>
      <p className="mt-3 text-xs leading-relaxed text-hc-ink-3">
        {t("byrja.ce.spam", "Finnurðu hann ekki? Athugaðu ruslpóstinn. Hlekkurinn gildir í eina klukkustund.")}
      </p>
      <ResendConfirmation email={email} redirectTo={redirectTo} className="mt-5" />
      <p className="mt-5 text-sm text-hc-ink-2">
        {t("byrja.ce.wrong-email", "Rangt netfang?")}{" "}
        <button type="button" onClick={onChangeEmail} className={`${authLink} min-h-11`}>{t("byrja.ce.change", "Breyta")}</button>
      </p>
    </section>
  );
}
