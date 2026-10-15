"use client";

// "Næsta skref" — one optional setup item at a time.
//
// The four setup things (reminder and the app on the home screen, the
// calendar, a partner, the coach) used to be a four-row checklist inside the
// profile step, right next to the kennitala form — the one step that is
// actually required. Shown together they competed with it and read as four
// more obligations. Here they come one at a time, after the required part,
// in the order that matters most for coming back: the reminder first (it
// has the evidence behind it, see SetupFlow), then the calendar, the
// partner, and the coach.
//
// Each can be put off with "Ekki núna" for seven days, remembered in this
// browser only — this is a nudge, not a record, and a failed read simply
// shows the card again. Everything is still in Stillingar, open and in place.

import { useCallback, useEffect, useState } from "react";
import { SETUP_ROWS, type SetupKey } from "./SetupFlow";
import { SetupStepBody, useSetupData } from "./SetupWalkthrough";
import CalendarConnect from "./CalendarConnect";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

const ORDER: SetupKey[] = ["nudge", "calendar", "partner", "coach"];
const KEY = "hc-next-step-dismissed-at";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** key → when it was put off. Only snoozes younger than seven days count. */
type Snoozed = Partial<Record<SetupKey, number>>;

function readDismissed(): Snoozed {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const now = Date.now();
    const out: Snoozed = {};
    for (const k of ORDER) {
      const at = (v as Record<string, unknown>)[k];
      if (typeof at === "number" && now - at < SNOOZE_MS) out[k] = at;
    }
    return out;
  } catch { return {}; }
}

export default function NextStepCard({ api, entry }: {
  api: Api;
  /** The journey's track; the app-alone track has no coach to set up. */
  entry: string | null;
}) {
  const d = useSetupData(api);
  const [done, setDone] = useState<Record<SetupKey, boolean> | null>(null);
  const [dismissed, setDismissed] = useState<Snoozed | null>(null);

  const load = useCallback(async () => {
    const [cal, partner, nudge] = await Promise.all([
      api("/api/hc/google").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/partner").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      api("/api/hc/nudges").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setTimeout(() => setDone({
      coach: !!d.myCoach,
      calendar: !!cal?.connected || d.calConnected,
      partner: !!partner?.partner?.id || !!partner?.partner?.name,
      nudge: (nudge?.prefs?.channels?.length ?? 0) > 0,
    }), 0);
  }, [api, d.myCoach, d.calConnected]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => setDismissed(readDismissed()), 0);
    return () => clearTimeout(t);
  }, []);

  if (!done || !dismissed || d.coaches === null) return null;
  const key = ORDER.find((k) => !(k === "coach" && entry === "app") && !done[k] && !dismissed[k]);
  const row = SETUP_ROWS.find((r) => r.key === key);
  if (!key || !row) return null;

  const later = () => {
    const next: Snoozed = { ...dismissed, [key]: Date.now() };
    setDismissed(next);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  return (
    <section className="rounded-hc-card bg-hc-surface p-5 shadow-hc-card ring-1 ring-hc-hairline" aria-labelledby="next-step-title">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-hc-brand-text">Næsta skref · valfrjálst</p>
          <h2 id="next-step-title" className="mt-0.5 text-lg font-bold text-hc-ink">{row.title}</h2>
          <p className="mt-1 text-sm text-hc-ink-2">{row.why}</p>
        </div>
      </div>
      <div className="mt-4">
        <SetupStepBody rowKey={key} d={d} api={api} entry={entry} reload={load} />
      </div>
      <button type="button" onClick={later}
        className="mt-3 min-h-11 rounded-hc-element px-1 text-sm font-semibold text-hc-ink-3 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand">
        Ekki núna
      </button>
      <CalendarConnect api={d.calendarApi} open={d.calOpen}
        onClose={() => { d.setCalOpen(false); void d.load(); void load(); }}
        intro="Tímar hjá Lifeline birtast í dagatalinu þínu og myndsímtöl fá hlekk á fundinn." />
    </section>
  );
}
