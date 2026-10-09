"use client";

// A vertical wheel for picking a weight or a number of seconds.
//
// Why a wheel and not the +/- stepper it replaces: logging a set happens
// mid-workout, one-handed, with the phone propped somewhere. Going from
// 20 kg to 70 kg is twenty taps on a stepper and one flick here.
//
// Built on CSS scroll-snap rather than a drag library: the browser's own
// momentum scrolling is better than anything reimplemented, it works with a
// trackpad and a mouse wheel, and it keeps keyboard access for free.
//
// Accessibility is why the stepper buttons survive underneath. A scroll
// container is awkward with a screen reader, so the wheel is marked
// aria-hidden and the real control is the labelled spinbutton beside it —
// same value, same handler, two ways in.

import { useEffect, useRef } from "react";

export default function Wheel({ label, value, onChange, step, min, max, unit, compact = false }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  unit?: string;
  /** Two of these sit side by side mid-workout, so they can afford less room. */
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settling = useRef<number | null>(null);
  /** Ignore the scroll events our own programmatic scroll causes. */
  const silent = useRef(false);

  const items: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) items.push(Math.round(v * 100) / 100);
  const ROW = compact ? 34 : 40;
  const idx = Math.max(0, items.findIndex((v) => Math.abs(v - value) < step / 2));

  // Follow the value when it changes from outside (a suggested start weight,
  // or the stepper below).
  useEffect(() => {
    const el = ref.current;
    if (!el || idx < 0) return;
    const target = idx * ROW;
    if (Math.abs(el.scrollTop - target) < 2) return;
    /*
     * "instant", not "auto".
     *
     * The container carries scroll-smooth, and behavior:"auto" means "use
     * whatever scroll-behavior computes to" — so this scroll animated. The
     * silent flag then cleared after a single frame while the animation was
     * still running, the scroll handler read an intermediate offset, called
     * onChange with a value nobody picked, and that moved the wheel again.
     * That feedback loop is what left the selector parked between two
     * numbers.
     */
    silent.current = true;
    el.scrollTo({ top: target, behavior: "instant" });
    // Two frames: one for the jump to apply, one for the scroll event it
    // queues to arrive and be ignored.
    requestAnimationFrame(() => requestAnimationFrame(() => { silent.current = false; }));
  }, [idx, ROW]);

  const onScroll = () => {
    const el = ref.current;
    if (!el || silent.current) return;
    if (settling.current) window.clearTimeout(settling.current);
    // Read the value once the flick has stopped, not on every frame.
    settling.current = window.setTimeout(() => {
      const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
      const v = items[i];
      // Land it on the row even when the browser's own snap left it a few
      // pixels short, which it does after a hard flick.
      if (Math.abs(el.scrollTop - i * ROW) > 1) {
        silent.current = true;
        el.scrollTo({ top: i * ROW, behavior: "instant" });
        requestAnimationFrame(() => requestAnimationFrame(() => { silent.current = false; }));
      }
      if (v != null && Math.abs(v - value) > step / 2) onChange(v);
    }, 90);
  };

  const bump = (d: number) =>
    onChange(Math.min(max, Math.max(min, Math.round((value + d) * 100) / 100)));

  return (
    <div>
      <p className={`mb-1 font-semibold uppercase tracking-wide text-slate-500 ${compact ? "text-[10px]" : "text-xs"}`}>{label}</p>

      <div className="relative" style={{ height: ROW * 3 }}>
        {/* The selected row, marked out so the centre reads as the value. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 rounded-xl border-y-2 border-orange-300 bg-orange-50/40"
          style={{ height: ROW }} />
        <div ref={ref} onScroll={onScroll} aria-hidden
          /* No scrollPaddingTop. It shifted the snap port's start edge by a
             whole row, and with snap-center that moves every snap position
             half a row off — the other half of why this stopped between
             numbers. With a leading pad row and a 3-row window, item i
             centres at exactly i * ROW. */
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Padding rows so the first and last values can reach the centre. */}
          <div style={{ height: ROW }} />
          {items.map((v) => (
            <div key={v} className={`flex snap-center items-center justify-center font-bold tabular-nums ${compact ? "text-base" : "text-lg"}`}
              style={{ height: ROW, color: Math.abs(v - value) < step / 2 ? "#0F172A" : "#94A3B8" }}>
              {v}{unit ? <span className="ml-1 text-xs font-normal">{unit}</span> : null}
            </div>
          ))}
          <div style={{ height: ROW }} />
        </div>
      </div>

      {/* The real control: labelled, keyboard-reachable, and the thing a
          screen reader sees. The wheel above is a faster way to drive it. */}
      <div className="mt-1 flex items-center gap-2">
        <button type="button" onClick={() => bump(-step)} aria-label={`Minnka ${label.toLowerCase()}`}
          className={`shrink-0 rounded-lg bg-white font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 ${compact ? "h-8 w-8 text-base" : "h-9 w-9 text-lg"}`}>−</button>
        <input type="number" inputMode="decimal" value={value} aria-label={label} step={step} min={min} max={max}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          className={`min-w-0 flex-1 rounded-lg border border-slate-200 text-center font-bold text-slate-900 ${compact ? "h-8 text-sm" : "h-9 text-sm"}`} />
        <button type="button" onClick={() => bump(step)} aria-label={`Auka ${label.toLowerCase()}`}
          className={`shrink-0 rounded-lg bg-white font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 ${compact ? "h-8 w-8 text-base" : "h-9 w-9 text-lg"}`}>+</button>
      </div>
    </div>
  );
}
