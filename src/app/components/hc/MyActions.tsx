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
import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, EyeOff, RotateCcw } from "lucide-react";
import { PILLAR_META, type ActionPlan, type Pillar, type PlanItem, type WhenOfDay } from "@/lib/hc/types";
import { Sun, Sunrise, Moon, Clock } from "lucide-react";
import { useSwipe } from "@/lib/hc/use-swipe";

/**
 * The parts of the day, in the order they happen.
 *
 * Colour is deliberately dawn → noon → dusk rather than the pillar palette:
 * the pillars still own the rows, and a second use of their colours on the
 * headings would make two different things look like one.
 */
const WHEN_ORDER: WhenOfDay[] = ["morning", "midday", "evening", "anytime"];
const WHEN_META: Record<WhenOfDay, { label: string; ink: string; soft: string; Icon: typeof Sun }> = {
  morning: { label: "Morgunn", ink: "#B45309", soft: "#FEF3C7", Icon: Sunrise },
  midday: { label: "Dagurinn", ink: "#0369A1", soft: "#E0F2FE", Icon: Sun },
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

export default function MyActions({ api, journeyId, plan, logs: initialLogs, prefs: initialPrefs, links, onEditPillar,
  exercise, training, doneToday, onCompleteSession, onCompleteActivity, onLogs }: {
  api: Api;
  journeyId: string;
  plan: ActionPlan;
  logs: ActionLog[];
  prefs: ActionPref[];
  links?: ActionLinks;
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
  const setPref = (uid: string, patch: { hidden?: boolean; note?: string }) => {
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
  const inWhen = (w: WhenOfDay) => live.filter((a) =>
    !supersededByProgramme(a) && (a.when ?? "anytime") === w);

  /** Today's training sits where its hour says, or with the all-day work. */
  const sessionWhen = (x: (typeof todaysSessions)[number]): WhenOfDay => {
    const h = x.at ? Number(x.at.slice(0, 2)) : NaN;
    if (Number.isNaN(h)) return "anytime";
    return h < 11 ? "morning" : h < 17 ? "midday" : "evening";
  };

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
                      borderLeft: `3px solid ${done ? "transparent" : PILLAR_META.exercise.color}`,
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
              {p === "anytime" && programmeOwnsTraining && todaysSessions.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">Engin æfing á dagskrá í dag — hvíldardagur.</li>
              )}
              {/* Each row wears its own pillar, which is how Svefn and
                  Næring stay legible once the headings are hours. */}
              {items.map((a) => (
                <ActionRow key={a.uid} a={a} meta={PILLAR_META[a.pillar]} today={today} doneOn={doneOn} onToggle={toggle}
                  onOpen={() => setSheet(a)}
                  onHide={() => setPref(a.uid, { hidden: true })} />
              ))}
            </ul>
          </div>
        );
      })}

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

function ActionRow({ a, meta, today, doneOn, onToggle, onOpen, onHide }: {
  a: PlanItem;
  meta: { color: string; soft: string; ring: string; label: string; ink: string };
  today: string;
  doneOn: (uid: string, day: string) => boolean;
  onToggle: (uid: string, day?: string) => void;
  /** Swiped away — the same "set aside" the sheet offers, not a deletion. */
  onHide?: () => void;
  /** Opens the change sheet for this action. */
  onOpen: () => void;
  links?: ActionLinks;
}) {
  const swipe = useSwipe();
  const done = doneOn(a.uid, today);

  return (
    /* The iOS list gesture: drag left, a red action appears behind the row.
       It sets the habit aside rather than deleting it — the plan is the
       nurse's, and a swipe should not be able to destroy part of it. Same
       action the sheet offers under "Leggja þessa til hliðar í bili". */
    <li className="relative overflow-hidden">
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
          borderLeft: `3px solid ${done ? "transparent" : meta.color}`,
        }}
        {...(onHide ? swipe.handlers : {})}>
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


