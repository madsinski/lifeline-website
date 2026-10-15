"use client";

// Participant navigation: five fixed tabs, the same on a phone and on a
// laptop, on every page of the app.
//
//   Í dag · Æfingar · Næring · Þjálfari (or Hjúkrun) · Ég
//
// Æfingar and Næring only when the plan has them. Everything occasional —
// the report, the journey map, fræðsla, notifications, settings — lives
// under Ég (/app/eg), so there is no overflow menu: nine items behind a
// "Meira" that differed between phone and desktop meant the two bars
// disagreed about what mattered, and whatever was behind it went unfound.
//
// The bar works out for itself what to show (from the cached
// /api/hc/journey/exists and /api/hc/plan), so every page draws the same
// one rather than each passing its own guess.

import Link from "next/link";
import { hcTabs } from "./ui";
import LifelineLogo from "@/app/components/LifelineLogo";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useKeyboard } from "@/lib/hc/use-keyboard";
import { supabase } from "@/lib/supabase";
import * as cache from "@/lib/hc/client-cache";
import { badgeClass } from "./Badge";
import { CircleUserRound, Dumbbell, Stethoscope, Sun, UserRound, Utensils } from "lucide-react";

type Tab = "today" | "exercise" | "nutrition" | "coach" | "me";

/**
 * Where the page is. The first five are the tabs; the rest are pages that
 * live under Ég and light that tab.
 */
export type JourneyPlace = Tab | "fraedsla" | "report" | "journey" | "notifications" | "account";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

const api: Api = async (url, init = {}) => {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return fetch(url, { ...init, headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.headers as Record<string, string> | undefined) } });
};

interface Exists { exists?: boolean; has_plan?: boolean; entry?: string | null }
interface PlanBody { plan?: { exercise?: unknown; nutrition?: unknown } | null }

/** What the bar needs to know, read from the cache first so it is there on the first paint. */
function useAvailability() {
  const seed = () => {
    const e = cache.peek<Exists>("/api/hc/journey/exists")?.body;
    const p = cache.peek<PlanBody>("/api/hc/plan")?.body;
    return {
      hasPlan: e?.has_plan ?? !!p?.plan,
      exercise: !!p?.plan?.exercise,
      nutrition: !!p?.plan?.nutrition,
      entry: e?.entry ?? null,
    };
  };
  const [state, setState] = useState(seed);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const e = await cache.load(api, "/api/hc/journey/exists");
        if (e.status >= 400) return;
        const eb = e.body as Exists;
        let exercise = false, nutrition = false;
        if (eb.has_plan) {
          const p = await cache.load(api, "/api/hc/plan");
          const pb = p.body as PlanBody;
          exercise = !!pb.plan?.exercise;
          nutrition = !!pb.plan?.nutrition;
        }
        if (alive) setState({ hasPlan: !!eb.has_plan, exercise, nutrition, entry: eb.entry ?? null });
      } catch { /* offline: keep what the cache said */ }
    })();
    return () => { alive = false; };
  }, []);
  return state;
}

/*
 * How many things are waiting: coach messages on the coach tab, everything
 * else (a report to confirm, a kveðja) on Ég, where Tilkynningar lives.
 *
 * From /api/hc/notifications, which already folds the coach thread into
 * one row with its own unread flag — a poll while visible and on return,
 * the same cadence as the bell.
 */
function useNavUnread(enabled: boolean) {
  const [n, setN] = useState({ coach: 0, other: 0 });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      const r = await api("/api/hc/notifications").catch(() => null);
      if (!r?.ok || !alive) return;
      const j = (await r.json().catch(() => null)) as { items?: { kind: string; unread: boolean; count?: number }[] } | null;
      const items = j?.items ?? [];
      const coach = items.filter((i) => i.kind === "coach" && i.unread).reduce((s, i) => s + (i.count ?? 1), 0);
      const other = items.filter((i) => i.kind !== "coach" && i.unread).length;
      if (alive) setN({ coach, other });
    };
    void load();
    const tick = () => { if (document.visibilityState === "visible") void load(); };
    const id = window.setInterval(tick, 15_000);
    window.addEventListener("focus", tick);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [enabled]);
  return n;
}

/**
 * The mark, at the top of the journey.
 *
 * Suppressing the marketing header took the logo with it, which left the
 * app looking like it belonged to nobody. This is the brand and nothing
 * else: no menu, no links out — the tab bar is the navigation here.
 */
export function JourneyHeader() {
  return (
    <div className="flex items-center justify-between pb-5 pt-2 sm:pb-6 sm:pt-3">
      <Link href="/app" aria-label="Heilsuferðin">
        <LifelineLogo size="sm" />
      </Link>
    </div>
  );
}

