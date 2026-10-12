"use client";

// "Í dag" — the participant's actions: tick today, fill in a missed day, open
// what the action is about (the workout, the meals, the fræðsla), leave a note
// for the nurse, set something aside.
//
// Every tap shows at once. Writes go to the server one after another in the
// background; if one fails the view rolls back and says so. The server's
// answer only replaces the local state when nothing else is waiting, so fast
// tapping never flickers.

import * as cache from "@/lib/hc/client-cache";
import ActionSheet from "./ActionSheet";
import Sheet from "./Sheet";
import MealLogger from "./MealLogger";
import { Recipe } from "./NutritionView";
import { type Meal, type MealSlot } from "@/lib/hc/meals";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, EyeOff, Loader2, Plus, RotateCcw } from "lucide-react";
import { PILLAR_META, type ActionPlan, type Pillar, type PlanItem, type WhenOfDay } from "@/lib/hc/types";
import { Sun, Sunrise, Moon, Clock } from "lucide-react";
import { useSwipe } from "@/lib/hc/use-swipe";
import { useReorder } from "@/lib/hc/use-reorder";

/**
 * The parts of the day, in the order they happen.
 *
 * Colour is deliberately dawn → noon → dusk rather than the pillar palette:
 * the pillars still own the rows, and a second use of their colours on the
 * headings would make two different things look like one.
 */
/*
 * Three sections, not four.
 *
 * "Allan daginn" was a fourth bucket for everything with no hour attached,
 * and it collected the majority — eleven of Mads' nineteen items — so the
 * page's biggest section was the one that said the least about when to do
 * anything. Anything without an hour belongs to the day, which is what
 * "Dagur" means, so it goes there and the fourth heading is gone.
 *
 * WhenOfDay still has "anytime" as a stored value: it is what the database
 * holds for an untagged module, and retagging nineteen rows to say the same
 * thing would be a migration to change a label.
 */
const WHEN_ORDER: WhenOfDay[] = ["morning", "midday", "evening"];

/**
 * Which meals belong to which part of the day.
 *
 * Straight from what the plan's slots already mean — breakfast is the
 * morning, dinner is the evening — rather than a second schedule invented
 * here. The optional second snack goes with dinner, since that is when
 * somebody who added one tends to eat it.
 */
/**
 * Habits that eating the planned meal actually completes.
 *
 * Mads asked for a meal tick to satisfy its habit. The list is two entries
 * long on purpose: of the 22 nutrition habits in the library, these are the
 * only ones where eating what the plan laid out is the same act as keeping
 * the habit. "D-vítamín yfir veturinn", "Feitur fiskur tvisvar í viku",
 * "Minna salt", "Vatn í stað sykraðra drykkja" — eating breakfast says
 * nothing about any of them, and ticking them off the back of a meal would
 * be the app claiming somebody did something they did not.
 *
 *   naering-protein-morgunmatur  breakfast alone. The plan's breakfast is
 *                                chosen against the protein target, so
 *                                eating it *is* a protein-rich breakfast.
 *   naering-protein              every meal of the day, because the habit
 *                                is "prótein í hverri máltíð" — one meal
 *                                does not finish it.
 *
 * Two more were tempting and left out: "Skipulag máltíða" and
 * "Diskaaðferðin" are arguably satisfied by following the plan, and
 * arguably not, and a judgement call that silently ticks something is worse
 * than one the person makes themselves.
 *
 * Only ever ticks. Unticking a meal leaves the habit ticked, for somebody
 * to clear if they want: a tick that vanishes because of an unrelated tap
 * is more alarming than one that stays.
 */
const MEAL_SATISFIES: { key: string; slots: MealSlot[]; needsAll?: boolean }[] = [
  { key: "naering-protein-morgunmatur", slots: ["breakfast"] },
  { key: "naering-protein", slots: ["breakfast", "lunch", "snack", "dinner"], needsAll: true },
];

const MEAL_WHEN: Record<WhenOfDay, MealSlot[]> = {
  morning: ["breakfast"],
  midday: ["lunch", "snack"],
  evening: ["dinner", "snack2"],
  anytime: [],
};
const WHEN_META: Record<WhenOfDay, { label: string; ink: string; soft: string; Icon: typeof Sun }> = {
  morning: { label: "Morgunn", ink: "#B45309", soft: "#FEF3C7", Icon: Sunrise },
  midday: { label: "Dagur", ink: "#0369A1", soft: "#E0F2FE", Icon: Sun },
  evening: { label: "Kvöld", ink: "#5B21B6", soft: "#EDE9FE", Icon: Moon },
  anytime: { label: "Allan daginn", ink: "#334155", soft: "#F1F5F9", Icon: Clock },
};

