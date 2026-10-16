"use client";

/*
 * Book what was bought: a measurement on a Lifeline station slot, or the
 * doctor's interview on the doctor's day. One component for both, used on
 * Þjónusta (/app/eg/thjonusta) and on the journey's doctor step.
 *
 * Only published times are offered (station_slots / doctor_slots). The
 * server enforces everything (/api/hc/shop/book): the order is paid and
 * yours, one booking per order, the doctor's weekday, and nobody else holds
 * the time. Times are shown in Iceland's clock, which is UTC all year, so
 * the UTC getters are the right ones whatever the device's zone.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { hcBtn } from "@/app/components/hc/ui";
import { useToast } from "@/app/components/hc/Toast";
import { WEEKDAY_DAT_PL } from "@/lib/hc/coaching-config";

interface Slot { id: string; slot_at: string; duration_minutes: number; location: string | null; mode?: string | null }
interface Booking { id: string; starts_at: string; minutes: number; status: string }

const MO = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const MO_LONG = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const WD = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];
const WD_LONG = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];
const MODE_IS: Record<string, string> = { in_person: "á staðnum", video: "myndsímtal", phone: "símtal" };

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
const longWhen = (iso: string) => {
  const d = new Date(iso);
  return `${WD_LONG[d.getUTCDay()]} ${d.getUTCDate()}. ${MO_LONG[d.getUTCMonth()]} kl. ${hhmm(iso)}`;
};

async function api(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return fetch(url, {
    ...init,
    headers: { ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
}

export default function SlotBooking({ orderId, kind, onChange }: {
  orderId: string;
  kind: "measurement" | "doctor";
  /** After a booking or a cancellation, so a parent list can refresh. */
  onChange?: () => void;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  /* Whether the held time is still ahead (worked out on load, not in render). */
  const [ahead, setAhead] = useState(false);
  const [place, setPlace] = useState<string | null>(null);
  const [weekday, setWeekday] = useState<number | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [err, setErr] = useState("");
  const [failed, setFailed] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const r = await api(`/api/hc/shop/book?order_id=${encodeURIComponent(orderId)}`).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => {
      if (!j) { setFailed(true); return; }
      setFailed(false);
      setSlots(Array.isArray(j.slots) ? j.slots : []);
      setBooking(j.booking ?? null);
      setAhead(!!j.booking && Date.parse(j.booking.starts_at) > Date.now());
      setPlace(j.location ?? null);
      setWeekday(typeof j.doctor_weekday === "number" ? j.doctor_weekday : null);
    }, 0);
  }, [orderId]);
  useEffect(() => { void load(); }, [load]);

  const days = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const k = s.slot_at.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return Array.from(m.entries());
  }, [slots]);
  const dayKey = day && days.some(([k]) => k === day) ? day : days[0]?.[0] ?? null;
  const daySlots = days.find(([k]) => k === dayKey)?.[1] ?? [];

  const book = async (s: Slot) => {
    if (busy) return;
    setBusy(true); setErr("");
    const r = await api("/api/hc/shop/book", { method: "POST", body: JSON.stringify({ order_id: orderId, slot_id: s.id }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) {
      setErr(typeof j.error === "string" && /\s/.test(j.error) ? j.error : "Ekki tókst að bóka. Reyndu aftur.");
      await load();
      return;
    }
    toast.show("Tíminn er bókaður", { tone: "ok" });
    await load();
    onChange?.();
  };

  const cancel = async () => {
    if (!booking || busy) return;
    setBusy(true); setErr("");
    const r = await api("/api/hc/shop/book", { method: "POST", body: JSON.stringify({ cancel: booking.id }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false); setConfirmCancel(false);
    if (!r?.ok) { setErr(typeof j.error === "string" && /\s/.test(j.error) ? j.error : "Ekki tókst að afbóka. Reyndu aftur."); return; }
    toast.show("Tímanum var aflýst", { tone: "ok" });
    await load();
    onChange?.();
  };

  if (failed) {
    return (
      <p role="alert" className="rounded-xl bg-hc-bad-surface px-3 py-2 text-sm text-hc-bad-ink">
        Náði ekki í lausa tíma.{" "}
        <button type="button" onClick={() => { setFailed(false); void load(); }} className="font-semibold underline">Reyna aftur</button>
      </p>
    );
  }
  if (slots === null) return <div className="h-20 rounded-xl hc-shimmer" aria-busy="true" aria-label="Hleð lausum tímum" />;

  if (booking) {
    return (
      <div className="space-y-2 text-sm">
        <p className="flex items-start gap-2 rounded-xl bg-hc-ok-surface px-3 py-2 text-hc-ok-ink">
          <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Bókað: <strong>{longWhen(booking.starts_at)}</strong>{place ? ` · ${place}` : ""}</span>
        </p>
        {kind === "doctor" && (
          <p className="text-xs text-hc-ink-2">Viðtalið er haldið og skráð í sjúklingagáttinni (Medalia).</p>
        )}
        {ahead && (
          confirmCancel ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-hc-ink-2">Afbóka þennan tíma?</span>
              <button type="button" onClick={() => void cancel()} disabled={busy}
                className="inline-flex min-h-11 items-center rounded-full bg-hc-bad-ink px-4 font-semibold text-white disabled:opacity-50">
                {busy ? "Augnablik…" : "Já, afbóka"}
              </button>
              <button type="button" onClick={() => setConfirmCancel(false)} className={hcBtn.ghost}>Nei</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmCancel(true)}
              className="inline-flex min-h-11 items-center rounded-full border border-hc-control bg-hc-surface px-4 font-semibold text-hc-ink-2 hover:bg-hc-sunken">
              Afbóka eða velja annan tíma
            </button>
          )
        )}
        {err && <p role="alert" className="text-hc-bad-ink">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {kind === "doctor" && weekday !== null && (
        <p className="text-hc-ink-2">
          Læknirinn tekur viðtöl á {WEEKDAY_DAT_PL[weekday]}. Veldu tíma hér; viðtalið er haldið og skráð í sjúklingagáttinni.
        </p>
      )}
      {days.length === 0 ? (
        <p className="rounded-xl bg-hc-sunken px-3 py-2 text-hc-ink-2">
          {kind === "doctor"
            ? "Engir lausir tímar á læknadegi eins og er. Nýir tímar eru opnaðir reglulega; líttu aftur við síðar."
            : "Engir lausir mælingartímar eins og er. Nýir tímar eru opnaðir reglulega; líttu aftur við síðar."}
        </p>
      ) : (
        <>
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Dagur</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {days.map(([k, list]) => {
                const d = new Date(`${k}T00:00:00Z`);
                const on = k === dayKey;
                return (
                  <button key={k} type="button" aria-pressed={on} onClick={() => setDay(k)}
                    className={`flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-center transition ${
                      on ? "bg-hc-brand-dark text-white shadow-sm" : "bg-hc-sunken text-hc-ink-2 hover:bg-hc-sunken-2"}`}>
                    <span className="text-[11px] font-bold uppercase opacity-70">{WD[d.getUTCDay()]}</span>
                    <span className="text-xl font-bold leading-none tabular-nums">{d.getUTCDate()}</span>
                    <span className="text-[11px] opacity-70">{MO[d.getUTCMonth()]}</span>
                    <span className="sr-only">{list.length} lausir</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Klukkan</p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {daySlots.map((s) => (
                <button key={s.id} type="button" disabled={busy} onClick={() => void book(s)}
                  aria-label={`Bóka ${longWhen(s.slot_at)}`}
                  className="min-h-11 rounded-lg bg-hc-sunken py-2 text-sm font-semibold tabular-nums text-hc-ink-2 transition hover:bg-hc-brand-dark hover:text-white disabled:opacity-40">
                  {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" aria-hidden /> : hhmm(s.slot_at)}
                </button>
              ))}
            </div>
            {daySlots[0] && (daySlots[0].location || daySlots[0].mode) && (
              <p className="mt-2 text-xs text-hc-ink-2">
                {[daySlots[0].location, daySlots[0].mode ? MODE_IS[daySlots[0].mode] : null].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </>
      )}
      {err && <p role="alert" className="text-hc-bad-ink">{err}</p>}
    </div>
  );
}
