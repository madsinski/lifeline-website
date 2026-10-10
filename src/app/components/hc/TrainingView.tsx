"use client";

// "Æfingar": the participant's exercise programme, arranged their way.
//   • the week in the hero — drag a session to another day (or tap it and pick)
//   • HIIT on its own days, when the programme carries it inside strength days
//   • swap any exercise for one from the library (drag a card onto it, or
//     "Skipta" and tap), with the library's pictures, video and how-to
// Saved to hc_training_settings through onSave (src/lib/hc/personalise.ts).

import React, { useMemo, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, Plus, Sliders, X, Dumbbell, Play, RotateCcw, Sparkles } from "lucide-react";
import { needsRunner } from "@/lib/hc/workout";
import { hiitOnAt, itemsForFocus, LOAD_IS, trainingScore } from "@/lib/hc/adaptive-program";
import { canSplitHiit, MODALITY_IS, personalise, weekdayOf, WEEKDAYS, WEEKDAYS_SHORT, type Modality, type Personal, type PSession, type SwapSnapshot } from "@/lib/hc/personalise";
import { BLOCK_IS, EQUIPMENT_IS, muscleIs } from "@/lib/hc/exercise-labels";
import type { ActionPlan, ExerciseBlock, ExerciseItem } from "@/lib/hc/types";
import { activityFocus, activityModality, hardDays, stageAt, type Activity, type TrainingSettings } from "@/lib/hc/adaptive-program";
import { DragGhost, useDrag } from "./useDrag";
import SwapWizard from "./SwapWizard";
import SessionGuide from "./SessionGuide";
import SessionBuilder from "./SessionBuilder";
import TrainingChanges from "./TrainingChanges";
import WeekBalance from "./WeekBalance";
import Sheet from "./Sheet";
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


