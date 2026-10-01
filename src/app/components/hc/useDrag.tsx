"use client";

// Small pointer-based drag and drop between any two places on the page
// (library card → exercise row, session chip → weekday). Mouse and pen start
// dragging after a few pixels; touch starts on a short long-press so lists
// still scroll. Drop targets are elements with data-drop="<id>".

import { useEffect, useRef, useState } from "react";

export interface DragState<P> { payload: P; x: number; y: number; over: string | null; label: string }

export function useDrag<P>(onDrop: (payload: P, target: string) => void) {
  const [drag, setDrag] = useState<DragState<P> | null>(null);
  const pending = useRef<{ payload: P; label: string; x: number; y: number; type: string; timer: number | null; started: boolean } | null>(null);
  const dropRef = useRef(onDrop);
  useEffect(() => { dropRef.current = onDrop; }, [onDrop]);

  useEffect(() => {
    const targetAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-drop]") as HTMLElement | null)?.dataset.drop ?? null;
    const start = (x: number, y: number) => {
      const p = pending.current;
      if (!p) return;
      p.started = true;
      setDrag({ payload: p.payload, label: p.label, x, y, over: targetAt(x, y) });
    };
    const move = (e: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      if (!p.started) {
        const far = Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8;
        if (p.type === "touch") { if (far && p.timer) { clearTimeout(p.timer); pending.current = null; } return; }
        if (far) start(e.clientX, e.clientY);
        return;
      }
      e.preventDefault();
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY) } : d));
    };
    const up = (e: PointerEvent) => {
      const p = pending.current;
      pending.current = null;
      if (p?.timer) clearTimeout(p.timer);
      if (p?.started) {
        const t = targetAt(e.clientX, e.clientY);
        if (t) dropRef.current(p.payload, t);
      }
      setDrag(null);
    };
    // After a long-press the finger must drag, not scroll the page.
    const touchMove = (e: TouchEvent) => { if (pending.current?.started) e.preventDefault(); };
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  /** Spread onto the draggable element. */
  const handle = (payload: P, label: string) => ({
    onContextMenu: (e: React.MouseEvent) => { if (pending.current) e.preventDefault(); },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const p = { payload, label, x: e.clientX, y: e.clientY, type: e.pointerType, timer: null as number | null, started: false };
      pending.current = p;
      if (e.pointerType === "touch") {
        p.timer = window.setTimeout(() => {
          if (pending.current === p) { navigator.vibrate?.(15); p.started = true; setDrag({ payload, label, x: p.x, y: p.y, over: null }); }
        }, 280);
      }
    },
  });

  return { drag, handle };
}

/** The floating label that follows the pointer while dragging. */
export function DragGhost({ drag }: { drag: DragState<unknown> | null }) {
  if (!drag) return null;
  return (
    <div className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-[130%] rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-xl"
      style={{ left: drag.x, top: drag.y }}>
      {drag.label}
    </div>
  );
}
