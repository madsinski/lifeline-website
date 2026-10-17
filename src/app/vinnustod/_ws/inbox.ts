"use client";

// People waiting on the coach: unanswered messages and open beiðnir.
//
// One poll for both, because both mean the same thing to a coach ("a person
// is waiting on you"): they share the Í dag badge and sit in the same "Bíður
// þín" list as the journey tasks. Polled while the tab is visible and read
// again the moment it comes back; chimes on a rise only, so a page that
// already had three waiting does not announce them every fifteen seconds.

import { useCallback, useEffect, useRef, useState } from "react";
import { chime } from "@/lib/hc/chime";
import type { WsApi } from "@/app/components/hc/ws-api";
import type { WsRequest } from "@/app/components/hc/WsRequests";

export interface ChatThread {
  journeyId: string; clientId: string; name: string;
  last: string | null; lastAt: string; lastFrom: "client" | "coach"; unread: number;
}

/** A request for "Lifeline þjálfun" waiting for a Lifeline worker (/api/vinnustod/coaching-requests). */
export interface CoachingReq {
  id: string; client_id: string; created_at: string;
  name: string | null; email: string | null; phone: string | null;
  address: string | null; postcode: string | null; town: string | null;
  journey_id: string | null;
  evidence: {
    company?: { id: string; name: string | null; address: string | null; in_region: boolean } | null;
    journey_entry?: string | null;
    station_visits?: { count: number; in_region: number; last_at: string | null; last_location: string | null };
    measurements_done?: number;
    previous_coaching?: boolean;
  };
}

export interface Inbox {
  threads: ChatThread[] | null;
  requests: WsRequest[] | null;
  /** Coaching requests to confirm. Always [] for partner workers (the route answers 403). */
  coaching: CoachingReq[];
  /** True when the last poll failed and there is nothing older to show. */
  failed: boolean;
  /** Unread messages + open requests + coaching requests: the Í dag badge. */
  waiting: number;
  reload: () => Promise<void>;
}

export function useInbox(api: WsApi): Inbox {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [requests, setRequests] = useState<WsRequest[] | null>(null);
  const [coaching, setCoaching] = useState<CoachingReq[]>([]);
  const [failed, setFailed] = useState(false);
  const rung = useRef(-1);

  const reload = useCallback(async () => {
    const [r, rq, cq] = await Promise.all([
      api("/api/vinnustod/chat").catch(() => null),
      api("/api/vinnustod/requests").catch(() => null),
      /* Lifeline workers only; a partner gets 403 and simply has none. A
         failed poll keeps what was there rather than emptying the list. */
      api("/api/vinnustod/coaching-requests").catch(() => null),
    ]);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    const rj = rq?.ok ? await rq.json().catch(() => null) : null;
    const cj = cq?.ok ? await cq.json().catch(() => null) : null;
    const t: ChatThread[] | null = Array.isArray(j?.threads) ? j.threads : null;
    const q: WsRequest[] | null = Array.isArray(rj?.requests) ? rj.requests : null;
    const c: CoachingReq[] | null = Array.isArray(cj?.requests) ? cj.requests : cq?.status === 403 ? [] : null;
    const n = (t ?? []).reduce((s, x) => s + (x.unread ?? 0), 0) + (q ?? []).filter((x) => x.status === "open").length + (c ?? []).length;
    // Deferred: this runs on a path an effect calls, and the compiler
    // objects to setting state synchronously there.
    setTimeout(() => {
      if (t) setThreads(t);
      if (q) setRequests(q);
      if (c) setCoaching(c);
      setFailed(!t || !q);
    }, 0);
    /* A failed poll counts nothing, so it must not reset the count — the
       next good poll then "rose" to what was already there and chimed for
       old news. The first poll only sets the baseline. */
    if (!t || !q) return;
    if (rung.current >= 0 && n > rung.current) chime();
    rung.current = n;
  }, [api]);

  useEffect(() => {
    const first = setTimeout(() => void reload(), 0);
    const tick = () => { if (document.visibilityState === "visible") void reload(); };
    const id = window.setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearTimeout(first);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [reload]);

  const waiting = (threads ?? []).reduce((s, x) => s + (x.unread ?? 0), 0) + (requests ?? []).filter((x) => x.status === "open").length + coaching.length;
  return { threads, requests, coaching, failed, waiting, reload };
}
