"use client";

// A client's video calls and measurement visits, in the coach's workspace.
//
// The workstation diary already knew about these — they blocked time in the
// agenda — but opening a client told you nothing about what they had
// booked, and moving or cancelling one meant ringing them. This is the
// per-client view and the management that was missing.
//
// Bookings the participant made and bookings the coach made are the same
// rows in hc_bookings; nothing here distinguishes them, because by the time
// it is in the diary it does not matter who typed it.

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Loader2, Video, X } from "lucide-react";
import EmptyState from "./EmptyState";
import { MEASURE_IS, MEASURE_MINUTES, bookingLabel, bookingMinutes } from "@/lib/hc/bookings";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Booking {
  id: string;
  kind: string;
  items: string[] | null;
  starts_at: string;
  minutes: number | null;
  status: string;
  meeting_url: string | null;
  note: string | null;
}

/** Working hours, on the half hour — the same grid BookVideo offers. */
const TIMES = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00",
  "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"];

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("is-IS", { weekday: "long", day: "numeric", month: "long" });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("is-IS", { hour: "2-digit", minute: "2-digit" });

export default function CoachBookings({ api, journeyId }: { api: Api; journeyId: string }) {
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState<"video" | "measurement" | null>(null);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("10:00");
  const [items, setItems] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  /* The instant the list was fetched, for splitting soon from past.
     Taken at load rather than during render: Date.now() in render is impure
     and the compiler rejects it, and a clock read per render would be a
     different answer each time for no gain — the split only has to be right
     as of the data it is splitting. */
  const [asOf, setAsOf] = useState(0);

  const path = `/api/vinnustod/journeys/${journeyId}/bookings`;

  const load = useCallback(async () => {
    const r = await api(path).catch(() => null);
    const body = r?.ok ? await r.json().catch(() => null) : null;
    /* Deferred out of the effect's tick, as the other workstation panels
       do it — the React Compiler lint rejects a synchronous setState here. */
    const now = Date.now();
    setTimeout(() => { setRows(body?.bookings ?? []); setAsOf(now); }, 0);
  }, [api, path]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!adding || !day) return;
    setBusy("new"); setErr(null);
    const starts_at = new Date(`${day}T${time}:00`).toISOString();
    const r = await api(path, {
      method: "POST",
      body: JSON.stringify({ kind: adding, starts_at, items: adding === "measurement" ? items : undefined }),
    }).catch(() => null);
    setBusy(null);
    if (!r?.ok) {
      const j = r ? await r.json().catch(() => ({})) : {};
      setErr(j.error === "no_items" ? "Veldu að minnsta kosti eina mælingu."
        : j.error === "bad_time" ? "Ógild dagsetning."
        : "Bókunin fór ekki inn. Reyndu aftur.");
      return;
    }
    setAdding(null); setDay(""); setItems([]);
    await load();
  };

  const patch = async (booking_id: string, change: Record<string, unknown>) => {
    setBusy(booking_id);
    await api(path, { method: "PATCH", body: JSON.stringify({ booking_id, ...change }) }).catch(() => null);
    setBusy(null);
    await load();
  };

  if (rows === null) {
    return <div className="h-24 rounded-2xl hc-shimmer" aria-busy="true" aria-label="Hleð bókunum" />;
  }

  const live = rows.filter((b) => b.status !== "cancelled");
  const past = live.filter((b) => new Date(b.starts_at).getTime() < asOf);
  const soon = live.filter((b) => new Date(b.starts_at).getTime() >= asOf);

  const row = (b: Booking, dim: boolean) => (
    <li key={b.id} className="border-b border-slate-100 p-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          b.kind === "video" ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"}`}>
          {b.kind === "video" ? <Video className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${dim ? "text-slate-400" : "text-slate-900"}`}>
            {bookingLabel(b.kind, b.items)}
          </p>
          <p className="text-sm text-slate-500">
            {dayLabel(b.starts_at)} kl. {timeLabel(b.starts_at)}
            {b.minutes ? ` · ${b.minutes} mín.` : ""}
          </p>
          {b.note && <p className="mt-1 text-sm text-slate-600">{b.note}</p>}
          {/* The join link, when Google has given us one. */}
          {b.meeting_url && !dim && (
            <a href={b.meeting_url} target="_blank" rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-semibold text-sky-700 hover:underline">
              Opna fundinn
            </a>
          )}
        </div>
        {!dim && (
          <button type="button" onClick={() => void patch(b.id, { cancel: true })}
            disabled={busy === b.id} aria-label={`Afboða ${bookingLabel(b.kind, b.items)}`}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-rose-600 disabled:opacity-50">
            {busy === b.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div className="space-y-3">
      {soon.length === 0 && past.length === 0 ? (
        <EmptyState variant="waiting" title="Engin bókun"
          body="Þegar skjólstæðingurinn bókar myndsamtal eða mælingu — eða þú bókar fyrir þau — sést það hér." />
      ) : (
        <>
          {soon.length > 0 && (
            <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {soon.map((b) => row(b, false))}
            </ul>
          )}
          {past.length > 0 && (
            <>
              <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Liðið</p>
              <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                {past.map((b) => row(b, true))}
              </ul>
            </>
          )}
        </>
      )}

      {/* Booking on their behalf. Two buttons rather than one form, because
          a video call and a measurement visit ask for different things. */}
      {!adding ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setAdding("video")}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            <Video className="h-4 w-4" aria-hidden /> Bóka myndsamtal
          </button>
          <button type="button" onClick={() => setAdding("measurement")}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            <CalendarClock className="h-4 w-4" aria-hidden /> Bóka mælingu
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
          <p className="font-semibold text-slate-900">
            {adding === "video" ? "Myndsamtal" : "Mæling"}
          </p>

          {adding === "measurement" && (
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(MEASURE_MINUTES).map((k) => {
                const on = items.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={on}
                    onClick={() => setItems((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      on ? "bg-emerald-700 text-white" : "bg-slate-50 text-slate-600 ring-1 ring-slate-200"}`}>
                    {MEASURE_IS[k]} <span className="font-normal opacity-70">{MEASURE_MINUTES[k]} mín.</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <label className="flex-1 text-sm">
              <span className="font-medium text-slate-700">Dagur</span>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
                min={asOf ? new Date(asOf).toISOString().slice(0, 10) : undefined}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">Tími</span>
              <select value={time} onChange={(e) => setTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900">
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>

          {/* The length comes from the shared table, not from this page —
              and saying it here means the coach sees the same number the
              diary will block out. */}
          <p className="text-xs text-slate-500">
            {adding === "measurement" && items.length === 0
              ? "Veldu mælingar til að sjá lengdina."
              : `${bookingMinutes(adding, items)} mínútur í dagbókinni.`}
          </p>

          {err && <p className="text-sm text-rose-700">{err}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={() => void create()}
              disabled={!day || busy === "new" || (adding === "measurement" && !items.length)}
              className="inline-flex items-center gap-2 rounded-xl bg-hc-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {busy === "new" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Bóka
            </button>
            <button type="button" onClick={() => { setAdding(null); setErr(null); setItems([]); }}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Hætta við
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
