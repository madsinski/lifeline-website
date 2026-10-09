"use client";

// "Byrja æfinguna": the workout while you are doing it.
//
// One exercise on screen, Prev / Next / Done along the bottom, a set logged
// as you finish it, a rest countdown after each one, and an RPE question at
// the end. Ported from the app's WorkoutAdaptSheet + ExerciseSetTracker so
// the two agree; see src/lib/hc/workout.ts for the three places the port
// deliberately differs (local date, deadline-based timer, steppers —
// the web now uses a scroll-snap wheel instead, see Wheel.tsx).
//
// Sets go straight to `set_logs` with the anon client — the table's RLS is
// client_id = auth.uid(), the app writes the same rows, and a workout logged
// on the web therefore shows up in the app's history and its PRs.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, Plus, Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  isBodyweight, isLoggable, isTimed, localDate, nextSetIndex, parseHoldSeconds,
  parseReps, parseRestSeconds, parseSets, RPE_IS, type LoggedSet,
} from "@/lib/hc/workout";
import type { PSession } from "@/lib/hc/personalise";
import Wheel from "./Wheel";

const MO_SHORT = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];
/**
 * "7. okt", or "í gær" when it was. Hand-written because Vercel's runtime
 * carries no Icelandic locale data — toLocaleDateString("is-IS") silently
 * returns English there.
 */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 1) return "í gær";
  if (days < 7) return `fyrir ${days} dögum`;
  return `${d.getDate()}. ${MO_SHORT[d.getMonth()]}`;
}
import type { ExerciseItem } from "@/lib/hc/types";
import { muscleIs } from "@/lib/hc/exercise-labels";
import { BASIS_IS, suggestStartWeight, type BodyData } from "@/lib/hc/start-weight";
import { hcBtn } from "./ui";
import { speakCue, speechAvailable, setVoiceEnabled, stopSpeaking, voiceEnabled, warmVoices } from "@/lib/hc/rest-voice";

type Phase = "run" | "rate";

