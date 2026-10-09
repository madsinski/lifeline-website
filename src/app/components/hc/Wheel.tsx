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

export default function Wheel({ label, value, onChange, step, min, max, unit }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  unit?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settling = useRef<number | null>(null);
  /** Ignore the scroll events our own programmatic scroll causes. */
  const silent = useRef(false);

  const items: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) items.push(Math.round(v * 100) / 100);
  const ROW = 40;
  const idx = Math.max(0, items.findIndex((v) => Math.abs(v - value) < step / 2));

  // Follow the value when it changes from outside (a suggested start weight,
  // or the stepper below).
  useEffect(() => {
    const el = ref.current;
    if (!el || idx < 0) return;
    const target = idx * ROW;
    if (Math.abs(el.scrollTop - target) < 2) return;
    silent.current = true;
    el.scrollTo({ top: target, behavior: "auto" });
    requestAnimationFrame(() => { silent.current = false; });
  }, [idx]);

  const onScroll = () => {
    const el = ref.current;
    if (!el || silent.current) return;
    if (settling.current) window.clearTimeout(settling.current);
    // Read the value once the flick has stopped, not on every frame.
    settling.current = window.setTimeout(() => {
      const i = Math.round(el.scrollTop / ROW);
      const v = items[Math.min(items.length - 1, Math.max(0, i))];
      if (v != null && Math.abs(v - value) > step / 2) onChange(v);
    }, 90);
  };

  const bump = (d: number) =>
    onChange(Math.min(max, Math.max(min, Math.round((value + d) * 100) / 100)));

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>

      <div className="relative" style={{ height: ROW * 3 }}>
        {/* The selected row, marked out so the centre reads as the value. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 rounded-xl border-y-2 border-orange-300 bg-orange-50/40"
          style={{ height: ROW }} />
        <div ref={ref} onScroll={onScroll} aria-hidden
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollPaddingTop: ROW }}>
          {/* Padding rows so the first and last values can reach the centre. */}
          <div style={{ height: ROW }} />
          {items.map((v) => (
            <div key={v} className="flex snap-center items-center justify-center text-lg font-bold tabular-nums"
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
          className="h-9 w-9 shrink-0 rounded-lg bg-white text-lg font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">−</button>
        <input type="number" inputMode="decimal" value={value} aria-label={label} step={step} min={min} max={max}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 text-center text-sm font-bold text-slate-900" />
        <button type="button" onClick={() => bump(step)} aria-label={`Auka ${label.toLowerCase()}`}
          className="h-9 w-9 shrink-0 rounded-lg bg-white text-lg font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100">+</button>
      </div>
    </div>
  );
}
