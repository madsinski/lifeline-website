"use client";

// "Í dag" — the client's own view of their action plan.
//
// The plan is written by the nurse; this is where it gets done. Tick an
// action for today, look back over the week, and set aside anything that does
// not fit right now — the nurse sees both, so the next conversation starts
// from what actually happened rather than from what was prescribed.

import { useState } from "react";
import { Check, EyeOff, Flame, RotateCcw } from "lucide-react";
import { PILLARS, PILLAR_META, type ActionPlan, type Pillar, type PlanItem } from "@/lib/hc/types";
import { adherence, isoDay, lastDays, weeklyTarget, type ActionLog, type ActionPref } from "@/lib/hc/adherence";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

const WEEKDAY_SHORT = ["S", "M", "Þ", "M", "F", "F", "L"];

export default function MyActions({ api, journeyId, plan, logs: initialLogs, prefs: initialPrefs }: {
  api: Api;
  journeyId: string;
  plan: ActionPlan;
  logs: ActionLog[];
  prefs: ActionPref[];
}) {
  const [logs, setLogs] = useState<ActionLog[]>(initialLogs);
  const [prefs, setPrefs] = useState<ActionPref[]>(initialPrefs);
  const [busy, setBusy] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const today = isoDay();
  const week = lastDays(7);

  /** Every write returns the fresh logs + prefs, so the server stays the
   *  source of truth and a double tap cannot drift the view. */
  const post = async (body: Record<string, unknown>) => {
    const r = await api("/api/hc/actions", { method: "POST", body: JSON.stringify({ journey_id: journeyId, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setLogs(j.logs ?? []); setPrefs(j.prefs ?? []); }
    return r.ok;
  };

  const hidden = new Set(prefs.filter((p) => p.hidden).map((p) => p.action_uid));
  const actions = plan.modules ?? [];
  const live = actions.filter((a) => !hidden.has(a.uid));
  const put = actions.filter((a) => hidden.has(a.uid));
  const stats = adherence(actions, logs, prefs);

  const doneToday = (uid: string) => logs.some((l) => l.action_uid === uid && l.done_on === today);
  const doneOn = (uid: string, day: string) => logs.some((l) => l.action_uid === uid && l.done_on === day);

  const toggle = async (uid: string, day = today) => {
    const key = `${uid}:${day}`;
    setBusy(key);
    await post({ action_uid: uid, done_on: day, done: !doneOn(uid, day) });
    setBusy(null);
  };

  const byPillar = (p: Pillar) => live.filter((a) => a.pillar === p);
  const doneCount = live.filter((a) => doneToday(a.uid)).length;

  return (
    <section className="space-y-4">
      {/* Today */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F2A23] to-[#065F46] p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Í dag</p>
            <h2 className="mt-1 text-2xl font-bold">
              {doneCount === 0 ? "Byrjum á einu atriði" : doneCount === live.length ? "Dagurinn kláraður" : `${doneCount} af ${live.length} búin`}
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

      {/* The actions, by pillar */}
      {PILLARS.filter((p) => byPillar(p).length).map((p) => {
        const meta = PILLAR_META[p];
        return (
          <div key={p} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: meta.soft }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} aria-hidden />
              <p className="font-bold" style={{ color: meta.color }}>{meta.label}</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {byPillar(p).map((a) => (
                <ActionRow key={a.uid} a={a} meta={meta} today={today} week={week} busy={busy}
                  doneToday={doneToday(a.uid)} doneOn={doneOn} onToggle={toggle}
                  onHide={async () => { setBusy(a.uid); await post({ action_uid: a.uid, hidden: true }); setBusy(null); }} />
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

      {/* Set aside */}
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
                  <button type="button" disabled={busy === a.uid}
                    onClick={async () => { setBusy(a.uid); await post({ action_uid: a.uid, hidden: false }); setBusy(null); }}
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

function ActionRow({ a, meta, today, week, busy, doneToday, doneOn, onToggle, onHide }: {
  a: PlanItem;
  meta: { color: string; soft: string; label: string };
  today: string;
  week: string[];
  busy: string | null;
  doneToday: boolean;
  doneOn: (uid: string, day: string) => boolean;
  onToggle: (uid: string, day?: string) => void;
  onHide: () => void;
}) {
  const [open, setOpen] = useState(false);
  const target = weeklyTarget(a.frequency);
  const thisWeek = week.filter((d) => doneOn(a.uid, d)).length;

  return (
    <li className="px-3 py-2.5 sm:px-4">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => onToggle(a.uid)} disabled={busy === `${a.uid}:${today}`}
          aria-pressed={doneToday} aria-label={`${doneToday ? "Afmerkja" : "Merkja sem búið"}: ${a.title}`}
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition ${doneToday ? "border-transparent text-white" : "border-slate-200 text-transparent hover:border-slate-300"}`}
          style={doneToday ? { background: meta.color } : undefined}>
          <Check className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => setOpen(!open)} className="w-full text-left" aria-expanded={open}>
            <p className={`font-semibold ${doneToday ? "text-slate-400 line-through" : "text-slate-900"}`}>{a.title}</p>
            <p className="text-sm text-slate-500">
              {a.frequency || "Daglega"}
              {target < 7 && <span className="text-slate-400"> · {thisWeek}/{target} í vikunni</span>}
            </p>
          </button>

          {open && (
            <div className="mt-2 space-y-2">
              {a.summary && <p className="text-sm text-slate-600">{a.summary}</p>}
              {a.details && <p className="whitespace-pre-line text-sm text-slate-600">{a.details}</p>}
              {a.note && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm italic text-emerald-900">{a.note}</p>}

              {/* The week, so a missed day can still be filled in. */}
              <div className="flex items-center gap-1.5">
                {week.map((d) => {
                  const done = doneOn(a.uid, d);
                  const label = WEEKDAY_SHORT[new Date(d).getDay()];
                  return (
                    <button key={d} type="button" onClick={() => onToggle(a.uid, d)} disabled={busy === `${a.uid}:${d}`}
                      aria-label={`${done ? "Afmerkja" : "Merkja"} ${d}`}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition ${done ? "text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"} ${d === today ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}
                      style={done ? { background: meta.color } : undefined}>
                      {label}
                    </button>
                  );
                })}
                <span className="flex-1" />
                <button type="button" onClick={onHide} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                  Leggja til hliðar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
