"use client";

// The notification centre: the strip beside the greeting, and the list.
//
// The dot only lights for something that actually arrived and has not been
// looked at — a coach message, a kveðja, a report waiting to be confirmed.
// A booked appointment shows in the list but never lights it: a dot you
// cannot clear is a dot people stop seeing.

import { chime } from "@/lib/hc/chime";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Zap, CalendarClock, FileCheck2, Hand, MessageCircle } from "lucide-react";
import { hcCard } from "./ui";
import Sheet from "./Sheet";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface Note {
  id: string; kind: "coach" | "partner" | "appointment" | "report" | "retention";
  title: string; body: string | null; at: string; unread: boolean; href: string | null;
  /** Several messages behind one row. */
  count?: number;
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

/**
 * How often to look while the tab is open. Fifteen seconds is short enough
 * that a reply during a conversation feels immediate and long enough that
 * it costs nothing noticeable.
 */
const POLL_MS = 15_000;

/**
 * Keep the launcher icon's dot honest.
 *
 * The service worker sets a plain dot when a push arrives, because it has
 * no idea how many things are waiting. The page does know, so it writes the
 * real number — and clears it when there is nothing, which is the half that
 * matters: a badge that will not go away is the same complaint as a dot
 * that cannot be cleared.
 *
 * Only an installed app has a launcher icon, so on everything else both
 * calls are no-ops that throw and are ignored.
 */
function syncBadge(n: number) {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (n > 0) void nav.setAppBadge?.(n)?.catch(() => {});
    else void nav.clearAppBadge?.()?.catch(() => {});
  } catch { /* not supported */ }
}

export function useNotifications(api: Api) {
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const load = useCallback(async () => {
    const r = await api("/api/hc/notifications");
    const j = r.ok ? await r.json().catch(() => null) : null;
    const n = Number(j?.unread ?? 0);
    setTimeout(() => { setItems(j?.items ?? []); setUnread(n); }, 0);
    if (r.ok) syncBadge(n);
  }, [api]);
  /*
   * Keep it current without the person reloading.
   *
   * Polling rather than a realtime subscription: hc_chat is API-mediated
   * with RLS blocking direct reads, and it is not in the realtime
   * publication, so a browser subscription would receive nothing. Opening
   * the table to the anon client to get a push would trade a real boundary
   * for a few seconds of latency.
   *
   * Two triggers. Every POLL_MS while the tab is actually visible — hidden
   * tabs are skipped so a phone in a pocket is not polling all afternoon —
   * and immediately when the tab comes back, which is what makes it feel
   * instant: you return to the app and the dot is already there.
   */
  useEffect(() => {
    void load();
    const tick = () => { if (document.visibilityState === "visible") void load(); };
    const id = window.setInterval(tick, POLL_MS);
    const onBack = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
    };
  }, [load]);
  const markSeen = useCallback(async () => {
    await api("/api/hc/notifications", { method: "POST", body: JSON.stringify({ seen: true }) });
    await load();
  }, [api, load]);
  return { items, unread, reloadNotifications: load, markSeen };
}

const SEEN_KEY = "hc-notif-seen-count";

/**
 * Beside "Hæ Mads": the bell and the count.
 *
 * Loud on purpose, because a coach's message or a report waiting for
 * approval is the one thing on this page that is waiting on the person
 * rather than the other way round. A red ring pulses behind it and a chime
 * plays — but only when the count has actually gone up since they last
 * looked, so opening the page five times does not ring five times.
 *
 * The high-water mark lives in localStorage, which is per-browser and can
 * throw in a private window, so every access is guarded and a failure just
 * means the alert behaves as if everything were new. Motion is dropped for
 * anyone who asked for less of it; the red stays.
 */
export function NotificationBell({ unread, onOpen }: {
  unread: number;
  /**
   * Open it here instead of navigating.
   *
   * A notification is a glance — you look, you see there is nothing, you
   * carry on. Leaving the page to find that out and then pressing back is
   * three navigations for no information. Given this, the bolt opens a
   * sheet; without it, it still links to the page, which is what every
   * other surface wants.
   */
  onOpen?: () => void;
}) {
  const [fresh, setFresh] = useState(false);
  const rung = useRef(false);

  useEffect(() => {
    // Deferred, like the loader above it: setting state synchronously inside
    // an effect cascades renders, and nothing here needs to land this tick.
    const t = setTimeout(() => {
      if (unread <= 0) {
        try { window.localStorage.removeItem(SEEN_KEY); } catch { /* private mode */ }
        setFresh(false);
        return;
      }
      let seen = 0;
      try { seen = Number(window.localStorage.getItem(SEEN_KEY) ?? 0) || 0; } catch { /* private mode */ }
      if (unread > seen) {
        setFresh(true);
        try { window.localStorage.setItem(SEEN_KEY, String(unread)); } catch { /* private mode */ }
        // Once per mount. React runs effects twice in development and a
        // double chime is the kind of thing that ships.
        if (!rung.current) { rung.current = true; chime(); }
      }
    }, 0);
    return () => clearTimeout(t);
  }, [unread]);

  const cls = `relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
    unread > 0 ? "text-red-600 hover:bg-red-50" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`;
  const label = unread ? `Tilkynningar, ${unread} ný` : "Tilkynningar";
  /* Defined here rather than as a wrapper component: a component created
     during render is a new type every render, so React unmounts and
     remounts its subtree — which would restart the pulse on every tick. */
  const inner = (
    <>
      {/* The pulse sits behind the bell and does not move it, so the
          greeting line stays put while it rings. */}
      {fresh && (
        <span className="absolute inset-0 animate-hc-ping rounded-full bg-red-500/30 motion-reduce:hidden" aria-hidden />
      )}
      <Zap className={`relative h-5 w-5 ${fresh ? "animate-hc-swing motion-reduce:animate-none" : ""}`} aria-hidden />
      {unread > 0 && (
        <span className={`absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white ${
          fresh ? "animate-hc-pulse motion-reduce:animate-none" : ""}`}>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </>
  );

  return onOpen
    ? <button type="button" onClick={() => { setFresh(false); onOpen(); }} className={cls} aria-label={label}>{inner}</button>
    : <Link href="/account/heilsuferd/tilkynningar" onClick={() => setFresh(false)} className={cls} aria-label={label}>{inner}</Link>;
}

/** The whole Tilkynningar page, as a sheet. */
export function NotificationSheet({ items, upcoming, onClose }: {
  items: Note[];
  upcoming?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Sheet title="Á döfinni og tilkynningar" onClose={onClose}>
      <div className="space-y-5 p-4">
        {upcoming && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Á döfinni</p>
            {upcoming}
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Tilkynningar</p>
          <NotificationList items={items} />
        </div>
      </div>
    </Sheet>
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
        const Icon = ICON[n.kind] ?? Zap;
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
              <span className="mt-0.5 block text-[11px] text-slate-400">
                {whenIs(n.at)}
                {/* Say how many are behind the row, so the newest message
                    showing alone does not look like the only one. */}
                {n.count && n.count > 1 ? ` · ${n.count} skilaboð` : ""}
              </span>
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
