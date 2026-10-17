"use client";

// The pieces of buying the subscription, shared by the three places that do
// it: the focused /app/askrift flow, the paywall on Í dag, and the panel in
// Stillingar. One loader, one way to start the purchase, one set of terms
// checkboxes — so the price, the waiver and the error wording cannot drift
// between them.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hcInput } from "./ui";
import { NO_REQUEST, type CoachingRequestView } from "@/lib/hc/coaching-config";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Sent with every purchase from the website, so the server can insist on the
 * withdrawal waiver for web purchases while the mobile app (which does not
 * send it yet) is let through. See src/lib/hc/waiver.ts.
 */
export const WEB_CLIENT_HEADER = { "x-lifeline-client": "web" } as const;

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

export interface Pkg {
  name: string;
  tagline: string | null;
  description: string | null;
  includes: string[] | null;
  price_isk: number;
  interval_months: number | null;
}

export type SubRow = {
  tier: string; status: string; current_period_end: string | null; cancelled?: boolean; ends_at?: string | null;
  /* A free-trial row: not a subscription yet, nothing has been charged. */
  trial?: boolean; trial_ends_at?: string | null; card_saved_at?: string | null;
};

export type CoachingAvailability = {
  available: boolean;
  reason: "no_address" | "outside_region" | null;
  in_catalogue: boolean;
  /** Approved by Lifeline before payment: only "approved" may pay. */
  request: CoachingRequestView;
};

export type SubState = {
  package: Pkg | null; subscription: SubRow | null;
  cards_live: boolean; trial_available: boolean; trial_days: number;
  /** "Lifeline þjálfun": the package, and whether it is sold where they live. */
  coachingPkg: Pkg | null;
  coaching: CoachingAvailability | null;
};

/** GET /api/hc/subscribe, shaped once. `failed` only while nothing has loaded. */
export function useSubscriptionState(api: Api) {
  const [state, setState] = useState<SubState | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    const r = await api("/api/hc/subscribe").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => {
      if (j) {
        setState({
          package: j.package ?? null, subscription: j.subscription ?? null,
          cards_live: !!j.cards_live, trial_available: !!j.trial_available, trial_days: j.trial_days ?? 14,
          coachingPkg: j.packages?.coaching ?? null,
          coaching: j.coaching
            ? {
                available: !!j.coaching.available, reason: j.coaching.reason ?? null, in_catalogue: !!j.coaching.in_catalogue,
                request: (j.coaching.request as CoachingRequestView | undefined) ?? NO_REQUEST,
              }
            : null,
        });
        setFailed(false);
      } else setFailed(true);
    }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  /** After sending or withdrawing a coaching request: the new state without a reload. */
  const setRequest = useCallback((request: CoachingRequestView) => {
    setState((s) => (s?.coaching ? { ...s, coaching: { ...s.coaching, request } } : s));
  }, []);
  return { state, failed, load, setRequest, retry: () => { setFailed(false); void load(); } };
}

/** A live, paid subscription — not a trial, not one that was cancelled. */
export const isActivePaid = (s: SubRow | null | undefined): s is SubRow =>
  !!s && !s.trial && !s.cancelled;

/**
 * Server answers in plain Icelandic; anything raw (a code, an English message)
 * gets a sentence instead. The route's own Icelandic sentence wins over the
 * status default — a 402 is usually "Kortagreiðslur opna fljótlega…", not a
 * declined card, and saying the payment failed would be wrong.
 */
export function errorText(status: number | undefined, raw: unknown): string {
  if (status === undefined) return "Engin tenging. Athugaðu netið og reyndu aftur.";
  if (status === 401) return "Innskráningin rann út. Skráðu þig inn aftur og reyndu svo.";
  const msg = typeof raw === "string" ? raw : "";
  if (/^[A-ZÁÐÉÍÓÚÝÞÆÖ][^_]*[.!]$/.test(msg) && /[áðéíóúýþæö]/i.test(msg)) return msg;
  if (status === 402) return "Greiðslan tókst ekki. Ekkert var skuldfært. Reyndu aftur eða notaðu annað kort.";
  if (status === 404) return "Áskriftin fannst ekki. Hafðu samband við contact@lifelinehealth.is.";
  if (status === 429) return "Of margar tilraunir. Reyndu aftur eftir smástund.";
  return "Ekki tókst að hefja áskrift. Reyndu aftur.";
}

export type StartResult =
  | { kind: "redirect"; url: string }
  | { kind: "done"; trial: boolean }
  /** 402: nothing was charged and nothing went wrong on their side — say it calmly. */
  | { kind: "closed"; message: string }
  | { kind: "error"; message: string };

/**
 * POST /api/hc/subscribe. The browser sends what was ticked and typed, never
 * a price: the server prices the code and decides what is charged.
 */
