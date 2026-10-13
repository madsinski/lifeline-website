"use client";

// The client's own action plan, as the coach sees it.
//
// This renders MyActions — the participant's component, unchanged — so the
// coach is looking at the same screen the client is, with the same
// hold-to-drag reordering. Building a second plan view for staff is how the
// two drift: the coach's PlanBuilder uses HTML5 drag, which never worked on
// a tablet, and it has been showing a different shape of the same plan.
//
// The trick that makes the reuse free is `coachApi`: MyActions posts to
// /api/hc/actions, which by design only ever means "my own journey". The
// wrapper rewrites that one path to the workstation's as-client route for
// this journey. The component does not know, which is the point — there is
// no staff branch inside it to get wrong.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, ShieldQuestion } from "lucide-react";
import MyActions from "./MyActions";
import NutritionView from "./NutritionView";
import TrainingView from "./TrainingView";
import EmptyState from "./EmptyState";
import { hcTabs } from "./ui";
import { DEFAULT_TRAINING, adaptExercise, hardDays, isAdaptive, type TrainingSettings } from "@/lib/hc/adaptive-program";
import { DEFAULT_PERSONAL, personalise, type Personal } from "@/lib/hc/personalise";
import { dayFor, type Meal } from "@/lib/hc/meals";
import { proteinTarget } from "@/lib/hc/nutrition-log";
import { DEFAULT_NUTRITION, type NutritionPrefs } from "@/lib/hc/nutrition";
import type { ActionLog, ActionPref } from "@/lib/hc/adherence";
import type { Signal as ReportSignal } from "@/lib/hc/grunnheilsa";
import type { ActionPlan } from "@/lib/hc/types";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/** What the coach may know about the client's consent — dates and flags. */
export interface ConsentState {
  has_report: boolean;
  on_behalf?: boolean;
  /** "self" | "staff" | "staff_on_behalf" */
  source?: string;
  imported_at?: string;
  client_confirmed_at?: string | null;
  confirmation_requested_at?: string | null;
  visible_to_client?: boolean;
  on_behalf_consent_at?: string | null;
}

interface Bundle {
  journey_id: string;
  plan: ActionPlan | null;
  logs: ActionLog[];
  prefs: ActionPref[];
  consent: ConsentState;
  /** The report, for the protein target and the planning lights. */
  report?: {
    report: { items: { slug?: string | null; key: string; title: string; value?: number | null }[] };
    signals?: Record<string, ReportSignal | null>;
    actionSignals?: Record<string, ReportSignal | null>;
    sex?: "m" | "f" | null;
  } | null;
}

/** What ?part=plan and ?part=training answer with. */
interface PlanPart { plan: (ActionPlan & { start_date?: string | null }) | null }
interface TrainingPart {
  settings?: TrainingSettings;
  personal?: Personal;
  nutrition?: NutritionPrefs;
  body?: { weight_kg: number | null; height_cm: number | null };
  gym?: { name: string | null; url: string | null; info: string | null } | null;
}

type CoachTab = "today" | "exercise" | "nutrition";

const day = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("is-IS", { day: "numeric", month: "long" }) : "";

/**
 * Where the client stands on their report, in one line.
 *
 * Staff read the report under Art. 9(2)(h) — care — and that is not gated on
 * the client agreeing to anything. What the client's confirmation governs is
 * their OWN copy: a report staff entered is held off their screens until
 * they confirm it came from where it says. So this banner exists to stop a
 * coach referring to results the client cannot actually see yet, which is
 * the real failure mode. Posture v1.15.
 */
