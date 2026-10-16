"use client";

// The participant's plan, in the places they use it:
//   Í dag    — today's workout and meals, the actions to tick, goals, fræðsla,
//              and the controls for the plan itself (edit, print)
//   Æfingar  — the exercise programme, arranged their way (days, swaps)
//   Næring   — the nutrition programme with real meals and recipes
//   Þjálfun — the coach or nurse, the thread and bookings
//   Skýrslan — the health report, measurements between reports and a new
//              report; reached from Ég (/app/eg), not from the tab bar
//
// The tab is the address: ?tab= is read on every render and changed with
// pushState, so Back steps through the tabs instead of leaving the app, and
// a link to ?tab=coach&sub=book works on the first load as well as in place.

import EmptyState from "@/app/components/hc/EmptyState";
import BackLink from "@/app/components/hc/BackLink";
import { hcBtn, hcCard, hcPage } from "@/app/components/hc/ui";
import { SAVE_FAILED, useSaveStatus, useToast } from "@/app/components/hc/Toast";
import { Alert, Button, useDialog } from "@/app/components/account/ui";
import NextStepCard from "@/app/components/hc/NextStepCard";
import { DayMealsProvider } from "@/app/components/hc/useDayMeals";
import { actionForSession, isoDay } from "@/lib/hc/adherence";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PlanView from "@/app/components/hc/PlanView";
import MyActions from "@/app/components/hc/MyActions";
import SuggestedProgram from "@/app/components/hc/SuggestedProgram";
import HelpCard from "@/app/components/hc/HelpCard";
import { portalFor } from "@/lib/hc/portal";
import Paywall from "@/app/components/hc/Paywall";
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
import Link from "next/link";
import JourneyNav, { type JourneyPlace, JourneyHeader } from "@/app/components/hc/JourneyNav";
import { LoadingBar, Skeleton } from "@/app/components/hc/Loading";
import type { Upcoming } from "@/lib/hc/upcoming";
import * as cache from "@/lib/hc/client-cache";
import PlanEditor from "@/app/components/hc/PlanEditor";
import ReportUpload from "@/app/components/hc/ReportUpload";
import { useToday } from "@/app/components/hc/TodayCards";
import { NotificationBell, NotificationSheet, useNotifications } from "@/app/components/hc/Notifications";
import { UpcomingList, UpcomingSoon, useUpcoming } from "@/app/components/hc/Upcoming";
import PeopleSheet, { PeopleButton } from "@/app/components/hc/PeopleSheet";
import ReportApproval from "@/app/components/hc/ReportApproval";
import RetentionReview from "@/app/components/hc/RetentionReview";
import { peek } from "@/lib/hc/client-cache";
import { Info, SlidersHorizontal } from "lucide-react";
import TrainingView from "@/app/components/hc/TrainingView";
import TrainingWizard from "@/app/components/hc/TrainingWizard";
import NutritionView from "@/app/components/hc/NutritionView";
import NutritionWizard from "@/app/components/hc/NutritionWizard";
import { DEFAULT_NUTRITION, type NutritionPrefs } from "@/lib/hc/nutrition";
import { dayFor, type Meal } from "@/lib/hc/meals";
import { proteinTarget } from "@/lib/hc/nutrition-log";
import ProgramPicker from "@/app/components/hc/ProgramPicker";
import TodayOverview, { TodayHeader } from "@/app/components/hc/TodayOverview";
import { DEFAULT_PERSONAL, personalise, type Personal } from "@/lib/hc/personalise";
import type { ActionLog, ActionPref } from "@/lib/hc/adherence";

type Tab = "today" | "exercise" | "nutrition" | "coach" | "report";

const TABS: Tab[] = ["today", "exercise", "nutrition", "coach", "report"];
/** "results" was a tab of its own; its content lives on the report tab now. */
const asTab = (v: string | null): Tab | null => (v === "results" ? "report" : TABS.find((t) => t === v) ?? null);

