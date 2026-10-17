"use client";

// /app/uppsetning — the guided setup, opened only when somebody asks for it.
//
// It replaces the onboarding that started by itself on /app. Six steps, each
// skippable, resumable on any device (hc_setup_progress through
// /api/hc/setup), with „Halda áfram síðar“ on every screen:
//
//   1 heimilisfang   postcode first, town from Pósturinn's list
//   2 skyrsla        upload the Grunnheilsa PDF (with how-to), or go without
//   3 aaetlun        first plan from a goal (FirstPlanWizard via PlanEditor)
//   4 hreyfing       movement and what to spare — skippable here, asked again
//                    before the first training session if unanswered
//   5 app            the app on the home screen (asked only here)
//   6 tilkynningar   the daily reminder
//   then a done screen → „Fara í Í dag“
//
// ?skref=<key> opens a step directly (the coaching offer links to
// ?skref=heimilisfang). Steps already true (an address on file, a plan) show
// as done and offer „Áfram“ rather than asking again.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, CircleCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import * as cache from "@/lib/hc/client-cache";
import JourneyNav, { JourneyHeader } from "@/app/components/hc/JourneyNav";
import StepHeader from "@/app/components/hc/StepHeader";
import { AddressForm } from "@/app/components/hc/AddressFields";
import ReportHowto from "@/app/components/hc/ReportHowto";
import ReportUpload from "@/app/components/hc/ReportUpload";
import PlanEditor from "@/app/components/hc/PlanEditor";
import MovementSafety from "@/app/components/hc/MovementSafety";
import InstallGuide from "@/app/components/hc/InstallGuide";
import NudgeSettings from "@/app/components/hc/NudgeSettings";
import { hcBtn, hcCard, hcKicker, hcPage } from "@/app/components/hc/ui";
import { SAVE_FAILED, useToast } from "@/app/components/hc/Toast";
import { PUBLIC_PRIVACY_VERSION, PUBLIC_TERMS_VERSION } from "@/lib/public-pages-content";
import {
  EMPTY_PROGRESS, SETUP_STEPS, SETUP_TITLES, isSetupStep, resumeStep, stepState,
  type SetupContext, type SetupProgress, type SetupStep,
} from "@/lib/hc/setup-steps";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

const WHY: Record<SetupStep, string> = {
  heimilisfang: "Það ræður hvaða þjónusta býðst þar sem þú býrð, til dæmis þjálfun á staðnum.",
  skyrsla: "Ef þú hefur farið í heilsufarsskoðun getur áætlunin byggt á niðurstöðunum þínum.",
  aaetlun: "Nokkrar venjur til að byrja á. Þú getur breytt öllu síðar.",
  hreyfing: "Æfingarnar eru lagaðar að svörunum, svo þær reyni ekki á það sem þarf að hlífa.",
  app: "Þá opnast Lifeline eins og app, og á iPhone þarf þetta til að tilkynningar berist.",
  tilkynningar: "Lítil áminning á tíma sem þú velur. Þú ræður hvort og hvernig.",
};

export default function UppsetningPage() {
  return <Suspense><Uppsetning /></Suspense>;
}

