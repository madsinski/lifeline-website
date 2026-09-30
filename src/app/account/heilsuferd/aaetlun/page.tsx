"use client";

// The customer's action plan. Two ways in: "Í dag" is where the plan gets
// done (tick actions, see the week, set something aside), "Áætlunin" is the
// whole plan as the nurse wrote it, with the print layout behind it.

import EmptyState from "@/app/components/hc/EmptyState";
import { hcBtn, hcCard, hcPage } from "@/app/components/hc/ui";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PlanView from "@/app/components/hc/PlanView";
import MyActions from "@/app/components/hc/MyActions";
import ResultSignals, { type FlaggedValue } from "@/app/components/hc/ResultSignals";
import ReportView from "@/app/components/hc/ReportView";
import type { Grunnheilsa, Signal as ReportSignal } from "@/lib/hc/grunnheilsa";
import type { ReportReference } from "@/lib/hc/knowledge";
import type { ActionPlan, LectureRef } from "@/lib/hc/types";
import { DEFAULT_TRAINING, adaptExercise, isAdaptive, type TrainingSettings } from "@/lib/hc/adaptive-program";
import AppointmentCard from "@/app/components/hc/AppointmentCard";
import NudgeSettings from "@/app/components/hc/NudgeSettings";
import BeforeAfter from "@/app/components/hc/BeforeAfter";
import type { Comparison } from "@/lib/hc/compare";
import JourneyNav, { type JourneyPlace } from "@/app/components/hc/JourneyNav";
import type { Upcoming } from "@/lib/hc/upcoming";
import Link from "next/link";
import * as cache from "@/lib/hc/client-cache";
import PlanEditor from "@/app/components/hc/PlanEditor";
import ReportUpload from "@/app/components/hc/ReportUpload";
import { peek } from "@/lib/hc/client-cache";
import { BookOpen, Dumbbell } from "lucide-react";
import type { ActionLog, ActionPref } from "@/lib/hc/adherence";

type Tab = "today" | "plan" | "report" | "results";

interface Loaded {
  journey_id: string;
  plan: ActionPlan | null;
  logs: ActionLog[];
  prefs: ActionPref[];
  flagged: FlaggedValue[];
  compare?: Comparison | null;
  report: {
    report: Grunnheilsa;
    signals: Record<string, ReportSignal | null>;
    reference?: Record<string, ReportReference>;
    sex?: "m" | "f" | null;
  } | null;
}

export default function PlanPage() {
  return <Suspense><PlanPageInner /></Suspense>;
}

function PlanPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const journey = search.get("journey");
  const askedTab = search.get("tab");
  const [editing, setEditing] = useState(search.get("breyta") === "1");
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<Loaded | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [tab, setTabState] = useState<Tab | null>(null);
  const [lectures, setLectures] = useState<(LectureRef & { completed?: boolean })[]>([]);
  const [appointments, setAppointments] = useState<Upcoming[]>([]);
  const [planTab, setPlanTab] = useState<"overview" | "exercise" | undefined>(undefined);
  const [training, setTraining] = useState<TrainingSettings>(DEFAULT_TRAINING);
  const [saving, setSaving] = useState(false);

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    return fetch(url, {
      ...init,
      headers: {
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  }, []);

  useEffect(() => {
    let first = true;
    // Apply one set of responses; the tab is chosen only the first time, so a
    // background refresh never moves the participant.
    type J = Record<string, unknown> & { plan?: ActionPlan | null };
    const apply = (aOk: boolean, aj: J, pj: J, tj: J | null) => {
      setName((pj.client_name as string) ?? null);
      setLectures((pj.lectures as (LectureRef & { completed?: boolean })[]) ?? []);
      setAppointments((pj.appointments as Upcoming[]) ?? []);
      if (tj?.settings) setTraining(tj.settings as TrainingSettings);
      const loaded = aOk ? {
        journey_id: aj.journey_id as string, plan: pj.plan ?? aj.plan ?? null,
        logs: (aj.logs as ActionLog[]) ?? [], prefs: (aj.prefs as ActionPref[]) ?? [], flagged: (aj.flagged as FlaggedValue[]) ?? [],
        report: (aj.report as Loaded["report"]) ?? null, compare: (aj.compare as Comparison | null) ?? null,
      } : null;
      setData(loaded);
      if (first) {
        first = false;
        // The tab in the address wins; else today when there is a plan, otherwise the report.
        const wanted = (["today", "plan", "report"] as const).find((t) => t === askedTab);
        setTabState(wanted && (wanted === "report" ? !!loaded?.report : !!loaded?.plan) ? wanted : loaded?.plan ? "today" : loaded?.report ? "report" : "today");
      }
    };
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) { router.replace(`/account/login?next=${encodeURIComponent("/account/heilsuferd/aaetlun")}`); return; }
      const qs = journey ? `?journey=${encodeURIComponent(journey)}` : "";
      const U = { a: `/api/hc/actions${qs}`, p: `/api/hc/plan${qs}`, t: `/api/hc/training${qs}` };
      // Show what we had at once (switching back from another page)…
      const ca = peek<J>(U.a), cp = peek<J>(U.p);
      if (ca && cp) apply(true, ca.body, cp.body, peek<J>(U.t)?.body ?? null);
      // …then the fresh data.
      const [a, p] = await Promise.all([cache.load(api, U.a), cache.load(api, U.p)]);
      const aj = a.body as J, pj = p.body as J;
      const planKey = (pj.plan ?? aj.plan)?.exercise?.key;
      const t = isAdaptive(planKey) ? await cache.load(api, U.t) : null;
      apply(a.status < 400, aj, pj, t && t.status < 400 ? (t.body as J) : null);
      // Warm the journey page for the "Ferðin" tab.
      cache.prefetch(api, ["/api/hc/journey"]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the tab is only read on first load
  }, [journey, router, api, reloadKey]);

  const plan = data?.plan ?? null;
  const setTab = (t: Tab) => {
    setTabState(t);
    const u = new URL(window.location.href);
    u.searchParams.set("tab", t === "results" ? "report" : t);
    window.history.replaceState(null, "", u);
    window.scrollTo({ top: 0 });
  };
  // Today's session from the exercise plan (adaptive ones computed from the settings).
  const exercise = plan?.exercise ? (isAdaptive(plan.exercise.key) ? adaptExercise(plan.exercise, training, plan.start_date) : plan.exercise) : null;
  const WD = ["sun", "mán", "þri", "mið", "fim", "fös", "lau"];
  const todays = exercise?.sessions.find((x) => x.day.toLowerCase().startsWith(WD[new Date().getDay()]));
  const nextLecture = lectures.find((l) => !l.completed);
  // Save each change straight away; the page shows the new sessions at once.
  const saveTraining = async (next: TrainingSettings) => {
    const prev = training;
    setTraining(next);
    setSaving(true);
    const qs = journey ? `?journey=${encodeURIComponent(journey)}` : "";
    const r = await api(`/api/hc/training${qs}`, { method: "POST", body: JSON.stringify(next) });
    cache.invalidate("/api/hc/training");
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (r.ok && j.settings) setTraining(j.settings); else setTraining(prev);
  };
  // The report often lands before the plan is written; show it either way.
  const hasSomething = !!plan || !!data?.report;

  const place: JourneyPlace = tab === "plan" ? "plan" : tab === "report" || tab === "results" ? "report" : "today";
  const next = appointments[0] ?? null;

  return (
    <div className={`${hcPage.participant} print:bg-white`}>
      <div className="mx-auto max-w-4xl px-4 pb-28 pt-24 sm:pb-16 sm:pt-28 print:max-w-none print:p-0">
        {data === undefined && <p className="mt-4 text-slate-500">Hleð…</p>}

        {editing && data !== undefined && (
          <PlanEditor api={api}
            onDone={() => { setEditing(false); setTabState("plan"); setReloadKey((k) => k + 1); }}
            onCancel={() => setEditing(false)} />
        )}

        {!editing && data !== undefined && !hasSomething && (
          <div className="mt-4 space-y-4">
            {next && <AppointmentCard a={next} />}
            <EmptyState variant="waiting" title="Áætlunin er ekki tilbúin enn"
              body="Hún verður til í viðtalinu við hjúkrunarfræðinginn. Þú getur líka sett skýrsluna þína inn og búið áætlunina til sjálf(ur)."
              action={{ label: "Sjá heilsuferðina", href: "/account/heilsuferd?ferd=1" }} />
            <ReportUpload api={api} onDone={() => setReloadKey((k) => k + 1)} />
            <button type="button" onClick={() => setEditing(true)} className={`${hcBtn.secondary} w-full`}>Búa til áætlun sjálf(ur) án skýrslu</button>
          </div>
        )}

        {!editing && hasSomething && data && (
          <>
            <JourneyNav active={place} hasReport={!!data.report || !!data.flagged.length}
              onSelect={(k) => {
                if (k === "journey") return false;
                if (k === "plan" && !plan) return false;
                setPlanTab(undefined);
                setTab(k === "report" ? (data.report ? "report" : "results") : k);
                return true;
              }} />

            <div className="mt-4">
              {tab === "today" && plan && (
                <div className="space-y-4 print:hidden">
                  {next && <AppointmentCard a={next} />}
                  {todays ? (
                    <button type="button" onClick={() => { setPlanTab("exercise"); setTab("plan"); }}
                      className="flex w-full items-center gap-4 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-400 p-4 text-left text-white shadow-sm sm:p-5">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20"><Dumbbell className="h-6 w-6" aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold uppercase tracking-[0.15em] text-white/80">Æfing dagsins</span>
                        <span className="block text-lg font-bold">{todays.title}{todays.minutes ? ` · um ${todays.minutes} mín.` : ""}</span>
                        <span className="block truncate text-sm text-white/90">{todays.items.filter((it) => it.block === "main").map((it) => it.name).slice(0, 3).join(" · ")}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold">Opna →</span>
                    </button>
                  ) : exercise ? (
                    <p className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-100">
                      <strong className="text-slate-800">Hvíldardagur frá æfingum.</strong> Rösk ganga eða útivera telur samt.
                    </p>
                  ) : null}
                  {nextLecture && (
                    <Link href={`/account/heilsuferd/fraedsla/${nextLecture.slug}`}
                      className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-emerald-100 transition hover:ring-emerald-300 sm:p-5">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><BookOpen className="h-6 w-6" aria-hidden /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Fræðsla{nextLecture.duration_min ? ` · ${nextLecture.duration_min} mín.` : ""}</span>
                        <span className="block font-bold text-slate-900">{nextLecture.title}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-emerald-700">Opna →</span>
                    </Link>
                  )}
                  <MyActions api={api} journeyId={data.journey_id} plan={plan} logs={data.logs} prefs={data.prefs} />
                  <NudgeSettings api={api} />
                </div>
              )}
              {tab === "report" && data.report && (
                <div className="space-y-4 print:hidden">
                  {!plan && (
                    <div className={`${hcCard.hero} flex flex-wrap items-center gap-4 p-5`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold">Búðu til áætlunina þína</p>
                        <p className="text-sm text-emerald-100">Tillögur byggðar á skýrslunni. Þú velur, raðar og breytir, og hjúkrunarfræðingurinn fer yfir hana með þér í viðtalinu.</p>
                      </div>
                      <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center rounded-hc-element bg-white px-5 font-bold text-hc-hero-to hover:bg-emerald-50">Byrja →</button>
                    </div>
                  )}
                  {data.compare && <BeforeAfter c={data.compare} />}
                  <ReportView report={data.report.report} signals={data.report.signals}
                    reference={data.report.reference} sex={data.report.sex} audience="client" />
                  <p className="mt-4 px-1 text-xs leading-relaxed text-slate-500">
                    Þetta er heilsufarsskýrslan þín í einfaldaðri mynd. Læknir fer yfir niðurstöðurnar með þér og
                    fullbúna skýrslan er í sjúklingagáttinni.
                  </p>
                </div>
              )}
              {tab === "results" && (
                <div className="print:hidden">
                  <ResultSignals flagged={data.flagged} />
                </div>
              )}
              {tab === "plan" && plan && (
                <div className="mb-3 flex justify-end print:hidden">
                  <button type="button" onClick={() => setEditing(true)} className={hcBtn.secondary}>Breyta áætluninni</button>
                </div>
              )}
              {tab === "plan" && plan && (
                <PlanView key={planTab ?? "p"} plan={plan} clientName={name} author={plan.created_by ?? null} initialTab={planTab}
                  training={{ settings: training, onChange: saveTraining, saving }}
                  lectures={lectures} lectureHref={(slug) => `/account/heilsuferd/fraedsla/${slug}`} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
