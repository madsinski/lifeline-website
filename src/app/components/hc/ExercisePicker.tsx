"use client";

// Pick exercises from the exercise library (/admin/content) for a plan.
// Best value first: compound, whole-body movements with a video. Stays open
// in "add" mode so a nurse can build a whole session in one go; closes after
// one pick in "replace" mode.

import { useEffect, useState } from "react";
import type { LibraryExercise } from "@/lib/hc/types";
import { CATEGORY_IS, EQUIPMENT_IS, muscleIs } from "@/lib/hc/exercise-labels";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

const CATS = ["", "legs", "back", "chest", "shoulders", "core", "full-body", "cardio", "warm-up", "flexibility"];
const EQUIP = ["", "bodyweight", "dumbbells", "kettlebell", "bands", "barbell", "cables", "machine"];

export default function ExercisePicker({ api, mode, onPick, onClose }: {
  api: Api;
  mode: "add" | "replace";
  onPick: (ex: LibraryExercise) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [equip, setEquip] = useState("");
  const [best, setBest] = useState(true);
  const [rows, setRows] = useState<LibraryExercise[] | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [open, setOpen] = useState<LibraryExercise | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const sp = new URLSearchParams({ limit: "48" });
      if (q.trim()) sp.set("q", q.trim());
      if (cat) sp.set("category", cat);
      if (equip) sp.set("equipment", equip);
      if (best) sp.set("best", "1");
      const r = await api(`/api/hc/exercises?${sp}`);
      const j = await r.json().catch(() => ({}));
      setRows(r.ok ? j.exercises : []);
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [api, q, cat, equip, best]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (ex: LibraryExercise) => {
    onPick(ex);
    if (mode === "replace") onClose();
    else setAdded((a) => [...a, ex.id]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Æfingasafn" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-[#0F172A]">{mode === "replace" ? "Skipta um æfingu" : "Æfingasafn"}</h2>
              <p className="text-xs text-slate-500">Sama safn og í /admin/content. Mest fyrir minnst: stórar hreyfingar sem nota marga vöðvahópa.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              {mode === "add" && added.length ? `Klárt (${added.length})` : "Loka"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leita (enska: squat, row, plank…)"
              className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" aria-label="Leita í æfingasafni" />
            <select value={equip} onChange={(e) => setEquip(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" aria-label="Búnaður">
              {EQUIP.map((k) => <option key={k} value={k}>{k ? EQUIPMENT_IS[k] : "Allur búnaður"}</option>)}
            </select>
            <button type="button" aria-pressed={best} onClick={() => setBest(!best)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${best ? "border-orange-300 bg-orange-50 text-orange-800" : "border-slate-200 text-slate-600"}`}>
              ★ Mest fyrir minnst
            </button>
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {CATS.map((k) => (
              <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${cat === k ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {k ? CATEGORY_IS[k] : "Allt"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-5">
          {rows === null && <p className="text-sm text-slate-500">Hleð…</p>}
          {rows?.length === 0 && <p className="text-sm text-slate-500">Ekkert fannst. Prófaðu enskt heiti eða slökktu á „Mest fyrir minnst“.</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows?.map((ex) => {
              const isAdded = added.includes(ex.id);
              return (
                <div key={ex.id} className={`flex flex-col overflow-hidden rounded-2xl border bg-white ${isAdded ? "border-emerald-400" : "border-slate-200"}`}>
                  <button type="button" onClick={() => setOpen(ex)} className="relative aspect-[4/3] bg-slate-100" aria-label={`Nánar um ${ex.name}`}>
                    {ex.illustration_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={ex.illustration_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      : <span className="flex h-full items-center justify-center text-3xl text-slate-300">🏋️</span>}
                    <span className="absolute left-2 top-2 flex gap-1">
                      {ex.bang_for_buck && <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">★</span>}
                      {ex.video_url && <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-bold text-white">▶ Myndband</span>}
                    </span>
                  </button>
                  <div className="flex flex-1 flex-col p-2.5">
                    <p className="text-sm font-semibold leading-tight text-slate-900">{ex.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {[ex.category && CATEGORY_IS[ex.category], ex.equipment && EQUIPMENT_IS[ex.equipment]].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{(ex.primary_muscles ?? []).map(muscleIs).join(", ")}</p>
                    <span className="flex-1" />
                    <button type="button" onClick={() => pick(ex)}
                      className={`mt-2 rounded-lg px-2 py-1.5 text-xs font-semibold ${isAdded ? "bg-emerald-50 text-emerald-700" : "bg-orange-600 text-white hover:bg-orange-700"}`}>
                      {mode === "replace" ? "Velja" : isAdded ? "✓ Bætt við · aftur" : "+ Bæta við"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onClick={(e) => { e.stopPropagation(); setOpen(null); }}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-[#0F172A]">{open.name}</h3>
              <button type="button" onClick={() => setOpen(null)} className="text-slate-400 hover:text-slate-700" aria-label="Loka">✕</button>
            </div>
            {open.video_url
              ? <video src={open.video_url} poster={open.illustration_url ?? undefined} controls playsInline className="mt-3 w-full rounded-2xl bg-black" />
              // eslint-disable-next-line @next/next/no-img-element
              : open.illustration_url ? <img src={open.illustration_url} alt="" className="mt-3 w-full rounded-2xl" /> : null}
            <p className="mt-3 text-xs text-slate-500">{(open.primary_muscles ?? []).concat(open.secondary_muscles ?? []).map(muscleIs).join(" · ")}</p>
            {!!open.instructions?.length && (
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {open.instructions.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            )}
            <button type="button" onClick={() => { pick(open); setOpen(null); }} className="mt-4 w-full rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white">
              {mode === "replace" ? "Velja þessa æfingu" : "+ Bæta við áætlun"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
