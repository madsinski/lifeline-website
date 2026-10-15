"use client";

// The app, once the trial is over.
//
// ── What this blocks, and what it must not ───────────────────────────
//
// Only the subscription's own surfaces: Æfingar, Næring, the daily
// checklist. The report, the coach thread and the journey stay open, because
// a health-check customer paid for those and appAccess() already grants
// those people access for good — see src/lib/hc/subscription.ts. Nobody who
// bought a workup should meet this screen.
//
// ── Why it says the price before the button ──────────────────────────
//
// A paywall that hides what it costs until you commit is the kind that gets
// a chargeback. The price, what it includes and how to stop are all on the
// card before anything is pressed.
//
// The code box is deliberate about its answers: the server reports only
// whether a code works, never why not, so this cannot be used to hunt for
// real ones. The price shown after a code comes from the server too — the
// browser never computes a discount, and the charge is whatever the server
// decided it was.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, Loader2, Lock } from "lucide-react";
import { Alert, Button, SectionCard, fmtDate, fmtIsk, useDialog } from "@/app/components/account/ui";
import { hcInput } from "./ui";
import { useToast } from "./Toast";
import { STRAUMUR_CARDS_LIVE } from "@/lib/straumur";

/**
 * Sent with every purchase from the website, so the server can insist on the
 * withdrawal waiver for web purchases while the mobile app (which does not
 * send it yet) is let through. See src/lib/hc/waiver.ts.
 */
export const WEB_CLIENT_HEADER = { "x-lifeline-client": "web" } as const;

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * The withdrawal-right waiver, worded from section 8 of the söluskilmálar.
 *
 * A service delivered at once inside the 14-day cooling-off period is only
 * exempt from withdrawal once fully performed if the consumer asked for it
 * to start straight away and acknowledged that (d-liður 1. mgr. 18. gr.
 * laga nr. 16/2016). Section 8 says the consumer agrees to both "á
 * söluskjá" — this is that agreement, a separate tick from the terms,
 * never pre-ticked. Shared with the health-check checkout.
 */
export const WITHDRAWAL_WAIVER_LABEL =
  "Ég óska þess að þjónustan hefjist strax, innan 14 daga frestsins til að falla frá samningi, og staðfesti að rétturinn til að falla frá samningnum fellur niður þegar þjónustan hefur að fullu verið innt af hendi (sbr. d-lið 1. mgr. 18. gr. laga nr. 16/2016 og 8. gr. söluskilmála).";

/** Server answers in plain Icelandic; anything raw (a code, an English message) gets a sentence instead. */
function errorText(status: number | undefined, raw: unknown): string {
  if (status === undefined) return "Engin tenging. Athugaðu netið og reyndu aftur.";
  if (status === 401) return "Innskráningin rann út. Skráðu þig inn aftur og reyndu svo.";
  if (status === 402) return "Greiðslan tókst ekki. Ekkert var skuldfært — reyndu aftur eða annað kort.";
  if (status === 404) return "Áskriftin fannst ekki. Hafðu samband við contact@lifelinehealth.is.";
  if (status === 429) return "Of margar tilraunir. Reyndu aftur eftir smástund.";
  const msg = typeof raw === "string" ? raw : "";
  // The route's own Icelandic sentences are fine to show as they are.
  if (/^[A-ZÁÐÉÍÓÚÝÞÆÖ][^_]*[.!]$/.test(msg) && /[áðéíóúýþæö]/i.test(msg)) return msg;
  return "Ekki tókst að hefja áskrift. Reyndu aftur.";
}

interface Pkg {
  name: string;
  tagline: string | null;
  description: string | null;
  includes: string[] | null;
  price_isk: number;
  interval_months: number | null;
}

const kr = fmtIsk;

