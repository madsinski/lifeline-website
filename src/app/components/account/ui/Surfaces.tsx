"use client";

// The account pages' surfaces: a gradient hero to open a page, a white
// card for everything on it, and one Alert for anything that needs saying
// louder than a card. Built on the hc tokens (globals.css) so /account and
// /app read as one product. Bright white cards, no grey backdrops.

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { hcKicker } from "@/app/components/hc/ui";

/** The white card. ring-slate-200 rather than the hairline: on a white page
 *  the edge and the shadow are all that separate a card from the ground. */
export const accountCard = "rounded-hc-card bg-hc-surface shadow-hc-card ring-1 ring-slate-200";
/** An inset panel inside a card. */
export const accountInset = "rounded-hc-element bg-hc-sunken ring-1 ring-hc-hairline";
/** Form controls: hc-control edge passes 3:1 (WCAG 1.4.11). */
export const accountInput = "w-full rounded-hc-element border border-hc-control bg-hc-surface px-3 py-2 text-sm text-hc-ink outline-none placeholder:text-hc-ink-3 focus:border-hc-brand-dark focus:ring-2 focus:ring-hc-brand/25 disabled:bg-hc-sunken disabled:text-hc-ink-3";
export const accountLabel = "block text-sm font-medium text-hc-ink-2";

export function PageHero({ kicker, title, body, icon: Icon, children }: {
  kicker: string;
  title: string;
  body?: ReactNode;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-hc-hero bg-gradient-to-br from-hc-hero-from to-hc-hero-to p-6 text-white shadow-hc-raised sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-300/15 blur-3xl" />
      <div className="relative flex items-start gap-4">
        {Icon && (
          <span aria-hidden className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-hc-element bg-white/10 ring-1 ring-white/20 sm:flex">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className={`${hcKicker} text-emerald-200`}>{kicker}</p>
          <h1 className="mt-1.5 text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
          {body && <div className="mt-2.5 max-w-2xl text-base leading-relaxed text-emerald-50/90">{body}</div>}
          {children}
        </div>
      </div>
    </header>
  );
}

export function SectionCard({ title, description, action, icon: Icon, children, className = "", id, headingLevel = 2 }: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
  id?: string;
  headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 3 ? "h3" : "h2";
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={`${accountCard} scroll-mt-[calc(var(--hc-site-nav-h)+5.5rem)] p-5 sm:p-6 lg:scroll-mt-[calc(var(--hc-site-nav-h)+1.5rem)] ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start gap-3">
          {Icon && (
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-hc-element bg-hc-brand-surface text-hc-brand-text">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {title && <H id={headingId} className="text-lg font-bold text-hc-ink">{title}</H>}
            {description && <div className="mt-0.5 text-sm leading-relaxed text-hc-ink-2">{description}</div>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export type AlertTone = "ok" | "warn" | "info" | "bad";

const TONES: Record<AlertTone, { box: string; icon: LucideIcon }> = {
  ok: { box: "bg-hc-ok-surface text-hc-ok-ink ring-emerald-200", icon: CheckCircle2 },
  warn: { box: "bg-hc-warn-surface text-hc-warn-ink ring-amber-200", icon: AlertTriangle },
  info: { box: "bg-hc-info-surface text-hc-info-ink ring-sky-200", icon: Info },
  bad: { box: "bg-hc-bad-surface text-hc-bad-ink ring-rose-200", icon: XCircle },
};

export function Alert({ tone = "info", title, children, actions, onDismiss, dismissLabel = "Loka", compact = false, className = "" }: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  compact?: boolean;
  className?: string;
}) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div role={tone === "bad" || tone === "warn" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-hc-card ring-1 ${box} ${compact ? "px-3 py-2.5 text-sm" : "p-4 sm:p-5"} ${className}`}>
      <Icon aria-hidden className={`mt-0.5 shrink-0 ${compact ? "h-4 w-4" : "h-5 w-5"}`} />
      <div className="min-w-0 flex-1">
        {title && <p className={`font-semibold ${compact ? "" : "text-base"}`}>{title}</p>}
        {children && <div className={`${title ? "mt-1" : ""} text-sm leading-relaxed opacity-95`}>{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label={dismissLabel} title={dismissLabel}
          className="-m-1 shrink-0 rounded-md p-1 opacity-80 hover:bg-white/60 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current">
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A labelled value in a definition grid (profile, bookings). */
export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-hc-ink-3">{label}</dt>
      <dd className="mt-0.5 text-sm text-hc-ink">{children}</dd>
    </div>
  );
}

/** On/off switch with a real label. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand focus-visible:ring-offset-2 disabled:opacity-50 ${checked ? "bg-hc-brand-dark" : "bg-slate-300"}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}
