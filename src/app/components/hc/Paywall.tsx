"use client";

// The app, once the trial is over — and the subscription's line in Stillingar.
//
// ── What this blocks, and what it must not ───────────────────────────
//
// Only the subscription's own surfaces: Æfingar, Næring, the daily
// checklist. The report, the coach thread and the journey stay open, because
// a health-check customer paid for those and appAccess() already grants
// those people access for good — see src/lib/hc/subscription.ts. Nobody who
// bought a workup should meet this screen.
//
// ── One place to buy ─────────────────────────────────────────────────
//
// Buying happens on /app/askrift and nowhere else: choose the tier, then
// pay. This card and the panel in Stillingar only say where things stand
// and link there, so the price, the terms, the waiver and the payment page
// are written once (subscription-parts.tsx). The price is still on this
// card before anything is pressed — a paywall that hides what it costs
// until you commit is the kind that gets a chargeback.

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { Alert, Button, SectionCard, fmtDate, fmtIsk, useDialog } from "@/app/components/account/ui";
import { hcBtn, hcCard } from "./ui";
import { useToast } from "./Toast";
import { isActivePaid, useSubscriptionState, type Pkg, type SubRow } from "./subscription-parts";

/* Kept here as well: the health-check checkout imports them from this file. */
export { WEB_CLIENT_HEADER, WITHDRAWAL_WAIVER_LABEL } from "./subscription-parts";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export const SUBSCRIBE_HREF = "/app/askrift";

const kr = fmtIsk;

/** The wall on Í dag, Æfingar and Næring: what it costs, what it includes, one way on. */
export default function Paywall({ pkg, trialEndsAt }: {
  pkg: Pkg | null;
  /** When the trial ran out, so the copy can be specific. */
  trialEndsAt?: string | null;
}) {
  if (!pkg) {
    return <div className="h-48 rounded-hc-card hc-shimmer" aria-busy="true" aria-label="Hleð" />;
  }
  return (
    <section className={`${hcCard.raised} p-5 sm:p-6`} aria-labelledby="paywall-title">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-hc-brand-surface text-hc-brand-text">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <h2 id="paywall-title" className="mt-3 text-xl font-bold text-hc-ink">
        {trialEndsAt ? "Prufutímabilinu er lokið" : "Áskrift þarf fyrir þennan hluta"}
      </h2>
      <p className="mt-1.5 text-sm text-hc-ink-2">
        {pkg.description ?? "Áætlunin þín í símanum: æfingar, máltíðir vikunnar og daglegur gátlisti."}
      </p>
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
      <p className="mt-4 border-t border-hc-hairline pt-4">
        <span className="text-2xl font-bold tabular-nums text-hc-ink">{kr(pkg.price_isk)}</span>{" "}
        <span className="text-sm text-hc-ink-2">á mánuði · segja má upp hvenær sem er</span>
      </p>
      <Link href={SUBSCRIBE_HREF} className={`${hcBtn.cta} mt-4 w-full`}>Skrá mig í áskrift</Link>
      <p className="mt-3 text-xs text-hc-ink-2">
        Skýrslan þín, samtalið og heilsuferðin eru áfram opin, hvort sem þú ert með áskrift eða ekki.
      </p>
    </section>
  );
}

/**
 * The subscription in Stillingar: where it stands, and the way to change it.
 *
 * Choosing and paying is /app/askrift. Cancelling stays here, next to the
 * receipts, and keeps the paid period, which is what the DELETE route does
 * and what söluskilmálar section 6 promises.
 */
export function SubscriptionPanel({ api }: { api: Api }) {
  const { state, failed, load, retry } = useSubscriptionState(api);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dialog = useDialog();
  const toast = useToast();
  const sub = state?.subscription ?? null;

  const cancel = async () => {
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

  const change = (label: string) => <Link href={SUBSCRIBE_HREF} className={hcBtn.secondary}>{label}</Link>;

  return (
    <SectionCard id="askrift" title="Áskrift"
      description="Lifeline appið: æfingar, næring og daglegur gátlisti. Lifeline þjálfun: appið og heilsuþjálfi í Vestmannaeyjum.">
      {failed && !state && (
        <Alert tone="bad" compact actions={<Button variant="secondary" size="sm" onClick={retry}>Reyna aftur</Button>}>
          Ekki tókst að sækja áskriftina.
        </Alert>
      )}
      {!failed && !state && <div className="h-24 rounded-hc-element hc-shimmer" aria-busy="true" aria-label="Hleð" />}
      {state && (
        <div className="space-y-3 text-sm text-hc-ink-2">
          {!sub && (
            <>
              <p>Engin áskrift er virk. Appið kostar {state.package ? kr(state.package.price_isk) : "—"} á mánuði.</p>
              <div className="flex flex-wrap gap-2">{change("Velja áskrift")}</div>
            </>
          )}
          {sub?.cancelled && (
            <>
              <p className="font-semibold text-hc-ink">
                Áskriftinni hefur verið sagt upp{sub.ends_at ? `. Aðgangur er opinn til ${fmtDate(sub.ends_at)}.` : "."}
              </p>
              <div className="flex flex-wrap gap-2">{change("Endurnýja áskrift")}</div>
            </>
          )}
          {sub?.trial && !sub.cancelled && (
            <TrialState sub={sub} pkg={state.package} busy={busy} err={err} onCancel={() => void cancel()}
              action={change("Velja áskrift")} />
          )}
          {isActivePaid(sub) && (
            <>
              <p className="font-semibold text-hc-ink">
                {sub.tier === "coaching" ? "Lifeline þjálfun er virk." : "Lifeline appið er virkt."}
              </p>
              {sub.current_period_end && <p>Næsta greiðsla {fmtDate(sub.current_period_end)}.</p>}
              {err && <p role="alert" className="font-semibold text-hc-bad-ink">{err}</p>}
              <div className="flex flex-wrap gap-2">
                {change("Breyta")}
                <Button variant="dangerOutline" busy={busy} onClick={() => void cancel()}>Segja upp áskrift</Button>
              </div>
            </>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/**
 * Inside the free trial.
 *
 * What happens at the end is said in full here — consumer law wants the
 * price, the monthly renewal and the way out stated before a card is asked
 * for, and while card registration is not open the honest answer is that
 * nothing happens automatically yet.
 */
function TrialState({ sub, pkg, busy, err, onCancel, action }: {
  sub: SubRow;
  pkg: Pkg | null;
  busy: boolean;
  err: string | null;
  onCancel: () => void;
  action: ReactNode;
}) {
  const ends = sub.trial_ends_at ?? sub.current_period_end;
  const price = pkg ? kr(pkg.price_isk) : null;
  return (
    <>
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
          <div className="flex flex-wrap gap-2">
            <Button variant="dangerOutline" busy={busy} onClick={onCancel}>Hætta við áskrift</Button>
          </div>
        </>
      ) : (
        <>
          <p>
            Ekkert er skuldfært á prufutímanum.
            {price ? ` Eftir hann kostar áskriftin ${price} á mánuði og endurnýjast mánaðarlega.` : ""} Þú getur
            valið áskrift hvenær sem er.
          </p>
          <div className="flex flex-wrap gap-2">{action}</div>
        </>
      )}
    </>
  );
}
