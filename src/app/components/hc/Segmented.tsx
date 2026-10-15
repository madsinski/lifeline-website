"use client";

// A segmented control on the hcTabs recipe, with real semantics.
//
// Two modes, because they mean different things to a screen reader:
//
//   "radio" (default) — picks a value in place: a filter, a view, a period.
//     role=radiogroup / role=radio, arrow keys move and select.
//   "tabs" — switches a panel below it. role=tablist / role=tab with
//     aria-selected; pass panelId(value) so each tab points at its panel.
//
// Every segment is at least 44px tall. Roving tabindex: one Tab stop for the
// whole control, arrows inside it — what both ARIA patterns expect.

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { hcTabs } from "./ui";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** An optional count or badge after the label. */
  extra?: ReactNode;
  disabled?: boolean;
}

export default function Segmented<T extends string>({ options, value, onChange, label, mode = "radio", panelId, className = "", size = "md" }: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Accessible name for the group. */
  label: string;
  mode?: "radio" | "tabs";
  /** tabs mode: the id of the panel each tab controls. */
  panelId?: (v: T) => string;
  className?: string;
  /** sm keeps the 44px hit area but tightens the padding. */
  size?: "sm" | "md";
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const onKey = (e: KeyboardEvent, i: number) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key) || !enabled.length) return;
    e.preventDefault();
    const at = enabled.indexOf(i);
    const next =
      e.key === "Home" ? enabled[0]
      : e.key === "End" ? enabled[enabled.length - 1]
      : e.key === "ArrowRight" || e.key === "ArrowDown" ? enabled[(at + 1) % enabled.length]
      : enabled[(at - 1 + enabled.length) % enabled.length];
    refs.current[next]?.focus();
    onChange(options[next].value);
  };

  const tabs = mode === "tabs";
  return (
    <div role={tabs ? "tablist" : "radiogroup"} aria-label={label} className={`${hcTabs.bar} ${className}`}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button"
            role={tabs ? "tab" : "radio"}
            aria-selected={tabs ? active : undefined}
            aria-checked={tabs ? undefined : active}
            aria-controls={tabs && panelId ? panelId(o.value) : undefined}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={`${hcTabs.tab(active)} inline-flex min-h-11 items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand disabled:cursor-not-allowed disabled:opacity-40 ${size === "sm" ? "px-2.5 text-xs" : ""}`}>
            {o.label}
            {o.extra}
          </button>
        );
      })}
    </div>
  );
}
