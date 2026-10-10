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

export default function Sheet({ title, onClose, children, max = "max-w-lg", canvas = false, header, draggable = true }: {
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
  /**
   * Whether a drag can dismiss it.
   *
   * False for the workout runner: you are mid-set with a phone propped
   * somewhere, and losing the session to a downward swipe is a worse
   * outcome than having to reach for the close button. It still animates
   * and still locks the page.
   */
  draggable?: boolean;
}) {
  useScrollLock();
  const [dy, setDy] = useState(0);
  const [closing, setClosing] = useState(false);
  const [shown, setShown] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

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


  /*
   * Drag from the sheet, release anywhere, and a tap is still a tap.
   *
   * Two earlier attempts each broke the other half of this:
   *
   *   pointerup on the panel only — a downward drag ends with the finger
   *   below the panel, so the release was lost and the sheet stayed parked
   *   off its own edge.
   *
   *   setPointerCapture on pointerdown — fixed that, and retargeted the
   *   click: a tap on a link inside the sheet produced no navigation at
   *   all, because the synthesised click went to the capturing element
   *   instead of the link.
   *
   * Window listeners do both. They hear the release wherever it happens and
   * they do not touch event targeting. The 6px threshold is the rest of it:
   * until the finger has actually moved, this is a tap and the sheet does
   * not respond at all.
   */
  const THRESHOLD = 6;

  const onDown = (e: React.PointerEvent, fromHandle: boolean) => {
    if (!draggable) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // From the handle always; from the body only when there is nothing to
    // scroll up into, or a downward flick inside a list would dismiss.
    const atTop = (scroller.current?.scrollTop ?? 0) <= 0;
    if (!(fromHandle || atTop)) return;

    const start = { y: e.clientY, t: Date.now() };
    let moved = 0;

    const move = (ev: PointerEvent) => {
      const delta = ev.clientY - start.y;
      if (delta > THRESHOLD) { moved = delta; setDy(delta - THRESHOLD); }
      else if (moved) { moved = 0; setDy(0); }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!moved) { setDy(0); return; }            // a tap: leave it alone
      const h = panel.current?.getBoundingClientRect().height ?? 400;
      const speed = moved / Math.max(1, Date.now() - start.t);   // px per ms
      if (moved > h / 3 || speed > 0.6) close();
      else setDy(0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/60 transition-opacity duration-200 sm:items-center sm:p-4 ${
        shown && !closing ? "opacity-100" : "opacity-0"}`}
      onClick={close}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translateY(${closing ? 100 : shown ? dy : 100}${closing || !shown ? "%" : "px"})`,
          transition: dy > 0 && !closing ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl ${max} ${
          canvas ? "bg-slate-50" : "bg-white"}`}>

        {/* The grab area, not the grab bar.
            The visible pill is 6px tall, and a 6px target is one you hunt
            for. The area that listens is the full width and roughly a
            centimetre deep — the pill just shows where it is. Pulling the
            header in too would be better still, but the header holds the
            close button and buttons inside a drag surface fight each other. */}
        {draggable && (
          <div onPointerDown={(e) => onDown(e, true)}
            className="flex h-10 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing">
            <span className="block h-1.5 w-10 rounded-full bg-slate-300" aria-hidden />
          </div>
        )}

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