function Uppsetning() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [ctx, setCtx] = useState<SetupContext | null>(null);
  const [step, setStep] = useState<SetupStep | "lokid" | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const api: Api = useCallback(async (url, init = {}) => {
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    return fetch(url, {
      ...init,
      headers: {
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(init.body && !(typeof FormData !== "undefined" && init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  }, []);

  const load = useCallback(async () => {
    cache.invalidate("/api/hc/setup");
    const r = await api("/api/hc/setup").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (!j) { setFailed(true); return null; }
    setProgress(j.progress ?? EMPTY_PROGRESS);
    setCtx(j.context);
    setFailed(false);
    return j as { progress: SetupProgress; context: SetupContext };
  }, [api]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    const r = await api("/api/hc/setup", { method: "POST", body: JSON.stringify(body) }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (j?.progress) setProgress(j.progress);
    cache.invalidate("/api/hc/setup");
    return !!j;
  }, [api]);

  /* Once per visit: moving between steps rewrites ?skref= in place, and
     that must not send the page back through its first-load decision. */
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { router.replace(`/account/login?next=${encodeURIComponent("/app/uppsetning")}`); return; }
      const j = await load();
      if (!j) return;
      const want = params.get("skref");
      const first = isSetupStep(want) ? want
        : j.progress.completed_at ? "lokid"
        : resumeStep(j.progress, j.context);
      setStep(first);
      if (!j.progress.started_at) void post({ action: "start", current: first === "lokid" ? null : first });
      else if (first !== "lokid") void post({ current: first });
    })();
  }, [load, post, params, router]);

  const go = (s: SetupStep | "lokid") => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "instant" });
    const u = new URL(window.location.href);
    if (s === "lokid") u.searchParams.delete("skref"); else u.searchParams.set("skref", s);
    window.history.replaceState(null, "", u);
    if (s === "lokid") void post({ action: "complete" });
    else void post({ current: s });
  };

  const nextOf = (s: SetupStep): SetupStep | "lokid" => {
    const i = SETUP_STEPS.indexOf(s);
    return SETUP_STEPS[i + 1] ?? "lokid";
  };

  /** Record this step and move on. */
  const finish = async (s: SetupStep, status: "done" | "skipped") => {
    setBusy(true);
    const ok = await post({ step: s, status });
    setBusy(false);
    if (!ok) { toast.show(SAVE_FAILED, { tone: "bad" }); return; }
    go(nextOf(s));
  };

  const later = async () => {
    setBusy(true);
    if (step && step !== "lokid") await post({ current: step });
    setBusy(false);
    router.push("/app");
  };

  const shell = (children: React.ReactNode) => (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-4 sm:pb-16 sm:pt-8">
        <div className="print:hidden">
          <JourneyHeader />
          <div className="sm:mb-4"><JourneyNav active="me" /></div>
        </div>
        {children}
      </div>
    </div>
  );

  if (failed) {
    return shell(
      <div className={`${hcCard.base} p-6`}>
        <p className="font-semibold text-hc-ink">Ekki tókst að sækja uppsetninguna.</p>
        <p className="mt-1 text-sm text-hc-ink-2">Athugaðu nettenginguna og reyndu aftur.</p>
        <button type="button" onClick={() => void load()} className={`${hcBtn.secondary} mt-4`}>Reyna aftur</button>
      </div>,
    );
  }
  if (!progress || !ctx || !step) {
    return shell(<div className="h-80 rounded-hc-card hc-shimmer" aria-busy="true" aria-label="Hleð" />);
  }

  if (!ctx.has_journey) {
    return shell(
      <div className={`${hcCard.base} p-6`}>
        <h1 className="text-xl font-bold text-hc-ink">Fyrst þarf að velja leið</h1>
        <p className="mt-1 text-sm text-hc-ink-2">Uppsetningin byggir á leiðinni sem þú velur, heilsufarsskoðun eða þjálfun í appinu.</p>
        <Link href="/app" className={`${hcBtn.cta} mt-4`}>Velja leið</Link>
      </div>,
    );
  }

  /* Terms first, only if they were never stored (signup normally takes
     them). Health data is saved in the steps that follow, so this one
     cannot be skipped — but „Halda áfram síðar“ still works. */
  if (!ctx.terms_accepted) {
    return shell(<Terms onDone={() => void load()} onLater={() => void later()} />);
  }

  if (step === "lokid") {
    const open = SETUP_STEPS.filter((s) => stepState(s, progress, ctx) !== "done");
    return shell(
      <section className={`${hcCard.base} p-6 text-center sm:p-8`}>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-hc-brand-dark text-white">
          <Check className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-hc-ink">Uppsetningunni er lokið</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-hc-ink-2">
          {open.length ? "Það sem þú slepptir getur þú klárað hvenær sem er, hér eða undir Ég." : "Allt er klárt. Þú getur breytt hverju sem er síðar undir Ég."}
        </p>
        {open.length > 0 && (
          <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left">
            {open.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => go(s)}
                  className="flex min-h-11 w-full items-center justify-between rounded-hc-element px-3 text-sm font-semibold text-hc-ink-2 ring-1 ring-hc-hairline hover:bg-hc-sunken">
                  {SETUP_TITLES[s]} <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link href="/app" className={`${hcBtn.cta} mt-6 w-full sm:w-auto`}>Fara í Í dag</Link>
      </section>,
    );
  }

  const n = SETUP_STEPS.indexOf(step) + 1;
  const state = stepState(step, progress, ctx);
  const prev = n > 1 ? SETUP_STEPS[n - 2] : null;
  const advance = () => void finish(step, "done");
  const doneNote = (text: string, extra?: React.ReactNode) => (
    <div className="rounded-hc-element bg-hc-brand-surface p-4">
      <p className="flex items-center gap-2 font-semibold text-hc-ink"><CircleCheck className="h-5 w-5 text-hc-brand-text" aria-hidden /> {text}</p>
      {extra}
      <button type="button" onClick={advance} disabled={busy} className={`${hcBtn.cta} mt-3`}>
        Áfram <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );

  return shell(
    <>
      <StepHeader n={n} total={SETUP_STEPS.length} busy={busy} onBack={prev ? () => go(prev) : undefined} />
      <p className={`${hcKicker} text-hc-brand-text`}>Uppsetning · skref {n} af {SETUP_STEPS.length}</p>
      <h1 className="mt-1 text-2xl font-bold leading-tight text-hc-ink">{TITLE[step]}</h1>
      <p className="mt-1.5 text-sm text-hc-ink-2">{WHY[step]}</p>

      <div className="mt-5">
        {step === "heimilisfang" && (
          <div className={`${hcCard.base} p-5`}>
            <AddressForm api={api} prefill={ctx.report_address}
              submitLabel={state === "done" ? "Vista breytingu" : "Vista og halda áfram"}
              onSaved={(a) => { setCtx((c) => (c ? { ...c, address: a.address } : c)); void finish("heimilisfang", "done"); }} />
            {state === "done" && (
              <button type="button" onClick={advance} disabled={busy} className="mt-3 min-h-11 text-sm font-semibold text-hc-brand-text underline">
                Heimilisfangið er rétt, áfram
              </button>
            )}
          </div>
        )}

        {step === "skyrsla" && (
          ctx.has_report
            ? doneNote("Skýrslan þín er komin inn.")
            : <ReportStep api={api} portal={ctx.portal_url} busy={busy}
                onUploaded={async () => { await load(); void finish("skyrsla", "done"); }}
                onNoReport={() => void finish("skyrsla", "done")} />
        )}

        {step === "aaetlun" && (
          ctx.has_plan
            ? doneNote("Áætlunin þín er tilbúin.", (
              <p className="mt-1 text-sm text-hc-ink-2">
                Viltu breyta henni? <Link href="/app/aaetlun?breyta=1" className="font-semibold underline">Fínstilla áætlunina</Link>
              </p>
            ))
            : (
              <>
                {ctx.entry === "check" && !ctx.has_report && (
                  <p className="mb-3 rounded-hc-element bg-hc-sunken p-3 text-sm text-hc-ink-2">
                    Í heilsufarsskoðun setur hjúkrunarfræðingur áætlunina saman með þér eftir niðurstöðurnar. Þú getur samt byrjað á þinni eigin núna og breytt henni þá.
                  </p>
                )}
                <PlanEditor api={api}
                  onDone={async () => { await load(); void finish("aaetlun", "done"); }}
                  onCancel={() => void finish("aaetlun", "skipped")} />
              </>
            )
        )}

        {step === "hreyfing" && (
          ctx.training_saved
            ? doneNote("Svörin eru komin.", <p className="mt-1 text-sm text-hc-ink-2">Þú getur breytt þeim í æfingastillingunum.</p>)
            : (
              <div className={`${hcCard.base} p-5`}>
                <MovementSafety api={api} mode="setup"
                  onSaved={async () => { cache.invalidate("/api/hc/training"); await load(); void finish("hreyfing", "done"); }} />
              </div>
            )
        )}

        {step === "app" && (
          <div className="space-y-3">
            <InstallGuide bare defaultOpen />
            <button type="button" onClick={advance} disabled={busy} className={`${hcBtn.cta} w-full`}>
              Áfram <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        {step === "tilkynningar" && (
          <div className="space-y-3">
            <div className={`${hcCard.base} p-5`}><NudgeSettings api={api} /></div>
            <button type="button" onClick={advance} disabled={busy} className={`${hcBtn.cta} w-full`}>
              Áfram <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {/* Every step can be left: skipped for now, or the whole setup put
          off. Neither loses anything already saved. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-hc-hairline pt-4">
        {state !== "done" ? (
          <button type="button" onClick={() => void finish(step, "skipped")} disabled={busy}
            className="min-h-11 text-sm font-semibold text-hc-ink-2 underline">
            Sleppa þessu skrefi
          </button>
        ) : <span />}
        <button type="button" onClick={() => void later()} disabled={busy}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-hc-ink-3 underline">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Halda áfram síðar
        </button>
      </div>
    </>,
  );
}

const TITLE: Record<SetupStep, string> = {
  heimilisfang: "Hvar býrðu?",
  skyrsla: "Ertu með skýrslu úr heilsufarsskoðun?",
  aaetlun: "Fyrsta áætlunin",
  hreyfing: "Hreyfing og það sem þarf að varast",
  app: "Settu Lifeline á heimaskjáinn",
  tilkynningar: "Áminningar",
};

/** The report step: upload (with how-to) first, going without second. */
function ReportStep({ api, portal, busy, onUploaded, onNoReport }: {
  api: Api; portal: string; busy: boolean;
  onUploaded: () => void | Promise<void>;
  onNoReport: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className={`${hcCard.base} overflow-hidden`}>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className="flex min-h-14 w-full items-center gap-3 p-4 text-left">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-hc-ink">Já, setja inn Grunnheilsu-skýrsluna</span>
            <span className="mt-0.5 block text-sm text-hc-ink-2">PDF-skjal úr sjúklingagáttinni. Við sýnum þér hvernig.</span>
          </span>
          <ArrowRight className={`h-4 w-4 shrink-0 text-hc-ink-3 transition ${open ? "rotate-90" : ""}`} aria-hidden />
        </button>
        {open && (
          <div className="space-y-4 border-t border-hc-hairline p-4">
            <ReportHowto portalUrl={portal} />
            <ReportUpload api={api} onDone={() => void onUploaded()} heading="Settu skýrsluna inn hér" />
          </div>
        )}
      </div>
      <button type="button" onClick={onNoReport} disabled={busy}
        className={`${hcCard.base} flex min-h-14 w-full items-center gap-3 p-4 text-left disabled:opacity-60`}>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-hc-ink">Ég er ekki með skýrslu</span>
          <span className="mt-0.5 block text-sm text-hc-ink-2">Þá setjum við saman áætlun út frá markmiðinu þínu í næsta skrefi.</span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-hc-ink-3" aria-hidden />
      </button>
    </div>
  );
}

/** Terms, for the rare account that never stored them at signup. */
function Terms({ onDone, onLater }: { onDone: () => void; onLater: () => void }) {
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async () => {
    setBusy(true);
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) { setBusy(false); toast.show("Innskráningin rann út – skráðu þig aftur inn", { tone: "bad" }); return; }
    /* The same write the signup form and the old onboarding made: the
       encrypting view, the person's own session, the same version string. */
    const { error } = await supabase.from("clients_decrypted").update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: `tos-${PUBLIC_TERMS_VERSION}+priv-${PUBLIC_PRIVACY_VERSION}`,
    }).eq("id", uid);
    setBusy(false);
    if (error) { toast.show(SAVE_FAILED, { tone: "bad" }); return; }
    onDone();
  };
  return (
    <section className={`${hcCard.base} p-6`}>
      <h1 className="text-2xl font-bold text-hc-ink">Áður en við byrjum</h1>
      <p className="mt-1 text-sm leading-relaxed text-hc-ink-2">Í uppsetningunni vistum við upplýsingar um heilsu þína, og til þess þarftu að samþykkja skilmálana.</p>
      <label className="mt-5 flex items-start gap-2.5 rounded-hc-element bg-hc-sunken p-4">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#047857]" />
        <span className="text-sm leading-snug text-hc-ink">
          Ég samþykki <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold underline">notkunarskilmála</a> og{" "}
          <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold underline">persónuverndarstefnu</a> Lifeline Health ({PUBLIC_TERMS_VERSION}).
        </span>
      </label>
      <button type="button" disabled={!accept || busy} onClick={() => void save()} className={`${hcBtn.cta} mt-5 w-full`}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Samþykkja og halda áfram
      </button>
      <button type="button" onClick={onLater} className="mt-2 min-h-11 w-full text-sm font-semibold text-hc-ink-3 underline">Halda áfram síðar</button>
    </section>
  );
}
