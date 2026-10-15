"use client";

/*
 * Plays whatever the admin arranged — minus whatever is already answered.
 *
 * The composer at /admin/onboarding produces an ordered list of modules;
 * this renders them one at a time and records where somebody has got to.
 *
 * Three things it refuses to do:
 *
 *   It never blocks the app. No published flow, a failed fetch, an unknown
 *   module kind — each of those falls through to the app rather than to a
 *   blank screen.
 *
 *   It never silently loses an answer. Each answer is written when it is
 *   given, not batched at the end.
 *
 *   It never asks twice. /byrja already asked the route, the goal, the
 *   activity and the age, and the signup form took the terms. A published
 *   flow may predate all of that, so every step is checked against what is
 *   known (stepApplies) and skipped when it has nothing left to ask. The
 *   modules that only promised things nothing applied — pillars, summary,
 *   recommend — and the ones that linked out of onboarding and back into
 *   it — package, measurements, profile — are not shown at all any more.
 *
 * The coaching track's one real decision is the training screen: how much
 * you move and what needs sparing, written straight to hc_training_settings.
 * It is shown whether or not the published flow includes it, because without
 * it the programme starts on defaults nobody chose.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ExternalLink, Loader2 } from "lucide-react";
import { AGES, GOALS, MOVES, daysPerWeek, emphasis as emphasisText, type GoalKey, type MoveKey } from "@/lib/hc/start-flow";
import {
  isCoachingEntry, moduleDef, RETIRED_KINDS, stepApplies,
  type FlowContext, type FlowStep,
} from "@/lib/hc/onboarding-modules";
import type { Region } from "@/lib/hc/adaptive-program";
import { PUBLIC_PRIVACY_VERSION, PUBLIC_TERMS_VERSION } from "@/lib/public-pages-content";
import { supabase } from "@/lib/supabase";
import InstallGuide from "./InstallGuide";
import StepHeader from "./StepHeader";
import { hcBtn } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Flow { slug: string; name: string; steps: FlowStep[] }
interface Lecture { slug: string; title: string; subtitle: string | null; kind: string | null; article_md: string | null; video_url: string | null; duration_min: number | null }
/** One screen the person will actually see: a flow step, or the training screen. */
interface Screen { step: FlowStep; n: number }

/** What changes an exercise prescription. Multi-select, and "ekkert" is an
 *  explicit answer rather than an empty one. */
const LIMITS = [
  { key: "knee", label: "Hné" },
  { key: "back", label: "Bak" },
  { key: "shoulder", label: "Öxl" },
  { key: "hip", label: "Mjöðm" },
  { key: "heart", label: "Hjarta eða blóðþrýstingur" },
  { key: "pregnant", label: "Þungun" },
  { key: "other", label: "Annað" },
] as const;

const QUESTIONS = {
  goal: { title: "Hvað ertu að leita að?", hint: "Veldu það sem skiptir mestu núna.", options: GOALS },
  move: { title: "Hvað hreyfir þú þig mikið núna?", hint: "Við byrjum þar sem þú ert.", options: MOVES },
  age: { title: "Á hvaða aldri ertu?", hint: "Viðmiðin okkar eru aldursbundin.", options: AGES },
} as const;

const TRAINING_STEP: FlowStep = { id: "__training", kind: "training" };

/** Training days, Monday-first, spread out for the number of sessions. */
function daysFor(move?: MoveKey): number[] {
  const n = daysPerWeek(move);
  if (n <= 2) return [0, 3];
  if (n === 3) return [0, 2, 4];
  return [0, 1, 3, 5];
}

/**
 * The training settings the two answers produce.
 *
 * Only what the answers actually say: a knee, a back or a shoulder is a
 * region the programme already knows how to spare; a heart condition keeps
 * the hard intervals out until somebody says otherwise; a pregnancy starts
 * gently. Everything else — where they train, which days exactly — stays
 * on the defaults and is one tap away in the programme settings.
 */