export function ConsentBanner({ consent }: { consent: ConsentState }) {
  if (!consent.has_report) return null;

  /* Neither their own upload nor an on-behalf entry needs a confirmation,
     but they are different facts and the banner should not claim the wrong
     one. Saying "confirmed by the client" about a report nobody asked them
     to confirm would be false, even though the visibility is the same. */
  if (!consent.on_behalf) {
    const own = consent.source === "self";
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          {own
            ? "Skýrslan er þeirra eigin — þau sjá hana í appinu."
            : "Skýrsla úr heilsufarsskoðuninni — þau sjá hana í appinu."}
        </span>
      </p>
    );
  }

  if (consent.visible_to_client) {
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Staðfest af skjólstæðingi {day(consent.client_confirmed_at)} — þau sjá skýrsluna í appinu.
        </span>
      </p>
    );
  }

  return (
    <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        Skjólstæðingur hefur ekki staðfest skýrsluna sem var skráð fyrir þau
        {consent.imported_at ? ` ${day(consent.imported_at)}` : ""}.
        {" "}Þú getur notað hana í viðtalinu, en <strong>þau sjá hana ekki sjálf</strong> fyrr en þau staðfesta hana.
      </span>
    </p>
  );
}

export default function CoachAsClient({ api, journeyId, only }: {
  api: Api;
  journeyId: string;
  /**
   * Render one pillar instead of the tabbed set.
   *
   * The plan builder's Æfingar and Næring steps configure a programme and
   * had no way to show what it produces — the coach picked a template and
   * the meals or sessions it implied were only visible on another tab. With
   * `only` the same loader serves both: the builder embeds one pillar
   * beside its editor, and the workspace's Forskoðun keeps "Í dag", which
   * is the one view nothing configures.
   *
   * Reusing this rather than a third implementation of the same screens —
   * NutritionView and TrainingView already take everything as props, and
   * the arithmetic that feeds them (adaptExercise, personalise, dayFor, the
   * protein band) lives here once.
   */
  only?: CoachTab;
}) {
  const [d, setD] = useState<Bundle | null>(null);
  const [planPart, setPlanPart] = useState<PlanPart | null>(null);
  const [t, setT] = useState<TrainingPart | null>(null);
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [tabState, setTab] = useState<CoachTab>("today");
  const tab: CoachTab = only ?? tabState;
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const path = `/api/vinnustod/journeys/${journeyId}/as-client`;

  const load = useCallback(async () => {
    /* The same three the client's own page loads, plus the meal library. */
    const [a, pl, tr, lib] = await Promise.all([
      api(path).catch(() => null),
      api(`${path}?part=plan`).catch(() => null),
      api(`${path}?part=training`).catch(() => null),
      api("/api/hc/library?kind=meals").catch(() => null),
    ]);
    const body = a?.ok ? await a.json().catch(() => null) : null;
    const plBody = pl?.ok ? await pl.json().catch(() => null) : null;
    const trBody = tr?.ok ? await tr.json().catch(() => null) : null;
    const libBody = lib?.ok ? await lib.json().catch(() => null) : null;
    /* Deferred out of the effect's own tick, the way Caseload does it — the
       React Compiler lint rejects a setState reached synchronously from an
       effect, and this is the shape the rest of these screens use. */
    setTimeout(() => {
      if (!a?.ok || !body) { setErr(a?.status === 403 ? "forbidden" : "failed"); return; }
      setD(body);
      setPlanPart(plBody);
      setT(trBody);
      setMeals(libBody?.meals ?? null);
    }, 0);
  }, [api, path]);

  useEffect(() => { void load(); }, [load]);

  const training = t?.settings ?? DEFAULT_TRAINING;
  const personal = t?.personal ?? DEFAULT_PERSONAL;
  const nutritionPrefs = t?.nutrition ?? DEFAULT_NUTRITION;
  const plan = planPart?.plan ?? d?.plan ?? null;

  /* Exactly the client page's derivation: the programme as written (adaptive
     ones computed from the settings), then arranged their way. Same helpers,
     so the coach cannot be looking at a differently-computed week. */
  const baseExercise = plan?.exercise
    ? (isAdaptive(plan.exercise.key) ? adaptExercise(plan.exercise, training, planPart?.plan?.start_date ?? null) : plan.exercise)
    : null;
  const exercise = baseExercise
    ? personalise(baseExercise, personal, hardDays(training), training.days ?? [])
    : null;

  /* The planning light per domain, not the printed verdict — a domain with
     flagged components is a need even when its composite reads "Gott". */
  const signals = useMemo(() => {
    const out: Record<string, ReportSignal | null> = {};
    for (const item of d?.report?.report.items ?? []) {
      if (item.slug) out[item.slug] = d?.report?.actionSignals?.[item.key] ?? d?.report?.signals?.[item.key] ?? null;
    }
    return out;
  }, [d]);

  /*
   * The measured body data from the report — the shape TrainingView wants
   * for its weight suggestions.
   *
   * Kept separate from `weightKg` below on purpose, exactly as the client's
   * own page keeps them apart: a plate suggestion should rest on a figure a
   * nurse measured, while the protein target may fall back to one the
   * person typed, because that whole track exists for people who never have
   * the workup.
   */
  const body = useMemo(() => {
    const val = (slug: string) => {
      const row = (d?.report?.report.items ?? []).find((i) => i.slug === slug);
      return row && Number.isFinite(Number(row.value)) ? Number(row.value) : null;
    };
    return { weightKg: val("thyngd"), bodyFatPct: val("fitumassi"), sex: d?.report?.sex ?? null };
  }, [d]);
  const weightKg = body.weightKg ?? t?.body?.weight_kg ?? null;

  const todayMeals = useMemo(() => {
    const key = plan?.nutrition?.key ?? null;
    if (!meals || !key) return null;
    const band = proteinTarget(weightKg);
    const targetG = band ? Math.round((band.min + band.max) / 2) : null;
    const wd = (new Date().getDay() + 6) % 7;
    return dayFor(meals, key, personal.meal_picks ?? {}, nutritionPrefs, wd, targetG);
  }, [meals, plan?.nutrition?.key, personal.meal_picks, nutritionPrefs, weightKg]);

  /** Save the client's arrangement through the coach route. */
  const savePersonal = useCallback(async (next: Personal, fields: (keyof Personal)[]) => {
    setT((prev) => (prev ? { ...prev, personal: next } : prev));
    setSaving(true);
    const r = await api(`${path}?part=training`, {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(fields.map((f) => [f, next[f]]))),
    }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setSaving(false);
    /* The server's answer replaces the optimistic copy: it carries the
       library snapshots a swap needs, which the browser cannot invent. */
    if (j) setT((prev) => (prev ? { ...prev, ...j } : prev));
  }, [api, path]);

  /*
   * The reused components' own fetches, pointed at this journey.
   *
   * Three client endpoints are mapped to the as-client route. Everything
   * else under /api/hc/ is REFUSED rather than passed through, because
   * pass-through is the dangerous default here: those paths mean "the
   * signed-in user", and the signed-in user on this screen is the coach. A
   * component reaching one would quietly render the coach's own journey,
   * subscription or report inside a client's workspace, and look like it
   * worked.
   *
   * Only paths that are the same for everybody are let through, and they
   * are named. The meal library is the only one today.
   *
   * Matched on the path, not with startsWith: /api/hc/plan is a prefix of
   * /api/hc/plan-library and /api/hc/plans, and a loose rule would have
   * answered both of those with a single journey's plan.
   */
  const coachApi = useCallback<Api>((url, init) => {
    const [bare] = url.split("?");
    if (bare === "/api/hc/actions") return api(path, init);
    if (bare === "/api/hc/plan") return api(`${path}?part=plan`, init);
    if (bare === "/api/hc/training") return api(`${path}?part=training`, init);
    if (bare === "/api/hc/library") return api(url, init);
    if (bare.startsWith("/api/hc/")) {
      /* Loud, local, and never a request. Reaching here means a reused
         component has grown a call that has no coach equivalent yet; it
         needs mapping on the as-client route, not letting through. */
      return Promise.resolve(new Response(
        JSON.stringify({ error: "not_mapped_for_coach", path: bare }),
        { status: 501, headers: { "Content-Type": "application/json" } },
      ));
    }
    return api(url, init);
  }, [api, path]);

  if (err === "forbidden") {
    return <EmptyState variant="empty" title="Ekki í þínum umdæmum"
      body="Þessi heilsuferð er á starfsstöð sem þú hefur ekki aðgang að." />;
  }
  if (err) {
    return <EmptyState variant="empty" title="Gat ekki opnað áætlunina"
      body="Reyndu aftur. Ef þetta heldur áfram, hafðu samband við tækniþjónustu." />;
  }
  if (!d) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-hc-ink-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Hleð áætluninni…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Only standalone: inside a builder step this would repeat on every
          pillar, and the builder already says changes reach the client. */}
      {!only && <ConsentBanner consent={d.consent} />}

      {!plan ? (
        <EmptyState variant="waiting" title="Engin áætlun birt"
          body="Þegar áætlunin hefur verið birt sést hún hér eins og skjólstæðingurinn sér hana." />
      ) : (
        <>
          {/* Said once, plainly: what happens here lands on their screen. */}
          <p className={`px-1 text-xs text-hc-ink-2 ${only ? "hidden" : ""}`}>
            Þetta er áætlunin eins og skjólstæðingurinn sér hana. Breytingar sem þú gerir hér
            birtast hjá þeim og eru skráðar á þig.
          </p>

          {/* The client's own three tabs, in their order. Only the ones their
              plan actually has: a plan with no training should not offer the
              coach an Æfingar tab that opens on nothing.
              Hidden when the caller asked for one pillar — then the page
              around it is already the navigation. */}
          <div className={`${hcTabs.bar} ${only ? "hidden" : ""}`}>
            {([["today", "Í dag"], ["exercise", "Æfingar"], ["nutrition", "Næring"]] as const)
              .filter(([k]) => k === "today" || (k === "exercise" ? !!exercise : !!plan.nutrition))
              .map(([k, label]) => (
                <button key={k} type="button" onClick={() => setTab(k)}
                  aria-pressed={tab === k} className={hcTabs.tab(tab === k)}>
                  {label}
                </button>
              ))}
          </div>

          {tab === "today" && (
            <MyActions api={coachApi} journeyId={d.journey_id} plan={plan}
              logs={d.logs} prefs={d.prefs} meals={todayMeals}
              onLogs={(logs) => setD((x) => (x ? { ...x, logs } : x))} />
          )}

          {tab === "exercise" && exercise && (
            <TrainingView api={coachApi} exercise={exercise} personal={personal}
              planStart={planPart?.plan?.start_date ?? null}
              training={training} body={body}
              /* Their arrangement — days, HIIT split, swapped exercises —
                 saved through the coach route and audited to the coach. */
              onSave={(next) => void savePersonal(next, ["days", "hiit_split", "swaps", "drops", "extra"])} />
          )}

          {tab === "nutrition" && plan.nutrition && (
            <NutritionView api={coachApi} nutrition={plan.nutrition}
              picks={personal.meal_picks ?? {}} prefs={nutritionPrefs}
              signals={signals} weightKg={weightKg} todayMeals={todayMeals}
              favourites={personal.meal_favourites ?? []}
              onFavourite={(mealId, on) => {
                const cur = personal.meal_favourites ?? [];
                const next = on ? [...new Set([...cur, mealId])] : cur.filter((x) => x !== mealId);
                void savePersonal({ ...personal, meal_favourites: next }, ["meal_favourites"]);
              }}
              onPick={(slot, id) => {
                const picks = { ...(personal.meal_picks ?? {}) };
                if (id) picks[slot] = id; else delete picks[slot];
                void savePersonal({ ...personal, meal_picks: picks }, ["meal_picks"]);
              }} />
          )}

          {saving && (
            <p className="flex items-center gap-2 px-1 text-xs text-hc-ink-2">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Vistar…
            </p>
          )}
        </>
      )}
    </div>
  );
}
