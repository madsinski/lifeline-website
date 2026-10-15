"use client";

// Action-plan builder: start from a scenario template, drag action modules
// in and out per pillar (sleep / exercise / nutrition / mental), write
// personal notes, pick and adjust an exercise and a nutrition template,
// preview exactly what the customer sees, publish.
//
// Used in the nurse workstation (/vinnustod, cookie auth) and in
// /admin/coach/plans (Bearer auth) — the caller passes `api`, a fetch
// wrapper that adds its own credentials.

import PillarIcon from "./PillarIcon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, GripVertical, Loader2, Plus, X } from "lucide-react";
import { useDialog } from "@/app/components/account/ui/Modal";
import StepDot from "./StepDot";
import { badgeClass } from "./Badge";
import { hcBtn, hcCard, hcInput } from "./ui";
import PlanView from "./PlanView";
import TrainingControls from "./TrainingControls";
import { DEFAULT_TRAINING, isAdaptive, type TrainingSettings } from "@/lib/hc/adaptive-program";
import ExerciseSessionsEditor from "./ExerciseSessionsEditor";
import CoachAsClient from "./CoachAsClient";
import DayExampleEditor from "./DayExampleEditor";
import CoachMealWeek from "./CoachMealWeek";
import AiProposalPanel, { type ProposedAction } from "./AiProposalPanel";
import { bangScore, byScore, scoreBand, timeCost, GRADE_IS, type Rated } from "@/lib/hc/rating";
import { byFit, fitOf } from "@/lib/hc/fit";
import type { Signal } from "@/lib/hc/grunnheilsa";
import FitMeter from "./FitMeter";
import {
  PILLARS, PILLAR_META,
  type ActionPlan, type ExerciseTemplate, type NutritionTemplate, type Pillar, type PlanGoal,
  type PlanItem, type PlanLibrary, type PlanModule, type ExerciseSession } from "@/lib/hc/types";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

type Draft = {
  template_key: string | null;
  headline: string;
  summary: string;
  goals: PlanGoal[];
  modules: PlanItem[];
  exercise: ActionPlan["exercise"];
  nutrition: ActionPlan["nutrition"];
  nurse_note: string;
  lecture_slugs: string[];
  start_date: string;
  review_date: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const plus = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

function fromModule(m: PlanModule): PlanItem {
  return { uid: uid(), key: m.key, pillar: m.pillar, title: m.title, summary: m.summary, details: m.details, frequency: m.frequency, note: null };
}
const stripActive = <T extends { active: boolean }>(t: T): Omit<T, "active"> => {
  const { active: _a, ...rest } = t;
  void _a;
  return rest;
};

/** A small text action that still has a 44px hit area. */
const smallAction = (ink = "text-hc-ink-2") =>
  `inline-flex min-h-11 shrink-0 items-center gap-1 rounded-hc-element px-2 text-xs font-semibold ${ink} transition hover:bg-hc-sunken-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand`;

/*
 * A pillar's tint as CSS variables, not PILLAR_META's hex.
 *
 * The hex soft backgrounds are light-theme colours, so in the dark
 * workstation a library card was a pale block with light ink on it. The
 * --hc-<pillar>-soft tokens change with the theme; the edge mixes the
 * pillar colour toward transparent so it reads as the same family on both.
 */
const pillarEdge = (p: Pillar) => `color-mix(in srgb, var(--hc-${p}) 55%, transparent)`;
const pillarSurface = (p: Pillar): React.CSSProperties => ({ borderColor: pillarEdge(p), background: `var(--hc-${p}-soft)` });

/**
 * "Mest fyrir minnst", on the action itself.
 *
 * The score is one number so the list can be sorted by it, but the three
 * things behind it are shown too — an action can score well for very
 * different reasons, and a nurse choosing between two of them needs to know
 * whether she is buying effect or convenience. The evidence letter is never
 * dressed up: a C says C.
 */
function Rating({ m }: { m: Rated }) {
  const score = bangScore(m);
  if (score == null) return null;
  const band = scoreBand(score);
  const time = timeCost(m.minutes_per_week);
  const grade = m.evidence_grade ? GRADE_IS[m.evidence_grade] : null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${band.className}`} title={band.label}>
        {String(score).replace(".", ",")}
      </span>
      <span className="text-[11px] text-hc-ink-2">
        áhrif {m.effect} · auðvelt {m.ease}
      </span>
      {grade && (
        <span className={`rounded px-1 text-[11px] font-bold ${grade.className}`} title={m.evidence_note ?? grade.hint}>
          {grade.label}
        </span>
      )}
      {time && <span className="text-[11px] text-hc-ink-3">{time}</span>}
    </div>
  );
}

/**
 * The plan in five steps rather than one page.
 *
 * With a proposal applied the builder ran to several screens: the AI panel,
 * the action library beside four pillars, the exercise programme, the
 * nutrition programme and the closing note, all stacked. You could not see
 * what you were doing without scrolling past what you had already done.
 */
/* "Fræðsla", not "Frágangur": the step is the lecture picker plus publish,
   and what a coach is choosing there is what the client will be taught. */
const WIZARD_STEPS = ["Tillaga", "Aðgerðir", "Æfingar", "Næring", "Fræðsla"] as const;

function WizardNav({ step, onGo }: { step: number; onGo: (n: number) => void }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-hc-element bg-hc-surface p-1 ring-1 ring-hc-hairline" aria-label="Skref áætlunarinnar">
      {WIZARD_STEPS.map((label, i) => (
        <button key={label} type="button" onClick={() => onGo(i)} aria-current={step === i ? "step" : undefined}
          className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${
            step === i ? "bg-hc-brand-dark text-white" : "text-hc-ink-2 hover:bg-hc-sunken"}`}>
          {step === i
            /* On the brand-dark tab itself: a white disc with brand ink. */
            ? <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-hc-brand-dark">{i + 1}</span>
            : <StepDot size="sm" state={i < step ? "done" : "todo"} n={i + 1} />}
          {label}
        </button>
      ))}
    </nav>
  );
}

