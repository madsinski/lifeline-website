"use client";

// Áskrift: choose, pay, done — and nothing else on the page.
//
// It used to be one card among thirteen on Stillingar og áskrift, reached
// with a #askrift fragment and a timed scroll. Somebody who pressed „Skrá mig
// í áskrift“ had chosen to buy; they should land on the purchase, not on a
// settings page that happens to contain it.
//
//   1 „Veldu áskrift“        the tiers from hc_packages, with why coaching is
//                            not on offer where it is not (no address yet →
//                            a link to add one; outside the region → said)
//   2 „Greiðsla“             what is bought, for how much, the terms and the
//                            waiver, then Straumur's hosted payment page via
//                            /api/hc/subscribe (or a test code)
//   3 „Áskriftin þín er virk“ after a free start, or back from Straumur once
//                            payment-status says it is paid
//
// ?pakki=app|thjalfun is the step, pushed rather than replaced, so Back
// returns to the choice. ?greidsla= is the return from Straumur.
//
// All the purchase logic lives in subscription-parts.tsx, shared with the
// paywall and the panel in Stillingar.

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCircle2, CreditCard, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import JourneyNav, { JourneyHeader } from "@/app/components/hc/JourneyNav";
import BackLink from "@/app/components/hc/BackLink";
import { hcBtn, hcCard, hcInput, hcKicker, hcPage } from "@/app/components/hc/ui";
import { useToast } from "@/app/components/hc/Toast";
import { Alert, Button, fmtDate, fmtIsk } from "@/app/components/account/ui";
import {
  PAY_STATE_COPY, TermsChecks, TestCodeField, isActivePaid, startSubscription, usePaymentStatus,
  useSubscriptionState, type Pkg, type SubState,
} from "@/app/components/hc/subscription-parts";
import { APP_PACKAGE_KEY, COACHING_PACKAGE_KEY, COACHING_TIER, NOT_IN_REGION_COPY } from "@/lib/hc/coaching-config";
import * as cache from "@/lib/hc/client-cache";

type Choice = "app" | "thjalfun";
type Api = (url: string, init?: RequestInit) => Promise<Response>;

/** The other agent's setup flow opens straight on the address step. */
const ADDRESS_HREF = "/app/uppsetning?skref=heimilisfang";
const TODAY_HREF = "/app/aaetlun?tab=today";

export default function AskriftPage() {
  return <Suspense><Askrift /></Suspense>;
}

function Askrift() {
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);

  const api: Api = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    return fetch(url, { ...init, headers: {
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers as Record<string, string> | undefined),
    } });
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const here = `${window.location.pathname}${window.location.search}`;
        router.replace(`/account/login?next=${encodeURIComponent(here)}`);
        return;
      }
      setReady(true);
    })();
  }, [router]);

  const pakki = params.get("pakki");
  const choice: Choice | null = pakki === "app" || pakki === "thjalfun" ? pakki : null;

  return (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-4 sm:pb-16 sm:pt-8">
        <JourneyHeader />
        <div className="sm:mb-4"><JourneyNav active="account" /></div>
        <div className="mt-4">
          {ready
            ? <Flow api={api} choice={choice}
                choose={(c) => router.push(c ? `/app/askrift?pakki=${c}` : "/app/askrift", { scroll: true })} />
            : <Shimmer />}
        </div>
      </div>
    </div>
  );
}

function Shimmer() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Hleð áskrift">
      <div className="h-10 w-2/3 rounded-hc-element hc-shimmer" />
      <div className="h-44 rounded-hc-card hc-shimmer" />
      <div className="h-44 rounded-hc-card hc-shimmer" />
    </div>
  );
}

