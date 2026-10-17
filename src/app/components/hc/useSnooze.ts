"use client";

// „Seinna“ for a card on Í dag: put away for a while, in this browser.
//
// For the cards that ask a question the person may not want to answer right
// now (a report to confirm, a retention review, the trial running out). It
// is a convenience, not a record — the question itself is still open on the
// server, and a failed read simply shows the card again.

import { useEffect, useState } from "react";

const PREFIX = "hc-snooze:";

/** [hidden, snooze]. `hidden` is null until read (render nothing then). */
export function useSnooze(key: string, ms: number): [boolean | null, () => void] {
  const [hidden, setHidden] = useState<boolean | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const at = Number(window.localStorage.getItem(PREFIX + key) ?? "0");
        setHidden(Number.isFinite(at) && Date.now() - at < ms);
      } catch { setHidden(false); }
    }, 0);
    return () => clearTimeout(t);
  }, [key, ms]);
  const snooze = () => {
    setHidden(true);
    try { window.localStorage.setItem(PREFIX + key, String(Date.now())); } catch { /* private mode */ }
  };
  return [hidden, snooze];
}

export const DAY_MS = 24 * 60 * 60 * 1000;
