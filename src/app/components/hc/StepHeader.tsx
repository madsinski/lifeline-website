"use client";

// One header for every first-run screen: a way back, how far along, and
// "Skref n af N" in words.
//
// The route chooser, the onboarding player and the training screen each
// drew their own — an arrow here, a "3/9" there, a rail of dots in the
// walkthrough — so the same question ("how much more of this?") got three
// different answers. One component, so it gets one.

import { ArrowLeft } from "lucide-react";

export default function StepHeader({ n, total, onBack, busy = false, sticky = true }: {
  /** 1-based position of this screen. */
  n: number;
  total: number;
  /** Omitted (or on the first screen) the back arrow is shown disabled. */
  onBack?: () => void;
  busy?: boolean;
  sticky?: boolean;
}) {
  const safeTotal = Math.max(total, 1);
  const at = Math.min(Math.max(n, 1), safeTotal);
  return (
    <header className={`${sticky ? "sticky top-0 z-10 -mx-4 bg-hc-page/95 px-4 backdrop-blur" : ""} mb-5 py-3`}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} disabled={!onBack || at === 1 || busy}
          aria-label="Til baka" className="grid min-h-11 min-w-11 place-items-center rounded-hc-element text-hc-ink-2 hover:bg-hc-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand disabled:opacity-30">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-hc-sunken-2" aria-hidden>
          <div className="h-full rounded-full bg-hc-brand-dark transition-all duration-300"
            style={{ width: `${(at / safeTotal) * 100}%` }} />
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-hc-ink-3">
          Skref {at} af {safeTotal}
        </span>
      </div>
    </header>
  );
}
