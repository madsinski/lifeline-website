"use client";

// Heilsuferðin — the customer's self-service health-check journey. One flow
// for B2C and B2B; only the way in and the way of paying differ. Every step
// is either the customer's own action here, or advances by itself (patient
// portal, workstation). Backed by /api/hc/*.

import * as cache from "@/lib/hc/client-cache";
import { hcBtn, hcCard, hcKicker, hcPage } from "@/app/components/hc/ui";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ensureSignupConsentRecorded } from "@/lib/signup-consent";
import LifelineLogo from "@/app/components/LifelineLogo";
import OnboardingPlayer from "@/app/components/hc/OnboardingPlayer";
import { INTERVIEW_WAIT_DAYS, interviewEligibleFrom, type JourneyStep, type StepKey, STEP_SHORT } from "@/lib/hc/stages";
import AppointmentCard from "@/app/components/hc/AppointmentCard";
import ReportUpload from "@/app/components/hc/ReportUpload";
import ReportApproval from "@/app/components/hc/ReportApproval";
import RetentionReview from "@/app/components/hc/RetentionReview";
import JourneyNav, { JourneyHeader } from "@/app/components/hc/JourneyNav";
import StepDot from "@/app/components/hc/StepDot";
import { Alert, Button, ButtonLink, fmtDate as fmtDay, useDialog } from "@/app/components/account/ui";
import { Check } from "lucide-react";
import ProfileForm, { ConsentBox } from "@/app/components/hc/ProfileForm";
import { WEB_CLIENT_HEADER, WITHDRAWAL_WAIVER_LABEL } from "@/app/components/hc/Paywall";
import NextStepCard from "@/app/components/hc/NextStepCard";
import StepHeader from "@/app/components/hc/StepHeader";
import { upcomingAppointments } from "@/lib/hc/upcoming";
import { SAVE_FAILED, useToast } from "@/app/components/hc/Toast";
import { formatIsk, type HcJourney, type HcLocation, type HcOrder, type HcPackage } from "@/lib/hc/types";
import { quote, type UnionRules } from "@/lib/hc/reimbursement";

interface JourneyData {
  journey: HcJourney;
  steps: JourneyStep[];
  profile: { email: string; full_name: string | null; phone: string | null; address: string | null; kennitala_last4: string | null; complete: boolean; company_name: string | null; health_consent?: boolean };
  location: HcLocation | null;
  packages: HcPackage[];
  orders: HcOrder[];
  claims: { id: string; order_id: string; union_id: string; union_name: string | null; reimbursable_isk: number; status: string; sent_at: string | null; sent_to: string | null }[];
  lectures: { id: string; slug: string; title: string; subtitle: string | null; kind: string; duration_min: number | null; pillar: string | null; is_welcome: boolean; completed_at: string | null }[];
  plan: { id: string; headline: string | null; published_at: string; review_date: string | null } | null;
  calendar_connected: boolean;
  history?: { id: string; created_at: string; completed_at: string | null; plan_published_at: string | null }[];
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function api(url: string, init: RequestInit = {}) {
  const headers = { ...(await authHeaders()), /* FormData must set its own Content-Type: the boundary is part of
           it, and naming the type without one leaves the body
           unparseable. Avatar upload failed silently on exactly this. */
        ...(init.body && !(typeof FormData !== "undefined" && init.body instanceof FormData)
          ? { "Content-Type": "application/json" } : {}), ...(init.headers as Record<string, string> | undefined) };
  return fetch(url, { ...init, headers });
}

/** A server error worth showing as is: a sentence, not a code like "order_failed". */
const humanError = (e: unknown, fallback: string) =>
  typeof e === "string" && /\s/.test(e) ? e : fallback;

// Written out by hand: a browser without Icelandic locale data falls back to
// English ("Fri, October 2 at 09:08 PM").
const MO_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const WD_IS = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];
const fmtDateTime = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${WD_IS[d.getDay()]} ${d.getDate()}. ${MO_IS[d.getMonth()]} kl. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const fmtDate = (iso: string | null) => (iso ? fmtDay(iso) : null);

export default function HeilsuferdPage() {
  return (
    <Suspense>
      <Heilsuferd />
    </Suspense>
  );
}