function WizardFooter({ step, onGo }: { step: number; onGo: (n: number) => void }) {
  const last = WIZARD_STEPS.length - 1;
  const next = step < last ? WIZARD_STEPS[step + 1] : null;
  return (
    <div className="flex items-center gap-2 border-t border-hc-hairline pt-3">
      <button type="button" disabled={step === 0} onClick={() => onGo(step - 1)}
        className={hcBtn.secondary}>
        <ArrowLeft className="h-4 w-4" aria-hidden /> Til baka
      </button>
      <span className="flex-1 text-center text-xs text-hc-ink-3">Skref {step + 1} af {WIZARD_STEPS.length}</span>
      {/* The button says where it goes. "Næsta" makes you guess; "Næsta:
          Æfingar" does not, and that is the whole job of this control. */}
      {next ? (
        <button type="button" onClick={() => onGo(step + 1)}
          className={hcBtn.primary}>
          Næsta: {next} <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <span className="px-4 py-2 text-xs text-hc-ink-3">Síðasta skrefið</span>
      )}
    </div>
  );
}

export default function PlanBuilder({ journeyId, api, onPublished, seed, readyProposal }: {
  /** A proposal already computed in the background at import time. */
  readyProposal?: React.ComponentProps<typeof AiProposalPanel>["ready"];
  journeyId: string;
  api: Api;
  onPublished?: () => void;
  /** Prefill for a brand-new plan (from the nurse's interview notes). */
  seed?: { headline?: string; summary?: string; goals?: PlanGoal[] };
}) {
  const [lib, setLib] = useState<PlanLibrary | null>(null);
  // This client's traffic lights by hc_knowledge slug, so the library can be
  // ranked by what they actually need — the same score they see themselves.
  const [signals, setSignals] = useState<Record<string, Signal | null>>({});
  /** Measured kilos from the report, for the 1,6–2,0 g/kg protein band. */
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [markerTitles, setMarkerTitles] = useState<Record<string, string>>({});
  const hasSignals = Object.keys(signals).length > 0;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [printAfter, setPrintAfter] = useState(false);
  const [status, setStatus] = useState<"draft" | "published" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [filter, setFilter] = useState<Pillar | "all">("all");
  const [search, setSearch] = useState("");
  /** Which action's editor is open. One at a time, so a column stays short. */
  const [openItem, setOpenItem] = useState<string | null>(null);
  /** The template picker and the publish controls, folded away by default. */
  const [tools, setTools] = useState(false);
  const [preview, setPreview] = useState(false);
  // The preview shows the adaptive programme with the participant's own settings.
  const [previewTraining, setPreviewTraining] = useState<TrainingSettings | null>(null);
  const adaptiveKey = draft?.exercise?.key;
  useEffect(() => {
    if (!preview || !isAdaptive(adaptiveKey)) return;
    (async () => {
      const r = await api(`/api/vinnustod/journeys/${journeyId}/training`);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.settings) setPreviewTraining(j.settings);
    })();
  }, [preview, adaptiveKey, api, journeyId]);
  const [step, setStep] = useState(0);
  const dialog = useDialog();
  const [dragOver, setDragOver] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [l, p] = await Promise.all([api("/api/hc/plan-library"), api(`/api/hc/plans/${journeyId}`)]);
      if (!l.ok || !p.ok) { setMsg({ tone: "err", text: "Gat ekki sótt áætlun eða safn." }); return; }
      const library = (await l.json()) as PlanLibrary;
      const pj = await p.json();
      setLib(library);
      setClientName(pj.client?.full_name ?? null);
      setSignals(pj.signals ?? {});
      setWeightKg(typeof pj.weight_kg === "number" ? pj.weight_kg : null);
      setMarkerTitles(pj.marker_titles ?? {});
      setAuthor(pj.plan?.created_by ?? pj.actor ?? null);
      const plan = pj.plan as ActionPlan | null;
      setStatus(plan?.status ?? null);
      setDraft(plan ? {
        template_key: plan.template_key,
        headline: plan.headline ?? "",
        summary: plan.summary ?? "",
        goals: plan.goals ?? [],
        modules: plan.modules ?? [],
        exercise: plan.exercise,
        nutrition: plan.nutrition,
        nurse_note: plan.nurse_note ?? "",
        lecture_slugs: plan.lecture_slugs ?? [],
        start_date: plan.start_date ?? today(),
        review_date: plan.review_date ?? plus(91),
      } : {
        template_key: null, headline: seed?.headline ?? "", summary: seed?.summary ?? "", goals: seed?.goals ?? [], modules: [], exercise: null, nutrition: null,
        nurse_note: "", lecture_slugs: [], start_date: today(), review_date: plus(91),
      });
      if (!plan && (seed?.summary || seed?.goals?.length)) setDirty(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- seed is only read for a brand-new plan on first load
  }, [api, journeyId]);

  const update = useCallback((patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  }, []);

  /** Drop the picked proposal into the draft: library actions keep their
   *  library copy, new ones come in as written, and the rationale rides
   *  along as the personal note. */
  const applyProposal = (actions: ProposedAction[], headline: string, summary: string) => {
    if (!draft) return;
    const items: PlanItem[] = actions.map((a) => {
      const fromLib = a.module_key ? lib?.modules.find((m) => m.key === a.module_key) : undefined;
      return fromLib
        ? { ...fromModule(fromLib), frequency: a.frequency || fromLib.frequency, note: a.why || null, source: a.source ?? null }
        : { uid: uid(), key: null, pillar: a.pillar, title: a.title, summary: a.detail, details: null, frequency: a.frequency || null, note: a.why || null, source: a.source ?? null };
    });
    const have = new Set(draft.modules.map((m) => `${m.pillar}:${m.title}`));
    update({
      headline: draft.headline || headline,
      summary: draft.summary || summary,
      modules: [...draft.modules, ...items.filter((i) => !have.has(`${i.pillar}:${i.title}`))],
    });
    // Applying the proposal is the end of that step; the actions it just put
    // in the plan are on the next one.
    setStep(1);
  };

  const applyTemplate = async (key: string) => {
    if (!lib || !draft) return;
    const t = lib.templates.find((x) => x.key === key);
    if (!t) return;
    /* Styled inside a <DialogProvider>; outside one useDialog() falls back
       to the native confirm, so the question is never skipped. */
    if (draft.modules.length && !(await dialog.confirm({
      title: "Skipta út núverandi aðgerðum?",
      body: "Aðgerðirnar sem eru í áætluninni núna víkja fyrir sniðmátinu.",
      confirmLabel: "Skipta út",
      tone: "danger",
    }))) return;
    const mods = t.module_keys.map((k) => lib.modules.find((m) => m.key === k)).filter((m): m is PlanModule => !!m);
    const ex = lib.exercise.find((e) => e.key === t.exercise_template_key);
    const nu = lib.nutrition.find((n) => n.key === t.nutrition_template_key);
    update({
      template_key: t.key,
      headline: draft.headline || t.name,
      modules: mods.map(fromModule),
      exercise: ex ? stripActive(ex) : draft.exercise,
      nutrition: nu ? stripActive(nu) : draft.nutrition,
      lecture_slugs: t.lecture_slugs?.length ? t.lecture_slugs : draft.lecture_slugs,
    });
  };

  const addModule = (key: string, beforeUid?: string) => {
    if (!lib || !draft) return;
    const m = lib.modules.find((x) => x.key === key);
    if (!m) return;
    const item = fromModule(m);
    const list = [...draft.modules];
    const at = beforeUid ? list.findIndex((x) => x.uid === beforeUid) : -1;
    if (at >= 0) list.splice(at, 0, item); else list.push(item);
    update({ modules: list });
  };
  const moveItem = (fromUid: string, beforeUid: string | null, pillar: Pillar) => {
    if (!draft) return;
    const list = [...draft.modules];
    const from = list.findIndex((x) => x.uid === fromUid);
    if (from < 0) return;
    const [item] = list.splice(from, 1);
    // Library modules keep their pillar; a custom item can be moved across.
    const moved = item.key ? item : { ...item, pillar };
    const at = beforeUid ? list.findIndex((x) => x.uid === beforeUid) : -1;
    if (at >= 0) list.splice(at, 0, moved); else list.push(moved);
    update({ modules: list });
  };
  const removeItem = (u: string) => draft && update({ modules: draft.modules.filter((m) => m.uid !== u) });
  const patchItem = (u: string, patch: Partial<PlanItem>) =>
    draft && update({ modules: draft.modules.map((m) => (m.uid === u ? { ...m, ...patch } : m)) });
  const addCustom = (pillar: Pillar) =>
    draft && update({ modules: [...draft.modules, { uid: uid(), key: null, pillar, title: "Ný aðgerð", summary: "", details: null, frequency: null, note: null }] });

  /*
   * Dragging with a finger.
   *
   * The builder's drag is HTML5 draggable, which no touch browser fires at
   * all — so on an iPad the handle did nothing and a plan could only be
   * rearranged with a mouse. Rather than replace a working desktop
   * interaction, this is a second path for pointer types that are not a
   * mouse: it captures the pointer on the handle, tracks it, and on release
   * asks the document what is under the finger and calls the same
   * moveItem() the drop handler calls.
   *
   * Capture on the handle means every move event comes back to it, so no
   * other row needs a listener and nothing competes for the gesture.
   */
  const [carry, setCarry] = useState<{ uid: string; x: number; y: number } | null>(null);

  /** The pillar section and the row under a point, from the DOM. */
  const targetAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y);
    const section = el?.closest<HTMLElement>("[data-pillar]");
    const pillar = section?.dataset.pillar as Pillar | undefined;
    const row = el?.closest<HTMLElement>("[data-uid]");
    return { pillar, beforeUid: row?.dataset.uid ?? null };
  };

  const carryStart = (uid: string) => (e: React.PointerEvent) => {
    /* Mouse keeps the native drag, which already works and gives the
       browser's own drag image. */
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setCarry({ uid, x: e.clientX, y: e.clientY });
  };

  const carryMove = (e: React.PointerEvent) => {
    if (!carry) return;
    setCarry({ ...carry, x: e.clientX, y: e.clientY });
    /* Reuse the same highlight the mouse drag sets, so both look alike. */
    setDragOver(targetAt(e.clientX, e.clientY).pillar ?? null);
  };

  const carryEnd = (e: React.PointerEvent) => {
    if (!carry) return;
    const { pillar, beforeUid } = targetAt(e.clientX, e.clientY);
    const uid = carry.uid;
    setCarry(null);
    setDragOver(null);
    if (pillar && beforeUid !== uid) moveItem(uid, beforeUid, pillar);
  };

  const onDrop = (e: React.DragEvent, pillar: Pillar, beforeUid: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    try {
      const d = JSON.parse(e.dataTransfer.getData("text/plain")) as { t: "lib" | "plan"; k: string };
      if (d.t === "lib") addModule(d.k, beforeUid ?? undefined);
      else if (d.k !== beforeUid) moveItem(d.k, beforeUid, pillar);
    } catch { /* not ours */ }
  };
  const onDropOut = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    try {
      const d = JSON.parse(e.dataTransfer.getData("text/plain")) as { t: string; k: string };
      if (d.t === "plan") removeItem(d.k);
    } catch { /* not ours */ }
  };

  const save = async (quiet = false): Promise<boolean> => {
    if (!draft) return false;
    if (!quiet) { setBusy(true); setMsg(null); }
    const r = await api(`/api/hc/plans/${journeyId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    if (!quiet) setBusy(false);
    if (!r.ok) { setMsg({ tone: "err", text: (await r.json().catch(() => ({}))).error || "Vistun mistókst." }); return false; }
    const j = await r.json();
    setStatus(j.plan?.status ?? "draft");
    setDirty(false);
    setMsg({ tone: "ok", text: quiet ? "Drög vistuð sjálfkrafa." : "Drög vistuð." });
    return true;
  };
  // Autosave a draft a moment after the last change: a live interview is no
  // place to lose work. A published plan is what the client sees, so edits
  // to it still wait for "Uppfæra birta áætlun".
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!dirty || status === "published") return;
    const t = setTimeout(() => void saveRef.current(true), 2500);
    return () => clearTimeout(t);
  }, [draft, dirty, status]);
  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const publish = async () => {
    if (!(await save())) return;
    setBusy(true);
    const r = await api(`/api/hc/plans/${journeyId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish" }) });
    setBusy(false);
    if (!r.ok) { setMsg({ tone: "err", text: (await r.json().catch(() => ({}))).error || "Birting mistókst." }); return; }
    setStatus("published");
    setMsg({ tone: "ok", text: "Áætlunin er birt á aðgangi skjólstæðings og tölvupóstur sendur." });
    onPublished?.();
  };

  const libModules = useMemo(() => {
    if (!lib) return [];
    const q = search.trim().toLowerCase();
    // Ranked by what suits THIS client — the need their report shows for what
    // each action targets, weighed with "mest fyrir minnst" — rather than by
    // hand-set order. Falls back to the generic score before a report exists.
    return lib.modules
      .filter((m) =>
        (filter === "all" || m.pillar === filter) &&
        (!q || m.title.toLowerCase().includes(q) || m.summary.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q))))
      .sort(hasSignals ? byFit(signals) : byScore);
  }, [lib, filter, search, signals, hasSignals]);

  // "Prenta": render the preview (which holds the print layout), then print.
  useEffect(() => {
    if (!preview || !printAfter) return;
    const t = setTimeout(() => { window.print(); setPrintAfter(false); }, 300);
    return () => clearTimeout(t);
  }, [preview, printAfter]);

  if (!draft || !lib) {
    return <div className={`${hcCard.base} p-8 text-center text-sm text-hc-ink-2`}>{msg?.text ?? "Hleð áætlun…"}</div>;
  }

  if (preview) {
    const asPlan: ActionPlan = {
      id: "preview", journey_id: journeyId, client_id: "", template_key: draft.template_key,
      headline: draft.headline || null, summary: draft.summary || null, goals: draft.goals, modules: draft.modules,
      exercise: draft.exercise, nutrition: draft.nutrition, nurse_note: draft.nurse_note || null,
      lecture_slugs: draft.lecture_slugs, start_date: draft.start_date, review_date: draft.review_date, status: "draft", published_at: null, version: 1, updated_at: "",
    };
    return (
      <div>
        <div className="mb-4 flex items-center justify-between gap-3 rounded-hc-card bg-hc-warn-surface px-4 py-3 text-sm text-hc-warn-ink print:hidden">
          <span>Forskoðun: svona sér skjólstæðingurinn áætlunina.</span>
          <button type="button" onClick={() => setPreview(false)} className={`${hcBtn.secondary} shrink-0`}><ArrowLeft className="h-4 w-4" aria-hidden />Til baka í ritil</button>
        </div>
        <PlanView plan={asPlan} clientName={clientName} author={author}
          lectures={draft.lecture_slugs.map((k) => lib.lectures?.find((l) => l.slug === k)).filter((l): l is NonNullable<typeof l> => !!l)}
          training={previewTraining ? { settings: previewTraining } : undefined} />
      </div>
    );
  }

  const goalFor = (p: Pillar) => draft.goals.find((g) => g.pillar === p)?.text ?? "";
  const setGoal = (p: Pillar, text: string) =>
    update({ goals: [...draft.goals.filter((g) => g.pillar !== p), ...(text.trim() ? [{ pillar: p, text }] : [])] });

  return (
    <div className="space-y-4">
      {/* The five steps first.
          The top bar used to come before them: the client's name, the
          status, a template picker, Forskoða, Prenta, Vista drög and Birta
          — eight controls, most of them for finishing a plan rather than
          building one, standing between the coach and the step they came to
          work on. Mads' call to put the steps first and the rest away.

          Nothing is lost: Forskoða, Vista drög and Birta all appear again in
          step 5, Fræðsla, which is where finishing belongs. */}
      <WizardNav step={step} onGo={setStep} />

      {/* Status stays visible — it is information, not a control, and a
          coach needs to know whether what they are looking at is live.
          Everything that acts goes behind the disclosure. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={badgeClass(status === "published" ? "ok" : "neutral", "md")}>
          {status === "published" ? (dirty ? "Birt · óvistaðar breytingar" : "Birt") : dirty ? "Óvistað" : status === "draft" ? "Drög" : "Ný"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-hc-ink-2">{clientName || "Skjólstæðingur"}</span>
        <button type="button" onClick={() => setTools((v) => !v)} aria-expanded={tools}
          className={smallAction()}>
          Sniðmát og útgáfa <ChevronDown className={`h-4 w-4 transition ${tools ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>

      {tools && (
        <div className="flex flex-wrap items-center gap-2 rounded-hc-card bg-hc-sunken p-3 ring-1 ring-hc-hairline">
          <select
            value=""
            onChange={(e) => { if (e.target.value) void applyTemplate(e.target.value); }}
            className={`${hcInput.replace("w-full", "w-auto")} min-h-11 shrink-0`}
            aria-label="Byrja út frá sniðmáti"
          >
            <option value="">Byrja út frá sniðmáti…</option>
            {lib.templates.map((t) => <option key={t.key} value={t.key}>{t.name}{t.scenario ? ` — ${t.scenario}` : ""}</option>)}
          </select>
          <button type="button" onClick={() => setPreview(true)} className={hcBtn.secondary}>Forskoða</button>
          <button type="button" onClick={() => { setPreview(true); setPrintAfter(true); }} className={hcBtn.secondary}>Prenta</button>
          <button type="button" onClick={() => void save()} disabled={busy} className={hcBtn.secondary}>Vista drög</button>
          <button type="button" onClick={publish} disabled={busy || draft.modules.length === 0} className={hcBtn.primary}>
            {status === "published" ? "Uppfæra birta áætlun" : "Birta skjólstæðingi"}
          </button>
        </div>
      )}

      {msg && (
        <div role="status" className={`rounded-hc-element px-4 py-2 text-sm ${msg.tone === "ok" ? "bg-hc-ok-surface text-hc-ok-ink" : "bg-hc-bad-surface text-hc-bad-ink"}`}>{msg.text}</div>
      )}

      {step === 0 && <AiProposalPanel api={api} journeyId={journeyId} ready={readyProposal} onApply={applyProposal} />}

      <div className={`grid gap-4 lg:grid-cols-[320px_1fr] ${step === 1 ? "" : "hidden"}`}>
        {/* Library */}
        <aside
          className={`h-fit rounded-hc-card border p-4 lg:sticky lg:top-4 ${dragOver === "out" ? "border-hc-bad-ink/50 bg-hc-bad-surface" : "border-hc-hairline bg-hc-surface"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver("out"); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={onDropOut}
          aria-label="Aðgerðasafn"
        >
          <p className="text-sm font-bold text-hc-ink">Aðgerðasafn</p>
          <p className="mb-3 text-xs text-hc-ink-2">Dragðu aðgerð inn í áætlunina, eða úr henni hingað til að fjarlægja.</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Leita…" aria-label="Leita í aðgerðasafni" className={`mb-2 ${hcInput}`} />
          <div className="mb-3 flex flex-wrap gap-1">
            {(["all", ...PILLARS] as const).map((p) => (
              <button key={p} type="button" onClick={() => setFilter(p)} aria-pressed={filter === p}
                className={`inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold ${filter === p ? "bg-hc-brand-dark text-white" : "bg-hc-sunken-2 text-hc-ink-2 hover:bg-hc-brand-surface hover:text-hc-brand-text"}`}>
                {p === "all" ? "Allt" : PILLAR_META[p].label}
              </button>
            ))}
          </div>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {libModules.map((m, i) => {
              const inPlan = draft.modules.some((x) => x.key === m.key);
              const fit = hasSignals ? fitOf(m, signals) : null;
              return (
                <div
                  key={m.key}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ t: "lib", k: m.key }))}
                  className={`cursor-grab rounded-hc-element border p-3 text-sm active:cursor-grabbing ${inPlan ? "opacity-50" : ""}`}
                  style={pillarSurface(m.pillar)}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-hc-ink">{m.title}</p>
                      <p className="text-xs text-hc-ink-2">{m.summary}</p>
                      {fit ? <FitMeter fit={fit} titles={markerTitles} rank={i + 1} /> : <Rating m={m} />}
                    </div>
                    <button type="button" onClick={() => addModule(m.key)} className="-m-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-hc-element bg-hc-surface text-hc-ink-2 ring-1 ring-hc-hairline hover:text-hc-brand-text" aria-label={`Bæta við ${m.title}`}><Plus className="h-4 w-4" aria-hidden /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Plan */}
        <div className="space-y-4">
          <div className="grid gap-3 rounded-hc-card border border-hc-hairline bg-hc-surface p-4 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm">
              <span className="font-semibold text-hc-ink-2">Fyrirsögn</span>
              <input value={draft.headline} onChange={(e) => update({ headline: e.target.value })} placeholder="T.d. Betri svefn og meiri orka" className={`mt-1 ${hcInput}`} />
            </label>
            <label className="sm:col-span-2 text-sm">
              <span className="font-semibold text-hc-ink-2">Samantekt úr viðtali</span>
              <textarea value={draft.summary} onChange={(e) => update({ summary: e.target.value })} rows={3} className={`mt-1 ${hcInput}`} />
            </label>
            <label className="text-sm"><span className="font-semibold text-hc-ink-2">Upphaf</span>
              <input type="date" value={draft.start_date} onChange={(e) => update({ start_date: e.target.value })} className={`mt-1 ${hcInput}`} /></label>
            <label className="text-sm"><span className="font-semibold text-hc-ink-2">Endurmat / eftirfylgd</span>
              <input type="date" value={draft.review_date} onChange={(e) => update({ review_date: e.target.value })} className={`mt-1 ${hcInput}`} /></label>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {PILLARS.map((p) => {
              const meta = PILLAR_META[p];
              const items = draft.modules.filter((m) => m.pillar === p);
              return (
                <section
                  key={p}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(p); }}
                  onDragLeave={() => setDragOver((d) => (d === p ? null : d))}
                  onDrop={(e) => onDrop(e, p, null)}
                  className="rounded-hc-card border-2 bg-hc-surface p-4 transition"
                  style={{ borderColor: dragOver === p ? `var(--hc-${p})` : pillarEdge(p) }}
                  aria-label={meta.label}
                  data-pillar={p}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <PillarIcon pillar={p} size="sm" />
                    <h3 className="font-bold text-hc-ink">{meta.label}</h3>
                    <span className="flex-1" />
                    <button type="button" onClick={() => addCustom(p)} className={`-my-2 ${smallAction()}`}><Plus className="h-3.5 w-3.5" aria-hidden />Eigin aðgerð</button>
                  </div>
                  <input
                    value={goalFor(p)}
                    onChange={(e) => setGoal(p, e.target.value)}
                    placeholder="Markmið fyrir þessa stoð (valfrjálst)"
                    aria-label={`Markmið: ${meta.label}`}
                    className="mb-3 w-full rounded-hc-element px-3 py-2 text-sm text-hc-ink placeholder:text-hc-ink-3"
                    style={{ background: `var(--hc-${p}-soft)` }}
                  />
                  {items.length === 0 && (
                    <p className="rounded-hc-element border border-dashed border-hc-border p-4 text-center text-xs text-hc-ink-3">Dragðu aðgerðir hingað</p>
                  )}
                  {/* One line per action, opened only when being edited.
                      Every item used to keep all four fields permanently
                      expanded, about 140px each. Measured on a real plan
                      that made the Næring column 1368px — taller than the
                      viewport on its own — so a coach could see one pillar
                      at a time rather than the four they came to work on.
                      Collapsed, the same plan fits all four pillars in one
                      screen; the editor is one click away and opens in
                      place. */}
                  <div className="space-y-1.5">
                    {items.map((m) => {
                      const open = openItem === m.uid;
                      return (
                        <div
                          key={m.uid}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ t: "plan", k: m.uid }))}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onDrop(e, p, m.uid)}
                          data-uid={m.uid}
                          className={`rounded-hc-element border bg-hc-surface shadow-hc-card transition ${
                            carry?.uid === m.uid ? "opacity-50" : ""} ${open ? "border-hc-control" : "border-hc-hairline"}`}
                        >
                          <div className="flex items-start gap-2 p-2">
                            {/* Both gestures live on this one element: the
                                browser's native drag for a mouse, and a
                                captured pointer drag for a finger or a pen. */}
                            <span
                              onPointerDown={carryStart(m.uid)}
                              onPointerMove={carryMove}
                              onPointerUp={carryEnd}
                              onPointerCancel={() => { setCarry(null); setDragOver(null); }}
                              role="button"
                              tabIndex={-1}
                              aria-label={`Færa ${m.title}`}
                              className="-my-1 grid h-9 w-7 shrink-0 cursor-grab select-none place-items-center rounded text-hc-ink-3 active:cursor-grabbing"
                              style={{ touchAction: "none" }}
                            ><GripVertical className="h-4 w-4" aria-hidden /></span>
                            <button type="button" onClick={() => setOpenItem(open ? null : m.uid)}
                              aria-expanded={open}
                              className="flex min-w-0 flex-1 items-start gap-2 text-left">
                              <span className="min-w-0 flex-1">
                              {/* Wraps rather than truncates.
                                  Collapsing the row to one line left about
                                  140px for the title in a 355px column, and
                                  "Fastur fótaferðartími" came out as
                                  "Fastur fótaferða…". A second line costs
                                  ~16px on the few long ones; hiding half a
                                  habit's name costs the coach the ability to
                                  read their own plan.
                                  When the two still do not fit, the
                                  frequency yields rather than the name:
                                  "Styrktarþjálfun" beside a "2–3 sinnum í
                                  viku" pill overflowed a 355px column, and
                                  breaking the word gave "Styrktarþjá/lfun".
                                  A name has to be read exactly; the
                                  frequency is a hint whose full value is one
                                  click away in the editor. */}
                                <span className="flex items-center gap-1.5">
                                  <span className="min-w-0 font-semibold leading-tight text-hc-ink">{m.title}</span>
                                  {/* A note is the one thing worth knowing
                                      about a closed row: it is written to
                                      the client. */}
                                  {m.note && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-hc-signal-yellow" role="img" aria-label="Hefur athugasemd" />}
                                </span>
                                {/* Under the title, not beside it.
                                    Beside it, the two competed for a 355px
                                    column and "Styrktarþjálfun" — one word,
                                    so it cannot wrap — overflowed into the
                                    frequency and overlapped its dot. On its
                                    own line the name always has the full row
                                    and the frequency is still visible at a
                                    glance. */}
                                {m.frequency && <span className="block truncate text-xs text-hc-ink-2">{m.frequency}</span>}
                              </span>
                              <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-hc-ink-3 transition ${open ? "rotate-180" : ""}`} aria-hidden />
                            </button>
                            <button type="button" onClick={() => removeItem(m.uid)} className="-my-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-hc-element text-hc-ink-3 hover:bg-hc-bad-surface hover:text-hc-bad-ink" aria-label={`Fjarlægja ${m.title}`}><X className="h-4 w-4" aria-hidden /></button>
                          </div>
                          {open && (
                            <div className="space-y-1 border-t border-hc-hairline p-2">
                              <input value={m.title} onChange={(e) => patchItem(m.uid, { title: e.target.value })} className="w-full rounded px-1 font-semibold text-hc-ink hover:bg-hc-sunken" aria-label="Heiti" />
                              <input value={m.summary} onChange={(e) => patchItem(m.uid, { summary: e.target.value })} placeholder="Lýsing" className="w-full rounded px-1 text-sm text-hc-ink-2 hover:bg-hc-sunken" aria-label="Lýsing" />
                              <input value={m.frequency ?? ""} onChange={(e) => patchItem(m.uid, { frequency: e.target.value || null })} placeholder="Tíðni" className="w-40 rounded bg-hc-sunken px-2 py-1 text-xs text-hc-ink-2 placeholder:text-hc-ink-3" aria-label="Tíðni" />
                              <textarea
                                value={m.note ?? ""}
                                onChange={(e) => patchItem(m.uid, { note: e.target.value || null })}
                                placeholder="Persónuleg athugasemd til skjólstæðings"
                                rows={m.note ? 2 : 1}
                                aria-label="Athugasemd til skjólstæðings"
                                className="w-full rounded-lg bg-hc-warn-surface px-2 py-1 text-sm text-hc-warn-ink placeholder:text-hc-warn-ink/60"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

        </div>
      </div>

      {/* Kept mounted behind `hidden` rather than unmounted: these editors hold
          unsaved local state, and stepping away and back should not lose it. */}
      <div className={step === 2 ? "space-y-4" : "hidden"}>
        <ExerciseEditor
          value={draft.exercise}
          templates={lib.exercise}
          onChange={(exercise) => update({ exercise })}
          api={api}
          journeyId={journeyId}
        />
        {/* What the prescription above actually produces.
            The editor is the prescription — which template, the adaptive
            settings, the session list as data. This is the week as the
            client receives it, including any swaps they have made, which
            the editor cannot show because they are theirs and not the
            plan's.

            Note the one real overlap on this step: ExerciseSessionsEditor
            above and the session cards below can both change a session.
            They are not the same act — one edits the prescription, the
            other edits this client's copy of it — but it is the place on
            this page where a coach could reasonably be confused, so the
            heading says which is which. */}
        {draft.exercise && (
          <section className="rounded-hc-card bg-hc-sunken p-3 ring-1 ring-hc-hairline">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-hc-ink-2">
              Eins og skjólstæðingurinn sér það
            </h3>
            <CoachAsClient api={api} journeyId={journeyId} only="exercise" />
          </section>
        )}
      </div>
      <div className={step === 3 ? "space-y-4" : "hidden"}>
        <NutritionEditor
          value={draft.nutrition}
          templates={lib.nutrition}
          onChange={(nutrition) => update({ nutrition })}
          api={api}
          journeyId={journeyId}
          weightKg={weightKg}
        />
        {/* The meals the chosen programme produces.
            This step was a template dropdown and a list of principles: the
            coach picked "Næringin mín" and never saw a single meal it would
            serve. The rules pick the meals, so the only way to know what
            the rules mean is to look. Almost no overlap here — the editor
            configures, this shows. */}
        {draft.nutrition && (
          <section className="rounded-hc-card bg-hc-sunken p-3 ring-1 ring-hc-hairline">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-hc-ink-2">
              Máltíðirnar sem þetta gefur
            </h3>
            <CoachAsClient api={api} journeyId={journeyId} only="nutrition" />
          </section>
        )}
      </div>

      {step === 4 && (
        <div className="space-y-4">
          {!!lib.lectures?.length && (
            <div className={`${hcCard.base} p-4 text-sm`}>
              <p className="font-semibold text-hc-ink-2">Fræðsla</p>
              <p className="text-xs text-hc-ink-2">Birtist undir „Fræðsla“ í áætlun skjólstæðings.</p>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {lib.lectures.map((l) => {
                  const on = draft.lecture_slugs.includes(l.slug);
                  return (
                    <label key={l.slug} className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-hc-element px-3 py-2 ring-1 ${on ? "bg-hc-ok-surface ring-hc-ok-ink/40" : "ring-hc-hairline hover:bg-hc-sunken"}`}>
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-hc-brand-dark" checked={on}
                        onChange={(e) => update({ lecture_slugs: e.target.checked ? [...draft.lecture_slugs, l.slug] : draft.lecture_slugs.filter((x) => x !== l.slug) })} />
                      <span>
                        <span className="block font-medium text-hc-ink-2">{l.title}</span>
                        {l.subtitle && <span className="block text-xs text-hc-ink-2">{l.subtitle}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <label className={`block p-4 text-sm ${hcCard.base}`}>
            <span className="font-semibold text-hc-ink-2">Skilaboð til skjólstæðings</span>
            <textarea value={draft.nurse_note} onChange={(e) => update({ nurse_note: e.target.value })} rows={4} placeholder="Birtist efst á yfirlitinu." className={`mt-1 ${hcInput}`} />
          </label>
          <div className={`${hcCard.base} p-4`}>
            <p className="font-bold text-hc-ink">Tilbúið?</p>
            <p className="mt-0.5 text-sm text-hc-ink-2">
              {draft.modules.length} aðgerðir · {draft.exercise ? "æfingaáætlun" : "engin æfingaáætlun"} · {draft.nutrition ? "næringaráætlun" : "engin næringaráætlun"} · {draft.lecture_slugs.length ? `${draft.lecture_slugs.length} fræðsla` : "engin fræðsla"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setPreview(true)} className={hcBtn.secondary}>Forskoða</button>
              <button type="button" onClick={publish} disabled={busy || draft.modules.length === 0}
                className={hcBtn.primary}>
                {status === "published" ? "Uppfæra birta áætlun" : "Birta skjólstæðingi"}
              </button>
            </div>
          </div>
        </div>
      )}

      <WizardFooter step={step} onGo={setStep} />
    </div>
  );
}

/**
 * "Láta AI setja saman" — fill the chosen preset from our own libraries.
 *
 * The preset decides the shape; this decides which of the 976 exercises or
 * 110 meals go in it, against the client's own values and whatever the nurse
 * wrote about pain or equipment. The model is handed library ids and may
 * only answer with those, so if it returns something we did not offer, that
 * item is dropped and the count says so.
 */
function ComposeButton({ api, journeyId, kind, templateKey, disabled, onDone }: {
  api: Api;
  journeyId: string;
  kind: "exercise" | "nutrition";
  templateKey: string | null;
  disabled?: boolean;
  onDone: (r: { sessions?: ExerciseSession[]; day_example?: { meal: string; example: string }[]; note: string; dropped: number }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [constraints, setConstraints] = useState("");
  const [open, setOpen] = useState(false);

  const run = async () => {
    setBusy(true); setMsg("");
    const r = await api(`/api/vinnustod/journeys/${journeyId}/compose`, {
      method: "POST",
      body: JSON.stringify({ kind, template: templateKey, constraints: constraints.trim() || null }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Samsetningin mistókst."); return; }
    setOpen(false);
    setMsg(j.dropped ? `Sett saman. ${j.dropped} atriði voru sleppt því þau voru ekki í safninu.` : "Sett saman úr safninu.");
    onDone(j);
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={disabled || busy} onClick={() => setOpen(!open)}
          className={hcBtn.primary}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {busy ? "Set saman…" : "Láta AI setja saman"}
        </button>
        {disabled && <span className="text-xs text-hc-ink-2">Veldu sniðmát fyrst.</span>}
        {msg && <span className="text-xs text-hc-ok-ink">{msg}</span>}
      </div>
      {open && !disabled && (
        <div className="mt-2 rounded-hc-element bg-hc-sunken p-3">
          <label className="block text-xs font-semibold text-hc-ink-2">
            Eitthvað sem á að taka mið af? Verkir, búnaður, hvað viðkomandi gerir í raun.
            <textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} rows={2}
              placeholder="T.d. verkur í hægra hné, engin lóð heima, kemst tvisvar í viku"
              className={`mt-1 font-normal ${hcInput}`} />
          </label>
          <button type="button" disabled={busy} onClick={run}
            className={`${hcBtn.primary} mt-2`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Setja saman
          </button>
        </div>
      )}
    </div>
  );
}

/** The participant's training settings, edited by the nurse (same row the participant edits). */
function AdaptiveSettings({ api, journeyId }: { api: Api; journeyId: string }) {
  const [s, setS] = useState<TrainingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const r = await api(`/api/vinnustod/journeys/${journeyId}/training`);
      const j = await r.json().catch(() => ({}));
      setS(r.ok && j.settings ? j.settings : DEFAULT_TRAINING);
    })();
  }, [api, journeyId]);
  if (!s) return <p className="text-sm text-hc-ink-3">Hleð stillingum…</p>;
  const change = async (next: TrainingSettings) => {
    const prev = s;
    setS(next); setSaving(true); setErr(null);
    const r = await api(`/api/vinnustod/journeys/${journeyId}/training`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (r.ok && j.settings) setS(j.settings); else { setS(prev); setErr("Gat ekki vistað stillingarnar."); }
  };
  return (
    <div>
      <TrainingControls settings={s} planStart={s.started_on} onChange={change} saving={saving} who="nurse" />
      {err && <p role="alert" className="mt-2 text-sm text-hc-bad-ink">{err}</p>}
    </div>
  );
}

function ExerciseEditor({ value, templates, onChange, api, journeyId }: {
  value: ActionPlan["exercise"];
  templates: ExerciseTemplate[];
  onChange: (v: ActionPlan["exercise"]) => void;
  api: Api;
  journeyId: string;
}) {
  const pick = (key: string) => {
    if (!key) { onChange(null); return; }
    const t = templates.find((x) => x.key === key);
    if (t) onChange(stripActive(t));
  };
  // Any edit makes the plan personal; the key keeps pointing at its origin.
  const edit = (patch: Partial<NonNullable<ActionPlan["exercise"]>>) =>
    value && onChange({ ...value, ...patch, key: `${value.key.replace(/-custom$/, "")}-custom` });
  return (
    <div className={`${hcCard.base} border-t-4 border-t-hc-exercise p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-hc-ink">Æfingaáætlun</h3>
        <span className="flex-1" />
        <select value={value?.key ?? ""} onChange={(e) => pick(e.target.value)} className={`${hcInput.replace("w-full", "w-auto")} min-h-11`} aria-label="Æfingasniðmát">
          <option value="">Engin æfingaáætlun</option>
          {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          {value && !templates.some((t) => t.key === value.key) && <option value={value.key}>{value.name} (sérsniðin)</option>}
        </select>
      </div>
      {value && isAdaptive(value.key) && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-hc-ink-2">
            Þessi áætlun lagar sig að skjólstæðingnum: byrjunarstigi (aðlögun eða beint á stig 1), álagi og meiðslum.
            Skjólstæðingurinn getur líka breytt stillingunum sjálf/ur í áætluninni sinni.
          </p>
          <AdaptiveSettings api={api} journeyId={journeyId} />
        </div>
      )}
      {value && !isAdaptive(value.key) && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-hc-ink-2">
            Æfingar úr æfingasafninu fylgja með mynd, myndbandi og leiðbeiningum. Skiptu um æfingu ef eitthvað hentar ekki, t.d. vegna verkja eða búnaðar.
          </p>
          <ComposeButton api={api} journeyId={journeyId} kind="exercise" templateKey={value.key ?? null}
            onDone={(r) => r.sessions && edit({ sessions: r.sessions, days_per_week: r.sessions.length || value.days_per_week })} />
          <ExerciseSessionsEditor api={api} sessions={value.sessions} onChange={(sessions) => edit({ sessions, days_per_week: sessions.length || value.days_per_week })} />
          {!!value.principles?.length && (
            <details className="rounded-hc-element border border-hc-hairline p-3 text-sm">
              <summary className="cursor-pointer font-semibold text-hc-ink-2">Meginreglur og stigvaxandi álag</summary>
              <label className="mt-2 block text-xs text-hc-ink-2">Meginreglur (ein lína á reglu)
                <textarea value={value.principles.join("\n")} rows={4}
                  onChange={(e) => edit({ principles: e.target.value.split("\n") })}
                  className={`mt-1 ${hcInput}`} />
              </label>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function NutritionEditor({ value, templates, onChange, api, journeyId, weightKg }: {
  value: ActionPlan["nutrition"];
  templates: NutritionTemplate[];
  onChange: (v: ActionPlan["nutrition"]) => void;
  api: Api;
  journeyId: string;
  /** From the report's þyngd row, for the 1,6–2,0 g/kg protein band. */
  weightKg?: number | null;
}) {
  const pick = (key: string) => {
    if (!key) { onChange(null); return; }
    const t = templates.find((x) => x.key === key);
    if (t) onChange(stripActive(t));
  };
  return (
    <div className={`${hcCard.base} border-t-4 border-t-hc-nutrition p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-hc-ink">Næringaráætlun</h3>
        <span className="flex-1" />
        <select value={value?.key ?? ""} onChange={(e) => pick(e.target.value)} className={`${hcInput.replace("w-full", "w-auto")} min-h-11`} aria-label="Næringarsniðmát">
          <option value="">Engin næringaráætlun</option>
          {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
        </select>
      </div>
      {value && (
        <div className="mt-3 space-y-1.5">
          {value.principles.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input value={p} aria-label="Meginregla"
                onChange={(e) => onChange({ ...value, principles: value.principles.map((x, j) => (j === i ? e.target.value : x)) })}
                className={`${hcInput} flex-1`} />
              <button type="button" aria-label="Fjarlægja reglu" className="grid h-11 w-11 shrink-0 place-items-center rounded-hc-element text-hc-ink-3 hover:bg-hc-bad-surface hover:text-hc-bad-ink"
                onClick={() => onChange({ ...value, principles: value.principles.filter((_, j) => j !== i) })}><X className="h-4 w-4" aria-hidden /></button>
            </div>
          ))}
          <button type="button" className={smallAction("text-hc-nutrition-ink")} onClick={() => onChange({ ...value, principles: [...value.principles, ""] })}><Plus className="h-3.5 w-3.5" aria-hidden />Bæta við reglu</button>
          <div className="mt-3 rounded-hc-element border border-hc-hairline p-3">
            <p className="text-sm font-semibold text-hc-ink-2">Dæmi um dag</p>
            <p className="mb-2 mt-0.5 text-xs text-hc-ink-2">Veldu máltíðir úr safninu til að fá mynd og næringargildi með í áætlunina.</p>
            <ComposeButton api={api} journeyId={journeyId} kind="nutrition" templateKey={value.key ?? null}
              onDone={(r) => r.day_example && onChange({ ...value, day_example: r.day_example })} />
            <DayExampleEditor api={api} value={value.day_example ?? []} onChange={(day_example) => onChange({ ...value, day_example })} />
          </div>

        </div>
      )}
      {/* And what actually comes out of it.
          Outside the `value &&` block on purpose: with no template chosen
          there is no week, and saying so is the useful thing to show. My
          first attempt nested it inside, where its own empty state could
          never render — invisible exactly when it had something to say. */}
      <div className="mt-3 rounded-hc-element border border-hc-hairline p-3">
        <CoachMealWeek api={api} journeyId={journeyId} programKey={value?.key ?? null} weightKg={weightKg} />
      </div>
    </div>
  );
}
