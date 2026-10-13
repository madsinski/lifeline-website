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

import { useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Pkg {
  name: string;
  tagline: string | null;
  description: string | null;
  includes: string[] | null;
  price_isk: number;
  interval_months: number | null;
}

const kr = (n: number) => `${n.toLocaleString("is-IS")} kr.`;

export default function Paywall({ api, pkg, onDone, trialEndsAt }: {
  api: Api;
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
  const [busy, setBusy] = useState<"code" | "pay" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!pkg) {
    return <div className="h-48 rounded-3xl hc-shimmer" aria-busy="true" aria-label="Hleð" />;
  }

  const price = applied?.price ?? pkg.price_isk;

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
    setBusy("pay"); setErr(null);
    const r = await api("/api/hc/subscribe", {
      method: "POST",
      body: JSON.stringify({ accept_terms: true, code: applied ? code : undefined }),
    }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setBusy(null);
    if (!r?.ok) { setErr(j?.error || "Tókst ekki að hefja áskrift."); return; }
    await onDone();
  };

  return (
    <section className="rounded-3xl bg-hc-surface p-5 shadow-sm ring-1 ring-hc-hairline sm:p-6">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-hc-sunken-2 text-hc-ink-2">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="mt-3 text-xl font-bold text-hc-ink">
        {trialEndsAt ? "Prufutímabilinu er lokið" : "Áskrift þarf fyrir þennan hluta"}
      </h2>
      <p className="mt-1.5 text-sm text-hc-ink-2">
        {pkg.description
          ?? "Áætlunin þín í símanum: æfingar, máltíðir vikunnar og daglegur gátlisti."}
      </p>

      {pkg.includes?.length ? (
        <ul className="mt-3 space-y-1.5">
          {pkg.includes.map((x) => (
            <li key={x} className="flex gap-2 text-sm text-slate-700">
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
          á mánuði{applied?.monthsFree ? ` · ${applied.monthsFree === 1 ? "fyrsti mánuður frír" : `${applied.monthsFree} mánuðir fríir`}` : ""}
        </span>
      </div>
      {applied && <p className="mt-1 text-sm font-semibold text-hc-brand-dark">{applied.label}</p>}

      {/* The code. */}
      <div className="mt-3">
        <label htmlFor="disc" className="block text-xs font-semibold text-hc-ink-2">Afsláttarkóði</label>
        <div className="mt-1 flex flex-wrap gap-2">
          <input id="disc" value={code}
            onChange={(e) => { setCode(e.target.value); setApplied(null); setCodeMsg(null); }}
            autoComplete="off" autoCapitalize="characters" spellCheck={false}
            placeholder="KÓÐI"
            className="min-w-0 flex-1 rounded-hc-element border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-hc-brand/30" />
          <button type="button" onClick={() => void tryCode()} disabled={busy !== null || !code.trim()}
            className="rounded-full border border-slate-300 bg-hc-surface px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-40">
            {busy === "code" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Nota kóða"}
          </button>
        </div>
        {codeMsg && <p className="mt-1 text-sm text-hc-ink-2" role="status">{codeMsg}</p>}
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#10B981]" />
        <span>
          Ég hef lesið{" "}
          <a href="/soluskilmalar" target="_blank" rel="noopener noreferrer" className="underline">söluskilmálana</a>{" "}
          og samþykki þá. Áskriftin endurnýjast mánaðarlega og þú getur sagt henni upp hvenær sem er.
        </span>
      </label>

      {err && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{err}</p>}

      <button type="button" onClick={() => void subscribe()} disabled={busy !== null || !terms}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-hc-ink px-5 py-3 font-bold text-white transition disabled:opacity-40">
        {busy === "pay" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {price === 0 ? "Hefja áskrift" : `Hefja áskrift — ${kr(price)}/mán.`}
      </button>

      <p className="mt-2 text-xs text-hc-ink-2">
        Skýrslan þín, þjálfarinn og heilsuferðin eru áfram opin, hvort sem þú ert með áskrift eða ekki.
      </p>
    </section>
  );
}
