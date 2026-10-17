"use client";

/*
 * Checkout for anything bought from Lifeline: the health check, follow-ups,
 * re-evaluation and the shop's standalone products (src/lib/hc/shop.ts).
 *
 * Moved out of the journey page (src/app/app/page.tsx) so the Þjónusta page
 * (/app/eg/thjonusta) buys through the same component — one place where the
 * price, the contributions, the terms and the withdrawal waiver are asked.
 * Backed by /api/hc/checkout. The server decides what is allowed: employer
 * and union parts only exist for the journey packages (`contributions`).
 */

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { hcBtn } from "@/app/components/hc/ui";
import { Alert, Button } from "@/app/components/account/ui";
import { WEB_CLIENT_HEADER, WITHDRAWAL_WAIVER_LABEL } from "@/app/components/hc/Paywall";
import { useToast } from "@/app/components/hc/Toast";
import { formatIsk, type HcOrder, type HcPackage } from "@/lib/hc/types";
import { quote, type UnionRules } from "@/lib/hc/reimbursement";

async function api(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return fetch(url, {
    ...init,
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers as Record<string, string> | undefined) },
  });
}

/** A server error worth showing as is: a sentence, not a code like "order_failed". */
const humanError = (e: unknown, fallback: string) =>
  typeof e === "string" && /\s/.test(e) ? e : fallback;

interface CheckoutInfo {
  package: HcPackage;
  unions: { id: string; name: string; settlement: "reimbursement" | "direct"; rules_summary: string | null; rules: UnionRules; reimbursement_isk: number; explanation: string; can_email: boolean }[];
  eligibility_error: string | null;
  profile_complete: boolean;
  company_code: { ok: true; company_name: string | null; package_key: string; contribution_percent: number; contribution_isk: number | null; price_isk?: number } | { ok: false; error: string } | null;
  /** False for the shop's standalone products: no employer or union part. Missing = true (older server). */
  contributions?: boolean;
}

