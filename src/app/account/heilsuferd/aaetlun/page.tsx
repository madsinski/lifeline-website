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
import { actionForSession, isoDay } from "@/lib/hc/adherence";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PlanView from "@/app/components/hc/PlanView";
import MyActions from "@/app/components/hc/MyActions";
import ResultSignals, { type FlaggedValue } from "@/app/components/hc/ResultSignals";
import ResultsCard, { type HcResult } from "@/app/components/hc/ResultsCard";
import ReportView from "@/app/components/hc/ReportView";
import type { Grunnheilsa, Signal as ReportSignal } from "@/lib/hc/grunnheilsa";
import type { ReportReference } from "@/lib/hc/knowledge";
import type { ActionPlan, LectureRef, Pillar } from "@/lib/hc/types";
import { DEFAULT_TRAINING, activityModality, adaptExercise, hardDays, isAdaptive, type TrainingSettings } from "@/lib/hc/adaptive-program";
import AppointmentCard from "@/app/components/hc/AppointmentCard";
import CoachView from "@/app/components/hc/CoachView";
import BeforeAfter from "@/app/components/hc/BeforeAfter";
import type { Comparison } from "@/lib/hc/compare";
import JourneyNav, { type JourneyPlace } from "@/app/components/hc/JourneyNav";
import type { Upcoming } from "@/lib/hc/upcoming";
import * as cache from "@/lib/hc/client-cache";
import PlanEditor from "@/app/components/hc/PlanEditor";
import ReportUpload from "@/app/components/hc/ReportUpload";
import Sheet from "@/app/components/hc/Sheet";
import { useToday } from "@/app/components/hc/TodayCards";
import { NotificationBell, NotificationSheet, useNotifications } from "@/app/components/hc/Notifications";
import { UpcomingList, UpcomingSoon, useUpcoming } from "@/app/components/hc/Upcoming";
import PeopleSheet, { PeopleButton } from "@/app/components/hc/PeopleSheet";
import ReportApproval from "@/app/components/hc/ReportApproval";
import RetentionReview from "@/app/components/hc/RetentionReview";
import { peek } from "@/lib/hc/client-cache";
import { Info, Pencil } from "lucide-react";
import TrainingView from "@/app/components/hc/TrainingView";
import CalendarCard from "@/app/components/hc/CalendarCard";
import TrainingWizard from "@/app/components/hc/TrainingWizard";
import NutritionView from "@/app/components/hc/NutritionView";
import NutritionWizard from "@/app/components/hc/NutritionWizard";
import { DEFAULT_NUTRITION, type NutritionPrefs } from "@/lib/hc/nutrition";
import type { Meal } from "@/lib/hc/meals";
import ProgramPicker from "@/app/components/hc/ProgramPicker";
import TodayOverview, { TodayHeader } from "@/app/components/hc/TodayOverview";
import { DEFAULT_PERSONAL, personalise, type Personal } from "@/lib/hc/personalise";
import type { ActionLog, ActionPref } from "@/lib/hc/adherence";

type Tab = "today" | "exercise" | "nutrition" | "coach" | "report" | "results";

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
    /** Who put it there — shown so the participant can object to it. */
    source?: "self" | "staff" | "staff_on_behalf";
    created_at?: string;
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

/**
 * Every field of the arrangement that the Æfingar view can change.
 *
 * savePersonal sends only the fields it is handed, and the server applies
 * only the keys it receives — so a field missing from this list is a control
 * that posts 200 and does nothing. "drops" and "extra" were missing, which
 * is exactly what made "Taka út" and "Bæta við æfingu" silently no-ops: the
 * component built the right object and the request dropped it on the way
 * out. Spelled out as one constant so the two call sites cannot drift.
 */
