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
import { useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, Dumbbell, EyeOff, Flame, RotateCcw, Utensils } from "lucide-react";
import { PILLARS, PILLAR_META, type ActionPlan, type Pillar, type PlanItem } from "@/lib/hc/types";
import { adherence, isoDay, lastDays, weeklyTarget, type ActionLog, type ActionPref } from "@/lib/hc/adherence";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

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

export default function MyActions({ api, journeyId, plan, logs: initialLogs, prefs: initialPrefs, links }: {
  api: Api;
  journeyId: string;
  plan: ActionPlan;
  logs: ActionLog[];
  prefs: ActionPref[];
  links?: ActionLinks;
}) {
  const [logs, setLogs] = useState<ActionLog[]>(initialLogs);
  const [prefs, setPrefs] = useState<ActionPref[]>(initialPrefs);
  const [showHidden, setShowHidden] = useState(false);
  const [err, setErr] = useState("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const waiting = useRef(0);
  const [today] = useState(() => isoDay());
  const [week] = useState(() => lastDays(7));

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
  const stats = adherence(actions, logs, prefs);

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

  const byPillar = (p: Pillar) => live.filter((a) => a.pillar === p);
  const doneCount = live.filter((a) => doneOn(a.uid, today)).length;

  return (
    <section className="space-y-4">
      {/* Today */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F2A23] to-[#065F46] p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Aðgerðirnar mínar</p>
            <h2 className="mt-1 text-2xl font-bold">
              {doneCount === 0 ? "Byrjum á einu atriði" : doneCount === live.length ? "Dagurinn kláraður" : `${doneCount} af ${live.length} búin í dag`}
            </h2>
          </div>
          <div className="flex gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{stats.percent}%</p>
              <p className="text-xs text-emerald-200">síðustu 7 daga</p>
            </div>
            {stats.streak > 1 && (
              <div>
                <p className="flex items-center justify-center gap-1 text-2xl font-bold"><Flame className="h-5 w-5 text-amber-300" />{stats.streak}</p>
                <p className="text-xs text-emerald-200">dagar í röð</p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${live.length ? (doneCount / live.length) * 100 : 0}%` }} />
        </div>
      </div>

      {err && <p role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800">{err}</p>}

      {PILLARS.filter((p) => byPillar(p).length).map((p) => {
        const meta = PILLAR_META[p];
        return (
          <div key={p} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: meta.soft }}>
              <PillarIcon pillar={p} size="sm" />
              <p className="font-bold" style={{ color: meta.ink }}>{meta.label}</p>
              <span className="ml-auto text-xs font-semibold" style={{ color: meta.ink }}>
                {byPillar(p).filter((a) => doneOn(a.uid, today)).length}/{byPillar(p).length}
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {byPillar(p).map((a) => (
                <ActionRow key={a.uid} a={a} meta={meta} today={today} week={week} doneOn={doneOn} onToggle={toggle}
                  myNote={prefs.find((x) => x.action_uid === a.uid)?.note ?? ""}
                  onNote={(note) => setPref(a.uid, { note })}
                  onHide={() => setPref(a.uid, { hidden: true })}
                  links={links} />
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

function ActionRow({ a, meta, today, week, doneOn, onToggle, onHide, myNote, onNote, links }: {
  a: PlanItem;
  meta: { color: string; soft: string; label: string; ink: string };
  today: string;
  week: string[];
  doneOn: (uid: string, day: string) => boolean;
  onToggle: (uid: string, day?: string) => void;
  onHide: () => void;
  myNote: string;
  onNote: (note: string) => void;
  links?: ActionLinks;
}) {
  const [open, setOpen] = useState(false);
  const done = doneOn(a.uid, today);
  const target = weeklyTarget(a.frequency);
  const thisWeek = week.filter((d) => doneOn(a.uid, d)).length;
  const lecture = links?.lecture?.(a.pillar) ?? null;
  const go = a.pillar === "exercise" ? links?.exercise : a.pillar === "nutrition" ? links?.nutrition : null;

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
          <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-2 text-left" aria-expanded={open}>
            <span className="min-w-0 flex-1">
              <span className={`block font-semibold ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>{a.title}</span>
              <span className="block text-sm text-slate-500">
                {a.frequency || "Daglega"}
                {target < 7 && <span className={thisWeek >= target ? "font-semibold text-emerald-700" : "text-slate-400"}> · {thisWeek}/{target} í vikunni</span>}
              </span>
            </span>
            <ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>

          {/* The last seven days: tap to fill in a missed day. */}
          <div className="mt-2 flex gap-1" role="group" aria-label="Síðustu sjö dagar">
            {week.map((d) => {
              const on = doneOn(a.uid, d);
              const wd = new Date(`${d}T12:00:00`).getDay();
              return (
                <button key={d} type="button" onClick={() => onToggle(a.uid, d)}
                  aria-pressed={on} aria-label={`${WEEKDAY_LONG[wd]}${d === today ? " (í dag)" : ""}: ${on ? "búið" : "ekki búið"}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold transition active:scale-90 ${on ? "text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"} ${d === today ? "ring-2 ring-slate-800 ring-offset-1" : ""}`}
                  style={on ? { background: meta.color } : undefined}>
                  {WEEKDAY_SHORT[wd]}
                </button>
              );
            })}
          </div>

          {open && (
            <div className="mt-3 space-y-3">
              {a.summary && <p className="text-sm text-slate-700">{a.summary}</p>}
              {a.details && <p className="whitespace-pre-line text-sm text-slate-600">{a.details}</p>}
              {a.note && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm italic text-emerald-900">{a.note}</p>}

              {(go || lecture) && (
                <div className="flex flex-wrap gap-2">
                  {go && (
                    <button type="button" onClick={go}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-white"
                      style={{ background: meta.color }}>
                      {a.pillar === "exercise" ? <Dumbbell className="h-4 w-4" aria-hidden /> : <Utensils className="h-4 w-4" aria-hidden />}
                      {a.pillar === "exercise" ? "Opna æfingaáætlunina" : "Sjá máltíðir dagsins"}
                    </button>
                  )}
                  {lecture && (
                    <a href={lecture.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <BookOpen className="h-4 w-4" aria-hidden /> {lecture.title}
                    </a>
                  )}
                </div>
              )}

              <NoteField initial={myNote} onSave={onNote} />
              <button type="button" onClick={onHide} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                Leggja til hliðar í bili
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/** The participant's own note on an action: what got in the way, what worked. The nurse sees it. */
function NoteField({ initial, onSave }: { initial: string; onSave: (note: string) => void }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const dirty = v.trim() !== saved.trim();
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500">Athugasemd til hjúkrunarfræðingsins
        <textarea value={v} onChange={(e) => setV(e.target.value)} rows={2} maxLength={300}
          onBlur={() => { if (dirty) { onSave(v.trim()); setSaved(v.trim()); } }}
          placeholder="T.d. hvað gekk vel eða hvað var erfitt"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#10B981]" />
      </label>
      {dirty && (
        <button type="button" onClick={() => { onSave(v.trim()); setSaved(v.trim()); }}
          className="mt-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">Vista athugasemd</button>
      )}
    </div>
  );
}
