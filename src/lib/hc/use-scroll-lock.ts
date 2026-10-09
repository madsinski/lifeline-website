"use client";

// Freeze the page behind a sheet.
//
// Every sheet in the journey had the same problem: scrolling past the end of
// the panel handed the scroll to the document underneath, so the page drifted
// while you were reading the thing on top of it. Three ingredients, and all
// three are needed:
//
//  · overscroll-contain on the panel, which stops the chain at its edges.
//  · overflow: hidden on BOTH html and body. globals.css sets overflow-x:
//    clip on html so a wide child cannot make the page draggable sideways,
//    and that takes html out of `overflow: visible` — which makes html, not
//    body, the element that scrolls the viewport. Locking body alone does
//    nothing. Measured: touch-action applied and overflow stayed "auto".
//  · touch-action: none on body, for a drag that starts on the backdrop.
//
// The scroll position is restored on the way out, because locking loses it
// and you would otherwise close a sheet and find yourself at the top of a
// long page.

import { useEffect } from "react";

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const y = window.scrollY;
    const html = document.documentElement;
    const prev = {
      html: html.style.overflow,
      body: document.body.style.overflow,
      touch: document.body.style.touchAction,
    };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      html.style.overflow = prev.html;
      document.body.style.overflow = prev.body;
      document.body.style.touchAction = prev.touch;
      window.scrollTo({ top: y, behavior: "instant" });
    };
  }, [active]);
}
