"use client";

// Participant navigation once the plan exists: one product, four places.
// Bottom bar on a phone (thumb reach, safe area), a segmented bar on top on
// larger screens.

import Link from "next/link";
import { ClipboardList, Compass, FileHeart, Sun } from "lucide-react";

export type JourneyPlace = "today" | "plan" | "report" | "journey";

const ITEMS: { key: JourneyPlace; label: string; href: string; Icon: typeof Sun }[] = [
  { key: "today", label: "Í dag", href: "/account/heilsuferd/aaetlun?tab=today", Icon: Sun },
  { key: "plan", label: "Áætlunin", href: "/account/heilsuferd/aaetlun?tab=plan", Icon: ClipboardList },
  { key: "report", label: "Skýrslan", href: "/account/heilsuferd/aaetlun?tab=report", Icon: FileHeart },
  { key: "journey", label: "Ferðin", href: "/account/heilsuferd?ferd=1", Icon: Compass },
];

export default function JourneyNav({ active, hasReport = true, onSelect }: {
  active: JourneyPlace;
  hasReport?: boolean;
  /** On the plan page the first three switch tabs in place. */
  onSelect?: (k: JourneyPlace) => boolean;
}) {
  const items = ITEMS.filter((i) => i.key !== "report" || hasReport);
  const item = (i: (typeof ITEMS)[number], mobile: boolean) => {
    const on = i.key === active;
    return (
      <Link key={i.key} href={i.href} aria-current={on ? "page" : undefined}
        onClick={(e) => { if (onSelect?.(i.key)) e.preventDefault(); }}
        className={mobile
          ? `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${on ? "text-emerald-700" : "text-slate-500"}`
          : `flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${on ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
        <i.Icon className={mobile ? "h-6 w-6" : "h-4 w-4"} strokeWidth={on && mobile ? 2.4 : 2} aria-hidden />
        {i.label}
      </Link>
    );
  };
  return (
    <>
      <nav aria-label="Heilsuferðin" className="hidden rounded-xl bg-white p-1 ring-1 ring-slate-200 sm:flex print:hidden">
        {items.map((i) => item(i, false))}
      </nav>
      <nav aria-label="Heilsuferðin" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {items.map((i) => item(i, true))}
      </nav>
    </>
  );
}