const ME_PLACES: JourneyPlace[] = ["me", "fraedsla", "report", "journey", "notifications", "account"];

export default function JourneyNav({ active, counts, onSelect }: {
  active: JourneyPlace;
  /**
   * Unread coach messages and other notifications, when the page already
   * polls them (the plan page does). Omit it and the nav counts for itself.
   */
  counts?: { coach: number; other: number };
  /** On the plan page the plan tabs switch in place; return true to stop the link. */
  onSelect?: (k: Tab) => boolean;
  /** @deprecated The bar works these out itself; kept so older callers still compile. */
  hasReport?: boolean;
  /** @deprecated */
  hasPlan?: boolean;
  /** @deprecated */
  hasExercise?: boolean;
  /** @deprecated */
  hasNutrition?: boolean;
  /** @deprecated Use counts. */
  unread?: number;
}) {
  /*
   * Out of the way while typing. iOS does not resize the viewport for the
   * keyboard, so a bar fixed to the bottom sits on whatever is being typed
   * into. Nobody changes tab mid-sentence; it is back when the field closes.
   */
  const keyboard = useKeyboard();
  const avail = useAvailability();
  const own = useNavUnread(!counts);
  const counted = counts ?? own;
  const coachCount = counted.coach;
  const care = avail.entry !== null && avail.entry !== "coach" && avail.entry !== "app";
  const on: Tab = ME_PLACES.includes(active) ? "me" : (active as Tab);

  const items: { key: Tab; label: string; href: string; Icon: typeof Sun; count?: number; dot?: boolean }[] = [
    { key: "today", label: "Í dag", href: avail.hasPlan ? "/app/aaetlun?tab=today" : "/app", Icon: Sun },
    ...(avail.hasPlan && avail.exercise ? [{ key: "exercise" as const, label: "Æfingar", href: "/app/aaetlun?tab=exercise", Icon: Dumbbell }] : []),
    ...(avail.hasPlan && avail.nutrition ? [{ key: "nutrition" as const, label: "Næring", href: "/app/aaetlun?tab=nutrition", Icon: Utensils }] : []),
    /* A person for the coach; a stethoscope only on the care track, where
       the person on the other end is a nurse and the label says so. */
    { key: "coach", label: care ? "Hjúkrun" : "Þjálfari", href: "/app/aaetlun?tab=coach", Icon: care ? Stethoscope : UserRound, count: coachCount },
    { key: "me", label: "Ég", href: "/app/eg", Icon: CircleUserRound, dot: counted.other > 0 },
  ];

  const item = (i: (typeof items)[number], mobile: boolean) => {
    const current = i.key === on;
    const badge = i.count && i.count > 0
      ? <span className={`${badgeClass("count")} absolute -right-2.5 -top-1.5 ring-2 ring-hc-surface`} aria-hidden>{i.count > 9 ? "9+" : i.count}</span>
      : i.dot ? <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-hc-bad-ink ring-2 ring-hc-surface" aria-hidden /> : null;
    const sr = i.count && i.count > 0 ? `, ${i.count} ólesin` : i.dot ? ", nýtt" : "";
    return (
      <Link key={i.key} href={i.href} aria-current={current ? "page" : undefined}
        onClick={(e) => { if (onSelect?.(i.key)) e.preventDefault(); }}
        className={mobile
          ? `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hc-brand ${current ? "text-hc-brand-text" : "text-hc-ink-2"}`
          : `${hcTabs.tab(current)} flex min-h-11 items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand`}>
        <span className="relative">
          <i.Icon className={mobile ? "h-6 w-6" : "h-4 w-4"} strokeWidth={current && mobile ? 2.4 : 2} aria-hidden />
          {badge}
        </span>
        <span className="truncate">{i.label}<span className="sr-only">{sr}</span></span>
      </Link>
    );
  };

  /*
   * Into <body>, like the sheets: a bottom margin from a space-y parent on a
   * fixed bottom-0 element lifts it off the edge, so the phone bar is
   * mounted on the viewport's own element instead.
   */
  const bar = (
    <nav aria-label="Heilsuferðin" hidden={keyboard.open}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-hc-hairline bg-hc-surface/95 backdrop-blur sm:hidden print:hidden"
      /* Height from the shared token, so a docked bar can offset itself by
         exactly this and stay right if it changes. */
      style={{ height: "var(--hc-nav-h)", paddingBottom: "env(safe-area-inset-bottom)", boxSizing: "content-box" }}>
      {items.map((i) => item(i, true))}
    </nav>
  );

  return (
    <>
      <nav aria-label="Heilsuferðin" className={`hidden sm:flex print:hidden ${hcTabs.bar}`}>
        {items.map((i) => item(i, false))}
      </nav>
      {typeof document === "undefined" ? bar : createPortal(bar, document.body)}
    </>
  );
}