/** A card that toggles a payment contribution on or off. Real button, aria-pressed. */
function ContributionToggle({ on, onToggle, title, hint, disabled, children }: {
  on: boolean; onToggle: () => void; title: string; hint: string; disabled?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border transition ${on ? "border-hc-brand bg-hc-brand-surface ring-2 ring-hc-brand/20" : "border-hc-hairline bg-hc-surface"} ${disabled ? "opacity-50" : ""}`}>
      <button type="button" aria-pressed={on} disabled={disabled} onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left disabled:cursor-not-allowed">
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-hc-brand-dark bg-hc-brand-dark text-white" : "border-hc-control bg-hc-surface"}`}>
          {on && <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
        <span><span className="block text-sm font-semibold text-hc-ink-2">{title}</span><span className="block text-xs text-hc-ink-3">{hint}</span></span>
      </button>
      {on && children && <div className="border-t border-hc-hairline px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

export default function Checkout({ packages, profileComplete, reload, onPaid }: {
  packages: HcPackage[]; profileComplete: boolean; reload: () => Promise<void>;
  /** Called with the paid order before reload (the shop shows the code and the booking step). */
  onPaid?: (order: HcOrder) => void;
}) {
  const [pkgKey, setPkgKey] = useState(packages[0]?.key ?? "");
  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [useCompany, setUseCompany] = useState(false);
  const [useUnion, setUseUnion] = useState(false);
  const [unionId, setUnionId] = useState("");
  const [code, setCode] = useState("");
  /** Internal test code (admin → Heilsuferð → Prófunarkóðar): the server makes this purchase free. */
  const [testCode, setTestCode] = useState("");
  const [codeState, setCodeState] = useState<CheckoutInfo["company_code"]>(null);
  const [consent, setConsent] = useState(false);
  const [terms, setTerms] = useState(false);
  /** §8 söluskilmála / d-liður 1. mgr. 18. gr. laga nr. 16/2016: asked for, never assumed. */
  const [waiver, setWaiver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const toast = useToast();

  useEffect(() => {
    if (!pkgKey) return;
    let alive = true;
    (async () => {
      const r = await api(`/api/hc/checkout?package=${encodeURIComponent(pkgKey)}`).catch(() => null);
      if (!alive) return;
      if (r?.ok) { setInfo(await r.json()); setLoadFailed(false); }
      // Was "Hleð…" for good when this failed.
      else setLoadFailed(true);
    })();
    return () => { alive = false; };
  }, [pkgKey, attempt]);

  const union = info?.unions.find((u) => u.id === unionId) ?? null;
  const company = useCompany && codeState?.ok === true ? codeState : null;
  const q = useMemo(() => quote({
    /* A company code may carry the company's agreed price (price lock). */
    priceIsk: company?.price_isk ?? info?.package.price_isk ?? 0,
    employer: company ? { percent: company.contribution_percent, fixed_isk: company.contribution_isk } : null,
    union: useUnion && union ? { settlement: union.settlement, rules: union.rules } : null,
    unionCategory: info?.package.union_category ?? "health_check",
  }), [info, company, useUnion, union]);

  const checkCode = async () => {
    if (checking) return;
    setCodeState(null);
    setChecking(true);
    const r = await api(`/api/hc/checkout?package=${encodeURIComponent(pkgKey)}&code=${encodeURIComponent(code)}`).catch(() => null);
    setChecking(false);
    if (r?.ok) setCodeState((await r.json()).company_code ?? { ok: false, error: "Kóðinn fannst ekki." });
    else setCodeState({ ok: false, error: "Ekki tókst að athuga kóðann – reyndu aftur." });
  };

  const usingTest = testCode.trim().length > 0;

  const pay = async () => {
    if (busy) return;
    setBusy(true); setErr("");
    const r = await api("/api/hc/checkout", {
      method: "POST",
      headers: WEB_CLIENT_HEADER,
      body: JSON.stringify({
        package_key: pkgKey,
        use_company: useCompany, company_code: useCompany ? code : undefined,
        use_union: useUnion, union_id: useUnion ? unionId : undefined,
        union_consent: consent, accept_terms: terms,
        withdrawal_waiver: waiver, withdrawal_waiver_at: waiver ? new Date().toISOString() : null,
        test_code: usingTest ? testCode.trim() : undefined,
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setBusy(false); setErr(humanError(j.error, "Greiðsla tókst ekki. Reyndu aftur.")); return; }
    /* Something to pay: Straumur's payment page. The order is created when
       the payment is confirmed; PaymentReturn picks it up on the way back. */
    if (typeof j.checkout_url === "string") { window.location.assign(j.checkout_url); return; }
    setBusy(false);
    toast.show(j.test_code ? "Gengið frá kaupum með prófunarkóða" : "Gengið frá kaupum", { tone: "ok" });
    if (j.order && onPaid) onPaid(j.order as HcOrder);
    await reload();
  };

  if (!profileComplete) return <p className="text-sm text-hc-ink-2">Kláraðu fyrst skrefið „Upplýsingar um þig“. Þær þarf til að ganga frá kaupum.</p>;
  if (!info && loadFailed) {
    return (
      <Alert tone="bad" title="Ekki tókst að sækja verðið"
        actions={<Button variant="secondary" onClick={() => { setLoadFailed(false); setAttempt((n) => n + 1); }}>Reyna aftur</Button>}>
        Athugaðu nettenginguna og reyndu aftur.
      </Alert>
    );
  }
  if (!info) return <p className="text-sm text-hc-ink-3">Hleð…</p>;

  const companyCovers = company ? (company.contribution_isk != null ? formatIsk(company.contribution_isk) : `${company.contribution_percent}%`) : "";
  const canPay = terms && waiver && !busy && !info.eligibility_error && (!usingTest || (!useCompany && !useUnion)) &&
    (!useCompany || codeState?.ok === true) &&
    (!useUnion || (!!union && (union.settlement !== "direct" || consent)));

  return (
    <div className="space-y-5">
      {packages.length > 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((p) => (
            <button key={p.key} type="button" aria-pressed={p.key === pkgKey} onClick={() => setPkgKey(p.key)} className={`rounded-2xl border p-4 text-left ${p.key === pkgKey ? "border-hc-brand ring-2 ring-hc-brand/30" : "border-hc-hairline"}`}>
              <p className="font-semibold">{p.name}</p><p className="text-sm text-hc-ink-3">{formatIsk(p.price_isk)}</p>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-hc-hairline p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold text-hc-ink">{info.package.name}</h3>
          <span className="text-lg font-bold text-hc-brand-text">{formatIsk(info.package.price_isk)}</span>
        </div>
        {info.package.tagline && <p className="text-sm font-medium text-hc-ink-3">{info.package.tagline}</p>}
        {info.package.description && <p className="mt-2 text-sm leading-relaxed text-hc-ink-2">{info.package.description}</p>}
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {info.package.includes.map((x) => (
            <li key={x} className="flex gap-2 text-sm text-hc-ink-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-hc-brand-text" aria-hidden />{x}</li>
          ))}
        </ul>
      </div>

      {info.contributions !== false && (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-hc-ink-2">Tekur einhver þátt í kostnaðinum?</p>
        <p className="text-xs text-hc-ink-3">Veldu annað, bæði eða hvorugt. Án þátttöku greiðir þú með korti.</p>
        <ContributionToggle on={useCompany} onToggle={() => setUseCompany((v) => !v)}
          title="Vinnuveitandinn minn tekur þátt" hint="Þú slærð inn persónulegan kóða frá fyrirtækinu þínu.">
          <label className="block text-sm font-medium text-hc-ink-2" htmlFor="company-code">Kóði frá vinnuveitanda</label>
          <div className="mt-1 flex gap-2">
            <input id="company-code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeState(null); }} placeholder="FY-XXXX-XXXX" className="flex-1 rounded-lg border border-hc-control px-3 py-2.5 font-mono uppercase tracking-wider" />
            <button type="button" onClick={checkCode} disabled={code.length < 8 || checking} className="min-h-11 rounded-lg bg-hc-brand-dark px-4 text-sm font-semibold text-white disabled:opacity-40">{checking ? "Athuga…" : "Staðfesta"}</button>
          </div>
          {codeState?.ok === true && <p className="mt-2 flex items-start gap-1.5 text-sm text-hc-ok-ink"><Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{codeState.company_name ?? "Vinnuveitandi"} greiðir {codeState.contribution_isk != null ? formatIsk(codeState.contribution_isk) : codeState.contribution_percent >= 100 ? "allt" : `${codeState.contribution_percent}%`}.</p>}
          {codeState?.ok === false && <p className="mt-2 text-sm text-hc-bad-ink">{codeState.error}</p>}
        </ContributionToggle>
        <ContributionToggle on={useUnion} onToggle={() => setUseUnion((v) => !v)} disabled={!info.unions.length}
          title="Stéttarfélagið mitt tekur þátt"
          hint={info.unions.length ? "Við reiknum endurgreiðsluna eftir reglum félagsins, af þínum hluta verðsins." : "Ekkert félag er komið í samstarf enn."}>
          <label className="block text-sm font-medium text-hc-ink-2" htmlFor="union-select">Stéttarfélag</label>
          <select id="union-select" value={unionId} onChange={(e) => setUnionId(e.target.value)} className="mt-1 w-full rounded-lg border border-hc-control bg-hc-surface px-3 py-2.5">
            <option value="">Veldu félag…</option>
            {info.unions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {union && (
            <div className="mt-2 text-sm text-hc-ink-2">
              {q.explanation && <p>{q.explanation}</p>}
              {union.rules_summary && <p className="text-xs text-hc-ink-3">{union.rules_summary}</p>}
              {union.settlement === "direct" ? (
                <label className="mt-2 flex items-start gap-2 text-xs text-hc-ink-2">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#047857]" />
                  Ég staðfesti aðild mína að {union.name} og heimila Lifeline Health að innheimta styrkinn beint hjá félaginu. Félagið fær nafn, kennitölu og lýsingu þjónustunnar, engar heilsufarsupplýsingar.
                </label>
              ) : (
                <p className="mt-2 text-xs text-hc-ink-3">Þú færð tilbúna umsókn (PDF) sem þú getur sent félaginu beint héðan með einum smelli.</p>
              )}
            </div>
          )}
        </ContributionToggle>
      </div>
      )}

      <div className="rounded-2xl border border-hc-hairline p-4 text-sm">
        <Row label="Verð" value={formatIsk(q.priceIsk)} />
        {q.employerIsk > 0 && <Row label={`${company?.company_name ?? "Vinnuveitandi"} greiðir${company && company.contribution_isk == null && company.contribution_percent < 100 ? ` (${companyCovers})` : ""}`} value={`−${formatIsk(q.employerIsk)}`} />}
        {q.directGrantIsk > 0 && <Row label={`Styrkur ${union?.name ?? ""} (dreginn frá)`} value={`−${formatIsk(q.directGrantIsk)}`} />}
        <Row label="Þú greiðir núna" value={formatIsk(q.chargedIsk)} strong />
        {q.reimbursementIsk > 0 && (
          <>
            <Row label={`Endurgreiðsla frá ${union?.name ?? "félagi"}`} value={`−${formatIsk(q.reimbursementIsk)}`} muted />
            <Row label="Kostnaður þinn eftir endurgreiðslu" value={formatIsk(q.netCostIsk)} strong accent />
          </>
        )}
        {useUnion && union && q.chargedIsk === 0 && q.employerIsk >= q.priceIsk && (
          <p className="mt-2 text-xs text-hc-ink-3">Vinnuveitandinn greiðir allt, svo ekkert er eftir til að sækja um hjá félaginu.</p>
        )}
      </div>

      <details className="text-sm text-hc-ink-2" open={usingTest || undefined}>
        <summary className="cursor-pointer text-xs font-semibold text-hc-ink-3">Ertu með prófunarkóða?</summary>
        <label className="mt-2 block text-xs font-medium text-hc-ink-2" htmlFor="test-code">Prófunarkóði</label>
        <input id="test-code" value={testCode} onChange={(e) => { setTestCode(e.target.value.toUpperCase()); setErr(""); }}
          autoComplete="off" spellCheck={false} placeholder="TEST-XXXX-XXXX"
          className="mt-1 w-full rounded-lg border border-hc-control px-3 py-2.5 font-mono uppercase tracking-wider" />
        <p className="mt-1 text-xs text-hc-ink-3">
          {usingTest && (useCompany || useUnion)
            ? "Prófunarkóði er ekki notaður með vinnuveitanda eða stéttarfélagi. Taktu hakið af þeim fyrst."
            : "Fyrir prófanir starfsfólks. Kaupin fara í gegnum allt ferlið án greiðslu."}
        </p>
      </details>

      <label className="flex items-start gap-2 text-sm text-hc-ink-2">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#047857]" />
        <span>Ég samþykki <a href="/soluskilmalar" target="_blank" rel="noopener noreferrer" className="underline">söluskilmála</a> Lifeline Health.</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-hc-ink-2">
        <input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#047857]" />
        <span>{WITHDRAWAL_WAIVER_LABEL}</span>
      </label>
      {info.eligibility_error && <p className="text-sm text-hc-warn-ink">{info.eligibility_error}</p>}
      {err && <p role="alert" className="text-sm text-hc-bad-ink">{err}</p>}
      <button type="button" onClick={pay} disabled={!canPay} className={`${hcBtn.cta} w-full`}>
        {busy ? "Augnablik…" : usingTest ? "Staðfesta með prófunarkóða" : q.chargedIsk > 0 ? `Greiða ${formatIsk(q.chargedIsk)}` : "Staðfesta"}
      </button>
    </div>
  );
}

function Row({ label, value, strong, muted, accent }: { label: string; value: string; strong?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? "font-semibold text-hc-ink" : muted ? "text-hc-ink-3" : "text-hc-ink-2"} ${accent ? "border-t border-hc-hairline pt-2 text-hc-brand-text" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}

/** The Medalia activation code, with a copy button. */
export function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="flex-1 select-all rounded-xl bg-hc-ok-surface px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.15em] text-hc-ok-ink">{code}</span>
      <button type="button"
        onClick={async () => {
          // The clipboard is refused outside a secure context and on some
          // in-app browsers; say so rather than doing nothing.
          try { await navigator.clipboard.writeText(code); } catch {
            toast.show("Ekki tókst að afrita – veldu kóðann og afritaðu hann", { tone: "bad" });
            return;
          }
          setCopied(true); setTimeout(() => setCopied(false), 1500);
        }}
        className="min-h-11 rounded-xl border border-hc-control px-3 text-xs font-semibold text-hc-ink-2 hover:bg-hc-sunken"
      >
        {copied ? "Afritað" : "Afrita"}
      </button>
    </div>
  );
}