const PERSONAL_FIELDS: (keyof Personal)[] = ["program_key", "days", "hiit_split", "swaps", "drops", "extra"];

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
  /**
   * What has been marked done today, keyed by session or activity id.
   *
   * Without this a tick wrote a row and nothing on screen changed, so the
   * button looked broken even when it had worked.
   */
  const [doneToday, setDoneToday] = useState<Set<string>>(() => new Set());
  /**
   * The checklist's own view of the logs, lifted so the day's count in the
   * card above can see a tick the moment it happens. data.logs only changes
   * on a page reload.
   */
  const [liveLogs, setLiveLogs] = useState<ActionLog[] | null>(null);
  /** Every measured value on the journey, for "Mínar mælingar". */
  const [results, setResults] = useState<HcResult[] | null>(null);
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
  // Stats, urgent items and the partner for Í dag — one request for three cards.
  const { today, reloadToday } = useToday(api);
  const { items: notes, unread, markSeen } = useNotifications(api);
  const [notesOpen, setNotesOpen] = useState(false);
  const { items: upcoming } = useUpcoming(api);
  const [people, setPeople] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  /**
   * Swiped away for today only.
   *
   * Per-browser and per-day: the date is the value, so tomorrow's card is
   * not suppressed by a swipe from yesterday, and a failure to read it just
   * means the card shows — which is the safe way round for a blood test.
   */
  const SOON_KEY = "hc-soon-hidden";
  const [soonHidden, setSoonHidden] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try { setSoonHidden(window.localStorage.getItem(SOON_KEY) === new Date().toISOString().slice(0, 10)); }
      catch { /* private mode */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const hideSoon = () => {
    setSoonHidden(true);
    try { window.localStorage.setItem(SOON_KEY, new Date().toISOString().slice(0, 10)); } catch { /* private mode */ }
  };

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
        const wanted = (["today", "exercise", "nutrition", "coach", "report"] as const).find((t) => t === asked);
        // The coach tab needs no plan: it is where you go when you have not
        // got one, or when the one you have does not fit.
        const ok = wanted === "report" ? !!loaded?.report
          : wanted === "coach" ? true
          : wanted === "exercise" ? !!loaded?.plan?.exercise
          : wanted === "nutrition" ? !!loaded?.plan?.nutrition
          : !!loaded?.plan;
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
  const exercise = baseExercise ? personalise(baseExercise, personal, hardDays(training), training?.days ?? []) : null;
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
    setDoneToday((prev) => new Set([...prev, info.session.id, info.session.title]));
    // Tick the habit this session satisfies, so the same workout is not
    // marked twice. Doing the Monday strength session and then having to find
    // "Styrktarþjálfun" in the checklist and tick it again is the duplication
    // Mads reported — two places asking about one thing that happened.
    //
    // Only when exactly one action matches. Two candidates means the plan is
    // ambiguous about which habit this was, and a wrong tick is worse than an
    // untouched one.
    const uid = actionForSession(plan, info.session.modality, data?.logs ?? []);
    if (uid) {
      await api("/api/hc/actions", {
        method: "POST",
        body: JSON.stringify({ journey_id: data?.journey_id, action_uid: uid, done_on: isoDay(), done: true }),
      });
    }
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

  // Today's completions, so a session or a sport can show that it is done.
  useEffect(() => {
    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const start = `${isoDay()}T00:00:00`;
      const { data } = await supabase.from("client_session_completions")
        .select("prescribed_action_key, completed_action_key, completed_at")
        .eq("client_id", u.user.id).gte("completed_at", start);
      const keys = new Set((data ?? []).flatMap((r) => [r.prescribed_action_key, r.completed_action_key].filter(Boolean) as string[]));
      setTimeout(() => setDoneToday(keys), 0);
    })();
  }, [reloadKey]);

  // Opening or closing the editor swaps the whole page under the scroll
  // position. "Breyta" on the last action in the list is a long way down, and
  // the editor that replaced it is short, so without this you land below its
  // end looking at the footer.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [editing, nutritionSetup]);

  // Measured values, loaded when the Niðurstöður tab is actually opened —
  // most visits never go there.
  useEffect(() => {
    if (tab !== "results" || !data) return;
    void (async () => {
      const r = await api("/api/hc/results");
      if (!r.ok) return;
      const j = (await r.json().catch(() => ({}))) as { results?: HcResult[] };
      setTimeout(() => setResults(j.results ?? []), 0);
    })();
  }, [tab, data, api, reloadKey]);

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

  const place: JourneyPlace = tab === "exercise" ? "exercise" : tab === "nutrition" ? "nutrition" : tab === "coach" ? "coach" : tab === "report" || tab === "results" ? "report" : "today";
  /**
   * How much of today is done, and of how much.
   *
   * One definition, read by the face on the hero and by the card in the
   * sleeve behind it: they were two copies of the same long expression,
   * which is two places for them to drift apart.
   */
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDow = (new Date().getDay() + 6) % 7;
  const doneCount = (plan?.modules ?? []).filter((m) => (liveLogs ?? data?.logs ?? []).some((l) => l.action_uid === m.uid && l.done_on === todayStr)).length
    + (exercise?.sessions.filter((sx) => sx.weekday === todayDow && doneToday.has(sx.id)).length ?? 0);
  const ofCount = (plan?.modules ?? []).filter((m) => (m.frequency ?? "").toLowerCase() === "daglega" || m.pillar !== "exercise").length
    + (exercise?.sessions.filter((sx) => sx.weekday === todayDow).length ?? 0);

  const next = appointments[0] ?? null;

  return (
    <div className={`${hcPage.participant} print:bg-white`}>
      <div className="mx-auto max-w-4xl px-4 pb-28 pt-4 sm:pb-16 sm:pt-8 print:max-w-none print:p-0">
        {/* The way back. "Aðgangur" is the sixth slot in JourneyNav, which on a
            phone puts it behind "Meira", and /account bounces a participant
            straight back here — so the account needs a button of its own that
            is visible wherever you are. */}
        {/* The "Aðgangurinn minn" link is gone — the navbar already has it.
            A back link out of an editor is a different thing and stays. */}
        {uploadOpen && (
        <Sheet title="Ný skýrsla" onClose={() => setUploadOpen(false)}>
          <div className="p-4">
            <p className="text-sm text-hc-ink-2">
              Sæktu PDF-skýrsluna „Grunnheilsa“ í sjúklingagáttina og settu hana hér inn. Áætlunin uppfærist eftir nýju niðurstöðunum.
            </p>
            <ReportUpload api={api} compact
              onDone={() => { setReloadKey((k) => k + 1); setUploadOpen(false); }} />
          </div>
        </Sheet>
      )}
      {notesOpen && (
        <NotificationSheet items={notes} onClose={() => setNotesOpen(false)}
          upcoming={<UpcomingList items={upcoming} />} />
      )}
      {people && (
        <PeopleSheet api={api} mine={today?.stats ?? null} partner={today?.partner ?? null}
          done={doneCount} of={ofCount}
          onClose={() => setPeople(false)} onNudged={() => void reloadToday()} />
      )}
      {(editing || nutritionSetup) && (
          <div className="mb-3 print:hidden">
            <BackLink label="Til baka í áætlunina"
              onBack={() => { setEditing(false); setEditPillar(null); setNutritionSetup(false); }} />
          </div>
        )}

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
            {/* Both of these render null most of the time. A wrapper with a
                margin around them spent 16px on nothing on every normal
                visit, so the spacing lives inside the cards instead. */}
            <ReportApproval api={api} onDone={() => setReloadKey((k) => k + 1)} />
            <RetentionReview api={api} onDone={() => setReloadKey((k) => k + 1)} />
            <JourneyNav active={place} unread={unread} hasReport={!!data.report || !!data.flagged.length}
              hasExercise={!!plan?.exercise} hasNutrition={!!plan?.nutrition} hasPlan={!!plan}
              onSelect={(k) => {
                // These are pages of their own, not tabs on this one.
                if (k === "journey" || k === "account" || k === "fraedsla" || k === "notifications") return false;
                if ((k === "today" || k === "exercise" || k === "nutrition") && !plan) return false;
                setTab(k === "report" ? (data.report ? "report" : "results") : k);
                return true;
              }} />

            <div className="mt-4">
              {tab === "today" && plan && (
                <div className="space-y-4 print:hidden">
                  <TodayHeader name={name} right={<NotificationBell unread={unread} onOpen={() => { setNotesOpen(true); void markSeen(); }} />} />
                  {/* The urgent card carries the next appointment now, so
                      AppointmentCard no longer repeats it here. */}
                  <TodayOverview plan={plan} exercise={exercise} training={training}
                    onOpenExercise={(id) => setTab("exercise", id)} onEdit={() => setEditing(true)}
                    people={<PeopleButton onClick={() => setPeople(true)} done={doneCount} of={ofCount} />} />
                  {/* Only when something is today or tomorrow, and amber
                      because that is the whole reason it appeared. The full
                      list lives behind the lightning bolt, where nothing is
                      urgent and everything is there. Swipe it away and it
                      stays away until tomorrow. */}
                  {!soonHidden && <UpcomingSoon items={upcoming} onDismiss={hideSoon} />}
                  <MyActions api={api} journeyId={data.journey_id} plan={plan}
                    onEditPillar={(pl) => { setEditPillar(pl); setEditing(true); }} logs={data.logs} prefs={data.prefs}
                    links={{ exercise: plan.exercise ? () => setTab("exercise", exercise?.sessions.find((x) => x.weekday === ((new Date().getDay() + 6) % 7))?.id) : null, nutrition: plan.nutrition ? () => setTab("nutrition") : null, lecture: lectureFor }}
                    exercise={exercise} training={training} doneToday={doneToday} onLogs={setLiveLogs}
                    onCompleteActivity={(a) => void finishWorkout({
                      minutes: a.minutes ?? 60, rpe: a.intensity === "hard" ? 7 : a.intensity === "easy" ? 3 : 5,
                      session: { id: a.id, title: a.name, modality: activityModality(a), weekday: a.day },
                    })}
                    onCompleteSession={(sx) => void finishWorkout({
                      minutes: sx.minutes ?? 45,
                      // A tick from Í dag carries no measured RPE — the
                      // workout runner is where that is recorded. These are
                      // the prescription's own defaults by modality, so the
                      // session counts as kept without inventing an effort
                      // the person never reported.
                      rpe: sx.modality === "hiit" ? 8 : sx.modality === "strength" ? 6 : 4,
                      session: { id: sx.id, title: sx.title, modality: sx.modality, weekday: sx.weekday },
                    })} />
                  <button type="button" onClick={() => setEditing(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 px-4 py-4 text-sm font-semibold text-slate-700 hover:border-hc-brand hover:text-hc-brand-dark">
                    <Pencil className="h-4 w-4" aria-hidden /> Bæta við, taka út eða raða aðgerðum
                  </button>
                </div>
              )}

              {/* Everything to do with a person rather than a plan. It sat at
                  the end of Í dag, under the checklist and the reminders,
                  which is the last place someone with a hurt knee would look. */}
              {tab === "coach" && (
                <div className="print:hidden">
                  {/* Was HelpCard alone — one form behind one button. The
                      page is now the conversation, the coach and the diary,
                      with the request form kept inside the first of them. */}
                  <CoachView api={api} />
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
                  /* TrainingCustomise was the other half of a duplicated
                     system: "Breyta" opened it, and it held a second copy of
                     this calendar plus Uppsetningin and Álagið — both of
                     which Breytingar already covers, alongside Meiðsli, Hvar
                     og hvernig and Prógrammið that it did not. One sheet
                     now, and the calendar edits in place. */
                  ) : (
                    <TrainingView api={api} exercise={baseExercise} personal={personal}
                      onSave={(p) => void savePersonal(p, PERSONAL_FIELDS)}
                      training={training} planStart={plan.start_date}
                      onFinish={(info) => void finishWorkout(info)} body={body}
                      onCompleteActivity={(a) => void finishWorkout({
                        minutes: a.minutes ?? 60, rpe: a.intensity === "hard" ? 7 : a.intensity === "easy" ? 3 : 5,
                        session: { id: a.id, title: a.name, modality: activityModality(a), weekday: a.day },
                      })}
                      onSaveTraining={(next) => void saveTraining(next)}
                      onActivityTime={(id, at) => void saveTraining({
                        ...training,
                        activities: training.activities.map((x) => (x.id === id ? { ...x, at } : x)),
                      })}
                      onActivityLoad={(id, load) => void saveTraining({
                        ...training,
                        activities: training.activities.map((x) => (x.id === id ? { ...x, load } : x)),
                      })}
                      onMoveActivity={(id, weekday) => void saveTraining({
                        ...training,
                        activities: training.activities.map((x) => (x.id === id ? { ...x, day: weekday } : x)),
                      })}
                      doneToday={doneToday}
                      onRemoveActivity={(id) => void saveTraining({
                        ...training, activities: training.activities.filter((x) => x.id !== id),
                      })}
                      // Taking a session off means that weekday stops being a
                      // training day. Deleting it by id would not hold: the
                      // programme is generated from these settings, so the
                      // session would be back the next time the week is built.
                      onRemoveDay={(weekday) => {
                        // The pins go with the day. The render-time filter
                        // already ignores a pin to a day that is gone, but
                        // leaving one behind means the stored arrangement
                        // claims something that is not true.
                        void savePersonal({
                          ...personal,
                          days: Object.fromEntries(Object.entries(personal.days ?? {}).filter(([, d]) => d !== weekday)),
                        }, PERSONAL_FIELDS);
                        void saveTraining({
                          ...training, days: (training.days ?? []).filter((d) => d !== weekday),
                        });
                      }}
                      onAddDay={(a, inj) => void saveTraining({
                        ...training,
                        // An injury named while adding a lift belongs to the
                        // settings, not to that Friday — it should change
                        // every session the programme writes, not one.
                        injuries: inj?.length
                          ? Array.from(new Set([...(training.injuries ?? []), ...inj]))
                          : training.injuries,
                        activities: [...training.activities, { ...a, id: Math.random().toString(36).slice(2, 10) }],
                      })}
                      onInstead={(info) => void finishWorkout({
                        minutes: 0, rpe: 5,
                        session: { ...info.session, modality: info.modality, title: info.label },
                      })}
                      />
                  )}
                  {/* Last on the tab: the week belongs in the calendar they
                      already live in, but it is a once-only errand and does
                      not deserve a place above the training itself.
                      mt-6 because TrainingView's own space-y-6 governs its
                      children, not its siblings — so this sat flush against
                      the card above it. */}
                  <div className="mt-6"><CalendarCard api={api} /></div>
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

                  {/* The upload moved to the foot of the page, with the
                      hero's "Hlaða upp skýrslu" button scrolling to it. It
                      was a card at the top, above the report somebody opened
                      the page to read. */}

                  {data.compare && <BeforeAfter c={data.compare} />}
                  <ReportView onUpload={() => setUploadOpen(true)} report={data.report.report} signals={data.report.signals}
                    reference={data.report.reference} sex={data.report.sex} audience="client" />
                  <p className="mt-4 px-1 text-xs leading-relaxed text-slate-500">
                    Þetta er heilsufarsskýrslan þín í einfaldaðri mynd. Læknir fer yfir niðurstöðurnar með þér og
                    fullbúna skýrslan er í sjúklingagáttinni.
                  </p>
                  {/* Adding a newer report belongs on the page where you are
                      looking at the current one. It used to live on the
                      results tab, which is not where anybody goes after an
                      endurmat hands them a new PDF — and it is also the way
                      back if a retention review removed the old copy. */}
                  {/* The upload card stood here at the foot of the tab.
                      It is a sleeve from the hero's icon now: a once-in-a-
                      while errand does not need a permanent card under the
                      report, and the consent it carries deserves a surface
                      of its own rather than a footer. */}
                </div>
              )}
              {tab === "results" && (
                <div className="space-y-4 print:hidden">
                  {/* Where the report came from, in the participant's own
                      account. Staff reading it is lawful under 9. gr. (2)(h)
                      without consent, but someone whose results were put
                      there by somebody else should be told so and have a way
                      to say it is wrong. */}
                  {data.report?.source && data.report.source !== "self" && (
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200">
                      <Info className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                      <span className="text-slate-700">
                        {data.report.source === "staff_on_behalf"
                          ? "Starfsmaður Lifeline setti þessa skýrslu inn að þinni beiðni."
                          : "Starfsmaður Lifeline las þessa skýrslu inn fyrir viðtalið þitt."}
                      </span>
                      <button type="button" onClick={() => setTab("coach")}
                        className="ml-auto rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Þetta er ekki rétt
                      </button>
                    </div>
                  )}
                  <ResultSignals flagged={data.flagged} />
                  {/* A health journey is longitudinal: a new report comes
                      every six to twelve months. The upload used to live only
                      in the "you have no report yet" branch, so once the first
                      one landed there was no way to add the next. */}
                  {/* Measurements between reports: a home blood-pressure
                      reading, a blood panel from somewhere else, a weight.
                      The same card the nurse uses, so the bands and the
                      traffic lights are the same ones — writing through
                      /api/hc/results, which marks them 'self' and will not
                      overwrite anything measured at the station. */}
                  <ResultsCard api={api} journeyId={data.journey_id} sex={body.sex}
                    results={results ?? []}
                    endpoint="/api/hc/results" audience="client"
                    onSaved={() => setReloadKey((k) => k + 1)} />
                  <ReportUpload api={api} onDone={() => setReloadKey((k) => k + 1)}
                    heading="Ný skýrsla"
                    blurb="Komin með nýja Grunnheilsu-skýrslu? Settu hana inn og áætlunin uppfærist eftir nýju niðurstöðunum." />
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
