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
// Each can be put off with "Ekki núna", which is remembered in this browser
// only — this is a nudge, not a record, and a failed read simply shows the
// card again. Everything is still in Stillingar, open and in place.

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { SETUP_ROWS, type SetupKey } from "./SetupFlow";
import { SetupStepBody, useSetupData } from "./SetupWalkthrough";
import CalendarConnect from "./CalendarConnect";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

const ORDER: SetupKey[] = ["nudge", "calendar", "partner", "coach"];
const KEY = "hc-next-step-dismissed";

function readDismissed(): SetupKey[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is SetupKey => ORDER.includes(x)) : [];
  } catch { return []; }
}

export default function NextStepCard({ api, entry }: {
  api: Api;
  /** The journey's track; the app-alone track has no coach to set up. */
  entry: string | null;
}) {
  const d = useSetupData(api);
  const [done, setDone] = useState<Record<SetupKey, boolean> | null>(null);
  const [dismissed, setDismissed] = useState<SetupKey[] | null>(null);

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
  const key = ORDER.find((k) => !(k === "coach" && entry === "app") && !done[k] && !dismissed.includes(k));
  const row = SETUP_ROWS.find((r) => r.key === key);
  if (!key || !row) return null;

  const later = () => {
    const next = [...dismissed, key];
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
        <button type="button" onClick={later} aria-label="Ekki núna"
          className="shrink-0 rounded-lg p-1.5 text-hc-ink-3 hover:bg-hc-sunken">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="mt-4">
        <SetupStepBody rowKey={key} d={d} api={api} entry={entry} reload={load} />
      </div>
      <button type="button" onClick={later}
        className="mt-3 text-sm font-semibold text-hc-ink-3 underline">
        Ekki núna
      </button>
      <CalendarConnect api={d.calendarApi} open={d.calOpen}
        onClose={() => { d.setCalOpen(false); void d.load(); void load(); }}
        intro="Tímar hjá Lifeline birtast í dagatalinu þínu og myndsímtöl fá hlekk á fundinn." />
    </section>
  );
}
