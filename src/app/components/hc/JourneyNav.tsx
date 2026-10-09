"use client";

// Participant navigation once the plan exists: Í dag, Æfingar, Næring,
// Fræðsla, Þjálfari, Skýrslan, Ferðin (the programme tabs only when the plan
// has them).
// Bottom bar on a phone (thumb reach, safe area), a segmented bar on top on
// larger screens.

import Link from "next/link";
import { hcTabs } from "./ui";
import { useState } from "react";
import { Bell, BookOpen, CircleUser, Compass, Dumbbell, FileHeart, MessageCircle, MoreHorizontal, Sun, Utensils } from "lucide-react";

export type JourneyPlace = "today" | "exercise" | "nutrition" | "fraedsla" | "coach" | "report" | "journey" | "notifications" | "account";

/**
 * `primary` is what earns a slot in the bar itself. Nine items laid flat
 * overflowed the bar on a laptop and it scrolled sideways — a nav you have
 * to drag is a nav whose last items nobody finds.
 *
 * The five primary ones are the surfaces someone opens on a given day. The
 * rest are real destinations but occasional: a lecture, the journey map,
 * settings. Tilkynningar is deliberately never primary — the bell beside the
 * greeting is its entry point, and a tab as well would be the same door
 * twice.
 */
const ITEMS: { key: JourneyPlace; label: string; href: string; Icon: typeof Sun; primary?: boolean }[] = [
  { primary: true, key: "today", label: "Í dag", href: "/account/heilsuferd/aaetlun?tab=today", Icon: Sun },
  { primary: true, key: "exercise", label: "Æfingar", href: "/account/heilsuferd/aaetlun?tab=exercise", Icon: Dumbbell },
  { primary: true, key: "nutrition", label: "Næring", href: "/account/heilsuferd/aaetlun?tab=nutrition", Icon: Utensils },
  { key: "fraedsla", label: "Fræðsla", href: "/account/heilsuferd/fraedsla", Icon: BookOpen },
  { primary: true, key: "coach", label: "Þjálfari", href: "/account/heilsuferd/aaetlun?tab=coach", Icon: MessageCircle },
  { primary: true, key: "report", label: "Skýrslan", href: "/account/heilsuferd/aaetlun?tab=report", Icon: FileHeart },
  { key: "journey", label: "Ferðin", href: "/account/heilsuferd?ferd=1", Icon: Compass },
  { key: "notifications", label: "Tilkynningar", href: "/account/heilsuferd/tilkynningar", Icon: Bell },
  { key: "account", label: "Aðgangur", href: "/account/heilsuferd/adgangur", Icon: CircleUser },
];

export default function JourneyNav({ active, hasReport = true, hasExercise = true, hasNutrition = true, hasPlan = true, unread = 0, onSelect }: {
  active: JourneyPlace;
  /** Lights the dot on the Tilkynningar tab. */
  unread?: number;
  hasReport?: boolean;
  hasExercise?: boolean;
  hasNutrition?: boolean;
  hasPlan?: boolean;
  /** On the plan page the first three switch tabs in place. */
  onSelect?: (k: JourneyPlace) => boolean;
}) {
  const [more, setMore] = useState(false);
  const items = ITEMS.filter((i) =>
    (i.key !== "report" || hasReport) && (i.key !== "exercise" || (hasPlan && hasExercise)) && (i.key !== "nutrition" || (hasPlan && hasNutrition)) && (i.key !== "today" || hasPlan));
  const primary = items.filter((i) => i.primary);
  const rest = items.filter((i) => !i.primary);
  const restActive = rest.some((i) => i.key === active);
  /** Unread lives on a hidden item, so the overflow button has to say so. */
  const restUnread = rest.some((i) => i.key === "notifications") && unread > 0;

  const item = (i: (typeof ITEMS)[number], mobile: boolean) => {
    const on = i.key === active;
    return (
      <Link key={i.key} href={i.href} aria-current={on ? "page" : undefined}
        onClick={(e) => { if (onSelect?.(i.key)) e.preventDefault(); }}
        className={mobile
          ? `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${on ? "text-hc-brand-dark" : "text-slate-500"}`
          : `${hcTabs.tab(on)} flex items-center justify-center gap-2`}>
        <span className="relative">
          <i.Icon className={mobile ? "h-6 w-6" : "h-4 w-4"} strokeWidth={on && mobile ? 2.4 : 2} aria-hidden />
          {i.key === "notifications" && unread > 0 && (
            <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-label={`${unread} ný`} />
          )}
        </span>
        {i.label}
      </Link>
    );
  };
  return (
    <>
      <nav aria-label="Heilsuferðin" className={`hidden sm:flex print:hidden ${hcTabs.bar}`}>
        {primary.map((i) => item(i, false))}
        {rest.length > 0 && (
          <div className="relative flex shrink-0">
            <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
              className={`${hcTabs.tab(restActive)} flex items-center justify-center gap-2`}>
              <span className="relative">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
                {restUnread && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-label={`${unread} ný`} />}
              </span>
              Meira
            </button>
            {more && (
              <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
                {rest.map((i) => (
                  <Link key={i.key} href={i.href} onClick={(e) => { setMore(false); if (onSelect?.(i.key)) e.preventDefault(); }}
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold ${i.key === active ? "bg-emerald-50 text-hc-brand-dark" : "text-slate-700 hover:bg-slate-50"}`}>
                    <i.Icon className="h-5 w-5" aria-hidden />{i.label}
                    {i.key === "notifications" && unread > 0 && (
                      <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
      {/* The phone bar took the first four by position while the desktop bar
          took all nine, so the two disagreed about what mattered. Same split
          now — four primary and Meira, since five plus Meira is too many
          thumbs wide. */}
      {(() => {
        const slots = primary.length > 4 ? primary.slice(0, 4) : primary;
        const spill = [...primary.slice(slots.length), ...rest];
        const spillActive = spill.some((i) => i.key === active);
        const spillUnread = spill.some((i) => i.key === "notifications") && unread > 0;
        return (
          <nav aria-label="Heilsuferðin" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden print:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {slots.map((i) => item(i, true))}
            {spill.length > 0 && (
              <div className="relative flex flex-1">
                <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${spillActive ? "text-hc-brand-dark" : "text-slate-500"}`}>
                  <span className="relative">
                    <MoreHorizontal className="h-6 w-6" aria-hidden />
                    {spillUnread && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-label={`${unread} ný`} />}
                  </span>
                  Meira
                </button>
                {more && (
                  <div className="absolute bottom-full right-1 mb-2 w-48 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
                    {spill.map((i) => (
                      <Link key={i.key} href={i.href} onClick={(e) => { setMore(false); if (onSelect?.(i.key)) e.preventDefault(); }}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold ${i.key === active ? "bg-emerald-50 text-hc-brand-dark" : "text-slate-700 hover:bg-slate-50"}`}>
                        <i.Icon className="h-5 w-5" aria-hidden />{i.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>
        );
      })()}
    </>
  );
}
