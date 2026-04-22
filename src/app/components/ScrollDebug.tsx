"use client";

// Scroll diagnostic. Mount in layout.tsx while debugging.
// Logs to console.group('[scroll-debug]') and flashes any element that
// calls preventDefault on a wheel event (so you can see the culprit).
//
// Enable with localStorage.setItem('scrollDebug', '1') and reload.
// Disable with localStorage.removeItem('scrollDebug').

import { useEffect } from "react";

export default function ScrollDebug() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let enabled = false;
    try {
      enabled = window.localStorage.getItem("scrollDebug") === "1";
    } catch {}
    if (!enabled) return;

    const TAG = "[scroll-debug]";

    const logInitialState = () => {
      console.group(`${TAG} initial state`);
      const html = document.documentElement;
      const body = document.body;
      const hcs = getComputedStyle(html);
      const bcs = getComputedStyle(body);
      console.log("html.overflow:", hcs.overflow, "| overflow-y:", hcs.overflowY, "| height:", hcs.height, "| overscroll:", hcs.overscrollBehavior);
      console.log("body.overflow:", bcs.overflow, "| overflow-y:", bcs.overflowY, "| height:", bcs.height, "| min-height:", bcs.minHeight);
      console.log("window.innerHeight:", window.innerHeight, "| document.documentElement.scrollHeight:", html.scrollHeight);
      console.log("body.clientHeight:", body.clientHeight, "| body.scrollHeight:", body.scrollHeight);

      // Find any fixed/absolute element that covers most of the viewport
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const suspects: Array<{ el: Element; area: number; reason: string }> = [];
      const all = document.querySelectorAll<HTMLElement>("*");
      all.forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position !== "fixed" && cs.position !== "absolute") return;
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;
        const coversMost = rect.width >= vw * 0.9 && rect.height >= vh * 0.9;
        if (!coversMost) return;
        const reasons: string[] = [];
        if (cs.overflow === "hidden" || cs.overflowY === "hidden") reasons.push(`overflow=${cs.overflow}/${cs.overflowY}`);
        if (cs.touchAction === "none") reasons.push("touch-action=none");
        if (cs.overscrollBehavior === "none" || cs.overscrollBehaviorY === "none") reasons.push(`overscroll=${cs.overscrollBehavior}/${cs.overscrollBehaviorY}`);
        if (cs.pointerEvents !== "none" && (reasons.length > 0 || cs.zIndex !== "auto")) {
          reasons.push(`z=${cs.zIndex}`);
          suspects.push({ el, area, reason: reasons.join(", ") });
        }
      });
      console.log(`${suspects.length} viewport-covering suspects:`);
      suspects.sort((a, b) => b.area - a.area).slice(0, 10).forEach((s) => {
        const el = s.el as HTMLElement;
        console.log("  →", el.tagName, el.className || "(no class)", `[${s.reason}]`, el);
      });

      console.groupEnd();
    };

    // Log initial state once the DOM + fonts settle
    const t = window.setTimeout(logInitialState, 600);

    // Watch every wheel event. If defaultPrevented, flag it and highlight target.
    const onWheel = (ev: WheelEvent) => {
      // Use capture so we run before app handlers that might preventDefault.
      window.setTimeout(() => {
        if (ev.defaultPrevented) {
          const t = ev.target as HTMLElement;
          console.warn(`${TAG} wheel was defaultPrevented. target:`, t?.tagName, t?.className || "(no class)", t);
          // Outline the target briefly
          if (t?.style) {
            const prev = t.style.outline;
            t.style.outline = "3px solid #ef4444";
            window.setTimeout(() => { t.style.outline = prev; }, 1500);
          }
        }
      }, 0);
    };
    window.addEventListener("wheel", onWheel, { passive: true, capture: true });

    // Also log what element is under the cursor when wheel fires
    const onWheelElement = (ev: WheelEvent) => {
      const t = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!t) return;
      const cs = getComputedStyle(t);
      if (cs.overflow === "hidden" || cs.overflowY === "hidden" || cs.touchAction === "none") {
        console.log(`${TAG} wheel over:`, t.tagName, (t as HTMLElement).className || "(no class)",
          `[overflow=${cs.overflow}/${cs.overflowY}, touch=${cs.touchAction}, overscroll=${cs.overscrollBehavior}]`, t);
      }
    };
    window.addEventListener("wheel", onWheelElement, { passive: true, capture: true });

    // Confirm it's active
    console.log(`${TAG} enabled. Watching wheel events. Disable with localStorage.removeItem('scrollDebug').`);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("wheel", onWheel, { capture: true } as AddEventListenerOptions);
      window.removeEventListener("wheel", onWheelElement, { capture: true } as AddEventListenerOptions);
    };
  }, []);

  return null;
}