/** Set once the training wizard has opened by itself, so a reload does not open it again. */
const WIZARD_SEEN_KEY = "hc-training-wizard-seen";

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
    <div className="space-y-4" aria-busy="true" aria-label="Hleð áætluninni">
      {/* A bar at the top says something is happening; the blocks below
          keep the layout from jumping when it lands. The blocks shimmer
          rather than blink — a sweep reads as progress where a fade reads
          as a broken image. */}
      <LoadingBar />
      <Skeleton className="h-11 rounded-hc-element" />
      <Skeleton className="h-28" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-40" />
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
  const urlTab = asTab(search.get("tab"));
  /** Which Þjálfari subpage: an appointment belongs on Bóka. */
  const coachSub: "talk" | "book" = search.get("sub") === "book" ? "book" : "talk";
  /** ?maela=1: Bóka opens on the measurement list (the journey's „Bóka mælingartíma“). */
  const coachMeasure = coachSub === "book" && search.get("maela") === "1";
  const toast = useToast();
  const dialog = useDialog();
  const { saving, run } = useSaveStatus();
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
  /** Today's totals as the checklist actually renders them. */
  const [liveCounts, setLiveCounts] = useState<{ done: number; of: number } | null>(null);
  /** Arrived from a notification: land on the newest message. */
  const [coachFocus, setCoachFocus] = useState(false);
  /** Every measured value on the journey, for "Mínar mælingar". */
  const [results, setResults] = useState<HcResult[] | null>(null);
  /*
   * undefined = not loaded. A failed load is NOT "no plan": it sets
   * loadError and leaves data alone, so a network blip never tells somebody
   * with a plan to go and make one.
   */
  const [data, setData] = useState<Loaded | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [lectures, setLectures] = useState<(LectureRef & { completed?: boolean })[]>([]);
  const [appointments, setAppointments] = useState<Upcoming[]>([]);
  const [training, setTraining] = useState<TrainingSettings>(DEFAULT_TRAINING);
  /** What they told us about their body, where no measurement exists. */
  const [selfBody, setSelfBody] = useState<{ weight_kg: number | null; height_cm: number | null }>({ weight_kg: null, height_cm: null });
  /*
   * Whether the app is open to this person, from the server.
   *
   * Not computed here: the rule depends on a paid order, a published plan
   * and a subscription row the browser can no longer read in full — see
   * src/lib/hc/subscription.ts. Undefined means "not loaded", which must
   * never render as "no access".
   */
  const [access, setAccess] = useState<{ ok: boolean; reason: string; trialEndsAt: string | null; daysLeft: number | null } | null>(null);
  const [subPkg, setSubPkg] = useState<Record<string, unknown> | null>(null);
  /* The journey's track, for the empty state: the coaching track has no
     nurse interview to wait for, so it must not be promised one.
     undefined = not loaded yet. */
  const [entry, setEntry] = useState<string | null | undefined>(undefined);
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
  /** The nutrition programme picker (the exercise programme is changed inside Æfingar). */
  const [picker, setPicker] = useState(false);

  const api = useCallback(async (url: string, init: RequestInit = {}) => {
    const { data: s } = await supabase.auth.getSession();
    const t = s.session?.access_token;
    return fetch(url, {
      ...init,
      headers: {
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        /* FormData must set its own Content-Type: the boundary is part of
           it, and naming the type without one leaves the body
           unparseable. Avatar upload failed silently on exactly this. */
        ...(init.body && !(typeof FormData !== "undefined" && init.body instanceof FormData)
          ? { "Content-Type": "application/json" } : {}),
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

  /** The wizard's first-load check, done once per visit to the page. */
  const wizardChecked = useRef(false);
  useEffect(() => {
    type J = Record<string, unknown> & { plan?: ActionPlan | null };
    const apply = (aj: J, pj: J, tj: J | null) => {
      setName((pj.client_name as string) ?? null);
      setLectures((pj.lectures as (LectureRef & { completed?: boolean })[]) ?? []);
      setAppointments((pj.appointments as Upcoming[]) ?? []);
      if (tj?.settings) setTraining(tj.settings as TrainingSettings);
      if (tj?.body) setSelfBody(tj.body as { weight_kg: number | null; height_cm: number | null });
      if (tj?.personal) setPersonal(tj.personal as Personal);
      if (tj?.gym !== undefined) setGym(tj.gym as typeof gym);
      if (tj?.nutrition) setNutritionPrefs(tj.nutrition as NutritionPrefs);
      /*
       * The training wizard opens by itself once, on the first load where
       * the programme still runs on defaults nobody has confirmed — not on
       * every reload until it is saved, which is what it used to do. After
       * that, "Stilla æfingar" on Æfingar is the way back to it.
       */
      if (!wizardChecked.current && tj?.settings) {
        wizardChecked.current = true;
        if (!(tj.settings as { saved?: boolean }).saved) {
          let seen = false;
          try { seen = window.localStorage.getItem(WIZARD_SEEN_KEY) === "1"; } catch { /* private mode */ }
          if (!seen) {
            setSetup(true);
            try { window.localStorage.setItem(WIZARD_SEEN_KEY, "1"); } catch { /* private mode */ }
          }
        }
      }
      setData({
        journey_id: aj.journey_id as string, plan: pj.plan ?? aj.plan ?? null,
        logs: (aj.logs as ActionLog[]) ?? [], prefs: (aj.prefs as ActionPref[]) ?? [], flagged: (aj.flagged as FlaggedValue[]) ?? [],
        report: (aj.report as Loaded["report"]) ?? null, compare: (aj.compare as Comparison | null) ?? null,
      });
      setLoadError(false);
    };
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) { router.replace(`/account/login?next=${encodeURIComponent("/app/aaetlun")}`); return; }
      const qs = journey ? `?journey=${encodeURIComponent(journey)}` : "";
      const U = { a: `/api/hc/actions${qs}`, p: `/api/hc/plan${qs}`, t: `/api/hc/training${qs}` };
      // Show what we had at once (switching back from another page)…
      const ca = peek<J>(U.a), cp = peek<J>(U.p);
      if (ca && cp) apply(ca.body, cp.body, peek<J>(U.t)?.body ?? null);
      // …then the fresh data. A rejection (offline) or a 4xx/5xx is an
      // error, never an empty plan.
      try {
        const [a, p] = await Promise.all([cache.load(api, U.a), cache.load(api, U.p)]);
        if (a.status >= 400 || p.status >= 400) { setLoadError(true); return; }
        const aj = a.body as J, pj = p.body as J;
        // Days, swaps and meal picks apply to every programme, so always load them.
        const t = (pj.plan ?? aj.plan) ? await cache.load(api, U.t).catch(() => null) : null;
        apply(aj, pj, t && t.status < 400 ? (t.body as J) : null);
      } catch {
        setLoadError(true);
        return;
      }

      /*
       * Access, and the thing it sells.
       *
       * Both read after the plan so the page paints its content first — a
       * paywall that flashes before the app has even drawn would hit people
       * who are entitled to be here. A failure leaves access null, which
       * renders as the app.
       */
      try {
        const [jr, sr] = await Promise.all([
          cache.load(api, "/api/hc/journey"),
          cache.load(api, "/api/hc/subscribe"),
        ]);
        if (jr.status < 400) {
          const acc = (jr.body as { access?: typeof access }).access;
          if (acc) setAccess(acc);
        }
        setEntry(jr.status < 400 ? ((jr.body as { journey?: { entry?: string } | null }).journey?.entry ?? null) : null);
        if (sr.status < 400) setSubPkg((sr.body as { package?: Record<string, unknown> }).package ?? null);
      } catch {
        setEntry(null);
      }
      /*
       * Warm everything the other tabs will ask for, on an idle callback:
       * this is prefetching, and it must never be the reason the page
       * people are looking at is slower.
       */
      const warm = () => cache.prefetch(api, [
        "/api/hc/journey", "/api/hc/journey/exists",
        "/api/hc/coach",            // Þjálfari: the thread and the bookings
        "/api/hc/library?kind=meals", // Næring: the meal library
        "/api/hc/lectures",         // Fræðsla: the catalogue
        "/api/hc/notifications",    // the bell, on every page
      ], 60_000);
      const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(warm, { timeout: 3000 });
      else setTimeout(warm, 1200);
    })();
  }, [journey, router, api, reloadKey]);

  const plan = data?.plan ?? null;
  /*
   * The tab, from the address.
   *
   * Derived rather than held: pushState updates useSearchParams, and Back
   * restores the previous address, so the view follows history without a
   * popstate handler of its own. A tab that cannot show (Næring without a
   * nutrition programme) falls back to the default.
   */
  const defaultTab: Tab = plan ? "today" : data?.report ? "report" : "today";
  const tabOk = (t: Tab) => t === "report" || t === "coach"
    || (t === "exercise" ? !!plan?.exercise : t === "nutrition" ? !!plan?.nutrition : !!plan || !data?.report);
  const tab: Tab | null = data === undefined ? null : urlTab && tabOk(urlTab) ? urlTab : defaultTab;

  /** Move to a tab, as a history entry (or in place, for a redirect after a save). */
  const setTab = (t: Tab, sessionId?: string, opts: { replace?: boolean; sub?: "book" | null } = {}) => {
    const u = new URL(window.location.href);
    u.searchParams.set("tab", t);
    if (opts.sub) u.searchParams.set("sub", opts.sub); else u.searchParams.delete("sub");
    u.searchParams.delete("breyta");
    if (u.toString() !== window.location.href) {
      if (opts.replace) window.history.replaceState(null, "", u);
      else window.history.pushState(null, "", u);
    }
    /*
     * The thread puts itself where it needs to be: scrolling to the top
     * here fought it when a message notification sent somebody to read the
     * newest message. Every other tab does want the top.
     */
    if (t !== "coach") window.scrollTo({ top: 0, behavior: "instant" });
    if (sessionId) setTimeout(() => document.getElementById(`session-${sessionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  /*
   * Take a link that points at this page and do it in place: the
   * notification sleeve links to ?tab=coach, and following it as a page
   * load would remount everything to switch a tab.
   */
  const goInPage = (href: string): boolean => {
    if (!href.startsWith("/app/aaetlun")) return false;
    const u = new URL(href, "https://x");
    const want = asTab(u.searchParams.get("tab"));
    if (!want) return false;
    const sub = u.searchParams.get("sub") === "book" ? "book" : null;
    // A notification pointed at a message, so the thread should open on it.
    setCoachFocus(want === "coach" && !sub);
    setPeople(false);
    setNotesOpen(false);
    setTab(want, undefined, { sub });
    return true;
  };

  const qs = journey ? `?journey=${encodeURIComponent(journey)}` : "";
  // The programme as written (adaptive ones computed from the settings), then arranged their way.
  const baseExercise = plan?.exercise ? (isAdaptive(plan.exercise.key) ? adaptExercise(plan.exercise, training, plan.start_date) : plan.exercise) : null;
  const exercise = baseExercise ? personalise(baseExercise, personal, hardDays(training), training?.days ?? []) : null;

  /**
   * Save the participant's arrangement at once; the server's answer (with
   * library snapshots) replaces it. On failure the change is undone and the
   * toast says so — it used to revert without a word.
   */
  const savePersonal = async (next: Personal, fields: (keyof Personal)[]): Promise<boolean> => {
    const prev = personal;
    setPersonal(next);
    const body = Object.fromEntries(fields.map((f) => [f, next[f]]));
    const r = await run(() => api(`/api/hc/training${qs}`, { method: "POST", body: JSON.stringify(body) }));
    cache.invalidate("/api/hc/training");
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r && j.personal) { setPersonal(j.personal); return true; }
    setPersonal(prev);
    return false;
  };
  /**
   * Another nutrition programme from the library.
   *
   * The week's meal choices belong to the old programme and are cleared
   * when it changes, so that is said before switching rather than found out
   * afterwards.
   */
  const changeNutrition = async (key: string) => {
    // Picking the programme already in use is not a change: no request, no toast.
    if (key === plan?.nutrition?.key) return;
    const picks = Object.keys(personal.meal_picks ?? {}).length;
    if (picks > 0) {
      const ok = await dialog.confirm({
        title: "Skipta um næringaráætlun?",
        body: "Máltíðirnar sem þú hefur valið fyrir vikuna fylgja gömlu áætluninni og hreinsast þegar þú skiptir.",
        confirmLabel: "Skipta",
      });
      if (!ok) return;
    }
    const r = await run(() => api("/api/hc/my-plan", { method: "POST", body: JSON.stringify({ nutrition_key: key }) }),
      { fail: "Ekki tókst að skipta um áætlun. Reyndu aftur." });
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !j.plan || !data) return;
    setData({ ...data, plan: j.plan });
    cache.invalidate("/api/hc/");
    if (picks > 0) await savePersonal({ ...personal, meal_picks: {} }, ["meal_picks"]);
    toast.show("Næringaráætluninni var skipt", { tone: "ok" });
  };
  const lectureFor = (p: Pillar) => {
    const l = lectures.find((x) => x.pillar === p && !x.completed) ?? lectures.find((x) => x.pillar === p);
    return l ? { title: l.title, href: `/app/fraedsla/${l.slug}` } : null;
  };
  /** Save each change straight away; the page shows the new sessions at once. True when it stored. */
  const saveTraining = async (next: TrainingSettings): Promise<boolean> => {
    const prev = training;
    setTraining(next);
    const r = await run(() => api(`/api/hc/training${qs}`, { method: "POST", body: JSON.stringify(next) }));
    cache.invalidate("/api/hc/training");
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r && j.settings) { setTraining(j.settings); return true; }
    setTraining(prev);
    return false;
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
  /*
   * Measured first, then what they told us.
   *
   * Weight used to come only from the report's þyngd row, so everything
   * calibrated against body mass — the 1,6–2,0 g/kg protein target above
   * all — switched itself off for anybody without a report. That is the
   * whole coaching track, which exists for people who do not want the
   * workup, and the page was telling them the target would appear after
   * measurements that are never going to happen.
   *
   * A measurement always wins. A figure somebody typed is not a figure a
   * nurse measured, and where both exist the clinical one is the one to use.
   */
  const weightKg = body.weightKg ?? selfBody.weight_kg;

  /*
   * Today's meals, computed here because two tabs need them.
   *
   * Næring plans the week; Í dag is where "did I actually do it" lives. The
   * meal checklist used to sit on Næring, which is why taking it off that
   * page left ticking with nowhere to go — the fix was never to put it back
   * there but to pass the day's meals to the checklist that already holds
   * every other habit.
   *
   * Same dayFor the Næring page uses, so the two always agree about what
   * Tuesday's lunch is.
   */
  const [mealLib, setMealLib] = useState<Meal[] | null>(null);
  useEffect(() => {
    (async () => {
      const r = await cache.load(api, "/api/hc/library?kind=meals");
      if (r.status < 400) setMealLib((r.body as { meals: Meal[] }).meals ?? []);
    })();
  }, [api]);

  const todayMeals = useMemo(() => {
    const key = plan?.nutrition?.key ?? null;
    if (!mealLib || !key) return null;
    const band = proteinTarget(weightKg);
    const targetG = band ? Math.round((band.min + band.max) / 2) : null;
    const wd = (new Date().getDay() + 6) % 7;
    return dayFor(mealLib, key, personal.meal_picks ?? {}, nutritionPrefs, wd, targetG);
  }, [mealLib, plan?.nutrition?.key, personal.meal_picks, nutritionPrefs, weightKg]);

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
  /**
   * True when it stored. `announce` says "Æfingin vistuð" here; the workout
   * runner says it itself (it shows the toast unless this returns false).
   */
  const finishWorkout = async (info: {
    minutes: number | null; rpe: number | null;
    session: { id: string; title: string; modality: string; weekday: number };
    /** "Gera annað": what was done instead of the prescribed session, whose
     *  title goes beside it so the coach can read "í stað Styrkur A". */
    instead?: { prescribedTitle: string };
  }, announce = true): Promise<boolean> => {
    const { data: u } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    if (!u.user) { toast.show("Ekki tókst að vista æfinguna. Skráðu þig inn aftur.", { tone: "bad" }); return false; }
    const ins = await supabase.from("client_session_completions").insert({
      client_id: u.user.id,
      // What they did, beside what was prescribed — so "fjallganga instead of
      // Zone 2" reads as a kept week rather than a missed session.
      completed_action_key: info.session.title,
      prescribed_action_key: info.session.id,
      modality: info.session.modality,
      duration_min: info.minutes || null,
      intensity_rpe: info.rpe ?? null,
      // migration-session-substitutions.sql
      substituted: !!info.instead,
      prescribed_label: info.instead?.prescribedTitle ?? null,
      // The column is checked against mon…sun, not the Icelandic day name.
      prescribed_day: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"][info.session.weekday] ?? null,
    }).then((x) => x, () => ({ error: { message: "network" } }));
    // It used to tick the session on screen whatever the insert said.
    if (ins.error) { toast.show("Ekki tókst að vista æfinguna. Reyndu aftur.", { tone: "bad" }); return false; }
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
      await run(() => api("/api/hc/actions", {
        method: "POST",
        body: JSON.stringify({ journey_id: data?.journey_id, action_uid: uid, done_on: isoDay(), done: true }),
      }), { fail: "Æfingin vistaðist en ekki tókst að haka við venjuna." });
    }
    if (announce) toast.show(info.instead ? "Skráð. Það telst með í vikunni." : "Æfingin vistuð", { tone: "ok" });
    cache.invalidate("/api/hc/");
    setReloadKey((k) => k + 1);
    return true;
  };

  const saveNutrition = async (next: NutritionPrefs): Promise<boolean> => {
    const prev = nutritionPrefs;
    setNutritionPrefs(next);
    const r = await run(() => api(`/api/hc/training${qs}`, { method: "POST", body: JSON.stringify({ nutrition_prefs: next }) }));
    cache.invalidate("/api/hc/training");
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r && j.nutrition) { setNutritionPrefs(j.nutrition); return true; }
    setNutritionPrefs(prev);
    return false;
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

  // Measured values, loaded when the report tab is actually opened — most
  // visits never go there.
  const onReport = tab === "report" && !!data;
  useEffect(() => {
    if (!onReport) return;
    void (async () => {
      const r = await api("/api/hc/results").catch(() => null);
      if (!r?.ok) return;
      const j = (await r.json().catch(() => ({}))) as { results?: HcResult[] };
      setTimeout(() => setResults(j.results ?? []), 0);
    })();
  }, [onReport, api, reloadKey]);

  // The meal library, for showing how much of it survives the restrictions.
  useEffect(() => {
    if (!nutritionSetup || mealLibrary) return;
    void (async () => {
      const r = await cache.load(api, "/api/hc/library?kind=meals");
      const rows = ((r.body as { meals?: Meal[] }).meals) ?? [];
      setTimeout(() => setMealLibrary(rows), 0);
    })();
  }, [nutritionSetup, mealLibrary, api]);

  const place: JourneyPlace = tab ?? "today";
  /** The coaching track has no nurse, no interview and no doctor's review. undefined = not known yet. */
  const coaching = entry === undefined ? undefined : entry === "coach" || entry === "app";
  /**
   * How much of today is done, and of how much.
   *
   * One definition, read by the face on the hero and by the card in the
   * sleeve behind it: they were two copies of the same long expression,
   * which is two places for them to drift apart.
   */
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDow = (new Date().getDay() + 6) % 7;
  /*
   * A first guess, until the checklist says.
   *
   * Counting plan.modules here knows nothing about the two filters the
   * checklist applies — items set aside, and exercise habits the programme
   * supersedes — so setting something aside left the Staðan ring counting
   * it. MyActions reports its real totals through onCounts; this stands in
   * only for the first render, before it has mounted.
   */
  const guessDone = (plan?.modules ?? []).filter((m) => (liveLogs ?? data?.logs ?? []).some((l) => l.action_uid === m.uid && l.done_on === todayStr)).length
    + (exercise?.sessions.filter((sx) => sx.weekday === todayDow && doneToday.has(sx.id)).length ?? 0);
  const guessOf = (plan?.modules ?? []).filter((m) => (m.frequency ?? "").toLowerCase() === "daglega" || m.pillar !== "exercise").length
    + (exercise?.sessions.filter((sx) => sx.weekday === todayDow).length ?? 0);
  const doneCount = liveCounts?.done ?? guessDone;
  const ofCount = liveCounts?.of ?? guessOf;

  const next = appointments[0] ?? null;

  /** Through the paywall: Í dag, Æfingar and Næring are the subscription; the report and the coach stay open. */
  const walled = !!access && !access.ok && (tab === "today" || tab === "exercise" || tab === "nutrition");
  const coachUnread = notes.filter((n) => n.kind === "coach" && n.unread).reduce((s, n) => s + (n.count ?? 1), 0);
  const otherUnread = notes.filter((n) => n.kind !== "coach" && n.unread).length;
  const reload = () => setReloadKey((k) => k + 1);
  const scrollToUpload = () => document.getElementById("ny-skyrsla")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const paywall = (
    <Paywall api={api} pkg={subPkg as never} trialEndsAt={access?.trialEndsAt ?? null}
      mode={access?.reason === "none" ? "trial" : "subscribe"}
      onDone={async () => {
        cache.invalidate("/api/hc/journey", "/api/hc/subscribe");
        reload();
      }} />
  );

  return (
    <div className={`${hcPage.participant} print:bg-hc-surface`}>
      <div className="mx-auto max-w-4xl px-4 pb-28 pt-4 sm:pb-16 sm:pt-8 print:max-w-none print:p-0">
        {notesOpen && (
          <NotificationSheet items={notes} onClose={() => setNotesOpen(false)} onNavigate={goInPage}
            upcoming={<UpcomingList items={upcoming} onNavigate={goInPage} />} />
        )}
        {people && (
          <PeopleSheet api={api} mine={today?.stats ?? null} myAvatar={today?.avatar ?? null} partner={today?.partner ?? null}
            done={doneCount} of={ofCount}
            onClose={() => setPeople(false)} onNudged={() => void reloadToday()} />
        )}

        {/* The bar is drawn whatever state the page is in — loading, an
            error, no plan yet — so there is always a way somewhere else. */}
        <div className="print:hidden">
          <JourneyHeader />
          <JourneyNav active={place} counts={{ coach: coachUnread, other: otherUnread }}
            onSelect={(k) => {
              if (k === "me") return false;
              if ((k === "today" || k === "exercise" || k === "nutrition") && !plan) return false;
              setEditing(false); setEditPillar(null); setNutritionSetup(false);
              setTab(k);
              return true;
            }} />
        </div>

        <div className="mt-4">
          {(editing || nutritionSetup) && (
            <div className="mb-3 print:hidden">
              <BackLink label="Til baka í áætlunina"
                onBack={() => { setEditing(false); setEditPillar(null); setNutritionSetup(false); }} />
            </div>
          )}

          {/* An error is not an empty plan. */}
          {loadError && data === undefined && (
            <Alert tone="bad" title="Ekki tókst að sækja áætlunina"
              actions={<Button variant="secondary" onClick={() => { setLoadError(false); reload(); }}>Reyna aftur</Button>}>
              Athugaðu nettenginguna og reyndu aftur.
            </Alert>
          )}
          {loadError && data !== undefined && (
            <Alert tone="warn" compact className="mb-4"
              actions={<Button variant="secondary" size="sm" onClick={() => { setLoadError(false); reload(); }}>Reyna aftur</Button>}>
              Ekki tókst að uppfæra. Þú sérð síðustu gögn sem náðust.
            </Alert>
          )}
          {data === undefined && !loadError && <PlanSkeleton />}

          {editing && data !== undefined && (
            <PlanEditor api={api} initialFocus={editPillar}
              onDone={() => { setEditing(false); setEditPillar(null); setTab("today", undefined, { replace: true }); reload(); }}
              onCancel={() => { setEditing(false); setEditPillar(null); }} />
          )}

          {!editing && data && (
            /* One copy of the day's meal log, shared by the Í dag checklist
               and Næring, so a meal logged on one shows on the other. */
            <DayMealsProvider>
              {/* ── Í dag ─────────────────────────────────────────── */}
              {tab === "today" && (
                <div className="space-y-4 print:hidden">
                  {plan && !walled && (
                    <TodayHeader name={name} right={<NotificationBell unread={unread} onOpen={() => { setNotesOpen(true); void markSeen(); }} />} />
                  )}
                  {/* Næsta skref: one slot, the first thing that applies.
                      Each of these renders nothing when it has nothing to
                      say; the CSS shows the first wrapper that is not empty
                      and hides the rest, so a report waiting for approval
                      is never stacked on top of a setup card and a
                      programme suggestion at once. In priority order. */}
                  <div className="[&>*:empty]:hidden [&>:not(:empty)~*]:hidden">
                    <div><ReportApproval api={api} onDone={reload} /></div>
                    <div><RetentionReview api={api} onDone={reload} /></div>
                    <div>
                      {access?.ok && access.reason === "trial" && access.daysLeft != null && access.daysLeft <= 7 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-hc-element bg-hc-warn-surface px-3 py-2.5 text-sm text-hc-warn-ink ring-1 ring-hc-warn-ink/25">
                          <span>
                            {access.daysLeft === 0
                              ? "Prufutímabilið endar í dag."
                              : `${access.daysLeft} ${access.daysLeft === 1 ? "dagur" : "dagar"} eftir af prufutímabilinu.`}
                          </span>
                          <Link href="/app/adgangur#askrift" className="inline-flex min-h-11 items-center font-semibold underline">Sjá áskriftina</Link>
                        </div>
                      )}
                    </div>
                    <div>{plan && !walled && <NextStepCard api={api} entry={entry ?? null} />}</div>
                    <div>
                      {/* A suggested programme changes what the day's actions
                          ARE, so it is answered before the list, not after. */}
                      {plan && !walled && (
                        <SuggestedProgram api={api} onAccepted={() => {
                          cache.invalidate("/api/hc/plan", "/api/hc/my-plan", "/api/hc/actions", "/api/hc/training");
                          reload();
                        }} />
                      )}
                    </div>
                  </div>

                  {walled && paywall}

                  {!walled && plan && (
                    <>
                      <TodayOverview plan={plan} exercise={exercise} training={training}
                        onOpenExercise={(id) => setTab("exercise", id)} onEdit={() => setEditing(true)}
                        people={<PeopleButton onClick={() => setPeople(true)} done={doneCount} of={ofCount} />} />
                      {/* Only when something is today or tomorrow; the full
                          list lives behind the bell. Swiped away, it stays
                          away until tomorrow. */}
                      {!soonHidden && <UpcomingSoon items={upcoming} onDismiss={hideSoon} />}
                      <MyActions api={api} journeyId={data.journey_id} plan={plan}
                        onEditPillar={(pl) => { setEditPillar(pl); setEditing(true); }} logs={data.logs} prefs={data.prefs}
                        /* One library action appended server side, then the
                           page reloads so the new habit appears with
                           everything else. False tells the picker to stay
                           open: the add did not happen. */
                        onAddAction={async (key) => {
                          const r = await run(() => api("/api/hc/my-plan", { method: "POST", body: JSON.stringify({ add_key: key }) }),
                            { fail: "Ekki tókst að bæta venjunni við. Reyndu aftur." });
                          if (!r) return false;
                          cache.invalidate("/api/hc/plan", "/api/hc/my-plan", "/api/hc/actions");
                          reload();
                          toast.show("Venjunni var bætt við", { tone: "ok" });
                          return true;
                        }}
                        onOpenSession={(id) => setTab("exercise", id)}
                        meals={todayMeals}
                        links={{ exercise: plan.exercise ? () => setTab("exercise", exercise?.sessions.find((x) => x.weekday === ((new Date().getDay() + 6) % 7))?.id) : null, nutrition: plan.nutrition ? () => setTab("nutrition") : null, lecture: lectureFor }}
                        exercise={exercise} training={training} doneToday={doneToday} onLogs={setLiveLogs} onCounts={setLiveCounts}
                        onCompleteActivity={(a) => void finishWorkout({
                          minutes: a.minutes ?? 60, rpe: a.intensity === "hard" ? 7 : a.intensity === "easy" ? 3 : 5,
                          session: { id: a.id, title: a.name, modality: activityModality(a), weekday: a.day },
                        })} />
                    </>
                  )}

                  {/* No plan yet, and the server said so (a 200 with no
                      plan) — never shown for a failed load. */}
                  {!walled && !plan && coaching === undefined && <PlanSkeleton />}
                  {!walled && !plan && coaching === true && (
                    <div className="space-y-4">
                      <EmptyState variant="empty" title="Settu saman áætlunina þína"
                        body="Veldu venjur og æfingar úr safninu. Æfingarnar taka mið af því sem þú sagðir okkur, og þú getur breytt öllu síðar."
                        action={{ label: "Settu saman áætlunina þína", onClick: () => setEditing(true) }} />
                      <Link href="/app?ferd=1" className="flex min-h-11 items-center justify-center text-sm font-semibold text-hc-ink-2 underline">Sjá heilsuferðina</Link>
                    </div>
                  )}
                  {!walled && !plan && coaching === false && (
                    <div className="space-y-4">
                      {next && <AppointmentCard a={next} />}
                      <EmptyState variant="waiting" title="Áætlunin er ekki tilbúin enn"
                        body="Hún verður til í áætlunarsamtalinu með hjúkrunarfræðingi Lifeline. Þú getur líka sett skýrsluna þína inn og búið áætlunina til sjálf(ur)."
                        action={{ label: "Sjá heilsuferðina", href: "/app?ferd=1" }} />
                      <ReportUpload api={api} onDone={reload} />
                      <button type="button" onClick={() => setEditing(true)} className={`${hcBtn.secondary} w-full`}>Búa til áætlun sjálf(ur) án skýrslu</button>
                    </div>
                  )}
                </div>
              )}

              {/* ── Þjálfun ─────────────────────────────────────────── */}
              {tab === "coach" && (
                <div className="print:hidden">
                  {/* Keyed on the subpage so a link to ?sub=book opens on Bóka
                      even when the coach tab is already showing. */}
                  <CoachView key={`${coachSub}${coachMeasure ? "-maela" : ""}`} api={api} startOn={coachSub}
                    startChoice={coachMeasure ? "measurement" : undefined} focusNewest={coachFocus}
                    track={coaching === undefined ? undefined : coaching ? "app" : "care"} />
                  {/* Beiðnir, under the conversation: the things that need a
                      decision and an answer, tracked with a status, which a
                      message is not. HelpCard is the only writer of
                      /api/hc/requests. */}
                  <div className="mt-6">
                    <HelpCard api={api} portalUrl={portalFor(null)} />
                  </div>
                </div>
              )}

              {/* ── Æfingar ───────────────────────────────────────── */}
              {tab === "exercise" && walled && paywall}
              {tab === "exercise" && !walled && plan && baseExercise && (
                <div className="print:hidden">
                  {setup && isAdaptive(plan.exercise?.key) ? (
                    <TrainingWizard
                      settings={training} planStart={plan.start_date}
                      signals={reportSignalsBySlug} titles={reportTitlesBySlug} gym={gym} saving={saving}
                      /* Closed only once the save has landed: closing first
                         showed the old programme and then swapped it. */
                      onSave={async (next) => { if (await saveTraining(next)) { setSetup(false); toast.show("Æfingaáætlunin vistuð", { tone: "ok" }); } }}
                      onCancel={() => setSetup(false)} />
                  ) : (
                    <>
                      {isAdaptive(plan.exercise?.key) && (
                        <div className="mb-3 flex justify-end">
                          <button type="button" onClick={() => setSetup(true)} className={hcBtn.secondary}>
                            <SlidersHorizontal className="h-4 w-4" aria-hidden /> Stilla æfingar
                          </button>
                        </div>
                      )}
                      <TrainingView api={api} exercise={baseExercise} personal={personal}
                        onSave={(p) => void savePersonal(p, PERSONAL_FIELDS)}
                        training={training} planStart={plan.start_date}
                        onFinish={(info) => finishWorkout(info, false)} body={body}
                        onCompleteActivity={(a) => finishWorkout({
                          minutes: a.minutes ?? 60, rpe: a.intensity === "hard" ? 7 : a.intensity === "easy" ? 3 : 5,
                          session: { id: a.id, title: a.name, modality: activityModality(a), weekday: a.day },
                        })}
                        onSaveTraining={saveTraining}
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
                        // training day; the pins go with it, so the stored
                        // arrangement claims nothing that is not true.
                        onRemoveDay={(weekday) => {
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
                          // settings: it should change every session, not one.
                          injuries: inj?.length
                            ? Array.from(new Set([...(training.injuries ?? []), ...inj]))
                            : training.injuries,
                          activities: [...training.activities, { ...a, id: Math.random().toString(36).slice(2, 10) }],
                        })}
                        onInstead={(info) => void finishWorkout({
                          minutes: info.minutes, rpe: info.rpe,
                          session: { ...info.session, modality: info.modality, title: info.label },
                          instead: { prescribedTitle: info.session.title },
                        })}
                        />
                    </>
                  )}
                </div>
              )}

              {/* ── Næring ────────────────────────────────────────── */}
              {tab === "nutrition" && walled && paywall}
              {tab === "nutrition" && !walled && plan?.nutrition && (
                <div className="print:hidden">
                  {nutritionSetup ? (
                    <NutritionWizard prefs={nutritionPrefs} signals={reportSignalsBySlug} meals={mealLibrary} saving={saving}
                      onSave={async (next) => { if (await saveNutrition(next)) { setNutritionSetup(false); toast.show("Næringarstillingarnar vistaðar", { tone: "ok" }); } }}
                      onCancel={() => setNutritionSetup(false)} />
                  ) : (
                    <NutritionView api={api} nutrition={plan.nutrition} picks={personal.meal_picks}
                      prefs={nutritionPrefs} signals={reportSignalsBySlug} weightKg={weightKg}
                      todayMeals={todayMeals}
                      favourites={personal.meal_favourites ?? []}
                      onFavourite={(mealId, on) => {
                        const cur = personal.meal_favourites ?? [];
                        const nextFav = on ? [...new Set([...cur, mealId])] : cur.filter((x) => x !== mealId);
                        void savePersonal({ ...personal, meal_favourites: nextFav }, ["meal_favourites"]);
                      }}
                      onSelfWeight={async (kg) => {
                        const r = await run(() => api(`/api/hc/training${qs}`, { method: "POST", body: JSON.stringify({ self_weight_kg: kg }) }));
                        cache.invalidate("/api/hc/training");
                        const j = r ? await r.json().catch(() => ({})) : {};
                        if (r && j.body) { setSelfBody(j.body); toast.show("Þyngdin vistuð", { tone: "ok" }); }
                        else if (r) toast.show(SAVE_FAILED, { tone: "bad" });
                      }}
                      onPick={(slot, id) => {
                        const picks = { ...personal.meal_picks };
                        if (id) picks[slot] = id; else delete picks[slot];
                        void savePersonal({ ...personal, meal_picks: picks }, ["meal_picks"]);
                      }}
                      onCustomise={() => setNutritionSetup(true)}
                      onChangeProgram={() => setPicker(true)} />
                  )}
                </div>
              )}

              {/* ── Skýrslan og mælingar (from Ég) ────────────────── */}
              {tab === "report" && (
                <div className="space-y-4 print:hidden">
                  <h1 className="text-2xl font-bold text-hc-ink sm:text-3xl">Skýrslan og mælingar</h1>
                  <ReportApproval api={api} onDone={reload} />
                  <RetentionReview api={api} onDone={reload} />
                  {data.report && !plan && (
                    <div className={`${hcCard.hero} flex flex-wrap items-center gap-4 p-5`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-bold">Búðu til áætlunina þína</p>
                        <p className="text-sm text-emerald-100">
                          {coaching
                            ? "Tillögur byggðar á skýrslunni. Þú velur, raðar og breytir, og getur breytt henni hvenær sem er."
                            : "Tillögur byggðar á skýrslunni. Þú velur, raðar og breytir, og hjúkrunarfræðingurinn fer yfir hana með þér í áætlunarsamtalinu."}
                        </p>
                      </div>
                      <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center rounded-hc-element bg-hc-surface px-5 font-bold text-hc-hero-to hover:bg-hc-ok-surface">Byrja →</button>
                    </div>
                  )}
                  {/* Where the report came from, in the participant's own
                      account. Staff reading it is lawful under 9. gr. (2)(h)
                      without consent, but someone whose results were put
                      there by somebody else should be told so and have a way
                      to say it is wrong. */}
                  {data.report?.source && data.report.source !== "self" && (
                    <div className="flex flex-wrap items-center gap-2 rounded-hc-card bg-hc-sunken px-4 py-3 text-sm ring-1 ring-hc-hairline">
                      <Info className="h-4 w-4 shrink-0 text-hc-ink-3" aria-hidden />
                      <span className="text-hc-ink-2">
                        {data.report.source === "staff_on_behalf"
                          ? "Starfsmaður Lifeline setti þessa skýrslu inn að þinni beiðni."
                          : "Starfsmaður Lifeline setti þessa skýrslu inn fyrir áætlunarsamtalið þitt."}
                      </span>
                      <button type="button" onClick={() => setTab("coach")}
                        className="ml-auto inline-flex min-h-11 items-center rounded-full border border-hc-control bg-hc-surface px-4 text-sm font-semibold text-hc-ink-2 hover:bg-hc-sunken">
                        Þetta er ekki rétt
                      </button>
                    </div>
                  )}
                  {data.compare && <BeforeAfter c={data.compare} />}
                  {data.report && (
                    <>
                      <ReportView onUpload={scrollToUpload} report={data.report.report} signals={data.report.signals}
                        reference={data.report.reference} sex={data.report.sex} audience="client" />
                      <p className="px-1 text-xs leading-relaxed text-hc-ink-3">
                        {coaching
                          ? "Þetta er skýrslan þín í einfaldaðri mynd; fullbúna skýrslan er í sjúklingagáttinni. Spurningum um niðurstöðurnar svarar læknir, ekki þjálfari."
                          : "Þetta er heilsufarsskýrslan þín í einfaldaðri mynd. Fullbúna skýrslan er í sjúklingagáttinni og læknir fer yfir niðurstöðurnar með þér í læknisviðtalinu þar."}
                      </p>
                    </>
                  )}
                  {!data.report && <ResultSignals flagged={data.flagged} />}
                  {/* Measurements between reports: a home blood-pressure
                      reading, a weight. Written through /api/hc/results,
                      which marks them 'self' and never overwrites anything
                      measured at the station. */}
                  <ResultsCard api={api} journeyId={data.journey_id} sex={body.sex}
                    results={results ?? []} reportShown={!!data.report}
                    endpoint="/api/hc/results" audience="client"
                    onSaved={reload} />
                  {/* The one upload on this page; the report's own "Hlaða
                      upp" scrolls here. */}
                  <div id="ny-skyrsla" className="scroll-mt-24">
                    <ReportUpload api={api} onDone={reload}
                      heading={data.report ? "Ný skýrsla" : coaching ? "Áttu skýrslu úr heilsufarsskoðun?" : undefined}
                      blurb={data.report
                        ? (coaching
                          ? "Ertu með nýrri skýrslu úr heilsufarsskoðun hjá Lifeline? Settu hana inn og áætlunin tekur mið af nýju niðurstöðunum."
                          : "Komin(n) með nýja Grunnheilsu-skýrslu? Settu hana inn og áætlunin uppfærist eftir nýju niðurstöðunum.")
                        : coaching
                          ? "Ef þú hefur farið í heilsufarsskoðun hjá Lifeline getur þú sett Grunnheilsu-skýrsluna (PDF úr sjúklingagáttinni) hér inn. Þess þarf ekki til að nota appið."
                          : undefined} />
                  </div>
                </div>
              )}

              {plan && (
                <PlanView printOnly plan={exercise ? { ...plan, exercise: { ...exercise, sessions: exercise.sessions } } : plan} clientName={name} author={plan.created_by ?? null}
                  lectures={lectures} />
              )}
              {picker && plan && (
                <ProgramPicker api={api} kind="nutrition" current={plan.nutrition?.key ?? null}
                  onPick={(k) => void changeNutrition(k)} onClose={() => setPicker(false)} />
              )}
            </DayMealsProvider>
          )}
        </div>
      </div>
    </div>
  );
}
