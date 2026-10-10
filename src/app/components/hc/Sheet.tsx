"use client";

// One bottom sheet, for all of them.
//
// There were sixteen, hand-rolled: none animated in, none could be dragged
// away, four had no scroll lock so the page moved behind them, and the
// backdrops were five different colours. A sheet is a single behaviour and
// it should be written once.
//
// ── Dragging ─────────────────────────────────────────────────────────────
//
// Drag down to dismiss, which is the gesture people arrive with. The rule
// that keeps it from fighting the content: a drag only starts from the
// handle, or from anywhere when the inner scroller is already at the top.
// Without that, flicking down to read the first item would close the sheet
// instead — the single most common way this gets implemented wrong.
//
// Released past a third of the height, or thrown downward fast, it closes;
// otherwise it springs back. Velocity matters as much as distance, because
// a quick flick is a dismissal even when it is short.

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useScrollLock } from "@/lib/hc/use-scroll-lock";

export default function Sheet({ title, onClose, children, max = "max-w-lg", canvas = false, header }: {
  /** The dialog's accessible name. */
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width for the panel; some libraries want a wide one. */
  max?: string;
  /** A tinted body, for sheets whose content is its own set of cards. */
  canvas?: boolean;
  /**
   * The sheet's own header, kept rather than replaced.
   *
   * Every sheet in here had a header of its own — a pillar icon, a kicker,
   * a count — and a shared one would have flattened sixteen different
   * things into one. The shell owns the behaviour; the contents stay theirs.
   * Omit it and a plain title bar is drawn instead.
   */
  header?: React.ReactNode;
}) {
  useScrollLock();
  const [dy, setDy] = useState(0);
  const [closing, setClosing] = useState(false);
  const [shown, setShown] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; armed: boolean } | null>(null);

  // One frame late, so the browser has a "from" state to animate out of.
  useEffect(() => { const r = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(r); }, []);

  const close = useCallback(() => {
    setClosing(true);
    // Let it slide out before it leaves the tree.
    setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [close]);

  const onDown = (e: React.PointerEvent, fromHandle: boolean) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // From the handle always; from the body only when there is nothing to
    // scroll up into, or a downward flick inside a list would dismiss.
    const atTop = (scroller.current?.scrollTop ?? 0) <= 0;
    drag.current = { y: e.clientY, t: Date.now(), armed: fromHandle || atTop };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d?.armed) return;
    const delta = e.clientY - d.y;
    if (delta > 0) setDy(delta);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.armed) return;
    const h = panel.current?.getBoundingClientRect().height ?? 400;
    const speed = dy / Math.max(1, Date.now() - d.t);   // px per ms
    if (dy > h / 3 || speed > 0.6) close();
    else setDy(0);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/60 transition-opacity duration-200 sm:items-center sm:p-4 ${
        shown && !closing ? "opacity-100" : "opacity-0"}`}
      onClick={close}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{
          transform: `translateY(${closing ? 100 : shown ? dy : 100}${closing || !shown ? "%" : "px"})`,
          transition: dy > 0 && !closing ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl ${max} ${
          canvas ? "bg-slate-50" : "bg-white"}`}>

        {/* The grab bar. A visible affordance, and the one place a drag
            always starts regardless of what the body is doing. */}
        <div onPointerDown={(e) => onDown(e, true)} className="shrink-0 cursor-grab touch-none pt-2 active:cursor-grabbing">
          <span className="mx-auto block h-1.5 w-10 rounded-full bg-slate-300" aria-hidden />
        </div>

        {header ?? (
          <div className="flex shrink-0 items-center gap-3 bg-inherit px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-lg font-bold text-hc-ink">{title}</p>
            <button type="button" onClick={close} aria-label="Loka"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}

        <div ref={scroller} onPointerDown={(e) => onDown(e, false)}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>

      </div>
    </div>
  );
}
