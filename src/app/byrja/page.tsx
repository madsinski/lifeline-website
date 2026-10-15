"use client";

/*
 * /byrja — the new way in.
 *
 * Built beside the old flow rather than on top of it, so nothing currently
 * being tested breaks while this settles.
 *
 * What was wrong with the old sequence, measured rather than felt:
 *
 *   six screens before the journey began — signup form, a terms step with
 *   two scroll panes and three checkboxes, an email-confirmation detour out
 *   to a mailbox, an eight-slide deck, a gate redirect, then a route
 *   chooser — and only then a twelve-step journey. A study of 129 flows put
 *   the median at eleven screens for the WHOLE thing.
 *
 *   The confirmation detour is the structural one: the journey page sends
 *   anyone unconfirmed back to the login screen, so a new account could see
 *   nothing at all until it had left for an inbox and come back. Everything
 *   built past that point sits behind a door most people do not walk back
 *   through.
 *
 * The shape here, which is what Next Health's public member path does and
 * what the mental-health apps do: show what you get before asking who they
 * are.
 *
 *   1  what are you here for          (no account yet)
 *   2  how much do you move now
 *   3  roughly how old are you
 *   4  here is what that produces     ← the answers, visibly used
 *   5  which route                    ← suggested, not decided for them
 *   6  name, email, password + one   ← last; "Sleppa spurningum" jumps
 *      terms box (+ two opt-outs)       straight here from any step
 *
 * Answers live in sessionStorage until step 6, so nobody is written to the
 * database for answering three questions and then changing their mind.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AuthShell, { authInput, authLabel, authLink, authPrimary } from "@/app/components/AuthShell";
import { ArrowRight, Check, Eye, EyeOff, Loader2, Stethoscope, Dumbbell } from "lucide-react";
import {
  AGES, GOALS, MOVES, START_KEY, daysPerWeek, previewLines, suggestsCheck,
  type AgeKey, type GoalKey, type MoveKey, type StartAnswers,
} from "@/lib/hc/start-flow";
import { SIGNUP_TERMS_VERSION, ensureSignupConsentRecorded, safeNextPath } from "@/lib/signup-consent";
import { authErrorIs } from "@/lib/auth-errors-is";
import CheckEmail from "./CheckEmail";

type Step = 0 | 1 | 2 | 3 | 4 | 5;
const LAST: Step = 5;

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
  /* ?leid=coach|check preselects the route (pricing CTAs), ?next= is where
     to land after confirming (same-origin only), ?ref= a referral code. */
  const leid = params.get("leid");
  const next = safeNextPath(params.get("next"));
  const refCode = (params.get("ref") || "").slice(0, 64);

  const [step, setStep] = useState<Step>(0);
  const [a, setA] = useState<StartAnswers>({});
  const [track, setTrack] = useState<"check" | "coach" | null>(
    leid === "check" || leid === "coach" ? leid : null);

  // account fields, asked once, at the end
  const [email, setEmail] = useState(() => params.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [accept, setAccept] = useState(false);
  /* Opt-OUTS, unticked by default — same meaning and wording as the
     consent stage they replace. Ticking one means "do not". */
  const [researchOptOut, setResearchOptOut] = useState(false);
  const [marketingOptOut, setMarketingOptOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /* Declared with the other state rather than below submit(): a useCallback
     that closes over a later const reads fine and is a TDZ error. */
  const [sent, setSent] = useState<null | "sent" | "exists">(null);

  /* Restore on reload so a dropped connection does not cost the answers. */
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(START_KEY);
        if (raw) setA(JSON.parse(raw) as StartAnswers);
      } catch { /* private mode */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      try { window.sessionStorage.setItem(START_KEY, JSON.stringify(a)); } catch { /* private mode */ }
    }, 0);
    return () => clearTimeout(t);
  }, [a]);

  /* Answering moves on by itself. A question with four buttons and then a
     "Next" button asks the person to confirm a tap they already made. */
  const pick = <K extends keyof StartAnswers>(k: K, v: StartAnswers[K]) => {
    setA((prev) => ({ ...prev, [k]: v }));
    setTimeout(() => setStep((s) => (s < LAST ? ((s + 1) as Step) : s)), 160);
  };

  const suggested = useMemo(() => (suggestsCheck(a) ? "check" : "coach"), [a]);
  const redirectTo = useCallback(
    () => `${window.location.origin}${next || "/app"}`, [next]);
  const loginHref = `/account/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  const submit = useCallback(async () => {
    setBusy(true); setErr("");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        /* Everything the person chose travels with the account, so a
           confirmation opened on another device still carries it. The
           terms + opt-outs are copied onto the clients row server side on
           the first signed-in load (/api/account/signup-consent) — the
           browser has no session yet to write them with. */
        data: {
          full_name: name.trim() || null,
          start_answers: a,
          start_track: track ?? suggested,
          terms_version: SIGNUP_TERMS_VERSION,
          terms_accepted_at: new Date().toISOString(),
          research_opt_out: researchOptOut,
          marketing_opt_out: marketingOptOut,
          ...(refCode ? { referred_by: refCode } : {}),
        },
        emailRedirectTo: redirectTo(),
      },
    });
    if (error) { setBusy(false); setErr(authErrorIs(error)); return; }

    /* An address that already has a confirmed account: Supabase answers with
       a user that has no identities and sends nothing. Say so. */
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setBusy(false);
      setSent("exists");
      return;
    }

    if (data.session) {
      /* Supabase returned a session, so confirmation is not being enforced
         and the person can simply go in. */
      await ensureSignupConsentRecorded();
      router.push(next || "/app");
      return;
    }
    setBusy(false);
    /* No session means a confirmation mail is on its way. Said plainly, on
       this screen, rather than by bouncing them to a login form. */
    setSent("sent");
  }, [email, password, name, a, track, suggested, researchOptOut, marketingOptOut, refCode, redirectTo, next, router]);

  const back = () => setStep((s) => (s > 0 ? ((s - 1) as Step) : s));
  const skip = (
    <button type="button" onClick={() => setStep(LAST)}
      className="mt-5 block min-h-11 w-full rounded-hc-element text-center text-sm font-semibold text-hc-ink-2 underline-offset-2 hover:text-hc-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
      Sleppa spurningum
    </button>
  );

  return (
    <AuthShell
      step={sent ? undefined : { n: step + 1, of: LAST + 1 }}
      back={step > 0 && !sent ? back : undefined}
      footer={!sent && (
        <>Ertu þegar með aðgang? <Link href={loginHref} className={authLink}>Skrá inn</Link></>
      )}
    >
        {sent && (
          <CheckEmail
            email={email.trim()}
            redirectTo={redirectTo()}
            alreadyRegistered={sent === "exists"}
            loginHref={loginHref}
            onChangeEmail={() => { setSent(null); setStep(LAST); }}
          />
        )}

        {!sent && step === 0 && (
          <Question title="Hvað ertu að leita að?" hint="Veldu það sem skiptir mestu núna. Þú getur breytt þessu síðar.">
            {GOALS.map((g) => (
              <Choice key={g.key} active={a.goal === g.key} onClick={() => pick("goal", g.key as GoalKey)}
                label={g.label} hint={g.hint} />
            ))}
          </Question>
        )}

        {!sent && step === 1 && (
          <Question title="Hvað hreyfir þú þig mikið núna?" hint="Við byrjum þar sem þú ert, ekki þar sem sniðmát segir.">
            {MOVES.map((m) => (
              <Choice key={m.key} active={a.move === m.key} onClick={() => pick("move", m.key as MoveKey)} label={m.label} />
            ))}
          </Question>
        )}

        {!sent && step === 2 && (
          <Question title="Á hvaða aldri ertu?" hint="Viðmiðin okkar eru aldursbundin — þess vegna spyrjum við.">
            {AGES.map((x) => (
              <Choice key={x.key} active={a.age === x.key} onClick={() => pick("age", x.key as AgeKey)} label={x.label} />
            ))}
          </Question>
        )}

        {!sent && step === 3 && (
          <section>
            <h1 className="text-2xl font-bold text-hc-ink">Þetta leggjum við til</h1>
            <p className="mt-1 text-sm text-hc-ink-2">Byggt á svörunum þínum. Þjálfarinn fínstillir þetta með þér.</p>
            <ul className="mt-5 space-y-2">
              {previewLines(a).map((l) => (
                <li key={l} className="flex items-start gap-2.5 rounded-hc-element bg-hc-sunken p-3.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />
                  <span className="text-sm text-hc-ink">{l}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-hc-ink-3">
              Lifeline mælir og fylgist með — við greinum ekki sjúkdóma og komum ekki í stað læknis.
            </p>
            <Next onClick={() => setStep(4)} label="Áfram" />
          </section>
        )}

        {!sent && step === 4 && (
          <section>
            <h1 className="text-2xl font-bold text-hc-ink">Hvernig viltu byrja?</h1>
            <p className="mt-1 text-sm text-hc-ink-2">
              {suggested === "check"
                ? "Miðað við svörin þín mælum við með að byrja á mælingum."
                : "Miðað við svörin þín kemstu beint af stað í þjálfun."}
            </p>
            <div className="mt-5 space-y-3">
              <Route
                icon={<Stethoscope className="h-5 w-5" aria-hidden />}
                title="Heilsufarsskoðun"
                body="Mælingar og blóðprufa, skýrsla sem læknir fer yfir, og áætlun út frá þínum tölum. Tímar bókast í Medalia."
                active={(track ?? suggested) === "check"}
                recommended={suggested === "check"}
                onClick={() => setTrack("check")}
              />
              <Route
                icon={<Dumbbell className="h-5 w-5" aria-hidden />}
                title="Þjálfun í appinu"
                body={`${daysPerWeek(a.move)} æfingar á viku, næring og svefn — án mælinga til að byrja með.`}
                active={(track ?? suggested) === "coach"}
                recommended={suggested === "coach"}
                onClick={() => setTrack("coach")}
              />
            </div>
            <p className="mt-3 text-xs text-hc-ink-3">Hvort tveggja er hægt síðar — þú ert ekki að loka neinni leið.</p>
            <Next onClick={() => setStep(LAST)} label="Áfram" />
          </section>
        )}

        {!sent && step < LAST && skip}

        {!sent && step === LAST && (
          <section>
            <h1 className="text-2xl font-bold text-hc-ink">Búa til aðgang</h1>
            <p className="mt-1 text-sm text-hc-ink-2">Síðasta skrefið. Við geymum svörin þín.</p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => { e.preventDefault(); void submit(); }}
              /* Bring the rejected field into view: the browser's own bubble
                 is pinned to the input, which on a phone can be above the
                 fold when the button at the bottom is pressed. */
              onInvalid={(e) => {
                const el = e.target as HTMLInputElement;
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              <Field label="Nafn" value={name} onChange={setName} required autoComplete="name"
                invalidMessage="Sláðu inn nafnið þitt." />
              <Field label="Netfang" value={email} onChange={setEmail} type="email" required autoComplete="email"
                invalidMessage="Sláðu inn gilt netfang." />
              <label className="block">
                <span className={authLabel}>Lykilorð</span>
                <span className="relative block">
                  <input
                    type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    required minLength={12} autoComplete="new-password"
                    onInvalid={(e) => e.currentTarget.setCustomValidity("Lykilorðið þarf að vera minnst 12 stafir.")}
                    onInput={(e) => e.currentTarget.setCustomValidity("")}
                    className={`${authInput} pr-12`}
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Fela lykilorð" : "Sýna lykilorð"} aria-pressed={showPw}
                    className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-hc-element text-hc-ink-2 hover:bg-hc-sunken-2">
                    {showPw ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                  </button>
                </span>
                <span className="mt-1 block text-xs text-hc-ink-3">Minnst 12 stafir</span>
              </label>

              {/* One line, not a stage with two scroll panes and three boxes.
                  The documents are linked and open in their own tab; making
                  somebody scroll a licence inside a 200px window on a phone
                  does not make the consent better informed. */}
              <label className="flex items-start gap-3 pt-1">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} required
                  onInvalid={(e) => e.currentTarget.setCustomValidity("Hakaðu við til að samþykkja skilmálana.")}
                  onInput={(e) => e.currentTarget.setCustomValidity("")}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-hc-control accent-[#047857]" />
                <span className="text-sm leading-snug text-hc-ink">
                  Ég samþykki{" "}
                  <a href="/terms" target="_blank" rel="noreferrer" className={authLink}>notkunarskilmála</a>
                  {" "}og{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer" className={authLink}>persónuverndarstefnu</a>
                  {" "}Lifeline Health.
                </span>
              </label>

              <fieldset className="space-y-2.5 rounded-hc-element bg-hc-sunken p-3.5">
                <legend className="sr-only">Valfrjálst</legend>
                <p className="text-xs font-semibold text-hc-ink-2">Valfrjálst</p>
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={researchOptOut} onChange={(e) => setResearchOptOut(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-hc-control accent-[#047857]" />
                  <span className="text-xs leading-snug text-hc-ink-2">
                    <strong className="text-hc-ink">Afþakka rannsóknanotkun.</strong>{" "}
                    Ekki nota nafnlaus gögn mín til að bæta Lifeline eða í klíníska rannsókn.
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={marketingOptOut} onChange={(e) => setMarketingOptOut(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-hc-control accent-[#047857]" />
                  <span className="text-xs leading-snug text-hc-ink-2">
                    <strong className="text-hc-ink">Afþakka markaðspóst.</strong>{" "}
                    Ekki senda mér vörufréttir eða kynningar frá Lifeline.
                  </span>
                </label>
              </fieldset>

              <button type="submit" disabled={busy} className={authPrimary}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Búa til aðgang
              </button>
              {err && <p role="alert" className="rounded-hc-element bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">{err}</p>}
            </form>
          </section>
        )}
    </AuthShell>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="text-2xl font-bold leading-tight text-hc-ink">{title}</h1>
      {hint && <p className="mt-1.5 text-sm leading-relaxed text-hc-ink-2">{hint}</p>}
      <div className="mt-5 space-y-2.5">{children}</div>
    </section>
  );
}

/** A full-width target. 56px tall because a thumb is not a mouse. */
function Choice({ label, hint, active, onClick }: {
  label: string; hint?: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`flex min-h-14 w-full items-center gap-3 rounded-hc-element border-2 px-4 py-3 text-left transition ${
        active ? "border-hc-brand-dark bg-hc-brand-surface" : "border-hc-border bg-hc-surface hover:border-hc-control"}`}>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-hc-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-hc-ink-3">{hint}</span>}
      </span>
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
        active ? "border-hc-brand-dark bg-hc-brand-dark text-white" : "border-hc-control"}`}>
        {active && <Check className="h-3 w-3" aria-hidden />}
      </span>
    </button>
  );
}

function Route({ icon, title, body, active, recommended, onClick }: {
  icon: React.ReactNode; title: string; body: string; active?: boolean; recommended?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`w-full rounded-hc-element border-2 p-4 text-left transition ${
        active ? "border-hc-brand-dark bg-hc-brand-surface" : "border-hc-border bg-hc-surface hover:border-hc-control"}`}>
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-hc-brand-text">{icon}</span>
        <span className="font-bold text-hc-ink">{title}</span>
        {recommended && (
          <span className="rounded-full bg-hc-surface px-2 py-0.5 text-[11px] font-bold text-hc-brand-text ring-1 ring-hc-brand/40">
            Mælt með
          </span>
        )}
      </span>
      <span className="mt-1.5 block text-sm leading-relaxed text-hc-ink-2">{body}</span>
    </button>
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
        /* The browser's own text is English on an Icelandic page. */
        onInvalid={(e) => invalidMessage && e.currentTarget.setCustomValidity(invalidMessage)}
        onInput={(e) => e.currentTarget.setCustomValidity("")}
        className={authInput}
      />
    </label>
  );
}

function Next({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`mt-6 ${authPrimary}`}>
      {label} <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  );
}
