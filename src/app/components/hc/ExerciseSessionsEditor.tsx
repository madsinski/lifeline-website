"use client";

// Edit the training days of an exercise plan: each day is a list of exercises
// picked from the exercise library (with picture, video and cues) or typed in
// freely. Shared by the plan builder (/vinnustod, /admin/coach/plans/[id]) and
// the exercise-template editor (/admin/coach/plans → Æfingaplön).

import { useState } from "react";
import type { ExerciseBlock, ExerciseItem, ExerciseSession, LibraryExercise } from "@/lib/hc/types";
import { BLOCK_IS, itemFromLibrary } from "@/lib/hc/exercise-labels";
import ExercisePicker from "./ExercisePicker";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export default function ExerciseSessionsEditor({ sessions, onChange, api }: {
  sessions: ExerciseSession[];
  onChange: (s: ExerciseSession[]) => void;
  api: Api;
}) {
  const [picker, setPicker] = useState<{ si: number; replace: number | null } | null>(null);
  const [openDay, setOpenDay] = useState<number>(0);

  const setSession = (si: number, patch: Partial<ExerciseSession>) =>
    onChange(sessions.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const setItems = (si: number, items: ExerciseItem[]) => setSession(si, { items });
  const setItem = (si: number, ii: number, patch: Partial<ExerciseItem>) =>
    setItems(si, sessions[si].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)));
  const move = (si: number, ii: number, d: -1 | 1) => {
    const items = [...sessions[si].items];
    const j = ii + d;
    if (j < 0 || j >= items.length) return;
    [items[ii], items[j]] = [items[j], items[ii]];
    setItems(si, items);
  };

  const onPick = (ex: LibraryExercise) => {
    if (!picker) return;
    const { si, replace } = picker;
    const fresh = itemFromLibrary(ex);
    if (replace === null) {
      setItems(si, [...sessions[si].items, fresh]);
    } else {
      // Keep the dose and the personal note; swap the movement.
      const old = sessions[si].items[replace];
      setItem(si, replace, { ...fresh, prescription: old.prescription || fresh.prescription, rest: old.rest ?? fresh.rest, note: old.note, block: old.block ?? fresh.block });
    }
  };

  return (
    <div className="space-y-3">
      {sessions.map((s, si) => {
        const open = openDay === si;
        return (
          <div key={si} className="overflow-hidden rounded-2xl border border-orange-100 bg-white">
            <button type="button" onClick={() => setOpenDay(open ? -1 : si)} aria-expanded={open}
              className="flex w-full items-center gap-3 bg-orange-50/60 px-3 py-2.5 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">{si + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{s.day || "Dagur"} · {s.title || "Æfing"}</span>
                <span className="block text-xs text-slate-500">{s.items.length} æfingar{s.minutes ? ` · ${s.minutes} mín.` : ""}{s.focus ? ` · ${s.focus}` : ""}</span>
              </span>
              <span className="flex -space-x-2">
                {s.items.filter((it) => it.image).slice(0, 4).map((it, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={it.image!} alt="" className="h-8 w-8 rounded-full border-2 border-white object-cover" />
                ))}
              </span>
              <span className="text-slate-400">{open ? "▴" : "▾"}</span>
            </button>

            {open && (
              <div className="space-y-3 p-3">
                <div className="grid gap-2 sm:grid-cols-[120px_1fr_1fr_90px_auto]">
                  <input value={s.day} onChange={(e) => setSession(si, { day: e.target.value })} placeholder="Dagur" aria-label="Dagur" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <input value={s.title} onChange={(e) => setSession(si, { title: e.target.value })} placeholder="Heiti æfingar" aria-label="Heiti æfingar" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold" />
                  <input value={s.focus ?? ""} onChange={(e) => setSession(si, { focus: e.target.value })} placeholder="Áhersla" aria-label="Áhersla" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <input type="number" value={s.minutes ?? ""} onChange={(e) => setSession(si, { minutes: Number(e.target.value) || null })} placeholder="Mín." aria-label="Mínútur" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <button type="button" onClick={() => { if (confirm("Eyða þessum æfingadegi?")) onChange(sessions.filter((_, i) => i !== si)); }}
                    className="rounded-lg px-2 text-sm text-red-600 hover:bg-red-50">Eyða degi</button>
                </div>

                <ul className="space-y-2">
                  {s.items.map((it, ii) => (
                    <li key={ii} className="flex gap-2 rounded-xl border border-slate-100 p-2">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {it.image
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={it.image} alt="" className="h-full w-full object-cover" />
                          : <span className="flex h-full items-center justify-center text-xl text-slate-300">✎</span>}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          <input value={it.name} onChange={(e) => setItem(si, ii, { name: e.target.value })} aria-label="Æfing" className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold" />
                          <input value={it.prescription} onChange={(e) => setItem(si, ii, { prescription: e.target.value })} placeholder="3 x 10" aria-label="Magn" className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                          <input value={it.rest ?? ""} onChange={(e) => setItem(si, ii, { rest: e.target.value || null })} placeholder="Hvíld" aria-label="Hvíld" className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                          <select value={it.block ?? "main"} onChange={(e) => setItem(si, ii, { block: e.target.value as ExerciseBlock })} aria-label="Hluti" className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs">
                            {(Object.keys(BLOCK_IS) as ExerciseBlock[]).map((b) => <option key={b} value={b}>{BLOCK_IS[b]}</option>)}
                          </select>
                        </div>
                        <input value={it.note ?? ""} onChange={(e) => setItem(si, ii, { note: e.target.value || null })} placeholder="Persónuleg athugasemd (t.d. „notaðu stól ef hnéð kvartar“)" aria-label="Athugasemd" className="w-full rounded-lg border border-slate-100 px-2 py-1 text-xs" />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          {it.exercise_id
                            ? <span className="font-semibold text-emerald-700">✓ Úr safni{it.video ? " · myndband" : ""}</span>
                            : <span className="text-slate-400">Frjáls lína</span>}
                          <button type="button" onClick={() => setPicker({ si, replace: ii })} className="font-semibold text-orange-700 hover:underline">
                            {it.exercise_id ? "Skipta um æfingu" : "Tengja við safn"}
                          </button>
                          <button type="button" onClick={() => move(si, ii, -1)} disabled={ii === 0} className="text-slate-500 disabled:opacity-30" aria-label="Færa upp">↑</button>
                          <button type="button" onClick={() => move(si, ii, 1)} disabled={ii === s.items.length - 1} className="text-slate-500 disabled:opacity-30" aria-label="Færa niður">↓</button>
                          <button type="button" onClick={() => setItems(si, s.items.filter((_, j) => j !== ii))} className="text-red-600 hover:underline">Fjarlægja</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPicker({ si, replace: null })} className="rounded-xl bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700">+ Úr æfingasafni</button>
                  <button type="button" onClick={() => setItems(si, [...s.items, { name: "", prescription: "", block: "main" }])} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">+ Frjáls lína</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" onClick={() => { onChange([...sessions, { day: "", title: "", focus: "", minutes: null, items: [] }]); setOpenDay(sessions.length); }}
        className="w-full rounded-2xl border border-dashed border-orange-200 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-50">
        + Æfingadagur
      </button>
      {picker && <ExercisePicker api={api} mode={picker.replace === null ? "add" : "replace"} onPick={onPick} onClose={() => setPicker(null)} />}
    </div>
  );
}
