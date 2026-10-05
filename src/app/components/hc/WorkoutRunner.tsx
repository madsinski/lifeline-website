"use client";

// "Byrja æfinguna": the workout while you are doing it.
//
// One exercise on screen, Prev / Next / Done along the bottom, a set logged
// as you finish it, a rest countdown after each one, and an RPE question at
// the end. Ported from the app's WorkoutAdaptSheet + ExerciseSetTracker so
// the two agree; see src/lib/hc/workout.ts for the three places the port
// deliberately differs (local date, deadline-based timer, steppers).
//
// Sets go straight to `set_logs` with the anon client — the table's RLS is
// client_id = auth.uid(), the app writes the same rows, and a workout logged
// on the web therefore shows up in the app's history and its PRs.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  isBodyweight, isLoggable, isTimed, localDate, nextSetIndex, parseHoldSeconds,
  parseReps, parseRestSeconds, parseSets, RPE_IS, type LoggedSet,
} from "@/lib/hc/workout";
import type { PSession } from "@/lib/hc/personalise";
import type { ExerciseItem } from "@/lib/hc/types";
import { muscleIs } from "@/lib/hc/exercise-labels";
import { hcBtn } from "./ui";

type Phase = "run" | "rate";

export default function WorkoutRunner({ session, onClose, onDone, onSwap }: {
  session: PSession;
  onClose: () => void;
  /** Elapsed minutes and the RPE the participant gave. */
  onDone: (info: { minutes: number; rpe: number }) => void;
  /** Opens the swap wizard for one exercise, mid-workout. */
  onSwap?: (slot: string, item: ExerciseItem) => void;
}) {
  const items = session.items.filter((i) => (i.block ?? "main") !== "finisher" || /^hiit/i.test(i.name));
  const [phase, setPhase] = useState<Phase>("run");
  const [idx, setIdx] = useState(0);
  const [rpe, setRpe] = useState(6);
  const startedAt = useRef<number>(0);
  useEffect(() => { if (!startedAt.current) startedAt.current = Date.now(); }, []);
  const current = items[idx];

  // Keep the screen awake while someone is mid-set. The app cannot do this;
  // the browser can, and a phone locking between sets is the main annoyance.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } };
    void nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    return () => { void lock?.release().catch(() => {}); };
  }, []);

  // Sampled when the rating step opens, not during its render.
  const [elapsedMin, setElapsedMin] = useState(1);
  const finish = () => {
    setElapsedMin(Math.max(1, Math.round((Date.now() - (startedAt.current || Date.now())) / 60000)));
    setPhase("rate");
  };

  if (phase === "rate") {
    const minutes = elapsedMin;
    return (
      <Shell onClose={onClose} title="Hvernig var hún?">
        <div className="space-y-4 p-4">
          <p className="text-sm text-slate-600">{minutes} mín. · {session.title}</p>
          <div>
            <p className="text-sm font-semibold text-slate-800">Hversu erfið fannst þér æfingin?</p>
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" onClick={() => setRpe(n)} aria-pressed={rpe === n}
                  className={`rounded-xl py-2.5 text-sm font-bold transition ${rpe === n ? "bg-hc-ink text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-center text-sm text-slate-600">{RPE_IS[rpe]}</p>
          </div>
          <button type="button" onClick={() => onDone({ minutes, rpe })} className={`${hcBtn.primary} w-full`}>
            Vista æfinguna
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell onClose={onClose} title={session.title}>
      {/* Where you are */}
      <div className="border-b border-slate-100 px-4 pb-3">
        <div className="flex gap-1" role="img" aria-label={`Æfing ${idx + 1} af ${items.length}`}>
          {items.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < idx ? "bg-emerald-400" : i === idx ? "bg-hc-ink" : "bg-slate-200"}`} />
          ))}
        </div>
        <p className="mt-1.5 text-xs font-semibold text-slate-500">{idx + 1} af {items.length}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {current && <ExercisePanel key={`${current.name}-${idx}`} it={current} onSwap={onSwap} />}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 p-3">
        <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
          className={`${hcBtn.ghost} disabled:opacity-30`}><ChevronLeft className="h-4 w-4" aria-hidden /> Fyrri</button>
        <button type="button" onClick={finish} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Hætta núna</button>
        <span className="flex-1" />
        {idx < items.length - 1
          ? <button type="button" onClick={() => setIdx((i) => i + 1)} className={hcBtn.primary}>Næsta <ChevronRight className="h-4 w-4" aria-hidden /></button>
          : <button type="button" onClick={finish} className={hcBtn.primary}>Búin <Check className="h-4 w-4" aria-hidden /></button>}
      </div>
    </Shell>
  );
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={title}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl">
        <div className="flex items-center gap-3 p-4">
          <p className="min-w-0 flex-1 truncate text-lg font-bold text-slate-900">{title}</p>
          <button type="button" onClick={onClose} aria-label="Loka" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** One exercise: what to do, and the set tracker when there is load to record. */
