// Empty and waiting states for the health-check journey: an icon on a soft
// disc, a heading, a line of explanation and an optional action — instead of
// a bare sentence. Three moods: waiting (on us or on time), empty (nothing
// yet), done (all clear).

import Link from "next/link";
import { CheckCircle2, Clock, Inbox, type LucideIcon } from "lucide-react";

type Variant = "waiting" | "empty" | "done";

const LOOK: Record<Variant, { Icon: LucideIcon; disc: string; icon: string }> = {
  waiting: { Icon: Clock, disc: "bg-amber-50", icon: "text-amber-600" },
  empty: { Icon: Inbox, disc: "bg-slate-100", icon: "text-slate-600" },
  done: { Icon: CheckCircle2, disc: "bg-hc-brand-surface", icon: "text-hc-brand-dark" },
};

export default function EmptyState({ variant = "empty", title, body, action, compact, quiet }: {
  variant?: Variant;
  title: string;
  body?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  compact?: boolean;
  /*
   * One line, for a work tool.
   *
   * "Ekkert bíður" was a centred card with a 44px disc, a heading and a
   * sentence — about 150px to say that there is nothing to do. On a
   * workstation that is the most common state of several panels at once,
   * and vertical space is what a clinician is short of: four of these and
   * the actual work is below the fold.
   *
   * Good news should be quiet. It still says the same words.
   */
  quiet?: boolean;
}) {
  const { Icon, disc, icon } = LOOK[variant];
  const btn = "mt-4 inline-flex min-h-10 items-center rounded-hc-element bg-hc-ink px-4 text-sm font-semibold text-white hover:bg-emerald-800";

  if (quiet) {
    return (
      <p className="flex items-center gap-2 rounded-hc-element bg-hc-surface px-3 py-2.5 text-sm text-hc-ink-2 ring-1 ring-hc-hairline">
        <Icon className={`h-4 w-4 shrink-0 ${icon}`} strokeWidth={2} aria-hidden />
        <span className="font-semibold text-hc-ink">{title}</span>
        {body && <span className="min-w-0 truncate">{body}</span>}
        {action && (action.href
          ? <Link href={action.href} className="ml-auto shrink-0 font-semibold text-hc-brand-dark hover:underline">{action.label}</Link>
          : <button type="button" onClick={action.onClick} className="ml-auto shrink-0 font-semibold text-hc-brand-dark hover:underline">{action.label}</button>)}
      </p>
    );
  }

  return (
    <div className={`flex flex-col items-center text-center ${compact ? "rounded-hc-card border border-dashed border-slate-300 bg-hc-surface p-6" : "rounded-hc-hero bg-hc-surface p-8 shadow-hc-card ring-1 ring-hc-hairline"}`}>
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
