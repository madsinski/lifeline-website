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
/** Past this before the hold fires, the finger is scrolling or swiping. */
const SLOP = 10;

export interface Reorder {
  /** The row being carried, or null. */
  dragging: string | null;
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
            break;
          }
        }
      };

      const up = () => {
        stop();
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        if (lifted) {
          const final = live.current.slice();
          setDragging(null);
          setOrder(null);
          // Only when it actually moved.
          if (final.join("|") !== siblings.join("|")) onCommit(final);
        }
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);

      timer.current = window.setTimeout(() => {
        lifted = true;
        live.current = siblings;
        setDragging(uid);
        setOrder(siblings);
        // A short buzz is how a phone says "you have picked this up".
        try { navigator.vibrate?.(12); } catch { /* not supported */ }
      }, HOLD_MS);
    },
  }), [onCommit, stop]);

  useEffect(() => stop, [stop]);

  return { dragging, order, handlers };
}
