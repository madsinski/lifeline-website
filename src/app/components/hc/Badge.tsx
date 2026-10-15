// One badge for the health-check journey and the workstation.
//
// Every chip in here was hand-mixed — bg-red-100 text-red-800, bg-amber-100
// text-hc-warn-ink, bg-emerald-500 text-white — and each mix was a separate
// guess at contrast, most of which went dark-on-dark or light-on-light in the
// workstation's dark theme. The tones below are the hc surface/ink pairs from
// globals.css, which are measured for AA in both themes.
//
// Never below 11px: the 10px chips this replaces were under the size anybody
// reads at arm's length on a phone. Client-safe, no hooks.

import type { ReactNode } from "react";

export type BadgeTone = "ok" | "warn" | "bad" | "info" | "neutral" | "brand" | "count";

const TONES: Record<BadgeTone, string> = {
  ok: "bg-hc-ok-surface text-hc-ok-ink ring-1 ring-hc-ok-ink/25",
  warn: "bg-hc-warn-surface text-hc-warn-ink ring-1 ring-hc-warn-ink/25",
  bad: "bg-hc-bad-surface text-hc-bad-ink ring-1 ring-hc-bad-ink/25",
  info: "bg-hc-info-surface text-hc-info-ink ring-1 ring-hc-info-ink/25",
  neutral: "bg-hc-sunken-2 text-hc-ink-2 ring-1 ring-hc-hairline",
  /** The one solid fill: white on hc-brand-dark is 5.48:1 in either theme. */
  brand: "bg-hc-brand-dark text-white",
  /** A number on a tab or a heading ("3"): solid, round, tabular. */
  count: "bg-hc-brand-dark text-white tabular-nums",
};

export const badgeClass = (tone: BadgeTone = "neutral", size: "sm" | "md" = "sm") =>
  `inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-bold leading-none ${
    tone === "count" ? "min-w-5 justify-center px-1.5" : size === "md" ? "px-2.5" : "px-2"} ${
    size === "md" ? "py-1 text-xs" : "py-0.5 text-[11px]"} ${TONES[tone]}`;

export default function Badge({ tone = "neutral", size = "sm", icon, children, className = "", title, ...aria }: {
  tone?: BadgeTone;
  /** sm = 11px (inline with body text), md = 12px (beside a heading). */
  size?: "sm" | "md";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
  "aria-label"?: string;
}) {
  return (
    <span className={`${badgeClass(tone, size)} ${className}`} title={title} {...aria}>
      {icon}
      {children}
    </span>
  );
}