export default function TrainingView({ api, exercise, personal, onSave, controls, stages, training, planStart, onFinish, body, onInstead, onAddDay,
  onCompleteActivity, onMoveActivity, onActivityLoad, onActivityTime, onSaveTraining, onRemoveActivity, onRemoveDay, doneToday }: {
  api: Api;
  /** The programme as written (adaptive ones already computed for the settings). */
  exercise: PlanExercise;
  personal: Personal;
  /** Save a change (days / hiit_split / swaps). */
  onSave: (p: Personal) => void;
  /** Level / load / injury controls for the adaptive programme. */
  controls?: React.ReactNode;
  stages?: React.ReactNode;
  /**
   * Opens the "Hvað viltu breyta?" sheet. When given, this page is for doing
   * the training: the dials, the drag-and-drop and the exercise swapping all
   * move behind that one button.
   */
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
  /** Change the time on one session, or clear it. */
  onActivityTime?: (id: string, at: string | null) => void;
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
  /** The stage-and-balance sleeve. */
  const [detail, setDetail] = useState(false);
  /** The activity chip whose controls are open, if any. */
  const [editing, setEditing] = useState<string | null>(null);
  /** The lift whose exercise list is open for editing. */
  const [building, setBuilding] = useState<Activity | null>(null);
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
  /**
   * The calendar edits in place.
   *
   * It used to be read-only here, with a separate "Breyta" mode rendering
   * the same grid again in a sheet — so the page showed you a week you
   * could not touch and offered a button to show it to you again, editable.
   * The grid is the editor now.
   */
  const editable = true;

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
  // Today's sessions and tomorrow's were computed here for the hero's own
  // "Í dag" block. The block is gone — the day card at the top of the page
  // carries the real thing — so the hero no longer needs its own copy.
  const stage = training ? stageAt(training, planStart ?? null) : null;
  /**
   * The week's balance, scored across everything in it. hiitOn gates the
   * HIIT row: during adaptation, or while cardio is limited, intervals are
   * not on the table yet and a zero there would mark somebody down for
   * correctly not doing them.
   */
  const balance = training
    ? trainingScore(training, hiitOnAt(training, planStart ?? null), view.sessions)
    : null;

  return (
    <div className="min-w-0 space-y-6">
        {/* Today first. The hero used to open with its own "Í dag" block —
            the title, the focus, tomorrow as a chip — and this card sat at
            the foot of the page carrying the same day plus the exercises,
            the weights and the start button. The copy went; the real one
            came up here, which is what the page is for. */}
        {/* One day at a time, the one picked in the week below. The whole
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
              onBuild={onSaveTraining && training ? (a) => setBuilding(a) : undefined}
              onRun={training ? (a) => {
                // A lift the person put in the week is a training day like
                // any other: the focus they chose decides the movements, and
                // strengthItem applies their stage, load, place and injuries.
                if (!a.focus) return;
                setRunning({
                  id: a.id, title: a.name, day: WEEKDAYS[a.day], weekday: a.day,
                  modality: "strength", minutes: a.minutes ?? 60,
                  items: itemsForFocus(a.focus, training, planStart ?? null, a.load ?? 0, a.slots),
                } as PSession);
              } : undefined}
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
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
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

        <section className="overflow-hidden rounded-3xl border border-orange-200 bg-white p-5 shadow-sm sm:p-6">
          {/* The name and the pill are one line.
              They were two columns of a space-between row, so the pill sat
              against the far edge and aligned with the kicker above the
              name rather than with the name itself — two things at opposite
              ends of a line read as two things. Sitting next to the name,
              on its baseline, it reads as what it is: the way into this
              programme. */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Æfingaáætlunin mín</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h2 className="min-w-0 text-2xl font-bold text-slate-900">{exercise.name}</h2>
              {/* One pill, one sleeve.
                  There were three ways in — "Breytingar", a stage link and
                  "Skipta um æfingaáætlun" — for three views of one subject:
                  the programme. Everything about it is behind this, in the
                  order you would ask: where am I, how is the week, what do
                  I change. */}
              {training && onSaveTraining && (
                <button type="button" onClick={() => setDetail(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-900 ring-1 ring-orange-200 transition hover:bg-orange-200">
                  <Sliders className="h-3.5 w-3.5" aria-hidden /> Prógrammið
                </button>
              )}
            </div>
          </div>

          {/* The hero carried an "Í dag" block — the day's title, its focus,
              tomorrow as a chip. The day card below it says all of that and
              carries the exercises, the weights and the start button, so the
              hero was a worse copy of the thing directly underneath it. */}

          {/* The stage line and its progress pips were here. They moved
              into the card below, which already answers the same question
              one layer out: is this going anywhere, and is this week right. */}

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
                  className={`relative flex items-center gap-1.5 rounded-xl border p-1.5 transition sm:min-h-[92px] sm:flex-col sm:items-stretch sm:gap-1 sm:p-1 ${
                    over ? "border-orange-400 bg-orange-50" : i === todayIdx ? "border-orange-300 bg-orange-50/60" : "border-slate-200 bg-white"}`}>
                  <p className={`w-9 shrink-0 text-[11px] font-bold uppercase sm:w-auto sm:text-center ${i === todayIdx ? "text-orange-800" : "text-slate-400"}`}>
                    {d}
                  </p>
                  {/* The chips sit in a row beside the label on a phone and
                      stack under it on a wide screen. */}
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:contents">
                  {here.map((s) => (
                    <React.Fragment key={s.id}>
                    <button type="button" {...handle({ kind: "session", id: s.id }, s.title)}
                      onClick={() => { setPickedDay(i); setOpenSession(s.id); setEditing(editing === s.id ? null : s.id); }}
                      aria-label={`${s.title}, ${WEEKDAYS[i].toLowerCase()}`}
                      className={`flex min-h-10 select-none flex-col justify-center rounded-lg px-2 py-1 text-left text-[11px] font-bold leading-tight shadow-sm ring-1 cursor-grab active:cursor-grabbing ${MODALITY_IS[s.modality].cls} ${shownDay === i ? "outline outline-2 outline-hc-ink" : ""}`}>
                      <span className="block truncate">{s.title}</span>
                      {/* What it trains, under the name. The little coloured
                          bar that used to sit here said the same thing in a
                          code nobody has the key to. */}
                      <span className="block truncate text-[10px] font-semibold opacity-70">
                        {MODALITY_IS[s.modality].label}
                        {s.minutes ? ` · ${s.minutes} mín` : ""}
                      </span>
                    </button>
                      {/* The programme's own sessions get the same panel
                          the person's activities do — tapping one and
                          having nothing happen is the inconsistency, not
                          the panel. Different controls, because a generated
                          session has no time of its own and is not swapped
                          one-for-one: opening it and taking the day off are
                          what there is to do. */}
                      {editing === s.id && (
                        <span className="order-last w-full rounded-lg bg-white p-2 ring-1 ring-slate-200 sm:absolute sm:left-0 sm:top-full sm:z-30 sm:mt-1 sm:w-56 sm:p-2.5 sm:shadow-xl sm:ring-slate-300">
                          <span className="flex items-center gap-1.5 sm:flex-col sm:items-stretch sm:gap-2">
                            <button type="button"
                              onClick={() => { setEditing(null); document.getElementById(`session-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 sm:w-full sm:py-1.5 sm:text-xs">
                              Sjá æfinguna
                            </button>
                            {onRemoveDay && (
                              <button type="button" aria-label={`Taka ${WEEKDAYS[i].toLowerCase()} af`}
                                onClick={() => { onRemoveDay(i); setEditing(null); }}
                                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50 sm:w-full sm:py-1.5 sm:text-xs">
                                Taka daginn af
                              </button>
                            )}
                          </span>
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                  {/* Sessions the person put in the week themselves. They
                      used to be drawn and labelled as something apart —
                      "þitt eigið" — but a Thursday football match is as much
                      the week's training as a prescribed lift. There is one
                      programme, and this is it. */}
                  {mine.map((a) => {
                    const am = activityModality(a);
                    const mm = MODALITY_IS[am === "other" ? "other" : am];
                    return (
                      <React.Fragment key={a.id}>
                      <button type="button" {...(onMoveActivity ? handle({ kind: "activity", id: a.id }, a.name) : {})}
                        onClick={() => { setPickedDay(a.day); setEditing(editing === a.id ? null : a.id); }}
                        title={`${a.name}${a.at ? ` · ${a.at}` : ""} — ${activityFocus(a)}`}
                        aria-label={`${a.name}, ${WEEKDAYS[a.day].toLowerCase()}`}
                        className={`${onMoveActivity ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} flex min-h-10 select-none flex-col justify-center rounded-lg px-2 py-1 text-left text-[11px] font-bold leading-tight shadow-sm ring-1 ${mm.cls} ${shownDay === a.day ? "outline outline-2 outline-hc-ink" : ""}`}>
                        <span className="flex items-center gap-1">
                          <ActivityIcon name={a.name} className="h-3 w-3 shrink-0" />
                          <span className="truncate">{a.name}</span>
                        </span>
                        {/* Everything it covers, not just the headline one:
                            CrossFit is strength AND hiit, and a week that
                            counts it once is a week that double-books. */}
                        <span className="block truncate text-[10px] font-semibold opacity-70">
                          {(a.covers?.length ? a.covers : [am])
                            .map((c) => MODALITY_IS[c]?.label ?? c)
                            .join(" + ")}
                          {a.at ? ` · ${a.at}` : ""}
                        </span>
                      </button>
                      {/* Tapped: time, swap, remove — in place, because
                          sending somebody to a settings page to move a
                          football match by an hour is a trip for nothing. */}
                      {/*
                        * Inline on a phone, a popover on a wide screen.
                        *
                        * A phone draws each day as a full-width row, so
                        * the controls have the whole width to sit in. The
                        * grid gives a day about 110px, and a time field
                        * next to two buttons does not go in 110px — they
                        * came out stacked and clipped. So from sm up this
                        * floats out of the column at its own width and the
                        * grid stops constraining it.
                        */}
                      {editing === a.id && (
                        <span className="order-last w-full rounded-lg bg-white p-2 ring-1 ring-slate-200 sm:absolute sm:left-0 sm:top-full sm:z-30 sm:mt-1 sm:w-56 sm:p-2.5 sm:shadow-xl sm:ring-slate-300">
                          <span className="flex items-center gap-1.5 sm:flex-col sm:items-stretch sm:gap-2">
                            <input type="time" defaultValue={a.at ?? ""} aria-label={`Klukkan fyrir ${a.name}`}
                              onChange={(e) => onActivityTime?.(a.id, e.target.value || null)}
                              className="min-w-0 flex-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] outline-none sm:w-full sm:flex-none sm:py-1.5 sm:text-xs" />
                            <button type="button" aria-label={`Skipta um ${a.name}`}
                              onClick={() => { onRemoveActivity?.(a.id); setAddDay(a.day); setEditing(null); }}
                              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 sm:w-full sm:py-1.5 sm:text-xs">
                              Skipta um
                            </button>
                            <button type="button" aria-label={`Taka ${a.name} af`}
                              onClick={() => { onRemoveActivity?.(a.id); setEditing(null); }}
                              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50 sm:w-full sm:py-1.5 sm:text-xs">
                              Taka af
                            </button>
                          </span>
                        </span>
                      )}
                    </React.Fragment>
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
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base font-semibold text-slate-400 ring-1 ring-slate-200 transition hover:bg-orange-50 hover:text-orange-700 sm:mt-auto sm:h-7 sm:w-full">
                      <span aria-hidden>+</span>
                    </button>
                  )}
                  {here.length === 0 && mine.length === 0 && (
                    <p className="flex min-h-9 items-center text-[11px] text-slate-400 sm:mt-auto sm:min-h-0 sm:justify-center sm:pb-1">Hvíld</p>
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
        {/* What the week is made of. Directly under the hero and the
            Breytingar button, because a gap here is a thing you fix there. */}


        {editable && controls}
        {stages}

        {/* The programme paragraph and its principles were a second
            disclosure down here, also called "Um áætlunina", repeating what
            the card above says: that paragraph gives the strength dose and
            calls zone 2 the base, which the card's own rows already show as
            numbers and its quality lines were restating in words. One
            disclosure, in the card that owns the subject. */}

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

      {/* No onOpenWeek any more: the week that entry used to open is this
          page's own calendar, a scroll up. */}
      {building?.focus && training && onSaveTraining && (
        <SessionBuilder
          name={building.name} focus={building.focus} slots={building.slots ?? null}
          settings={training} planStart={planStart ?? null} load={building.load ?? 0}
          onClose={() => setBuilding(null)}
          onSave={(keys) => {
            onSaveTraining({
              ...training,
              activities: training.activities.map((x) => (x.id === building.id ? { ...x, slots: keys } : x)),
            });
            setBuilding(null);
          }} />
      )}

      {/* Where you are, how the week looks, and what you can change —
          in that order, in one sleeve. They were three places before, and
          the order is the order somebody asks the questions in. */}
      {detail && training && onSaveTraining && (
        <Sheet title="Prógrammið" onClose={() => setDetail(false)} canvas>
          <div className="space-y-3 p-3 sm:p-4">
            {balance && (
              <WeekBalance score={balance} stage={stage}
                description={exercise.description} principles={exercise.principles} />
            )}
            <TrainingChanges settings={training} onChange={(next) => onSaveTraining(next)} inline />
          </div>
        </Sheet>
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
function ItemCard({ modality, tile, eyebrow, title, subtitle, minutes, today, id, open, onToggle, actions, guide, children }: {
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
  /** The collapsed "what this loads / warm-up / cool-down" block. */
  guide?: React.ReactNode;
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
        : <div className={`flex w-full items-center gap-3 px-4 py-3 ${t.band} ${actions || guide || children ? "border-b border-slate-100" : ""}`}>{head}</div>}
      {actions}
      {guide}
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
  /**
   * The one exercise that IS the session, if that is what this is.
   *
   * Matched on the name rather than just "one item", because a one-exercise
   * strength session is still a real exercise with an illustration and a
   * swap worth offering. The cardio case is different: the name is the
   * session's own name, so the row repeats the heading above it.
   */
  const soleExercise = s.items.length === 1
    && s.items[0].name.trim().toLowerCase() === String(s.title).trim().toLowerCase()
    ? s.items[0] : null;
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
                Gera annað
              </button>
            )}
            {onRemove && (
              <button type="button" onClick={onRemove}
                className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-red-700 hover:underline">
                Taka daginn af
              </button>
            )}
          </div>
        </div>
      )}
    >
      {/* What this kind of training loads and where it tends to go wrong.
          Collapsed by default: useful the first few times, noise after. */}
      {open && <SessionGuide name={typeof s.title === "string" ? s.title : String(s.title)} modality={s.modality} />}

      {/*
        * A session that IS its one exercise.
        *
        * Zone 2 and HIIT come out of the builder as a single item whose name
        * is the session's name — so the full exercise-list treatment printed
        * "Þrekhjól með hóflegri mótstöðu" as the heading, again as the only
        * row, and a third time as its own alternative, wrapped in an image
        * tile, a block header and swap/take-out/add controls. That is how a
        * 45-minute bike ride became the tallest card on the page.
        *
        * Here it is the prescription and the cues, inline. Taking the only
        * exercise out of a session is not a thing anybody means either —
        * "Taka þennan dag af" above is what that is — so those controls go
        * with it.
        */}
      {open && soleExercise && (
        <div className="space-y-1.5 px-3 py-3 sm:px-4">
          {soleExercise.prescription && <p className="font-semibold text-slate-900">{soleExercise.prescription}</p>}
          {soleExercise.note && <p className="text-sm leading-snug text-slate-600">{soleExercise.note}</p>}
          {soleExercise.cues?.length ? (
            <ul className="space-y-0.5 pt-0.5">
              {soleExercise.cues.slice(0, 4).map((c, i) => (
                <li key={i} className="text-sm leading-snug text-slate-600">· {c}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {open && !soleExercise && (
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
function ActivityCards({ activities, todayIdx, onComplete, onRemove, onLoad, onRun, onBuild, done }: {
  activities: Activity[]; todayIdx: number; onComplete?: (a: Activity) => void;
  onRemove?: (id: string) => void;
  /** Nudge this one session heavier or lighter, −2…+2. */
  onLoad?: (id: string, load: number) => void;
  /** Start it as a real workout — only a lift has movements to run. */
  onRun?: (a: Activity) => void;
  /** Open its exercise list for editing. */
  onBuild?: (a: Activity) => void;
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
            subtitle={activityFocus(a)}
            minutes={a.minutes}
            today={today}
            /* What this kind of training loads, where it tends to go wrong,
               and what to do before and after. The prescribed sessions have
               had this since it was written; the person's own football and
               CrossFit are the sessions most likely to hurt them and had
               nothing. Same component, same collapsed-by-default. */
            guide={<SessionGuide name={a.name} modality={am} />}
            actions={(onComplete || onRemove) && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-3">
                {done?.has(a.id) ? (
                  <p className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 font-bold text-emerald-800 ring-1 ring-emerald-200">
                    <Check className="h-4 w-4" aria-hidden /> Búið í dag
                  </p>
                ) : (
                  <span className="flex w-full flex-col gap-2">
                    {/* One primary, solid in the day's own colour when it
                        is today and outlined when it is not — the same rule
                        the prescribed card follows. */}
                    {onRun && a.focus ? (
                      <button type="button" onClick={() => onRun(a)}
                        className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 font-bold text-white transition ${today ? "py-3" : "py-2.5"} ${TONE[am === "other" ? "other" : am].go}`}>
                        <Play className="h-4 w-4" aria-hidden /> Byrja æfinguna
                      </button>
                    ) : onComplete ? (
                      <button type="button" onClick={() => onComplete(a)}
                        className={today
                          ? `flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold text-white transition ${TONE[am === "other" ? "other" : am].go}`
                          : `flex w-full items-center justify-center gap-2 rounded-2xl border bg-white px-4 py-2.5 font-semibold transition ${TONE[am === "other" ? "other" : am].quiet}`}>
                        <Check className="h-4 w-4" aria-hidden /> Ég gerði þetta
                      </button>
                    ) : null}

                    {/* Everything else as quiet links on one line, the way
                        the prescribed card already does it. Three stacked
                        blocks of equal weight made every card a menu with
                        no answer to "what do I press". */}
                    <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-0.5">
                      {onBuild && a.focus && (
                        <button type="button" onClick={() => onBuild(a)}
                          className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
                          Sjá æfingar
                        </button>
                      )}
                      {onRun && a.focus && onComplete && (
                        <button type="button" onClick={() => onComplete(a)}
                          className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline">
                          Ég gerði þetta
                        </button>
                      )}
                      {onRemove && (
                        <button type="button" onClick={() => onRemove(a.id)}
                          className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-red-700 hover:underline">
                          Taka af
                        </button>
                      )}
                    </span>
                  </span>
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
              </div>
            )} />
        );
      })}
    </>
  );
}