export default function Paywall({ api, pkg, onDone, trialEndsAt, embedded = false, mode = "subscribe", trialDays = 14 }: {
  api: Api;
  /**
   * subscribe  pay now, the first month starts today
   * trial      save a card and start the free trial; the subscription starts
   *            when the trial ends unless cancelled before (cards live only)
   */
  mode?: "subscribe" | "trial";
  trialDays?: number;
  /** Inside a card that already has a heading (Stillingar): no card, lock or title of its own. */
  embedded?: boolean;
  pkg: Pkg | null;
  /** Reload the surfaces once there is a subscription. */
  onDone: () => Promise<void> | void;
  /** When the trial ran out, so the copy can be specific. */
  trialEndsAt?: string | null;
}) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ label: string; price: number; monthsFree: number } | null>(null);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const [busy, setBusy] = useState<"code" | "pay" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  if (!pkg) {
    return <div className="h-48 rounded-3xl hc-shimmer" aria-busy="true" aria-label="Hleð" />;
  }

  const trial = mode === "trial" && STRAUMUR_CARDS_LIVE;
  const price = trial ? pkg.price_isk : applied?.price ?? pkg.price_isk;

  const tryCode = async () => {
    if (!code.trim()) return;
    setBusy("code"); setCodeMsg(null); setErr(null);
    const r = await api("/api/hc/discount", {
      method: "POST", body: JSON.stringify({ code, target: "subscription" }),
    }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setBusy(null);
    if (r?.status === 429) { setCodeMsg("Of margar tilraunir. Reyndu aftur á eftir."); return; }
    if (!j?.ok) {
      setApplied(null);
      // One message for every kind of failure, because the server gives one
      // answer for every kind of failure.
      setCodeMsg("Þessi kóði gildir ekki.");
      return;
    }
    setApplied({ label: j.label, price: j.price_isk, monthsFree: j.months_free ?? 0 });
    setCodeMsg(null);
  };

  const subscribe = async () => {
    if (busy) return;
    setBusy("pay"); setErr(null);
    const r = await api("/api/hc/subscribe", {
      method: "POST",
      headers: WEB_CLIENT_HEADER,
      body: JSON.stringify({
        accept_terms: terms, withdrawal_waiver: waiver,
        ...(trial ? { start_trial: true } : { code: applied ? code : undefined }),
      }),
    }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setBusy(null);
    if (!r?.ok) { setErr(errorText(r?.status, j?.error)); toast.show(errorText(r?.status, j?.error), { tone: "bad" }); return; }
    // The paywall unmounts on the reload; the toast is what says it worked.
    toast.show(trial ? "Kortið er skráð" : "Áskriftin er hafin", { tone: "ok" });
    await onDone();
  };

  return (
    <section className={embedded ? "" : "rounded-3xl bg-hc-surface p-5 shadow-sm ring-1 ring-hc-hairline sm:p-6"}>
      {!embedded && (
        <>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-hc-sunken-2 text-hc-ink-2">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="mt-3 text-xl font-bold text-hc-ink">
            {trial ? `${trialDays} daga prufutími` : trialEndsAt ? "Prufutímabilinu er lokið" : "Áskrift þarf fyrir þennan hluta"}
          </h2>
        </>
      )}
      <p className={`${embedded ? "" : "mt-1.5 "}text-sm text-hc-ink-2`}>
        {pkg.description
          ?? "Áætlunin þín í símanum: æfingar, máltíðir vikunnar og daglegur gátlisti."}
      </p>

      {pkg.includes?.length ? (
        <ul className="mt-3 space-y-1.5">
          {pkg.includes.map((x) => (
            <li key={x} className="flex gap-2 text-sm text-hc-ink-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand" aria-hidden />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* The price, before the button rather than after it. */}
      <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-hc-hairline pt-4">
        {applied && applied.price !== pkg.price_isk && (
          <span className="text-sm text-hc-ink-2 line-through">{kr(pkg.price_isk)}</span>
        )}
        <span className="text-2xl font-bold tabular-nums text-hc-ink">{kr(price)}</span>
        <span className="text-sm text-hc-ink-2">
          á mánuði{trial ? ` eftir ${trialDays} daga prufutíma` : ""}{!trial && applied?.monthsFree ? ` · ${applied.monthsFree === 1 ? "fyrsti mánuður frír" : `${applied.monthsFree} mánuðir fríir`}` : ""}
        </span>
      </div>
      {!trial && applied && <p className="mt-1 text-sm font-semibold text-hc-brand-text">{applied.label}</p>}
      {trial && (
        <p className="mt-2 text-sm text-hc-ink-2">
          Ekkert er skuldfært á prufutímanum. Þegar honum lýkur hefst áskriftin og {kr(pkg.price_isk)} eru
          skuldfærðar af kortinu, síðan mánaðarlega. Þú getur sagt upp hvenær sem er áður en prufutímanum
          lýkur og þá er ekkert skuldfært. Við minnum þig á þremur dögum áður en hann rennur út.
        </p>
      )}

      {/* The code. A trial is not priced, so there is nothing for one to take off. */}
      {!trial && <div className="mt-3">
        <label htmlFor="disc" className="block text-xs font-semibold text-hc-ink-2">Afsláttarkóði</label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input id="disc" value={code}
            onChange={(e) => { setCode(e.target.value); setApplied(null); setCodeMsg(null); }}
            autoComplete="off" autoCapitalize="characters" spellCheck={false}
            placeholder="KÓÐI"
            className={`${hcInput} min-h-11 min-w-0 flex-1 uppercase`} />
          <button type="button" onClick={() => void tryCode()} disabled={busy !== null || !code.trim()}
            className="min-h-11 rounded-full border border-hc-control bg-hc-surface px-4 text-sm font-semibold text-hc-ink-2 disabled:opacity-40">
            {busy === "code" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Nota kóða"}
          </button>
        </div>
        {codeMsg && <p className="mt-1 text-sm text-hc-ink-2" role="status">{codeMsg}</p>}
      </div>}

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-hc-ink-2">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#047857]" />
        <span>
          Ég hef lesið{" "}
          <a href="/soluskilmalar" target="_blank" rel="noopener noreferrer" className="underline">söluskilmálana</a>{" "}
          og samþykki þá. {trial
            ? "Áskriftin hefst þegar prufutímanum lýkur, endurnýjast mánaðarlega og þú getur sagt henni upp hvenær sem er."
            : "Áskriftin endurnýjast mánaðarlega og þú getur sagt henni upp hvenær sem er."}
        </span>
      </label>
      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-hc-ink-2">
        <input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#047857]" />
        <span>{WITHDRAWAL_WAIVER_LABEL}</span>
      </label>

      {err && <p className="mt-2 text-sm font-semibold text-hc-bad-ink" role="alert">{err}</p>}

      <button type="button" onClick={() => void subscribe()} disabled={busy !== null || !terms || !waiver}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-hc-brand-dark px-5 py-3 font-bold text-white transition disabled:opacity-40">
        {busy === "pay" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {trial ? "Skrá kort og hefja prufutíma" : price === 0 ? "Hefja áskrift" : `Hefja áskrift — ${kr(price)}/mán.`}
      </button>

      {!embedded && (
        <p className="mt-2 text-xs text-hc-ink-2">
          Skýrslan þín, samtalið og heilsuferðin eru áfram opin, hvort sem þú ert með áskrift eða ekki.
        </p>
      )}
    </section>
  );
}

/**
 * The subscription, in one place: Stillingar og áskrift (#askrift).
 *
 * The trial banner, the journey's subscription step and the package step
 * all point here, so the price, what it includes, starting it and stopping
 * it are written down once. Cancelling keeps the paid period, which is what
 * the DELETE route does and what söluskilmálar section 6 promises.
 */
export function SubscriptionPanel({ api }: { api: Api }) {
  /* `cancelled`: "Segja upp" was pressed but the paid period runs until
     `ends_at` — the route returns it rather than nothing, so this does not
     offer to sell the month again (api/hc/subscribe GET). */
  type Sub = {
    tier: string; status: string; current_period_end: string | null; cancelled?: boolean; ends_at?: string | null;
    /* A free-trial row: not a subscription yet, nothing has been charged. */
    trial?: boolean; trial_ends_at?: string | null; card_saved_at?: string | null;
  };
  type State = {
    package: Pkg | null; subscription: Sub | null;
    cards_live?: boolean; trial_available?: boolean; trial_days?: number;
  };
  const [state, setState] = useState<State | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dialog = useDialog();
  const toast = useToast();

  const load = useCallback(async () => {
    const r = await api("/api/hc/subscribe").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => {
      if (j) {
        setState({
          package: j.package ?? null, subscription: j.subscription ?? null,
          cards_live: !!j.cards_live, trial_available: !!j.trial_available, trial_days: j.trial_days ?? 14,
        });
        setFailed(false);
      }
      else setFailed(true);
    }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const cancel = async () => {
    const sub = state?.subscription;
    const until = sub?.trial ? sub.trial_ends_at ?? sub.current_period_end : sub?.current_period_end;
    const ok = await dialog.confirm({
      title: sub?.trial ? "Hætta við áskriftina?" : "Segja upp áskriftinni?",
      body: sub?.trial
        ? `Prufutíminn er opinn til ${until ? fmtDate(until) : "loka hans"} og ekkert verður skuldfært.`
        : until
          ? `Appið er opið til ${fmtDate(until)}, og ekkert er skuldfært eftir það.`
          : "Ekkert er skuldfært eftir að tímabilinu sem er greitt lýkur.",
      confirmLabel: "Segja upp",
      tone: "danger",
    });
    if (!ok || busy) return;
    setBusy(true); setErr(null);
    const r = await api("/api/hc/subscribe", { method: "DELETE" }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => ({})) : null;
    setBusy(false);
    if (!j) { setErr(r ? "Ekki tókst að segja upp. Reyndu aftur." : "Engin tenging. Athugaðu netið og reyndu aftur."); return; }
    toast.show("Áskriftinni var sagt upp", { tone: "ok" });
    void load();
  };

  return (
    <SectionCard id="askrift" title="Áskrift að appinu"
      description="Æfingar, næring og daglegur gátlisti. Skýrslan, samtalið og heilsuferðin eru opin hvort sem er.">
      {failed && !state && (
        <Alert tone="bad" compact actions={<Button variant="secondary" size="sm" onClick={() => { setFailed(false); void load(); }}>Reyna aftur</Button>}>
          Ekki tókst að sækja áskriftina.
        </Alert>
      )}
      {!failed && !state && <div className="h-24 rounded-hc-element hc-shimmer" aria-busy="true" aria-label="Hleð" />}
      {state?.subscription?.cancelled && (
        <Alert tone="info" compact>
          Áskriftinni hefur verið sagt upp
          {state.subscription.ends_at ? ` — aðgangur opinn til ${fmtDate(state.subscription.ends_at)}.` : "."}
        </Alert>
      )}
      {state?.subscription?.trial && !state.subscription.cancelled && (
        <TrialState sub={state.subscription} pkg={state.package} cardsLive={!!state.cards_live}
          busy={busy} err={err} onCancel={() => void cancel()}
          addCard={<Paywall api={api} pkg={state.package} embedded mode="trial" trialDays={state.trial_days}
            onDone={async () => { await load(); }} />} />
      )}
      {state?.subscription && !state.subscription.trial && !state.subscription.cancelled && (
        <div className="space-y-3 text-sm text-hc-ink-2">
          <p className="font-semibold text-hc-ink">Áskriftin er virk.</p>
          {state.subscription.current_period_end && <p>Næsta greiðsla {fmtDate(state.subscription.current_period_end)}.</p>}
          {err && <p role="alert" className="font-semibold text-hc-bad-ink">{err}</p>}
          <Button variant="dangerOutline" busy={busy} onClick={() => void cancel()}>Segja upp áskrift</Button>
        </div>
      )}
      {state && !state.subscription && (
        <Paywall api={api} pkg={state.package} embedded
          mode={state.trial_available ? "trial" : "subscribe"} trialDays={state.trial_days}
          onDone={async () => { await load(); }} />
      )}
    </SectionCard>
  );
}

/**
 * Inside the free trial.
 *
 * What happens at the end is said in full here, before anything else —
 * consumer law wants the price, the monthly renewal and the way out stated
 * before a card is asked for, and while card registration is not open the
 * honest answer is that nothing happens automatically yet.
 */
function TrialState({ sub, pkg, cardsLive, busy, err, onCancel, addCard }: {
  sub: { trial_ends_at?: string | null; current_period_end: string | null; card_saved_at?: string | null };
  pkg: Pkg | null;
  cardsLive: boolean;
  busy: boolean;
  err: string | null;
  onCancel: () => void;
  addCard: ReactNode;
}) {
  const ends = sub.trial_ends_at ?? sub.current_period_end;
  const price = pkg ? kr(pkg.price_isk) : null;
  return (
    <div className="space-y-3 text-sm text-hc-ink-2">
      <p className="font-semibold text-hc-ink">
        Þú ert á prufutíma{ends ? ` til ${fmtDate(ends)}` : ""}. Allt appið er opið.
      </p>
      {sub.card_saved_at ? (
        <>
          <p>
            Kortið þitt er skráð. Þegar prufutímanum lýkur hefst áskriftin
            {price ? ` og ${price} eru skuldfærðar` : ""}, síðan mánaðarlega. Þú getur sagt upp hvenær sem er
            áður en prufutímanum lýkur og þá er ekkert skuldfært.
          </p>
          {err && <p role="alert" className="font-semibold text-hc-bad-ink">{err}</p>}
          <Button variant="dangerOutline" busy={busy} onClick={onCancel}>Hætta við áskrift</Button>
        </>
      ) : cardsLive ? (
        addCard
      ) : (
        <>
          <Alert tone="info" compact>
            Kortaskráning opnar fljótlega – við látum þig vita áður en prufutímanum lýkur.
          </Alert>
          <p>
            Ekkert er skuldfært á prufutímanum.
            {price ? ` Eftir hann kostar áskriftin ${price} á mánuði og endurnýjast mánaðarlega.` : ""} Þú getur
            sagt henni upp hvenær sem er áður en prufutímanum lýkur.
          </p>
        </>
      )}
    </div>
  );
}