export async function startSubscription(api: Api, opts: {
  packageKey?: string;
  terms: boolean;
  waiver: boolean;
  trial?: boolean;
  testCode?: string;
  code?: string;
  /** Where Straumur sends them back: "askrift" lands on /app/askrift. */
  returnTo?: "askrift";
}): Promise<StartResult> {
  const r = await api("/api/hc/subscribe", {
    method: "POST",
    headers: WEB_CLIENT_HEADER,
    body: JSON.stringify({
      accept_terms: opts.terms, withdrawal_waiver: opts.waiver, package: opts.packageKey,
      ...(opts.returnTo ? { return_to: opts.returnTo } : {}),
      ...(opts.trial ? { start_trial: true } : opts.testCode?.trim() ? { test_code: opts.testCode.trim() } : { code: opts.code || undefined }),
    }),
  }).catch(() => null);
  const j = await r?.json().catch(() => ({}));
  if (!r?.ok) {
    const message = errorText(r?.status, j?.error);
    return r?.status === 402 && message !== errorText(402, null) ? { kind: "closed", message } : { kind: "error", message };
  }
  /* Something to pay: Straumur's payment page. The subscription starts when
     the payment is confirmed; the return is picked up by payment-status. */
  if (typeof j?.checkout_url === "string") return { kind: "redirect", url: j.checkout_url };
  return { kind: "done", trial: !!opts.trial };
}

/** The two ticks every purchase needs: the terms, and the waiver. Never pre-ticked. */
export function TermsChecks({ terms, waiver, onTerms, onWaiver, trial = false }: {
  terms: boolean; waiver: boolean;
  onTerms: (v: boolean) => void; onWaiver: (v: boolean) => void;
  trial?: boolean;
}) {
  return (
    <>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-hc-ink-2">
        <input type="checkbox" checked={terms} onChange={(e) => onTerms(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#047857]" />
        <span>
          Ég hef lesið{" "}
          <a href="/soluskilmalar" target="_blank" rel="noopener noreferrer" className="font-semibold text-hc-ink underline">söluskilmálana</a>{" "}
          og samþykki þá. {trial
            ? "Áskriftin hefst þegar prufutímanum lýkur, endurnýjast mánaðarlega og þú getur sagt henni upp hvenær sem er."
            : "Áskriftin endurnýjast mánaðarlega og þú getur sagt henni upp hvenær sem er."}
        </span>
      </label>
      <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm text-hc-ink-2">
        <input type="checkbox" checked={waiver} onChange={(e) => onWaiver(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#047857]" />
        <span>{WITHDRAWAL_WAIVER_LABEL}</span>
      </label>
    </>
  );
}

/** Internal test code (admin → Heilsuferð → Prófunarkóðar): one period free, no card. */
export function TestCodeField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <details className="text-sm text-hc-ink-2" open={value.trim() ? true : undefined}>
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-hc-ink-2">Ertu með prófunarkóða?</summary>
      <label htmlFor={id} className="mt-1 block text-xs font-semibold text-hc-ink-2">Prófunarkóði</label>
      <input id={id} value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        autoComplete="off" spellCheck={false} placeholder="TEST-XXXX-XXXX"
        className={`${hcInput} mt-1 min-h-11 w-full font-mono uppercase`} />
      <p className="mt-1 text-xs text-hc-ink-2">Fyrir prófanir starfsfólks: fyrsti mánuðurinn án greiðslu, ekkert kort.</p>
    </details>
  );
}

export type PayState = "checking" | "paid" | "waiting" | "expired" | "failed";

const POLL_MS = 2500;
const PATIENCE_MS = 25_000;

/**
 * Back from Straumur's payment page (?greidsla=<our reference>).
 *
 * Asks /api/hc/payment-status — which checks with Straumur server-to-server
 * and settles a paid session — until it is paid, has failed, or patience
 * runs out. Nothing here marks anything paid. The parameter is dropped once
 * there is an answer, so a reload does not ask again.
 */
export function usePaymentStatus(onPaid?: () => void) {
  const [ref, setRef] = useState<string | null>(null);
  const [state, setState] = useState<PayState | null>(null);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("greidsla");
    if (!r) return;
    const t = setTimeout(() => { setRef(r); setState("checking"); }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ref) return;
    let alive = true;
    const started = Date.now();
    const tick = async () => {
      if (!alive) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const r = await fetch(`/api/hc/payment-status?ref=${encodeURIComponent(ref)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      }).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) as { status?: string; fulfilled?: boolean } | null : null;
      if (!alive) return;
      if (j?.status === "paid" && j.fulfilled) {
        setState("paid"); dropPaymentParam(); onPaid?.();
        return;
      }
      if (j?.status === "expired" || j?.status === "failed") { setState(j.status); dropPaymentParam(); return; }
      if (Date.now() - started > PATIENCE_MS) { setState("waiting"); return; }
      setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => { alive = false; };
  // onPaid is read at the moment of payment; a new closure must not restart the poll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  const clear = () => { setState(null); dropPaymentParam(); };
  return { state, clear };
}

export function dropPaymentParam() {
  const u = new URL(window.location.href);
  if (!u.searchParams.has("greidsla")) return;
  u.searchParams.delete("greidsla");
  window.history.replaceState(window.history.state, "", u.toString());
}

export const PAY_STATE_COPY: Record<PayState, string> = {
  checking: "Augnablik, við staðfestum greiðsluna…",
  paid: "Greiðsla móttekin. Takk fyrir.",
  waiting: "Greiðslan hefur ekki borist enn. Ef þú lokaðir greiðslusíðunni geturðu reynt aftur. Annars birtist hún hér innan skamms.",
  expired: "Greiðslusíðan rann út án greiðslu. Ekkert var skuldfært. Reyndu aftur þegar þér hentar.",
  failed: "Greiðslan tókst ekki. Ekkert var skuldfært. Reyndu aftur.",
};
