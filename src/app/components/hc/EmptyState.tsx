// Empty and waiting states for the health-check journey: an icon on a soft
// disc, a heading, a line of explanation and an optional action — instead of
// a bare sentence. Three moods: waiting (on us or on time), empty (nothing
// yet), done (all clear).

import Link from "next/link";
import { CheckCircle2, Clock, Inbox, type LucideIcon } from "lucide-react";

type Variant = "waiting" | "empty" | "done";

const LOOK: Record<Variant, { Icon: LucideIcon; disc: string; icon: string }> = {
  waiting: { Icon: Clock, disc: "bg-amber-50", icon: "text-amber-600" },
  empty: { Icon: Inbox, disc: "bg-slate-100", icon: "text-slate-500" },
  done: { Icon: CheckCircle2, disc: "bg-hc-brand-surface", icon: "text-hc-brand-dark" },
};

export default function EmptyState({ variant = "empty", title, body, action, compact }: {
  variant?: Variant;
  title: string;
  body?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  compact?: boolean;
}) {
  const { Icon, disc, icon } = LOOK[variant];
  const btn = "mt-4 inline-flex min-h-10 items-center rounded-hc-element bg-hc-ink px-4 text-sm font-semibold text-white hover:bg-slate-700";
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "rounded-hc-card border border-dashed border-slate-300 bg-hc-surface p-6" : "rounded-hc-hero bg-hc-surface p-8 shadow-hc-card ring-1 ring-slate-200"}`}>
      <span className={`flex items-center justify-center rounded-full ${disc} ${compact ? "h-11 w-11" : "h-14 w-14"}`} aria-hidden>
        <Icon className={`${compact ? "h-5 w-5" : "h-7 w-7"} ${icon}`} strokeWidth={2} />
      </span>
      <p className={`mt-3 font-semibold text-hc-ink ${compact ? "text-base" : "text-lg"}`}>{title}</p>
      {body && <p className="mt-1 max-w-md text-sm text-hc-ink-2">{body}</p>}
      {action && (action.href
        ? <Link href={action.href} className={btn}>{action.label}</Link>
        : <button type="button" onClick={action.onClick} className={btn}>{action.label}</button>)}
    </div>
  );
}
