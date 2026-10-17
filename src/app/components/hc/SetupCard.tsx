"use client";

// The way into the guided setup: one card, and only an invitation.
//
// Mads' rule for the app: every step happens because the person chose to go
// there. The onboarding used to start by itself when /app opened; now this
// card says what the setup is and how long it takes, and nothing happens
// until „Byrja“ is pressed. Shown on /app before there is a plan, and at the
// top of Ég for somebody new. Hidden once the setup is finished.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { hcBtn, hcCard } from "./ui";
import * as cache from "@/lib/hc/client-cache";
import { EMPTY_PROGRESS, setupCount, type SetupContext, type SetupProgress } from "@/lib/hc/setup-steps";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface SetupState { progress: SetupProgress; context: SetupContext }

/** The setup's state, from the cache first. null until loaded; undefined if it failed. */
export function useSetupState(api: Api) {
  const url = "/api/hc/setup";
  const [s, setS] = useState<SetupState | null | undefined>(() => cache.peek<SetupState>(url)?.body ?? null);
  const reload = useCallback(async () => {
    const r = await cache.load(api, url).catch(() => null);
    if (r && r.status < 400) setS(r.body as SetupState);
    else setS((cur) => cur ?? undefined);
  }, [api]);
  useEffect(() => {
    const t = setTimeout(() => { void reload(); }, 0);
    return () => clearTimeout(t);
  }, [reload]);
  return { state: s, reload };
}

export default function SetupCard({ api, state, alternatives, onDismissed }: {
  api: Api;
  state: SetupState;
  /** Quieter ways onward, shown under the button. */
  alternatives?: React.ReactNode;
  /** „Ekki núna“: the caller hides the card and shows a small link instead. */
  onDismissed?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const p = state.progress ?? EMPTY_PROGRESS;
  const { handled, total } = setupCount(p, state.context);
  const started = !!p.started_at && handled > 0;

  const dismiss = async () => {
    setBusy(true);
    await api("/api/hc/setup", { method: "POST", body: JSON.stringify({ action: "dismiss" }) }).catch(() => null);
    cache.invalidate("/api/hc/setup");
    setBusy(false);
    onDismissed?.();
  };

  return (
    <section className={`${hcCard.raised} p-5 sm:p-6`} aria-labelledby="setup-card-title">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-hc-element bg-hc-brand-surface text-hc-brand-text">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="setup-card-title" className="text-lg font-bold text-hc-ink">
            {started ? `Halda áfram uppsetningu · ${handled} af ${total}` : "Setja upp appið · um 3 mín."}
          </h2>
          <p className="mt-1 text-sm text-hc-ink-2">
            {started
              ? "Þú heldur áfram þar sem frá var horfið. Hverju skrefi má sleppa."
              : "Heimilisfang, skýrslan ef þú átt hana, fyrsta áætlunin, hreyfing, appið á heimaskjáinn og áminningar. Hverju skrefi má sleppa."}
          </p>
        </div>
      </div>
      {started && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-hc-sunken-2" aria-hidden>
          <div className="h-full rounded-full bg-hc-brand-dark" style={{ width: `${(handled / total) * 100}%` }} />
        </div>
      )}
      <Link href="/app/uppsetning" className={`${hcBtn.cta} mt-4 w-full`}>
        {started ? "Halda áfram" : "Byrja"} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
      {(alternatives || onDismissed) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
          {alternatives}
          {onDismissed && (
            <button type="button" onClick={() => void dismiss()} disabled={busy}
              className="min-h-11 font-semibold text-hc-ink-3 underline">
              Ekki núna
            </button>
          )}
        </div>
      )}
    </section>
  );
}
