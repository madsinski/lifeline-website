"use client";

/*
 * The times a participant can book, opened from the workstation.
 *
 * "Pick an available time" on the booking page reads station_slots.
 * /admin/station-slots could already write that table — one slot at a time,
 * from the admin app — which is almost certainly why 152 slots exist and not
 * one of them is in the future: somebody opened a batch by hand once and
 * nobody did it again.
 *
 * So this sits where the person who knows which mornings the station is
 * staffed actually works, and it opens a RANGE. A Tuesday morning is one
 * action here and six in the admin app.
 *
 * The count of free upcoming times is the first thing on the card, because
 * zero is the state that matters: an empty picker on the participant's side
 * reads as a broken page rather than an empty calendar, and nothing else in
 * the product says it is empty.
 */

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Loader2, Trash2, X } from "lucide-react";
import { hcBtn } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Slot {
  id: string;
  slot_at: string;
  duration_minutes: number;
  location: string | null;
  capacity: number;
  client_id: string | null;
  client_name: string | null;
}

/** "þri. 14. okt. · 09:00" — hand-formatted, as everywhere else. */
function when(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("is-IS", { weekday: "short", day: "numeric", month: "short" });
  const t = d.toLocaleTimeString("is-IS", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${t}`;
}

export default function StationSlots({ api }: { api: Api }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [free, setFree] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("12:00");
  const [minutes, setMinutes] = useState(30);

  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/slots?days=28").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => {
      setSlots(Array.isArray(j?.slots) ? j.slots : []);
      setFree(Number(j?.freeAhead ?? 0));
    }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true); setMsg("");
    const r = await api("/api/vinnustod/slots", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, from, to, minutes }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setMsg(j.error || "Tókst ekki að opna tíma."); return; }
    setMsg(j.created
      ? `${j.created} tímar opnaðir${j.skipped ? ` · ${j.skipped} voru þegar til` : ""}.`
      : "Þessir tímar voru þegar opnir.");
    setOpen(false);
    await load();
  };

  const remove = async (s: Slot) => {
    const r = await api(`/api/vinnustod/slots?id=${encodeURIComponent(s.id)}`, { method: "DELETE" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setMsg(j.error || "Tókst ekki að fjarlægja."); return; }
    setMsg(""); await load();
  };

  return (
    <section className="rounded-2xl border border-hc-hairline bg-hc-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-hc-ink-2">
          Lausir mælingatímar
        </h3>
        <button type="button" onClick={() => setOpen((v) => !v)} className={`${hcBtn.primary} min-h-9 px-3 text-xs`}>
          <CalendarPlus className="h-4 w-4" aria-hidden /> Opna tíma
        </button>
      </div>

      {/* Zero is the headline, not a footnote. */}
      <p className="mt-1 text-sm text-hc-ink-2">
        {slots === null ? "Hleð…" : free === 0 ? (
          <span className="font-semibold text-hc-warn-ink">
            Enginn laus tími næstu 4 vikurnar — skjólstæðingar sjá tóman lista.
          </span>
        ) : (
          <><strong className="text-hc-ink">{free}</strong> lausir næstu 4 vikurnar</>
        )}
      </p>

      {msg && <p className="mt-2 rounded-lg bg-hc-sunken px-3 py-2 text-sm text-hc-ink-2">{msg}</p>}

      {open && (
        <div className="mt-3 space-y-2 rounded-xl border border-hc-hairline p-3">
          {/* A range, because a morning is the unit somebody thinks in. */}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-hc-ink-2">Dagur
              <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-lg border border-hc-control bg-hc-surface px-2 text-sm font-normal text-hc-ink" />
            </label>
            <label className="block text-xs font-semibold text-hc-ink-2">Lengd hvers tíma
              <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}
                className="mt-1 min-h-10 w-full rounded-lg border border-hc-control bg-hc-surface px-2 text-sm font-normal text-hc-ink">
                {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} mín.</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-hc-ink-2">Frá
              <input type="time" value={from} onChange={(e) => setFrom(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-lg border border-hc-control bg-hc-surface px-2 text-sm font-normal text-hc-ink" />
            </label>
            <label className="block text-xs font-semibold text-hc-ink-2">Til
              <input type="time" value={to} onChange={(e) => setTo(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-lg border border-hc-control bg-hc-surface px-2 text-sm font-normal text-hc-ink" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void create()} disabled={busy}
              className={`${hcBtn.primary} min-h-9 disabled:opacity-50`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Opna
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-hc-ink-2">Hætta við</button>
          </div>
        </div>
      )}

      {slots && slots.length > 0 && (
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto overscroll-contain">
          {slots.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-hc-sunken">
              <span className="w-36 shrink-0 tabular-nums text-hc-ink">{when(s.slot_at)}</span>
              <span className="min-w-0 flex-1 truncate text-hc-ink-2">
                {s.client_name ? s.client_name : <span className="text-hc-ok-ink">laus</span>}
              </span>
              <span className="shrink-0 text-xs text-hc-ink-3">{s.duration_minutes} mín.</span>
              {/* Only a free time can be withdrawn. A held one is somebody's
                  appointment, and taking it away is a conversation. */}
              {!s.client_id && (
                <button type="button" onClick={() => void remove(s)} aria-label="Fjarlægja tíma"
                  className="shrink-0 rounded p-1 text-hc-ink-3 hover:bg-hc-bad-surface hover:text-hc-bad-ink">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
              {s.client_id && <X className="h-3.5 w-3.5 shrink-0 text-transparent" aria-hidden />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
