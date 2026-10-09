"use client";

// The notification centre: the strip beside the greeting, and the list.
//
// The dot only lights for something that actually arrived and has not been
// looked at — a coach message, a kveðja, a report waiting to be confirmed.
// A booked appointment shows in the list but never lights it: a dot you
// cannot clear is a dot people stop seeing.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, FileCheck2, Hand, MessageCircle } from "lucide-react";
import { hcCard } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface Note {
  id: string; kind: "coach" | "partner" | "appointment" | "report" | "retention";
  title: string; body: string | null; at: string; unread: boolean; href: string | null;
}

const ICON = { coach: MessageCircle, partner: Hand, appointment: CalendarClock, report: FileCheck2, retention: FileCheck2 };

const MO = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];
/** Hand-written: Vercel's runtime has no Icelandic locale data. */
export function whenIs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (d.toDateString() === new Date().toDateString()) return `í dag kl. ${hh}`;
  if (days === 1) return `í gær kl. ${hh}`;
  if (days > 1 && days < 7) return `fyrir ${days} dögum`;
  return `${d.getDate()}. ${MO[d.getMonth()]} kl. ${hh}`;
}

export function useNotifications(api: Api) {
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const load = useCallback(async () => {
    const r = await api("/api/hc/notifications");
    const j = r.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => { setItems(j?.items ?? []); setUnread(j?.unread ?? 0); }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  const markSeen = useCallback(async () => {
    await api("/api/hc/notifications", { method: "POST", body: JSON.stringify({ seen: true }) });
    await load();
  }, [api, load]);
  return { items, unread, reloadNotifications: load, markSeen };
}

/**
 * Beside "Hæ Mads": the bell and the count, nothing else.
 *
 * It carried the newest item's title too, which on a phone took half the
 * line and pushed the greeting around as the text changed length. The
 * count already says there is something; the title is one tap away.
 */
export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link href="/account/heilsuferd/tilkynningar"
      className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      aria-label={unread ? `Tilkynningar, ${unread} ný` : "Tilkynningar"}>
      <Bell className="h-5 w-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

/** The full list. */
export function NotificationList({ items }: { items: Note[] }) {
  if (items.length === 0) {
    return <p className={`${hcCard.base} p-6 text-center text-sm text-slate-500`}>Ekkert nýtt í bili.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((n) => {
        const Icon = ICON[n.kind] ?? Bell;
        const inner = (
          <>
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${n.unread ? "bg-emerald-50" : "bg-slate-100"}`}>
              <Icon className={`h-4 w-4 ${n.unread ? "text-hc-brand-dark" : "text-slate-500"}`} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-hc-ink">{n.title}</span>
                {n.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="nýtt" />}
              </span>
              {n.body && <span className="mt-0.5 block text-xs leading-snug text-hc-ink-2">{n.body}</span>}
              <span className="mt-0.5 block text-[11px] text-slate-400">{whenIs(n.at)}</span>
            </span>
          </>
        );
        return n.href
          ? <Link key={n.id} href={n.href} className={`${hcCard.base} flex items-start gap-3 p-4 transition hover:ring-slate-300`}>{inner}</Link>
          : <div key={n.id} className={`${hcCard.base} flex items-start gap-3 p-4`}>{inner}</div>;
      })}
    </div>
  );
}
