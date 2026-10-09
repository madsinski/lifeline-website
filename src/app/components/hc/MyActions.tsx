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
import PillarIcon from "./PillarIcon";
import ActionSheet from "./ActionSheet";
import { useRef, useState } from "react";
import { Check, ChevronRight, EyeOff, RotateCcw, Sliders } from "lucide-react";
import { PILLARS, PILLAR_META, type ActionPlan, type Pillar, type PlanItem } from "@/lib/hc/types";
import { isoDay, weekDays, weeklyTarget, type ActionLog, type ActionPref } from "@/lib/hc/adherence";
import { weekdayOf, type PersonalExercise, type PSession } from "@/lib/hc/personalise";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

// Monday-first, matching the exercise and meal calendars. Indexed by
// Date#getDay(), which is Sunday-first, hence the order.
const WEEKDAY_SHORT = ["Su", "Má", "Þr", "Mi", "Fi", "Fö", "La"];
const WEEKDAY_LONG = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];

export interface ActionLinks {
  /** Opens the exercise programme at today's session. */
  exercise?: (() => void) | null;
  /** Opens today's meals. */
  nutrition?: (() => void) | null;
  /** A fræðsla for the action's pillar, if the plan has one. */
  lecture?: (p: Pillar) => { title: string; href: string } | null;
}

