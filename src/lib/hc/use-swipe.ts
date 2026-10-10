"use client";

// Swipe a row left to reveal what you can do to it.
//
// The iOS list gesture, because that is the one people already have: drag
// left, an action appears behind the row, let go past the threshold and it
// stays open. Tap anywhere else and it closes.
//
// Pointer events rather than touch events, so a trackpad drag works too and
// there is one code path instead of three. The horizontal lock matters: a
// list is a vertical scroller first, and a gesture that steals the scroll
// the moment a finger moves sideways by a pixel makes the page feel broken.
// So nothing happens until the movement is clearly horizontal — more than
// 12px across and more than across than down.

import { useRef, useState } from "react";

export function useSwipe({ width = 88, onOpenChange }: { width?: number; onOpenChange?: (open: boolean) => void } = {}) {
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const decided = useRef<"none" | "x" | "y">("none");

  const set = (v: boolean) => {
    setOpen(v);
    setDx(v ? -width : 0);
    onOpenChange?.(v);
  };

  return {
    open,
    dx,
    close: () => set(false),
    /** Spread onto the row that moves. */
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        // A mouse press on a button is not the start of a swipe.
        if (e.pointerType === "mouse" && e.button !== 0) return;
        start.current = { x: e.clientX, y: e.clientY };
        decided.current = "none";
      },
      onPointerMove: (e: React.PointerEvent) => {
        const s = start.current;
        if (!s) return;
        const mx = e.clientX - s.x;
        const my = e.clientY - s.y;
        if (decided.current === "none") {
          if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) { decided.current = "y"; return; }
          if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my)) decided.current = "x";
          else return;
        }
        if (decided.current !== "x") return;
        // Left only, and never further than the action behind it.
        const base = open ? -width : 0;
        setDx(Math.max(-width, Math.min(0, base + mx)));
      },
      onPointerUp: () => {
        if (decided.current === "x") set(dx < -width / 2);
        start.current = null;
        decided.current = "none";
      },
      onPointerCancel: () => {
        setDx(open ? -width : 0);
        start.current = null;
        decided.current = "none";
      },
    },
  };
}
