"use client";

// "Æfingar": the participant's exercise programme, arranged their way.
//   • the week in the hero — drag a session to another day (or tap it and pick)
//   • HIIT on its own days, when the programme carries it inside strength days
//   • swap any exercise for one from the library (drag a card onto it, or
//     "Skipta" and tap), with the library's pictures, video and how-to
// Saved to hc_training_settings through onSave (src/lib/hc/personalise.ts).

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ChevronDown, Dumbbell, Library, RotateCcw, Search, Sliders, Sparkles, X } from "lucide-react";
import { canSplitHiit, MODALITY_IS, personalise, weekdayOf, WEEKDAYS, WEEKDAYS_SHORT, type Personal, type PSession, type SwapSnapshot } from "@/lib/hc/personalise";
import { BLOCK_IS, CATEGORY_IS, EQUIPMENT_IS, muscleIs } from "@/lib/hc/exercise-labels";
import type { ActionPlan, ExerciseBlock, ExerciseItem } from "@/lib/hc/types";
import { DragGhost, useDrag } from "./useDrag";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
type PlanExercise = NonNullable<ActionPlan["exercise"]>;

interface LibEx {
  id: string; name: string; name_is: string | null; category: string | null; equipment: string | null;
  illustration_url: string | null; video_url: string | null; primary_muscles: string[] | null; bang_for_buck: boolean | null;
}
type Payload = { kind: "session"; id: string } | { kind: "exercise"; ex: LibEx };

const LEVEL: Record<string, string> = { beginner: "Byrjendur", intermediate: "Miðlungs", advanced: "Lengra komnir" };

