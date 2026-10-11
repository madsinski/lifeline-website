"use client";

// Tap and hold a checklist row, then drag it to a new place.
//
// ── Why a long press and not a handle ────────────────────────────────────
//
// A drag handle would be a seventh thing on a row we just stripped down to
// a title and a tick. A long press costs nothing visually and is what the
// gesture already is on both phone platforms.
//
// ── Why it has to wait ──────────────────────────────────────────────────
//
// Three gestures start with a finger on the same row: scrolling the page,
// swiping left to set the item aside, and this. So the press arms a timer
// and any movement before it fires cancels — that movement is a scroll or a
// swipe, and both of those belong to somebody else. Once it fires, the row
// is lifted and the other two are locked out until release.
//
// Positions come from the rendered rows rather than from a guessed row
// height: they are not all the same height, and measuring is both simpler
// and right.

import { useCallback, useEffect, useRef, useState } from "react";

const HOLD_MS = 420;
/**
 * Past this before the hold fires, the finger is scrolling or swiping.
 *
 * 14 rather than 10: a thumb resting on a phone for 420ms does not hold
 * still to within ten pixels, and cancelling an intended hold is worse
 * than occasionally arming on a slow scroll — the arming is harmless,
 * since the first real movement after it still reorders rather than
 * scrolls.
 */
const SLOP = 14;

/*
 * Stop the page scrolling while a row is being carried.
 *
 * touch-action cannot do this. It is read when the gesture begins, so the
 * row would have to carry touch-action:none from the start — which would
 * mean no scrolling from a checklist row at all. Instead, once the hold
 * has fired, a non-passive touchmove listener preventDefaults the scroll.
 * Without it Chrome takes the gesture, fires pointercancel, and the drag
 * ends the instant the finger moves: the whole thing works with a mouse
 * and does nothing at all on a phone.
 */
function blockScroll(e: TouchEvent) {
  if (e.cancelable) e.preventDefault();
}

export interface Reorder {
  /** The row being carried, or null. */
  dragging: string | null;
  /** How far the carried row has moved from where it started, in px. */
  offset: number;
  /** Where it would land: the order as it stands mid-drag. */
  order: string[] | null;
  /**
   * Spread onto each row's container, with the rows it can be reordered
   * among — its own time-of-day section.
   *
   * The siblings are passed per call rather than captured once, so a single
   * hook instance serves every section. Hooks cannot be called inside the
   * map that renders them, and a row can only move within its own section
   * anyway: dragging across one would change what time of day it belongs
   * to, which is a different statement from "do this one first".
   */
  handlers: (uid: string, siblings: string[]) => {
    onPointerDown: (e: React.PointerEvent) => void;
    ref: (el: HTMLElement | null) => void;
  };
}

export function useReorder(onCommit: (order: string[]) => void): Reorder {
  const [dragging, setDragging] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  /*
   * The carried row follows the finger.
   *
   * Without this the row only jumped when it passed a neighbour, which
   * reads as laggy — the list was animating and the thing under your thumb
   * was not. Tracking the delta and translating by it is what makes the
   * gesture feel attached to the finger, which is the whole difference
   * between this and a pair of arrows.
   */
  const [offset, setOffset] = useState(0);
  const base = useRef(0);
  const rows = useRef(new Map<string, HTMLElement>());
  const live = useRef<string[]>([]);
  const timer = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
  }, []);

  const handlers = useCallback((uid: string, siblings: string[]) => ({
    ref: (el: HTMLElement | null) => {
      if (el) rows.current.set(uid, el);
      else rows.current.delete(uid);
    },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const from = { x: e.clientX, y: e.clientY };
      let lifted = false;
      base.current = e.clientY;

      const move = (ev: PointerEvent) => {
        if (!lifted) {
          // Still deciding. Any real movement means this was never a hold.
          if (Math.abs(ev.clientX - from.x) > SLOP || Math.abs(ev.clientY - from.y) > SLOP) {
            stop();
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            window.removeEventListener("pointercancel", up);
          }
          return;
        }
        /*
         * Which row is the finger over? Each one's own box answers it, so
         * rows of different heights behave correctly and nothing depends on
         * a magic number.
         */
        setOffset(ev.clientY - base.current);
        const cur = live.current;
        const held = cur.indexOf(uid);
        if (held < 0) return;
        for (let i = 0; i < cur.length; i++) {
          if (i === held) continue;
          const el = rows.current.get(cur[i]);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const mid = r.top + r.height / 2;
          const past = held < i ? ev.clientY > mid : ev.clientY < mid;
          if (past) {
            const next = cur.slice();
            next.splice(i, 0, next.splice(held, 1)[0]);
            live.current = next;
            setOrder(next);
            /*
             * The row swapped places, so the finger is now that much
             * further from where the row sits. Rebasing by the height it
             * travelled keeps it under the finger instead of leaping by a
             * row each time two of them trade places.
             */
            base.current += (held < i ? 1 : -1) * r.height;
            setOffset(ev.clientY - base.current);
            break;
          }
        }
      };

      const up = () => {
        stop();
        window.removeEventListener("touchmove", blockScroll);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (lifted) {
          const final = live.current.slice();
          setDragging(null);
          setOrder(null);
          setOffset(0);
          // Only when it actually moved.
          if (final.join("|") !== siblings.join("|")) onCommit(final);
        }
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);

      timer.current = window.setTimeout(() => {
        lifted = true;
        window.addEventListener("touchmove", blockScroll, { passive: false });
        live.current = siblings;
        setDragging(uid);
        setOrder(siblings);
        // A short buzz is how a phone says "you have picked this up".
        try { navigator.vibrate?.(12); } catch { /* not supported */ }
      }, HOLD_MS);
    },
  }), [onCommit, stop]);

  useEffect(() => () => {
    stop();
    window.removeEventListener("touchmove", blockScroll);
  }, [stop]);

  return { dragging, order, offset, handlers };
}
