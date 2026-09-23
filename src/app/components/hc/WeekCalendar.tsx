"use client";

// The nurse's week.
//
// Three kinds of appointment, because those are the three she holds:
// mælingar, viðtal, eftirfylgdarviðtal. It reads and writes the same three
// journey columns as the .ics feed and the Google push, so what is on this
// grid is what is on her phone — there is no second calendar to reconcile.
//
// Drag an appointment to another slot to move it. Click an empty slot to
// book one. "Mínar" shows what she is the interviewer on, "Allar" the whole
// clinic, so a stand-in can work someone else's week.

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Link2, Loader2, Search, Video } from "lucide-react";
import { APPT_EVENT, APPT_IS, APPT_KINDS, APPT_MINUTES, type ApptKind } from "@/lib/hc/appointment-kinds";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

const WEEKDAYS_IS = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];
const MONTHS_IS = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];

/** 08:00–17:00 on the half hour. */
const START_HOUR = 8;
const END_HOUR = 17;
const SLOTS: string[] = [];
for (let h = START_HOUR; h < END_HOUR; h++) for (const m of [0, 30]) SLOTS.push(`${String(h).padStart(2, "0")}:${m ? "30" : "00"}`);

interface CalEvent {
  journey_id: string; client_id: string; client: string | null;
  kind: ApptKind; at: string; minutes: number; done: boolean; mine: boolean;
  mode: string | null; meeting_url: string | null; location: string | null;
}

interface Candidate { journey_id: string; client_id: string; name: string | null; phone?: string | null }

/** Monday of the week containing `d`, at local midnight. */
function monday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const isoAt = (day: Date, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const x = new Date(day); x.setHours(h, m, 0, 0); return x.toISOString();
};
const hhmm = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

