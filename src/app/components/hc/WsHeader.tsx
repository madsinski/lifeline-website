"use client";

// The workstation's one line of chrome: who you are, and a way out.
//
// Everything else that used to sit up here — the lookup, the calendar, the
// PIN, sign out — lives in the menu behind the avatar. A nurse mid-interview
// should see the client, not our navigation.

import { useEffect, useId, useRef, useState } from "react";
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
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const menuItems = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const focusItem = (i: number) => {
    const all = menuItems();
    if (all.length) all[(i + all.length) % all.length].focus();
  };

  // Opening moves focus to the first item; a click elsewhere closes.
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const all = menuItems();
    const i = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); focusItem(i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusItem(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusItem(0); }
    else if (e.key === "End") { e.preventDefault(); focusItem(all.length - 1); }
    else if (e.key === "Tab") close(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-hc-hairline bg-hc-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <LifelineLogo size="sm" />
          <span className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-hc-ok-ink sm:block">Vinnustöð</span>
        </div>

        <div className="relative">
          <button ref={trigger} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-controls={open ? menuId : undefined}
            onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); } }}
            className="flex items-center gap-2 rounded-full border border-hc-hairline py-1 pl-1 pr-2.5 hover:bg-hc-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand-dark">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hc-brand-dark text-xs font-bold text-white" aria-hidden>{initials}</span>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-hc-ink-2 sm:block">{name}</span>
            <span className="sr-only sm:hidden">{name} – valmynd</span>
            <ChevronDown className="h-4 w-4 text-hc-ink-3" aria-hidden />
          </button>
          {open && (
            <div ref={menu} id={menuId} role="menu" aria-label={`${name} · ${role}`} onKeyDown={onMenuKey}
              className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-hc-hairline bg-hc-surface py-1 shadow-lg">
              <p className="px-4 py-2 text-xs text-hc-ink-2" role="presentation">{name} · {role}</p>
              {items.map((it) => {
                const Icon = it.icon ? ICONS[it.icon] : null;
                return (
                  <button key={it.label} type="button" role="menuitem" tabIndex={-1}
                    // Focus goes back to the trigger first, so a dialog the
                    // item opens returns focus there when it closes.
                    onClick={() => { close(); it.onClick(); }}
                    className="flex w-full items-center gap-2 border-t border-hc-hairline px-4 py-2.5 text-left text-sm text-hc-ink-2 hover:bg-hc-sunken focus:bg-hc-sunken focus:outline-none">
                    {Icon && <Icon className="h-4 w-4 text-hc-ink-3" aria-hidden />}
                    <span className="flex-1">{it.label}</span>
                    {it.hint && <span className="text-xs text-hc-ink-3">{it.hint}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
