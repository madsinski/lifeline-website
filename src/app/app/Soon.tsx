"use client";

// A tab that exists but is not built yet.
//
// The nav has five destinations from the start because the shape of the app
// is a decision, not something to discover one screen at a time. A tab that
// 404s teaches someone the app is broken; one that says what is coming and
// where to go meanwhile does not.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { appBrand, appCard } from "./ui";

export default function Soon({ title, body, now }: {
  title: string;
  body: string;
  /** Where the thing lives today, while this is being built. */
  now?: { label: string; href: string };
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: appBrand.ink1 }}>{title}</h1>
      <div className={`${appCard} p-5`}>
        <p className="text-sm" style={{ color: appBrand.ink2 }}>{body}</p>
        {now && (
          <Link href={now.href}
            className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 font-semibold text-white transition active:opacity-90"
            style={{ background: appBrand.primary }}>
            {now.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