import { isoDay, lastDays, weekDays, type ActionLog, type ActionPref } from "@/lib/hc/adherence";
import { type PersonalExercise, type PSession } from "@/lib/hc/personalise";
import { trainingOn } from "@/lib/hc/todays-training";
import type { Activity, TrainingSettings } from "@/lib/hc/adaptive-program";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

// Monday-first, matching the exercise and meal calendars. Indexed by
// Date#getDay(), which is Sunday-first, hence the order.

export interface ActionLinks {
  /** Opens the exercise programme at today's session. */
  exercise?: (() => void) | null;
  /** Opens today's meals. */
  nutrition?: (() => void) | null;
  /** A fræðsla for the action's pillar, if the plan has one. */
  lecture?: (p: Pillar) => { title: string; href: string } | null;
}

export default function MyActions({ api, journeyId, plan, logs: initialLogs, prefs: initialPrefs, links, onAddAction, meals, onEditPillar,
  exercise, training, doneToday, onCompleteSession, onCompleteActivity, onLogs, onCounts }: {
  api: Api;
  journeyId: string;
  plan: ActionPlan;
  logs: ActionLog[];
  prefs: ActionPref[];
  links?: ActionLinks;
  /**
   * Append one library action to the plan, by key.
   *
   * The server does the appending (/api/hc/my-plan with add_key) so this
   * screen never holds the whole plan in order to add one habit to it.
   */
  onAddAction?: (key: string) => Promise<void>;
  /**
   * Today's meals from the Næring plan, keyed by slot.
   *
   * Næring plans the week and this is where "did I" lives. The meal
   * checklist used to be on Næring, so taking it off that page left ticking
   * with no home; the right home was always the checklist that holds every
   * other habit. Writes go to meal_log through MealLogger, which owns them.
   */
  meals?: Record<MealSlot, Meal | null> | null;
  /** Opens the plan editor with this pillar already chosen. */
  onEditPillar?: (p: Pillar) => void;
  /**
   * The exercise programme, which is the authority on what training happens
   * on which day. Í dag used to list the plan's exercise MODULES, which are
   * the same every day — so a Saturday with no session still showed
   * "Styrktarþjálfun", and a Monday showed it without saying it was Upper A.
   */
  exercise?: PersonalExercise | null;
  /** Their own commitments, so the checklist shows the same week the calendar does. */
  training?: TrainingSettings | null;
  /** Session ids and titles already finished today. */
  doneToday?: Set<string>;
  /** Tick a session off here exactly as Æfingar would. */
  onCompleteSession?: (s: PSession) => void;
  /** Ticking off a commitment they added themselves. */
  onCompleteActivity?: (a: Activity) => void;
  /**
   * Ticks live here, in optimistic local state, but the day's count is
   * drawn in a card outside this component. Without this the card read
   * "0 af 18" no matter how many boxes were ticked — it was watching the
   * page's copy of the logs, which a tick never touches.
   */
  onLogs?: (logs: ActionLog[]) => void;
  /**
   * Today's totals, for the Staðan ring and sleeve.
   *
   * The page was counting plan.modules directly, which knows nothing about
   * the two filters this component applies: items the person has set aside,
   * and exercise habits the programme supersedes. So setting something
   * aside left the ring still counting it — the list said five things and
   * the ring said seven.
   *
   * Reported from here rather than reimplemented there, because the
   * component that owns the list is the only thing that knows what is in
   * it. Same reason onLogs exists.
   */
  onCounts?: (counts: { done: number; of: number }) => void;
}) {
  const [logs, setLogs] = useState<ActionLog[]>(initialLogs);
  const [prefs, setPrefs] = useState<ActionPref[]>(initialPrefs);
  const [showHidden, setShowHidden] = useState(false);
  const [sheet, setSheet] = useState<PlanItem | null>(null);
  /**
   * Which pillars are open. All of them to begin with: somebody arriving to
   * tick something off should see the things, not four closed drawers.
   */
  const [shut, setShut] = useState<Set<string>>(() => new Set());
  const [err, setErr] = useState("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const waiting = useRef(0);
  const [today] = useState(() => isoDay());
  const [week] = useState(() => weekDays());

  /** Apply now, send in order, roll back on failure. */
  const send = (body: Record<string, unknown>, apply: () => void, undo: () => void) => {
    apply();
    setErr("");
    waiting.current += 1;
    queue.current = queue.current.then(async () => {
      let ok = false;
      let j: { logs?: ActionLog[]; prefs?: ActionPref[] } = {};
      try {
        const r = await api("/api/hc/actions", { method: "POST", body: JSON.stringify({ journey_id: journeyId, ...body }) });
        j = await r.json().catch(() => ({}));
        ok = r.ok;
      } catch { ok = false; }
      waiting.current -= 1;
      if (!ok) { undo(); setErr("Náðist ekki að vista síðustu breytingu. Athugaðu nettenginguna."); return; }
      cache.invalidate("/api/hc/actions");
      if (waiting.current === 0) { if (j.logs) setLogs(j.logs); if (j.prefs) setPrefs(j.prefs); }
    });
  };

  const hidden = new Set(prefs.filter((p) => p.hidden).map((p) => p.action_uid));
  const actions = plan.modules ?? [];
  const live = actions.filter((a) => !hidden.has(a.uid));
  const put = actions.filter((a) => hidden.has(a.uid));

  useEffect(() => { onLogs?.(logs); }, [logs, onLogs]);

  const doneOn = (uid: string, day: string) => logs.some((l) => l.action_uid === uid && l.done_on === day);

  const toggle = (uid: string, day = today) => {
    const was = doneOn(uid, day);
    const add = () => setLogs((ls) => [...ls, { action_uid: uid, done_on: day }]);
    const remove = () => setLogs((ls) => ls.filter((l) => !(l.action_uid === uid && l.done_on === day)));
    send({ action_uid: uid, done_on: day, done: !was }, was ? remove : add, was ? add : remove);
  };
  /** Which section's picker is open. */
  const [adding, setAdding] = useState<WhenOfDay | null>(null);
  /** The meal whose recipe is open, from a checklist row. */
  const [recipe, setRecipe] = useState<Meal | null>(null);

  /*
   * A ticked meal ticks the habit it completes.
   *
   * Only the two links in MEAL_SATISFIES, only in the direction of ticking,
   * and only when the habit is not already done — so nothing is written
   * twice and nothing is cleared behind somebody's back. The habit's own
   * row updates through the same `toggle` the tick uses, so the two agree
   * without a reload.
   */
  const satisfyFromMeals = useCallback((logged: MealSlot[]) => {
    const have = new Set(logged);
    for (const link of MEAL_SATISFIES) {
      const met = link.needsAll
        ? link.slots.every((sl) => have.has(sl))
        : link.slots.some((sl) => have.has(sl));
      if (!met) continue;
      const habit = plan.modules.find((m) => m.key === link.key);
      if (!habit || doneOn(habit.uid, today)) continue;
      toggle(habit.uid);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- toggle and doneOn are stable for a given day
  }, [plan.modules, today]);

  const setPref = (uid: string, patch: { hidden?: boolean; note?: string; at_time?: string | null }) => {
    const before = prefs;
    send({ action_uid: uid, ...patch }, () => setPrefs((ps) => {
      const cur = ps.find((p) => p.action_uid === uid) ?? { action_uid: uid, hidden: false, note: null };
      return [...ps.filter((p) => p.action_uid !== uid), { ...cur, ...patch, note: patch.note ?? cur.note }];
    }), () => setPrefs(before));
  };

  /**
   * Today's training, from the programme rather than from the module list.
   *
   * A module carries a frequency. "Daglega" is a real daily habit — a walk
   * after dinner belongs on every day's list. Anything else ("2–3 sinnum í
   * viku") is a session, and the exercise programme already says which days
   * those fall on and what they are. Showing both means the same instruction
   * twice, at two resolutions, one of them wrong about today.
   *
   * So when a programme exists, non-daily exercise modules step aside and
   * the day's actual sessions take their place.
   */
  /**
   * Today's training, from the one shared filter.
   *
   * This read prescribed sessions only, so a lift or a football match the
   * person had put in their own week was drawn in the Æfingar calendar and
   * missing from the checklist they tick it off on. trainingOn() is what
   * every surface calls now, so they cannot drift apart again.
   */
  const todaysSessions = trainingOn(exercise, training);
  const programmeOwnsTraining = Boolean(exercise?.sessions.length || training?.activities?.length);
  const supersededByProgramme = (a: PlanItem) =>
    programmeOwnsTraining && a.pillar === "exercise" && (a.frequency ?? "").toLowerCase() !== "daglega";

  /**
   * The day in parts, instead of the plan in pillars.
   *
   * Svefn / Hreyfing / Næring / Andleg líðan is how a nurse thinks about a
   * plan and not how anybody lives a day — nobody wakes up and does
   * "næring". Morning, midday and evening answer the question people open
   * this page with, which is what now.
   *
   * "Allan daginn" is a real category and not a leftover bin: protein at
   * every meal and water through the day have no hour, and putting them in
   * one would make the morning list wrong. It comes last because it is the
   * part that never becomes urgent.
   *
   * The pillar survives on every row as its icon and colour, so the four
   * are still legible without being the structure.
   */
  /** The day takes anything with no hour of its own. */
  const bucket = (w: WhenOfDay | null | undefined): WhenOfDay =>
    w === "morning" || w === "midday" || w === "evening" ? w : "midday";

  /*
   * The participant's order, where they have one.
   *
   * The plan lists modules in the order the nurse composed them, which is a
   * clinical order and not the order anybody does things in the morning. A
   * null sort_index means "wherever the plan put it", so an untouched list
   * looks exactly as it did; dragging one row writes positions for that
   * whole section.
   */
  /*
   * Saving a drag.
   *
   * The whole section goes up in one request: moving one row changes the
   * position of everything it passed, and sending them one at a time would
   * leave a window where half the list had moved. Written optimistically so
   * the row stays where it was dropped rather than springing back while the
   * request is in flight.
   */
  const commitOrder = useCallback(async (order: string[]) => {
    setPrefs((ps) => {
      const next = ps.slice();
      order.forEach((uid, i) => {
        const at = next.findIndex((x) => x.action_uid === uid);
        if (at >= 0) next[at] = { ...next[at], sort_index: i };
        else next.push({ action_uid: uid, hidden: false, note: null, sort_index: i });
      });
      return next;
    });
    await api("/api/hc/actions", { method: "POST", body: JSON.stringify({ order }) }).catch(() => null);
  }, [api]);

  const reorder = useReorder(commitOrder);

  const sortIdx = new Map(prefs.filter((x) => x.sort_index != null).map((x) => [x.action_uid, x.sort_index as number]));
  const inWhen = (w: WhenOfDay) => live
    .filter((a) => !supersededByProgramme(a) && bucket(a.when) === w)
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (sortIdx.get(x.a.uid) ?? 1000 + x.i) - (sortIdx.get(y.a.uid) ?? 1000 + y.i))
    .map(({ a }) => a);

  /** Today's training sits where its hour says, or with the all-day work. */
  const sessionWhen = (x: (typeof todaysSessions)[number]): WhenOfDay => {
    const h = x.at ? Number(x.at.slice(0, 2)) : NaN;
    if (Number.isNaN(h)) return "midday";
    return h < 11 ? "morning" : h < 17 ? "midday" : "evening";
  };

  /*
   * Today, counted exactly the way the sections below count it: the live
   * list after both filters, plus today's training. Summing the same
   * numbers the headings show is what keeps the ring and the list from
   * disagreeing.
   */
  const shownOf = WHEN_ORDER.reduce((n, w) =>
    n + inWhen(w).length + todaysSessions.filter((x) => sessionWhen(x) === w).length, 0);
  const shownDone = WHEN_ORDER.reduce((n, w) =>
    n + inWhen(w).filter((a) => doneOn(a.uid, today)).length
      + todaysSessions.filter((x) => sessionWhen(x) === w && doneToday?.has(x.id)).length, 0);

  useEffect(() => {
    onCounts?.({ done: shownDone, of: shownOf });
  }, [shownDone, shownOf, onCounts]);

  return (
    <section className="space-y-4">
      {/* The progress line that stood here is now the "Staðan þín" card
          beside the hero, which is where it was asked to go.
          
          It was not merely duplicated — it disagreed. This one read
          "20% síðustu 7 daga" (share of prescribed action-instances done)
          while the card read 50% (share of days with anything done). Both
          were live and both were right about different questions, sitting
          two inches apart. One number now, and the card says which question
          it answers. */}

      {sheet && (
        <ActionSheet a={sheet}
          week={week} today={today} doneOn={doneOn} onToggle={toggle}
          atTime={prefs.find((x) => x.action_uid === sheet.uid)?.at_time ?? null}
          onTime={(t) => setPref(sheet.uid, { at_time: t })}
          note={prefs.find((x) => x.action_uid === sheet.uid)?.note ?? ""}
          onNote={(note) => setPref(sheet.uid, { note })}
          onHide={() => setPref(sheet.uid, { hidden: true })}
          onEditPillar={(p) => onEditPillar?.(p)}
          links={{
            lecture: links?.lecture?.(sheet.pillar) ?? null,
            go: sheet.pillar === "exercise" && links?.exercise ? { label: "Opna æfingu dagsins", onClick: links.exercise }
              : sheet.pillar === "nutrition" && links?.nutrition ? { label: "Opna máltíðir dagsins", onClick: links.nutrition }
              : null,
          }}
          onClose={() => setSheet(null)} />
      )}

      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800">{err}</p>}

      {/* An instruction line stood here explaining the circle and the week
          squares. A daily checklist should not need a legend — the controls
          read as what they are, and a sentence above them is read once and
          then skipped forever. */}

      {WHEN_ORDER.map((p) => {
        const meta = WHEN_META[p];
        const items = inWhen(p);
        const mySessions = todaysSessions.filter((x) => sessionWhen(x) === p);
        if (!items.length && !mySessions.length) return null;
        const uids = new Set(items.map((a) => a.uid));
        const dayDone = items.filter((a) => doneOn(a.uid, today)).length
          + mySessions.filter((x) => doneToday?.has(x.id)).length;
        const dayOf = items.length + mySessions.length;
        /**
         * Days with at least one tick in this pillar, over a week and over
         * four weeks. Days rather than ticks, so the two numbers mean the
         * same thing as each other and as the card above — and so a pillar
         * with six habits does not look better than one with two.
         */
        const daysWith = (n: number) =>
          new Set(logs.filter((l) => uids.has(l.action_uid) && lastDays(n).includes(l.done_on)).map((l) => l.done_on)).size;
        const w = daysWith(7);
        const mo = daysWith(28);
        const open = !shut.has(p);

        return (
          <div key={p} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {/* Two lines: the name and today on the first, the week and the
                month on the second. The second line is the one that was
                missing — a day on its own says nothing about whether this
                pillar is a habit yet. */}
            <button type="button" aria-expanded={open}
              onClick={() => setShut((xs) => { const n = new Set(xs); if (n.has(p)) n.delete(p); else n.add(p); return n; })}
              /* Slate, deliberately.
                 These headers had a palette of their own — amber, sky,
                 violet — competing with the pillar colours inside them, so
                 the list carried two colour languages and neither read.
                 Time of day is structure: it says where you are in the day,
                 and the icon and the word say it without a colour. Pillar
                 is meaning, and it gets the colour. */
              className="w-full bg-slate-50 px-4 py-2.5 text-left">
              <span className="flex items-center gap-2">
                <meta.Icon className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
                <span className="font-bold text-slate-800">{meta.label}</span>
                <span className="ml-auto text-xs font-semibold tabular-nums text-slate-600">
                  {dayDone}/{dayOf} í dag
                </span>
                <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-90" : ""}`} aria-hidden />
              </span>
              <span className="mt-1 flex items-center gap-3 pl-7 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  {/* Seven marks: the week at a glance, no legend needed. */}
                  {week.map((d) => {
                    const hit = logs.some((l) => uids.has(l.action_uid) && l.done_on === d);
                    return <span key={d} className="h-1.5 w-1.5 rounded-full"
                      style={{ background: hit ? meta.ink : "currentColor", opacity: hit ? 1 : 0.25 }} />;
                  })}
                </span>
                <span className="tabular-nums">{w} af 7 dögum</span>
                <span className="tabular-nums">{mo} af 28</span>
              </span>
            </button>
            <ul className={`divide-y divide-slate-100 ${open ? "" : "hidden"}`}>
              {/* The programme's own sessions for today, first. */}
              {mySessions.map((s) => {
                const done = Boolean(doneToday?.has(s.id) || doneToday?.has(s.title));
                return (
                  /* Set out exactly like ActionRow below it: same 40px
                     target, same base-size semibold title, same small grey
                     line under it. It was a 24px circle with a 10px kicker
                     above a text-sm title, which read as a different kind of
                     thing in a list where it is the most important one. */
                  /* Same tint and bar as every other row, in Hreyfing's
                     colour — this is a training session, and the list only
                     reads as one list if the most important row in it
                     follows the same rule as the rest. */
                  <li key={s.id} className="flex items-start gap-3 px-3 py-3 sm:px-4"
                    style={{
                      background: done ? "#FFFFFF" : PILLAR_META.exercise.soft,
                    }}>
                    <button type="button"
                      onClick={() => { if (done) return; if (s.session) onCompleteSession?.(s.session); else if (s.activity) onCompleteActivity?.(s.activity); }}
                      disabled={done}
                      aria-pressed={done} aria-label={`Merkja ${s.title} sem lokið`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white transition active:scale-90 disabled:opacity-100"
                      style={{
                        borderColor: done ? "transparent" : PILLAR_META.exercise.ring,
                        background: done ? PILLAR_META.exercise.color : "#FFFFFF",
                      }}>
                      <Check className={`h-5 w-5 ${done ? "text-white" : "text-transparent"}`} strokeWidth={3} aria-hidden />
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-semibold ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {s.title}
                      </span>
                      <span className="mt-1.5 block text-sm text-slate-500">
                        Æfing dagsins
                        {s.at ? ` · kl. ${s.at}` : ""}
                        {s.minutes ? ` · ${s.minutes} mín.` : ""}
                      </span>
                    </span>
                    {/* Only a prescribed session has an exercise list to
                        open; their own commitment is a thing they go and do. */}
                    {links?.exercise && s.session && (
                      <button type="button" onClick={links.exercise}
                        className="shrink-0 self-center text-sm font-semibold" style={{ color: PILLAR_META.exercise.ink }}>
                        Opna
                      </button>
                    )}
                  </li>
                );
              })}
              {/* A rest day says so, instead of showing a habit that is not on. */}
              {p === "midday" && programmeOwnsTraining && todaysSessions.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">Engin æfing á dagskrá í dag — hvíldardagur.</li>
              )}
              {/* Each row wears its own pillar, which is how Svefn and
                  Næring stay legible once the headings are hours. */}
              {/* Mid-drag the carried row sits where the finger is, so the
                  list shows the result before you let go. */}
              {(() => {
                /*
                 * Habits and meals in one draggable list.
                 *
                 * The meals used to be rendered after this block, which is
                 * why they could not be carried: they were not in `ids`, so
                 * the reorder hook did not know they existed and dropping a
                 * habit on one did nothing. A row somebody can see in a list
                 * and cannot move is a list that feels broken.
                 *
                 * Meals get a synthetic uid, `meal:<slot>`. /api/hc/actions
                 * stores the order against whatever uid strings it is given
                 * and hc_action_prefs.action_uid is free text, so a meal
                 * takes a sort_index exactly as a habit does — one order for
                 * the section, persisted the same way.
                 */
                const mealSlots = meals ? MEAL_WHEN[p].filter((sl) => meals[sl]) : [];
                type Entry =
                  | { kind: "habit"; uid: string; a: PlanItem }
                  | { kind: "meal"; uid: string; slot: MealSlot };
                const entries: Entry[] = [
                  ...items.map((a) => ({ kind: "habit" as const, uid: a.uid, a })),
                  ...mealSlots.map((sl) => ({ kind: "meal" as const, uid: `meal:${sl}`, slot: sl })),
                ];
                /* The participant's order, where they have set one. */
                const byPref = (u: string) => sortIdx.get(u) ?? Number.MAX_SAFE_INTEGER;
                entries.sort((x, y) => byPref(x.uid) - byPref(y.uid));

                const ids = entries.map((x) => x.uid);
                const shown = reorder.order && reorder.order.some((u) => ids.includes(u))
                  ? reorder.order.map((u) => entries.find((x) => x.uid === u)).filter(Boolean) as Entry[]
                  : entries;

                return shown.map((e) => e.kind === "habit" ? (
                <ActionRow key={e.uid} a={e.a} meta={PILLAR_META[e.a.pillar]} today={today} doneOn={doneOn} onToggle={toggle}
                  drag={reorder.handlers(e.uid, ids)} lifted={reorder.dragging === e.uid}
                  atTime={prefs.find((x) => x.action_uid === e.uid)?.at_time ?? null}
                  carryY={reorder.dragging === e.uid ? reorder.offset : 0}
                  settling={!!reorder.dragging && reorder.dragging !== e.uid}
                  onOpen={() => setSheet(e.a)}
                  onHide={() => setPref(e.uid, { hidden: true })} />
                ) : (
                  <MealLogger key={e.uid} day={meals!} weightKg={null} part="list" only={e.slot}
                    flush tone={{ color: PILLAR_META.nutrition.color, ring: PILLAR_META.nutrition.ring }}
                    onOpenMeal={setRecipe} onLogged={satisfyFromMeals}
                    drag={reorder.handlers(e.uid, ids)} lifted={reorder.dragging === e.uid}
                    carryY={reorder.dragging === e.uid ? reorder.offset : 0}
                    settling={!!reorder.dragging && reorder.dragging !== e.uid} />
                ));
              })()}
              {/* Add something to this part of the day.
                  Only actions the library tags for this time are offered:
                  `when` is stamped onto a plan from hc_plan_modules at read
                  time, not chosen by the participant, so an evening habit
                  dropped into Morgunn would simply reappear under Kvöld.
                  Offering what fits is honest; letting somebody pick and
                  then moving it would not be. */}
              {/* The meals are rendered above, inside the one draggable
                  list, so that they can be carried like anything else. */}

              {onAddAction && (
                <li className="border-t border-slate-100 px-4 py-2.5">
                  <button type="button" onClick={() => setAdding(p)}
                    aria-label={`Bæta við aðgerð — ${meta.label}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-700">
                    {/* Just "Bæta við". "Bæta við í morgunn" does not
                        decline — it would want "að morgni", "um daginn",
                        "um kvöldið" — and the button sits inside the
                        section whose heading already names it, so the
                        words were redundant as well as wrong. The
                        accessible name carries the section for anybody
                        who cannot see where the button is. */}
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Bæta við
                  </button>
                </li>
              )}
            </ul>
          </div>
        );
      })}

      {/* The picker. A list of what fits this time of day and is not already
          in the plan, added one at a time by the server so this screen never
          has to hold the whole plan to append to it. */}
      {/* The same recipe sleeve the Næring page opens — one sheet, not two
          that drift apart. */}
      {recipe && <Recipe m={recipe} onClose={() => setRecipe(null)} />}

      {adding && onAddAction && (
        <Sheet title={`Bæta við — ${WHEN_META[adding].label}`} onClose={() => setAdding(null)} canvas>
          <AddPicker api={api} when={adding} inPlan={new Set(plan.modules.map((m) => m.key).filter((k): k is string => !!k))}
            onAdd={async (key) => { await onAddAction(key); setAdding(null); }} />
        </Sheet>
      )}

      {live.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-center text-slate-500 shadow-sm">
          Engar virkar aðgerðir. Þú getur tekið aðgerð aftur í notkun hér fyrir neðan.
        </p>
      )}

      {put.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <button type="button" onClick={() => setShowHidden(!showHidden)} aria-expanded={showHidden}
            className="flex w-full items-center gap-2 text-left text-sm font-semibold text-slate-600">
            <EyeOff className="h-4 w-4" /> Lagt til hliðar ({put.length}) <span className="ml-auto text-slate-400">{showHidden ? "▴" : "▾"}</span>
          </button>
          {showHidden && (
            <ul className="mt-2 space-y-1.5">
              {put.map((a) => (
                <li key={a.uid} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm text-slate-600">{a.title}</span>
                  <button type="button" onClick={() => setPref(a.uid, { hidden: false })}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
                    <RotateCcw className="h-3.5 w-3.5" /> Taka aftur inn
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="px-1 text-xs text-slate-500">
        Hjúkrunarfræðingurinn þinn sér hvernig gengur og hvað þú leggur til hliðar. Það sem þú merkir hér er ekki sjúkraskrá.
      </p>
    </section>
  );
}

function ActionRow({ a, meta, today, doneOn, onToggle, onOpen, onHide, drag, lifted = false, carryY = 0, settling = false, atTime }: {
  a: PlanItem;
  meta: { color: string; soft: string; ring: string; label: string; ink: string };
  today: string;
  doneOn: (uid: string, day: string) => boolean;
  onToggle: (uid: string, day?: string) => void;
  /** Swiped away — the same "set aside" the sheet offers, not a deletion. */
  onHide?: () => void;
  /** Opens the change sheet for this action. */
  onOpen: () => void;
  /** Tap-and-hold to reorder: the pointer handler and the row's ref. */
  drag?: { onPointerDown: (e: React.PointerEvent) => void; ref: (el: HTMLElement | null) => void };
  /** Being carried right now — raised, and its swipe suspended. */
  lifted?: boolean;
  /** How far to follow the finger, while carried. */
  carryY?: number;
  /** Another row is being carried: glide, do not snap. */
  settling?: boolean;
  /** The time they chose for this one, if any. */
  atTime?: string | null;
  links?: ActionLinks;
}) {
  const swipe = useSwipe();
  const done = doneOn(a.uid, today);

  return (
    /* The iOS list gesture: drag left, a red action appears behind the row.
       It sets the habit aside rather than deleting it — the plan is the
       nurse's, and a swipe should not be able to destroy part of it. Same
       action the sheet offers under "Leggja þessa til hliðar í bili". */
    /* The carried row follows the finger and the others glide out of its
       way. The spring-ish curve and the 220ms are what every phone list
       uses for this; anything faster reads as a jump and anything slower
       feels like drag. The carried row itself gets no transition — it is
       tracking a finger, and easing that would only add lag. */
    <li ref={drag?.ref} onPointerDown={drag?.onPointerDown}
      style={{
        transform: lifted ? `translateY(${carryY}px) scale(1.03)` : undefined,
        transition: lifted ? "none" : settling ? "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)" : undefined,
        zIndex: lifted ? 20 : undefined,
        /*
         * No text selection, and no long-press callout.
         *
         * A 420ms press on a word is Android's own select-this-text
         * gesture: Chrome puts up the selection handles and takes the
         * touch, so the drag never started on a phone while working
         * perfectly with a mouse. Turning selection off on the row is what
         * makes the hold ours. The sleeve is where any text worth copying
         * lives.
         */
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
      className={`relative transition-shadow ${lifted ? "overflow-visible shadow-xl" : "overflow-hidden"} ${
        settling ? "duration-200" : ""}`}>
      {onHide && (
        <button type="button" onClick={() => { onHide(); swipe.close(); }}
          aria-label={`Leggja ${a.title} til hliðar`}
          className="absolute inset-y-0 right-0 flex w-22 items-center justify-center bg-rose-600 px-4 text-sm font-bold text-white"
          style={{ width: 88 }}>
          Leggja til hliðar
        </button>
      )}
      {/* The row says which pillar it belongs to, before anything is
          ticked.
          Every row was white, and the only pillar colour in the list was
          inside the checkbox — which is empty until you tick it, so the one
          thing that told you whether this was sleep or food appeared only
          after you no longer needed telling. The row now carries its
          pillar's pale tint and a bar of its colour down the left edge.
          Ticked rows drain to white: colour means "still to do", which is
          what a checklist is for. */}
      <div className="relative px-3 py-3 transition-transform sm:px-4"
        style={{
          transform: `translateX(${swipe.dx}px)`,
          transitionDuration: swipe.dx === 0 || swipe.open ? "160ms" : "0ms",
          touchAction: "pan-y",
          background: done ? "#FFFFFF" : meta.soft,
          // Lifted: scaled a touch and opaque, so it reads as being held
          // above the list rather than part of it.
          ...(lifted ? { background: "#FFFFFF" } : null),
        }}
        {...(onHide && !lifted ? swipe.handlers : {})}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => onToggle(a.uid)}
          aria-pressed={done} aria-label={`${done ? "Afmerkja" : "Merkja sem búið"}: ${a.title}`}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white transition active:scale-90 ${done ? "border-transparent text-white" : "text-transparent"}`}
          style={done ? { background: meta.color } : { borderColor: meta.ring }}>
          <Check className="h-5 w-5" strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="flex w-full items-start gap-2 text-left">
            <span className={`min-w-0 flex-1 font-semibold ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>{a.title}</span>
            {/* The one thing besides the title that earns a place on the
                row: a time is what you check the row against. */}
            {atTime && (
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${done ? "text-slate-300" : "text-slate-500"}`}>
                {atTime}
              </span>
            )}
            <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          </button>

          {/* Nothing else on the row.
              It carried the frequency, the weekly target, a "Úr skýrslunni"
              badge, a Breyta button and a seven-day strip of tappable days
              — six things per row, times a dozen rows, on the page whose
              job is to let somebody tick something off. All of it is in the
              sleeve behind the row now, which is where you go when you want
              to know about one of them rather than get through all of
              them. */}
        </div>
      </div>
      </div>
    </li>
  );
}

/** The participant's own note on an action: what got in the way, what worked. The nurse sees it. */

/**
 * What can be added to one part of the day.
 *
 * The library, minus what is already in the plan, minus everything tagged
 * for another time. `when` comes from hc_plan_modules and is stamped on at
 * read time rather than chosen, so a habit the library calls an evening one
 * would reappear under Kvöld however it was added here — offering only what
 * fits is the honest version of this screen.
 */
function AddPicker({ api, when, inPlan, onAdd }: {
  api: Api;
  when: WhenOfDay;
  inPlan: Set<string>;
  onAdd: (key: string) => Promise<void>;
}) {
  const [lib, setLib] = useState<{ key: string; pillar: Pillar; title: string; summary: string; when?: WhenOfDay }[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await api("/api/hc/my-plan").then((x) => (x.ok ? x.json() : null)).catch(() => null);
      if (!alive) return;
      setTimeout(() => setLib(r?.library ?? r?.modules ?? []), 0);
    })();
    return () => { alive = false; };
  }, [api]);

  if (lib === null) {
    return (
      <div className="space-y-2 p-3" aria-busy="true">
        <div className="h-16 rounded-2xl hc-shimmer" />
        <div className="h-16 rounded-2xl hc-shimmer" />
      </div>
    );
  }

  /* Anytime actions belong in every section, since that is what the tag
     means — they are not pinned to a part of the day. */
  const fits = lib.filter((m) => !inPlan.has(m.key) && (m.when === when || m.when === "anytime" || !m.when));

  if (!fits.length) {
    return (
      <p className="p-4 text-sm text-slate-500">
        Ekkert fleira í safninu passar við þennan tíma dags. Þú getur búið til þína eigin aðgerð í áætluninni.
      </p>
    );
  }

  return (
    <ul className="space-y-2 p-3">
      {fits.slice(0, 30).map((m) => (
        <li key={m.key}>
          <button type="button" disabled={!!busy}
            onClick={async () => { setBusy(m.key); await onAdd(m.key); setBusy(null); }}
            className="flex w-full items-start gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200 transition hover:ring-slate-300 disabled:opacity-50">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{ background: PILLAR_META[m.pillar].soft, color: PILLAR_META[m.pillar].ink }} aria-hidden>
              {busy === m.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-tight text-slate-900">{m.title}</span>
              {m.summary && <span className="mt-0.5 block text-sm leading-snug text-slate-600">{m.summary}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
