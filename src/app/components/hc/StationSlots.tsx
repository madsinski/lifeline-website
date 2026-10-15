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
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { fmtDate, fmtTime } from "@/app/components/account/ui/dates";
import { fmtWeekdayShort } from "./format";
import { hcBtn, hcCard, hcInput } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Slot {
  id: string;
  slot_at: string;
  duration_minutes: number;
  location: string | null;
  capacity: number;
  client_id: string | null;
  client_name: string | null;
  measurer_id: string | null;
  measurer_name: string | null;
}
interface Staff { id: string; name: string | null; role: string | null }

const DAY_IS = ["mán", "þri", "mið", "fim", "fös", "lau", "sun"];

/** Monday of the week containing `d`. Weeks start on Monday here, which is
 *  what a rota means by "week" even though getDay() calls Sunday 0. */
function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** "þri. 14. okt. · 09:00" — hand-formatted, as everywhere else. */
function when(iso: string) {
  return `${fmtWeekdayShort(iso)} ${fmtDate(iso, { year: false, month: "short" })} · ${fmtTime(iso)}`;
}

/** "14. okt." for a local Date (the week's columns are built in local time). */
const dayMonth = (d: Date) => fmtDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, { year: false, month: "short" });

export default function StationSlots({ api }: { api: Api }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [free, setFree] = useState(0);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [measurerId, setMeasurerId] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("12:00");
  const [minutes, setMinutes] = useState(30);

  const load = useCallback(async () => {
    /* 90 days so paging back and forth does not refetch; a rota is small. */
    const r = await api("/api/vinnustod/slots?days=90").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => {
      setSlots(Array.isArray(j?.slots) ? j.slots : []);
      setStaff(Array.isArray(j?.staff) ? j.staff : []);
      setFree(Number(j?.freeAhead ?? 0));
    }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true); setMsg("");
    const r = await api("/api/vinnustod/slots", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, from, to, minutes, measurerId: measurerId || undefined }),
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

  const assign = async (slot: Slot, id: string) => {
    /* Optimistic: a dropdown that waits for a round trip before showing the
       name you just picked reads as broken. */
    setSlots((xs) => xs?.map((x) => x.id === slot.id
      ? { ...x, measurer_id: id || null, measurer_name: staff.find((w) => w.id === id)?.name ?? null } : x) ?? xs);
    await api("/api/vinnustod/slots", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: slot.id, measurerId: id || null }),
    }).catch(() => null);
  };

  const remove = async (s: Slot) => {
    const r = await api(`/api/vinnustod/slots?id=${encodeURIComponent(s.id)}`, { method: "DELETE" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setMsg(j.error || "Tókst ekki að fjarlægja."); return; }
    setMsg(""); await load();
  };

  return (
    <section className={`${hcCard.base} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-0 flex-1 text-xs font-bold uppercase tracking-wide text-hc-ink-2">
          Lausir mælingatímar
        </h3>
        <button type="button" onClick={() => setOpen((v) => !v)} className={hcBtn.primary}>
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
        <div className="mt-3 space-y-2 rounded-hc-element bg-hc-sunken p-3 ring-1 ring-hc-hairline">
          {/* A range, because a morning is the unit somebody thinks in. */}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-hc-ink-2">Dagur
              <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)}
                className={`mt-1 min-h-11 font-normal ${hcInput}`} />
            </label>
            <label className="block text-xs font-semibold text-hc-ink-2">Lengd hvers tíma
              <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}
                className={`mt-1 min-h-11 font-normal ${hcInput}`}>
                {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} mín.</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-hc-ink-2">Frá
              <input type="time" value={from} onChange={(e) => setFrom(e.target.value)}
                className={`mt-1 min-h-11 font-normal ${hcInput}`} />
            </label>
            <label className="block text-xs font-semibold text-hc-ink-2">Hver mælir
              <select value={measurerId} onChange={(e) => setMeasurerId(e.target.value)}
                className={`mt-1 min-h-11 font-normal ${hcInput}`}>
                <option value="">Ákveða síðar</option>
                {staff.map((w) => <option key={w.id} value={w.id}>{w.name ?? w.id.slice(0, 8)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-hc-ink-2">Til
              <input type="time" value={to} onChange={(e) => setTo(e.target.value)}
                className={`mt-1 min-h-11 font-normal ${hcInput}`} />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void create()} disabled={busy}
              className={hcBtn.primary}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null} Opna
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className={hcBtn.ghost}>Hætta við</button>
          </div>
        </div>
      )}

      {/* ── The week ──────────────────────────────────────────────────
          A list told you a time existed. It did not tell you that Thursday
          is empty and Tuesday is full, which is the question somebody
          actually has when they open a rota. Seven columns, every slot in
          its day, and the coach covering it on the chip — so a coach sees
          everybody's cover, not only their own, and can arrange somebody
          else's. */}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={() => setWeekStart((d) => { const x = new Date(d); x.setDate(x.getDate() - 7); return x; })}
          aria-label="Fyrri vika" className="grid h-11 w-11 shrink-0 place-items-center rounded-hc-element text-hc-ink-2 hover:bg-hc-sunken"><ChevronLeft className="h-5 w-5" aria-hidden /></button>
        <p className="min-w-0 flex-1 text-sm font-semibold text-hc-ink">
          {dayMonth(weekStart)}
          {" – "}
          {dayMonth(new Date(weekStart.getTime() + 6 * 86400_000))}
        </p>
        <button type="button" onClick={() => setWeekStart(mondayOf(new Date()))}
          className="inline-flex min-h-11 items-center rounded-hc-element px-3 text-xs font-semibold text-hc-ink-2 hover:bg-hc-sunken">Í dag</button>
        <button type="button" onClick={() => setWeekStart((d) => { const x = new Date(d); x.setDate(x.getDate() + 7); return x; })}
          aria-label="Næsta vika" className="grid h-11 w-11 shrink-0 place-items-center rounded-hc-element text-hc-ink-2 hover:bg-hc-sunken"><ChevronRight className="h-5 w-5" aria-hidden /></button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => {
          const day = new Date(weekStart.getTime() + i * 86400_000);
          const dayEnd = new Date(day.getTime() + 86400_000);
          const mine = (slots ?? []).filter((x) => {
            const t = new Date(x.slot_at);
            return t >= day && t < dayEnd;
          });
          const freeCount = mine.filter((x) => !x.client_id).length;
          const isToday = new Date().toDateString() === day.toDateString();
          return (
            <div key={i} className={`min-h-28 rounded-lg p-1 ${isToday ? "bg-hc-ok-surface" : "bg-hc-sunken"}`}>
              <p className={`px-0.5 text-[11px] font-bold uppercase ${isToday ? "text-hc-ok-ink" : "text-hc-ink-3"}`}>
                {DAY_IS[i]} {day.getDate()}.
              </p>
              {/* Empty says so. A blank column and a column nobody has
                  opened yet look identical otherwise. */}
              {mine.length === 0 ? (
                <p className="px-0.5 pt-1 text-[11px] text-hc-ink-3">—</p>
              ) : (
                <>
                  <p className="px-0.5 text-[11px] text-hc-ink-3">{freeCount} laus / {mine.length}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {mine.slice(0, 6).map((x) => (
                      <li key={x.id}
                        className={`rounded px-1 py-0.5 text-[11px] leading-tight ${
                          x.client_id ? "bg-hc-warn-surface text-hc-warn-ink" : "bg-hc-surface text-hc-ink"}`}>
                        <span className="block font-semibold tabular-nums">
                          {fmtTime(x.slot_at)}
                        </span>
                        <span className="block truncate" title={x.client_name ?? x.measurer_name ?? "laus"}>
                          {x.client_name ?? (x.measurer_name ? x.measurer_name.split(" ")[0] : "laus")}
                        </span>
                      </li>
                    ))}
                    {mine.length > 6 && (
                      <li className="px-1 text-[11px] text-hc-ink-3">+{mine.length - 6}</li>
                    )}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* The same week as rows, where the coach can actually be changed —
          a dropdown does not fit in a 60px column. */}
      {(() => {
        const weekEnd = new Date(weekStart.getTime() + 7 * 86400_000);
        const inWeek = (slots ?? []).filter((x) => {
          const t = new Date(x.slot_at);
          return t >= weekStart && t < weekEnd;
        });
        if (!inWeek.length) return null;
        return (
          <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto overscroll-contain border-t border-hc-hairline pt-2">
            {inWeek.map((x) => (
              <li key={x.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-hc-sunken">
                <span className="w-32 shrink-0 tabular-nums text-hc-ink">{when(x.slot_at)}</span>
                <span className="w-24 shrink-0 truncate text-hc-ink-2">
                  {x.client_name ?? <span className="text-hc-ok-ink">laus</span>}
                </span>
                <select value={x.measurer_id ?? ""} onChange={(e) => void assign(x, e.target.value)}
                  aria-label="Hver mælir" className="min-h-11 min-w-0 flex-1 rounded-hc-element border border-hc-control bg-hc-surface px-2 text-xs text-hc-ink">
                  <option value="">Enginn skráður</option>
                  {staff.map((w) => <option key={w.id} value={w.id}>{w.name ?? w.id.slice(0, 8)}</option>)}
                </select>
                {!x.client_id && (
                  <button type="button" onClick={() => void remove(x)} aria-label="Fjarlægja tíma"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-hc-element text-hc-ink-3 hover:bg-hc-bad-surface hover:text-hc-bad-ink">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        );
      })()}

    </section>
  );
}