function Flow({ api, choice, choose }: { api: Api; choice: Choice | null; choose: (c: Choice | null) => void }) {
  const { state, failed, load, retry } = useSubscriptionState(api);
  /* Set once something was started here: the free start, or a confirmed
     payment on the way back from Straumur. Drives screen 3. */
  const [done, setDone] = useState<"paid" | "trial" | null>(null);
  const finish = useCallback(async (how: "paid" | "trial") => {
    /* Í dag reads access from /api/hc/journey through the cache; a stale
       copy would show the wall for one more visit. */
    cache.invalidate("/api/hc/journey", "/api/hc/subscribe");
    await load();
    setDone(how);
    window.scrollTo({ top: 0 });
  }, [load]);
  const pay = usePaymentStatus(() => { void finish("paid"); });

  if (pay.state && !(pay.state === "paid" && done)) {
    return <PaymentReturnScreen state={pay.state === "paid" ? "checking" : pay.state}
      onRetry={() => { pay.clear(); choose(null); }} />;
  }
  if (failed && !state) {
    return (
      <Alert tone="bad" title="Ekki tókst að sækja áskriftina"
        actions={<Button variant="secondary" onClick={retry}>Reyna aftur</Button>}>
        Athugaðu nettenginguna og reyndu aftur.
      </Alert>
    );
  }
  if (!state) return <Shimmer />;

  if (done) return <ActiveScreen state={state} trialStarted={done === "trial"} />;

  const pkg = choice === "thjalfun" ? state.coachingPkg : choice === "app" ? state.package : null;
  const canBuy = choice === "thjalfun" ? !!state.coaching?.available : true;
  if (choice && pkg && canBuy && !alreadyHas(state, choice)) {
    return <PayScreen api={api} state={state} choice={choice} pkg={pkg}
      onBack={() => choose(null)} onDone={(trial) => void finish(trial ? "trial" : "paid")} />;
  }
  return <ChooseScreen state={state} onChoose={(c) => choose(c)} />;
}

/** Already on this tier and paying for it: nothing to buy. */
function alreadyHas(state: SubState, c: Choice): boolean {
  const s = state.subscription;
  if (!isActivePaid(s)) return false;
  return c === "thjalfun" ? s.tier === COACHING_TIER : true; // the app is inside both tiers
}

function StepKicker({ n, of = 2 }: { n: number; of?: number }) {
  return <p className={`${hcKicker} text-hc-brand-text`}>Skref {n} af {of}</p>;
}

/* ── Screen 1 ─────────────────────────────────────────────────────── */

function ChooseScreen({ state, onChoose }: { state: SubState; onChoose: (c: Choice) => void }) {
  const sub = state.subscription;
  const active = isActivePaid(sub) ? sub : null;
  const onCoaching = active?.tier === COACHING_TIER;
  const trial = sub?.trial && !sub.cancelled ? sub : null;
  const trialEnd = trial ? trial.trial_ends_at ?? trial.current_period_end : null;
  const showCoaching = !!state.coachingPkg && (state.coaching?.in_catalogue ?? false);

  return (
    <div className="space-y-4">
      <div>
        <StepKicker n={1} />
        <h1 className="mt-1 text-2xl font-bold text-hc-ink">Veldu áskrift</h1>
        <p className="mt-1 text-sm text-hc-ink-2">
          Mánaðaráskrift sem þú getur sagt upp hvenær sem er. Skýrslan þín og heilsuferðin eru opin óháð áskrift.
        </p>
      </div>

      {active && (
        <Alert tone="ok" compact>
          {onCoaching ? "Lifeline þjálfun er virk." : "Lifeline appið er virkt."}
          {active.current_period_end ? ` Næsta greiðsla ${fmtDate(active.current_period_end)}.` : ""}
        </Alert>
      )}
      {sub?.cancelled && (
        <Alert tone="info" compact>
          Áskriftinni hefur verið sagt upp{sub.ends_at ? `. Aðgangur er opinn til ${fmtDate(sub.ends_at)}.` : "."} Þú getur valið hana aftur hér.
        </Alert>
      )}
      {trial && (
        <Alert tone="info" compact>
          Þú ert á prufutíma{trialEnd ? ` til ${fmtDate(trialEnd)}` : ""}. Ef þú velur áskrift núna tekur hún við af prufutímanum.
        </Alert>
      )}

      {state.package && (
        <TierCard pkg={state.package} title="Lifeline appið" subtitle="Sjálfsafgreiðsla í símanum"
          status={active ? (onCoaching ? "Innifalið í þjálfuninni" : "Þín áskrift") : null}
          action={active ? null : (
            <button type="button" className={`${hcBtn.cta} w-full sm:w-auto`} onClick={() => onChoose("app")}>
              Velja appið
            </button>
          )} />
      )}

      {showCoaching && state.coachingPkg && (
        <TierCard pkg={state.coachingPkg} title="Lifeline þjálfun" subtitle="Appið og heilsuþjálfi, í Vestmannaeyjum"
          status={onCoaching ? "Þín áskrift" : null}
          action={onCoaching ? null : state.coaching?.available ? (
            <button type="button" className={`${hcBtn.cta} w-full sm:w-auto`} onClick={() => onChoose("thjalfun")}>
              {active ? "Uppfæra í þjálfun" : "Velja þjálfun"}
            </button>
          ) : state.coaching?.reason === "no_address" ? (
            <div className="space-y-3">
              <p className="flex gap-2 text-sm text-hc-ink-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />
                Þjálfunin er í boði í Vestmannaeyjum. Skráðu heimilisfangið þitt svo við sjáum hvort hún nær til þín.
              </p>
              <Link href={ADDRESS_HREF} className={hcBtn.secondary}>Skrá heimilisfang</Link>
            </div>
          ) : (
            <p className="flex gap-2 text-sm text-hc-ink-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {NOT_IN_REGION_COPY}
            </p>
          )} />
      )}

      {(active || trial) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {active && <Link href={TODAY_HREF} className={hcBtn.primary}>Fara í Í dag</Link>}
          <Link href="/app/adgangur#askrift" className={hcBtn.ghost}>Segja upp eða sjá greiðslur</Link>
        </div>
      )}
    </div>
  );
}

