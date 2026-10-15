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
import { fmtTime } from "@/app/components/account/ui/dates";

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

const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

export default function WeekAhead({ api, onOpenClient }: {
  api: Api;
  /** kind lets the page open the interview sheet for a viðtal/eftirfylgd. */
  onOpenClient: (journeyId: string, kind?: string) => void;
}) {
  /** Monday of the shown week, and a fixed "now" for marking today. */
  const [start, setStart] = useState<Date | null>(null);
  const [now, setNow] = useState(0);
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [mine, setMine] = useState(false);
  const [failed, setFailed] = useState(false);

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
    // A failed load is said, not drawn as an empty week: "nothing booked"
    // and "could not ask" must not look the same.
    setTimeout(() => { setFailed(!j); setEvents(j ? j.events ?? [] : null); }, 0);
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
  const range = `${start.getDate()}.–${days[6].date.getDate()}. ${MONTHS_IS[days[6].date.getMonth()]}`;
  const chip = "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand";

  return (
    <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4 shadow-hc-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-hc-ink-2">Vikan</h2>
        <span className="text-sm font-semibold text-hc-ink">{range}</span>
        <span className="flex-1" />
        {/* Mine or everyone's: a partner site shares a diary, so "whose" is
            a question the coach actually has. */}
        <button type="button" onClick={() => { setMine((v) => !v); setEvents(null); }}
          aria-pressed={mine}
          className={`${chip} ${mine ? "bg-hc-brand-surface text-hc-brand-text" : "text-hc-ink-2 hover:bg-hc-sunken"}`}>
          {mine ? "Mínar" : "Allar"}
        </button>
        <button type="button" onClick={() => shift(-1)} aria-label="Fyrri vika" className={`${hcBtn.ghost} h-11 w-11 p-0`}>
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={() => { const d = new Date(); setStart(monday(d)); setEvents(null); }}
          className={`${chip} text-hc-ink-2 hover:bg-hc-sunken`}>
          Í dag
        </button>
        <button type="button" onClick={() => shift(1)} aria-label="Næsta vika" className={`${hcBtn.ghost} h-11 w-11 p-0`}>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Grouped by day, not laid out as a grid.
          Seven columns across the left column of this page gives each day
          143px, and after padding a chip has about 127px — twenty
          characters at 11px, which is why every name came out as "Mads
          Aa…". A day-grouped list gives each appointment the full 1048px:
          the whole name, the kind spelled out, the length, and the join
          link if there is one.

          What it gives up is the shape of the week at a glance. With one to
          three appointments in a week that shape was mostly empty cells
          anyway, and reading the items is what a coach came to do. Days
          with nothing are left out rather than drawn empty. */}
      <div className="space-y-3">
        {days.filter((d) => d.items.length > 0).map((d) => (
          <div key={d.date.toISOString()}>
            <p className={`mb-1 text-xs font-bold uppercase tracking-wide ${
              d.isToday ? "text-hc-brand-text" : "text-hc-ink-2"}`}>
              {DAY_IS[(d.date.getDay() + 6) % 7]} {d.date.getDate()}.
              {d.isToday && " · í dag"}
            </p>
            <ul className="overflow-hidden rounded-xl ring-1 ring-hc-hairline">
              {d.items.map((e, i) => (
                <li key={`${e.at}-${i}`} className="border-b border-hc-hairline last:border-b-0">
                  <button type="button"
                    onClick={() => e.journey_id && onOpenClient(e.journey_id, e.source === "journey" ? e.kind : undefined)}
                    disabled={!e.journey_id}
                    className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-hc-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hc-brand ${
                      /* 80, not 55. Opacity multiplies contrast down
                         invisibly — a contrast check that reads the
                         computed colour sees slate-600 passing at 7.58
                         while the pixels on screen are 2.58. A done
                         appointment should read as done, not as
                         unreadable; 80% keeps it at 4.54. */
                      e.done ? "opacity-80" : ""}`}>
                    {/* The time first and in tabular figures, so a column of
                        them lines up and can be scanned down. */}
                    <span className="w-12 shrink-0 text-sm font-bold tabular-nums text-hc-ink">
                      {fmtTime(e.at)}
                    </span>
                    <span className={`h-6 w-0.5 shrink-0 rounded-full ${
                      e.kind === "video" || e.kind === "interview" || e.kind === "followup"
                        ? "bg-hc-brand" : "bg-hc-control"}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-hc-ink">
                        {e.client ?? "—"}
                      </span>
                      <span className="block truncate text-xs text-hc-ink-2">
                        {[KIND_IS[e.kind] ?? e.kind, e.minutes ? `${e.minutes} mín.` : null,
                          e.done ? "lokið" : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {e.meeting_url && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-hc-brand-surface px-2 py-1 text-xs font-bold text-hc-brand-text">
                        <Video className="h-3 w-3" aria-hidden /> Fundur
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {failed && (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">
          Náði ekki í dagatalið.
          <button type="button" onClick={() => { setFailed(false); setEvents(null); void load(); }} className={hcBtn.secondary.replace("min-h-10", "min-h-11")}>Reyna aftur</button>
        </p>
      )}
      {events === null && !failed && <div className="h-24 rounded-xl hc-shimmer" aria-busy="true" aria-label="Hleð vikunni" />}
      {events !== null && events.length === 0 && (
        <p className="mt-3 text-sm text-hc-ink-2">Ekkert bókað þessa viku.</p>
      )}
    </section>
  );
}