export default function WorkoutRunner({ session, onClose, onDone, onSwap, body }: {
  session: PSession;
  onClose: () => void;
  /** Elapsed minutes and the RPE the participant gave. */
  onDone: (info: { minutes: number; rpe: number }) => void;
  /** Opens the swap wizard for one exercise, mid-workout. */
  onSwap?: (slot: string, item: ExerciseItem) => void;
  /** Weight, body fat and sex, for suggesting a starting load. */
  body?: BodyData;
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
        {current && <ExercisePanel key={`${current.name}-${idx}`} it={current} onSwap={onSwap} body={body} />}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 p-3">
        <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
          className={`${hcBtn.ghost} disabled:opacity-30`}><ChevronLeft className="h-4 w-4" aria-hidden /> Fyrri</button>
        <button type="button" onClick={finish} className="text-xs font-semibold text-slate-500 hover:text-slate-800">Ljúka hér</button>
        <span className="flex-1" />
        {idx < items.length - 1
          ? <button type="button" onClick={() => setIdx((i) => i + 1)} className={hcBtn.primary}>Næsta <ChevronRight className="h-4 w-4" aria-hidden /></button>
          : <button type="button" onClick={finish} className={hcBtn.primary}>Lokið <Check className="h-4 w-4" aria-hidden /></button>}
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
function ExercisePanel({ it, onSwap, body }: { it: ExerciseItem; onSwap?: (slot: string, item: ExerciseItem) => void; body?: BodyData }) {
  return (
    <div className="space-y-3 p-4">
      {/* object-contain on a dark panel: these are wide gym photos and
          demo loops, and object-cover was cutting the lift out of the frame.
          The video is the better demonstration when the library has one. */}
      {(it.video || it.image) && (
        <div className="overflow-hidden rounded-2xl bg-slate-900">
          {it.video ? (
            <video src={it.video} poster={it.image ?? undefined} autoPlay loop muted playsInline
              className="h-52 w-full object-contain" aria-label={`Sýnikennsla: ${it.name}`} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.image!} alt="" className="h-52 w-full object-contain" />
          )}
        </div>
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
      {isLoggable(it) ? <SetTracker it={it} body={body} /> : (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          {/^hiit/i.test(it.name) ? "Taktu lotuna eftir lýsingunni hér að ofan." : "Hér eru engin sett skráð."}
        </p>
      )}
    </div>
  );
}

function SetTracker({ it, body }: { it: ExerciseItem; body?: BodyData }) {
  const timed = isTimed(it);
  const bodyweight = isBodyweight(it);
  const target = parseSets(it.prescription);
  // A suggestion beats an empty box: the one question a beginner cannot
  // answer is "how many kg?". Overwritten below by what they actually lifted
  // last time, which is always the better number once it exists.
  const suggested = !timed && !bodyweight && it.pattern && body
    ? suggestStartWeight(it.pattern, parseReps(it.prescription), it.stage ?? "s1", body)
    : null;
  const [weight, setWeight] = useState(suggested?.kg ?? 0);
  const [fromHistory, setFromHistory] = useState(false);
  const [reps, setReps] = useState(() => parseHoldSeconds(it.prescription) ?? parseReps(it.prescription));
  const [today, setToday] = useState<LoggedSet[]>([]);
  const [busy, setBusy] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [pr, setPr] = useState<{ weight: number | null; reps: number | null } | null>(null);
  /**
   * What this exercise looked like last time.
   *
   * The rows were already being fetched to prefill the weight; they were
   * never shown. Progressive overload is the whole point of writing sets
   * down, and you cannot beat last week if the app knows what you lifted
   * and does not say.
   */
  const [prev, setPrev] = useState<{ date: string; sets: LoggedSet[] } | null>(null);
  const [voice, setVoice] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVoice(voiceEnabled()), 0);
    return () => { clearTimeout(t); stopSpeaking(); };
  }, []);

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
    // The personal best, which the database maintains with its own trigger.
    const { data: best } = await supabase.from("exercise_prs")
      .select("weight, reps").eq("client_id", u.user.id).eq("exercise_id", it.exercise_id).maybeSingle();
    // The most recent session that is not today, so a half-finished set
    // today does not become the thing you are trying to beat.
    const earlier = rows.filter((r) => r.date !== d);
    const lastDate = earlier[0]?.date ?? null;
    setTimeout(() => {
      setToday(mine);
      setPrev(lastDate
        ? { date: lastDate, sets: earlier.filter((r) => r.date === lastDate).sort((a, b) => a.set_index - b.set_index) }
        : null);
      setPr(best ? { weight: best.weight == null ? null : Number(best.weight), reps: best.reps } : null);
      // Pick up where the last session left off, as the app does.
      const last = rows[0];
      if (last && !timed) {
        if (last.weight != null) { setWeight(Number(last.weight)); setFromHistory(true); }
        if (last.reps != null) setReps(last.reps);
      }
    }, 0);
  }, [it.exercise_id, timed]);
  useEffect(() => { void load(); }, [load]);

  // The deadline is the state; the remaining time is read off the clock, so a
  // throttled background tab cannot make the countdown wrong.
  useEffect(() => {
    if (restEndsAt === null) return;
    let said = -1;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      // One cue per second mark, at the same points the app speaks.
      const left = Math.max(0, Math.ceil((restEndsAt - t) / 1000));
      if (left !== said) {
        said = left;
        if (left === 10) speakCue("ten");
        else if (left === 3) speakCue("ready");
        else if (left === 0) speakCue("go");
      }
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
    // Warm the voice list inside the tap: iOS Safari will not speak unless
    // the first utterance descends from a user gesture.
    warmVoices();
    if (rest) { setNow(Date.now()); setRestEndsAt(Date.now() + rest * 1000); }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">Skrá sett</p>
        <div className="flex items-center gap-3">
          {pr?.weight != null && (
            <p className="text-xs font-semibold text-amber-700" title="Þitt besta sett í þessari æfingu til þessa">
              Met: {pr.weight} kg{pr.reps ? ` × ${pr.reps}` : ""}
            </p>
          )}
          <p className="text-xs text-slate-500">{today.length} af {target} í dag</p>
          {speechAvailable() && (
            <button type="button"
              onClick={() => { const v = !voice; setVoice(v); setVoiceEnabled(v); if (!v) stopSpeaking(); }}
              aria-pressed={voice}
              title={voice ? "Raddleiðbeiningar í hvíld: á" : "Raddleiðbeiningar í hvíld: af"}
              className={`rounded-lg p-1 ${voice ? "text-orange-700" : "text-slate-400"}`}>
              {voice ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
              <span className="sr-only">Raddleiðbeiningar</span>
            </button>
          )}
        </div>
      </div>

      {/* Last time, so there is something to beat. Shown as it was lifted —
          set by set — rather than averaged, because the shape of the session
          is what you are repeating. */}
      {prev && prev.sets.length > 0 && (
        <p className="-mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Síðast {shortDate(prev.date)}:</span>
          <span className="tabular-nums">
            {prev.sets.slice(0, 5).map((r, i) => (
              <span key={i}>
                {i > 0 ? ", " : ""}
                {r.weight != null ? `${r.weight} kg × ${r.reps ?? "?"}` : `${r.reps ?? "?"}`}
              </span>
            ))}
            {prev.sets.length > 5 ? ` +${prev.sets.length - 5}` : ""}
          </span>
        </p>
      )}

      <div className={`grid gap-3 ${timed || bodyweight ? "" : "sm:grid-cols-2"}`}>
        {!timed && !bodyweight && (
          <Wheel label="Þyngd" unit="kg" value={weight} onChange={setWeight} step={2.5} min={0} max={300} />
        )}
        <Wheel label={timed ? "Sekúndur" : "Endurtekningar"} value={reps} onChange={setReps}
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

      {suggested && !fromHistory && (
        <p className="text-xs text-slate-500">
          Tillaga {BASIS_IS[suggested.basis]}. Stilltu hana þar til síðustu endurtekningarnar eru erfiðar.
        </p>
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

