"use client";

// The workstation's one line of chrome: who you are, and a way out.
//
// Everything else that used to sit up here — the lookup, the calendar, the
// PIN, sign out — lives in the menu behind the avatar. A nurse mid-interview
// should see the client, not our navigation.

import { useState } from "react";
import { BookOpen, CalendarDays, ChevronDown, KeyRound, LogOut } from "lucide-react";
import LifelineLogo from "@/app/components/LifelineLogo";

export interface WsMenuItem {
  label: string;
  onClick: () => void;
  icon?: "book" | "calendar" | "key" | "logout";
  hint?: string;
}

const ICONS = {
  book: BookOpen,
  calendar: CalendarDays,
  key: KeyRound,
  logout: LogOut,
} as const;

export default function WsHeader({ name, role, items }: { name: string; role: string; items: WsMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <LifelineLogo size="sm" />
          <span className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 sm:block">Vinnustöð</span>
        </div>

        <div className="relative">
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
            className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-2.5 hover:bg-slate-50">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10B981] text-xs font-bold text-white">{initials}</span>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-slate-700 sm:block">{name}</span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {open && (
            <>
              <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
              <div role="menu" className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
                <p className="px-4 py-2 text-xs text-slate-500">{name} · {role}</p>
                {items.map((it) => {
                  const Icon = it.icon ? ICONS[it.icon] : null;
                  return (
                    <button key={it.label} type="button" role="menuitem"
                      onClick={() => { setOpen(false); it.onClick(); }}
                      className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                      {Icon && <Icon className="h-4 w-4 text-slate-400" />}
                      <span className="flex-1">{it.label}</span>
                      {it.hint && <span className="text-xs text-slate-400">{it.hint}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