export default function TrainingView({ api, exercise, personal, onSave, controls, stages, onChangeProgram, onCustomise, arranging = false }: {
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
}) {
  const view = useMemo(() => personalise(exercise, personal), [exercise, personal]);
  const [todayIdx] = useState(() => weekdayOf(new Date()));
  const [pickDay, setPickDay] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(false);
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
    setSwapFor(null);
    setLibOpen(false);
  };
  const unswap = (slot: string) => {
    const next = { ...personal.swaps };
    delete next[slot];
    save({ swaps: next });
  };

  const { drag, handle } = useDrag<Payload>((p, target) => {
    if (p.kind === "session" && target.startsWith("day:")) moveSession(p.id, Number(target.slice(4)));
    if (p.kind === "exercise" && target.startsWith("slot:")) swap(target.slice(5), p.ex);
  });

  const custom = mine && (Object.keys(personal.days).length > 0 || Object.keys(personal.swaps).length > 0 || personal.hiit_split);
  const counts = view.sessions.reduce<Record<string, number>>((a, s) => ({ ...a, [s.modality]: (a[s.modality] ?? 0) + 1 }), {});
  const total = view.sessions.reduce((n, s) => n + s.items.filter((i) => (i.block ?? "main") === "main").length, 0);

  return (
    <div className={`grid gap-6 ${libOpen ? "" : ""} lg:grid-cols-[1fr_340px]`}>
      <div className="min-w-0 space-y-6">
        {/* Hero: the week */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 p-5 text-white shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">Æfingaáætlunin mín</p>
          <h2 className="mt-1 text-2xl font-bold">{exercise.name}</h2>
          {exercise.goal && <p className="mt-1 text-white/90">{exercise.goal}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">{view.days_per_week} dagar í viku</span>
            {exercise.session_minutes && <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">um {exercise.session_minutes} mín.</span>}
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">{LEVEL[exercise.level] ?? exercise.level}</span>
            {total > 0 && <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">{total} æfingar</span>}
            {onChangeProgram && !onCustomise && <button type="button" onClick={onChangeProgram} className="rounded-full bg-white px-3 py-1 font-semibold text-orange-700 hover:bg-orange-50">Skipta um æfingaáætlun</button>}
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1.5">
            {WEEKDAYS_SHORT.map((d, i) => {
              const here = view.sessions.filter((s) => s.weekday === i);
              const over = drag?.over === `day:${i}`;
              return (
                <div key={d} data-drop={`day:${i}`}
                  className={`flex min-h-[92px] flex-col gap-1 rounded-xl p-1 transition ${over ? "bg-white/40 ring-2 ring-white" : "bg-white/15"} ${i === todayIdx ? "ring-2 ring-white/70" : ""}`}>
                  <p className="text-center text-[11px] font-bold uppercase">{d}{i === todayIdx ? " ·" : ""}</p>
                  {here.map((s) => (
                    <button key={s.id} type="button" {...(editable ? handle({ kind: "session", id: s.id }, s.title) : {})}
                      disabled={!editable}
                      onClick={() => editable && setPickDay(pickDay === s.id ? null : s.id)}
                      aria-label={`${s.title}, ${WEEKDAYS[i].toLowerCase()}. Færa á annan dag`}
                      className={`cursor-grab select-none rounded-lg px-1 py-1.5 text-left text-[10px] font-bold leading-tight shadow-sm ring-1 active:cursor-grabbing sm:text-[11px] ${MODALITY_IS[s.modality].cls} ${pickDay === s.id ? "outline outline-2 outline-white" : ""}`}>
                      <span className={`mb-0.5 block h-1 w-5 rounded-full ${MODALITY_IS[s.modality].dot}`} />
                      <span className="block truncate sm:hidden">{MODALITY_IS[s.modality].short}</span>
                      <span className="hidden line-clamp-2 sm:block">{s.title.length > 11 ? MODALITY_IS[s.modality].label : s.title}</span>
                    </button>
                  ))}
                  {here.length === 0 && <p className="mt-auto pb-1 text-center text-[10px] text-white/70">Hvíld</p>}
                </div>
              );
            })}
          </div>

          {pickDay && (() => {
            const s = view.sessions.find((x) => x.id === pickDay);
            if (!s) return null;
            return (
              <div className="mt-3 rounded-2xl bg-white p-3 text-slate-900">
                <p className="text-sm font-semibold">Færa „{s.title}“ á:</p>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {WEEKDAYS_SHORT.map((d, i) => (
                    <button key={d} type="button" onClick={() => { moveSession(s.id, i); setPickDay(null); }}
                      className={`rounded-lg py-2 text-xs font-bold ${s.weekday === i ? "bg-orange-600 text-white" : "bg-slate-100 hover:bg-orange-100"}`}>{d}</button>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {(Object.keys(counts) as (keyof typeof MODALITY_IS)[]).map((m) => (
              <span key={m} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 font-semibold">
                <span className={`h-2 w-2 rounded-full ${MODALITY_IS[m].dot}`} />{MODALITY_IS[m].label} {counts[m]}×
              </span>
            ))}
            {editable && <span className="text-white/80">Dragðu æfingadag á annan dag, eða ýttu á hann.</span>}
          </div>

          {editable && (canSplitHiit(exercise) || custom) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {canSplitHiit(exercise) && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-sm font-semibold">
                  <input type="checkbox" checked={mine && personal.hiit_split} onChange={(e) => save({ hiit_split: e.target.checked })} className="h-4 w-4 accent-white" />
                  HIIT á sér dögum
                </label>
              )}
              {custom && (
                <button type="button" onClick={() => save({ days: {}, swaps: {}, hiit_split: false })}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-white/90 underline-offset-2 hover:underline">
                  <RotateCcw className="h-3.5 w-3.5" /> Upprunaleg áætlun
                </button>
              )}
            </div>
          )}
        </section>

        {onCustomise && !arranging && (
          <button type="button" onClick={onCustomise}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-orange-200 bg-white px-4 py-3.5 font-bold text-orange-800 shadow-sm transition hover:border-orange-300 hover:bg-orange-50">
            <Sliders className="h-5 w-5" aria-hidden /> Breyta æfingaáætluninni
          </button>
        )}
        {editable && controls}
        {exercise.description && <p className="text-slate-600">{exercise.description}</p>}
        {stages}

        <section className="space-y-3">
          {view.sessions.map((s) => (
            <SessionCard key={s.id} s={s} today={s.weekday === todayIdx} open={openSession === s.id}
              onToggle={() => setOpenSession(openSession === s.id ? null : s.id)}
              dragOver={drag?.over ?? null} swapFor={swapFor}
              onSwap={editable ? (slot) => { setSwapFor(slot); setLibOpen(true); } : undefined} onUnswap={unswap} />
          ))}
        </section>

        {!!exercise.principles?.length && (
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Af hverju þetta virkar</h3>
            <ol className="mt-2 grid gap-2 sm:grid-cols-2">
              {exercise.principles.map((p, i) => (
                <li key={i} className="flex gap-3 rounded-2xl border border-orange-100 bg-white p-3 shadow-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">{i + 1}</span>
                  <span className="text-sm text-slate-700">{p}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {/* Library: a column on large screens, a sheet on phones */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <ExerciseLibrary api={api} handle={handle} swapFor={swapFor} onPick={swapFor ? (ex) => swap(swapFor, ex) : undefined} onCancel={() => setSwapFor(null)} />
        </div>
      </aside>
      {!libOpen && (
        <button type="button" onClick={() => setLibOpen(true)}
          className="fixed bottom-24 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg lg:hidden">
          <Library className="h-4 w-4" aria-hidden /> Æfingasafn
        </button>
      )}
      {libOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 lg:hidden" onClick={() => { setLibOpen(false); setSwapFor(null); }}>
          <div className="max-h-[85vh] overflow-hidden rounded-t-3xl bg-white" onClick={(e) => e.stopPropagation()}>
            <ExerciseLibrary api={api} handle={handle} swapFor={swapFor} sheet
              onPick={(ex) => (swapFor ? swap(swapFor, ex) : undefined)}
              onCancel={() => { setSwapFor(null); setLibOpen(false); }} />
          </div>
        </div>
      )}
      <DragGhost drag={drag} />
    </div>
  );
}

function SessionCard({ s, today, open, onToggle, dragOver, swapFor, onSwap, onUnswap }: {
  s: PSession; today: boolean; open: boolean; onToggle: () => void;
  dragOver: string | null; swapFor: string | null;
  /** Undefined on the reading surface: swapping lives in the change sheet. */
  onSwap?: (slot: string) => void;
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

function ExerciseRow({ it, over, choosing, onSwap, onUnswap }: { it: ExerciseItem; over: boolean; choosing: boolean; onSwap?: (slot: string) => void; onUnswap: (slot: string) => void }) {
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
              <button type="button" onClick={() => onSwap(it.slot!)} className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
                <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Skipta
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

const CATS = ["legs", "back", "chest", "shoulders", "arms", "core", "full-body", "cardio", "flexibility"];
const EQUIP = ["bodyweight", "dumbbells", "kettlebell", "bands", "barbell", "cables", "machine"];

function ExerciseLibrary({ api, handle, swapFor, onPick, onCancel, sheet }: {
  api: Api;
  handle: (p: Payload, label: string) => Record<string, unknown>;
  swapFor: string | null;
  onPick?: (ex: LibEx) => void;
  onCancel: () => void;
  sheet?: boolean;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [list, setList] = useState<LibEx[] | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const u = new URLSearchParams({ kind: "exercises" });
      if (q.trim()) u.set("q", q.trim());
      if (cat) u.set("cat", cat);
      if (equip) u.set("equip", equip);
      const r = await api(`/api/hc/library?${u}`);
      const j = await r.json().catch(() => ({}));
      if (n === seq.current) setList(j.exercises ?? []);
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [api, q, cat, equip]);

  return (
    <div className={`flex flex-col overflow-hidden bg-white ${sheet ? "max-h-[85vh]" : "max-h-[calc(100vh-7rem)] rounded-3xl shadow-sm ring-1 ring-slate-100"}`}>
      <div className="space-y-2 border-b border-slate-100 p-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-900">{swapFor ? "Veldu æfingu í staðinn" : "Æfingasafnið"}</p>
          {(swapFor || sheet) && <button type="button" onClick={onCancel} aria-label="Loka" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>}
        </div>
        <p className="text-xs text-slate-500">{swapFor ? "Ýttu á æfingu til að skipta." : "Dragðu æfingu yfir æfingu í áætluninni til að skipta, eða ýttu á „Skipta“."}</p>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita, t.d. hnébeygja" className="min-w-0 flex-1 text-sm outline-none" />
        </label>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {CATS.map((c) => (
            <button key={c} type="button" onClick={() => setCat(cat === c ? null : c)} aria-pressed={cat === c}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cat === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>{CATEGORY_IS[c] ?? c}</button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {EQUIP.map((c) => (
            <button key={c} type="button" onClick={() => setEquip(equip === c ? null : c)} aria-pressed={equip === c}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${equip === c ? "bg-orange-600 text-white" : "bg-orange-50 text-orange-800"}`}>{EQUIPMENT_IS[c] ?? c}</button>
          ))}
        </div>
      </div>
      <ul className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3">
        {list === null && <li className="col-span-2 py-6 text-center text-sm text-slate-500">Hleð…</li>}
        {list?.length === 0 && <li className="col-span-2 py-6 text-center text-sm text-slate-500">Ekkert fannst.</li>}
        {list?.map((ex) => (
          <li key={ex.id}>
            <button type="button" {...handle({ kind: "exercise", ex }, ex.name_is || ex.name)} onClick={() => onPick?.(ex)}
              className={`w-full select-none overflow-hidden rounded-2xl bg-white text-left ring-1 ring-slate-200 transition hover:ring-orange-400 ${onPick ? "" : "cursor-grab"}`}>
              <span className="block aspect-[4/3] bg-slate-100">
                {ex.illustration_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={ex.illustration_url} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                  : null}
              </span>
              <span className="block p-2">
                <span className="line-clamp-2 text-xs font-semibold leading-tight text-slate-900">{ex.name_is || ex.name}</span>
                <span className="mt-0.5 block text-[10px] text-slate-500">{[ex.category ? CATEGORY_IS[ex.category] ?? ex.category : null, ex.equipment ? EQUIPMENT_IS[ex.equipment] ?? ex.equipment : null].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