export default function WeekCalendar({ api, onOpenClient, onConnect }: {
  api: Api;
  /** Open a client's workspace from their appointment. */
  onOpenClient: (journeyId: string) => void;
  /** Show the calendar-subscription flow (Google / Apple / Outlook). */
  onConnect: () => void;
}) {
  const [week, setWeek] = useState(() => monday(new Date()));
  const [scope, setScope] = useState<"mine" | "all">("all");
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [booking, setBooking] = useState<{ at: string } | null>(null);

  const days = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(week, i)), [week]);
  const from = useMemo(() => week.toISOString(), [week]);
  const to = useMemo(() => addDays(week, 7).toISOString(), [week]);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await api(`/api/vinnustod/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&scope=${scope}`);
    const j = await r.json().catch(() => ({}));
    setEvents(r.ok ? j.events ?? [] : []);
    setLoading(false);
  }, [api, from, to, scope]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  /** Move an appointment: same event that booked it, a new time. */
  const move = async (ev: CalEvent, at: string) => {
    setMsg("");
    const r = await api(`/api/vinnustod/journeys/${ev.journey_id}`, {
      method: "POST",
      body: JSON.stringify({ event: APPT_EVENT[ev.kind], at, mode: ev.mode ?? undefined, meeting_url: ev.meeting_url ?? undefined }),
    });
    if (!r.ok) { const j = await r.json().catch(() => ({})); setMsg(j.error || "Tókst ekki að færa tímann."); return; }
    setMsg(`${APPT_IS[ev.kind].label} færður á ${hhmm(at)}.`);
    void load();
  };

  const onDrop = (e: React.DragEvent, day: Date, slot: string) => {
    e.preventDefault();
    try {
      const d = JSON.parse(e.dataTransfer.getData("text/plain")) as { t?: string; journey_id?: string; kind?: ApptKind };
      if (d.t !== "appt") return;
      const ev = events.find((x) => x.journey_id === d.journey_id && x.kind === d.kind);
      if (ev) void move(ev, isoAt(day, slot));
    } catch { /* something else was dragged */ }
  };

  const at = (day: Date, slot: string) =>
    events.filter((e) => sameDay(new Date(e.at), day) && hhmm(e.at) === slot);

  const label = `${week.getDate()}. ${MONTHS_IS[week.getMonth()]} – ${addDays(week, 5).getDate()}. ${MONTHS_IS[addDays(week, 5).getMonth()]}`;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Fyrri vika" onClick={() => setWeek(addDays(week, -7))}
            className="rounded-lg border border-slate-300 bg-white p-1.5 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setWeek(monday(new Date()))}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50">Þessi vika</button>
          <button type="button" aria-label="Næsta vika" onClick={() => setWeek(addDays(week, 7))}
            className="rounded-lg border border-slate-300 bg-white p-1.5 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <p className="text-sm font-bold text-slate-900">{label}</p>
        <span className="flex-1" />
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          {(["mine", "all"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setScope(s)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${scope === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
              {s === "mine" ? "Mínar" : "Allar"}
            </button>
          ))}
        </div>
        <button type="button" onClick={onConnect}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <Link2 className="h-3.5 w-3.5" /> Tengja við dagatal
        </button>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {/* Legend: three kinds, nothing else. */}
      <div className="flex flex-wrap items-center gap-3">
        {APPT_KINDS.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: APPT_IS[k].color }} aria-hidden />
            {APPT_IS[k].label} · {APPT_MINUTES[k]} mín.
          </span>
        ))}
        <span className="text-xs text-slate-400">Dragðu tíma á annan stað til að færa hann.</span>
      </div>

      {msg && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div className="min-w-[46rem]">
          {/* day header */}
          <div className="grid border-b border-slate-200" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)` }}>
            <span />
            {days.map((d) => {
              const today = sameDay(d, new Date());
              return (
                <div key={d.toISOString()} className={`px-2 py-2 text-center ${today ? "bg-slate-900 text-white" : ""}`}>
                  <p className="text-[11px] leading-tight opacity-70">{WEEKDAYS_IS[d.getDay()]}</p>
                  <p className="text-sm font-bold leading-tight">{d.getDate()}</p>
                </div>
              );
            })}
          </div>
          {/* slots */}
          {SLOTS.map((slot) => (
            <div key={slot} className="grid border-b border-slate-100 last:border-0"
              style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, 1fr)` }}>
              <span className="border-r border-slate-100 px-1 py-1 text-right text-[10px] text-slate-400">{slot.endsWith("00") ? slot : ""}</span>
              {days.map((d) => {
                const here = at(d, slot);
                return (
                  <div key={d.toISOString() + slot}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(e, d, slot)}
                    className="min-h-9 border-r border-slate-100 p-0.5 last:border-0">
                    {here.length === 0 ? (
                      <button type="button" onClick={() => setBooking({ at: isoAt(d, slot) })}
                        aria-label={`Bóka ${slot}`}
                        className="h-full min-h-8 w-full rounded text-slate-200 transition hover:bg-emerald-50 hover:text-emerald-600">
                        <CalendarPlus className="mx-auto h-3.5 w-3.5" />
                      </button>
                    ) : here.map((ev) => (
                      <div key={ev.kind + ev.journey_id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ t: "appt", journey_id: ev.journey_id, kind: ev.kind }))}
                        onClick={() => onOpenClient(ev.journey_id)}
                        title={`${APPT_IS[ev.kind].label} · ${ev.client ?? ""} · ${hhmm(ev.at)}`}
                        className={`cursor-grab rounded px-1.5 py-1 text-left text-[11px] leading-tight ${ev.done ? "opacity-50" : ""}`}
                        style={{ backgroundColor: APPT_IS[ev.kind].tint, borderLeft: `3px solid ${APPT_IS[ev.kind].color}` }}>
                        <span className="block truncate font-bold" style={{ color: APPT_IS[ev.kind].color }}>
                          {APPT_IS[ev.kind].short}{ev.mode === "video" && <Video className="ml-1 inline h-3 w-3" />}
                        </span>
                        <span className="block truncate text-slate-700">{ev.client ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {booking && <BookDialog api={api} at={booking.at} onClose={() => setBooking(null)} onBooked={() => { setBooking(null); void load(); }} />}
    </section>
  );
}

/** Pick a client and a kind for a slot. */
function BookDialog({ api, at, onClose, onBooked }: {
  api: Api; at: string; onClose: () => void; onBooked: () => void;
}) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState<Candidate[]>([]);
  const [kind, setKind] = useState<ApptKind>("interview");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // The queue endpoint has no search of its own — the workstation filters it
  // in the browser, so this does the same rather than adding a second way.
  const loadAll = useCallback(async () => {
    const r = await api("/api/vinnustod/queue");
    const j = await r.json().catch(() => ({}));
    const rows = (j.journeys ?? []) as { id: string; client_id: string; client_name: string | null; client_phone: string | null }[];
    setAll(rows.map((x) => ({ journey_id: x.id, client_id: x.client_id, name: x.client_name, phone: x.client_phone })));
  }, [api]);

  useEffect(() => {
    const t = setTimeout(() => { void loadAll(); }, 0);
    return () => clearTimeout(t);
  }, [loadAll]);

  const needle = q.trim().toLowerCase();
  const hits = needle.length < 2
    ? []
    : all.filter((c) => (c.name ?? "").toLowerCase().includes(needle) || (c.phone ?? "").includes(needle)).slice(0, 8);

  const book = async (c: Candidate) => {
    setBusy(true); setMsg("");
    const r = await api(`/api/vinnustod/journeys/${c.journey_id}`, {
      method: "POST",
      body: JSON.stringify({ event: APPT_EVENT[kind], at, mode: kind === "measure" ? "in_person" : "video" }),
    });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setMsg(j.error || "Tókst ekki að bóka."); return; }
    onBooked();
  };

  const when = `${WEEKDAYS_IS[new Date(at).getDay()]} ${new Date(at).getDate()}. ${MONTHS_IS[new Date(at).getMonth()]} kl. ${hhmm(at)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose} role="presentation">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Bóka tíma">
        <p className="font-bold text-slate-900">Bóka tíma</p>
        <p className="mt-0.5 text-sm text-slate-500">{when}</p>

        <div className="mt-3 flex gap-1">
          {APPT_KINDS.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${kind === k ? "text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              style={kind === k ? { backgroundColor: APPT_IS[k].color } : undefined}>
              {APPT_IS[k].label}
            </button>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-slate-600">Skjólstæðingur</span>
          <span className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Nafn eða sími"
              className="min-h-10 w-full bg-transparent text-sm outline-none" />
          </span>
        </label>

        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {hits.map((c) => (
            <li key={c.journey_id}>
              <button type="button" disabled={busy} onClick={() => book(c)}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ring-1 ring-slate-200 hover:bg-emerald-50 hover:ring-emerald-300 disabled:opacity-50">
                <span className="truncate font-semibold text-slate-900">{c.name ?? "—"}</span>
                <span className="shrink-0 text-xs text-slate-500">Bóka</span>
              </button>
            </li>
          ))}
          {q.trim().length >= 2 && !hits.length && <li className="px-1 text-sm text-slate-500">Enginn fannst.</li>}
        </ul>

        {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}
        <button type="button" onClick={onClose} className="mt-3 w-full rounded-xl border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Loka</button>
      </div>
    </div>
  );
}
