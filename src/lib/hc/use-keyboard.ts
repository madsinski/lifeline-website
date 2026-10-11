"use client";

// Whether the on-screen keyboard is up, and how much of the screen it took.
//
// ── Why this is needed ──────────────────────────────────────────────────
//
// On iOS the keyboard does not resize the layout viewport. A `position:
// fixed; bottom: 0` element stays pinned to the bottom of the *page*, which
// is now behind the keyboard — so the participant navbar and the message
// composer sit on top of whatever you are typing into, or vanish under the
// keyboard entirely. Android resizes and mostly behaves; iOS does not, and
// Victor could not fill in his kennitala on an iPhone because of it.
//
// visualViewport is the only honest source for this. innerHeight does not
// change on iOS when the keyboard opens, so anything derived from it is
// wrong exactly when it matters.
//
// Everything degrades to "no keyboard" where visualViewport is missing,
// which is the correct answer on a desktop.

import { useEffect, useState } from "react";

export interface KeyboardState {
  /** The keyboard is up. */
  open: boolean;
  /** How many pixels of the viewport it covers, for lifting a docked bar. */
  inset: number;
}

export function useKeyboard(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({ open: false, inset: 0 });

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;

    const read = () => {
      /*
       * The gap between the layout viewport and the visible one. A little
       * slack because iOS reports fractional pixels and the URL bar
       * collapsing produces a small, meaningless difference — 120px is
       * comfortably more than any toolbar and far less than any keyboard.
       */
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const open = inset > 120;
      setState((prev) => (prev.open === open && Math.abs(prev.inset - inset) < 2 ? prev : { open, inset }));
    };

    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
    };
  }, []);

  return state;
}
