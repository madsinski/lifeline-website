"use client";

// "Æfingar": the participant's exercise programme, arranged their way.
//   • the week in the hero — drag a session to another day (or tap it and pick)
//   • HIIT on its own days, when the programme carries it inside strength days
//   • swap any exercise for one from the library (drag a card onto it, or
//     "Skipta" and tap), with the library's pictures, video and how-to
// Saved to hc_training_settings through onSave (src/lib/hc/personalise.ts).

import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, Dumbbell, Info, Play, RotateCcw, Sliders, Sparkles } from "lucide-react";
import { canSplitHiit, MODALITY_IS, personalise, weekdayOf, WEEKDAYS, WEEKDAYS_SHORT, type Personal, type PSession, type SwapSnapshot } from "@/lib/hc/personalise";
import { BLOCK_IS, EQUIPMENT_IS, muscleIs } from "@/lib/hc/exercise-labels";
import type { ActionPlan, ExerciseBlock, ExerciseItem } from "@/lib/hc/types";
import { activityFocus, activityModality, hardDays, stageAt, type Activity, type TrainingSettings } from "@/lib/hc/adaptive-program";
import { DragGhost, useDrag } from "./useDrag";
import SwapWizard from "./SwapWizard";
import SessionAlternatives from "./SessionAlternatives";
import AddDayActivity from "./AddDayActivity";
import ActivityIcon from "./ActivityIcon";
import { hcBtn } from "./ui";
import type { BodyData } from "@/lib/hc/start-weight";
import WorkoutRunner from "./WorkoutRunner";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
type PlanExercise = NonNullable<ActionPlan["exercise"]>;

interface LibEx {
  id: string; name: string; name_is: string | null; category: string | null; equipment: string | null;
  illustration_url: string | null; video_url: string | null; primary_muscles: string[] | null; bang_for_buck: boolean | null;
}
type Payload =
  | { kind: "session"; id: string }
  | { kind: "activity"; id: string }
  | { kind: "exercise"; ex: LibEx };