export default function MyActions({ api, journeyId, plan, logs: initialLogs, prefs: initialPrefs, links, onEditPillar,
  exercise, doneToday, onCompleteSession }: {
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
  /** Session ids and titles already finished today. */
  doneToday?: Set<string>;
  /** Tick a session off here exactly as Æfingar would. */
  onCompleteSession?: (s: PSession) => void;
}) {
  const [logs, setLogs] = useState<ActionLog[]>(initialLogs);
  const [prefs, setPrefs] = useState<ActionPref[]>(initialPrefs);
  const [showHidden, setShowHidden] = useState(false);
  const [sheet, setSheet] = useState<PlanItem | null>(null);
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
  const todaysSessions: PSession[] = exercise?.sessions.filter((s: PSession) => s.weekday === weekdayOf(new Date())) ?? [];
  const programmeOwnsTraining = Boolean(exercise?.sessions.length);
  const supersededByProgramme = (a: PlanItem) =>
    programmeOwnsTraining && a.pillar === "exercise" && (a.frequency ?? "").toLowerCase() !== "daglega";

  const byPillar = (p: Pillar) => live.filter((a) => a.pillar === p && !supersededByProgramme(a));

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

      {live.length > 0 && (
        <p className="text-xs text-slate-500">
          Stóri hringurinn merkir daginn í dag. Reitirnir til hægri eru vikan, mánudagur til sunnudags —
          ýttu á dag til að fylla inn í ef þú gleymdir að merkja.
        </p>
      )}

      {PILLARS.filter((p) => byPillar(p).length || (p === "exercise" && programmeOwnsTraining)).map((p) => {
        const meta = PILLAR_META[p];
        return (
          <div key={p} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: meta.soft }}>
              <PillarIcon pillar={p} size="sm" />
              <p className="font-bold" style={{ color: meta.ink }}>{meta.label}</p>
              <span className="ml-auto text-xs font-semibold" style={{ color: meta.ink }}>
                {byPillar(p).filter((a) => doneOn(a.uid, today)).length + (p === "exercise" ? todaysSessions.filter((s: PSession) => doneToday?.has(s.id)).length : 0)}
                /{byPillar(p).length + (p === "exercise" ? todaysSessions.length : 0)}
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {/* The programme's own sessions for today, first. */}
              {p === "exercise" && todaysSessions.map((s: PSession) => {
                const done = Boolean(doneToday?.has(s.id) || doneToday?.has(s.title));
                return (
                  <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                    <button type="button" onClick={() => !done && onCompleteSession?.(s)} disabled={done}
                      aria-pressed={done} aria-label={`Merkja ${s.title} sem lokið`}
                      className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition disabled:opacity-100"
                      style={{ borderColor: done ? meta.ink : "#cbd5e1", background: done ? meta.ink : "transparent" }}>
                      {done && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden />}
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: meta.ink }}>
                          Æfing dagsins
                        </span>
                        {s.minutes ? <span className="text-[10px] text-slate-400">· {s.minutes} mín</span> : null}
                      </span>
                      <span className={`mt-0.5 block text-sm font-bold ${done ? "text-slate-400 line-through" : "text-hc-ink"}`}>
                        {s.title}
                      </span>
                    </span>
                    {links?.exercise && (
                      <button type="button" onClick={links.exercise}
                        className="shrink-0 self-center text-xs font-bold" style={{ color: meta.ink }}>
                        Opna
                      </button>
                    )}
                  </li>
                );
              })}
              {/* A rest day says so, instead of showing a habit that is not on. */}
              {p === "exercise" && programmeOwnsTraining && todaysSessions.length === 0 && (
                <li className="px-4 py-3 text-sm text-slate-500">Engin æfing á dagskrá í dag — hvíldardagur.</li>
              )}
              {byPillar(p).map((a) => (
                <ActionRow key={a.uid} a={a} meta={meta} today={today} week={week} doneOn={doneOn} onToggle={toggle}
                  onOpen={() => setSheet(a)} onEdit={onEditPillar ? () => onEditPillar(p) : undefined} />
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

function ActionRow({ a, meta, today, week, doneOn, onToggle, onOpen, onEdit }: {
  a: PlanItem;
  meta: { color: string; soft: string; label: string; ink: string };
  today: string;
  week: string[];
  doneOn: (uid: string, day: string) => boolean;
  onToggle: (uid: string, day?: string) => void;
  /** Opens the change sheet for this action. */
  onOpen: () => void;
  /**
   * Opens the plan editor on this action's own pillar. On the row, because
   * one big "change the plan" button at the bottom of the page is a long way
   * from the thing you wanted to change.
   */
  onEdit?: () => void;
  links?: ActionLinks;
}) {
  const done = doneOn(a.uid, today);
  const target = weeklyTarget(a.frequency);
  const thisWeek = week.filter((d) => doneOn(a.uid, d)).length;

  return (
    <li className="px-3 py-3 sm:px-4">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => onToggle(a.uid)}
          aria-pressed={done} aria-label={`${done ? "Afmerkja" : "Merkja sem búið"}: ${a.title}`}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${done ? "border-transparent text-white" : "border-slate-200 text-transparent hover:border-slate-400"}`}
          style={done ? { background: meta.color } : undefined}>
          <Check className="h-5 w-5" strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="flex w-full items-start gap-2 text-left">
            <span className={`min-w-0 flex-1 font-semibold ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>{a.title}</span>
            <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          </button>

          {/* How often it is meant to happen, and how the last seven days
              actually went, on one line: the week is the evidence for the
              target standing next to it. Tapping a day fills in one that was
              missed, which is why they are buttons and not dots. */}
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <span className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>
                {a.frequency || "Daglega"}
                {target < 7 && <span className={thisWeek >= target ? "font-semibold text-emerald-700" : "text-slate-400"}> · {thisWeek} af {target} í vikunni</span>}
              </span>
              {/* Where it came from. The plan is a rendering of the
                  recommendations in the health report, and this is the
                  participant being able to see that rather than being told
                  it in a policy document. */}
              {a.source && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                  a.source.priority === "red"
                    ? "bg-red-50 text-red-800 ring-red-200"
                    : "bg-amber-50 text-amber-900 ring-amber-200"}`}
                  title={`Úr skýrslunni þinni: ${a.source.text}`}>
                  Úr skýrslunni · {a.source.priority === "red" ? "Forgangur 1" : "Forgangur 2"}
                </span>
              )}
              {onEdit && (
                <button type="button" onClick={onEdit} aria-label={`Breyta: ${a.title}`}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900">
                  <Sliders className="h-3 w-3" aria-hidden /> Breyta
                </button>
              )}
            </span>
            <div className="ml-auto flex gap-1" role="group" aria-label={`Vikan fyrir „${a.title}“. Ýttu á dag til að merkja hann.`}>
              {week.map((d) => {
                const on = doneOn(a.uid, d);
                const wd = new Date(`${d}T12:00:00`).getDay();
                // The rest of the week is still to come. The server only
                // accepts today and the six days behind it, so a button here
                // would be one that always fails.
                const future = d > today;
                return (
                  <button key={d} type="button" disabled={future} onClick={() => onToggle(a.uid, d)}
                    aria-pressed={on} title={`${WEEKDAY_LONG[wd]}${d === today ? " (í dag)" : future ? " (framundan)" : ""} — ${future ? "ekki komið" : on ? "búið" : "ekki búið"}`}
                    aria-label={`${WEEKDAY_LONG[wd]}${d === today ? " (í dag)" : ""}: ${future ? "ekki komið" : on ? "búið" : "ekki búið"}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold transition ${future ? "cursor-default bg-slate-50 text-slate-300" : `active:scale-90 ${on ? "text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`} ${d === today ? "ring-2 ring-slate-800 ring-offset-1" : ""}`}
                    style={on && !future ? { background: meta.color } : undefined}>
                    {WEEKDAY_SHORT[wd]}
                  </button>
                );
              })}
            </div>
          </div>

          
        </div>
      </div>
    </li>
  );
}

/** The participant's own note on an action: what got in the way, what worked. The nurse sees it. */


