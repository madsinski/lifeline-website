"use client";

// B2B employee onboarding — the invite link + 6-digit code from the
// employer's roster. Stages: code → welcome → consent (Employee ToS + the
// separate Art. 9 health consent, both required, plus two opt-outs) →
// profile (skippable; measured at the measurement day anyway) → account →
// done, signed straight in and on to /app.
//
// Icelandic throughout, on the shared AuthShell. The session-mismatch guard
// stays: completing while signed in as somebody else would bind the
// employee's consent to the wrong account.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Eye, EyeOff, Loader2, Smartphone, TriangleAlert } from "lucide-react";
import DoctorsTeam from "@/app/components/DoctorsTeam";
import AuthShell, { authInput, authLabel, authPrimary, authSecondary } from "@/app/components/AuthShell";
import { supabase } from "@/lib/supabase";
import { APP_LIVE, APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-links";
import {
  EMPLOYEE_TOS_VERSION,
  HEALTH_CONSENT_VERSION,
  renderEmployeeTermsOfService,
  renderHealthAssessmentConsent,
} from "@/lib/platform-terms-content";

type Stage = "password" | "welcome" | "consent" | "profile" | "account" | "done";
type Sex = "male" | "female" | "";
type Activity = "sedentary" | "light" | "moderate" | "very_active" | "extra_active" | "";

const ORDER: Stage[] = ["welcome", "consent", "profile", "account"];
const MIN_PW = 12;

/** The complete route answers with codes; say them in Icelandic. */
function completeError(code: string | undefined, detail?: string): string {
  switch (code) {
    case "email_already_registered":
      return detail || "Þetta netfang er þegar með Lifeline-aðgang. Skráðu þig inn og hafðu samband við okkur.";
    case "password_too_short": return `Lykilorðið þarf að vera minnst ${MIN_PW} stafir.`;
    case "consent_required": return "Samþykktu bæði skjölin til að halda áfram.";
    case "profile_incomplete": return "Fylltu út öll gildin, eða slepptu skrefinu.";
    case "invalid_code": return "Kóðinn úr boðspóstinum passar ekki. Opnaðu hlekkinn aftur.";
    case "already_completed": return "Þetta boð hefur þegar verið notað. Skráðu þig inn í staðinn.";
    default: return "Ekki tókst að ljúka skráningu. Reyndu aftur eða hafðu samband við okkur.";
  }
}

export default function OnboardPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("password");
  const [appAccess, setAppAccess] = useState(false);
  /* Signed in at the end (magic-link token from the complete route). */
  const [signedIn, setSignedIn] = useState(false);

  // Scroll to top on every forward step
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");           // work / roster email (where the invite was sent)
  const [loginEmail, setLoginEmail] = useState(""); // email the employee will actually log in with
  const [phone, setPhone] = useState("");
  const [kennitala, setKennitala] = useState("");

  const [acceptTos, setAcceptTos] = useState(false);
  const [acceptHealth, setAcceptHealth] = useState(false);
  const [researchOptOut, setResearchOptOut] = useState(false);
  const [marketingOptOut, setMarketingOptOut] = useState(false);

  const [sex, setSex] = useState<Sex>("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [activityLevel, setActivityLevel] = useState<Activity>("");
  const [profileSkipped, setProfileSkipped] = useState(false);

  const [accountPassword, setAccountPassword] = useState("");

  // Session-mismatch guard: detect if someone clicked this employee
  // invite while already signed in as another Lifeline user. Completing
  // onboarding in that state would bind the employee's body-comp /
  // consent data to the wrong auth account.
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentEmail(user?.email || null);
    })();
  }, []);

  const verifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/business/onboard/${token}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Kóðinn passar ekki.");
      setFullName(j.full_name || "");
      setEmail(j.email || "");
      setLoginEmail(j.email || ""); // default login email to the work email; employee can change it
      setPhone(j.phone || "");
      setKennitala(j.kennitala || "");
      setStage(j.completed_at ? "done" : "welcome");
    } catch (e) {
      // A dropped connection rejects with the browser's English TypeError.
      setError(e instanceof TypeError ? "Engin tenging. Athugaðu netið og reyndu aftur." : (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const profileFilled = !!(sex && heightCm && weightKg && activityLevel);

  const completeOnboarding = async () => {
    if (!profileSkipped && !profileFilled) {
      setError("Fylltu út öll gildin, eða slepptu skrefinu.");
      setStage("profile");
      return;
    }
    if (!accountPassword || accountPassword.length < MIN_PW) {
      setError(`Veldu lykilorð sem er minnst ${MIN_PW} stafir.`);
      return;
    }
    const loginEmailTrimmed = loginEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmailTrimmed)) {
      setError("Sláðu inn gilt netfang.");
      setStage("account");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/business/onboard/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          account_password: accountPassword,
          login_email: loginEmailTrimmed,
          ...(!profileSkipped && profileFilled ? {
            sex,
            height_cm: Number(heightCm),
            weight_kg: Number(weightKg),
            activity_level: activityLevel,
          } : {}),
          terms_version: EMPLOYEE_TOS_VERSION,
          accept_tos: acceptTos,
          accept_health: acceptHealth,
          research_opt_out: researchOptOut,
          marketing_opt_out: marketingOptOut,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(completeError(j.error, j.detail));
      setAppAccess(!!j.app_access);
      setLoginEmail(j.email || loginEmailTrimmed);
      if (j.token_hash) {
        /* Sign in now, so the last button goes into the app rather than to
           a login form. A failure only costs the shortcut. */
        await supabase.auth.signOut().catch(() => {});
        const { error: otpErr } = await supabase.auth.verifyOtp({ token_hash: j.token_hash, type: "magiclink" });
        setSignedIn(!otpErr);
      }
      setStage("done");
    } catch (e) {
      // A dropped connection rejects with the browser's English TypeError.
      setError(e instanceof TypeError ? "Engin tenging. Athugaðu netið og reyndu aftur." : (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const mismatch = !!(currentEmail && email && currentEmail.toLowerCase() !== email.toLowerCase());
  const stepIdx = ORDER.indexOf(stage);
  const backTo: Record<string, Stage> = { consent: "welcome", profile: "consent", account: "profile" };

  return (
    <AuthShell
      width={stage === "consent" ? "lg" : "md"}
      step={stepIdx >= 0 && !mismatch ? { n: stepIdx + 1, of: ORDER.length } : undefined}
      back={backTo[stage] && !mismatch && !loading ? () => { setError(""); setStage(backTo[stage]); } : undefined}
    >
        {/* Session-mismatch guard. If the user is signed in as a
            different account from the one the invite was sent to,
            refuse to let them proceed (a silent mismatch would bind
            the new account's onboarding data to the wrong user). */}
        {mismatch && (
          <div className="rounded-hc-element bg-hc-warn-surface p-5 ring-1 ring-amber-300">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-6 w-6 shrink-0 text-hc-warn-ink" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="mb-1 font-semibold text-hc-warn-ink">Ertu skráð/ur inn sem rétti notandi?</div>
                <p className="text-sm leading-relaxed text-hc-warn-ink">
                  Boðshlekkurinn var sendur á <strong className="break-all">{email}</strong>, en þú ert núna skráð/ur inn sem <strong className="break-all">{currentEmail}</strong>. Haltu ekki áfram — skráning myndi festast á rangan notanda. Skráðu þig út og opnaðu hlekkinn aftur.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setSigningOut(true);
                      await supabase.auth.signOut();
                      setCurrentEmail(null);
                      setSigningOut(false);
                    }}
                    disabled={signingOut}
                    className="inline-flex min-h-10 items-center rounded-hc-element bg-amber-700 px-3 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
                  >
                    {signingOut ? "Skráir út…" : `Skrá út ${currentEmail}`}
                  </button>
                  <Link href="/" className="inline-flex min-h-10 items-center rounded-hc-element border border-amber-300 bg-hc-surface px-3 text-sm font-semibold text-hc-warn-ink hover:bg-amber-50">
                    Hætta við
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hide the stage content entirely when a session mismatch is
            detected — the banner above is the only path forward. */}
        {!mismatch && (
          <>
        {stage === "password" && <PasswordStage
          password={password} setPassword={setPassword}
          error={error} loading={loading} onSubmit={verifyPassword}
        />}

        {stage === "welcome" && <WelcomeStage
          firstName={(fullName.split(" ")[0] || "").trim()}
          onContinue={() => setStage("consent")}
        />}

        {stage === "consent" && <ConsentStage
          acceptTos={acceptTos} setAcceptTos={setAcceptTos}
          acceptHealth={acceptHealth} setAcceptHealth={setAcceptHealth}
          researchOptOut={researchOptOut} setResearchOptOut={setResearchOptOut}
          marketingOptOut={marketingOptOut} setMarketingOptOut={setMarketingOptOut}
          onContinue={() => setStage("profile")}
        />}

        {stage === "profile" && <ProfileStage
          email={email} kennitala={kennitala} fullName={fullName} phone={phone}
          sex={sex} setSex={setSex}
          heightCm={heightCm} setHeightCm={setHeightCm}
          weightKg={weightKg} setWeightKg={setWeightKg}
          activityLevel={activityLevel} setActivityLevel={setActivityLevel}
          error={error}
          onSkip={() => { setError(""); setProfileSkipped(true); setStage("account"); }}
          onContinue={() => {
            if (!profileFilled) {
              setError("Fylltu út öll gildin, eða slepptu skrefinu.");
              return;
            }
            setError("");
            setProfileSkipped(false);
            setStage("account");
          }}
        />}

        {stage === "account" && <AccountStage
          accountPassword={accountPassword} setAccountPassword={setAccountPassword}
          workEmail={email} loginEmail={loginEmail} setLoginEmail={setLoginEmail}
          loading={loading} error={error}
          onSubmit={completeOnboarding}
        />}

        {stage === "done" && <DoneStage
          firstName={(fullName.split(" ")[0] || "").trim()}
          appAccess={appAccess}
          signedIn={signedIn}
          loginEmail={loginEmail}
          onGo={() => router.push("/app")}
        />}
          </>
        )}
    </AuthShell>
  );
}

// ── Stages ──────────────────────────────────────────────────────────────────

function PasswordStage({
  password, setPassword, error, loading, onSubmit,
}: {
  password: string; setPassword: (v: string) => void;
  error: string; loading: boolean; onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <section>
      <h1 className="text-2xl font-bold text-hc-ink">Sláðu inn kóðann</h1>
      <p className="mt-1 text-sm text-hc-ink-2">
        Sex stafa kóðinn kom í tölvupósti ásamt þessum hlekk.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="sr-only">Kóði</span>
          <input
            type="text"
            required autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onInvalid={(e) => e.currentTarget.setCustomValidity("Sláðu inn kóðann.")}
            onInput={(e) => e.currentTarget.setCustomValidity("")}
            placeholder="••••••"
            className={`${authInput} text-center font-mono text-2xl tracking-[0.4em]`}
          />
        </label>
        {error && <p role="alert" className="rounded-hc-element bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">{error}</p>}
        <button type="submit" disabled={loading} className={authPrimary}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {loading ? "Athuga…" : "Áfram"}
        </button>
      </form>
    </section>
  );
}

function WelcomeStage({ firstName, onContinue }: { firstName: string; onContinue: () => void }) {
  return (
    <section>
      <h1 className="text-2xl font-bold text-hc-ink">
        {firstName ? `Velkomin(n), ${firstName}` : "Velkomin(n)"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-hc-ink-2">
        Vinnuveitandinn þinn býður þér heilsumat hjá Lifeline Health: mælingar, blóðprufu og skýrslu sem læknir
        fer yfir, ásamt áætlun til að fylgja eftir. Skráningin tekur nokkrar mínútur.
      </p>

      <ol className="mt-6 space-y-4">
        <Step n={1} title="Samþykki">
          Notkunarskilmálar og upplýst samþykki fyrir heilsumati.
        </Step>
        <Step n={2} title="Líkamsgildi (valfrjálst)">
          Kyn, hæð, þyngd og hreyfing. Má sleppa — við mælum þig á mælingadeginum.
        </Step>
        <Step n={3} title="Lykilorð">
          Þú skráir þig inn með netfanginu og lykilorðinu á vefnum og í appinu.
        </Step>
      </ol>

      <div className="mt-6 border-t border-hc-hairline pt-6">
        <p className="mb-3 text-sm text-hc-ink-2">Læknarnir okkar — allir með starfsleyfi frá Embætti landlæknis.</p>
        <DoctorsTeam compact />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-hc-ink-3">
        Lifeline mælir og fylgist með — við greinum ekki sjúkdóma og komum ekki í stað læknis.
      </p>

      <button type="button" onClick={onContinue} className={`mt-6 ${authPrimary}`}>Hefjast handa</button>
    </section>
  );
}

function ConsentStage({
  acceptTos, setAcceptTos,
  acceptHealth, setAcceptHealth,
  researchOptOut, setResearchOptOut,
  marketingOptOut, setMarketingOptOut,
  onContinue,
}: {
  acceptTos: boolean; setAcceptTos: (v: boolean) => void;
  acceptHealth: boolean; setAcceptHealth: (v: boolean) => void;
  researchOptOut: boolean; setResearchOptOut: (v: boolean) => void;
  marketingOptOut: boolean; setMarketingOptOut: (v: boolean) => void;
  onContinue: () => void;
}) {
  const pane = "max-h-72 overflow-y-auto rounded-hc-element bg-hc-sunken p-4 font-sans text-[12px] leading-relaxed text-hc-ink whitespace-pre-wrap ring-1 ring-hc-hairline";
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-hc-ink">Samþykki — skilmálar og heilsumat</h1>
        <p className="mt-2 text-sm text-hc-ink-2">
          Áður en þú getur hafið heilsumat þarftu að samþykkja tvö skjöl: almenna notkunarskilmála og upplýst samþykki
          fyrir heilsumati. Samþykkin eru skráð rafrænt með tímastimpli, IP-tölu og vafraauðkenni.
        </p>
      </header>

      {/* 1. Employee TOS */}
      <div>
        <h2 className="mb-1 text-lg font-semibold text-hc-ink">
          1. Notkunarskilmálar starfsmanns ({EMPLOYEE_TOS_VERSION})
        </h2>
        <p className="mb-2 text-xs text-hc-ink-3">Almennir skilmálar um notkun þína á þjónustusíðunni og snjallforritinu.</p>
        <pre className={pane}>
{renderEmployeeTermsOfService()}
        </pre>
        <label className="mt-3 flex cursor-pointer select-none items-start gap-3">
          <input type="checkbox" checked={acceptTos} onChange={(e) => setAcceptTos(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#047857]" />
          <span className="text-sm text-hc-ink">
            Ég hef lesið og samþykki notkunarskilmála Lifeline Health ({EMPLOYEE_TOS_VERSION}).
          </span>
        </label>
      </div>

      {/* 2. Informed health consent — separate, explicit (GDPR Art. 9) */}
      <div>
        <h2 className="mb-1 text-lg font-semibold text-hc-ink">
          2. Upplýst samþykki fyrir heilsumat ({HEALTH_CONSENT_VERSION})
        </h2>
        <p className="mb-2 text-xs text-hc-ink-3">
          Sérstakt samþykki fyrir vinnslu heilsufarsupplýsinga skv. 9. gr. GDPR og laga nr. 74/1997 um réttindi sjúklinga.
          Lifeline Health framkvæmir heilsumatið með leyfi frá landlækni; sjúkraskrá er varðveitt hjá Medalia.
        </p>
        <pre className={pane}>
{renderHealthAssessmentConsent()}
        </pre>
        <label className="mt-3 flex cursor-pointer select-none items-start gap-3">
          <input type="checkbox" checked={acceptHealth} onChange={(e) => setAcceptHealth(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#047857]" />
          <span className="text-sm text-hc-ink">
            Ég veiti upplýst og beint samþykki fyrir vinnslu heilsufarsupplýsinga minna í tengslum við heilsumat Lifeline Health ({HEALTH_CONSENT_VERSION}).
          </span>
        </label>
      </div>

      {/* Opt-out choices */}
      <div className="space-y-3 border-t border-hc-hairline pt-6">
        <p className="text-sm font-medium text-hc-ink">Val um frekari vinnslu (ekki nauðsynlegt):</p>
        <Checkbox checked={researchOptOut} onChange={setResearchOptOut}>
          <strong>Afþakka rannsóknanotkun.</strong>{" "}
          <span className="text-hc-ink-2">Ekki nota nafnlaus gögn mín til að bæta Lifeline eða í klíníska rannsókn.</span>
        </Checkbox>
        <Checkbox checked={marketingOptOut} onChange={setMarketingOptOut}>
          <strong>Afþakka markaðspóst.</strong>{" "}
          <span className="text-hc-ink-2">Ekki senda mér vörufréttir eða kynningar frá Lifeline.</span>
        </Checkbox>
      </div>

      <div>
        <button type="button" onClick={onContinue} disabled={!acceptTos || !acceptHealth} className={authPrimary}>
          Halda áfram
        </button>
        {(!acceptTos || !acceptHealth) && (
          <p className="mt-2 text-center text-sm text-hc-warn-ink">Hakaðu við bæði skjölin til að halda áfram.</p>
        )}
      </div>
    </section>
  );
}

function ProfileStage({
  email, kennitala, fullName, phone,
  sex, setSex, heightCm, setHeightCm, weightKg, setWeightKg,
  activityLevel, setActivityLevel, error, onSkip, onContinue,
}: {
  email: string; kennitala: string; fullName: string; phone: string;
  sex: Sex; setSex: (v: Sex) => void;
  heightCm: string; setHeightCm: (v: string) => void;
  weightKg: string; setWeightKg: (v: string) => void;
  activityLevel: Activity; setActivityLevel: (v: Activity) => void;
  error: string; onSkip: () => void; onContinue: () => void;
}) {
  return (
    <section>
      <h1 className="text-2xl font-bold text-hc-ink">Líkamsgildi</h1>
      <p className="mt-1 text-sm text-hc-ink-2">
        Valfrjálst. Kyn, hæð, þyngd og hreyfing gera fyrstu mælinguna fljótlegri. Fæðingardagur kemur úr kennitölunni.
      </p>

      <dl className="mt-5 grid grid-cols-1 gap-3 rounded-hc-element bg-hc-sunken p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-hc-ink-3">Nafn</dt><dd className="text-hc-ink">{fullName || "—"}</dd></div>
        <div><dt className="text-xs text-hc-ink-3">Kennitala</dt><dd className="font-mono text-hc-ink">{maskKennitala(kennitala) || "—"}</dd></div>
        <div className="min-w-0"><dt className="text-xs text-hc-ink-3">Netfang (boð)</dt><dd className="break-all text-hc-ink">{email}</dd></div>
        <div><dt className="text-xs text-hc-ink-3">Sími</dt><dd className="text-hc-ink">{phone || "—"}</dd></div>
      </dl>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={authLabel}>Kyn</span>
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex)} className={authInput}>
            <option value="">Veldu…</option>
            <option value="female">Kona</option>
            <option value="male">Karl</option>
          </select>
        </label>
        <label className="block">
          <span className={authLabel}>Hreyfing</span>
          <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as Activity)} className={authInput}>
            <option value="">Veldu…</option>
            <option value="sedentary">Lítil eða engin hreyfing</option>
            <option value="light">Létt — 1–3 daga í viku</option>
            <option value="moderate">Miðlungs — 3–5 daga í viku</option>
            <option value="very_active">Mikil — 6–7 daga í viku</option>
            <option value="extra_active">Mjög mikil — stíf þjálfun daglega</option>
          </select>
        </label>
        <label className="block">
          <span className={authLabel}>Hæð (cm)</span>
          <input type="number" inputMode="numeric" min={100} max={230} step={1} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={authInput} />
        </label>
        <label className="block">
          <span className={authLabel}>Þyngd (kg)</span>
          <input type="number" inputMode="decimal" min={30} max={300} step={0.1} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={authInput} />
        </label>
      </div>

      {error && <p role="alert" className="mt-4 rounded-hc-element bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">{error}</p>}

      <div className="mt-6 space-y-2.5">
        <button type="button" onClick={onContinue} className={authPrimary}>Áfram</button>
        <button type="button" onClick={onSkip} className={authSecondary}>
          Sleppa — við mælum þig á mælingadeginum
        </button>
      </div>
    </section>
  );
}

function AccountStage({
  accountPassword, setAccountPassword, workEmail, loginEmail, setLoginEmail, loading, error, onSubmit,
}: {
  accountPassword: string; setAccountPassword: (v: string) => void;
  workEmail: string; loginEmail: string; setLoginEmail: (v: string) => void;
  loading: boolean; error: string;
  onSubmit: () => void;
}) {
  const [show, setShow] = useState(false);
  const differs = loginEmail.trim().toLowerCase() !== workEmail.trim().toLowerCase();
  return (
    <section>
      <h1 className="text-2xl font-bold text-hc-ink">Stofnaðu aðganginn</h1>
      <p className="mt-1 text-sm text-hc-ink-2">
        Veldu netfangið og lykilorðið sem þú notar til að skrá þig inn hjá Lifeline.
      </p>

      <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <label className="block">
          <span className={authLabel}>Netfang til innskráningar</span>
          <input
            type="email"
            required
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            autoComplete="email"
            className={authInput}
          />
          <span className="mt-1.5 block text-xs leading-relaxed text-hc-ink-3">
            Boðið var sent á <strong className="break-all text-hc-ink-2">{workEmail}</strong>. Þú getur notað það eða
            persónulegt netfang ef þú vilt frekar.
            {differs && loginEmail.trim() && (
              <span className="mt-1 block text-hc-ok-ink">
                Þú skráir þig inn með <strong className="break-all">{loginEmail.trim().toLowerCase()}</strong>.
              </span>
            )}
          </span>
        </label>

        <label className="block">
          <span className={authLabel}>Lykilorð</span>
          <span className="relative block">
            <input
              type={show ? "text" : "password"}
              minLength={MIN_PW}
              value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
              onInvalid={(e) => e.currentTarget.setCustomValidity(`Lykilorðið þarf að vera minnst ${MIN_PW} stafir.`)}
              onInput={(e) => e.currentTarget.setCustomValidity("")}
              required
              autoFocus
              autoComplete="new-password"
              className={`${authInput} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Fela lykilorð" : "Sýna lykilorð"}
              aria-pressed={show}
              className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-hc-element text-hc-ink-2 hover:bg-hc-sunken-2"
            >
              {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
            </button>
          </span>
          <span className="mt-1 block text-xs text-hc-ink-3">Minnst {MIN_PW} stafir</span>
        </label>

        {error && <p role="alert" className="rounded-hc-element bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">{error}</p>}

        <button type="submit" disabled={loading || accountPassword.length < MIN_PW} className={authPrimary}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {loading ? "Lýk skráningu…" : "Ljúka skráningu"}
        </button>
      </form>
    </section>
  );
}

function DoneStage({ firstName, appAccess, signedIn, loginEmail, onGo }: {
  firstName: string; appAccess?: boolean; signedIn: boolean; loginEmail: string; onGo: () => void;
}) {
  return (
    <section className="text-center">
      <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-hc-brand-surface text-hc-brand-text">
        <Check className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-hc-ink">Allt klárt{firstName ? `, ${firstName}` : ""}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-hc-ink-2">Aðgangurinn þinn hjá Lifeline er tilbúinn.</p>

      <div className="mx-auto mt-5 max-w-md rounded-hc-element bg-hc-sunken p-4 text-left">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-hc-ink-2">Næstu skref</div>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-hc-ink">
          <li>Fyrirtækið skipuleggur mælingadaginn á vinnustaðnum — þú færð að vita af honum.</li>
          <li>Þegar að því kemur velurðu tíma í mælingu og dag fyrir blóðprufu.</li>
          <li>Læknir hjá Lifeline fer yfir niðurstöðurnar og hittir þig.</li>
        </ul>
      </div>

      {/* App access — only when the employer included it. */}
      {appAccess && (
        <div className="mx-auto mt-4 max-w-md rounded-hc-element p-4 text-left ring-1 ring-hc-hairline">
          <div className="mb-1.5 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-hc-brand-text" aria-hidden />
            <div className="text-sm font-semibold text-hc-ink">Lifeline-appið fylgir með</div>
          </div>
          <p className="mb-3 text-[13px] leading-relaxed text-hc-ink-2">
            Áætlunin þín, dagleg verkefni og þjálfun eru í appinu — skráðu þig inn með sama netfangi og lykilorði.
          </p>
          {APP_LIVE ? (
            <div className="flex flex-wrap gap-2">
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-hc-element bg-hc-ink px-3 text-xs font-semibold text-white">App Store</a>
              <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-hc-element bg-hc-ink px-3 text-xs font-semibold text-white">Google Play</a>
            </div>
          ) : (
            <p className="text-[12px] font-medium text-hc-ink-2">Væntanlegt á iPhone og Android — við sendum þér hlekkinn í tölvupósti.</p>
          )}
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        {signedIn ? (
          <button type="button" onClick={onGo} className={authPrimary}>Halda áfram</button>
        ) : (
          <Link href={`/account/login?next=${encodeURIComponent("/app")}${loginEmail ? `&email=${encodeURIComponent(loginEmail)}` : ""}`} className={authPrimary}>
            Skrá inn
          </Link>
        )}
      </div>
    </section>
  );
}

// ── Small components ────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-hc-brand-surface text-sm font-semibold text-hc-brand-text">
        {n}
      </div>
      <div>
        <div className="font-medium text-hc-ink">{title}</div>
        <div className="text-sm text-hc-ink-2">{children}</div>
      </div>
    </li>
  );
}

function maskKennitala(kt: string | null | undefined): string {
  const d = (kt || "").replace(/[^0-9]/g, "");
  if (d.length < 4) return "";
  return "••••••" + d.slice(-4);
}

function Checkbox({
  checked, onChange, children,
}: {
  checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-hc-element p-4 ring-1 ring-hc-border transition-colors hover:bg-hc-sunken">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#047857]" />
      <span className="text-sm leading-relaxed text-hc-ink">{children}</span>
    </label>
  );
}
