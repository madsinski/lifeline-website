"use client";

// A real back button for the heilsuferð pages: a pill with a chevron, 44px
// touch target, always to a fixed parent — never history.back(), which can
// drop someone out of the site when they arrived from an email link.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function BackLink({ href, label, className = "" }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pl-2 pr-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 print:hidden ${className}`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition group-hover:-translate-x-0.5 group-hover:bg-emerald-50 group-hover:text-emerald-700">
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </span>
      {label}
    </Link>
  );
}
