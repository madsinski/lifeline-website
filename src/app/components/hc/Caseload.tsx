"use client";

// A coach's own clients, at the top of their day.
//
// ── Why this is the first thing on the screen ────────────────────────
//
// The workstation opened on a PDF drop zone — "dragðu heilsufarsskýrslu
// hingað". That is the right first move for intake work, and the wrong one
// for coaching: a coach starting their day needs to know who is waiting on
// them, not to be handed a filing tray. So this sits above it, and the
// intake keeps its place directly underneath for the days that do start
// with a report.
//
// ── What it shows and why ────────────────────────────────────────────
//
// Unanswered messages first, then whoever is slipping. A caseload is read
// top-down, so the order has to be the triage — otherwise it is a directory
// and the coach does the sorting in their head every morning.
//
// Days with at least one tick over a week, not ticks: somebody with six
// habits should not look better than somebody with two, and it is the same
// figure the participant sees on their own page, so a conversation about it
// starts from one number rather than two.

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Users } from "lucide-react";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Client {
  journey_id: string;
  client_id: string;
  name: string | null;
  entry: string | null;
  stage: string | null;
  has_plan: boolean;
  days_7: number;
  days_28: number;
  needs_reply: boolean;
  last_message: { body: string; at: string; fromClient: boolean; unread: boolean } | null;
}

/** What the person bought, in a word. */
const TRACK_IS: Record<string, string> = {
  coach: "Heilsuþjálfun",
  app: "Appið",
  b2c: "Heilsufarsskoðun",
  b2b: "Vinnustaður",
  heilsugaesla: "Heilsugæsla",
};

/**
 * How a week is going, in words rather than a bare number.
 *
 * "2 af 7 dögum" is a fact; "er að slitna" is the thing a coach is scanning
 * for. The thresholds are deliberately coarse — this decides who to look at
 * first, not how anybody is doing.
 */
function weekTone(days: number): { label: string; cls: string } {
  if (days >= 5) return { label: "Í góðum takti", cls: "bg-hc-brand/10 text-hc-brand-text ring-hc-brand/30" };
  if (days >= 2) return { label: "Dregur úr", cls: "bg-hc-warn-surface text-hc-warn-ink ring-hc-warn-ink/30" };
  return { label: "Ekkert í viku", cls: "bg-hc-bad-surface text-hc-bad-ink ring-hc-bad-ink/30" };
}

export default function Caseload({ api, onOpen }: {
  api: Api;
  /** Open this client's workspace. */
  onOpen: (journeyId: string) => void;
}) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [window_, setWindow] = useState({ short: 7, long: 28 });

  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/caseload").then((x) => (x.ok ? x.json() : null)).catch(() => null);
    setTimeout(() => {
      setClients(r?.clients ?? []);
      if (r?.window) setWindow(r.window);
    }, 0);
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  if (clients === null) {
    return <div className="h-28 rounded-2xl hc-shimmer" aria-busy="true" aria-label="Hleð skjólstæðingum" />;
  }

  /*
   * Nothing at all is a sentence, not an empty card.
   *
   * A coach with no assigned clients is the normal state on a new system,
   * and "0" with no explanation reads as a bug.
   */
  if (!clients.length) {
    return (
      <section className="rounded-2xl bg-hc-surface p-4 ring-1 ring-hc-hairline">
        <p className="flex items-center gap-2 text-sm font-semibold text-hc-ink-2">
          <Users className="h-4 w-4 text-hc-ink-3" aria-hidden /> Mínir skjólstæðingar
        </p>
        <p className="mt-1 text-sm text-hc-ink-2">
          Enginn er skráður á þig. Þú birtist hér þegar þjálfari er valinn í heilsuferð einhvers.
        </p>
      </section>
    );
  }

  const waiting = clients.filter((c) => c.needs_reply).length;

  return (
    <section className="overflow-hidden rounded-2xl bg-hc-surface ring-1 ring-hc-hairline">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-hc-hairline p-4">
        <p className="flex items-center gap-2 font-semibold text-hc-ink">
          <Users className="h-4 w-4 text-hc-ink-3" aria-hidden /> Mínir skjólstæðingar
          <span className="font-normal text-hc-ink-2">{clients.length}</span>
        </p>
        {waiting > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-hc-bad-surface px-2.5 py-0.5 text-xs font-bold text-hc-bad-ink ring-1 ring-hc-bad-ink/30">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            {waiting} {waiting === 1 ? "bíður svars" : "bíða svars"}
          </span>
        )}
      </div>

      <ul>
        {clients.map((c) => {
          const tone = weekTone(c.days_7);
          return (
            <li key={c.journey_id} className="border-b border-hc-hairline last:border-b-0">
              <button type="button" onClick={() => onOpen(c.journey_id)}
                className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-hc-sunken">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-hc-ink">{c.name ?? "Án nafns"}</span>
                    {c.entry && (
                      <span className="rounded-full bg-hc-sunken-2 px-2 py-0.5 text-[11px] font-semibold text-hc-ink-2">
                        {TRACK_IS[c.entry] ?? c.entry}
                      </span>
                    )}
                    {!c.has_plan && (
                      <span className="rounded-full bg-hc-sunken-2 px-2 py-0.5 text-[11px] font-semibold text-hc-ink-2">Engin áætlun</span>
                    )}
                  </span>

                  {/* The last thing they said, because that is usually the
                      reason to open somebody. */}
                  {c.last_message ? (
                    <span className={`mt-1 block truncate text-sm ${c.needs_reply ? "font-semibold text-hc-bad-ink" : "text-hc-ink-2"}`}>
                      {c.last_message.fromClient ? "" : "Þú: "}{c.last_message.body}
                    </span>
                  ) : (
                    <span className="mt-1 block text-sm text-hc-ink-3">Engin skilaboð</span>
                  )}
                </span>

                <span className="shrink-0 text-right">
                  <span className={`block rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${tone.cls}`}>
                    {tone.label}
                  </span>
                  <span className="mt-1 block text-[11px] tabular-nums text-hc-ink-2">
                    {c.days_7}/{window_.short} dagar · {c.days_28}/{window_.long}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
