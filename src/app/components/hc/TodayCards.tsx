"use client";

// The data behind the cards above the checklist on Í dag: how you are doing,
// what is urgent, and your partner.
//
// All from one request (/api/hc/today) — three cards at the top of the daily
// page should not be three round trips. The TodayCard component that used to
// live here was never rendered anywhere and has been removed; the hook and the
// Stats type are what the Í dag page and PeopleSheet use.

import { useCallback, useEffect, useState } from "react";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface Stats { days7: number; days14: number; days28: number; streak: number; percent28: number }

interface Data {
  stats: Stats | null;
  /** Your own avatar, for the Staðan sleeve. Null for most people. */
  avatar?: string | null;
  urgent: { kind: "appointment" | "nudge"; at: string; title: string; detail: string | null; href: string | null }[];
  partner: { id: string | null; name: string; canNudge: boolean; avatar?: string | null; stats: Stats | null } | null;
}

/** One fetch, three cards. */
export function useToday(api: Api) {
  const [d, setD] = useState<Data | null>(null);
  const load = useCallback(async () => {
    const r = await api("/api/hc/today");
    const j = r.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => setD(j), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  return { today: d, reloadToday: load };
}
