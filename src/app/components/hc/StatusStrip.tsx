"use client";

// The journey as one horizontal line across the top of a client.
//
// Before this, each milestone was a row you scrolled past: the tests inside
// the results step, the report and the interview as collapsed accordion
// headers, payment in a drawer of its own. Six lines of furniture to learn
// one thing — where this person is.
//
// So it reads left to right instead, one glance, and the steps that carry
// work are the only things that still take vertical space. A checkpoint is
// clickable when there is something behind it.

import { Check } from "lucide-react";

export interface Checkpoint {
  key: string;
  label: string;
  /** done = behind us · current = your move · waiting = someone else's · upcoming = not yet */
  state: "done" | "current" | "waiting" | "upcoming";
  /** One short line, shown under the label on wide screens. */
  detail?: string | null;
}

const DOT: Record<Checkpoint["state"], string> = {
  done: "bg-emerald-500 text-white",
  current: "bg-slate-900 text-white ring-4 ring-slate-900/10",
  waiting: "bg-amber-100 text-amber-800",
  upcoming: "bg-slate-100 text-slate-400",
};
const LINE: Record<Checkpoint["state"], string> = {
  done: "bg-emerald-300",
  current: "bg-slate-300",
  waiting: "bg-slate-200",
  upcoming: "bg-slate-200",
};
const TEXT: Record<Checkpoint["state"], string> = {
  done: "text-slate-700",
  current: "font-bold text-slate-900",
  waiting: "text-amber-800",
  upcoming: "text-slate-400",
};

export default function StatusStrip({ steps, onOpen }: {
  steps: Checkpoint[];
  /** Jump to the step this checkpoint belongs to, when it has a body. */
  onOpen?: (key: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {/* The line itself. Scrolls sideways on a phone rather than wrapping
            into something that no longer reads as a sequence. */}
        <ol className="-mx-1 flex min-w-0 flex-1 items-start gap-0 overflow-x-auto px-1 pb-1">
          {steps.map((s, i) => (
            <li key={s.key} className="flex min-w-0 shrink-0 items-start lg:flex-1">
              {/* The button takes the width and the connector is fixed. They
                  were both flex-1, which gave the button a basis of 0 — and a
                  truncating label inside a zero-width box shows nothing. */}
              <button type="button" onClick={() => onOpen?.(s.key)} disabled={!onOpen}
                className="group flex w-[5.5rem] min-w-0 shrink-0 flex-col items-center gap-1 text-center lg:w-auto lg:flex-1"
                title={s.detail ?? undefined}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition ${DOT[s.state]} ${onOpen ? "group-hover:scale-105" : ""}`}>
                  {s.state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={`w-full truncate text-[11px] leading-tight ${TEXT[s.state]}`}>{s.label}</span>
                {/* One line only: a wrapped status turns the strip into a wall. */}
                {s.detail && <span className="hidden w-full truncate text-[10px] leading-tight text-slate-400 lg:block">{s.detail}</span>}
              </button>
              {i < steps.length - 1 && (
                <span className={`mt-3.5 h-0.5 w-4 shrink-0 rounded lg:w-6 ${LINE[steps[i + 1].state === "done" ? "done" : s.state]}`} aria-hidden />
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
