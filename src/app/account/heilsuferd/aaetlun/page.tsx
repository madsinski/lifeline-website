"use client";

// The participant's plan, in the places they use it:
//   Í dag    — today's workout and meals, the actions to tick, goals, fræðsla,
//              and the controls for the plan itself (edit, print)
//   Æfingar  — the exercise programme, arranged their way (days, swaps)
//   Næring   — the nutrition programme with real meals and recipes
//   Skýrslan — the health report
// (The old "Áætlunin" tab is folded into these; ?tab=plan lands on Í dag.)

import EmptyState from "@/app/components/hc/EmptyState";
import BackLink from "@/app/components/hc/BackLink";
import { hcBtn, hcCard, hcPage } from "@/app/components/hc/ui";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PlanView from "@/app/components/hc/PlanView";
import MyActions from "@/app/components/hc/MyActions";
import ResultSignals, { type FlaggedValue } from "@/app/components/hc/ResultSignals";
import ReportView from "@/app/components/hc/ReportView";
import type { Grunnheilsa, Signal as ReportSignal } from "@/lib/hc/grunnheilsa";
import type { ReportReference } from "@/lib/hc/knowledge";
import type { ActionPlan, LectureRef, Pillar } from "@/lib/hc/types";
import { DEFAULT_TRAINING, activityModality, adaptExercise, hardDays, isAdaptive, type TrainingSettings } from "@/lib/hc/adaptive-program";
import AppointmentCard from "@/app/components/hc/AppointmentCard";
import NudgeSettings from "@/app/components/hc/NudgeSettings";
import BeforeAfter from "@/app/components/hc/BeforeAfter";
import type { Comparison } from "@/lib/hc/compare";
import JourneyNav, { type JourneyPlace } from "@/app/components/hc/JourneyNav";
import type { Upcoming } from "@/lib/hc/upcoming";
import * as cache from "@/lib/hc/client-cache";
import PlanEditor from "@/app/components/hc/PlanEditor";
import ReportUpload from "@/app/components/hc/ReportUpload";
import { peek } from "@/lib/hc/client-cache";
import { Pencil } from "lucide-react";
import TrainingView from "@/app/components/hc/TrainingView";
import TrainingWizard from "@/app/components/hc/TrainingWizard";
import TrainingCustomise from "@/app/components/hc/TrainingCustomise";
import NutritionView from "@/app/components/hc/NutritionView";
import NutritionWizard from "@/app/components/hc/NutritionWizard";
import { DEFAULT_NUTRITION, type NutritionPrefs } from "@/lib/hc/nutrition";
import type { Meal } from "@/lib/hc/meals";
import ProgramPicker from "@/app/components/hc/ProgramPicker";
import TodayOverview, { TodayHeader } from "@/app/components/hc/TodayOverview";
import { DEFAULT_PERSONAL, personalise, type Personal } from "@/lib/hc/personalise";
import type { ActionLog, ActionPref } from "@/lib/hc/adherence";

type Tab = "today" | "exercise" | "nutrition" | "report" | "results";

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
    actionSignals: Record<string, ReportSignal | null>;
    reference?: Record<string, ReportReference>;
    sex?: "m" | "f" | null;
  } | null;
}

/**
 * The shape of the page while it loads.
 *
 * The cache usually fills this in the same tick, so it is only seen on a cold
 * load. A grey word reading "Hleð…" let the whole layout jump when the data
 * arrived; a skeleton of roughly the right size does not.
 */
function PlanSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Hleð áætluninni">
      <div className="h-11 rounded-hc-element bg-slate-200/70" />
      <div className="h-28 rounded-3xl bg-slate-200/70" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 rounded-3xl bg-slate-200/60" />
        <div className="h-24 rounded-3xl bg-slate-200/60" />
      </div>
      <div className="h-40 rounded-3xl bg-slate-200/50" />
    </div>
  );
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
  const [training, setTraining] = useState<TrainingSettings>(DEFAULT_TRAINING);
  const [personal, setPersonal] = useState<Personal>(DEFAULT_PERSONAL);
  const [gym, setGym] = useState<{ name: string | null; url: string | null; info: string | null } | null>(null);
  // The setup wizard: opened on demand, and by itself the first time, when
  // the programme is still running on defaults nobody has confirmed.
  const [setup, setSetup] = useState(false);
  // "Hvað viltu breyta?" for the training programme.
  const [customise, setCustomise] = useState(false);
  /** Which pillar the plan editor should open on, when it was opened from an action. */
  const [editPillar, setEditPillar] = useState<Pillar | null>(null);
  // The same, for the nutrition plan.
  const [nutritionSetup, setNutritionSetup] = useState(false);
  const [nutritionPrefs, setNutritionPrefs] = useState<NutritionPrefs>(DEFAULT_NUTRITION);
  const [mealLibrary, setMealLibrary] = useState<Meal[] | null>(null);
  const [picker, setPicker] = useState<"exercise" | "nutrition" | null>(null);
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
      if (tj?.personal) setPersonal(tj.personal as Personal);
      if (tj?.gym !== undefined) setGym(tj.gym as typeof gym);
      if (tj?.nutrition) setNutritionPrefs(tj.nutrition as NutritionPrefs);
      if (tj?.settings && !(tj.settings as { saved?: boolean }).saved) setSetup(true);
      const loaded = aOk ? {
        journey_id: aj.journey_id as string, plan: pj.plan ?? aj.plan ?? null,
        logs: (aj.logs as ActionLog[]) ?? [], prefs: (aj.prefs as ActionPref[]) ?? [], flagged: (aj.flagged as FlaggedValue[]) ?? [],
        report: (aj.report as Loaded["report"]) ?? null, compare: (aj.compare as Comparison | null) ?? null,
      } : null;
      setData(loaded);
      if (first) {
        first = false;
        // The tab in the address wins; else today when there is a plan, otherwise the report.
        const asked = askedTab === "plan" ? "today" : askedTab;
        const wanted = (["today", "exercise", "nutrition", "report"] as const).find((t) => t === asked);
        const ok = wanted === "report" ? !!loaded?.report : wanted === "exercise" ? !!loaded?.plan?.exercise : wanted === "nutrition" ? !!loaded?.plan?.nutrition : !!loaded?.plan;
        setTabState(wanted && ok ? wanted : loaded?.plan ? "today" : loaded?.report ? "report" : "today");
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
      // Days, swaps and meal picks apply to every programme, so always load them.
      const t = (pj.plan ?? aj.plan) ? await cache.load(api, U.t) : null;
      apply(a.status < 400, aj, pj, t && t.status < 400 ? (t.body as J) : null);
      // Warm the journey page for the "Ferðin" tab.
      cache.prefetch(api, ["/api/hc/journey", "/api/hc/journey/exists"]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the tab is only read on first load
  }, [journey, router, api, reloadKey]);

  const plan = data?.plan ?? null;
  const setTab = (t: Tab, sessionId?: string) => {
    setTabState(t);
    const u = new URL(window.location.href);
    u.searchParams.set("tab", t === "results" ? "report" : t);
    window.history.replaceState(null, "", u);
    window.scrollTo({ top: 0 });
    if (sessionId) setTimeout(() => document.getElementById(`session-${sessionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  // The programme as written (adaptive ones computed from the settings), then arranged their way.
  const baseExercise = plan?.exercise ? (isAdaptive(plan.exercise.key) ? adaptExercise(plan.exercise, training, plan.start_date) : plan.exercise) : null;
  const exercise = baseExercise ? personalise(baseExercise, personal, hardDays(training)) : null;
  const qs = journey ? `?journey=${encodeURIComponent(journey)}` : "";

  /** Save the participant's arrangement at once; the server's answer (with library snapshots) replaces it. */
  const savePersonal = async (next: Personal, fields: (keyof Personal)[]) => {
    const prev = personal;
    setPersonal(next);
    const body = Object.fromEntries(fields.map((f) => [f, next[f]]));
    const r = await api(`/api/hc/training${qs}`, { method: "POST", body: JSON.stringify(body) });
    cache.invalidate("/api/hc/training");
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.personal) setPersonal(j.personal); else setPersonal(prev);
  };
  /** Another programme from the library. */
  const changeProgram = async (kind: "exercise" | "nutrition", key: string) => {
    const r = await api("/api/hc/my-plan", { method: "POST", body: JSON.stringify(kind === "exercise" ? { exercise_key: key } : { nutrition_key: key }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.plan && data) {
      setData({ ...data, plan: j.plan });
      cache.invalidate("/api/hc/");
      if (kind === "nutrition") void savePersonal({ ...personal, meal_picks: {} }, ["meal_picks"]);
    }
  };
  const lectureFor = (p: Pillar) => {
    const l = lectures.find((x) => x.pillar === p && !x.completed) ?? lectures.find((x) => x.pillar === p);
    return l ? { title: l.title, href: `/account/heilsuferd/fraedsla/${l.slug}` } : null;
  };
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
  // The report's traffic lights keyed by hc_knowledge slug rather than by row
  // key, which is what the training hints look things up by. Built here
  // because the report is already on the page; no extra request.
  const reportSignalsBySlug = useMemo(() => {
    const out: Record<string, ReportSignal | null> = {};
    for (const item of data?.report?.report.items ?? []) {
      // The planning light, not the printed verdict: a domain with flagged
      // components is a need even when its composite score reads "Gott".
      if (item.slug) out[item.slug] = data?.report?.actionSignals?.[item.key] ?? data?.report?.signals[item.key] ?? null;
    }
    return out;
  }, [data]);
  /** The measured body data from the report: protein target and start weights. */
  const body = useMemo(() => {
    const val = (slug: string) => {
      const row = (data?.report?.report.items ?? []).find((i) => i.slug === slug);
      return row && Number.isFinite(row.value) ? Number(row.value) : null;
    };
    return { weightKg: val("thyngd"), bodyFatPct: val("fitumassi"), sex: data?.report?.sex ?? null };
  }, [data]);
  const weightKg = body.weightKg;

  const reportTitlesBySlug = useMemo(() => {
    const out: Record<string, string> = {};
    for (const item of data?.report?.report.items ?? []) if (item.slug) out[item.slug] = item.title;
    return out;
  }, [data]);

  /**
   * A finished workout.
   *
   * Goes to client_session_completions, the table the app already writes for
   * every kind of completed thing (meals, sleep routines, sessions), so a
   * workout done on the web sits in the same history as one done in the app
   * rather than in a parallel one. The individual sets went to `set_logs` as
   * they were logged.
   */
  const finishWorkout = async (info: { minutes: number; rpe: number; session: { id: string; title: string; modality: string; weekday: number } }) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("client_session_completions").insert({
      client_id: u.user.id,
      // What they did, beside what was prescribed — so "fjallganga instead of
      // Zone 2" reads as a kept week rather than a missed session.
      completed_action_key: info.session.title,
      prescribed_action_key: info.session.id,
      modality: info.session.modality,
      duration_min: info.minutes || null,
      intensity_rpe: info.rpe,
      // The column is checked against mon…sun, not the Icelandic day name.
      prescribed_day: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][info.session.weekday] ?? null,
    });
    cache.invalidate("/api/hc/");
    setReloadKey((k) => k + 1);
  };

  const saveNutrition = async (next: NutritionPrefs) => {
    const prev = nutritionPrefs;
    setNutritionPrefs(next);
    setSaving(true);
    const qs = journey ? `?journey=${encodeURIComponent(journey)}` : "";
    const r = await api(`/api/hc/training${qs}`, { method: "POST", body: JSON.stringify({ nutrition_prefs: next }) });
    cache.invalidate("/api/hc/training");
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (r.ok && j.nutrition) setNutritionPrefs(j.nutrition); else setNutritionPrefs(prev);
  };

  // The meal library, for showing how much of it survives the restrictions.
  useEffect(() => {
    if (!nutritionSetup || mealLibrary) return;
    void (async () => {
      const r = await cache.load(api, "/api/hc/library?kind=meals");
      const rows = ((r.body as { meals?: Meal[] }).meals) ?? [];
      setTimeout(() => setMealLibrary(rows), 0);
    })();
  }, [nutritionSetup, mealLibrary, api]);

  // The report often lands before the plan is written; show it either way.
  const hasSomething = !!plan || !!data?.report;

  const place: JourneyPlace = tab === "exercise" ? "exercise" : tab === "nutrition" ? "nutrition" : tab === "report" || tab === "results" ? "report" : "today";
  const next = appointments[0] ?? null;

  return (
    <div className={`${hcPage.participant} print:bg-white`}>
      <div className="mx-auto max-w-4xl px-4 pb-28 pt-24 sm:pb-16 sm:pt-28 print:max-w-none print:p-0">
        {/* The way back. "Aðgangur" is the sixth slot in JourneyNav, which on a
            phone puts it behind "Meira", and /account bounces a participant
            straight back here — so the account needs a button of its own that
            is visible wherever you are. */}
        <div className="mb-3 print:hidden">
          <BackLink href="/account/heilsuferd/adgangur" label="Aðgangurinn minn" />
        </div>

        {data === undefined && <PlanSkeleton />}

        {editing && data !== undefined && (
          <PlanEditor api={api} initialFocus={editPillar}
            onDone={() => { setEditing(false); setEditPillar(null); setTabState("today"); setReloadKey((k) => k + 1); }}
            onCancel={() => { setEditing(false); setEditPillar(null); }} />
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
              hasExercise={!!plan?.exercise} hasNutrition={!!plan?.nutrition} hasPlan={!!plan}
              onSelect={(k) => {
                // These are pages of their own, not tabs on this one.
                if (k === "journey" || k === "account" || k === "fraedsla") return false;
                if ((k === "today" || k === "exercise" || k === "nutrition") && !plan) return false;
                setTab(k === "report" ? (data.report ? "report" : "results") : k);
                return true;
              }} />

            <div className="mt-4">
              {tab === "today" && plan && (
                <div className="space-y-4 print:hidden">
                  <TodayHeader name={name} onEdit={() => setEditing(true)} />
                  {next && <AppointmentCard a={next} />}
                  <TodayOverview api={api} plan={plan} exercise={exercise} mealPicks={personal.meal_picks} nutritionPrefs={nutritionPrefs} training={training} lectures={lectures}
                    onOpenExercise={(id) => setTab("exercise", id)} onOpenNutrition={() => setTab("nutrition")} onEdit={() => setEditing(true)} />
                  <MyActions api={api} journeyId={data.journey_id} plan={plan}
                    onEditPillar={(pl) => { setEditPillar(pl); setEditing(true); }} logs={data.logs} prefs={data.prefs}
                    links={{ exercise: plan.exercise ? () => setTab("exercise", exercise?.sessions.find((x) => x.weekday === ((new Date().getDay() + 6) % 7))?.id) : null, nutrition: plan.nutrition ? () => setTab("nutrition") : null, lecture: lectureFor }} />
                  <button type="button" onClick={() => setEditing(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 px-4 py-4 text-sm font-semibold text-slate-700 hover:border-hc-brand hover:text-hc-brand-dark">
                    <Pencil className="h-4 w-4" aria-hidden /> Bæta við, taka út eða raða aðgerðum
                  </button>
                  <NudgeSettings api={api} />
                </div>
              )}
              {tab === "exercise" && plan && baseExercise && (
                <div className="print:hidden">
                  {setup && isAdaptive(plan.exercise?.key) ? (
                    <TrainingWizard
                      settings={training} planStart={plan.start_date}
                      signals={reportSignalsBySlug} titles={reportTitlesBySlug} gym={gym} saving={saving}
                      onSave={(next) => { void saveTraining(next); setSetup(false); }}
                      onCancel={() => setSetup(false)} />
                  ) : customise && isAdaptive(plan.exercise?.key) ? (
                    <TrainingCustomise
                      settings={training} planStart={plan.start_date}
                      signals={reportSignalsBySlug} titles={reportTitlesBySlug} gym={gym} saving={saving}
                      onSave={(next) => void saveTraining(next)}
                      onClose={() => setCustomise(false)}
                      arrange={
                        <TrainingView api={api} exercise={baseExercise} personal={personal} arranging
                          onSave={(p) => void savePersonal(p, ["program_key", "days", "hiit_split", "swaps"])}
                          onChangeProgram={() => setPicker("exercise")} />
                      } />
                  ) : (
                    <TrainingView api={api} exercise={baseExercise} personal={personal}
                      onSave={(p) => void savePersonal(p, ["program_key", "days", "hiit_split", "swaps"])}
                      onChangeProgram={() => setPicker("exercise")}
                      training={training} planStart={plan.start_date}
                      onFinish={(info) => void finishWorkout(info)} body={body}
                      onCompleteActivity={(a) => void finishWorkout({
                        minutes: a.minutes ?? 60, rpe: a.intensity === "hard" ? 7 : a.intensity === "easy" ? 3 : 5,
                        session: { id: a.id, title: a.name, modality: activityModality(a), weekday: a.day },
                      })}
                      onMoveActivity={(id, weekday) => void saveTraining({
                        ...training,
                        activities: training.activities.map((x) => (x.id === id ? { ...x, day: weekday } : x)),
                      })}
                      onRemoveActivity={(id) => void saveTraining({
                        ...training, activities: training.activities.filter((x) => x.id !== id),
                      })}
                      onAddDay={(a) => void saveTraining({
                        ...training,
                        activities: [...training.activities, { ...a, id: Math.random().toString(36).slice(2, 10) }],
                      })}
                      onInstead={(info) => void finishWorkout({
                        minutes: 0, rpe: 5,
                        session: { ...info.session, modality: info.modality, title: info.label },
                      })}
                      onCustomise={isAdaptive(plan.exercise?.key) ? () => setCustomise(true) : undefined} />
                  )}
                </div>
              )}
              {tab === "nutrition" && plan?.nutrition && (
                <div className="print:hidden">
                  {nutritionSetup ? (
                    <NutritionWizard prefs={nutritionPrefs} signals={reportSignalsBySlug} meals={mealLibrary} saving={saving}
                      onSave={(next) => { void saveNutrition(next); setNutritionSetup(false); }}
                      onCancel={() => setNutritionSetup(false)} />
                  ) : (
                    <NutritionView api={api} nutrition={plan.nutrition} picks={personal.meal_picks}
                      prefs={nutritionPrefs} signals={reportSignalsBySlug} weightKg={weightKg}
                      onPick={(slot, id) => {
                        const picks = { ...personal.meal_picks };
                        if (id) picks[slot] = id; else delete picks[slot];
                        void savePersonal({ ...personal, meal_picks: picks }, ["meal_picks"]);
                      }}
                      onCustomise={() => setNutritionSetup(true)}
                      onChangeProgram={() => setPicker("nutrition")} />
                  )}
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
              {plan && (
                <PlanView printOnly plan={exercise ? { ...plan, exercise: { ...exercise, sessions: exercise.sessions } } : plan} clientName={name} author={plan.created_by ?? null}
                  lectures={lectures} />
              )}
              {picker && plan && (
                <ProgramPicker api={api} kind={picker} current={(picker === "exercise" ? plan.exercise?.key : plan.nutrition?.key) ?? null}
                  onPick={(k) => void changeProgram(picker, k)} onClose={() => setPicker(null)} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
