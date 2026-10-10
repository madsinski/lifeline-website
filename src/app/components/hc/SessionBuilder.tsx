"use client";

// Build a lift out of movement patterns.
//
// Before this, choosing "Lyftingar — allur líkaminn" produced five exercises
// you could not see until the runner opened and could not change at all. You
// could run somebody else's session or nothing.
//
// It edits PATTERNS, not exercises. You choose to train a hinge; the
// programme still decides which hinge — the stage you are at, the load you
// have set, the knee you are sparing. Pinning a named exercise here would
// quietly opt the session out of every adaptation the plan makes, which is
// the whole point of the plan.
//
// The structure advice is advice. A full-body session with no pull gets a
// line saying so, not a refusal: somebody rehabilitating a shoulder may
// genuinely want that, and a rule that argues with them would be wrong.

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Dumbbell, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import {
  GROUP_IS, slotAdvice, slotKeysFor, STRENGTH_SLOTS, STRENGTH_FOCUS_IS,
  type StrengthFocus, type TrainingSettings,
} from "@/lib/hc/adaptive-program";
import { itemsForSlots } from "@/lib/hc/adaptive-program";
import Sheet from "./Sheet";
import { hcBtn } from "./ui";

export default function SessionBuilder({ name, focus, slots, settings, planStart, load, onSave, onClose }: {
  name: string;
  focus: StrengthFocus;
  /** Their arrangement, or null for the focus's default. */
  slots: string[] | null;
  settings: TrainingSettings;
  planStart: string | null;
  load: number;
  onSave: (keys: string[]) => void;
  onClose: () => void;
}) {
  const [keys, setKeys] = useState<string[]>(() => (slots?.length ? slots : slotKeysFor(focus)));
  const [adding, setAdding] = useState(false);

  // The actual exercises these patterns produce right now, so the list is
  // not an abstraction the person has to imagine.
  const items = itemsForSlots(keys, settings, planStart, load);
  const advice = slotAdvice(focus, keys);
  const isDefault = keys.join() === slotKeysFor(focus).join();

  const move = (i: number, by: number) => setKeys((k) => {
    const j = i + by;
    if (j < 0 || j >= k.length) return k;
    const out = [...k];
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  });

  const byGroup = STRENGTH_SLOTS.reduce<Record<string, typeof STRENGTH_SLOTS>>((acc, x) => {
    (acc[x.group] ??= []).push(x);
    return acc;
  }, {});

  return (
    <Sheet title={`Æfingarnar í ${name}`} onClose={onClose}
      header={
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-slate-900">Æfingarnar þínar</p>
            <p className="text-sm text-slate-500">{STRENGTH_FOCUS_IS[focus].label} · {items.length} æfingar</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Loka"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
      }>


        <div className="flex-1">
          {/* What is missing, when something is. Advisory, and it names the
              gap rather than just flagging one. */}
          {advice && (
            <p className="flex items-start gap-2 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{advice}
            </p>
          )}

          <ul className="divide-y divide-slate-100">
            {keys.map((k, i) => {
              const slot = STRENGTH_SLOTS.find((x) => x.key === k);
              const it = items[i];
              if (!slot) return null;
              return (
                <li key={k} className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                  {/* Buttons, not a drag handle: reordering five things with
                      a thumb mid-gym is two taps, and a drag that needs a
                      steady hand is the wrong input for the place this is
                      used. */}
                  <span className="flex shrink-0 flex-col">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                      aria-label={`Færa ${slot.label} upp`}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25">
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === keys.length - 1}
                      aria-label={`Færa ${slot.label} niður`}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25">
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </button>
                  </span>
                  {/* One still, not a video. The list is for recognising
                      the movement and deciding whether it belongs in the
                      session; a video is for learning it, and that lives in
                      the runner where you are about to do it. */}
                  {it?.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={it.image} alt="" loading="lazy"
                        className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-slate-200" />
                    : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-300">
                        <Dumbbell className="h-6 w-6" aria-hidden />
                      </span>}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900">{it?.name ?? slot.label}</span>
                    <span className="block text-sm text-slate-500">
                      {GROUP_IS[slot.group]}
                      {it?.prescription ? ` · ${it.prescription}` : ""}
                    </span>
                  </span>
                  <button type="button" onClick={() => setKeys((x) => x.filter((_, j) => j !== i))}
                    aria-label={`Taka ${slot.label} út`}
                    className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="px-3 py-3 sm:px-4">
            {!adding ? (
              <button type="button" onClick={() => setAdding(true)} className={hcBtn.secondary}>
                <Plus className="h-4 w-4" aria-hidden /> Bæta við æfingu
              </button>
            ) : (
              <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
                {/* Grouped by what it trains, because that is the choice
                    being made — a session needs a pull, not specifically a
                    row. */}
                {Object.entries(byGroup).map(([g, list]) => (
                  <div key={g}>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{GROUP_IS[g as keyof typeof GROUP_IS]}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((x) => {
                        const on = keys.includes(x.key);
                        return (
                          <button key={x.key} type="button" disabled={on}
                            onClick={() => { setKeys((k) => [...k, x.key]); setAdding(false); }}
                            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                              on ? "bg-slate-200 text-slate-400" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-hc-brand/10 hover:text-hc-brand-dark"}`}>
                            {on && <Check className="mr-1 inline h-3 w-3" aria-hidden />}{x.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setAdding(false)}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-800">Hætta við</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 p-3">
          {!isDefault && (
            <button type="button" onClick={() => setKeys(slotKeysFor(focus))}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
              <RotateCcw className="h-4 w-4" aria-hidden /> Sjálfgefið
            </button>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="px-3 text-sm font-semibold text-slate-500">Hætta við</button>
          <button type="button" onClick={() => onSave(keys)} disabled={!keys.length}
            className={`${hcBtn.primary} disabled:opacity-40`}>Vista</button>
        </div>
    </Sheet>
  );
}
