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

export interface Inbox {
  threads: ChatThread[] | null;
  requests: WsRequest[] | null;
  /** True when the last poll failed and there is nothing older to show. */
  failed: boolean;
  /** Unread messages + open requests: the Í dag badge. */
  waiting: number;
  reload: () => Promise<void>;
}

export function useInbox(api: WsApi): Inbox {
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [requests, setRequests] = useState<WsRequest[] | null>(null);
  const [failed, setFailed] = useState(false);
  const rung = useRef(0);

  const reload = useCallback(async () => {
    const [r, rq] = await Promise.all([
      api("/api/vinnustod/chat").catch(() => null),
      api("/api/vinnustod/requests").catch(() => null),
    ]);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    const rj = rq?.ok ? await rq.json().catch(() => null) : null;
    const t: ChatThread[] | null = Array.isArray(j?.threads) ? j.threads : null;
    const q: WsRequest[] | null = Array.isArray(rj?.requests) ? rj.requests : null;
    const n = (t ?? []).reduce((s, x) => s + (x.unread ?? 0), 0) + (q ?? []).filter((x) => x.status === "open").length;
    // Deferred: this runs on a path an effect calls, and the compiler
    // objects to setting state synchronously there.
    setTimeout(() => {
      if (t) setThreads(t);
      if (q) setRequests(q);
      setFailed(!t || !q);
    }, 0);
    if (n > rung.current) chime();
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

  const waiting = (threads ?? []).reduce((s, x) => s + (x.unread ?? 0), 0) + (requests ?? []).filter((x) => x.status === "open").length;
  return { threads, requests, failed, waiting, reload };
}
