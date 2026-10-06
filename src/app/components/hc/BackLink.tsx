"use client";

// A real back button for the heilsuferð pages: a pill with a chevron, 44px
// touch target, always to a fixed parent — never history.back(), which can
// drop someone out of the site when they arrived from an email link.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * `onBack` turns it into a button instead of a link.
 *
 * Used when "back" means leaving a state rather than a page — the plan editor
 * lives inside the plan page, so a link to the account was the wrong way out
 * of it: the way out is closing the editor.
 */
export default function BackLink({ href, label, className = "", onBack }: {
  href?: string;
  label: string;
  className?: string;
  onBack?: () => void;
}) {
  const cls = `group inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pl-2 pr-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 print:hidden ${className}`;
  const inner = (
    <>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-hover:-translate-x-0.5 group-hover:bg-emerald-50 group-hover:text-emerald-700">
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </span>
      {label}
    </>
  );
  if (onBack) return <button type="button" onClick={onBack} className={cls}>{inner}</button>;
  return <Link href={href ?? "/account"} className={cls}>{inner}</Link>;
}