function TierCard({ pkg, title, subtitle, status, action }: {
  pkg: Pkg; title: string; subtitle: string;
  /** "Þín áskrift" and the like, in place of a button. */
  status: string | null;
  action: React.ReactNode;
}) {
  return (
    <section className={`${status ? hcCard.accent : hcCard.base} p-5 sm:p-6`} aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-hc-ink">{title}</h2>
          <p className="text-sm text-hc-ink-2">{subtitle}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="text-2xl font-bold tabular-nums text-hc-ink">{fmtIsk(pkg.price_isk)}</span>
          <span className="block text-xs font-semibold text-hc-ink-2">á mánuði</span>
        </p>
      </div>
      {pkg.includes?.length ? (
        <ul className="mt-3 space-y-1.5">
          {pkg.includes.map((x) => (
            <li key={x} className="flex gap-2 text-sm text-hc-ink-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4">
        {status
          ? <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-hc-brand-text"><CheckCircle2 className="h-4 w-4" aria-hidden /> {status}</p>
          : action}
      </div>
    </section>
  );
}

/* ── Screen 2 ─────────────────────────────────────────────────────── */

type SavedCard = { brand: string | null; last4: string | null };

function PayScreen({ api, state, choice, pkg, onBack, onDone }: {
  api: Api; state: SubState; choice: Choice; pkg: Pkg;
  onBack: () => void;
  onDone: (trial: boolean) => void;
}) {
  const coaching = choice === "thjalfun";
  const sub = state.subscription;
  /* The card-backed trial: only the app tier, only while cards are live, and
     only for somebody who never had one — or is in one without a card yet. */
  const trial = !coaching && state.cards_live
    && (state.trial_available || (!!sub?.trial && !sub.cancelled && !sub.card_saved_at));
  const upgrade = coaching && isActivePaid(sub);

  const [terms, setTerms] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ label: string; price: number; monthsFree: number } | null>(null);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [testCode, setTestCode] = useState("");
  const [busy, setBusy] = useState<"code" | "pay" | null>(null);
  const [closed, setClosed] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [card, setCard] = useState<SavedCard | null>(null);
  const toast = useToast();

  /* A card already on file is named, so nobody wonders whether to type it
     again. The payment page itself is Straumur's. */
  useEffect(() => {
    void (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      if (!uid) return;
      const { data } = await supabase.from("payment_methods").select("brand, last4, is_default, created_at")
        .eq("owner_type", "client").eq("owner_id", uid)
        .order("is_default", { ascending: false }).order("created_at", { ascending: false }).limit(1);
      const row = (data?.[0] ?? null) as SavedCard | null;
      if (row?.last4) setTimeout(() => setCard(row), 0);
    })();
  }, []);

  const price = trial ? pkg.price_isk : testCode.trim() ? 0 : applied?.price ?? pkg.price_isk;

  const tryCode = async () => {
    if (!code.trim()) return;
    setBusy("code"); setCodeMsg(null);
    const r = await api("/api/hc/discount", {
      method: "POST", body: JSON.stringify({ code, target: "subscription", package: APP_PACKAGE_KEY }),
    }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setBusy(null);
    if (r?.status === 429) { setCodeMsg("Of margar tilraunir. Reyndu aftur á eftir."); return; }
    /* One message for every kind of failure: the server gives one answer. */
    if (!j?.ok) { setApplied(null); setCodeMsg("Þessi kóði gildir ekki."); return; }
    setApplied({ label: j.label, price: j.price_isk, monthsFree: j.months_free ?? 0 });
  };

  const submit = async () => {
    if (busy) return;
    setBusy("pay"); setErr(null); setClosed(null);
    const res = await startSubscription(api, {
      packageKey: coaching ? COACHING_PACKAGE_KEY : APP_PACKAGE_KEY,
      terms, waiver, trial, testCode, code: applied ? code : undefined, returnTo: "askrift",
    });
    if (res.kind === "redirect") { window.location.assign(res.url); return; }
    setBusy(null);
    if (res.kind === "closed") { setClosed(res.message); return; }
    if (res.kind === "error") { setErr(res.message); toast.show(res.message, { tone: "bad" }); return; }
    onDone(res.trial);
  };

  const label = trial
    ? "Skrá kort og hefja prufutíma"
    : testCode.trim() ? "Hefja áskrift með prófunarkóða"
    : price === 0 ? "Hefja áskrift"
    : `Greiða með korti · ${fmtIsk(price)}`;

  return (
    <div className="space-y-4">
      <BackLink label="Til baka í val á áskrift" onBack={onBack} />
      <div>
        <StepKicker n={2} />
        <h1 className="mt-1 text-2xl font-bold text-hc-ink">Greiðsla</h1>
      </div>

      {/* What is bought, before anything is ticked. */}
      <section className={`${hcCard.base} p-5 sm:p-6`} aria-label="Pöntunin þín">
        <p className={`${hcKicker} text-hc-ink-2`}>Pöntunin þín</p>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <p className="font-bold text-hc-ink">{coaching ? "Lifeline þjálfun" : "Lifeline appið"}</p>
          <p className="text-right">
            {!trial && price !== pkg.price_isk && (
              <span className="mr-2 text-sm text-hc-ink-2 line-through">{fmtIsk(pkg.price_isk)}</span>
            )}
            <span className="text-xl font-bold tabular-nums text-hc-ink">{fmtIsk(price)}</span>
            <span className="text-sm text-hc-ink-2"> á mán.</span>
          </p>
        </div>
        {!trial && applied && !testCode.trim() && (
          <p className="mt-1 text-sm font-semibold text-hc-brand-text">
            {applied.label}{applied.monthsFree ? ` · ${applied.monthsFree === 1 ? "fyrsti mánuður frír" : `${applied.monthsFree} mánuðir fríir`}` : ""}
          </p>
        )}
        <p className="mt-2 text-sm text-hc-ink-2">
          {trial
            ? `Ekkert er skuldfært á ${state.trial_days} daga prufutímanum. Þegar honum lýkur hefst áskriftin og ${fmtIsk(pkg.price_isk)} eru skuldfærðar, síðan mánaðarlega. Þú getur sagt upp hvenær sem er áður en prufutímanum lýkur og þá er ekkert skuldfært.`
            : "Endurnýjast mánaðarlega. Þú getur sagt upp hvenær sem er og heldur aðgangi út tímabilið sem er greitt."}
        </p>
        {upgrade && (
          <p className="mt-2 text-sm text-hc-ink-2">
            Þjálfunin inniheldur allt appið og kemur í stað núverandi áskriftar frá og með deginum í dag.
          </p>
        )}
        {card && (
          <p className="mt-3 flex items-center gap-2 border-t border-hc-hairline pt-3 text-sm text-hc-ink-2">
            <CreditCard className="h-4 w-4 shrink-0 text-hc-ink-2" aria-hidden />
            Kort á skrá: {card.brand ?? "Kort"} sem endar á {card.last4}
          </p>
        )}
      </section>

      <section className={`${hcCard.base} space-y-3 p-5 sm:p-6`} aria-label="Skilmálar">
        {!trial && !coaching && (
          <details className="text-sm text-hc-ink-2" open={code ? true : undefined}>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-hc-ink-2">Ertu með afsláttarkóða?</summary>
            <label htmlFor="askrift-disc" className="mt-1 block text-xs font-semibold text-hc-ink-2">Afsláttarkóði</label>
            <div className="mt-1 flex flex-wrap gap-2">
              <input id="askrift-disc" value={code}
                onChange={(e) => { setCode(e.target.value); setApplied(null); setCodeMsg(null); }}
                autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="KÓÐI"
                className={`${hcInput} min-h-11 min-w-0 flex-1 uppercase`} />
              <button type="button" onClick={() => void tryCode()} disabled={busy !== null || !code.trim()} className={hcBtn.secondary}>
                {busy === "code" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Nota kóða"}
              </button>
            </div>
            {codeMsg && <p className="mt-1 text-sm text-hc-ink-2" role="status">{codeMsg}</p>}
          </details>
        )}
        {!trial && <TestCodeField id={`askrift-test-${choice}`} value={testCode} onChange={(v) => { setTestCode(v); setErr(null); setClosed(null); }} />}

        <div className="border-t border-hc-hairline pt-4">
          <TermsChecks terms={terms} waiver={waiver} onTerms={setTerms} onWaiver={setWaiver} trial={trial} />
        </div>

        {closed && <Alert tone="info" compact>{closed}</Alert>}
        {err && <p className="text-sm font-semibold text-hc-bad-ink" role="alert">{err}</p>}

        <button type="button" onClick={() => void submit()} disabled={busy !== null || !terms || !waiver}
          className={`${hcBtn.cta} w-full`}>
          {busy === "pay" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {label}
        </button>
        {!terms || !waiver ? (
          <p className="text-xs text-hc-ink-2">Hakaðu við báða reitina til að halda áfram.</p>
        ) : price > 0 && !trial ? (
          <p className="text-xs text-hc-ink-2">Þú greiðir á öruggri greiðslusíðu Straums og kemur svo aftur hingað.</p>
        ) : null}
      </section>
    </div>
  );
}

/* ── Screen 3 ─────────────────────────────────────────────────────── */

function ActiveScreen({ state, trialStarted }: { state: SubState; trialStarted: boolean }) {
  const sub = state.subscription;
  const coaching = sub?.tier === COACHING_TIER;
  const pkg = coaching ? state.coachingPkg : state.package;
  const next = sub?.trial ? sub.trial_ends_at ?? sub.current_period_end : sub?.current_period_end;
  return (
    <section className={`${hcCard.raised} p-6 text-center sm:p-8`} aria-live="polite">
      <CheckCircle2 className="mx-auto h-12 w-12 text-hc-brand-text" aria-hidden />
      <h1 className="mt-3 text-2xl font-bold text-hc-ink">
        {trialStarted ? "Prufutíminn er hafinn" : "Áskriftin þín er virk"}
      </h1>
      <p className="mt-1 text-sm text-hc-ink-2">
        {coaching ? "Lifeline þjálfun" : "Lifeline appið"}
        {next ? (trialStarted ? ` · áskriftin hefst ${fmtDate(next)}` : ` · næsta greiðsla ${fmtDate(next)}`) : ""}
      </p>
      {pkg?.includes?.length ? (
        <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left">
          {pkg.includes.map((x) => (
            <li key={x} className="flex gap-2 text-sm text-hc-ink-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <Link href={TODAY_HREF} className={`${hcBtn.cta} mt-6 w-full sm:w-auto`}>Fara í Í dag</Link>
      <p className="mt-3 text-xs text-hc-ink-2">Kvittunin er undir Stillingar og áskrift → Greiðslur og kvittanir.</p>
    </section>
  );
}

function PaymentReturnScreen({ state, onRetry }: { state: "checking" | "waiting" | "expired" | "failed"; onRetry: () => void }) {
  if (state === "checking") {
    return (
      <section className={`${hcCard.base} flex items-center gap-3 p-6`} role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-hc-brand-text" aria-hidden />
        <p className="text-sm text-hc-ink-2">{PAY_STATE_COPY.checking}</p>
      </section>
    );
  }
  return (
    <Alert tone={state === "waiting" ? "info" : "warn"} title={state === "waiting" ? "Greiðslan er á leiðinni" : "Ekkert var skuldfært"}
      actions={<Button variant="secondary" onClick={onRetry}>{state === "waiting" ? "Til baka í áskrift" : "Reyna aftur"}</Button>}>
      {PAY_STATE_COPY[state]}
    </Alert>
  );
}
