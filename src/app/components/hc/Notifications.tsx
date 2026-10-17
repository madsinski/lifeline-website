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
import { BadgeCheck, Bell, CalendarClock, FileCheck2, Hand, Hourglass, MessageCircle, ShieldCheck } from "lucide-react";
import { badgeClass } from "./Badge";
import { hcCard } from "./ui";
import { useSwipe } from "@/lib/hc/use-swipe";
import Sheet from "./Sheet";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface Note {
  id: string; kind: "coach" | "partner" | "appointment" | "report" | "retention" | "trial" | "consent" | "coaching";
  title: string; body: string | null; at: string; unread: boolean; href: string | null;
  /** Several messages behind one row. */
  count?: number;
}

const ICON = { coach: MessageCircle, partner: Hand, appointment: CalendarClock, report: FileCheck2, retention: FileCheck2, trial: Hourglass, consent: ShieldCheck, coaching: BadgeCheck };

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
    // A poll that fails (offline, a hidden tab waking) keeps what is shown
    // rather than blanking the list and the badge — and does not throw.
    const r = await api("/api/hc/notifications").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (!j) return;
    const n = Number(j.unread ?? 0);
    setTimeout(() => { setItems(j.items ?? []); setUnread(n); }, 0);
    syncBadge(n);
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
    await api("/api/hc/notifications", { method: "POST", body: JSON.stringify({ seen: true }) }).catch(() => null);
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

  /*
   * A control, not a hint.
   *
   * It was a bare glyph — red when there was something, grey when there was
   * not — which at rest read as decoration on a page full of real buttons,
   * so nobody pressed it. It is a filled circle now: white on the hero's
   * own ground, with a ring, so it looks like the thing it is at 44px. The
   * red state keeps the pulse and goes solid red, so "something is waiting"
   * is a colour change on a shape you already recognise rather than the
   * only time the shape is visible at all.
   */
  const cls = `relative grid h-11 w-11 shrink-0 place-items-center rounded-full ring-1 shadow-sm transition active:scale-95 ${
    unread > 0
      ? "bg-red-600 text-white ring-red-700/40 hover:bg-red-700"
      : "bg-hc-surface text-hc-brand-text ring-hc-brand/25 hover:bg-hc-brand-surface"}`;
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
      <Bell className={`relative h-5 w-5 ${fresh ? "animate-hc-swing motion-reduce:animate-none" : ""}`} aria-hidden />
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
    : <Link href="/app/tilkynningar" onClick={() => setFresh(false)} className={cls} aria-label={label}>{inner}</Link>;
}

