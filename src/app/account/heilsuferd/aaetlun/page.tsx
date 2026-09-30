"use client";

// The customer's action plan. Two ways in: "Í dag" is where the plan gets
// done (tick actions, see the week, set something aside), "Áætlunin" is the
// whole plan as the nurse wrote it, with the print layout behind it.

import EmptyState from "@/app/components/hc/EmptyState";
import { hcPage } from "@/app/components/hc/ui";
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
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) { router.replace(`/account/login?next=${encodeURIComponent("/account/heilsuferd/aaetlun")}`); return; }
      const qs = journey ? `?journey=${encodeURIComponent(journey)}` : "";
      const [a, p] = await Promise.all([api(`/api/hc/actions${qs}`), api(`/api/hc/plan${qs}`)]);
      const aj = await a.json().catch(() => ({}));
      const pj = await p.json().catch(() => ({}));
      setName(pj.client_name ?? null);
      setLectures(pj.lectures ?? []);
      setAppointments(pj.appointments ?? []);
      const planKey = (pj.plan ?? aj.plan)?.exercise?.key;
      if (isAdaptive(planKey)) {
        const t = await api(`/api/hc/training${qs}`);
        const tj = await t.json().catch(() => ({}));
        if (t.ok && tj.settings) setTraining(tj.settings);
      }
      const loaded = a.ok ? { journey_id: aj.journey_id, plan: pj.plan ?? aj.plan ?? null, logs: aj.logs ?? [], prefs: aj.prefs ?? [], flagged: aj.flagged ?? [], report: aj.report ?? null, compare: aj.compare ?? null } : null;
      setData(loaded);
      // The tab in the address wins; else land on today when there is a
      // plan, otherwise on the report.
      const wanted = (["today", "plan", "report"] as const).find((t) => t === askedTab);
      setTabState(wanted && (wanted === "report" ? !!loaded?.report : !!loaded?.plan) ? wanted : loaded?.plan ? "today" : loaded?.report ? "report" : "today");
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the tab is only read on first load
  }, [journey, router, api]);

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

        {data !== undefined && !hasSomething && (
          <div className="mt-4 space-y-4">
            {next && <AppointmentCard a={next} />}
            <EmptyState variant="waiting" title="Áætlunin er ekki tilbúin enn"
              body="Hún birtist hér eftir viðtalið við hjúkrunarfræðinginn."
              action={{ label: "Sjá heilsuferðina", href: "/account/heilsuferd?ferd=1" }} />
          </div>
        )}

        {hasSomething && data && (
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
