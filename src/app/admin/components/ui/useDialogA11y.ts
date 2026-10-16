"use client";

// Dialog behaviour for the admin's older hand-rolled overlays, without
// touching their markup: put the returned ref on the panel (the element
// that should carry role="dialog" aria-modal="true") and the panel gets
// what account/ui <Modal> gives — initial focus, a Tab trap, Escape to
// close, focus handed back on close and the page behind it held still.
//
// New overlays should use <Modal> itself; this is for the ones whose
// layout is too bespoke to move into it in one go.
//
// Only the topmost open dialog answers Escape / Tab, so a useDialog()
// confirm (rendered later in the DOM, also aria-modal) opened over one of
// these closes on its own.

import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
  { dismissable = true }: { dismissable?: boolean } = {},
) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  const dismissRef = useRef(dismissable);
  useEffect(() => { closeRef.current = onClose; dismissRef.current = dismissable; });

  useEffect(() => {
    if (!open) return;
    const panel = ref.current;
    if (!panel) return;
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!panel.hasAttribute("tabindex")) panel.tabIndex = -1;
    const first = panel.querySelector<HTMLElement>("[data-autofocus]");
    (first ?? panel).focus({ preventScroll: true });

    const isTop = () => {
      const open = document.querySelectorAll('[aria-modal="true"]');
      return open[open.length - 1] === panel;
    };
    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === "Escape" && dismissRef.current) { e.stopPropagation(); closeRef.current(); }
      if (e.key === "Tab") {
        const f = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (!f.length) { e.preventDefault(); return; }
        const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === a || document.activeElement === panel)) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open]);

  return ref;
}