function Heilsuferd() {
  const router = useRouter();
  const params = useSearchParams();
  const stadur = params.get("stadur") || "";
  const startParam = params.get("start") === "1";
  // Once the plan exists, "Í dag" is home; ?ferd=1 is the journey itself.
  const showJourney = params.get("ferd") === "1";
  const [authed, setAuthed] = useState<boolean | null>(null);
  /* Starts false; the player flips it true either by finishing the flow or
     by reporting that there is none. */
  const [onboarded, setOnboarded] = useState(false);
  const [data, setData] = useState<JourneyData | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<StepKey | null>(null);
  const [noJourney, setNoJourney] = useState(false);
  /* What the server said when there was no journey yet: whether this is a
     B2B employee and which route /byrja recorded. Read once, in the effect
     below, to decide whether anything still has to be asked. */
  const startInfo = useRef<{ b2b: boolean; start_track: "check" | "coach" | null } | null>(null);
  /* "choose" only when neither /byrja nor an employer has decided the
     route; otherwise the journey is created and the route applied at once. */
  const [choosing, setChoosing] = useState(false);
  const toast = useToast();

  const load = useCallback(async (fresh = false): Promise<JourneyData | null> => {
    const url = `/api/hc/journey${stadur ? `?stadur=${encodeURIComponent(stadur)}` : startParam ? "?start=1" : ""}`;
    const show = (j: JourneyData) => {
      if (!j.journey) {
        const raw = j as unknown as { b2b?: boolean; start_track?: string | null };
        startInfo.current = {
          b2b: !!raw.b2b,
          start_track: raw.start_track === "coach" || raw.start_track === "check" ? raw.start_track : null,
        };
        setNoJourney(true);
        return false;
      }
      setNoJourney(false);
      if (j.plan && !showJourney) { router.replace("/app/aaetlun"); return false; }
      setData(j);
      setOpen((o) => o ?? j.steps.find((s) => s.state === "current")?.key ?? null);
      return true;
    };
    // Cached first (coming back from "Í dag"), then fresh in the background.
    const cached = fresh ? null : cache.peek<JourneyData>(url);
    if (cached && !show(cached.body)) return null;
    if (fresh) cache.invalidate("/api/hc/journey");
    const r = await cache.load(api, url);
    if (r.status === 401) { setAuthed(false); return null; }
    if (r.status >= 400) { if (!cached) setError("Ekki tókst að sækja heilsuferðina. Reyndu aftur."); return null; }
    const j = r.body as JourneyData;
    if (!show(j)) return null;
    // "Í dag" is one tap away: have it ready.
    if (j.plan) cache.prefetch(api, ["/api/hc/actions", "/api/hc/plan"]);
    return j;
  }, [stadur, startParam, showJourney, router]);

  /** After a step is completed: reload and open the next step. */
  const advance = useCallback(async () => {
    const j = await load(true);
    const next = j?.steps.find((s) => s.state === "current")?.key ?? null;
    setOpen(next);
    if (next) setTimeout(() => document.getElementById(`step-${next}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [load]);

  /** Create the journey, with its route applied in the same request. */
  const startJourney = useCallback(async (track: "check" | "coach" | null) => {
    const qs = new URLSearchParams({ start: "1" });
    if (stadur) qs.set("stadur", stadur);
    if (track) qs.set("track", track);
    const r = await api(`/api/hc/journey?${qs.toString()}`).catch(() => null);
    /* A failed create used to drop the chooser and leave "Augnablik…" up
       for good. Keep the chooser (or show it) and say so instead. */
    if (!r || !r.ok) {
      toast.show("Ekki tókst að hefja ferðina – reyndu aftur", { tone: "bad" });
      setChoosing(true);
      return;
    }
    setChoosing(false);
    await load(true);
  }, [stadur, load, toast]);

  /* Stable, because the player refetches when it changes. */
  const onboardingFinished = useCallback(() => {
    void load(true).then((j) => {
      /* The coaching track has no workup to follow: its next thing is the
         plan, and that page knows how to start one. Redirected before the
         journey page renders, so it does not flash past. */
      if (j && (j.journey.entry === "coach" || j.journey.entry === "app") && !j.plan && !showJourney) {
        router.replace("/app/aaetlun");
        return;
      }
      setOnboarded(true);
    });
  }, [load, router, showJourney]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { setAuthed(false); return; }
      if (!s.session.user.email_confirmed_at) { router.replace(`/account/login?verify=1&email=${encodeURIComponent(s.session.user.email ?? "")}&next=/app`); return; }
      setAuthed(true);
      /* The /byrja clickwrap, copied onto the clients row server side.
         Awaited so the onboarding player (which keys its terms screen on
         clients.terms_accepted_at) sees it. Never throws; skips itself
         once done. */
      await ensureSignupConsentRecorded();
      const j = await load();
      if (j) return;
      /* No journey yet. The route is already known for almost everybody —
         /byrja asked it, or an employer paid for the check — so the journey
         is made with it straight away. Only somebody who arrived some other
         way, with nothing recorded, is asked. */
      const info = startInfo.current;
      if (!info) return;
      if (info.b2b) await startJourney("check");
      else if (info.start_track) await startJourney(info.start_track);
      else setChoosing(true);
    })();
  }, [load, router, startJourney]);

  if (authed === false) return <FirstStep stadur={stadur} />;

  if (choosing) return <ChooseRoute onChoose={startJourney} />;

  /* Until the journey exists there is nothing for the player to key its
     flow on (the track decides which flow and which screens). */
  if (!data && !error) {
    return (
      <Shell>
        <div className="grid min-h-[50vh] place-items-center text-sm text-hc-ink-2">Hleð…</div>
      </Shell>
    );
  }

  /* A published onboarding flow runs after the journey is created and
     before its page is shown.
     OnboardingPlayer renders nothing when there is no flow, when this person
     has finished it, or when the fetch fails — so the app is never behind a
     screen that cannot load. That is deliberate: onboarding which can strand
     somebody is worse than none, and the sequence this replaces could strand
     you behind an email confirmation with no way past. */
  if (!onboarded) {
    return (
      <Shell>
        <OnboardingPlayer api={api} onFinished={onboardingFinished} />
      </Shell>
    );
  }

  if (noJourney) {
    return (
      <Shell>
        <div className="grid min-h-[50vh] place-items-center text-sm text-hc-ink-2">Augnablik…</div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        {error
          ? (
            <Alert tone="bad" title="Ekki tókst að sækja heilsuferðina"
              actions={<Button variant="secondary" onClick={() => { setError(""); void load(true); }}>Reyna aftur</Button>}>
              Athugaðu nettenginguna og reyndu aftur.
            </Alert>
          )
          : <div className="rounded-3xl bg-hc-surface p-10 text-center text-hc-ink-3 shadow-sm">Hleð heilsuferðinni…</div>}
      </Shell>
    );
  }

  const coaching = data.journey.entry === "coach" || data.journey.entry === "app";
  /* The ring counts what the participant does. The account is made before
     they arrive here, and on the health check the report and the plan are
     ours — counting them made the ring stall for weeks at a time on steps
     nobody could act on. */
  const isOurs = (k: StepKey) => !coaching && OURS_KEYS.has(k);
  const mine = data.steps.filter((s) => !s.optional && s.key !== "account" && !isOurs(s.key));
  const done = mine.filter((s) => s.state === "done").length;
  const required = mine.length;
  const current = data.steps.find((s) => s.state === "current");
  // The step being worked on, unless the customer has picked another.
  const shownStep = data.steps.find((x) => x.key === open)
    ?? current
    // Plan published: nothing is "current", and the last step (re-evaluation)
    // is a year away. The plan is what they are living with now.
    ?? (data.plan ? data.steps.find((x) => x.key === "plan") : undefined)
    ?? data.steps.find((x) => x.state === "upcoming")
    ?? data.steps.at(-1)
    ?? null;
  const next = upcomingAppointments(data.journey, data.location)[0] ?? null;
  // Steps where the next move is Lifeline's, not the participant's.
  const jj = data.journey;
  const ours = !coaching && !!current && (
    current.key === "report"
    || current.key === "plan"
    || (current.key === "interview" && !jj.interview_booked_for)
    || (current.key === "tests" && !!jj.protocol_activated_at && !!(jj.blood_test_done_at || jj.blood_results_at) && !!jj.measurements_done_at)
  );
  const healthOrder = data.orders.find((o) => o.journey_id === data.journey.id && (o.kind === "health_check" || o.kind === "reevaluation"));

  return (
    <Shell>
      {/* The bar on every state of this page. With a plan this is the
          journey map under Ég; before one, it is Í dag. sm:mb-4 — on a
          phone the bar is fixed to the bottom and takes no room here. */}
      <JourneyHeader />
      <div className="sm:mb-4"><JourneyNav active={data.plan ? "journey" : "today"} /></div>
      {/* First thing on the page: a report somebody else entered is not
          shown anywhere until the person says it is theirs. */}
      <div className="mb-4"><ReportApproval api={api} onDone={() => load(true)} /></div>
      <RetentionReview api={api} onDone={() => load(true)} />
      {next && <div className="mb-4"><AppointmentCard a={next} /></div>}
      {data.profile.complete && data.profile.health_consent === false && <ConsentCard reload={() => load(true)} />}
      {/* Hero: where you are, in one glance, and the one thing to do next. */}
      <section className={`${hcCard.hero} overflow-hidden p-6 sm:p-8`}>
        <div className="flex items-center gap-5">
          <ProgressRing done={done} total={required} />
          <div className="min-w-0 flex-1">
            <p className={`${hcKicker} text-emerald-300`}>Heilsuferðin þín{data.location ? ` · ${data.location.name}` : ""}</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {data.profile.full_name ? `Hæ ${data.profile.full_name.split(" ")[0]}` : "Velkomin(n)"}
            </h1>
            <p className="mt-1 text-emerald-100">
              {data.plan
                ? "Áætlunin þín er tilbúin. Hér sérðu ferðina í heild."
                : current
                  ? ours
                    ? <>Nú er komið að okkur: <strong className="text-white">{OURS_TEXT[current.key] ?? current.title}</strong>. Þú færð tölvupóst þegar næsta skref er þitt.</>
                    : <>Næsta skref: <strong className="text-white">{current.title}</strong></>
                  : "Þú hefur lokið öllum skrefum. Vel gert."}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {data.plan ? (
            <>
              {/* No buttons in the hero. Both of these went to the daily
                  app — which is what the navbar is for, on every screen —
                  and they competed with the one thing this page is about:
                  where the health check has got to. */}
            </>
          ) : current && !ours ? (
            <button type="button" onClick={() => { setOpen(current.key); setTimeout(() => document.getElementById(`step-${current.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
              className="inline-flex min-h-11 items-center rounded-hc-element bg-hc-surface px-5 font-bold text-hc-hero-to hover:bg-hc-ok-surface">Halda áfram: {current.title} →</button>
          ) : null}
          {data.profile.company_name && <span className="rounded-full bg-hc-surface/10 px-3 py-1 text-xs">Í boði {data.profile.company_name}</span>}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* min-w-0, or the strip below stretches this column instead of
            scrolling. A grid item's automatic minimum size is its content,
            so twelve step chips made a 1190px track inside a 390px page and
            body's overflow-x:auto turned that into a scrollable document —
            the same class of bug as the email address, measured the same
            way. */}
        {/* ── One step at a time ───────────────────────────────────
            This was all four phases listed at once, every step a row, and
            the open one unfolding in place. It read as a wall: eleven steps
            with their blurbs, most of them either long done or months away,
            and the one thing you could actually do somewhere in the middle.

            A health check is a sequence with real waiting in it — which is
            the whole reason this page exists — so the page shows where you
            are and gives you a way to look around, rather than everything
            at once. The strip across the top is the map; the card below is
            the step.

            It opens on the current step, which is the only one that is ever
            the answer to "what now". */}
        <div className="min-w-0 space-y-4">
          {/* The map: four phases rather than twelve chips. Twelve read as
              twelve errands, half of which were ours or a year away. The
              phase is what somebody actually wants to know ("where am I?");
              its steps are listed underneath, and the ones that are ours to
              do are grouped as such so nobody waits on themselves. */}
          {(() => {
            const phases = PHASES
              .map((ph) => ({ ...ph, steps: data.steps.filter((st) => ph.keys.includes(st.key)) }))
              .filter((ph) => ph.steps.length);
            const activePhase = phases.find((ph) => ph.steps.some((st) => st.key === shownStep?.key)) ?? phases[0];
            const theirs = activePhase?.steps.filter((st) => !isOurs(st.key)) ?? [];
            const ourSteps = activePhase?.steps.filter((st) => isOurs(st.key)) ?? [];
            const pill = (st: JourneyStep) => {
              const on = st.key === shownStep?.key;
              return (
                <button key={st.key} type="button" onClick={() => setOpen(st.key)} aria-pressed={on}
                  className={`inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand ${
                    on ? "bg-hc-brand-dark text-white"
                      : st.state === "done" ? "text-hc-brand-text hover:bg-hc-sunken"
                      : "text-hc-ink-3 hover:bg-hc-sunken"}`}>
                  {st.state === "done" && !on && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
                  {STEP_SHORT[st.key]}
                </button>
              );
            };
            return (
              <div>
                <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
                  {phases.map((ph) => {
                    const on = ph.title === activePhase?.title;
                    const req = ph.steps.filter((st) => !st.optional);
                    const allDone = req.length > 0 && req.every((st) => st.state === "done");
                    const here = ph.steps.some((st) => st.state === "current");
                    return (
                      <li key={ph.title} className="min-w-0">
                        <button type="button" aria-pressed={on}
                          onClick={() => setOpen((ph.steps.find((st) => st.state === "current") ?? ph.steps.find((st) => st.state !== "done") ?? ph.steps[0]).key)}
                          className="min-h-11 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
                          <span className={`block h-1.5 rounded-full ${allDone ? "bg-hc-brand-dark" : here ? "bg-hc-brand/60" : "bg-hc-sunken-2"}`} />
                          <span className={`mt-1.5 block truncate text-xs font-bold ${on ? "text-hc-ink" : "text-hc-ink-3"}`}>
                            {ph.title}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {(theirs.length > 1 || ourSteps.length > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {theirs.map(pill)}
                    {ourSteps.length > 0 && (
                      <>
                        <span className="ml-1 text-[11px] font-bold uppercase tracking-wide text-hc-ink-3">Á okkar könnu:</span>
                        {ourSteps.map(pill)}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {shownStep && (() => {
            const idx = data.steps.findIndex((x) => x.key === shownStep.key);
            const prev = idx > 0 ? data.steps[idx - 1] : null;
            const nextStep = idx < data.steps.length - 1 ? data.steps[idx + 1] : null;
            const phase = PHASES.find((ph) => ph.keys.includes(shownStep.key));
            return (
              <section className={`${shownStep.state === "current" ? hcCard.raised : hcCard.base} p-5 sm:p-6`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className={`${hcKicker} text-hc-ink-3`}>
                    {phase?.title}{isOurs(shownStep.key) ? " · Á okkar könnu" : ""}
                  </p>
                  {shownStep.state === "done" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-hc-brand/10 px-2.5 py-0.5 text-xs font-bold text-hc-brand-text">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> Lokið
                    </span>
                  )}
                  {shownStep.optional && shownStep.state !== "done" && (
                    <span className="rounded-full bg-hc-sunken-2 px-2.5 py-0.5 text-xs font-semibold text-hc-ink-2">Valfrjálst</span>
                  )}
                </div>
                <h2 className="mt-1 text-xl font-bold text-hc-ink sm:text-2xl">{shownStep.title}</h2>
                <p className="mt-1 text-sm text-hc-ink-2">{shownStep.blurb}</p>

                <div className="mt-4">
                  <StepBody step={shownStep} data={data} reload={async () => { await load(true); }} advance={advance} healthOrder={healthOrder ?? null} />
                </div>

                {/* Back and next by name rather than by arrow: knowing what
                    comes next is most of the value of a next button here. */}
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-hc-hairline pt-4">
                  {prev ? (
                    <button type="button" onClick={() => setOpen(prev.key)}
                      className="inline-flex min-h-11 min-w-0 items-center gap-1 text-sm font-semibold text-hc-ink-2 hover:text-hc-ink">
                      ← <span className="truncate">{STEP_SHORT[prev.key]}</span>
                    </button>
                  ) : <span />}
                  {nextStep ? (
                    <button type="button" onClick={() => setOpen(nextStep.key)}
                      className="inline-flex min-h-11 min-w-0 items-center gap-1 rounded-hc-element bg-hc-brand-dark px-4 text-sm font-semibold text-white">
                      <span className="truncate">{STEP_SHORT[nextStep.key]}</span> →
                    </button>
                  ) : <span />}
                </div>
              </section>
            );
          })()}

          {/* One optional thing at a time, once the required details are in. */}
          {data.profile.complete && <NextStepCard api={api} entry={data.journey.entry} />}
        </div>

        {/* Side */}
        <aside className="space-y-4">
          {healthOrder?.activation_code && (
            <div className="rounded-2xl border border-hc-hairline bg-hc-surface p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-hc-ok-ink">Virkjunarkóði</p>
              <CodeBox code={healthOrder.activation_code} />
              <p className="mt-2 text-xs text-hc-ink-3">{healthOrder.activation_redeemed_at ? "Virkjaður í sjúklingagátt." : "Sláðu kóðann inn í sjúklingagáttina."}</p>
            </div>
          )}
          {/* Fræðsla had its own card here. It has its own page in the
              navbar, and this page is for keeping track of the health
              check — which lectures are not a step of. */}
          <HistoryCard history={data.history ?? []} />
          {/* Settings, the PIN and the calendar live under Ég → Stillingar
              og áskrift; a second copy here was the same card twice. */}
          <ClaimsCard claims={data.claims} reload={async () => { await load(true); }} />
          {/* break-words, because this is where the side scroll came from.
              "contact@lifelinehealth.is" has no break opportunity, so the
              paragraph measured 402px inside a 358px column and body's
              overflow-x:auto turned that into a scrollable page. Measured at
              every width from 320 to 430; the document reported no overflow
              because body absorbed it, which is why it took a hunt. */}
          <p className="px-1 text-xs break-words text-hc-ink-3">
            Spurningar? Skrifaðu á <a className="underline" href="mailto:contact@lifelinehealth.is">contact@lifelinehealth.is</a>.
          </p>
        </aside>
      </div>
    </Shell>
  );
}

/** The journey's phases: the steps grouped the way people think about them. */
const PHASES: { title: string; keys: StepKey[] }[] = [
  { title: "Undirbúningur", keys: ["account", "profile", "welcome", "package"] },
  { title: "Skoðun", keys: ["tests", "upload", "report"] },
  { title: "Viðtal og áætlun", keys: ["interview", "plan"] },
  { title: "Eftirfylgd", keys: ["subscription", "followup", "reevaluation"] },
];

/** On the health check, the steps where the next move is Lifeline's. */
const OURS_KEYS = new Set<StepKey>(["report", "plan"]);

/** Progress as a ring (done of required), for the hero. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 30, c = 2 * Math.PI * r, pct = total ? done / total : 0;
  return (
    <div className="relative h-20 w-20 shrink-0" aria-label={`${done} af ${total} skrefum lokið`}>
      <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" className="text-emerald-300" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-lg font-bold">{done}/{total}</span>
        <span className="mt-0.5 text-[10px] text-emerald-100">skref</span>
      </span>
    </div>
  );
}

/** What Lifeline is doing, when the next move is ours. */
const OURS_TEXT: Partial<Record<StepKey, string>> = {
  tests: "niðurstöðurnar eru að berast",
  report: "læknir fer yfir skýrsluna",
  interview: "hjúkrunarfræðingur hefur samband til að bóka viðtalið",
  plan: "hjúkrunarfræðingurinn gengur frá áætluninni þinni",
};

function Shell({ children }: { children: React.ReactNode }) {
  // The heilsuferð is the participant's home, so this does not go "up" to
  // /account — that redirects straight back here. It goes to the account
  // page inside the journey, which is where the details, payments and
  // sign-out live. Without it there was no visible way off this page at all.
  return (
    <div className={hcPage.participant}>
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:pb-16 sm:pt-8">
        <div className="mb-3 print:hidden">
          {/* Stillingar is in the navbar. A second way in at the top of
              this page read like a back button to somewhere you had not
              been. */}
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Step 1 when logged out ─────────────────────────────────────────────────

/**
 * The route, for the few who arrive without one.
 *
 * /byrja asks this and stores it, and an employer-paid check decides it, so
 * almost nobody sees this screen — it is for an account made some other way.
 * Two cards, one line each, one tap: the same two routes /byrja names, in
 * the same words, so the choice reads as one product wherever it is made.
 * Either can be changed later under Stillingar → „Skipta um leið“.
 */
function ChooseRoute({ onChoose }: { onChoose: (track: "check" | "coach") => Promise<void> }) {
  const [busy, setBusy] = useState<"check" | "coach" | null>(null);
  const pick = async (t: "check" | "coach") => {
    setBusy(t);
    await onChoose(t);
    setBusy(null);
  };
  const routes = [
    { key: "check" as const, title: "Heilsufarsskoðun",
      line: "Mælingar, blóðprufa og viðtal við hjúkrunarfræðing — áætlun út frá þínum tölum." },
    { key: "coach" as const, title: "Þjálfun í appinu",
      line: "Æfingar, næring og svefn frá fyrsta degi, án mælinga." },
  ];
  return (
    <Shell>
      <div className="mx-auto max-w-xl">
        <StepHeader n={1} total={2} />
        <h1 className="text-2xl font-bold leading-tight text-hc-ink">Hvernig viltu byrja?</h1>
        <p className="mt-1.5 text-sm text-hc-ink-2">Þú getur skipt um leið síðar í stillingum.</p>
        <div className="mt-5 space-y-3">
          {routes.map((r) => (
            <button key={r.key} type="button" disabled={!!busy} onClick={() => void pick(r.key)}
              className="flex min-h-11 w-full flex-col rounded-2xl border-2 border-transparent bg-hc-surface p-4 text-left shadow-sm transition hover:border-hc-control disabled:opacity-60">
              <span className="font-bold text-hc-ink">{busy === r.key ? "Augnablik…" : r.title}</span>
              <span className="mt-1 text-sm leading-relaxed text-hc-ink-2">{r.line}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm text-hc-ink-3">
          Ertu þegar með skýrslu frá Lifeline? Veldu heilsufarsskoðun og settu hana inn í skrefinu „Settu skýrsluna inn“.
        </p>
      </div>
    </Shell>
  );
}

function FirstStep({ stadur }: { stadur: string }) {
  const next = `/app${stadur ? `?stadur=${encodeURIComponent(stadur)}` : ""}`;
  return (
    <div className={`flex min-h-screen items-center justify-center px-4 py-16 ${hcPage.participant}`}>
      <div className="w-full max-w-md text-center">
        <LifelineLogo size="lg" />
        <h1 className="mt-6 text-2xl font-bold text-hc-ink">Taktu fyrsta skrefið</h1>
        <p className="mt-2 text-hc-ink-2">Þrjár stuttar spurningar og frír aðgangur. Þú sérð hvað þér stendur til boða áður en þú skráir þig.</p>
        <div className="mt-6 space-y-3">
          <Link href="/byrja" className={`${hcBtn.cta} w-full`}>
            Byrja
          </Link>
          <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="block text-sm font-medium text-hc-ink-2 hover:text-hc-ink">
            Ég á nú þegar aðgang — skrá inn
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Step shell ─────────────────────────────────────────────────────────────

/**
 * When the interview can be booked, and why not yet if it cannot.
 *
 * Two clear days after the later of the blood draw and the measurements, so
 * the numbers are back before anyone sits down. Saying which of the two is
 * still outstanding is more use than a disabled button with no reason.
 */
function InterviewBooking({ j, portal }: { j: HcJourney; portal: string }) {
  // The clock is read after mount, not during render: reading it in render is
  // impure, and the server and the browser would disagree about "now".
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  const bloodDone = !!(j.blood_test_done_at ?? j.blood_results_at);
  const measured = !!j.measurements_done_at;
  const from = interviewEligibleFrom(j);
  const ready = !!from && now != null && from.getTime() <= now;

  if (!bloodDone || !measured) {
    const missing = [!measured ? "mælingarnar" : null, !bloodDone ? "blóðprufan" : null].filter(Boolean);
    return (
      <p className="rounded-xl bg-hc-sunken px-3 py-2 text-hc-ink-2">
        Viðtalið bókast þegar {missing.join(" og ")} {missing.length > 1 ? "eru" : "er"} búin.
        Eftir það líða {INTERVIEW_WAIT_DAYS} dagar á meðan niðurstöðurnar koma.
      </p>
    );
  }
  if (!ready && from) {
    return (
      <p className="rounded-xl bg-hc-sunken px-3 py-2 text-hc-ink-2">
        Niðurstöðurnar eru á leiðinni. Þú getur bókað viðtalið frá <strong>{fmtDate(from.toISOString())}</strong>.
      </p>
    );
  }
  return (
    <a href={portal} target="_blank" rel="noreferrer"
      className={hcBtn.cta}>
      Bóka viðtal í sjúklingagátt
    </a>
  );
}

/** One of the three things inside the tests step, ticked when it is done. */
function TestTask({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 ${done ? "border-hc-ok-ink/30 bg-hc-ok-surface/60" : "border-hc-hairline bg-hc-surface"}`}>
      <p className="flex items-center gap-2 font-semibold text-hc-ink">
        <StepDot state={done ? "done" : "todo"} n={n} size="sm" />
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/**
 * The subscription step.
 *
 * Fetches the package and the caller's own subscription, then either says
 * they already have it or offers it. Separate from Paywall because a step
 * has to handle "already subscribed" — a paywall never does, since it only
 * appears to people who are not.
 */
function SubscriptionStep({ api }: {
  api: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const [state, setState] = useState<{ package: Record<string, unknown> | null; subscription: { tier: string; status: string; current_period_end: string | null; trial?: boolean; trial_ends_at?: string | null } | null } | null>(null);

  useEffect(() => {
    let alive = true;
    api("/api/hc/subscribe").then((r: Response) => (r.ok ? r.json() : null)).then((j: typeof state) => {
      if (alive) setTimeout(() => setState(j ?? { package: null, subscription: null }), 0);
    }).catch(() => {});
    return () => { alive = false; };
  }, [api]);

  if (!state) return <div className="h-32 rounded-2xl hc-shimmer" aria-busy="true" aria-label="Hleð" />;

  if (state.subscription?.trial) {
    const until = state.subscription.trial_ends_at ?? state.subscription.current_period_end;
    return (
      <div className="space-y-2 text-sm text-hc-ink-2">
        <p className="font-semibold text-hc-ink">Þú ert á prufutíma{until ? ` til ${fmtDate(until)}` : ""}.</p>
        <p>Allt appið er opið á prufutímanum og ekkert er skuldfært. Verðið og hvað gerist þegar honum lýkur sérðu undir áskriftinni.</p>
        <ButtonLink href="/app/adgangur#askrift" variant="secondary">Sjá áskriftina</ButtonLink>
      </div>
    );
  }

  if (state.subscription) {
    const until = state.subscription.current_period_end;
    return (
      <div className="space-y-2 text-sm text-hc-ink-2">
        <p className="font-semibold text-hc-ink">Áskriftin er virk.</p>
        {until && (
          <p>
            Næsta greiðsla {fmtDate(until)}.
          </p>
        )}
        <p>Þú getur sagt upp hvenær sem er í stillingum — appið er opið til loka þess tímabils sem er greitt.</p>
        <ButtonLink href="/app/adgangur#askrift" variant="secondary">Sjá áskriftina</ButtonLink>
      </div>
    );
  }

  /* One place sells the subscription: Stillingar og áskrift. The step says
     what it is and links there, rather than being a second checkout. */
  return (
    <div className="space-y-3 text-sm text-hc-ink-2">
      <p>
        Appið — æfingar, næring og dagleg eftirfylgd — er sjálfstæð mánaðarleg áskrift. Verðið,
        það sem fylgir og hvernig þú segir upp sérðu áður en þú byrjar.
      </p>
      <ButtonLink href="/app/adgangur#askrift">Sjá áskriftina</ButtonLink>
    </div>
  );
}

function StepBody({ step, data, reload, advance, healthOrder }: { step: JourneyStep; data: JourneyData; reload: () => Promise<void>; advance: () => Promise<void>; healthOrder: HcOrder | null }) {
  const loc = data.location;
  const j = data.journey;
  const portal = loc?.patient_portal_url || "https://app.medalia.is";
  switch (step.key) {
    case "account":
      return <p className="text-sm text-hc-ink-2">Aðgangurinn þinn er á <strong>{data.profile.email}</strong>. Hér heldur þú utan um alla heilsuferðina.</p>;
    case "profile":
      /*
       * The details, then the rest of the setup.
       *
       * The coach, the calendar, the ábyrgðarfélagi and the daily reminder
       * were all built and all four sat in Stillingar — a page you reach by
       * finishing onboarding and then going looking for it. So we asked a
       * new participant for a kennitala and left the parts that decide
       * whether they come back to be found later, or never. They are
       * offered here, at the first step they actually do.
       */
      /* Only the details this route needs: a name on the coaching track,
         the kennitala and the rest for the health check, with the explicit
         Art. 9 consent box either way. The optional setup (reminder,
         calendar, partner, coach) comes afterwards, one card at a time. */
      return (
        <ProfileForm data={data} reload={reload} api={api}
          track={j.entry === "coach" || j.entry === "app" ? "app" : "care"} />
      );
    case "welcome":
      return <WelcomeStep data={data} />;
    case "package":
      /*
       * One payment, not the only payment.
       *
       * Two things are sold here and they are charged differently: the
       * health check is a single fee (hc_packages kind 'health_check' →
       * hc_orders), and the app is a subscription (the `subscriptions`
       * table, tiers free-trial / premium / self-maintained). Only the
       * first appears on this page, and nothing said the second existed —
       * so this step read as "pay Lifeline", which is half the story and
       * the half that makes the other half a surprise later.
       *
       * The step still sells the check, because that is what this journey
       * is. It now says plainly that the app is separate and recurring.
       */
      return (
        <div className="space-y-3">
          {j.paid_at
            ? <PaidSummary order={healthOrder} />
            : <Checkout packages={data.packages.filter((p) => p.kind === "health_check")} profileComplete={data.profile.complete} reload={reload} />}
          <p className="rounded-hc-element bg-hc-sunken px-3 py-2.5 text-xs text-hc-ink-2">
            Heilsufarsskoðunin er staðgreidd, eitt gjald. Appið — æfingar, næring og dagleg
            eftirfylgd — er sjálfstæð mánaðarleg áskrift og er ekki innifalin í þessu verði.{" "}
            <Link href="/app/adgangur#askrift" className="font-semibold underline">Sjá áskriftina</Link>.
          </p>
        </div>
      );
    case "tests":
      return (
        <div className="space-y-4 text-sm text-hc-ink-2">
          {!healthOrder ? <p>Virkjunarkóðinn birtist hér eftir greiðslu.</p> : (
            <>
              <p>
                Heilsufarsskoðunin fer fram í sjúklingagáttinni (Medalia), þar sem heilbrigðisgögnin þín eru
                varðveitt. Þrennt þarf að gerast og þú ræður röðinni á tvennu af því.
              </p>

              <TestTask n={1} title="Virkjaðu í sjúklingagáttinni" done={!!j.protocol_activated_at}>
                {healthOrder.activation_code ? <CodeBox code={healthOrder.activation_code} /> : healthOrder.status === "paid" && <p className="rounded-xl bg-hc-info-surface px-3 py-2 text-sm text-hc-info-ink">Virkjunarkóðinn er á leiðinni. Hann berst þér í tölvupósti innan eins virks dags og birtist hér.</p>}
                <p className="mt-1">
                  Skráðu þig inn með rafrænum skilríkjum, sláðu inn kóðann og svaraðu
                  spurningalistanum. Hann er í gáttinni, ekki hér.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={portal} target="_blank" rel="noreferrer"
                    className="inline-flex min-h-11 items-center rounded-full border border-hc-control bg-hc-surface px-4 font-semibold text-hc-ink-2 hover:bg-hc-sunken">
                    Opna sjúklingagátt
                  </a>
                  {!j.protocol_activated_at && <CompleteButton label="Ég hef virkjað" action="confirm_activated" onDone={advance} />}
                </div>
              </TestTask>

              <TestTask n={2} title="Bókaðu mælingar" done={!!j.measurements_done_at}>
                <TestStep kind="measurements" title={loc?.measurement_site || "Mælingar"} address={loc?.measurement_address}
                  info={loc?.measurement_info} bookedFor={j.measurements_booked_for}
                  done={!!j.measurements_done_at} portal={portal} reload={reload} />
              </TestTask>

              <TestTask n={3} title="Farðu í blóðprufu" done={!!(j.blood_test_done_at ?? j.blood_results_at)}>
                <p className="mb-2">
                  Blóðprufuna þarf ekki að bóka — mættu hvenær sem er á opnunartíma.
                  Eina skilyrðið er að þú sért <strong>fastandi</strong>: ekkert nema vatn í 10–12 klukkustundir á undan.
                </p>
                <TestStep kind="blood" title={loc?.blood_test_site || "Heilsugæslan"} address={loc?.blood_test_address}
                  info={loc?.blood_test_info} bookedFor={j.blood_test_booked_for}
                  done={!!(j.blood_test_done_at ?? j.blood_results_at)} portal={portal} reload={reload} />
              </TestTask>

              <p className="rounded-xl bg-hc-sunken px-3 py-2 text-xs text-hc-ink-2">
                Viðtalið er bókað þegar bæði mælingar og blóðprufa eru búnar — og í fyrsta lagi
                tveimur dögum síðar, svo niðurstöðurnar séu komnar þegar þið setjist niður.
              </p>
            </>
          )}
        </div>
      );
    case "upload":
      /*
       * The participant's own errand: fetch the PDF from the
       * sjúklingagátt and put it here. Said in that order, with the portal
       * link first, because the file has to exist before it can be
       * uploaded.
       *
       * Somebody whose report is already on file — a nurse imported it, or
       * it was generated here — is told so and asked for nothing.
       */
      return (
        <div className="space-y-3 text-sm text-hc-ink-2">
          {j.own_report_at || j.report_imported_at || j.report_generated_at ? (
            <p>
              {j.own_report_at
                ? "Skýrslan er komin inn. Þú getur sett nýrri skýrslu inn hvenær sem er."
                : "Skýrslan þín er þegar komin til okkar — þú þarft ekki að gera neitt hér."}
            </p>
          ) : (
            <>
              <p>
                Heilsufarsskoðunin sjálf fer fram í sjúklingagáttinni. Þegar niðurstöðurnar eru
                komnar sækir þú Grunnheilsa-skýrsluna (PDF-skjal) þangað og setur hana hér inn.
              </p>
              {/* The location's own portal where it has one, which is what
                  the rest of this page already uses. */}
              <a href={portal} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-full border border-hc-control bg-hc-surface px-4 font-semibold text-hc-ink-2 hover:bg-hc-sunken">
                Opna sjúklingagátt
              </a>
            </>
          )}
          <ReportUpload api={api} onDone={() => void reload()}
            heading="Hlaða upp skýrslu"
            blurb="PDF úr sjúklingagáttinni. Við lesum hana á okkar vél og geymum ekki skjalið sjálft." />
        </div>
      );
    case "report":
      return (
        <div className="space-y-3 text-sm text-hc-ink-2">
          <p>
            {j.report_generated_at
              ? "Skýrslan þín hefur verið staðfest af lækni. Hún er aðgengileg í sjúklingagáttinni og þú ferð yfir hana með hjúkrunarfræðingi í viðtalinu."
              : j.own_report_at
                ? "Skýrslan þín er komin inn. Þú getur skoðað niðurstöðurnar og búið til áætlunina sjálf(ur), eða gert hana með hjúkrunarfræðingi í viðtalinu."
                : "Skýrslan verður til þegar niðurstöður blóðprufu og mælinga liggja fyrir. Þegar hún er komin í sjúklingagáttina getur þú sett hana inn hér."}
          </p>
          {(j.report_generated_at || j.own_report_at)
            ? (
              <div className="flex flex-wrap gap-2">
                <Link href="/app/aaetlun?tab=report" className="inline-flex min-h-11 items-center rounded-full border border-hc-control bg-hc-surface px-4 font-semibold text-hc-ink-2 hover:bg-hc-sunken">Skoða niðurstöðurnar</Link>
                {!data.plan && <Link href="/app/aaetlun?breyta=1" className={hcBtn.cta}>Búa til áætlun sjálf(ur)</Link>}
              </div>
            )
            : <ReportUpload api={api} onDone={() => void reload()} />}
        </div>
      );
    case "interview":
      return (
        <div className="space-y-2 text-sm text-hc-ink-2">
          <p>Í viðtalinu farið þið yfir svefn, hreyfingu, næringu og andlega líðan, mælingar og blóðprufur, og gerið saman áætlun til þriggja mánaða.</p>
          {j.interview_booked_for
            ? (
              <div className="rounded-xl bg-hc-ok-surface px-3 py-2 text-hc-ok-ink">
                <p>Bókað: <strong>{fmtDateTime(j.interview_booked_for)}</strong>{j.interview_mode === "video" ? " · myndsímtal" : loc?.interview_site ? ` · ${loc.interview_site}` : ""}</p>
                {j.meeting_url && (
                  <a href={j.meeting_url} target="_blank" rel="noreferrer"
                    className={`${hcBtn.cta} mt-1.5`}>
                    Fara í fjarfundinn
                  </a>
                )}
              </div>
            )
            : <InterviewBooking j={j} portal={portal} />}
        </div>
      );
    case "plan":
      return data.plan
        ? (
          <div className="space-y-3 text-sm">
            <p className="text-hc-ink-2"><strong>{data.plan.headline || "Aðgerðaáætlunin þín"}</strong>{data.plan.review_date ? ` · endurmat ${fmtDate(data.plan.review_date)}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/app/aaetlun" className={hcBtn.cta}>Opna áætlunina</Link>
              <Link href="/app/aaetlun?breyta=1" className="inline-flex min-h-11 items-center rounded-full border border-hc-control bg-hc-surface px-5 font-semibold text-hc-ink-2 hover:bg-hc-sunken">Breyta áætluninni</Link>
            </div>
          </div>
        )
        : (
          j.entry === "coach" || j.entry === "app" ? (
            /* The coaching track has no interview: the plan is theirs to put
               together, so this step is a button, not a wait. */
            <div className="space-y-3 text-sm text-hc-ink-2">
              <p>Veldu venjur og æfingar úr safninu. Þú getur breytt áætluninni hvenær sem er.</p>
              <Link href="/app/aaetlun?breyta=1" className={hcBtn.cta}>Settu saman áætlunina þína</Link>
            </div>
          ) : (
          <div className="space-y-3 text-sm text-hc-ink-2">
            <p>Hjúkrunarfræðingurinn gengur frá áætluninni eftir viðtalið. Hún birtist hér og þú færð tölvupóst.</p>
            {(j.report_generated_at || j.own_report_at) && (
              <Link href="/app/aaetlun?breyta=1" className={hcBtn.cta}>Búa til áætlun sjálf(ur)</Link>
            )}
          </div>
          )
        );
    case "subscription":
      /*
       * The app, bought here. Paywall renders the offer, the code box and
       * the terms, and it is the same component the app tabs show when a
       * trial has run out — one place where the price and what it includes
       * are written down.
       */
      return <SubscriptionStep api={api} />;
    case "followup":
      return <FollowupStep data={data} kind="followup_3m" reload={reload} />;
    case "reevaluation":
      return <FollowupStep data={data} kind="reevaluation" reload={reload} />;
    default:
      return null;
  }
}

/** Completes a step the customer can vouch for, then opens the next step. */
function CompleteButton({ label, action, onDone }: { label: string; action: string; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toast = useToast();
  return (
    <>
      <button type="button" disabled={busy}
        onClick={async () => {
          setBusy(true); setErr("");
          const r = await api("/api/hc/journey", { method: "POST", body: JSON.stringify({ action }) }).catch(() => null);
          const j = r ? await r.json().catch(() => ({})) : {};
          setBusy(false);
          if (!r || !r.ok) { setErr(humanError(j.error, SAVE_FAILED)); return; }
          toast.show("Skráð", { tone: "ok" });
          await onDone();
        }}
        className={hcBtn.cta}>
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {busy ? "Augnablik…" : label}
      </button>
      {err && <p role="alert" className="w-full text-sm text-hc-bad-ink">{err}</p>}
    </>
  );
}

function CodeBox({ code }: { code: string }) {
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

// ── Profile ────────────────────────────────────────────────────────────────



/** For people whose profile was done before consent was part of it. */
function ConsentCard({ reload }: { reload: () => Promise<unknown> }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toast = useToast();
  return (
    <section className="mb-4 rounded-3xl bg-hc-surface p-5 shadow-sm ring-1 ring-hc-warn-ink/30">
      <p className="font-bold text-hc-ink">Eitt atriði vantar: samþykki</p>
      <p className="mt-1 text-sm text-hc-ink-2">Áður en við förum lengra þurfum við upplýst samþykki þitt fyrir vinnslu heilsufarsupplýsinga.</p>
      <div className="mt-3"><ConsentBox checked={checked} onChange={setChecked} error={err || undefined} /></div>
      <button type="button" disabled={!checked || busy}
        onClick={async () => {
          setBusy(true); setErr("");
          const r = await api("/api/hc/profile", { method: "PUT", body: JSON.stringify({ accept_health_consent: true }) }).catch(() => null);
          setBusy(false);
          if (!r || !r.ok) { setErr("Tókst ekki að vista. Reyndu aftur."); return; }
          toast.show("Samþykkið er skráð", { tone: "ok" });
          await reload();
        }}
        className={`${hcBtn.cta} mt-3`}>
        {busy ? "Vistar…" : "Staðfesta samþykki"}
      </button>
    </section>
  );
}


// ── Welcome ────────────────────────────────────────────────────────────────

function WelcomeStep({ data }: { data: JourneyData }) {
  const welcome = data.lectures.find((l) => l.is_welcome);
  return (
    <div className="space-y-3 text-sm text-hc-ink-2">
      <p>Stutt kynning á því sem framundan er og fjórum stoðum heilsu: svefni, hreyfingu, næringu og andlegri líðan.</p>
      {welcome
        ? <Link href={`/app/fraedsla/${welcome.slug}`} className={hcBtn.cta}>
            {welcome.completed_at ? "Horfa aftur" : "Horfa á kynninguna"}{welcome.duration_min ? ` · ${welcome.duration_min} mín.` : ""}
          </Link>
        : <p>Kynningin er væntanleg.</p>}
    </div>
  );
}

// ── Checkout ───────────────────────────────────────────────────────────────

interface CheckoutInfo {
  package: HcPackage;
  unions: { id: string; name: string; settlement: "reimbursement" | "direct"; rules_summary: string | null; rules: UnionRules; reimbursement_isk: number; explanation: string; can_email: boolean }[];
  eligibility_error: string | null;
  profile_complete: boolean;
  company_code: { ok: true; company_name: string | null; package_key: string; contribution_percent: number; contribution_isk: number | null } | { ok: false; error: string } | null;
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

function Checkout({ packages, profileComplete, reload }: { packages: HcPackage[]; profileComplete: boolean; reload: () => Promise<void> }) {
  const [pkgKey, setPkgKey] = useState(packages[0]?.key ?? "");
  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [useCompany, setUseCompany] = useState(false);
  const [useUnion, setUseUnion] = useState(false);
  const [unionId, setUnionId] = useState("");
  const [code, setCode] = useState("");
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
    priceIsk: info?.package.price_isk ?? 0,
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
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r || !r.ok) { setErr(humanError(j.error, "Greiðsla tókst ekki. Reyndu aftur.")); return; }
    toast.show("Gengið frá kaupum", { tone: "ok" });
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
  const canPay = terms && waiver && !busy && !info.eligibility_error &&
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

      <div className="space-y-2">
        <p className="text-sm font-semibold text-hc-ink-2">Tekur einhver þátt í kostnaðinum?</p>
        <p className="text-xs text-hc-ink-3">Veldu annað, bæði eða hvorugt. Án þátttöku greiðir þú sjálf(ur) með korti.</p>
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
          hint={info.unions.length ? "Við reiknum endurgreiðsluna eftir reglum félagsins, af því sem þú greiðir sjálf(ur)." : "Ekkert félag er komið í samstarf enn."}>
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
        {busy ? "Augnablik…" : q.chargedIsk > 0 ? `Greiða ${formatIsk(q.chargedIsk)}` : "Staðfesta"}
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

function PaidSummary({ order }: { order: HcOrder | null }) {
  if (!order) return <p className="text-sm text-hc-ink-2">Greitt.</p>;
  const how = order.payment_route === "company_union" ? "Vinnuveitandi og stéttarfélag taka þátt" : order.payment_route === "company" ? "Vinnuveitandi greiðir" : order.payment_route === "union" ? "Með þátttöku stéttarfélags" : "Greitt með korti";
  return (
    <div className="text-sm text-hc-ink-2">
      <p>{how} · {fmtDate(order.paid_at)}</p>
      {order.amount_charged_isk > 0 && <p>Greitt: {formatIsk(order.amount_charged_isk)}</p>}
      {order.union_reimbursement_isk > 0 && <p>Væntanleg endurgreiðsla frá félagi: {formatIsk(order.union_reimbursement_isk)} (sjá „Umsóknir til stéttarfélags“).</p>}
    </div>
  );
}

// ── Tests (blood / measurements) ───────────────────────────────────────────

function TestStep({ kind, title, address, info, bookedFor, done, portal, reload }: {
  kind: "blood" | "measurements"; title: string; address?: string | null; info?: string | null;
  bookedFor: string | null; done: boolean; portal: string; reload: () => Promise<void>;
}) {
  const [at, setAt] = useState(bookedFor ? bookedFor.slice(0, 16) : "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const save = async () => {
    if (saving) return;
    setSaving(true);
    const r = await api("/api/hc/journey", { method: "POST", body: JSON.stringify({ action: "set_booking", kind, at: at ? new Date(at).toISOString() : null }) }).catch(() => null);
    setSaving(false);
    // Saved or not, it used to look the same.
    if (!r || !r.ok) { toast.show(SAVE_FAILED, { tone: "bad" }); return; }
    toast.show(at ? "Tíminn er vistaður" : "Tíminn var fjarlægður", { tone: "ok" });
    await reload();
  };
  return (
    <div className="space-y-3 text-sm text-hc-ink-2">
      <div className="rounded-xl bg-hc-sunken p-3">
        <p className="font-semibold text-hc-ink-2">{title}</p>
        {address && <p>{address}</p>}
        {info && <p className="mt-1 text-hc-ink-3">{info}</p>}
      </div>
      {done ? <p className="text-hc-ok-ink">Lokið. Niðurstöður berast lækni sjálfkrafa.</p> : (
        <>
          <a href={portal} target="_blank" rel="noreferrer" className={hcBtn.cta}>Bóka í sjúklingagátt</a>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-hc-ink-2">
              Bókaður tími (fer í dagatalið þitt)
              <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="mt-1 block rounded-lg border border-hc-control px-3 py-2 text-sm" />
            </label>
            <button type="button" onClick={save} disabled={saving} className="min-h-11 rounded-lg border border-hc-control px-3 text-sm font-semibold text-hc-ink-2 hover:bg-hc-sunken">{saving ? "Vistar…" : "Vista tíma"}</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Follow-up / re-evaluation ──────────────────────────────────────────────

function FollowupStep({ data, kind, reload }: { data: JourneyData; kind: "followup_3m" | "reevaluation"; reload: () => Promise<void> }) {
  const j = data.journey;
  const order = data.orders.find((o) => o.journey_id === j.id && (kind === "followup_3m" ? o.kind === "followup_3m" || o.kind === "extra_followup" : o.kind === "reevaluation"));
  // Re-evaluation opens two months before it is due; an extra interview any time.
  const [now] = useState(() => Date.now());
  const reevalOpen = !j.reevaluation_due_at || Date.parse(j.reevaluation_due_at) - now <= 60 * 86400_000;
  const pkgs = data.packages.filter((p) => (kind === "followup_3m" ? p.kind === "followup_3m" : (p.kind === "reevaluation" && reevalOpen) || p.kind === "extra_followup"));
  const [buying, setBuying] = useState<string | null>(null);

  if (kind === "followup_3m" && !j.interview_done_at) return <p className="text-sm text-hc-ink-2">Eftirfylgd opnast eftir fyrsta viðtalið. Hún er ráðlögð en valfrjáls.</p>;
  if (kind === "reevaluation" && !j.plan_published_at) return <p className="text-sm text-hc-ink-2">Eftir ár býðst endurmat, eða aukaviðtal við hjúkrunarfræðing hvenær sem er.</p>;

  if (order) {
    return (
      <div className="space-y-2 text-sm text-hc-ink-2">
        <p>Greitt. Virkjaðu eftirfylgdina í sjúklingagáttinni með kóðanum og bókaðu tíma:</p>
        {order.activation_code ? <CodeBox code={order.activation_code} /> : order.status === "paid" && <p className="rounded-xl bg-hc-info-surface px-3 py-2 text-sm text-hc-info-ink">Virkjunarkóðinn er á leiðinni. Hann berst þér í tölvupósti innan eins virks dags og birtist hér.</p>}
        {j.followup_booked_for && <p className="rounded-xl bg-hc-ok-surface px-3 py-2 text-hc-ok-ink">Bókað: <strong>{fmtDateTime(j.followup_booked_for)}</strong></p>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {kind === "reevaluation" && j.reevaluation_due_at && (
        <p className="text-sm text-hc-ink-2">
          Endurmat er ráðlagt frá {fmtDate(j.reevaluation_due_at)}.{!reevalOpen && " Það opnast tveimur mánuðum fyrr; þangað til getur þú bókað aukaviðtal."}
        </p>
      )}
      {pkgs.map((p) =>
        buying === p.key ? (
          <div key={p.key} className="rounded-2xl border border-hc-hairline p-4">
            <Checkout packages={[p]} profileComplete={data.profile.complete} reload={async () => { setBuying(null); await reload(); }} />
            <button type="button" onClick={() => setBuying(null)} className="mt-2 min-h-11 text-sm font-semibold text-hc-ink-2">Hætta við</button>
          </div>
        ) : (
          <div key={p.key} className="flex flex-wrap items-center gap-3 rounded-2xl border border-hc-hairline p-4">
            <div className="flex-1">
              <p className="font-semibold text-hc-ink-2">{p.name}</p>
              <p className="text-sm text-hc-ink-3">{p.description}</p>
            </div>
            <span className="font-semibold text-hc-brand-text">{formatIsk(p.price_isk)}</span>
            <button type="button" onClick={() => setBuying(p.key)} className={hcBtn.cta}>Velja</button>
          </div>
        ),
      )}
    </div>
  );
}

// ── Side cards ─────────────────────────────────────────────────────────────

/** Earlier health checks: their plans stay readable after a re-evaluation. */
function HistoryCard({ history }: { history: NonNullable<JourneyData["history"]> }) {
  const withPlan = history.filter((h) => h.plan_published_at);
  if (!withPlan.length) return null;
  return (
    <div className="rounded-2xl border border-hc-hairline bg-hc-surface p-5 shadow-sm">
      <p className="font-bold text-hc-ink">Fyrri heilsuferðir</p>
      <ul className="mt-2 space-y-1.5">
        {withPlan.map((h) => (
          <li key={h.id}>
            <Link href={`/app/aaetlun?journey=${h.id}&tab=today`} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm ring-1 ring-hc-hairline hover:bg-hc-sunken">
              <span className="text-hc-ink-2">Áætlun frá {fmtDate(h.plan_published_at)}</span>
              <span className="text-hc-ok-ink">Opna →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}


function ClaimsCard({ claims, reload }: { claims: JourneyData["claims"]; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState<string | null>(null);
  const dialog = useDialog();
  const toast = useToast();
  if (!claims.length) return null;

  const download = async (orderId: string) => {
    if (fetching) return;
    setFetching(orderId);
    const r = await api(`/api/hc/claims/${orderId}`).catch(() => null);
    const blob = r?.ok ? await r.blob().catch(() => null) : null;
    setFetching(null);
    if (!blob) { toast.show("Ekki tókst að sækja skjalið – reyndu aftur", { tone: "bad" }); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "umsokn-endurgreidsla.pdf";
    document.body.appendChild(a); a.click(); a.remove();
    // Revoked a moment later: Safari starts the download after click returns.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const send = async (orderId: string, resend = false) => {
    const ok = await dialog.confirm({
      title: resend ? "Senda umsóknina aftur?" : "Senda umsóknina á stéttarfélagið?",
      body: "Þú færð afrit í tölvupósti.",
      confirmLabel: resend ? "Senda aftur" : "Senda",
    });
    if (!ok) return;
    setBusy(orderId);
    const r = await api(`/api/hc/claims/${orderId}`, { method: "POST", body: JSON.stringify({ action: "send", resend }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(null);
    const text = r?.ok
      ? `Sent á ${j.sent_to}`
      : j.error === "already_sent" ? "Umsóknin hefur þegar verið send." : humanError(j.error, "Sending mistókst. Reyndu aftur.");
    setMsg((m) => ({ ...m, [orderId]: text }));
    toast.show(text, { tone: r?.ok ? "ok" : "bad" });
    if (r?.ok) await reload();
  };

  return (
    <div className="rounded-2xl border border-hc-hairline bg-hc-surface p-5 shadow-sm">
      <p className="font-semibold text-hc-ink">Umsóknir til stéttarfélags</p>
      <div className="mt-3 space-y-3">
        {claims.map((c) => (
          <div key={c.id} className="rounded-xl bg-hc-sunken p-3 text-sm">
            <p className="font-medium text-hc-ink-2">{c.union_name}</p>
            <p className="text-hc-ink-3">Endurgreiðsla: {formatIsk(c.reimbursable_isk)}</p>
            <p className="text-xs text-hc-ink-3">{c.sent_at ? `Send ${fmtDate(c.sent_at)} á ${c.sent_to}` : "Ekki send"}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => download(c.order_id)} disabled={fetching === c.order_id} className="min-h-11 rounded-lg border border-hc-control bg-hc-surface px-3 text-xs font-semibold disabled:opacity-50">{fetching === c.order_id ? "Sæki…" : "Sækja PDF"}</button>
              <button type="button" onClick={() => send(c.order_id, !!c.sent_at)} disabled={busy === c.order_id}
                className={`min-h-11 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 ${c.sent_at ? "border border-hc-control bg-hc-surface text-hc-ink-2" : "bg-hc-brand-dark text-white"}`}>
                {busy === c.order_id ? "Sendir…" : c.sent_at ? "Senda aftur" : "Senda á félagið"}
              </button>
            </div>
            {msg[c.order_id] && <p className="mt-1 text-xs text-hc-ink-2">{msg[c.order_id]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}


