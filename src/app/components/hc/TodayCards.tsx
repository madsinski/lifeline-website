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

export interface Stats { days7: number; days14: number; days28: number; streak: number; percent28: number }

interface Data {
  stats: Stats | null;
  urgent: { kind: "appointment" | "nudge"; at: string; title: string; detail: string | null; href: string | null }[];
  partner: { id: string | null; name: string; canNudge: boolean; stats: Stats | null } | null;
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

/**
 * The card beside the hero: today, and the next thing that needs you.
 *
 * The week and fortnight moved out to the matched rows below, where they
 * can be compared against the partner's. What belongs next to "æfing
 * dagsins" is the rest of today — whether the day is done, and what is
 * coming — because that is the question somebody opening Í dag is asking.
 */
export function TodayStats({ d, doneToday, ofToday }: { d: Data; doneToday: number; ofToday: number }) {
  const next = d.urgent[0] ?? null;
  return (
    <div className={`${hcCard.base} flex flex-col p-4 sm:p-5`}>
      <span className={`${hcKicker} flex items-center gap-2 text-slate-500`}>
        <Flame className="h-4 w-4" aria-hidden />Dagurinn
      </span>

      <span className="mt-1 block text-2xl font-bold text-hc-ink">
        {ofToday === 0 ? "—" : doneToday === ofToday ? "Kláraður" : `${doneToday} af ${ofToday}`}
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200">
        <span className="block h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${ofToday ? (doneToday / ofToday) * 100 : 0}%` }} />
      </span>

      {next ? (
        <span className="mt-4 block border-t border-slate-100 pt-3">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Næst</span>
          <span className="block text-sm font-semibold text-hc-ink">{next.title}</span>
          <span className="block truncate text-xs text-hc-ink-2">
            {next.kind === "appointment" ? when(next.at) : next.detail}
          </span>
        </span>
      ) : (
        <span className="mt-4 block border-t border-slate-100 pt-3 text-xs text-slate-400">
          Ekkert bókað næstu daga.
        </span>
      )}
    </div>
  );
}

/**
 * One row of the same four numbers, used for both people.
 *
 * Stacked, identical, so the comparison is honest — the whole reason the
 * rows sit over and under each other. Two cards with different measures
 * invite a comparison that does not hold.
 */
export function StatusRow({ label, stats, tone, you }: {
  label: string; stats: Stats | null; tone: string; you?: boolean;
}) {
  if (!stats) {
    return (
      <div className={`${hcCard.base} flex items-center gap-3 px-4 py-3`}>
        <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide" style={{ color: tone }}>{label}</span>
        <span className="text-xs text-slate-400">Engin skráð virkni.</span>
      </div>
    );
  }
  return (
    <div className={`${hcCard.base} flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3`}>
      <span className="w-20 shrink-0 truncate text-xs font-bold uppercase tracking-wide" style={{ color: tone }}>
        {label}
      </span>
      <Dots days={stats.days14} of={14} tone={tone} />
      <dl className="flex flex-1 items-baseline justify-end gap-4">
        <div className="text-right">
          <dt className="text-[10px] uppercase tracking-wide text-slate-400">Í röð</dt>
          <dd className="text-sm font-bold tabular-nums" style={{ color: you ? "#0F172A" : "#475569" }}>{stats.streak} d</dd>
        </div>
        <div className="text-right">
          <dt className="text-[10px] uppercase tracking-wide text-slate-400">7 d</dt>
          <dd className="text-sm font-bold tabular-nums" style={{ color: you ? "#0F172A" : "#475569" }}>{stats.days7}/7</dd>
        </div>
        <div className="text-right">
          <dt className="text-[10px] uppercase tracking-wide text-slate-400">28 d</dt>
          <dd className="text-sm font-bold tabular-nums" style={{ color: you ? "#0F172A" : "#475569" }}>{stats.percent28}%</dd>
        </div>
      </dl>
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

/**
 * Félaginn — the one person who sees whether you are showing up.
 *
 * Called "Félagi" and not "Ábyrgðarfélagi". The literal translation of
 * accountability partner is bureaucratic in Icelandic and sounds like an
 * obligation, which is the wrong feeling for the one social feature here.
 * "Samherji" was the obvious alternative and is unusable: in Iceland that
 * is the fishing company, and the association it carries is not one to put
 * on a health product. "Bakhjarl" reads financial.
 *
 * The card shows both fortnights because the pull is mutual — they see
 * yours too — and a week-by-week row underneath, so "you have both been
 * steady" or "they have gone quiet" is readable at a glance rather than
 * inferred from one number.
 */
export function TodayPartner({ d, api, onNudged }: { d: Data; api: Api; onNudged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");

  if (!d.partner) {
    return (
      <Link href="/account/heilsuferd/adgangur"
        className={`${hcCard.base} flex items-center gap-3 px-4 py-3 text-sm transition hover:ring-slate-200`}>
        <Handshake className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="text-hc-ink-2">Veldu félaga — einhvern sem sér hvort þú mætir.</span>
      </Link>
    );
  }

  const send = async (kind: string, text?: string) => {
    setBusy(true); setMsg(null);
    const r = await api("/api/hc/today", {
      method: "POST", body: JSON.stringify({ nudge: true, kind, note: text ?? "" }),
    });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? "Sent." : j.message || "Tókst ekki að senda.");
    if (r.ok) { setSending(false); setNote(""); onNudged(); }
    setBusy(false);
  };

  const mine = d.stats?.days14 ?? 0;
  const theirs = d.partner.stats?.days14 ?? null;
  // Said in words. Two rows of numbers invite a scoreboard reading; the
  // sentence names the state instead of a winner.
  const summary =
    theirs === null ? "Félaginn þinn er ekki með skráða virkni."
      : mine >= 10 && theirs >= 10 ? "Þið eruð bæði að mæta vel."
      : theirs >= mine + 4 ? "Félaginn þinn hefur mætt oftar en þú undanfarið."
      : mine >= theirs + 4 ? "Þú hefur mætt oftar en félaginn þinn undanfarið."
      : "Þið eruð á svipuðu róli.";

  return (
    <div className={`${hcCard.base} flex flex-wrap items-center gap-x-4 gap-y-2 p-4`}>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50">
          <Handshake className="h-4 w-4 text-hc-brand-dark" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-xs text-hc-ink-2">{summary}</span>
          {msg && <span className="block text-xs font-semibold text-hc-brand-dark">{msg}</span>}
        </span>
      </span>

      {d.partner.canNudge && !sending && (
        <button type="button" onClick={() => setSending(true)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
          <Hand className="h-3.5 w-3.5" aria-hidden />Senda kveðju
        </button>
      )}

      {sending && (
        <div className="w-full space-y-2 border-t border-slate-100 pt-3">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {[
              ["cheer", "Áfram þú!"],
              ["proud", "Vel gert"],
              ["missing", "Sakna þín í vikunni"],
              ["together", "Eigum við að æfa saman?"],
            ].map(([k, label]) => (
              <button key={k} type="button" disabled={busy} onClick={() => void send(k)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-hc-ink transition hover:bg-slate-50 disabled:opacity-50">
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140}
              placeholder="Eða skrifaðu eitthvað…" aria-label="Eigin skilaboð"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
            <button type="button" disabled={busy || !note.trim()} onClick={() => void send("cheer", note)}
              className="shrink-0 rounded-xl bg-hc-brand px-3 text-xs font-bold text-white disabled:opacity-40">Senda</button>
          </div>
          <button type="button" onClick={() => setSending(false)} className="text-xs text-slate-500 hover:underline">
            Hætta við
          </button>
        </div>
      )}
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
