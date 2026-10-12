"use client";

// The week, as seven columns you can read at a glance.
//
// This replaces the grid WeekCalendar drew: a 15-minute lattice with one
// button per slot, which measured 119 buttons on one screen and asked the
// coach to find the three appointments among them. A dashboard needs the
// opposite — show what is booked, say nothing about what is not.
//
// What it does: the week, each day a column, each appointment a chip with
// its time and whose it is. Today is marked. Clicking a chip opens that
// client. Empty days stay empty rather than filling with placeholder slots,
// because "nothing on Thursday" is read faster from blank space than from
// twenty-eight empty cells.
//
// What it deliberately does not do: drag to reschedule. That lived in the
// old grid and still does — and rescheduling one appointment now has a
// better home anyway, on the client's own Bókanir, which can move it and
// re-sync both calendars. A week strip is for seeing the week.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Video } from "lucide-react";
import { hcBtn } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Ev {
  source: "journey" | "booking";
  journey_id: string;
  client: string | null;
  kind: string;
  at: string;
  minutes: number | null;
  done?: boolean;
  mine?: boolean;
  meeting_url?: string | null;
}

const KIND_IS: Record<string, string> = {
  interview: "Viðtal", followup: "Eftirfylgd", blood: "Blóðprufa",
  measurements: "Mælingar", video: "Myndsímtal", measurement: "Mæling",
};

/** Monday of the week a date falls in. */
function monday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  /* getDay() is Sunday-first; Iceland's week starts on Monday. */
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

const DAY_IS = ["mán", "þri", "mið", "fim", "fös", "lau", "sun"];

export default function WeekAhead({ api, onOpenClient }: {
  api: Api;
  onOpenClient: (journeyId: string) => void;
}) {
  /** Monday of the shown week, and a fixed "now" for marking today. */
  const [start, setStart] = useState<Date | null>(null);
  const [now, setNow] = useState(0);
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [mine, setMine] = useState(false);

  /* The clock is read once, in an effect, not during render: a render-time
     Date.now() is impure and gives a different answer every pass. */
  useEffect(() => {
    const t = setTimeout(() => { const d = new Date(); setNow(d.getTime()); setStart(monday(d)); }, 0);
    return () => clearTimeout(t);
  }, []);

  const load = useCallback(async () => {
    if (!start) return;
    const to = new Date(start); to.setDate(to.getDate() + 7);
    const r = await api(`/api/vinnustod/calendar/events?from=${start.toISOString()}&to=${to.toISOString()}&scope=${mine ? "mine" : "all"}`).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => setEvents(j?.events ?? []), 0);
  }, [api, start, mine]);

  useEffect(() => { void load(); }, [load]);

  const days = useMemo(() => {
    if (!start) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const key = d.toDateString();
      return {
        date: d,
        isToday: now > 0 && new Date(now).toDateString() === key,
        items: (events ?? []).filter((e) => new Date(e.at).toDateString() === key)
          .sort((a, b) => a.at.localeCompare(b.at)),
      };
    });
  }, [start, events, now]);

  if (!start) return <div className="h-48 rounded-2xl hc-shimmer" aria-busy="true" aria-label="Hleð vikunni" />;

  const shift = (weeks: number) => {
    const d = new Date(start); d.setDate(d.getDate() + weeks * 7); setStart(d);
    setEvents(null);
  };
  const range = `${start.getDate()}.–${days[6].date.getDate()}. ${days[6].date.toLocaleDateString("is-IS", { month: "long" })}`;

  return (
    <section className="rounded-2xl border border-hc-hairline bg-white p-4 shadow-hc-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Vikan</h2>
        <span className="text-sm font-semibold text-slate-900">{range}</span>
        <span className="flex-1" />
        {/* Mine or everyone's: a partner site shares a diary, so "whose" is
            a question the coach actually has. */}
        <button type="button" onClick={() => { setMine((v) => !v); setEvents(null); }}
          aria-pressed={mine}
          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
            mine ? "bg-hc-brand-surface text-hc-brand-dark" : "text-slate-500 hover:bg-slate-50"}`}>
          {mine ? "Mínar" : "Allar"}
        </button>
        <button type="button" onClick={() => shift(-1)} aria-label="Fyrri vika" className={`${hcBtn.ghost} h-8 w-8 p-0`}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => { const d = new Date(); setStart(monday(d)); setEvents(null); }}
          className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          Í dag
        </button>
        <button type="button" onClick={() => shift(1)} aria-label="Næsta vika" className={`${hcBtn.ghost} h-8 w-8 p-0`}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Seven columns on a desk, a scrollable row of them on a phone —
          never a sideways scroll of the whole page. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((d) => (
          <div key={d.date.toISOString()}
            className={`min-h-[84px] rounded-xl p-2 ${
              d.isToday ? "bg-hc-brand-surface ring-1 ring-hc-brand/30" : "bg-slate-50/70"}`}>
            <p className={`mb-1.5 text-[11px] font-bold uppercase ${d.isToday ? "text-hc-brand-dark" : "text-slate-500"}`}>
              {DAY_IS[(d.date.getDay() + 6) % 7]} {d.date.getDate()}
            </p>
            <div className="space-y-1">
              {d.items.map((e, i) => (
                <button key={`${e.at}-${i}`} type="button"
                  onClick={() => e.journey_id && onOpenClient(e.journey_id)}
                  disabled={!e.journey_id}
                  title={`${KIND_IS[e.kind] ?? e.kind} · ${e.client ?? ""}`}
                  className={`block w-full rounded-lg border-l-2 bg-white px-1.5 py-1 text-left shadow-sm transition hover:shadow ${
                    /* Done fades; a video call gets the brand edge so the one
                       you have to be somewhere for stands out. */
                    e.done ? "border-slate-200 opacity-60"
                      : e.kind === "video" || e.kind === "interview" || e.kind === "followup"
                        ? "border-hc-brand" : "border-slate-300"}`}>
                  <span className="flex items-center gap-1">
                    <span className="text-[11px] font-bold tabular-nums text-slate-900">
                      {new Date(e.at).toLocaleTimeString("is-IS", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {e.meeting_url && <Video className="h-3 w-3 shrink-0 text-hc-brand-dark" aria-hidden />}
                  </span>
                  <span className="block truncate text-[11px] leading-tight text-slate-600">
                    {e.client ?? KIND_IS[e.kind] ?? e.kind}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {events !== null && events.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">Ekkert bókað þessa viku.</p>
      )}
    </section>
  );
}
