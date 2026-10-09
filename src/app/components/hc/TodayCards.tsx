"use client";

// The three things above the checklist on Í dag: how you are doing, what is
// urgent, and your partner.
//
// All from one request (/api/hc/today) — three cards at the top of the daily
// page should not be three round trips.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, Flame, Hand, Handshake, Video } from "lucide-react";
import { hcCard, hcKicker } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Data {
  stats: { days7: number; days28: number; streak: number; percent28: number };
  urgent: { kind: "appointment" | "nudge"; at: string; title: string; detail: string | null; href: string | null }[];
  partner: { id: string | null; name: string; days: number | null; of: number; canNudge: boolean } | null;
  me: { days: number; of: number };
}

const MO = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];
/** Hand-written: Vercel's runtime has no Icelandic locale data. */
const when = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hh = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameDay ? `í dag kl. ${hh}` : `${d.getDate()}. ${MO[d.getMonth()]} kl. ${hh}`;
};

function Dots({ days, of, tone }: { days: number; of: number; tone: string }) {
  return (
    <span className="flex gap-[3px]" aria-label={`${days} af ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i < days ? tone : "#e2e8f0" }} />
      ))}
    </span>
  );
}

/** The progress card, beside the hero. */
export function TodayStats({ d, doneToday, ofToday }: { d: Data; doneToday: number; ofToday: number }) {
  const s = d.stats;
  return (
    <div className={`${hcCard.base} flex flex-col p-4 sm:p-5`}>
      <span className={`${hcKicker} flex items-center gap-2 text-slate-500`}>
        <Flame className="h-4 w-4" aria-hidden />Staðan þín
      </span>

      <span className="mt-1 block text-2xl font-bold text-hc-ink">
        {ofToday === 0 ? "—" : doneToday === ofToday ? "Dagurinn kláraður" : `${doneToday} af ${ofToday} í dag`}
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200">
        <span className="block h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${ofToday ? (doneToday / ofToday) * 100 : 0}%` }} />
      </span>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Í röð</dt>
          <dd className="text-lg font-bold tabular-nums text-hc-ink">{s.streak}<span className="text-xs font-normal text-slate-400"> d</span></dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">7 dagar</dt>
          <dd className="text-lg font-bold tabular-nums text-hc-ink">{s.days7}<span className="text-xs font-normal text-slate-400">/7</span></dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">28 dagar</dt>
          <dd className="text-lg font-bold tabular-nums text-hc-ink">{s.percent28}<span className="text-xs font-normal text-slate-400">%</span></dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] leading-snug text-slate-400">
        Hlutfall daga sem þú gerðir eitthvað — ekki hlutfall aðgerða, svo löng áætlun refsar þér ekki.
      </p>
    </div>
  );
}

/** Urgent: appointments ahead, and anyone poking you. */
export function TodayUrgent({ items }: { items: Data["urgent"] }) {
  if (!items.length) return null;
  return (
    <div className={`${hcCard.base} divide-y divide-slate-100`}>
      {items.map((u, i) => (
        <div key={`${u.kind}-${i}`} className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100">
            {u.kind === "appointment"
              ? <CalendarClock className="h-4 w-4 text-hc-brand-dark" aria-hidden />
              : <Bell className="h-4 w-4 text-amber-600" aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-hc-ink">{u.title}</span>
            <span className="block truncate text-xs text-hc-ink-2">
              {u.kind === "appointment" ? when(u.at) : u.detail}
              {u.kind === "appointment" && u.detail ? ` · ${u.detail}` : ""}
            </span>
          </span>
          {u.href && (
            <a href={u.href} target="_blank" rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 self-center rounded-full bg-hc-brand px-3 py-1.5 text-xs font-bold text-white">
              <Video className="h-3.5 w-3.5" aria-hidden />Fara inn
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/** The partner, with the poke. */
export function TodayPartner({ d, api, onNudged }: { d: Data; api: Api; onNudged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!d.partner) {
    return (
      <Link href="/account/heilsuferd/adgangur"
        className={`${hcCard.base} flex items-center gap-3 px-4 py-3 text-sm transition hover:ring-slate-200`}>
        <Handshake className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="text-hc-ink-2">Veldu ábyrgðarfélaga — einhvern sem sér hvort þú mætir.</span>
      </Link>
    );
  }

  const nudge = async () => {
    setBusy(true); setMsg(null);
    const r = await api("/api/hc/today", { method: "POST", body: JSON.stringify({ nudge: true }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Hvatning send." : j.message || "Tókst ekki að senda.");
    if (r.ok) onNudged();
    setBusy(false);
  };

  return (
    <div className={`${hcCard.base} p-4`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2">
          <Handshake className="h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />
          <span className={`${hcKicker} text-slate-500`}>Ábyrgðarfélagi</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-hc-ink">{d.partner.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {d.partner.days !== null ? (
              <span className="flex items-center gap-1.5">
                <Dots days={d.partner.days} of={d.partner.of} tone="#64748b" />
                <span className="text-xs text-slate-500">{d.partner.days}/{d.partner.of}</span>
              </span>
            ) : (
              // No heilsuferð on their side, so there is nothing to show —
              // better said than left as an empty row of grey dots.
              <span className="text-xs text-slate-400">Engin virkni skráð hjá félaganum</span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Þú</span>
              <Dots days={d.me.days} of={d.me.of} tone="#10B981" />
              <span className="text-xs text-slate-500">{d.me.days}/{d.me.of}</span>
            </span>
          </span>
        </span>
        {d.partner.canNudge && (
          <button type="button" onClick={() => void nudge()} disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
            <Hand className="h-3.5 w-3.5" aria-hidden />Ýta við
          </button>
        )}
      </div>
      {msg && <p className="mt-2 text-xs font-semibold text-hc-brand-dark">{msg}</p>}
    </div>
  );
}

/** One fetch, three cards. */
export function useToday(api: Api) {
  const [d, setD] = useState<Data | null>(null);
  const load = useCallback(async () => {
    const r = await api("/api/hc/today");
    const j = r.ok ? await r.json().catch(() => null) : null;
    setTimeout(() => setD(j), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  return { today: d, reloadToday: load };
}
