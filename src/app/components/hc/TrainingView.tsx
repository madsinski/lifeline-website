"use client";

// "Æfingar": the participant's exercise programme, arranged their way.
//   • the week in the hero — drag a session to another day (or tap it and pick)
//   • HIIT on its own days, when the programme carries it inside strength days
//   • swap any exercise for one from the library (drag a card onto it, or
//     "Skipta" and tap), with the library's pictures, video and how-to
// Saved to hc_training_settings through onSave (src/lib/hc/personalise.ts).

import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, Plus, X, Dumbbell, Info, Play, RotateCcw, Sliders, Sparkles } from "lucide-react";
import { needsRunner } from "@/lib/hc/workout";
import { LOAD_IS } from "@/lib/hc/adaptive-program";
import { canSplitHiit, MODALITY_IS, personalise, weekdayOf, WEEKDAYS, WEEKDAYS_SHORT, type Modality, type Personal, type PSession, type SwapSnapshot } from "@/lib/hc/personalise";
import { BLOCK_IS, EQUIPMENT_IS, muscleIs } from "@/lib/hc/exercise-labels";
import type { ActionPlan, ExerciseBlock, ExerciseItem } from "@/lib/hc/types";
import { activityFocus, activityModality, hardDays, stageAt, type Activity, type TrainingSettings } from "@/lib/hc/adaptive-program";
import { DragGhost, useDrag } from "./useDrag";
import SwapWizard from "./SwapWizard";
import SessionGuide from "./SessionGuide";
import TrainingChanges, { ChangesButton } from "./TrainingChanges";
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
  onCompleteActivity, onMoveActivity, onActivityLoad, onSaveTraining, onRemoveActivity, onRemoveDay, doneToday }: {
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
  /** Per-session load, −2…+2. */
  onActivityLoad?: (id: string, load: number) => void;
  /** Saving the whole settings object from the changes sheet. */
  onSaveTraining?: (next: import("@/lib/hc/adaptive-program").TrainingSettings) => void;
  onRemoveActivity?: (id: string) => void;
  /** Session and activity ids marked done today. */
  doneToday?: Set<string>;
  /**
   * Take a programme session off the week.
   *
   * Removing one means that weekday is no longer a training day, which is
   * what makes it stick: the programme is generated from the settings, so a
   * session deleted by id would come straight back the next time the week was
   * built. Anything the person put on that day themselves stays.
   */
  onRemoveDay?: (weekday: number) => void;
  /** Tapping an empty day: add a sport or class that needs no programme. */
  onAddDay?: (a: Omit<import("@/lib/hc/adaptive-program").Activity, "id">, injuries?: import("@/lib/hc/adaptive-program").Region[]) => void;
}) {
  const view = useMemo(
    () => personalise(exercise, personal, training ? hardDays(training) : []),
    [exercise, personal, training]);
  const [todayIdx] = useState(() => weekdayOf(new Date()));
  // One sheet for every setting, instead of four scattered entry points.
  const [changes, setChanges] = useState(false);
  /**
   * The day the list below is showing. Clicking anything in the week picks
   * its day; the week and the detail are one thing now rather than a grid
   * plus a dropdown plus a list of every session in the week.
   */
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const shownDay = pickedDay ?? todayIdx;
  const daySessions = view.sessions.filter((x) => x.weekday === shownDay);
  const dayActivities = (training?.activities ?? []).filter((a) => a.day === shownDay);
  const [swapItem, setSwapItem] = useState<{ slot: string; item: ExerciseItem } | null>(null);
  /** The session an exercise is being added to. */
  const [addTo, setAddTo] = useState<PSession | null>(null);
  const [running, setRunning] = useState<PSession | null>(null);
  const [swapSession, setSwapSession] = useState<PSession | null>(null);
  const [addDay, setAddDay] = useState<number | null>(null);
  const [openSession, setOpenSession] = useState<string | null>(() => view.sessions.find((s) => s.weekday === todayIdx)?.id ?? view.sessions[0]?.id ?? null);
  const mine = !personal.program_key || personal.program_key === exercise.key;
  // Read-only on the main page; everything that edits lives in the sheet.
  const editable = !onCustomise || arranging;

  const save = (patch: Partial<Personal>) => onSave({ ...personal, ...(mine ? {} : { days: {}, swaps: {}, hiit_split: false }), program_key: exercise.key, ...patch });
  const moveSession = (id: string, day: number) => save({ days: { ...(mine ? personal.days : {}), [id]: day } });
  /** Take an exercise out of its session. */
  const dropItem = (slot: string) => save({ drops: [...new Set([...(personal.drops ?? []), slot])] });
  /** Put it back. */
  const undrop = (slot: string) => save({ drops: (personal.drops ?? []).filter((x) => x !== slot) });
  /** Add one from the library to the end of a session's main block. */
  const addItem = (sessionId: string, ex: LibEx) => {
    const snap: SwapSnapshot = {
      exercise_id: ex.id, name: ex.name_is || ex.name, image: ex.illustration_url, video: ex.video_url,
      muscles: ex.primary_muscles ?? [], equipment: ex.equipment, cues: [],
    };
    save({ extra: { ...(personal.extra ?? {}), [sessionId]: [...((personal.extra ?? {})[sessionId] ?? []), snap] } });
    setAddTo(null);
  };
  /** Remove one that was added. */
  const dropExtra = (sessionId: string, i: number) =>
    save({ extra: { ...(personal.extra ?? {}), [sessionId]: ((personal.extra ?? {})[sessionId] ?? []).filter((_, k) => k !== i) } });

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

          {/* A day per row on a phone, the week as a grid from sm up.
              Seven columns inside 360px gives each day about 44px, which is
              why session names collapsed to "Styrk" — there was nowhere to
              print them. Full-width rows have room for the real title.
              Drag and drop is unaffected: it rides on data-drop and the
              chips' own handles, not on the layout. */}
          <div className="mt-5 flex flex-col gap-1.5 sm:grid sm:grid-cols-7">
            {WEEKDAYS_SHORT.map((d, i) => {
              const here = view.sessions.filter((s) => s.weekday === i);
              const mine = (training?.activities ?? []).filter((a) => a.day === i);
              const over = drag?.over === `day:${i}`;
              return (
                <div key={d} data-drop={`day:${i}`}
                  className={`flex items-center gap-1.5 rounded-xl border p-1.5 transition sm:min-h-[92px] sm:flex-col sm:items-stretch sm:gap-1 sm:p-1 ${
                    over ? "border-orange-400 bg-orange-50" : i === todayIdx ? "border-orange-300 bg-orange-50/60" : "border-slate-200 bg-white"}`}>
                  <p className={`w-9 shrink-0 text-[11px] font-bold uppercase sm:w-auto sm:text-center ${i === todayIdx ? "text-orange-800" : "text-slate-400"}`}>
                    {d}
                  </p>
                  {/* The chips sit in a row beside the label on a phone and
                      stack under it on a wide screen. */}
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:contents">
                  {here.map((s) => (
                    <button key={s.id} type="button" {...handle({ kind: "session", id: s.id }, s.title)}
                      onClick={() => { setPickedDay(i); setOpenSession(s.id); }}
                      aria-label={`${s.title}, ${WEEKDAYS[i].toLowerCase()}`}
                      className={`select-none rounded-lg px-1 py-1.5 text-left text-[10px] font-bold leading-tight shadow-sm ring-1 sm:text-[11px] cursor-grab active:cursor-grabbing ${MODALITY_IS[s.modality].cls} ${shownDay === i ? "outline outline-2 outline-hc-ink" : ""}`}>
                      <span className={`mb-0.5 hidden h-1 w-5 rounded-full sm:block ${MODALITY_IS[s.modality].dot}`} />
                      <span className="block truncate sm:hidden">{s.title}</span>
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
                        onClick={() => { setPickedDay(a.day); }}
                        title={`${a.name}${a.at ? ` · ${a.at}` : ""} — ${activityFocus(a)}`}
                        aria-label={`${a.name}, ${WEEKDAYS[a.day].toLowerCase()}`}
                        className={`${onMoveActivity ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} select-none rounded-lg px-1 py-1.5 text-left text-[10px] font-bold leading-tight shadow-sm ring-1 sm:text-[11px] ${mm.cls} ${shownDay === a.day ? "outline outline-2 outline-hc-ink" : ""}`}>
                        <span className={`mb-0.5 block h-1 w-5 rounded-full ${mm.dot}`} />
                        <span className="flex items-center gap-1">
                          <ActivityIcon name={a.name} className="h-3 w-3 shrink-0" />
                          <span className="truncate">{a.name}</span>
                        </span>
                        {a.at && <span className="block text-[9px] font-normal opacity-70">{a.at}</span>}
                      </button>
                    );
                  })}
                  {/* A day that already has something can take more. Two
                      sessions on a Tuesday is a normal week — football at
                      noon and a lift in the evening — and the only way to
                      add the second used to be to find an empty day. */}
                  {onAddDay && (
                    <button type="button" onClick={() => setAddDay(i)}
                      aria-label={here.length === 0 && mine.length === 0
                        ? `Bæta við æfingu á ${WEEKDAYS[i].toLowerCase()}`
                        : `Bæta við öðru á ${WEEKDAYS[i].toLowerCase()}`}
                      className="mt-auto rounded-lg py-1 text-center text-[10px] font-semibold text-slate-400 transition hover:bg-orange-50 hover:text-orange-700">
                      {here.length === 0 && mine.length === 0
                        ? <>Hvíld <span aria-hidden className="block text-sm leading-none">+</span></>
                        : <span aria-hidden className="block text-sm leading-none">+</span>}
                    </button>
                  )}
                  {!onAddDay && here.length === 0 && mine.length === 0 && (
                    <p className="mt-auto pb-1 text-center text-[10px] text-slate-400">Hvíld</p>
                  )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* The modality tally ("Þol 1×") was here. The calendar above
              already shows what the week holds, day by day, with the colour
              and the name — counting the same sessions again underneath
              said nothing new. */}
          <p className="mt-4 text-xs text-slate-500">
            Ýttu á dag til að sjá hann. Dragðu æfingu á annan dag til að færa hana.
          </p>

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

        {/* Under the hero card, not inside it. Somebody who has just read
            the week decides to change it here. */}
        {training && onSaveTraining && (
          <ChangesButton onClick={() => setChanges(true)} />
        )}

        {editable && controls}
        {stages}

        {/* One day at a time, the one picked in the week above. The whole
            week used to be listed here as well — seven cards under a grid
            that already showed the same seven days, so the page said
            everything twice and you scrolled past five days you were not
            doing to reach the one you were. */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {shownDay === todayIdx ? "Í dag" : WEEKDAYS[shownDay]}
            </h3>
            {pickedDay !== null && pickedDay !== todayIdx && (
              <button type="button" onClick={() => setPickedDay(null)} className="text-xs font-semibold text-orange-800 hover:underline">
                Fara aftur á daginn í dag
              </button>
            )}
          </div>

          {dayActivities.length > 0 && (
            <ActivityCards activities={dayActivities} todayIdx={todayIdx} done={doneToday} onLoad={onActivityLoad}
              onComplete={onCompleteActivity} onRemove={onRemoveActivity} />
          )}

          {daySessions.map((s) => (
            <SessionCard key={s.id} s={s} today={s.weekday === todayIdx} open={openSession === s.id}
              done={!!doneToday?.has(s.id)}
              // A ride has nothing to count, so it is ticked rather than run.
              onStart={needsRunner(s.items) ? () => setRunning(s) : undefined}
              onDid={() => onFinish?.({ minutes: s.minutes ?? 45, rpe: s.modality === "hiit" ? 7 : 4, session: s })}
              onInstead={() => setSwapSession(s)}
              onToggle={() => setOpenSession(openSession === s.id ? null : s.id)}
              onRemove={onRemoveDay ? () => onRemoveDay(s.weekday) : undefined}
              dragOver={drag?.over ?? null} swapFor={swapItem?.slot ?? null}
              onSwap={(slot, it) => setSwapItem({ slot, item: it })} onUnswap={unswap}
              onDropItem={dropItem}
              onDropExtra={(i) => dropExtra(s.id, i)}
              onAdd={() => setAddTo(s)}
              dropped={(personal.drops ?? []).filter((d) => d.startsWith(`${s.id}:`))}
              onUndrop={undrop} />
          ))}

          {daySessions.length === 0 && dayActivities.length === 0 && (
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-100">
              <p className="font-semibold text-slate-800">Hvíldardagur</p>
              <p className="mt-1 text-sm text-slate-500">Ekkert á dagskrá {shownDay === todayIdx ? "í dag" : WEEKDAYS[shownDay].toLowerCase()}.</p>
              {onAddDay && (
                <button type="button" onClick={() => setAddDay(shownDay)} className={`${hcBtn.secondary} mx-auto mt-3`}>
                  Setja eitthvað á þennan dag
                </button>
              )}
            </div>
          )}
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
          onAdd={(a, inj) => { onAddDay?.(a, inj); setAddDay(null); }} />
      )}

      {changes && training && onSaveTraining && (
        <TrainingChanges settings={training} onChange={(next) => onSaveTraining(next)}
          onOpenWeek={onCustomise} onOpenProgram={onChangeProgram}
          onClose={() => setChanges(false)} />
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

      {addTo && (
        /* The same picker as a swap: adding is choosing an exercise, and a
           second way to choose one would be a second thing to learn. */
        <SwapWizard api={api} item={{ name: "", prescription: "", muscles: [], cues: [] }} injuries={training?.injuries ?? []}
          heading={`Bæta æfingu við ${addTo.title}`}
          onPick={(ex) => addItem(addTo.id, ex)}
          onClose={() => setAddTo(null)} />
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


/**
 * One card shape for everything on a day.
 *
 * A programme session and a sport were drawn as two different things: the
 * session had an orange ring, a tinted header band, a minutes pill and a
 * chevron; the sport had a slate ring, no band and no header. Two items on
 * one day therefore looked like they came from two different products.
 *
 * They are the same card now, and the colour says what it trains rather than
 * where it came from — the same modality colours the week grid above uses, so
 * an orange chip in the week opens an orange card below it.
 */
const TONE: Record<Modality, { band: string; ring: string; today: string; tile: string; ink: string; pill: string; go: string; quiet: string }> = {
  strength: { band: "bg-orange-50/70", ring: "ring-orange-100", today: "ring-orange-500", tile: "bg-orange-600", ink: "text-orange-700", pill: "text-orange-700 ring-orange-200", go: "bg-orange-600 hover:bg-orange-700", quiet: "border-orange-200 text-orange-800 hover:bg-orange-50" },
  hiit:     { band: "bg-rose-50/70",   ring: "ring-rose-100",   today: "ring-rose-500",   tile: "bg-rose-600",   ink: "text-rose-700",   pill: "text-rose-700 ring-rose-200",     go: "bg-rose-600 hover:bg-rose-700",     quiet: "border-rose-200 text-rose-800 hover:bg-rose-50" },
  cardio:   { band: "bg-sky-50/70",    ring: "ring-sky-100",    today: "ring-sky-500",    tile: "bg-sky-600",    ink: "text-sky-700",    pill: "text-sky-700 ring-sky-200",       go: "bg-sky-600 hover:bg-sky-700",       quiet: "border-sky-200 text-sky-800 hover:bg-sky-50" },
  other:    { band: "bg-slate-50",     ring: "ring-slate-200",  today: "ring-slate-500",  tile: "bg-slate-500",  ink: "text-slate-600",  pill: "text-slate-700 ring-slate-200",   go: "bg-slate-700 hover:bg-slate-800",   quiet: "border-slate-300 text-slate-800 hover:bg-slate-50" },
};

/** The shell and header both cards share. */
function ItemCard({ modality, tile, eyebrow, title, subtitle, minutes, today, id, open, onToggle, actions, children }: {
  modality: Modality;
  tile: React.ReactNode;
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  minutes?: number | null;
  today: boolean;
  id?: string;
  /** Given only when there is something to expand. */
  open?: boolean;
  onToggle?: () => void;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const t = TONE[modality];
  const m = MODALITY_IS[modality];
  const head = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white ${t.tile}`}>{tile}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-xs font-bold uppercase tracking-wide ${t.ink}`}>{eyebrow}</span>
        <span className="block font-semibold text-[#0F172A]">{title}</span>
        {subtitle && <span className="block text-xs text-slate-500">{subtitle}</span>}
      </span>
      <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 sm:inline ${m.cls}`}>{m.label}</span>
      {minutes ? <span className={`rounded-full bg-white px-3 py-1 text-xs font-semibold ring-1 ${t.pill}`}>{minutes} mín.</span> : null}
      {onToggle && <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />}
    </>
  );
  return (
    <div id={id} className={`scroll-mt-24 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ${today ? `ring-2 ${t.today}` : t.ring}`}>
      {onToggle
        ? <button type="button" onClick={onToggle} aria-expanded={open}
            className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left ${t.band}`}>{head}</button>
        : <div className={`flex w-full items-center gap-3 px-4 py-3 ${t.band} ${actions || children ? "border-b border-slate-100" : ""}`}>{head}</div>}
      {actions}
      {children}
    </div>
  );
}

function SessionCard({ s, today, open, onToggle, onStart, onDid, done, onInstead, onRemove, dragOver, swapFor, onSwap, onUnswap, onDropItem, onDropExtra, onAdd, dropped = [], onUndrop }: {
  s: PSession; today: boolean; open: boolean; onToggle: () => void;
  dragOver: string | null; swapFor: string | null;
  /** Opens the runner — only for sessions with sets or intervals to count. */
  onStart?: () => void;
  /** Marks it done without a runner, for a ride or a walk. */
  onDid?: () => void;
  /** Already marked done today. */
  done?: boolean;
  /** "I did something else today." */
  onInstead?: () => void;
  /** Undefined on the reading surface: swapping lives in the change sheet. */
  onSwap?: (slot: string, item: ExerciseItem) => void;
  onUnswap: (slot: string) => void;
  /** Takes this whole day off the programme. */
  onRemove?: () => void;
  /** Takes one exercise out of the session. */
  onDropItem?: (slot: string) => void;
  /** Takes out one the participant had added. */
  onDropExtra?: (i: number) => void;
  /** Opens the library to add one. */
  onAdd?: () => void;
  /** Slots currently removed from this session. */
  dropped?: string[];
  onUndrop?: (slot: string) => void;
}) {
  const blocks = (["warmup", "main", "finisher"] as ExerciseBlock[])
    .map((key) => ({ key, items: s.items.filter((it) => (it.block ?? "main") === key) }))
    .filter((b) => b.items.length);
  return (
    <ItemCard
      id={`session-${s.id}`}
      modality={s.modality}
      tile={<Dumbbell className="h-5 w-5" aria-hidden />}
      eyebrow={`${s.day}${today ? " · í dag" : ""}`}
      title={<>{s.title}{s.focus ? <span className="font-normal text-slate-500"> · {s.focus}</span> : null}</>}
      minutes={s.minutes}
      today={today}
      open={open}
      onToggle={onToggle}
      /* The point of the page. Today's session gets the solid button; the
         others get a quiet one, because doing Thursday's workout on Monday
         is allowed but is not what we are suggesting. */
      actions={(onStart || onDid) && (
        <div className="border-b border-slate-100 px-4 py-3">
          {done ? (
            <p className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 font-bold text-emerald-800 ring-1 ring-emerald-200">
              <Check className="h-4 w-4" aria-hidden /> Búið í dag
            </p>
          ) : onStart ? (
            <button type="button" onClick={onStart}
              className={today
                ? `flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold text-white transition ${TONE[s.modality].go}`
                : `flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 font-semibold transition ${TONE[s.modality].quiet}`}>
              <Play className="h-4 w-4" aria-hidden /> Byrja æfinguna
            </button>
          ) : (
            /* Nothing to count, so nothing to run — you did it or you did not. */
            <button type="button" onClick={onDid}
              className={today
                ? `flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold text-white transition ${TONE[s.modality].go}`
                : `flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 font-semibold transition ${TONE[s.modality].quiet}`}>
              <Check className="h-4 w-4" aria-hidden /> Ég gerði þetta
            </button>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {onInstead && !done && (
              <button type="button" onClick={onInstead}
                className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
                Ég geri eitthvað annað í dag
              </button>
            )}
            {onRemove && (
              <button type="button" onClick={onRemove}
                className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-red-700 hover:underline">
                Taka þennan dag af
              </button>
            )}
          </div>
        </div>
      )}
    >
      {/* What this kind of training loads and where it tends to go wrong.
          Collapsed by default: useful the first few times, noise after. */}
      {open && <SessionGuide name={typeof s.title === "string" ? s.title : String(s.title)} modality={s.modality} />}
      {open && (
        <div className="divide-y divide-slate-100">
          {blocks.map((b) => (
            <div key={b.key} className="px-3 py-3 sm:px-4">
              {blocks.length > 1 && <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{BLOCK_IS[b.key]}</p>}
              <ul className="space-y-2">
                {b.items.map((it, j) => <ExerciseRow key={it.slot ?? j} it={it} over={!!it.slot && dragOver === `slot:${it.slot}`}
                  choosing={!!it.slot && swapFor === it.slot} onSwap={onSwap} onUnswap={onUnswap}
                  onDrop={it.added
                    ? () => onDropExtra?.(Number(/x(\d+)$/.exec(it.slot ?? "")?.[1] ?? -1))
                    : onDropItem && it.slot ? () => onDropItem(it.slot!) : undefined} />)}
              </ul>
              {/* Adding and putting back live at the foot of the main block,
                  where the list they change ends. */}
              {b.key === "main" && (onAdd || dropped.length > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {onAdd && (
                    <button type="button" onClick={onAdd}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline">
                      <Plus className="h-3.5 w-3.5" aria-hidden /> Bæta við æfingu
                    </button>
                  )}
                  {dropped.length > 0 && onUndrop && (
                    <button type="button" onClick={() => dropped.forEach((d) => onUndrop(d))}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:underline">
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Sækja aftur {dropped.length} sem þú tókst út
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ItemCard>
  );
}

const canSwap = (it: ExerciseItem) => !!it.slot && !/^hiit|—\s*lotur$/i.test(it.name) && it.name !== "Upphitun";

function ExerciseRow({ it, over, choosing, onSwap, onUnswap, onDrop }: { it: ExerciseItem; over: boolean; choosing: boolean; onSwap?: (slot: string, item: ExerciseItem) => void; onUnswap: (slot: string) => void; onDrop?: () => void }) {
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
            {onDrop && (
              <button type="button" onClick={onDrop} aria-label={`Taka ${it.name} út úr æfingunni`}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 text-slate-500 transition hover:bg-red-50 hover:text-red-700">
                <X className="h-3.5 w-3.5" aria-hidden /> Taka út
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
function ActivityCards({ activities, todayIdx, onComplete, onRemove, onLoad, done }: {
  activities: Activity[]; todayIdx: number; onComplete?: (a: Activity) => void;
  onRemove?: (id: string) => void;
  /** Nudge this one session heavier or lighter, −2…+2. */
  onLoad?: (id: string, load: number) => void;
  /** Ids marked done today. */
  done?: Set<string>;
}) {
  const sorted = [...activities].sort((a, b) => a.day - b.day || (a.at ?? "").localeCompare(b.at ?? ""));
  return (
    <>
      {sorted.map((a) => {
        const am = activityModality(a);
        const today = a.day === todayIdx;
        return (
          <ItemCard key={a.id}
            modality={am === "other" ? "other" : am}
            tile={<ActivityIcon name={a.name} />}
            eyebrow={`${WEEKDAYS[a.day]}${today ? " · í dag" : ""}${a.at ? ` · ${a.at}` : ""}`}
            title={a.name}
            subtitle={`${activityFocus(a)} · þitt eigið`}
            minutes={a.minutes}
            today={today}
            actions={(onComplete || onRemove) && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-3">
                {done?.has(a.id) ? (
                  <p className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 font-bold text-emerald-800 ring-1 ring-emerald-200">
                    <Check className="h-4 w-4" aria-hidden /> Búið í dag
                  </p>
                ) : onComplete && (
                  <button type="button" onClick={() => onComplete(a)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 transition hover:bg-slate-50">
                    <Check className="h-4 w-4" aria-hidden /> Ég gerði þetta
                  </button>
                )}
                {/* Álag on the session itself. The programme has a global
                    load dial, but a person who finds Friday's lift too heavy
                    means Friday's lift — not every session this month. */}
                {onLoad && a.focus && (
                  <div className="flex w-full items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2">
                    <span className="text-xs font-semibold text-slate-600">
                      Álag
                      <span className="ml-1.5 font-normal text-slate-500">{LOAD_IS[a.load ?? 0] ?? "eins og venjulega"}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <button type="button" aria-label="Minnka álag" disabled={(a.load ?? 0) <= -2}
                        onClick={() => onLoad(a.id, Math.max(-2, (a.load ?? 0) - 1))}
                        className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200 disabled:opacity-30">−</button>
                      <span className="w-6 text-center text-sm font-bold tabular-nums text-slate-900">
                        {(a.load ?? 0) > 0 ? `+${a.load}` : a.load ?? 0}
                      </span>
                      <button type="button" aria-label="Auka álag" disabled={(a.load ?? 0) >= 2}
                        onClick={() => onLoad(a.id, Math.min(2, (a.load ?? 0) + 1))}
                        className="grid h-8 w-8 place-items-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200 disabled:opacity-30">+</button>
                    </span>
                  </div>
                )}
                {onRemove && (
                  <button type="button" onClick={() => onRemove(a.id)}
                    className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-red-700 hover:underline">
                    Taka þetta af
                  </button>
                )}
              </div>
            )} />
        );
      })}
    </>
  );
}