export default function TrainingView({ api, exercise, personal, onSave, controls, stages, onChangeProgram, onCustomise, arranging = false, training, planStart, onFinish, body, onInstead, onAddDay,
  onCompleteActivity, onMoveActivity, onRemoveActivity }: {
  api: Api;
  /** The programme as written (adaptive ones already computed for the settings). */
  exercise: PlanExercise;
  personal: Personal;
  /** Save a change (days / hiit_split / swaps). */
  onSave: (p: Personal) => void;
  /** Level / load / injury controls for the adaptive programme. */
  controls?: React.ReactNode;
  stages?: React.ReactNode;
  /** Opens the programme chooser. */
  onChangeProgram?: () => void;
  /**
   * Opens the "Hvað viltu breyta?" sheet. When given, this page is for doing
   * the training: the dials, the drag-and-drop and the exercise swapping all
   * move behind that one button.
   */
  onCustomise?: () => void;
  /** Rendered inside that sheet, where rearranging is the whole point. */
  arranging?: boolean;
  /** For "where am I in the programme" in the hero. */
  training?: TrainingSettings;
  planStart?: string | null;
  /** A finished workout: minutes, RPE and which session it was. */
  onFinish?: (info: { minutes: number; rpe: number; session: PSession }) => void;
  /** Weight, body fat and sex, for suggesting a starting load. */
  body?: BodyData;
  /** They did something else instead of this session. */
  onInstead?: (info: { label: string; modality: PSession["modality"]; session: PSession }) => void;
  /** Marking one of their own sessions done. */
  onCompleteActivity?: (a: Activity) => void;
  onMoveActivity?: (id: string, weekday: number) => void;
  onRemoveActivity?: (id: string) => void;
  /** Tapping an empty day: add a sport or class that needs no programme. */
  onAddDay?: (a: Omit<import("@/lib/hc/adaptive-program").Activity, "id">) => void;
}) {
  const view = useMemo(
    () => personalise(exercise, personal, training ? hardDays(training) : []),
    [exercise, personal, training]);
  const [todayIdx] = useState(() => weekdayOf(new Date()));
  const [pickDay, setPickDay] = useState<string | null>(null);
  const [swapItem, setSwapItem] = useState<{ slot: string; item: ExerciseItem } | null>(null);
  const [running, setRunning] = useState<PSession | null>(null);
  const [swapSession, setSwapSession] = useState<PSession | null>(null);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [pickAct, setPickAct] = useState<Activity | null>(null);
  const [openSession, setOpenSession] = useState<string | null>(() => view.sessions.find((s) => s.weekday === todayIdx)?.id ?? view.sessions[0]?.id ?? null);
  const mine = !personal.program_key || personal.program_key === exercise.key;
  // Read-only on the main page; everything that edits lives in the sheet.
  const editable = !onCustomise || arranging;

  const save = (patch: Partial<Personal>) => onSave({ ...personal, ...(mine ? {} : { days: {}, swaps: {}, hiit_split: false }), program_key: exercise.key, ...patch });
  const moveSession = (id: string, day: number) => save({ days: { ...(mine ? personal.days : {}), [id]: day } });
  const swap = (slot: string, ex: LibEx) => {
    const snap: SwapSnapshot = {
      exercise_id: ex.id, name: ex.name_is || ex.name, image: ex.illustration_url, video: ex.video_url,
      muscles: ex.primary_muscles ?? [], equipment: ex.equipment, cues: [],
    };
    save({ swaps: { ...(mine ? personal.swaps : {}), [slot]: snap } });
    setSwapItem(null);
  };
  const unswap = (slot: string) => {
    const next = { ...personal.swaps };
    delete next[slot];
    save({ swaps: next });
  };

  const { drag, handle } = useDrag<Payload>((p, target) => {
    if (p.kind === "session" && target.startsWith("day:")) moveSession(p.id, Number(target.slice(4)));
    if (p.kind === "activity" && target.startsWith("day:")) onMoveActivity?.(p.id, Number(target.slice(4)));
    if (p.kind === "exercise" && target.startsWith("slot:")) swap(target.slice(5), p.ex);
  });

  const custom = mine && (Object.keys(personal.days).length > 0 || Object.keys(personal.swaps).length > 0 || personal.hiit_split);
  const counts = view.sessions.reduce<Record<string, number>>((a, s) => ({ ...a, [s.modality]: (a[s.modality] ?? 0) + 1 }), {});
  // Today's sessions, and the next one when today is a rest day — the two
  // things the hero is for.
  const todays = view.sessions.filter((x) => x.weekday === todayIdx);
  const nextUp = [...view.sessions]
    .sort((a, b) => ((a.weekday - todayIdx + 7) % 7) - ((b.weekday - todayIdx + 7) % 7))
    .find((x) => x.weekday !== todayIdx) ?? null;
  const stage = training ? stageAt(training, planStart ?? null) : null;

  return (
    <div className="min-w-0 space-y-6">
        {/* Hero: the week */}
        <section className="overflow-hidden rounded-3xl border border-orange-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Æfingaáætlunin mín</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">{exercise.name}</h2>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {onChangeProgram && !onCustomise && <button type="button" onClick={onChangeProgram} className="rounded-full border border-orange-200 px-3 py-1 text-sm font-semibold text-orange-800 hover:bg-orange-50">Skipta um æfingaáætlun</button>}
              {/* Was a full-width block under the hero. The page is for the
                  next session; changing the plan is the rarer errand. */}
              {onCustomise && !arranging && (
                <button type="button" onClick={onCustomise}
                  className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 px-3 py-1 text-sm font-semibold text-orange-800 transition hover:bg-orange-50">
                  <Sliders className="h-3.5 w-3.5" aria-hidden /> Breyta
                </button>
              )}
            </div>
          </div>

          {/* What the page is actually for: the next thing to do. The goal
              sentence, the minutes, the level and the exercise count used to
              sit here instead — all of it either repeated below or inferable
              from the week, and none of it the question someone opens this
              page with. */}
          <div className="mt-4 rounded-2xl bg-orange-600 p-4 text-white">
            {todays.length > 0 ? (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-100">Í dag</p>
                <p className="mt-0.5 text-lg font-bold">{todays.map((x) => x.title).join(" + ")}</p>
                <p className="text-sm text-orange-50">
                  {[todays[0].focus, todays[0].minutes ? `um ${todays[0].minutes} mín.` : null].filter(Boolean).join(" · ")}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-100">Í dag</p>
                <p className="mt-0.5 text-lg font-bold">Hvíldardagur</p>
                {nextUp && <p className="text-sm text-orange-50">Næst: {nextUp.title} á {WEEKDAYS[nextUp.weekday].toLowerCase()}</p>}
              </>
            )}
          </div>

          {stage && (
            <div className="mt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <p className="font-semibold text-slate-800">{stage.title}</p>
                <p className="text-slate-500">
                  Vika {stage.week}{stage.weeksToNext !== null && stage.nextTitle ? ` · ${stage.nextTitle} eftir ${stage.weeksToNext} ${stage.weeksToNext === 1 ? "viku" : "vikur"}` : ""}
                </p>
              </div>
              <div className="mt-1.5 flex gap-1.5" aria-hidden>
                {Array.from({ length: stage.count }, (_, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i < stage.index ? "bg-orange-300" : i === stage.index ? "bg-orange-600" : "bg-slate-200"}`} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-7 gap-1.5">
            {WEEKDAYS_SHORT.map((d, i) => {
              const here = view.sessions.filter((s) => s.weekday === i);
              const mine = (training?.activities ?? []).filter((a) => a.day === i);
              const over = drag?.over === `day:${i}`;
              return (
                <div key={d} data-drop={`day:${i}`}
                  className={`flex min-h-[92px] flex-col gap-1 rounded-xl border p-1 transition ${
                    over ? "border-orange-400 bg-orange-50" : i === todayIdx ? "border-orange-300 bg-orange-50/60" : "border-slate-200 bg-white"}`}>
                  <p className={`text-center text-[11px] font-bold uppercase ${i === todayIdx ? "text-orange-800" : "text-slate-400"}`}>{d}</p>
                  {here.map((s) => (
                    <button key={s.id} type="button" {...handle({ kind: "session", id: s.id }, s.title)}
                      onClick={() => { setPickAct(null); setPickDay(pickDay === s.id ? null : s.id); }}
                      aria-label={`${s.title}, ${WEEKDAYS[i].toLowerCase()}`}
                      className={`select-none rounded-lg px-1 py-1.5 text-left text-[10px] font-bold leading-tight shadow-sm ring-1 sm:text-[11px] cursor-grab active:cursor-grabbing ${MODALITY_IS[s.modality].cls} ${pickDay === s.id ? "outline outline-2 outline-hc-ink" : ""}`}>
                      <span className={`mb-0.5 block h-1 w-5 rounded-full ${MODALITY_IS[s.modality].dot}`} />
                      <span className="block truncate sm:hidden">{MODALITY_IS[s.modality].short}</span>
                      <span className="hidden line-clamp-2 sm:block">{s.title.length > 11 ? MODALITY_IS[s.modality].label : s.title}</span>
                    </button>
                  ))}
                  {/* Their own commitments: outlined, because the plan did not
                      put them there. */}
                  {mine.map((a) => {
                    const am = activityModality(a);
                    const mm = MODALITY_IS[am === "other" ? "other" : am];
                    return (
                      <button key={a.id} type="button" {...(onMoveActivity ? handle({ kind: "activity", id: a.id }, a.name) : {})}
                        onClick={() => { setPickDay(null); setPickAct(pickAct?.id === a.id ? null : a); }}
                        title={`${a.name}${a.at ? ` · ${a.at}` : ""} — ${activityFocus(a)}`}
                        aria-label={`${a.name}, ${WEEKDAYS[a.day].toLowerCase()}`}
                        className={`${onMoveActivity ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} select-none rounded-lg px-1 py-1.5 text-left text-[10px] font-bold leading-tight shadow-sm ring-1 sm:text-[11px] ${mm.cls} ${pickAct?.id === a.id ? "outline outline-2 outline-hc-ink" : ""}`}>
                        <span className={`mb-0.5 block h-1 w-5 rounded-full ${mm.dot}`} />
                        <span className="flex items-center gap-1">
                          <ActivityIcon name={a.name} className="h-3 w-3 shrink-0" />
                          <span className="truncate">{a.name}</span>
                        </span>
                        {a.at && <span className="block text-[9px] font-normal opacity-70">{a.at}</span>}
                      </button>
                    );
                  })}
                  {here.length === 0 && mine.length === 0 && (
                    onAddDay
                      ? <button type="button" onClick={() => setAddDay(i)}
                          aria-label={`Bæta við æfingu á ${WEEKDAYS[i].toLowerCase()}`}
                          className="mt-auto rounded-lg py-1 text-center text-[10px] font-semibold text-slate-400 transition hover:bg-orange-50 hover:text-orange-700">
                          Hvíld <span aria-hidden className="block text-sm leading-none">+</span>
                        </button>
                      : <p className="mt-auto pb-1 text-center text-[10px] text-slate-400">Hvíld</p>
                  )}
                </div>
              );
            })}
          </div>

          {pickAct && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-bold text-slate-900">{pickAct.name}</p>
              <p className="text-xs text-slate-500">{WEEKDAYS[pickAct.day]}{pickAct.at ? ` · ${pickAct.at}` : ""} · {activityFocus(pickAct)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={hcBtn.primary}
                  onClick={() => { onCompleteActivity?.(pickAct); setPickAct(null); }}>
                  <Check className="h-4 w-4" aria-hidden /> Ég gerði þetta
                </button>
                <button type="button" className={hcBtn.ghost}
                  onClick={() => { onRemoveActivity?.(pickAct.id); setPickAct(null); }}>
                  Fjarlægja
                </button>
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">Færa á annan dag</p>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {WEEKDAYS_SHORT.map((d, i) => (
                  <button key={d} type="button" onClick={() => { onMoveActivity?.(pickAct.id, i); setPickAct(null); }}
                    className={`rounded-lg py-2 text-xs font-bold ${pickAct.day === i ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{d}</button>
                ))}
              </div>
            </div>
          )}

          {pickDay && (() => {
            const sess = view.sessions.find((x) => x.id === pickDay);
            if (!sess) return null;
            return (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-bold text-slate-900">{sess.title}</p>
                <p className="text-xs text-slate-500">{sess.day}{sess.minutes ? ` · um ${sess.minutes} mín.` : ""}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={hcBtn.primary}
                    onClick={() => { setRunning(sess); setPickDay(null); }}>
                    <Play className="h-4 w-4" aria-hidden /> Byrja núna
                  </button>
                  <button type="button" className={hcBtn.secondary}
                    onClick={() => { setOpenSession(sess.id); setPickDay(null); document.getElementById(`session-${sess.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                    Sjá æfinguna
                  </button>
                  <button type="button" className={hcBtn.ghost}
                    onClick={() => { setSwapSession(sess); setPickDay(null); }}>
                    Gera annað
                  </button>
                </div>
                <p className="mt-3 text-xs font-semibold text-slate-500">Færa á annan dag</p>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {WEEKDAYS_SHORT.map((d, i) => (
                    <button key={d} type="button" onClick={() => { moveSession(sess.id, i); setPickDay(null); }}
                      className={`rounded-lg py-2 text-xs font-bold ${sess.weekday === i ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-orange-100"}`}>{d}</button>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {(Object.keys(counts) as (keyof typeof MODALITY_IS)[]).map((m) => (
              <span key={m} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-slate-600">
                <span className={`h-2 w-2 rounded-full ${MODALITY_IS[m].dot}`} />{MODALITY_IS[m].label} {counts[m]}×
              </span>
            ))}
            <span className="text-slate-500">Dragðu hvað sem er í vikunni á annan dag — eða ýttu á það.</span>
          </div>

          {editable && (canSplitHiit(exercise) || custom) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {canSplitHiit(exercise) && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={mine && personal.hiit_split} onChange={(e) => save({ hiit_split: e.target.checked })} className="h-4 w-4 accent-orange-600" />
                  HIIT á sér dögum
                </label>
              )}
              {custom && (
                <button type="button" onClick={() => save({ days: {}, swaps: {}, hiit_split: false })}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline">
                  <RotateCcw className="h-3.5 w-3.5" /> Upprunaleg áætlun
                </button>
              )}
            </div>
          )}
        </section>

        {editable && controls}
        {stages}

        <section className="space-y-3">
          {(training?.activities ?? []).length > 0 && (
            <ActivityCards activities={training!.activities} todayIdx={todayIdx} onComplete={onCompleteActivity} />
          )}
          {view.sessions.map((s) => (
            <SessionCard key={s.id} s={s} today={s.weekday === todayIdx} open={openSession === s.id}
              onStart={() => setRunning(s)}
              onInstead={() => setSwapSession(s)}
              onToggle={() => setOpenSession(openSession === s.id ? null : s.id)}
              dragOver={drag?.over ?? null} swapFor={swapItem?.slot ?? null}
              onSwap={(slot, it) => setSwapItem({ slot, item: it })} onUnswap={unswap} />
          ))}
        </section>

        {/* The paragraph explaining the programme and the list of why it works
            both sat open on the page — one above the sessions and one below
            them. Nobody reads a rationale while looking for today's workout,
            and the sessions were pushed down by both. They are one disclosure
            now, at the end, for whoever does want them. */}
        {(exercise.description || !!exercise.principles?.length) && (
          <details className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-slate-800">
              <Info className="h-4 w-4 text-orange-700" aria-hidden />
              Um áætlunina — af hverju þetta virkar
              <ChevronDown className="ml-auto h-4 w-4 text-slate-400 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-3 space-y-4">
              {exercise.description && <p className="text-sm leading-relaxed text-slate-700">{exercise.description}</p>}
              {!!exercise.principles?.length && (
                <ol className="grid gap-2 sm:grid-cols-2">
                  {exercise.principles.map((p, i) => (
                    <li key={i} className="flex gap-3 rounded-2xl border border-orange-100 bg-orange-50/40 p-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">{i + 1}</span>
                      <span className="text-sm text-slate-700">{p}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </details>
        )}

      {/* Swapping used to mean a 976-exercise library pinned to the right of
          the page at all times. It is a popup now, opened from the exercise
          being replaced, and it asks why first — too hard, too easy, bored,
          or it hurts — so what comes back is a handful of exercises on the
          same muscles that answer that reason, not a catalogue. */}
      {addDay !== null && (
        <AddDayActivity weekday={addDay}
          onClose={() => setAddDay(null)}
          onAdd={(a) => { onAddDay?.(a); setAddDay(null); }} />
      )}

      {swapSession && (
        <SessionAlternatives modality={swapSession.modality} sessionTitle={swapSession.title}
          onClose={() => setSwapSession(null)}
          onPick={(info) => { onInstead?.({ ...info, session: swapSession }); setSwapSession(null); }} />
      )}

      {running && (
        <WorkoutRunner session={running} body={body}
          onClose={() => setRunning(null)}
          onSwap={(slot, it) => setSwapItem({ slot, item: it })}
          onDone={(info) => { setRunning(null); onFinish?.({ ...info, session: running }); }} />
      )}

      {swapItem && (
        <SwapWizard api={api} item={swapItem.item} injuries={training?.injuries ?? []}
          onPick={(ex) => swap(swapItem.slot, ex)}
          onClose={() => setSwapItem(null)} />
      )}
      <DragGhost drag={drag} />
    </div>
  );
}

function SessionCard({ s, today, open, onToggle, onStart, onInstead, dragOver, swapFor, onSwap, onUnswap }: {
  s: PSession; today: boolean; open: boolean; onToggle: () => void;
  dragOver: string | null; swapFor: string | null;
  /** Opens the runner for this session. */
  onStart?: () => void;
  /** "I did something else today." */
  onInstead?: () => void;
  /** Undefined on the reading surface: swapping lives in the change sheet. */
  onSwap?: (slot: string, item: ExerciseItem) => void;
  onUnswap: (slot: string) => void;
}) {
  const blocks = (["warmup", "main", "finisher"] as ExerciseBlock[])
    .map((key) => ({ key, items: s.items.filter((it) => (it.block ?? "main") === key) }))
    .filter((b) => b.items.length);
  const m = MODALITY_IS[s.modality];
  return (
    <div id={`session-${s.id}`} className={`scroll-mt-24 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ${today ? "ring-2 ring-orange-500" : "ring-orange-100"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 border-b border-orange-100 bg-orange-50/60 px-4 py-3 text-left">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white ${s.modality === "hiit" ? "bg-rose-600" : s.modality === "cardio" ? "bg-sky-600" : "bg-orange-600"}`}><Dumbbell className="h-5 w-5" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-orange-700">{s.day}{today ? " · í dag" : ""}</span>
          <span className="block font-semibold text-[#0F172A]">{s.title}{s.focus ? <span className="font-normal text-slate-500"> · {s.focus}</span> : null}</span>
        </span>
        <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 sm:inline ${m.cls}`}>{m.label}</span>
        {s.minutes ? <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">{s.minutes} mín.</span> : null}
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {/* The point of the page. Today's session gets the solid button; the
          others get a quiet one, because doing Thursday's workout on Monday
          is allowed but is not what we are suggesting. */}
      {onStart && (
        <div className="border-b border-slate-100 px-4 py-3">
          <button type="button" onClick={onStart}
            className={today
              ? "flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 font-bold text-white transition hover:bg-orange-700"
              : "flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-2.5 font-semibold text-orange-800 transition hover:bg-orange-50"}>
            <Play className="h-4 w-4" aria-hidden /> Byrja æfinguna
          </button>
          {onInstead && (
            <button type="button" onClick={onInstead}
              className="mt-2 w-full text-center text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
              Ég geri eitthvað annað í dag
            </button>
          )}
        </div>
      )}
      {open && (
        <div className="divide-y divide-slate-100">
          {blocks.map((b) => (
            <div key={b.key} className="px-3 py-3 sm:px-4">
              {blocks.length > 1 && <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{BLOCK_IS[b.key]}</p>}
              <ul className="space-y-2">
                {b.items.map((it, j) => <ExerciseRow key={it.slot ?? j} it={it} over={!!it.slot && dragOver === `slot:${it.slot}`}
                  choosing={!!it.slot && swapFor === it.slot} onSwap={onSwap} onUnswap={onUnswap} />)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const canSwap = (it: ExerciseItem) => !!it.slot && !/^hiit/i.test(it.name) && it.name !== "Upphitun";

function ExerciseRow({ it, over, choosing, onSwap, onUnswap }: { it: ExerciseItem; over: boolean; choosing: boolean; onSwap?: (slot: string, item: ExerciseItem) => void; onUnswap: (slot: string) => void }) {
  const [open, setOpen] = useState(false);
  const how = !!(it.cues?.length || it.video);
  const swappable = canSwap(it);
  return (
    <li data-drop={swappable ? `slot:${it.slot}` : undefined}
      className={`rounded-2xl ring-1 transition ${over ? "bg-orange-50 ring-2 ring-orange-500" : choosing ? "ring-2 ring-slate-900" : "ring-slate-100"}`}>
      <div className="flex gap-3 p-2">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-orange-50 sm:h-24 sm:w-24">
          {it.image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={it.image} alt={it.name} loading="lazy" className="h-full w-full object-cover" />
            : <span className="flex h-full items-center justify-center text-orange-300"><Dumbbell className="h-7 w-7" aria-hidden /></span>}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight text-slate-900">
              {it.name}
              {it.swapped && <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 align-middle text-[10px] font-bold text-violet-800"><Sparkles className="h-3 w-3" aria-hidden />Þitt val</span>}
            </p>
            <p className="shrink-0 rounded-lg bg-orange-50 px-2 py-0.5 text-sm font-bold text-orange-700">{it.prescription}</p>
          </div>
          {!!it.muscles?.length && (
            <p className="mt-1 flex flex-wrap gap-1">
              {it.muscles.slice(0, 3).map((mm) => <span key={mm} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{muscleIs(mm)}</span>)}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {[it.rest ? `Hvíld ${it.rest}` : null, it.equipment ? EQUIPMENT_IS[it.equipment] ?? it.equipment : null].filter(Boolean).join(" · ")}
          </p>
          {it.note && <p className="mt-1 text-sm text-slate-700">{it.note}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs font-semibold">
            {how && (
              <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-orange-700 hover:underline">
                {open ? "Fela" : it.video ? "▶ Sjá hvernig" : "Hvernig?"}
              </button>
            )}
            {swappable && onSwap && (
              <button type="button" onClick={() => onSwap(it.slot!, it)}
                aria-label={`Skipta út æfingunni ${it.name}`}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-800">
                <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Skipta um æfingu
              </button>
            )}
            {it.swapped && it.slot && onSwap && (
              <button type="button" onClick={() => onUnswap(it.slot!)} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Upprunaleg
              </button>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          {it.video && <video src={it.video} poster={it.image ?? undefined} controls playsInline preload="none" className="w-full max-w-md rounded-xl bg-black" />}
          {!!it.cues?.length && (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {it.cues.map((c, k) => <li key={k}>{c}</li>)}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}


/**
 * The sports someone already does, listed with the programme's own sessions.
 *
 * They used to appear only as a footnote in the week grid, which made a
 * Monday with an hour of football on it look like a rest day in the plan.
 * An hour of football IS the hard lota for that day; it belongs in the list.
 */
function ActivityCards({ activities, todayIdx, onComplete }: {
  activities: Activity[]; todayIdx: number; onComplete?: (a: Activity) => void;
}) {
  const sorted = [...activities].sort((a, b) => a.day - b.day || (a.at ?? "").localeCompare(b.at ?? ""));
  return (
    <>
      {sorted.map((a) => {
        const am = activityModality(a);
        const mm = MODALITY_IS[am === "other" ? "other" : am];
        const today = a.day === todayIdx;
        return (
          <div key={a.id}
            className={`flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ${today ? "ring-2 ring-slate-400" : "ring-slate-200"}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${mm.dot} text-white`}>
              <ActivityIcon name={a.name} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">
                {WEEKDAYS[a.day]}{today ? " · í dag" : ""}{a.at ? ` · ${a.at}` : ""}
              </span>
              <span className="block font-semibold text-[#0F172A]">{a.name}</span>
              <span className="block text-xs text-slate-500">{activityFocus(a)} · þitt eigið</span>
            </span>
            {onComplete
              ? <button type="button" onClick={() => onComplete(a)}
                  className="shrink-0 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Ég gerði þetta
                </button>
              : <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 sm:inline ${mm.cls}`}>{mm.label}</span>}
          </div>
        );
      })}
    </>
  );
}