function ExercisePanel({ it, onSwap }: { it: ExerciseItem; onSwap?: (slot: string, item: ExerciseItem) => void }) {
  return (
    <div className="space-y-3 p-4">
      {it.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={it.image} alt="" className="h-44 w-full rounded-2xl object-cover" />
      )}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-slate-900">{it.name}</h3>
          <p className="font-semibold text-orange-700">{it.prescription}</p>
        </div>
        {onSwap && it.slot && (
          <button type="button" onClick={() => onSwap(it.slot!, it)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Skipta
          </button>
        )}
      </div>
      {it.note && <p className="text-sm text-slate-700">{it.note}</p>}
      {!!it.cues?.length && (
        <ul className="space-y-1">
          {it.cues.map((c, i) => <li key={i} className="flex gap-2 text-sm text-slate-600"><span className="text-orange-500">•</span>{c}</li>)}
        </ul>
      )}
      {!!it.muscles?.length && (
        <p className="flex flex-wrap gap-1">
          {it.muscles.slice(0, 4).map((m) => <span key={m} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{muscleIs(m)}</span>)}
        </p>
      )}
      {isLoggable(it) ? <SetTracker it={it} /> : (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          {/^hiit/i.test(it.name) ? "Taktu lotuna eftir lýsingunni hér að ofan." : "Engin sett skráð fyrir þennan hluta."}
        </p>
      )}
    </div>
  );
}

function SetTracker({ it }: { it: ExerciseItem }) {
  const timed = isTimed(it);
  const bodyweight = isBodyweight(it);
  const target = parseSets(it.prescription);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(() => parseHoldSeconds(it.prescription) ?? parseReps(it.prescription));
  const [today, setToday] = useState<LoggedSet[]>([]);
  const [busy, setBusy] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !it.exercise_id) return;
    const { data } = await supabase.from("set_logs")
      .select("date, set_index, weight, reps")
      .eq("client_id", u.user.id).eq("exercise_id", it.exercise_id)
      .order("logged_at", { ascending: false }).limit(40);
    const rows = (data ?? []) as LoggedSet[];
    const d = localDate();
    const mine = rows.filter((r) => r.date === d);
    setTimeout(() => {
      setToday(mine);
      // Pick up where the last session left off, as the app does.
      const last = rows[0];
      if (last && !timed) { if (last.weight != null) setWeight(Number(last.weight)); if (last.reps != null) setReps(last.reps); }
    }, 0);
  }, [it.exercise_id, timed]);
  useEffect(() => { void load(); }, [load]);

  // The deadline is the state; the remaining time is read off the clock, so a
  // throttled background tab cannot make the countdown wrong.
  useEffect(() => {
    if (restEndsAt === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= restEndsAt) setRestEndsAt(null);
    };
    const id = window.setInterval(tick, 500);
    tick();
    const vis = () => tick();
    document.addEventListener("visibilitychange", vis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [restEndsAt]);
  const restLeft = restEndsAt === null ? null : Math.max(0, Math.ceil((restEndsAt - now) / 1000));

  const logSet = async () => {
    if (!it.exercise_id || busy) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setBusy(false); return; }
    const row = {
      client_id: u.user.id, exercise_id: it.exercise_id, date: localDate(),
      set_index: nextSetIndex(today),
      weight: timed || bodyweight || weight === 0 ? null : weight,
      reps: reps || null,
    };
    const { error } = await supabase.from("set_logs").insert(row);
    setBusy(false);
    if (error) return;
    setToday((t) => [...t, row as LoggedSet]);
    const rest = parseRestSeconds(it.rest);
    if (rest) { setNow(Date.now()); setRestEndsAt(Date.now() + rest * 1000); }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-800">Skrá sett</p>
        <p className="text-xs text-slate-500">{today.length} af {target} í dag</p>
      </div>

      <div className={`grid gap-3 ${timed || bodyweight ? "" : "sm:grid-cols-2"}`}>
        {!timed && !bodyweight && (
          <Stepper label="Þyngd (kg)" value={weight} onChange={setWeight} step={2.5} min={0} max={300} />
        )}
        <Stepper label={timed ? "Sekúndur" : "Endurtekningar"} value={reps} onChange={setReps}
          step={timed ? 5 : 1} min={1} max={timed ? 600 : 50} />
      </div>

      {restLeft !== null ? (
        <button type="button" onClick={() => setRestEndsAt(null)}
          className="w-full rounded-xl bg-orange-100 px-4 py-3 text-center font-bold text-orange-900">
          Hvíld {restLeft} sek. · ýttu til að sleppa
        </button>
      ) : (
        <button type="button" onClick={() => void logSet()} disabled={busy} className={`${hcBtn.primary} w-full`}>
          <Plus className="h-4 w-4" aria-hidden /> {busy ? "Skrái…" : "Skrá sett"}
        </button>
      )}

      {today.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {today.map((s, i) => (
            <li key={i} className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              {s.weight != null ? `${s.weight} kg × ` : ""}{s.reps}{timed ? " sek." : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stepper({ label, value, onChange, step, min, max }: {
  label: string; value: number; onChange: (v: number) => void; step: number; min: number; max: number;
}) {
  const bump = (d: number) => onChange(Math.min(max, Math.max(min, Math.round((value + d) * 10) / 10)));
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => bump(-step)} aria-label={`Minnka ${label}`}
          className="h-11 w-11 shrink-0 rounded-xl bg-white text-xl font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">−</button>
        <input type="number" inputMode="decimal" value={value} aria-label={label}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 text-center text-lg font-bold text-slate-900" />
        <button type="button" onClick={() => bump(step)} aria-label={`Auka ${label}`}
          className="h-11 w-11 shrink-0 rounded-xl bg-white text-xl font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">+</button>
      </div>
    </div>
  );
}
