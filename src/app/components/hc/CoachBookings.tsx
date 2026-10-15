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
import { fmtDate, fmtTime } from "@/app/components/account/ui/dates";
import { fmtWeekdayShort } from "./format";
import { hcBtn, hcCard, hcInput } from "./ui";
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

const timeLabel = (iso: string) => fmtTime(iso);

/**
 * When, said the way somebody checking a diary needs it.
 *
 * "miðvikudagur, 14. október kl. 10:30" is correct and still makes you work
 * out whether that is soon. Naming today and tomorrow, and leading with the
 * date rather than burying it mid-sentence, answers that first.
 */
function whenLabel(iso: string, asOf: number): { lead: string; rest: string } {
  const d = new Date(iso);
  const day0 = (t: number) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const days = Math.round((day0(d.getTime()) - day0(asOf)) / 86400_000);
  const time = timeLabel(iso);
  if (days === 0) return { lead: "Í dag", rest: `kl. ${time}` };
  if (days === 1) return { lead: "Á morgun", rest: `kl. ${time}` };
  if (days === -1) return { lead: "Í gær", rest: `kl. ${time}` };
  const date = fmtDate(iso, { year: false, month: "short" });
  const weekday = fmtWeekdayShort(iso);
  return { lead: date, rest: `${weekday} · kl. ${time}` };
}

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
    return <div className="h-24 rounded-hc-card hc-shimmer" aria-busy="true" aria-label="Hleð bókunum" />;
  }

  const live = rows.filter((b) => b.status !== "cancelled");
  const past = live.filter((b) => new Date(b.starts_at).getTime() < asOf);
  const soon = live.filter((b) => new Date(b.starts_at).getTime() >= asOf);

  const row = (b: Booking, dim: boolean) => (
    <li key={b.id} className="border-b border-hc-hairline p-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          b.kind === "video" ? "bg-hc-info-surface text-hc-info-ink" : "bg-hc-ok-surface text-hc-ok-ink"}`}>
          {b.kind === "video" ? <Video className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${dim ? "text-hc-ink-3" : "text-hc-ink"}`}>
            {bookingLabel(b.kind, b.items)}
          </p>
          {/* The date leads, and today and tomorrow are named, because the
              question a coach is holding is "is that soon?" — which
              "miðvikudagur, 14. október" makes you work out. */}
          <p className="text-sm">
            <span className={`font-semibold ${dim ? "text-hc-ink-3" : "text-hc-ink"}`}>
              {whenLabel(b.starts_at, asOf).lead}
            </span>
            <span className="text-hc-ink-2"> · {whenLabel(b.starts_at, asOf).rest}
              {b.minutes ? ` · ${b.minutes} mín.` : ""}</span>
          </p>
          {b.note && <p className="mt-1 text-sm text-hc-ink-2">{b.note}</p>}
          {/* The join link, when Google has given us one. */}
          {b.meeting_url && !dim && (
            <a href={b.meeting_url} target="_blank" rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-semibold text-hc-info-ink hover:underline">
              Opna fundinn
            </a>
          )}
        </div>
        {!dim && (
          <button type="button" onClick={() => void patch(b.id, { cancel: true })}
            disabled={busy === b.id} aria-label={`Afboða ${bookingLabel(b.kind, b.items)}`}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-hc-ink-3 hover:bg-hc-bad-surface hover:text-hc-bad-ink disabled:opacity-50">
            {busy === b.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </div>
    </li>
  );

  /*
   * The booking form, rendered inside whichever section opened it.
   *
   * One form, two shapes: a measurement visit needs its items picked and a
   * call does not, and the length is read back from the shared table rather
   * than from this page.
   */
  const form = adding && (
        <div className="space-y-3 rounded-hc-card bg-hc-sunken p-3 ring-1 ring-hc-hairline">
          {adding === "measurement" && (
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(MEASURE_MINUTES).map((k) => {
                const on = items.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={on}
                    onClick={() => setItems((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}
                    className={`inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-bold transition ${
                      on ? "bg-hc-brand-dark text-white" : "bg-hc-surface text-hc-ink-2 ring-1 ring-hc-control"}`}>
                    {MEASURE_IS[k]} <span className="font-normal opacity-70">{MEASURE_MINUTES[k]} mín.</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <label className="flex-1 text-sm">
              <span className="font-medium text-hc-ink-2">Dagur</span>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
                min={asOf ? new Date(asOf).toISOString().slice(0, 10) : undefined}
                className={`mt-1 ${hcInput}`} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-hc-ink-2">Tími</span>
              <select value={time} onChange={(e) => setTime(e.target.value)}
                className={`mt-1 ${hcInput}`}>
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>

          {/* The length comes from the shared table, not from this page —
              and saying it here means the coach sees the same number the
              diary will block out. */}
          <p className="text-xs text-hc-ink-2">
            {adding === "measurement" && items.length === 0
              ? "Veldu mælingar til að sjá lengdina."
              : `${bookingMinutes(adding, items)} mínútur í dagbókinni.`}
          </p>

          {err && <p className="text-sm text-hc-bad-ink">{err}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={() => void create()}
              disabled={!day || busy === "new" || (adding === "measurement" && !items.length)}
              className={hcBtn.primary}>
              {busy === "new" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Bóka
            </button>
            <button type="button" onClick={() => { setAdding(null); setErr(null); setItems([]); }}
              className={hcBtn.ghost}>
              Hætta við
            </button>
          </div>
        </div>
  );

  /*
   * Two sections, split by what the booking is.
   *
   * Everything was one list with the two "book" buttons under the bottom of
   * it, so a coach looking at the video calls had the measurement button
   * nowhere near them and had to read every row to find out which kind each
   * was. Grouped, the icon stops being the only thing that says what you
   * are looking at, and the action sits with the thing it adds to.
   */
  const section = (kind: "video" | "measurement", title: string, icon: React.ReactNode) => {
    const mine = { soon: soon.filter((b) => b.kind === kind), past: past.filter((b) => b.kind === kind) };
    const open = adding === kind;
    return (
      <section className={`${hcCard.base} p-3`}>
        <div className="mb-2 flex items-center gap-2">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
            kind === "video" ? "bg-hc-info-surface text-hc-info-ink" : "bg-hc-ok-surface text-hc-ok-ink"}`}>
            {icon}
          </span>
          <h3 className="flex-1 font-bold text-hc-ink">{title}</h3>
          {!open && (
            <button type="button" onClick={() => { setAdding(kind); setErr(null); }}
              className={`${hcBtn.primary} shrink-0`}>
              Bóka
            </button>
          )}
        </div>

        {mine.soon.length === 0 && mine.past.length === 0 && !open && (
          <p className="px-1 pb-1 text-sm text-hc-ink-2">
            {kind === "video" ? "Ekkert myndsímtal bókað." : "Engin mæling bókuð."}
          </p>
        )}
        {mine.soon.length > 0 && <ul className="overflow-hidden rounded-hc-element ring-1 ring-hc-hairline">{mine.soon.map((b) => row(b, false))}</ul>}
        {mine.past.length > 0 && (
          <>
            <p className="mt-2 px-1 text-[11px] font-bold uppercase tracking-wide text-hc-ink-2">Liðið</p>
            <ul className="mt-1 overflow-hidden rounded-hc-element ring-1 ring-hc-hairline">{mine.past.map((b) => row(b, true))}</ul>
          </>
        )}
        {open && <div className="mt-2">{form}</div>}
      </section>
    );
  };

  return (
    <div className="space-y-3">
      {section("video", "Myndsímtöl", <Video className="h-4 w-4" aria-hidden />)}
      {section("measurement", "Mælingar", <CalendarClock className="h-4 w-4" aria-hidden />)}
    </div>
  );
}
