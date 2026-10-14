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
 *   6  email + password               ← last, and that is all
 *
 * Answers live in sessionStorage until step 6, so nobody is written to the
 * database for answering three questions and then changing their mind.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LifelineLogo from "@/app/components/LifelineLogo";
import { ArrowLeft, ArrowRight, Check, Loader2, Stethoscope, Dumbbell } from "lucide-react";
import {
  AGES, GOALS, MOVES, START_KEY, daysPerWeek, previewLines, suggestsCheck,
  type AgeKey, type GoalKey, type MoveKey, type StartAnswers,
} from "@/lib/hc/start-flow";
import { PUBLIC_TERMS_VERSION } from "@/lib/public-pages-content";

type Step = 0 | 1 | 2 | 3 | 4 | 5;
const LAST: Step = 5;

export default function StartPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [a, setA] = useState<StartAnswers>({});
  const [track, setTrack] = useState<"check" | "coach" | null>(null);

  // account fields, asked once, at the end
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /* Declared with the other state rather than below submit(): a useCallback
     that closes over a later const reads fine and is a TDZ error. */
  const [sent, setSent] = useState(false);

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

  const submit = useCallback(async () => {
    setBusy(true); setErr("");
    const origin = window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() || null, start_answers: a, start_track: track ?? suggested },
        emailRedirectTo: `${origin}/app`,
      },
    });
    if (error) { setBusy(false); setErr(error.message); return; }

    /* The answers go with the account rather than after it: they are in
       user_metadata above, so a confirmation that lands on another device
       still carries them. */
    if (data.session) {
      /* Supabase returned a session, so confirmation is not being enforced
         and the person can simply go in. */
      router.push("/app");
      return;
    }
    setBusy(false);
    setStep(LAST);
    setErr("");
    /* No session means a confirmation mail is on its way. Said plainly, on
       this screen, rather than by bouncing them to a login form. */
    setSent(true);
  }, [email, password, name, a, track, suggested, router]);

  const back = () => setStep((s) => (s > 0 ? ((s - 1) as Step) : s));

  return (
    <main className="min-h-screen bg-[#F4F7F9]">
      {/* One bar, always visible, so the length of this is never a mystery. */}
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-5 py-3">
          {step > 0 && !sent ? (
            <button type="button" onClick={back} aria-label="Til baka"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <Link href="/" aria-label="Lifeline"><LifelineLogo size="sm" /></Link>
          )}
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-[#047857] transition-all duration-300"
              style={{ width: `${((step + 1) / (LAST + 1)) * 100}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-500">
            {step + 1}/{LAST + 1}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-5 pb-16 pt-7">
        {step === 0 && (
          <Question title="Hvað ertu að leita að?" hint="Veldu það sem skiptir mestu núna. Þú getur breytt þessu síðar.">
            {GOALS.map((g) => (
              <Choice key={g.key} active={a.goal === g.key} onClick={() => pick("goal", g.key as GoalKey)}
                label={g.label} hint={g.hint} />
            ))}
          </Question>
        )}

        {step === 1 && (
          <Question title="Hvað hreyfir þú þig mikið núna?" hint="Við byrjum þar sem þú ert, ekki þar sem sniðmát segir.">
            {MOVES.map((m) => (
              <Choice key={m.key} active={a.move === m.key} onClick={() => pick("move", m.key as MoveKey)} label={m.label} />
            ))}
          </Question>
        )}

        {step === 2 && (
          <Question title="Á hvaða aldri ertu?" hint="Viðmiðin okkar eru aldursbundin — þess vegna spyrjum við.">
            {AGES.map((x) => (
              <Choice key={x.key} active={a.age === x.key} onClick={() => pick("age", x.key as AgeKey)} label={x.label} />
            ))}
          </Question>
        )}

        {step === 3 && (
          <section>
            <h1 className="text-2xl font-bold text-[#0F172A]">Þetta leggjum við til</h1>
            <p className="mt-1 text-sm text-slate-600">Byggt á svörunum þínum. Þjálfarinn fínstillir þetta með þér.</p>
            <ul className="mt-5 space-y-2">
              {previewLines(a).map((l) => (
                <li key={l} className="flex items-start gap-2.5 rounded-xl bg-white p-3.5 shadow-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#047857]" aria-hidden />
                  <span className="text-sm text-[#0F172A]">{l}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Lifeline mælir og fylgist með — við greinum ekki sjúkdóma og komum ekki í stað læknis.
            </p>
            <Next onClick={() => setStep(4)} label="Áfram" />
          </section>
        )}

        {step === 4 && (
          <section>
            <h1 className="text-2xl font-bold text-[#0F172A]">Hvernig viltu byrja?</h1>
            <p className="mt-1 text-sm text-slate-600">
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
            <p className="mt-3 text-xs text-slate-500">Hvort tveggja er hægt síðar — þú ert ekki að loka neinni leið.</p>
            <Next onClick={() => setStep(LAST)} label="Áfram" />
          </section>
        )}

        {step === LAST && !sent && (
          <section>
            <h1 className="text-2xl font-bold text-[#0F172A]">Búa til aðgang</h1>
            <p className="mt-1 text-sm text-slate-600">Síðasta skrefið. Við geymum svörin þín.</p>
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => { e.preventDefault(); void submit(); }}
              /* Bring the rejected field into view: the browser's own bubble
                 is pinned to the input, which on a phone can be above the
                 fold when the button at the bottom is pressed. */
              onInvalid={(e) => {
                const el = e.target as HTMLInputElement;
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              <Field label="Nafn" value={name} onChange={setName} autoComplete="name" />
              <Field label="Netfang" value={email} onChange={setEmail} type="email" required autoComplete="email" />
              <Field label="Lykilorð" value={password} onChange={setPassword} type="password" required
                minLength={12} autoComplete="new-password" hint="Minnst 12 stafir"
                invalidMessage="Lykilorðið þarf að vera minnst 12 stafir." />

              {/* One line, not a stage with two scroll panes and three boxes.
                  The documents are linked and open in their own tab; making
                  somebody scroll a licence inside a 200px window on a phone
                  does not make the consent better informed. */}
              <label className="flex items-start gap-2.5 pt-1">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} required
                  className="mt-0.5 h-4 w-4 rounded border-slate-400 text-[#047857]" />
                <span className="text-xs leading-snug text-slate-600">
                  Ég samþykki{" "}
                  <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold underline">notkunarskilmála</a>
                  {" "}og{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold underline">persónuverndarstefnu</a>
                  {" "}Lifeline Health ({PUBLIC_TERMS_VERSION}).
                </span>
              </label>

              <button type="submit" disabled={busy || !accept}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#047857] py-3 font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Búa til aðgang
              </button>
              {!accept && (
                <p className="text-center text-xs text-amber-700">Hakaðu við skilmálana til að halda áfram.</p>
              )}
              {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
            </form>
            <p className="mt-4 text-center text-sm text-slate-600">
              Ertu þegar með aðgang?{" "}
              <Link href="/account/login" className="font-semibold text-[#047857] underline">Skrá inn</Link>
            </p>
          </section>
        )}

        {sent && (
          <section className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-[#047857]">
              <Check className="h-7 w-7" aria-hidden />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-[#0F172A]">Aðgangurinn er til</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
              Við sendum staðfestingu á <strong className="text-[#0F172A]">{email}</strong>. Smelltu á hlekkinn
              þar og þá ertu kominn inn — svörin þín bíða þín.
            </p>
            <Link href="/account/login"
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#047857] px-5 font-semibold text-white">
              Skrá inn
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}

function Question({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="text-2xl font-bold leading-tight text-[#0F172A]">{title}</h1>
      {hint && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{hint}</p>}
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
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left transition ${
        active ? "border-[#047857] shadow-sm" : "border-transparent shadow-sm hover:border-slate-300"}`}>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-[#0F172A]">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </span>
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
        active ? "border-[#047857] bg-[#047857] text-white" : "border-slate-300"}`}>
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
      className={`w-full rounded-2xl border-2 bg-white p-4 text-left transition ${
        active ? "border-[#047857] shadow-sm" : "border-transparent shadow-sm hover:border-slate-300"}`}>
      <span className="flex items-center gap-2">
        <span className="text-[#047857]">{icon}</span>
        <span className="font-bold text-[#0F172A]">{title}</span>
        {recommended && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-[#047857]">
            Mælt með
          </span>
        )}
      </span>
      <span className="mt-1.5 block text-sm leading-relaxed text-slate-600">{body}</span>
    </button>
  );
}

function Field({ label, value, onChange, type = "text", required, minLength, hint, autoComplete, invalidMessage }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
  minLength?: number; hint?: string; autoComplete?: string; invalidMessage?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        required={required} minLength={minLength} autoComplete={autoComplete}
        /* The browser's own text is English on an Icelandic page. */
        onInvalid={(e) => invalidMessage && e.currentTarget.setCustomValidity(invalidMessage)}
        onInput={(e) => e.currentTarget.setCustomValidity("")}
        className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[16px] text-[#0F172A] outline-none focus:border-[#047857]"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Next({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#047857] py-3 font-bold text-white transition hover:bg-emerald-800">
      {label} <ArrowRight className="h-4 w-4" aria-hidden />
    </button>
  );
}
