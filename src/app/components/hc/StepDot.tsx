// A numbered step marker: done, current, waiting or still to come.
//
// Replaces the emerald-500 discs with a white tick (2.5:1, below the 3:1 a
// graphic needs) and the "✓" glyph, which renders in whatever font the
// device has. Done is hc-brand-dark with a lucide Check (5.48:1); a step
// still to come shows its number in ink-2 on the sunken tone, which passes
// AA in both themes.

import { Check, Clock } from "lucide-react";

export type StepState = "done" | "current" | "waiting" | "todo";

const LOOK: Record<StepState, string> = {
  done: "bg-hc-brand-dark text-white",
  current: "bg-hc-brand-dark text-white ring-4 ring-hc-brand/25",
  waiting: "bg-hc-warn-surface text-hc-warn-ink ring-1 ring-hc-warn-ink/30",
  todo: "bg-hc-sunken-2 text-hc-ink-2 ring-1 ring-hc-border",
};

const SIZE = { sm: "h-6 w-6 text-[11px]", md: "h-7 w-7 text-xs", lg: "h-9 w-9 text-sm" } as const;
const ICON = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" } as const;

export default function StepDot({ state, n, size = "md", className = "", label }: {
  state: StepState;
  /** The step's number, shown unless the step is done (or waiting, which shows a clock). */
  n?: number;
  size?: keyof typeof SIZE;
  className?: string;
  /** Spoken label when the dot stands alone; otherwise it is decorative. */
  label?: string;
}) {
  return (
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums ${SIZE[size]} ${LOOK[state]} ${className}`}>
      {state === "done" ? <Check className={ICON[size]} strokeWidth={3} aria-hidden />
        : state === "waiting" && n === undefined ? <Clock className={ICON[size]} aria-hidden />
        : n}
    </span>
  );
}
