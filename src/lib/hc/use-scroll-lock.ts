"use client";

// Freeze the page behind a sheet.
//
// Every sheet in the journey had the same problem: scrolling past the end of
// the panel handed the scroll to the document underneath, so the page drifted
// while you were reading the thing on top of it.
//
// ── Why this is a class and not an inline style ──────────────────────────
//
// globals.css opens with a blanket guard, added to stop third-party SDKs
// locking the page:
//
//   html, body { overflow: auto !important; overscroll-behavior: auto !important }
//
// An !important declaration beats an inline style, so setting
// element.style.overflow here did nothing at all — measured: the inline value
// read "hidden" and the computed value still read "auto", and the page still
// scrolled. Every scroll lock in this app was dead for that reason.
//
// So the lock is a class, `.hc-scroll-lock`, and globals.css gives it its own
// !important under a class+element selector, which outranks the bare element
// selector above. A deliberate lock wins; an SDK reaching for element.style
// still loses.
//
// ── Why html and not only body ───────────────────────────────────────────
//
// The same guard sets overflow on html, which takes html out of `overflow:
// visible` and makes it — not body — the element that scrolls the viewport.
// Locking body alone would not be enough even without the !important.
//
// The scroll position is restored on the way out, because locking loses it
// and you would otherwise close a sheet and find yourself at the top of a
// long page.

import { useEffect } from "react";

const CLASS = "hc-scroll-lock";

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    const y = window.scrollY;
    document.documentElement.classList.add(CLASS);
    document.body.classList.add(CLASS);
    return () => {
      document.documentElement.classList.remove(CLASS);
      document.body.classList.remove(CLASS);
      window.scrollTo({ top: y, behavior: "instant" });
    };
  }, [active]);
}
