"use client";

/*
 * /byrja — Stofna aðgang.
 *
 * The account form comes first and is the whole page: name, email,
 * password, one terms box and two opt-outs. Nothing else is asked here.
 *
 * It used to open with a questionnaire (goal, movement, age, a suggested
 * plan, then a route chooser) before the account. Those choices now live
 * after signup — in the setup wizard (/app/uppsetning) and on /account —
 * where the answers can be saved straight onto the account and changed
 * later, instead of riding in sessionStorage until the last screen.
 *
 * What still travels with signUp() metadata, so a confirmation opened on
 * another device carries it:
 *   - terms version + opt-outs (copied onto clients server side on the first
 *     signed-in load: /api/account/signup-consent)
 *   - start_track, ONLY when a pricing/assessment CTA set ?leid=check|coach.
 *     Without it /app asks for the route itself (ChooseRoute), so nothing is
 *     decided for the person here.
 *   - locale (is|en), the language the form was filled in
 *   - referred_by (?ref=)
 *
 * ?next= (purchase intent, e.g. /app/eg/thjonusta) is carried through the
 * confirmation link to /account, which shows a „Halda áfram þar sem frá var
 * horfið“ card for it rather than jumping past the account.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import AuthShell, { authInput, authLabel, authLink, authPrimary } from "@/app/components/AuthShell";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { SIGNUP_TERMS_VERSION, accountLandingPath, ensureSignupConsentRecorded, safeNextPath } from "@/lib/signup-consent";
import { authErrorIs } from "@/lib/auth-errors-is";
import CheckEmail from "./CheckEmail";

export default function StartPage() {
  return (
    <Suspense>
      <Start />
    </Suspense>
  );
}

function Start() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, locale } = useI18n();
  /* ?leid=coach|check (pricing CTAs) records the route, ?next= is where to
     continue after confirming (same-origin only), ?ref= a referral code. */
  const leid = params.get("leid");
  const track = leid === "check" || leid === "coach" ? leid : null;
  const next = safeNextPath(params.get("next"));
  const refCode = (params.get("ref") || "").slice(0, 64);

  const [email, setEmail] = useState(() => params.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [accept, setAccept] = useState(false);
  /* Opt-OUTS, unticked by default. Ticking one means "do not". */
  const [researchOptOut, setResearchOptOut] = useState(false);
  const [marketingOptOut, setMarketingOptOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState<null | "sent" | "exists">(null);

  /* The confirmation link lands on /account, with the purchase intent (if
     any) carried as ?next= for the „Halda áfram“ card. */
  const landing = accountLandingPath(next);
  const redirectTo = useCallback(() => `${window.location.origin}${landing}`, [landing]);
  /* Somebody who came here from a subscription button (?leid=coach) and
     already has an account wants the subscription, not a new account. */
  const signedInHome = next || (leid === "coach" ? "/app/askrift" : "/account");
  const loginNext = next || (leid === "coach" ? "/app/askrift" : null);
  const loginHref = `/account/login${loginNext ? `?next=${encodeURIComponent(loginNext)}` : ""}`;

  /* Already signed in: this page would only make a second account. */
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!alive) return;
        if (data.session) router.replace(signedInHome);
        else setCheckingSession(false);
      })
      .catch(() => { if (alive) setCheckingSession(false); });
    return () => { alive = false; };
  }, [router, signedInHome]);

  const submit = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    const res = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim() || null,
          ...(track ? { start_track: track } : {}),
          locale,
          terms_version: SIGNUP_TERMS_VERSION,
          terms_accepted_at: new Date().toISOString(),
          research_opt_out: researchOptOut,
          marketing_opt_out: marketingOptOut,
          ...(refCode ? { referred_by: refCode } : {}),
        },
        emailRedirectTo: redirectTo(),
      },
    }).catch(() => null);
    if (!res) { setBusy(false); setErr(t("byrja.err.offline", "Engin tenging. Athugaðu netið og reyndu aftur.")); return; }
    const { data, error } = res;
    if (error) { setBusy(false); setErr(authErrorIs(error)); return; }

    /* An address that already has a confirmed account: Supabase answers with
       a user that has no identities and sends nothing. Say so. */
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setBusy(false);
      setSent("exists");
      return;
    }

    if (data.session) {
      /* Confirmation is not enforced: go straight in. */
      await ensureSignupConsentRecorded();
      router.push(landing);
      return;
    }
    setBusy(false);
    setSent("sent");
  };

  return (
    <AuthShell
      footer={!sent && (
        <>{t("byrja.have-account", "Ertu þegar með aðgang?")} <Link href={loginHref} className={authLink}>{t("byrja.signin", "Skrá inn")}</Link></>
      )}
    >
      {checkingSession && !sent && (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-hc-ink-2" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t("byrja.wait", "Augnablik…")}
        </p>
      )}
      {sent && (
        <CheckEmail
          email={email.trim()}
          redirectTo={redirectTo()}
          alreadyRegistered={sent === "exists"}
          loginHref={loginHref}
          onChangeEmail={() => setSent(null)}
        />
      )}

      {!sent && !checkingSession && (
        <section>
          <h1 className="text-2xl font-bold text-hc-ink">{t("byrja.title", "Stofna aðgang")}</h1>
          <p className="mt-1 text-sm leading-relaxed text-hc-ink-2">
            {t("byrja.lede", "Aðgangurinn er ókeypis. Þegar hann er tilbúinn velur þú hvort þú byrjir í appinu eða á heilsufarsskoðun.")}
          </p>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => { e.preventDefault(); void submit(); }}
            /* Bring the rejected field into view: on a phone the browser's
               bubble can sit above the fold when the button is pressed. */
            onInvalid={(e) => {
              const el = e.target as HTMLInputElement;
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          >
            <Field label={t("byrja.name", "Nafn")} value={name} onChange={setName} required autoComplete="name"
              invalidMessage={t("byrja.name.invalid", "Sláðu inn nafnið þitt.")} />
            <Field label={t("byrja.email", "Netfang")} value={email} onChange={setEmail} type="email" required autoComplete="email"
              invalidMessage={t("byrja.email.invalid", "Sláðu inn gilt netfang.")} />
            <label className="block">
              <span className={authLabel}>{t("byrja.password", "Lykilorð")}</span>
              <span className="relative block">
                <input
                  type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  required minLength={12} autoComplete="new-password" aria-describedby="byrja-pw-hint"
                  onInvalid={(e) => e.currentTarget.setCustomValidity(t("byrja.password.invalid", "Lykilorðið þarf að vera að minnsta kosti 12 stafir."))}
                  onInput={(e) => e.currentTarget.setCustomValidity("")}
                  className={`${authInput} pr-12`}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? t("byrja.password.hide", "Fela lykilorð") : t("byrja.password.show", "Sýna lykilorð")} aria-pressed={showPw}
                  className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-hc-element text-hc-ink-2 hover:bg-hc-sunken-2">
                  {showPw ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </span>
              <span id="byrja-pw-hint" className="mt-1 block text-xs text-hc-ink-3">
                {t("byrja.password.hint", "Að minnsta kosti 12 stafir")}
              </span>
            </label>

            {/* One line, not a stage with scroll panes. The documents open in
                their own tab. */}
            <label className="flex items-start gap-3 pt-1">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} required
                onInvalid={(e) => e.currentTarget.setCustomValidity(t("byrja.terms.invalid", "Hakaðu við til að samþykkja skilmálana."))}
                onInput={(e) => e.currentTarget.setCustomValidity("")}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-hc-control accent-[#047857]" />
              <span className="text-sm leading-snug text-hc-ink">
                {t("byrja.terms.pre", "Ég samþykki")}{" "}
                <a href="/terms" target="_blank" rel="noreferrer" className={authLink}>{t("byrja.terms.terms", "notkunarskilmála")}</a>
                {" "}{t("byrja.terms.and", "og")}{" "}
                <a href="/privacy" target="_blank" rel="noreferrer" className={authLink}>{t("byrja.terms.privacy", "persónuverndarstefnu")}</a>
                {" "}{t("byrja.terms.post", "Lifeline Health.")}
              </span>
            </label>

            <fieldset className="space-y-2.5 rounded-hc-element bg-hc-sunken p-3.5">
              <legend className="sr-only">{t("byrja.optional", "Valfrjálst")}</legend>
              <p aria-hidden className="text-xs font-semibold text-hc-ink-2">{t("byrja.optional", "Valfrjálst")}</p>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={researchOptOut} onChange={(e) => setResearchOptOut(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-hc-control accent-[#047857]" />
                <span className="text-xs leading-snug text-hc-ink-2">
                  <strong className="text-hc-ink">{t("byrja.optout.research.title", "Afþakka rannsóknanotkun.")}</strong>{" "}
                  {t("byrja.optout.research.body", "Ekki nota nafnlaus gögn mín til að bæta Lifeline eða í klíníska rannsókn.")}
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={marketingOptOut} onChange={(e) => setMarketingOptOut(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-hc-control accent-[#047857]" />
                <span className="text-xs leading-snug text-hc-ink-2">
                  <strong className="text-hc-ink">{t("byrja.optout.marketing.title", "Afþakka markaðspóst.")}</strong>{" "}
                  {t("byrja.optout.marketing.body", "Ekki senda mér vörufréttir eða kynningar frá Lifeline.")}
                </span>
              </label>
            </fieldset>

            <button type="submit" disabled={busy} className={authPrimary}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("byrja.submit", "Stofna aðgang")}
            </button>
            {err && <p role="alert" className="rounded-hc-element bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">{err}</p>}
          </form>
          <p className="mt-4 text-xs leading-relaxed text-hc-ink-3">
            {t("byrja.disclaimer", "Lifeline mælir og fylgist með. Við greinum ekki sjúkdóma og komum ekki í stað læknis.")}
          </p>
        </section>
      )}
    </AuthShell>
  );
}

function Field({ label, value, onChange, type = "text", required, autoComplete, invalidMessage }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
  autoComplete?: string; invalidMessage?: string;
}) {
  return (
    <label className="block">
      <span className={authLabel}>{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        required={required} autoComplete={autoComplete}
        /* The browser's own text would be in the browser's language. */
        onInvalid={(e) => invalidMessage && e.currentTarget.setCustomValidity(invalidMessage)}
        onInput={(e) => e.currentTarget.setCustomValidity("")}
        className={authInput}
      />
    </label>
  );
}
