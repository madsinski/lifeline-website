// One admin page frame: the page's single <h1>, a line saying what the page
// is for, and an actions slot on the right (wraps below on a phone).
//
// The layout's header carries breadcrumbs only, so this h1 is the only one
// on the page. Server-safe (no hooks).

import type { ReactNode } from "react";

export function AdminPage({ title, description, actions, children, className = "" }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-7xl ${className}`}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-hc-ink">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-hc-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