function trainingFrom(move: MoveKey | undefined, limits: string[], goal?: GoalKey) {
  const injuries: Region[] = (["knee", "back", "shoulder"] as const).filter((r) => limits.includes(r));
  const cardio = limits.includes("heart") ? "limited" : limits.includes("pregnant") || move === "rarely" ? "easy" : "full";
  return {
    level: move === "often" || move === "daily" ? "active" : "beginner",
    load: 0,
    injuries,
    cardio,
    emphasis: goal === "strength" ? "strength" : "balanced",
    training_days: daysFor(move),
    /* Empty on purpose: sanitizeActivities is an allowlist, and an activity
       somebody did not enter themselves has no business in their week. */
    activities: [],
  };
}

export default function OnboardingPlayer({ api, onFinished, preview }: {
  api: Api;
  /** Called when the flow completes, so the app can reload and show itself. */
  onFinished: () => void;
  /**
   * Render an unsaved arrangement instead of the published one (the
   * composer's preview). Everything that writes is a no-op here, and
   * nothing is skipped — the admin is looking at what they built.
   */
  preview?: { steps: FlowStep[]; index: number };
}) {
  const [flow, setFlow] = useState<Flow | null | undefined>(undefined);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /* The answers as they stood on arrival. Skipping is decided from these,
     not from the live ones — otherwise answering a question would remove it
     from the list while you stand on it, and "back" could never reach it. */
  const [known, setKnown] = useState<Record<string, string>>({});
  const finished = useRef(false);
  const [ctx, setCtx] = useState<Omit<FlowContext, "answers"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [accept, setAccept] = useState(false);
  const [lecture, setLecture] = useState<Lecture | null>(null);

  useEffect(() => {
    if (preview) {
      const t = setTimeout(() => {
        setFlow({ slug: "preview", name: "Forskoðun", steps: preview.steps });
        setI(Math.min(preview.index, Math.max(preview.steps.length - 1, 0)));
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      const r = await api("/api/hc/onboarding").catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      /* Anything unexpected means "not my problem" — and it has to SAY so,
         not merely render nothing, or the parent waits on an empty screen. */
      if (!j || j.done) { setFlow(null); onFinished(); return; }
      const c = j.context ?? {};
      setCtx({
        entry: c.entry ?? null,
        termsAccepted: !!c.terms_accepted,
        trainingSaved: !!c.training_saved,
      });
      setAnswers(j.answers ?? {});
      setKnown(j.answers ?? {});
      /* No published flow is an empty one: the training screen does not
         wait for an admin to have published something. */
      setFlow(j.flow ?? { slug: "", name: "", steps: [] });
      setI(j.stepIndex ?? 0);
    }, 0);
    return () => clearTimeout(t);
  }, [api, onFinished, preview]);

  /* What will actually be shown, in order. */
  const screens: Screen[] = useMemo(() => {
    if (!flow) return [];
    if (preview) return flow.steps.map((step, n) => ({ step, n }));
    if (!ctx) return [];
    const full: FlowContext = { ...ctx, answers: known };
    const fromFlow = flow.steps.map((step, n) => ({ step, n })).filter((x) => stepApplies(x.step, full));
    const needsTraining = isCoachingEntry(ctx.entry) && !ctx.trainingSaved
      && !flow.steps.some((s) => s.kind === "training");
    /* First, because it is the decision the rest of the app is built on. */
    return needsTraining ? [{ step: TRAINING_STEP, n: -1 }, ...fromFlow] : fromFlow;
  }, [flow, ctx, known, preview]);

  /* Where we are: the synthetic training screen while it is unanswered,
     else the first remaining step at or after the saved position. */
  const at = useMemo(() => {
    if (preview) return screens.findIndex((x) => x.n === i);
    if (screens[0]?.n === -1) return 0;
    return screens.findIndex((x) => x.n >= i);
  }, [screens, i, preview]);
  const screen = at >= 0 ? screens[at] : undefined;

  const post = useCallback(async (payload: Record<string, unknown>) => {
    if (preview) return null;
    const r = await api("/api/hc/onboarding", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    return r?.ok ? await r.json().catch(() => null) : null;
  }, [api, preview]);

  const finish = useCallback(async () => {
    if (preview || finished.current) return;
    finished.current = true;
    if (flow?.slug) await post({ action: "done" });
    onFinished();
  }, [flow, post, onFinished, preview]);

  /* Nothing left to ask: say so to the server, and move on. */
  useEffect(() => {
    if (preview || flow === undefined || flow === null || !ctx) return;
    if (screen) return;
    const t = setTimeout(() => { void finish(); }, 0);
    return () => clearTimeout(t);
  }, [screen, flow, ctx, preview, finish]);

  /** Move to the screen after this one, by its position in the flow. */
  const next = useCallback(async () => {
    if (!flow || !screen) return;
    const after = screens.slice(at + 1).find((x) => x.n >= 0);
    if (preview) {
      if (after) setI(after.n);
      return;
    }
    if (!after) { setBusy(true); await finish(); setBusy(false); return; }
    setBusy(true);
    await post({ action: "goto", index: after.n });
    setBusy(false);
    setI(after.n);
  }, [flow, screen, screens, at, post, finish, preview]);

  const back = useCallback(async () => {
    const before = screens.slice(0, Math.max(at, 0)).reverse().find((x) => x.n >= 0);
    if (!before) return;
    setBusy(true);
    await post({ action: "goto", index: before.n });
    setBusy(false);
    setI(before.n);
  }, [screens, at, post]);

  /* Written as it is given. */
  const answer = useCallback(async (key: string, value: string) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    await post({ action: "answer", key, value });
  }, [post]);

  /* A lecture step needs its lecture, fetched when it is reached. */
  const step = screen?.step;
  useEffect(() => {
    if (step?.kind !== "lecture" || !step.lectureSlug) {
      const c = setTimeout(() => setLecture(null), 0);
      return () => clearTimeout(c);
    }
    const slug = step.lectureSlug;
    const t = setTimeout(async () => {
      const r = await api(`/api/hc/lectures/${encodeURIComponent(slug)}`).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) : null;
      setLecture(j?.lecture ?? j ?? null);
    }, 0);
    return () => clearTimeout(t);
  }, [api, step?.kind, step?.lectureSlug]);

  if (flow === undefined || (!preview && flow && !ctx)) {
    return <div className="grid min-h-[50vh] place-items-center text-sm text-hc-ink-2">Hleð…</div>;
  }
  if (flow === null || !step) {
    return <div className="grid min-h-[50vh] place-items-center text-sm text-hc-ink-2">Augnablik…</div>;
  }

  const def = moduleDef(step.kind);

  return (
    <div className="mx-auto max-w-xl pb-16">
      <StepHeader n={at + 1} total={screens.length} busy={busy}
        onBack={screens.slice(0, at).some((x) => x.n >= 0) ? () => void back() : undefined} />

      {step.kind === "training" && (
        <TrainingStart api={api} preview={!!preview} answers={answers}
          onSaved={async (move, limits) => {
            await answer("move", move);
            await answer("limits", limits.join(","));
            if (step.id === TRAINING_STEP.id) {
              setCtx((c) => (c ? { ...c, trainingSaved: true } : c));
            } else {
              await next();
            }
          }} />
      )}

      {step.kind === "question" && step.questionKey && (() => {
        const key = step.questionKey;
        const q = QUESTIONS[key];
        const chosen = answers[key];
        return (
          <section>
            <h1 className="text-2xl font-bold leading-tight text-hc-ink">{step.title || q.title}</h1>
            <p className="mt-1.5 text-sm text-hc-ink-2">{q.hint}</p>
            <div className="mt-5 space-y-2.5">
              {q.options.map((o: { key: string; label: string; hint?: string }) => (
                <button key={o.key} type="button" disabled={busy}
                  onClick={() => void (async () => { await answer(key, o.key); await next(); })()}
                  aria-pressed={chosen === o.key}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-hc-surface px-4 py-3 text-left transition ${
                    chosen === o.key ? "border-hc-brand-dark" : "border-transparent hover:border-hc-control"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-hc-ink">{o.label}</span>
                    {o.hint && <span className="mt-0.5 block text-xs text-hc-ink-3">{o.hint}</span>}
                  </span>
                  {chosen === o.key && <Check className="h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />}
                </button>
              ))}
            </div>
          </section>
        );
      })()}

      {step.kind === "consent" && (
        <section>
          <h1 className="text-2xl font-bold text-hc-ink">{step.title || "Skilmálar"}</h1>
          <p className="mt-1 text-sm leading-relaxed text-hc-ink-2">
            Áður en við vistum heilsufarsupplýsingar þarftu að samþykkja skilmálana.
          </p>
          <label className="mt-5 flex items-start gap-2.5 rounded-2xl bg-hc-surface p-4 shadow-sm">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-hc-control" />
            <span className="text-sm leading-snug text-hc-ink">
              Ég samþykki{" "}
              <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold underline">notkunarskilmála</a>{" "}og{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" className="font-semibold underline">persónuverndarstefnu</a>{" "}
              Lifeline Health ({PUBLIC_TERMS_VERSION}).
            </span>
          </label>
          <button type="button" disabled={!accept || busy}
            onClick={() => void (async () => {
              if (preview) return;
              /* Written the same way the signup form writes it: the view
                 that encrypts, the person's own session, the same version
                 string. */
              setBusy(true);
              const { data: s } = await supabase.auth.getSession();
              const uid = s.session?.user?.id;
              if (uid) {
                await supabase.from("clients_decrypted").update({
                  terms_accepted_at: new Date().toISOString(),
                  terms_version: `tos-${PUBLIC_TERMS_VERSION}+priv-${PUBLIC_PRIVACY_VERSION}`,
                }).eq("id", uid);
              }
              await answer("consent", "yes");
              setBusy(false);
              await next();
            })()}
            className={`${hcBtn.cta} mt-5 w-full`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Samþykkja
          </button>
        </section>
      )}

      {step.kind === "lecture" && (
        <section>
          <h1 className="text-2xl font-bold text-hc-ink">{step.title || lecture?.title || "Fræðsla"}</h1>
          {lecture?.subtitle && <p className="mt-1 text-sm text-hc-ink-2">{lecture.subtitle}</p>}
          {lecture ? (
            <div className="mt-4 rounded-2xl bg-hc-surface p-4 shadow-sm">
              {lecture.video_url && (
                <a href={lecture.video_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-hc-brand-text underline">
                  Horfa á myndbandið <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
              {lecture.article_md && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-hc-ink-2">
                  {lecture.article_md.slice(0, 1200)}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-hc-ink-3">Hleð…</p>
          )}
        </section>
      )}

      {step.kind === "install" && (
        <section>
          <h1 className="text-2xl font-bold text-hc-ink">{step.title || "Settu appið á heimaskjáinn"}</h1>
          <div className="mt-4"><InstallGuide /></div>
        </section>
      )}

      {/* Only the composer's preview ever reaches these: the app skips them.
          Saying so beats rendering a screen nobody will see as if it were
          live. */}
      {(RETIRED_KINDS.includes(step.kind) || !def) && (
        <section>
          <h1 className="text-2xl font-bold text-hc-ink">{step.title || def?.label || step.kind}</h1>
          <p className="mt-2 rounded-xl bg-hc-sunken px-3 py-2 text-sm text-hc-ink-2">
            Þessu skrefi er sleppt í appinu: um það er spurt við nýskráningu, eða það á heima annars staðar.
          </p>
        </section>
      )}

      {/* The screens that do not move on by themselves get one button. */}
      {(step.kind === "lecture" || step.kind === "install" || RETIRED_KINDS.includes(step.kind) || !def) && (
        <button type="button" onClick={() => void next()} disabled={busy}
          className={`${hcBtn.cta} mt-6 w-full`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Áfram <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      )}
      {step.skippable && step.kind !== "lecture" && step.kind !== "install" && (
        <button type="button" onClick={() => void next()} disabled={busy}
          className="mt-2 w-full py-2 text-center text-sm font-semibold text-hc-ink-3 underline">
          Sleppa í bili
        </button>
      )}
    </div>
  );
}

/**
 * "Hreyfing og það sem þarf að varast": the coaching track's one decision.
 *
 * Two answers on one screen, both of which the programme uses: how much you
 * move now sets the number of sessions and the level, and what needs
 * sparing swaps exercises out. Saved through POST /api/hc/training, the
 * same path the programme settings use, so the setup wizard on the plan
 * page does not open again asking the same thing.
 */
function TrainingStart({ api, preview, answers, onSaved }: {
  api: Api;
  preview: boolean;
  answers: Record<string, string>;
  onSaved: (move: MoveKey, limits: string[]) => Promise<void>;
}) {
  const [move, setMove] = useState<MoveKey | undefined>(answers.move as MoveKey | undefined);
  const [limits, setLimits] = useState<string[]>(() => (answers.limits ?? "").split(",").filter(Boolean));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const toggle = (k: string) => setLimits((cur) =>
    k === "none" ? ["none"]
      : cur.includes(k) ? cur.filter((x) => x !== k && x !== "none")
      : [...cur.filter((x) => x !== "none"), k]);

  const save = async () => {
    if (!move || !limits.length || preview) return;
    setBusy(true); setErr("");
    const r = await api("/api/hc/training", {
      method: "POST",
      body: JSON.stringify(trainingFrom(move, limits, answers.goal as GoalKey | undefined)),
    }).catch(() => null);
    if (!r?.ok) { setBusy(false); setErr("Tókst ekki að vista. Reyndu aftur."); return; }
    await onSaved(move, limits);
    setBusy(false);
  };

  const chip = (on: boolean) =>
    `min-h-11 rounded-hc-element border-2 px-3.5 text-sm font-semibold transition ${
      on ? "border-hc-brand-dark bg-hc-ok-surface text-hc-ok-ink" : "border-transparent bg-hc-surface text-hc-ink-2 hover:border-hc-control"}`;

  return (
    <section>
      <h1 className="text-2xl font-bold leading-tight text-hc-ink">Hreyfing og það sem þarf að varast</h1>
      <p className="mt-1.5 text-sm text-hc-ink-2">Æfingarnar þínar eru byggðar á þessum tveimur svörum.</p>

      <h2 className="mt-6 text-sm font-bold text-hc-ink">Hvað hreyfir þú þig mikið núna?</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {MOVES.map((m) => (
          <button key={m.key} type="button" aria-pressed={move === m.key} onClick={() => setMove(m.key)} className={chip(move === m.key)}>
            {m.label}
          </button>
        ))}
      </div>
      {move && (
        <p className="mt-2 text-xs text-hc-ink-3">
          {daysPerWeek(move)} æfingar á viku til að byrja með
          {answers.goal ? ` · áhersla á ${emphasisText(answers.goal as GoalKey)}` : ""}.
        </p>
      )}

      <h2 className="mt-6 text-sm font-bold text-hc-ink">Þarf að hlífa einhverju?</h2>
      <p className="text-xs text-hc-ink-3">Veldu allt sem á við. Æfingum sem reyna á það er skipt út.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {LIMITS.map((l) => (
          <button key={l.key} type="button" aria-pressed={limits.includes(l.key)} onClick={() => toggle(l.key)} className={chip(limits.includes(l.key))}>
            {l.label}
          </button>
        ))}
        <button type="button" aria-pressed={limits.includes("none")} onClick={() => toggle("none")} className={chip(limits.includes("none"))}>
          Nei, ekkert
        </button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-hc-ink-3">
        Þetta er ekki sjúkraskrá. Ef eitthvað er bráðatilfelli, hringdu í 112.
      </p>

      {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
      <button type="button" onClick={() => void save()} disabled={busy || !move || !limits.length}
        className={`${hcBtn.cta} mt-6 w-full`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Áfram <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
      <p className="mt-2 text-center text-xs text-hc-ink-3">Þú getur breytt þessu hvenær sem er í æfingastillingunum.</p>
    </section>
  );
}
