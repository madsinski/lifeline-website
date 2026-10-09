"use client";

// Heilsuferðin — the customer's self-service health-check journey. One flow
// for B2C and B2B; only the way in and the way of paying differ. Every step
// is either the customer's own action here, or advances by itself (patient
// portal, workstation). Backed by /api/hc/*.

import * as cache from "@/lib/hc/client-cache";
import { hcCard, hcKicker, hcPage } from "@/app/components/hc/ui";
import BackLink from "@/app/components/hc/BackLink";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LifelineLogo from "@/app/components/LifelineLogo";
import SettingsCard from "@/app/components/hc/SettingsCard";
import { INTERVIEW_WAIT_DAYS, interviewEligibleFrom, type JourneyStep, type StepKey } from "@/lib/hc/stages";
import AppointmentCard from "@/app/components/hc/AppointmentCard";
import ReportUpload from "@/app/components/hc/ReportUpload";
import ReportApproval from "@/app/components/hc/ReportApproval";
import RetentionReview from "@/app/components/hc/RetentionReview";
import JourneyNav from "@/app/components/hc/JourneyNav";
import { upcomingAppointments } from "@/lib/hc/upcoming";
import { formatIsk, type HcJourney, type HcLocation, type HcOrder, type HcPackage } from "@/lib/hc/types";
import { quote, type UnionRules } from "@/lib/hc/reimbursement";
import { renderHealthAssessmentConsent } from "@/lib/platform-terms-content";

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
  const headers = { ...(await authHeaders()), ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers as Record<string, string> | undefined) };
  return fetch(url, { ...init, headers });
}