/** The whole Tilkynningar page, as a sheet. */
export function NotificationSheet({ items, upcoming, onClose, onNavigate }: {
  items: Note[];
  upcoming?: React.ReactNode;
  onClose: () => void;
  /** Passed to the list, so a same-page link switches tabs instead of
   *  changing the address and doing nothing. */
  onNavigate?: (href: string) => boolean;
}) {
  /*
   * The list as it was when the sleeve opened.
   *
   * Opening it marks everything seen, so the next poll came back with
   * nothing unread and the red dots vanished while Mads was still looking
   * at them — the dot disappeared a second after he opened the sleeve,
   * before he had read anything. Marking seen is right: he has seen that
   * there is something. But the per-item dot means "you have not opened
   * this one", so it holds the opening snapshot and a row clears only when
   * it is actually tapped.
   */
  const [shown, setShown] = useState(items);
  const seeded = useRef(items.length > 0);
  useEffect(() => {
    if (seeded.current || !items.length) return;
    seeded.current = true;
    // Deferred, like the rest of this file: setting state on a path an
    // effect calls synchronously is what the compiler objects to.
    const t = setTimeout(() => setShown(items), 0);
    return () => clearTimeout(t);
  }, [items]);

  return (
    <Sheet title="Á döfinni og tilkynningar" onClose={onClose}>
      <div className="space-y-5 p-4">
        {upcoming && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-hc-ink-3">Á döfinni</p>
            {upcoming}
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-hc-ink-3">Tilkynningar</p>
          <NotificationList items={shown} onNavigate={onNavigate}
            onOpened={(id) => setShown((xs) => xs.map((x) => (x.id === id ? { ...x, unread: false } : x)))}
            onDismiss={(id) => setShown((xs) => xs.filter((x) => x.id !== id))} />
        </div>
      </div>
    </Sheet>
  );
}

/** The full list. */
export function NotificationList({ items, onNavigate, onOpened, onDismiss }: {
  items: Note[];
  /** Tapped: clear this row's dot, whatever the server says next. */
  onOpened?: (id: string) => void;
  /** Swiped away: drop it from the list. */
  onDismiss?: (id: string) => void;
  /**
   * Handle the link in place, if the page can.
   *
   * The plan page keeps its active tab in React state, set once from the
   * URL on load — so a Link to "?tab=coach" changed the address and nothing
   * else, which is why tapping a message notification appeared to do
   * nothing at all. Returning true means the page took it.
   */
  onNavigate?: (href: string) => boolean;
}) {
  if (items.length === 0) {
    return <p className={`${hcCard.base} p-6 text-center text-sm text-hc-ink-2`}>Ekkert nýtt í bili.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((n) => {
        const Icon = ICON[n.kind] ?? Bell;
        const inner = (
          <>
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${n.unread ? "bg-hc-ok-surface" : "bg-hc-sunken-2"}`}>
              <Icon className={`h-4 w-4 ${n.unread ? "text-hc-brand-text" : "text-hc-ink-2"}`} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-hc-ink">{n.title}</span>
                {/* Was a 8px dot against a white card, which is not much
                    for the one thing on the row that is urgent. */}
                {n.unread && (
                  <span className="relative grid h-5 shrink-0 place-items-center" aria-label="nýtt">
                    <span className="absolute inset-0 animate-hc-ping rounded-full bg-red-500/40 motion-reduce:hidden" aria-hidden />
                    <span className={`relative ${badgeClass("bad")} uppercase tracking-wide`}>Nýtt</span>
                  </span>
                )}
              </span>
              {n.body && <span className="mt-0.5 block text-xs leading-snug text-hc-ink-2">{n.body}</span>}
              <span className="mt-0.5 block text-[11px] text-hc-ink-3">
                {whenIs(n.at)}
                {/* Say how many are behind the row, so the newest message
                    showing alone does not look like the only one. */}
                {n.count && n.count > 1 ? ` · ${n.count} skilaboð` : ""}
              </span>
            </span>
          </>
        );
        const card = n.href
          ? <Link href={n.href}
              onClick={(e) => { onOpened?.(n.id); if (n.href && onNavigate?.(n.href)) e.preventDefault(); }}
              className={`${hcCard.base} flex items-start gap-3 p-4 transition hover:ring-slate-300`}>{inner}</Link>
          : <div className={`${hcCard.base} flex items-start gap-3 p-4`}>{inner}</div>;

        /* Swipe it away, the same gesture as the Í dag checklist.
           A notification you have taken in but are not going to act on
           right now still sat there — and "I have read this" is not the
           same as "open it", which is the only thing that cleared it. */
        return onDismiss
          ? <Row key={n.id} onDismiss={() => onDismiss(n.id)}>{card}</Row>
          : <div key={n.id}>{card}</div>;
      })}
    </div>
  );
}

/** One dismissible card: drag left, a red action appears behind it. */
function Row({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  const swipe = useSwipe();
  return (
    <div className="relative overflow-hidden rounded-hc-card">
      <button type="button" onClick={() => { onDismiss(); swipe.close(); }}
        aria-label="Fjarlægja"
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-rose-600 px-4 text-sm font-bold text-white"
        style={{ width: 88 }}>
        Fjarlægja
      </button>
      <div className="relative transition-transform"
        style={{ transform: `translateX(${swipe.dx}px)`, transitionDuration: swipe.dx === 0 || swipe.open ? "160ms" : "0ms", touchAction: "pan-y" }}
        {...swipe.handlers}>
        {children}
      </div>
    </div>
  );
}