// Written out by hand: a browser without Icelandic locale data falls back to
// English ("Fri, October 2 at 09:08 PM").
const MO_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const WD_IS = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];
const fmtDateTime = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${WD_IS[d.getDay()]} ${d.getDate()}. ${MO_IS[d.getMonth()]} kl. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const fmtDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getDate()}. ${MO_IS[d.getMonth()]} ${d.getFullYear()}`;
};

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
  const [data, setData] = useState<JourneyData | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<StepKey | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [noJourney, setNoJourney] = useState(false);

  const load = useCallback(async (fresh = false): Promise<JourneyData | null> => {
    const url = `/api/hc/journey${stadur ? `?stadur=${encodeURIComponent(stadur)}` : startParam ? "?start=1" : ""}`;
    const show = (j: JourneyData) => {
      if (!j.journey) { setNoJourney(true); return false; }
      setNoJourney(false);
      if (j.plan && !showJourney) { router.replace("/account/heilsuferd/aaetlun"); return false; }
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

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { setAuthed(false); return; }
      if (!s.session.user.email_confirmed_at) { router.replace("/account/login?verify=1"); return; }
      setAuthed(true);
      await load();
    })();
  }, [load, router]);

  if (authed === false) return <FirstStep stadur={stadur} />;
  if (noJourney) return <StartJourney />;

  if (!data) {
    return (
      <Shell>
        <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">{error || "Hleð heilsuferðinni…"}</div>
      </Shell>
    );
  }

  const done = data.steps.filter((s) => s.state === "done" && !s.optional).length;
  const required = data.steps.filter((s) => !s.optional).length;
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
  const ours = !!current && (
    current.key === "report"
    || current.key === "plan"
    || (current.key === "interview" && !jj.interview_booked_for)
    || (current.key === "tests" && !!jj.protocol_activated_at && !!(jj.blood_test_done_at || jj.blood_results_at) && !!jj.measurements_done_at)
  );
  const healthOrder = data.orders.find((o) => o.journey_id === data.journey.id && (o.kind === "health_check" || o.kind === "reevaluation"));

  return (
    <Shell>
      {/* sm:mb-4 — on a phone JourneyNav draws nothing here (its bar is
          fixed to the bottom), so the margin was 16px of nothing. */}
      {data.plan && <div className="sm:mb-4"><JourneyNav active="journey" /></div>}
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
              <Link href="/account/heilsuferd/aaetlun?tab=today" className="inline-flex min-h-11 items-center rounded-hc-element bg-white px-5 font-bold text-hc-hero-to hover:bg-emerald-50">Opna daginn í dag →</Link>
              <Link href="/account/heilsuferd/aaetlun?breyta=1" className="inline-flex min-h-11 items-center rounded-hc-element bg-white/15 px-4 font-semibold text-white ring-1 ring-white/30 hover:bg-white/25">Breyta áætluninni</Link>
            </>
          ) : current && !ours ? (
            <button type="button" onClick={() => { setOpen(current.key); setTimeout(() => document.getElementById(`step-${current.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
              className="inline-flex min-h-11 items-center rounded-hc-element bg-white px-5 font-bold text-hc-hero-to hover:bg-emerald-50">Halda áfram: {current.title} →</button>
          ) : null}
          {data.profile.company_name && <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Í boði {data.profile.company_name}</span>}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* The journey as a timeline in four phases. The open step unfolds in
            place, so reading about a step and doing it happen in one spot. */}
        <div className="space-y-5">
          {PHASES.map((ph) => {
            const steps = ph.keys.map((k) => data.steps.find((x) => x.key === k)).filter((x): x is JourneyStep => !!x);
            if (!steps.length) return null;
            const required = steps.filter((x) => !x.optional);
            const phaseDone = required.length > 0 && required.every((x) => x.state === "done");
            const folded = phaseDone && !steps.some((x) => x.key === shownStep?.key) && !expanded.has(ph.title);
            if (folded) {
              return (
                <button key={ph.title} type="button" onClick={() => setExpanded((e) => new Set(e).add(ph.title))}
                  className={`${hcCard.base} flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50`}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hc-brand text-white"><CheckIcon /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-hc-ink">{ph.title}</span>
                    <span className="block text-xs text-hc-ink-2">{steps.length} {steps.length === 1 ? "skrefi lokið" : "skrefum lokið"}</span>
                  </span>
                  <span className="text-xs font-semibold text-hc-brand-dark">Sýna</span>
                </button>
              );
            }
            return (
              <section key={ph.title} aria-label={ph.title}>
                <p className={`${hcKicker} mb-2 flex items-center gap-2 ${phaseDone ? "text-hc-brand-dark" : "text-slate-500"}`}>
                  {phaseDone && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-hc-brand text-white"><CheckIcon /></span>}
                  {ph.title}
                </p>
                <ol className={`${hcCard.base} divide-y divide-slate-100 overflow-hidden`}>
                  {steps.map((st) => {
                    const isOpen = shownStep?.key === st.key;
                    const waiting = ours && st.key === current?.key;
                    const n = data.steps.indexOf(st) + 1;
                    return (
                      <li key={st.key} id={`step-${st.key}`} className="scroll-mt-24">
                        <button type="button" onClick={() => setOpen(isOpen ? null : st.key)} aria-expanded={isOpen}
                          className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${isOpen ? "bg-hc-brand-surface/60" : "hover:bg-slate-50"}`}>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            st.state === "done" ? "bg-hc-brand text-white"
                              : waiting ? "bg-amber-100 text-amber-800"
                              : st.state === "current" ? "bg-hc-ink text-white ring-4 ring-slate-900/10"
                              : "bg-slate-100 text-slate-400"}`}>
                            {st.state === "done" ? <CheckIcon /> : waiting ? "…" : n}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block font-semibold ${st.state === "upcoming" || st.state === "optional" ? "text-slate-500" : "text-hc-ink"}`}>{st.title}</span>
                            <span className="block truncate text-xs text-hc-ink-2">
                              {st.state === "done" ? `Lokið${st.doneAt ? ` ${fmtDate(st.doneAt)}` : ""}`
                                : waiting ? (OURS_TEXT[st.key] ?? "Hjá okkur")
                                : st.state === "current" ? "Næsta skref"
                                : st.optional ? "Valfrjálst" : "Síðar"}
                            </span>
                          </span>
                          <svg className={`h-5 w-5 shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" /></svg>
                        </button>
                        {isOpen && (
                          <div className="border-t border-slate-100 bg-hc-surface px-4 pb-5 pt-3">
                            <p className="text-sm text-hc-ink-2">{st.blurb}</p>
                            <div className="mt-3">
                              <StepBody step={st} data={data} reload={async () => { await load(true); }} advance={advance} healthOrder={healthOrder ?? null} />
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>

        {/* Side */}
        <aside className="space-y-4">
          {healthOrder?.activation_code && (
            <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Virkjunarkóði</p>
              <CodeBox code={healthOrder.activation_code} />
              <p className="mt-2 text-xs text-slate-500">{healthOrder.activation_redeemed_at ? "Virkjaður í sjúklingagátt." : "Sláðu kóðann inn í sjúklingagáttina."}</p>
            </div>
          )}
          <LecturesCard lectures={data.lectures} />
          <HistoryCard history={data.history ?? []} />
          <Link href="/account/heilsuferd/adgangur" className="block rounded-2xl border border-slate-100 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Aðgangur og greiðslur →</Link>
          <ClaimsCard claims={data.claims} reload={async () => { await load(true); }} />
          <SettingsCard />
          <p className="px-1 text-xs text-slate-400">
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
  { title: "Heilsufarsskoðun", keys: ["tests", "report"] },
  { title: "Viðtal og áætlun", keys: ["interview", "plan"] },
  { title: "Eftirfylgd", keys: ["followup", "reevaluation"] },
];

const CheckIcon = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
);

/** Progress as a ring (done of required), for the hero. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 30, c = 2 * Math.PI * r, pct = total ? done / total : 0;
  return (
    <div className="relative h-20 w-20 shrink-0" aria-label={`${done} af ${total} skrefum lokið`}>
      <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke="#6EE7B7" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
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
          <BackLink href="/account/heilsuferd/adgangur" label="Aðgangurinn minn" />
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Step 1 when logged out ─────────────────────────────────────────────────

/** Signed in, no journey yet: starting one is a choice, not a side effect of looking. */
function StartJourney() {
  return (
    <Shell>
      <section className={`${hcCard.hero} p-6 sm:p-8`}>
        <p className={`${hcKicker} text-emerald-300`}>Heilsuferðin</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Heilsufarsskoðun og áætlun sem fylgir þér</h1>
        <p className="mt-2 max-w-2xl text-emerald-100">
          Mælingar og blóðprufa, skýrsla sem læknir fer yfir, viðtal við hjúkrunarfræðing og aðgerðaáætlun til þriggja mánaða
          um svefn, hreyfingu, næringu og andlega líðan.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/account/heilsuferd?start=1" className="inline-flex min-h-11 items-center rounded-hc-element bg-white px-5 font-bold text-hc-hero-to hover:bg-emerald-50">Hefja heilsuferð →</Link>
          <Link href="/account/heilsuferd/adgangur" className="inline-flex min-h-11 items-center rounded-hc-element bg-white/15 px-4 font-semibold text-white ring-1 ring-white/30 hover:bg-white/25">Aðgangurinn minn</Link>
        </div>
      </section>
    </Shell>
  );
}

function FirstStep({ stadur }: { stadur: string }) {
  const next = `/account/heilsuferd${stadur ? `?stadur=${encodeURIComponent(stadur)}` : ""}`;
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-[#f0fdf4] to-[#dcfce7] px-4 py-16">
      <div className="w-full max-w-md text-center">
        <LifelineLogo size="lg" />
        <h1 className="mt-6 text-2xl font-bold text-[#0F172A]">Taktu fyrsta skrefið</h1>
        <p className="mt-2 text-slate-600">Stofnaðu frían aðgang og sjáðu valmöguleikana þína þaðan.</p>
        <div className="mt-6 space-y-3">
          <Link href={`/account/login?mode=signup&next=${encodeURIComponent(next)}`}
            className="block rounded-full bg-[#10B981] px-6 py-3 font-semibold text-white shadow-lg shadow-green-500/25 hover:bg-[#047857]">
            Stofna frían aðgang
          </Link>
          <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="block text-sm font-medium text-slate-600 hover:text-slate-900">
            Ég á nú þegar aðgang
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
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">
        Viðtalið bókast þegar {missing.join(" og ")} {missing.length > 1 ? "eru" : "er"} búin.
        Eftir það líða {INTERVIEW_WAIT_DAYS} dagar á meðan niðurstöðurnar koma.
      </p>
    );
  }
  if (!ready && from) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600">
        Niðurstöðurnar eru á leiðinni. Þú getur bókað viðtalið frá <strong>{fmtDate(from.toISOString())}</strong>.
      </p>
    );
  }
  return (
    <a href={portal} target="_blank" rel="noreferrer"
      className="inline-block rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white">
      Bóka viðtal í sjúklingagátt
    </a>
  );
}

/** One of the three things inside the tests step, ticked when it is done. */
function TestTask({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 ${done ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-emerald-500 text-white" : "bg-slate-900 text-white"}`}>
          {done ? "✓" : n}
        </span>
        {title}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function StepBody({ step, data, reload, advance, healthOrder }: { step: JourneyStep; data: JourneyData; reload: () => Promise<void>; advance: () => Promise<void>; healthOrder: HcOrder | null }) {
  const loc = data.location;
  const j = data.journey;
  const portal = loc?.patient_portal_url || "https://app.medalia.is";
  switch (step.key) {
    case "account":
      return <p className="text-sm text-slate-600">Aðgangurinn þinn er á <strong>{data.profile.email}</strong>. Hér heldur þú utan um alla heilsuferðina.</p>;
    case "profile":
      return <ProfileForm data={data} reload={reload} />;
    case "welcome":
      return <WelcomeStep data={data} />;
    case "package":
      return j.paid_at
        ? <PaidSummary order={healthOrder} />
        : <Checkout packages={data.packages.filter((p) => p.kind === "health_check")} profileComplete={data.profile.complete} reload={reload} />;
    case "tests":
      return (
        <div className="space-y-4 text-sm text-slate-700">
          {!healthOrder ? <p>Virkjunarkóðinn birtist hér eftir greiðslu.</p> : (
            <>
              <p>
                Heilsufarsskoðunin fer fram í sjúklingagáttinni, þar sem heilbrigðisgögnin þín eru
                varðveitt. Þrennt þarf að gerast og þú ræður röðinni á tvennu af því.
              </p>

              <TestTask n={1} title="Virkjaðu í sjúklingagáttinni" done={!!j.protocol_activated_at}>
                {healthOrder.activation_code && <CodeBox code={healthOrder.activation_code} />}
                <p className="mt-1">
                  Skráðu þig inn með rafrænum skilríkjum, sláðu inn kóðann og svaraðu
                  spurningalistanum. Hann er í gáttinni, ekki hér.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={portal} target="_blank" rel="noreferrer"
                    className="inline-flex min-h-10 items-center rounded-full border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50">
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

              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Viðtalið er bókað þegar bæði mælingar og blóðprufa eru búnar — og í fyrsta lagi
                tveimur dögum síðar, svo niðurstöðurnar séu komnar þegar þið setjist niður.
              </p>
            </>
          )}
        </div>
      );
    case "report":
      return (
        <div className="space-y-3 text-sm text-slate-600">
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
                <Link href="/account/heilsuferd/aaetlun?tab=report" className="inline-flex min-h-10 items-center rounded-full border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50">Skoða niðurstöðurnar</Link>
                {!data.plan && <Link href="/account/heilsuferd/aaetlun?breyta=1" className="inline-flex min-h-10 items-center rounded-full bg-hc-brand px-4 font-semibold text-white hover:bg-hc-brand-dark">Búa til áætlun sjálf(ur)</Link>}
              </div>
            )
            : <ReportUpload api={api} onDone={() => void reload()} />}
        </div>
      );
    case "interview":
      return (
        <div className="space-y-2 text-sm text-slate-600">
          <p>Í viðtalinu farið þið yfir svefn, hreyfingu, næringu og andlega líðan, mælingar og blóðprufur, og gerið saman áætlun til þriggja mánaða.</p>
          {j.interview_booked_for
            ? (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900">
                <p>Bókað: <strong>{fmtDateTime(j.interview_booked_for)}</strong>{j.interview_mode === "video" ? " · myndsímtal" : loc?.interview_site ? ` · ${loc.interview_site}` : ""}</p>
                {j.meeting_url && (
                  <a href={j.meeting_url} target="_blank" rel="noreferrer"
                    className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#10B981] px-3 text-sm font-semibold text-white hover:bg-[#047857]">
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
            <p className="text-slate-700"><strong>{data.plan.headline || "Aðgerðaáætlunin þín"}</strong>{data.plan.review_date ? ` · endurmat ${fmtDate(data.plan.review_date)}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/account/heilsuferd/aaetlun" className="inline-block rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white hover:bg-[#047857]">Opna áætlunina</Link>
              <Link href="/account/heilsuferd/aaetlun?breyta=1" className="inline-block rounded-full border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-800 hover:bg-slate-50">Breyta áætluninni</Link>
            </div>
          </div>
        )
        : (
          <div className="space-y-3 text-sm text-slate-600">
            <p>Hjúkrunarfræðingurinn gengur frá áætluninni eftir viðtalið. Hún birtist hér og þú færð tölvupóst.</p>
            {(j.report_generated_at || j.own_report_at) && (
              <Link href="/account/heilsuferd/aaetlun?breyta=1" className="inline-block rounded-full bg-hc-brand px-5 py-2.5 font-semibold text-white hover:bg-hc-brand-dark">Búa til áætlun sjálf(ur)</Link>
            )}
          </div>
        );
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
  return (
    <>
      <button type="button" disabled={busy}
        onClick={async () => {
          setBusy(true); setErr("");
          const r = await api("/api/hc/journey", { method: "POST", body: JSON.stringify({ action }) });
          const j = await r.json().catch(() => ({}));
          setBusy(false);
          if (!r.ok) { setErr(j.error || "Tókst ekki."); return; }
          await onDone();
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#10B981] px-5 font-semibold text-white hover:bg-[#047857] disabled:opacity-50">
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {busy ? "Augnablik…" : label}
      </button>
      {err && <p role="alert" className="w-full text-sm text-red-600">{err}</p>}
    </>
  );
}

function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="flex-1 rounded-xl bg-emerald-50 px-4 py-3 text-center font-mono text-xl font-bold tracking-[0.15em] text-emerald-900">{code}</span>
      <button
        onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="rounded-xl border border-slate-200 px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
      >
        {copied ? "Afritað" : "Afrita"}
      </button>
    </div>
  );
}

// ── Profile ────────────────────────────────────────────────────────────────

function splitAddress(a: string | null) {
  const m = /^(.*),\s*(\d{3})\s+(.+)$/.exec(a || "");
  return m ? { street: m[1], postcode: m[2], town: m[3] } : { street: a || "", postcode: "", town: "" };
}

/** GDPR 9. gr.: informed consent for processing health data, with the full text one tap away. */
function ConsentBox({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  return (
    <div className={`rounded-xl border p-3 text-sm ${error ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#10B981]" />
        <span className="text-slate-700">
          Ég hef lesið <strong>upplýst samþykki fyrir heilsumat</strong> og samþykki að Lifeline Health vinni með heilsufarsupplýsingar mínar vegna heilsufarsskoðunarinnar. Ég get dregið samþykkið til baka hvenær sem er.
        </span>
      </label>
      <details className="mt-2 pl-8">
        <summary className="cursor-pointer text-xs font-semibold text-emerald-700">Lesa samþykkið í heild</summary>
        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-600">{renderHealthAssessmentConsent()}</pre>
      </details>
      {error && <p className="mt-2 pl-8 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** For people whose profile was done before consent was part of it. */
function ConsentCard({ reload }: { reload: () => Promise<unknown> }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <section className="mb-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-amber-200">
      <p className="font-bold text-slate-900">Eitt atriði vantar: samþykki</p>
      <p className="mt-1 text-sm text-slate-600">Áður en við förum lengra þurfum við upplýst samþykki þitt fyrir vinnslu heilsufarsupplýsinga.</p>
      <div className="mt-3"><ConsentBox checked={checked} onChange={setChecked} error={err || undefined} /></div>
      <button type="button" disabled={!checked || busy}
        onClick={async () => {
          setBusy(true); setErr("");
          const r = await api("/api/hc/profile", { method: "PUT", body: JSON.stringify({ accept_health_consent: true }) });
          setBusy(false);
          if (!r.ok) { setErr("Tókst ekki að vista. Reyndu aftur."); return; }
          await reload();
        }}
        className="mt-3 rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white hover:bg-[#047857] disabled:opacity-50">
        {busy ? "Vistar…" : "Staðfesta samþykki"}
      </button>
    </section>
  );
}

function ProfileForm({ data, reload }: { data: JourneyData; reload: () => Promise<void> }) {
  const addr = splitAddress(data.profile.address);
  const [f, setF] = useState({
    full_name: data.profile.full_name || "",
    phone: data.profile.phone || "",
    address: addr.street,
    postcode: addr.postcode,
    town: addr.town,
    kennitala: "",
  });
  const [consent, setConsent] = useState(!!data.profile.health_consent);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErrors({}); setSaved(false);
    const r = await api("/api/hc/profile", { method: "POST", body: JSON.stringify({ ...f, accept_health_consent: consent }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErrors(j.errors || { form: j.error || "Vistun mistókst." }); return; }
    setSaved(true);
    await reload();
  };

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        aria-invalid={!!errors[k]}
        className={`mt-1 w-full rounded-lg border px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-[#10B981] ${errors[k] ? "border-red-300" : "border-slate-300"}`}
        {...props}
      />
      {errors[k] && <span className="mt-1 block text-xs text-red-600">{errors[k]}</span>}
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">Við þurfum þessar upplýsingar fyrir sjúklingagáttina og til að útbúa umsókn til stéttarfélagsins þíns ef við á.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("full_name", "Fullt nafn", { autoComplete: "name" })}
        {field("kennitala", data.profile.kennitala_last4 ? `Kennitala (skráð: ••••••-${data.profile.kennitala_last4})` : "Kennitala", { inputMode: "numeric", placeholder: data.profile.kennitala_last4 ? "Sláðu inn til að breyta" : "000000-0000" })}
        {field("phone", "Farsími", { autoComplete: "tel", inputMode: "tel" })}
        {field("address", "Heimilisfang", { autoComplete: "street-address" })}
        {field("postcode", "Póstnúmer", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 3 })}
        {field("town", "Bæjarfélag", { autoComplete: "address-level2" })}
      </div>
      {!data.profile.health_consent && <ConsentBox checked={consent} onChange={setConsent} error={errors.consent} />}
      {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
      <div className="flex items-center gap-3">
        <button disabled={busy} className="rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white hover:bg-[#047857] disabled:opacity-50">
          {busy ? "Vistar…" : "Vista upplýsingar"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Vistað</span>}
      </div>
      <p className="text-xs text-slate-500">Kennitalan er dulkóðuð og aðeins notuð fyrir heilbrigðisþjónustuna og umsóknir sem þú sendir sjálf(ur).</p>
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        Ábending: Í stillingum hér til hliðar getur þú sett upp <strong>PIN</strong> fyrir fljótlegri innskráningu og tengt ferðina við <strong>Google eða Apple dagatal</strong>.
      </div>
    </form>
  );
}

// ── Welcome ────────────────────────────────────────────────────────────────

function WelcomeStep({ data }: { data: JourneyData }) {
  const welcome = data.lectures.find((l) => l.is_welcome);
  return (
    <div className="space-y-3 text-sm text-slate-600">
      <p>Stutt kynning á því sem framundan er og fjórum stoðum heilsu: svefni, hreyfingu, næringu og andlegri líðan.</p>
      {welcome
        ? <Link href={`/account/heilsuferd/fraedsla/${welcome.slug}`} className="inline-block rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white hover:bg-[#047857]">
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
    <div className={`rounded-2xl border transition ${on ? "border-[#10B981] bg-emerald-50/40 ring-2 ring-[#10B981]/20" : "border-slate-200 bg-white"} ${disabled ? "opacity-50" : ""}`}>
      <button type="button" aria-pressed={on} disabled={disabled} onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left disabled:cursor-not-allowed">
        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-[#10B981] bg-[#10B981] text-white" : "border-slate-300 bg-white"}`}>
          {on && <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </span>
        <span><span className="block text-sm font-semibold text-slate-800">{title}</span><span className="block text-xs text-slate-500">{hint}</span></span>
      </button>
      {on && children && <div className="border-t border-slate-100 px-4 pb-4 pt-3">{children}</div>}
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!pkgKey) return;
    (async () => {
      const r = await api(`/api/hc/checkout?package=${encodeURIComponent(pkgKey)}`);
      if (r.ok) setInfo(await r.json());
    })();
  }, [pkgKey]);

  const union = info?.unions.find((u) => u.id === unionId) ?? null;
  const company = useCompany && codeState?.ok === true ? codeState : null;
  const q = useMemo(() => quote({
    priceIsk: info?.package.price_isk ?? 0,
    employer: company ? { percent: company.contribution_percent, fixed_isk: company.contribution_isk } : null,
    union: useUnion && union ? { settlement: union.settlement, rules: union.rules } : null,
    unionCategory: info?.package.union_category ?? "health_check",
  }), [info, company, useUnion, union]);

  const checkCode = async () => {
    setCodeState(null);
    const r = await api(`/api/hc/checkout?package=${encodeURIComponent(pkgKey)}&code=${encodeURIComponent(code)}`);
    if (r.ok) setCodeState((await r.json()).company_code);
  };

  const pay = async () => {
    setBusy(true); setErr("");
    const r = await api("/api/hc/checkout", {
      method: "POST",
      body: JSON.stringify({
        package_key: pkgKey,
        use_company: useCompany, company_code: useCompany ? code : undefined,
        use_union: useUnion, union_id: useUnion ? unionId : undefined,
        union_consent: consent, accept_terms: terms,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error || "Greiðsla tókst ekki."); return; }
    await reload();
  };

  if (!profileComplete) return <p className="text-sm text-slate-600">Kláraðu fyrst skrefið „Upplýsingar um þig“. Þær þarf til að ganga frá kaupum.</p>;
  if (!info) return <p className="text-sm text-slate-500">Hleð…</p>;

  const companyCovers = company ? (company.contribution_isk != null ? formatIsk(company.contribution_isk) : `${company.contribution_percent}%`) : "";
  const canPay = terms && !busy && !info.eligibility_error &&
    (!useCompany || codeState?.ok === true) &&
    (!useUnion || (!!union && (union.settlement !== "direct" || consent)));

  return (
    <div className="space-y-5">
      {packages.length > 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((p) => (
            <button key={p.key} type="button" aria-pressed={p.key === pkgKey} onClick={() => setPkgKey(p.key)} className={`rounded-2xl border p-4 text-left ${p.key === pkgKey ? "border-[#10B981] ring-2 ring-[#10B981]/30" : "border-slate-200"}`}>
              <p className="font-semibold">{p.name}</p><p className="text-sm text-slate-500">{formatIsk(p.price_isk)}</p>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-lg font-bold text-[#0F172A]">{info.package.name}</h3>
          <span className="text-lg font-bold text-[#047857]">{formatIsk(info.package.price_isk)}</span>
        </div>
        {info.package.tagline && <p className="text-sm font-medium text-slate-500">{info.package.tagline}</p>}
        {info.package.description && <p className="mt-2 text-sm leading-relaxed text-slate-600">{info.package.description}</p>}
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {info.package.includes.map((x) => (
            <li key={x} className="flex gap-2 text-sm text-slate-700"><span className="text-[#10B981]">✓</span>{x}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-800">Tekur einhver þátt í kostnaðinum?</p>
        <p className="text-xs text-slate-500">Veldu annað, bæði eða hvorugt. Án þátttöku greiðir þú sjálf(ur) með korti.</p>
        <ContributionToggle on={useCompany} onToggle={() => setUseCompany((v) => !v)}
          title="Vinnuveitandinn minn tekur þátt" hint="Þú slærð inn persónulegan kóða frá fyrirtækinu þínu.">
          <label className="block text-sm font-medium text-slate-700" htmlFor="company-code">Kóði frá vinnuveitanda</label>
          <div className="mt-1 flex gap-2">
            <input id="company-code" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeState(null); }} placeholder="FY-XXXX-XXXX" className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 font-mono uppercase tracking-wider" />
            <button type="button" onClick={checkCode} disabled={code.length < 8} className="rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white disabled:opacity-40">Staðfesta</button>
          </div>
          {codeState?.ok === true && <p className="mt-2 text-sm text-emerald-700">✓ {codeState.company_name ?? "Vinnuveitandi"} greiðir {codeState.contribution_isk != null ? formatIsk(codeState.contribution_isk) : codeState.contribution_percent >= 100 ? "allt" : `${codeState.contribution_percent}%`}.</p>}
          {codeState?.ok === false && <p className="mt-2 text-sm text-red-600">{codeState.error}</p>}
        </ContributionToggle>
        <ContributionToggle on={useUnion} onToggle={() => setUseUnion((v) => !v)} disabled={!info.unions.length}
          title="Stéttarfélagið mitt tekur þátt"
          hint={info.unions.length ? "Við reiknum endurgreiðsluna eftir reglum félagsins, af því sem þú greiðir sjálf(ur)." : "Ekkert félag er komið í samstarf enn."}>
          <label className="block text-sm font-medium text-slate-700" htmlFor="union-select">Stéttarfélag</label>
          <select id="union-select" value={unionId} onChange={(e) => setUnionId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            <option value="">Veldu félag…</option>
            {info.unions.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          {union && (
            <div className="mt-2 text-sm text-slate-600">
              {q.explanation && <p>{q.explanation}</p>}
              {union.rules_summary && <p className="text-xs text-slate-500">{union.rules_summary}</p>}
              {union.settlement === "direct" ? (
                <label className="mt-2 flex items-start gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                  Ég staðfesti aðild mína að {union.name} og heimila Lifeline Health að innheimta styrkinn beint hjá félaginu. Félagið fær nafn, kennitölu og lýsingu þjónustunnar, engar heilsufarsupplýsingar.
                </label>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Þú færð tilbúna umsókn (PDF) sem þú getur sent félaginu beint héðan með einum smelli.</p>
              )}
            </div>
          )}
        </ContributionToggle>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4 text-sm">
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
          <p className="mt-2 text-xs text-slate-500">Vinnuveitandinn greiðir allt, svo ekkert er eftir til að sækja um hjá félaginu.</p>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" />
        <span>Ég samþykki <a href="/soluskilmalar" target="_blank" className="underline">söluskilmála</a> Lifeline Health.</span>
      </label>
      {info.eligibility_error && <p className="text-sm text-amber-700">{info.eligibility_error}</p>}
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <button type="button" onClick={pay} disabled={!canPay} className="w-full rounded-full bg-[#10B981] px-6 py-3 font-semibold text-white shadow-lg shadow-green-500/20 hover:bg-[#047857] disabled:opacity-40">
        {busy ? "Augnablik…" : q.chargedIsk > 0 ? `Greiða ${formatIsk(q.chargedIsk)}` : "Staðfesta"}
      </button>
    </div>
  );
}

function Row({ label, value, strong, muted, accent }: { label: string; value: string; strong?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? "font-semibold text-slate-900" : muted ? "text-slate-500" : "text-slate-700"} ${accent ? "border-t border-slate-100 pt-2 text-[#047857]" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}

function PaidSummary({ order }: { order: HcOrder | null }) {
  if (!order) return <p className="text-sm text-slate-600">Greitt.</p>;
  const how = order.payment_route === "company_union" ? "Vinnuveitandi og stéttarfélag taka þátt" : order.payment_route === "company" ? "Vinnuveitandi greiðir" : order.payment_route === "union" ? "Með þátttöku stéttarfélags" : "Greitt með korti";
  return (
    <div className="text-sm text-slate-600">
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
  const save = async () => {
    setSaving(true);
    await api("/api/hc/journey", { method: "POST", body: JSON.stringify({ action: "set_booking", kind, at: at ? new Date(at).toISOString() : null }) });
    setSaving(false);
    await reload();
  };
  return (
    <div className="space-y-3 text-sm text-slate-600">
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="font-semibold text-slate-800">{title}</p>
        {address && <p>{address}</p>}
        {info && <p className="mt-1 text-slate-500">{info}</p>}
      </div>
      {done ? <p className="text-emerald-700">Lokið. Niðurstöður berast lækni sjálfkrafa.</p> : (
        <>
          <a href={portal} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-[#10B981] px-5 py-2.5 font-semibold text-white hover:bg-[#047857]">Bóka í sjúklingagátt</a>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-600">
              Bókaður tími (fer í dagatalið þitt)
              <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <button onClick={save} disabled={saving} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{saving ? "Vistar…" : "Vista tíma"}</button>
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

  if (kind === "followup_3m" && !j.interview_done_at) return <p className="text-sm text-slate-600">Eftirfylgd opnast eftir fyrsta viðtalið. Hún er ráðlögð en valfrjáls.</p>;
  if (kind === "reevaluation" && !j.plan_published_at) return <p className="text-sm text-slate-600">Eftir ár býðst endurmat, eða aukaviðtal við hjúkrunarfræðing hvenær sem er.</p>;

  if (order) {
    return (
      <div className="space-y-2 text-sm text-slate-600">
        <p>Greitt. Virkjaðu eftirfylgdina í sjúklingagáttinni með kóðanum og bókaðu tíma:</p>
        {order.activation_code && <CodeBox code={order.activation_code} />}
        {j.followup_booked_for && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-900">Bókað: <strong>{fmtDateTime(j.followup_booked_for)}</strong></p>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {kind === "reevaluation" && j.reevaluation_due_at && (
        <p className="text-sm text-slate-600">
          Endurmat er ráðlagt frá {fmtDate(j.reevaluation_due_at)}.{!reevalOpen && " Það opnast tveimur mánuðum fyrr; þangað til getur þú bókað aukaviðtal."}
        </p>
      )}
      {pkgs.map((p) =>
        buying === p.key ? (
          <div key={p.key} className="rounded-2xl border border-slate-200 p-4">
            <Checkout packages={[p]} profileComplete={data.profile.complete} reload={async () => { setBuying(null); await reload(); }} />
            <button onClick={() => setBuying(null)} className="mt-2 text-sm text-slate-500">Hætta við</button>
          </div>
        ) : (
          <div key={p.key} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4">
            <div className="flex-1">
              <p className="font-semibold text-slate-800">{p.name}</p>
              <p className="text-sm text-slate-500">{p.description}</p>
            </div>
            <span className="font-semibold text-[#047857]">{formatIsk(p.price_isk)}</span>
            <button onClick={() => setBuying(p.key)} className="rounded-full bg-[#10B981] px-4 py-2 text-sm font-semibold text-white hover:bg-[#047857]">Velja</button>
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
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="font-bold text-slate-900">Fyrri heilsuferðir</p>
      <ul className="mt-2 space-y-1.5">
        {withPlan.map((h) => (
          <li key={h.id}>
            <Link href={`/account/heilsuferd/aaetlun?journey=${h.id}&tab=plan`} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm ring-1 ring-slate-200 hover:bg-slate-50">
              <span className="text-slate-700">Áætlun frá {fmtDate(h.plan_published_at)}</span>
              <span className="text-emerald-700">Opna →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PILLAR_LABEL: Record<string, string> = { sleep: "Svefn", exercise: "Hreyfing", nutrition: "Næring", mental: "Andleg líðan", general: "Almennt" };

function LecturesCard({ lectures }: { lectures: JourneyData["lectures"] }) {
  if (!lectures.length) return null;
  const done = lectures.filter((l) => l.completed_at).length;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold text-[#0F172A]">Fræðsla</p>
        <span className="text-xs text-slate-400">{done}/{lectures.length}</span>
      </div>
      <ul className="mt-3 space-y-1">
        {lectures.map((l) => (
          <li key={l.id}>
            <Link href={`/account/heilsuferd/fraedsla/${l.slug}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${l.completed_at ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {l.completed_at ? "✓" : l.kind === "video" ? "▶" : l.kind === "slides" ? "▤" : "¶"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{l.title}</span>
                <span className="block text-xs text-slate-400">{l.pillar ? PILLAR_LABEL[l.pillar] : ""}{l.duration_min ? ` · ${l.duration_min} mín.` : ""}</span>
              </span>
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
  if (!claims.length) return null;

  const download = async (orderId: string) => {
    const r = await api(`/api/hc/claims/${orderId}`);
    if (!r.ok) return;
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url; a.download = "umsokn-endurgreidsla.pdf"; a.click();
    URL.revokeObjectURL(url);
  };
  const send = async (orderId: string, resend = false) => {
    if (!confirm(resend ? "Senda umsóknina aftur á stéttarfélagið? Þú færð afrit í tölvupósti." : "Senda umsóknina á stéttarfélagið? Þú færð afrit í tölvupósti.")) return;
    setBusy(orderId);
    const r = await api(`/api/hc/claims/${orderId}`, { method: "POST", body: JSON.stringify({ action: "send", resend }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    setMsg({ ...msg, [orderId]: r.ok ? `Sent á ${j.sent_to}` : j.error || "Sending mistókst." });
    if (r.ok) await reload();
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="font-semibold text-[#0F172A]">Umsóknir til stéttarfélags</p>
      <div className="mt-3 space-y-3">
        {claims.map((c) => (
          <div key={c.id} className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-800">{c.union_name}</p>
            <p className="text-slate-500">Endurgreiðsla: {formatIsk(c.reimbursable_isk)}</p>
            <p className="text-xs text-slate-400">{c.sent_at ? `Send ${fmtDate(c.sent_at)} á ${c.sent_to}` : "Ekki send"}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => download(c.order_id)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold">Sækja PDF</button>
              <button type="button" onClick={() => send(c.order_id, !!c.sent_at)} disabled={busy === c.order_id}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${c.sent_at ? "border border-slate-300 bg-white text-slate-700" : "bg-[#10B981] text-white"}`}>
                {busy === c.order_id ? "Sendir…" : c.sent_at ? "Senda aftur" : "Senda á félagið"}
              </button>
            </div>
            {msg[c.order_id] && <p className="mt-1 text-xs text-slate-600">{msg[c.order_id]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}


