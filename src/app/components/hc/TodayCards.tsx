"use client";

// The three things above the checklist on Í dag: how you are doing, what is
// urgent, and your partner.
//
// All from one request (/api/hc/today) — three cards at the top of the daily
// page should not be three round trips.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Hand } from "lucide-react";
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
 * One card: the day, the two of you, and the way to say something.
 *
 * It was three — Dagurinn, your row, the partner's row — which is three
 * headers and three borders for information a person reads in one glance.
 * Merged, with the detail behind a disclosure: the day's bar and the two
 * fortnights are what gets looked at daily; streak and 28-day share are
 * what gets looked at occasionally, so they open rather than occupy.
 */
export function TodayCard({ d, api, doneToday, ofToday, onNudged }: {
  d: Data; api: Api; doneToday: number; ofToday: number; onNudged: () => void;
}) {
  const [more, setMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");

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

  const mine = d.stats;
  const theirs = d.partner?.stats ?? null;
  const next = d.urgent[0] ?? null;

  const row = (label: string, st: Stats | null, tone: string) => (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 truncate text-xs font-semibold" style={{ color: tone }}>{label}</span>
      {st ? <Dots days={st.days14} of={14} tone={tone} /> : <span className="text-xs text-slate-400">engin virkni</span>}
      {st && <span className="ml-auto text-xs font-bold tabular-nums text-slate-600">{st.days14} af 14</span>}
    </div>
  );

  return (
    <div className={`${hcCard.base} p-4 sm:p-5`}>
      {/* The day. */}
      <div className="flex items-baseline justify-between gap-3">
        <span className={`${hcKicker} text-slate-500`}>Dagurinn</span>
        <span className="text-sm font-bold tabular-nums text-hc-ink">
          {ofToday === 0 ? "—" : doneToday === ofToday ? "Kláraður" : `${doneToday} af ${ofToday}`}
        </span>
      </div>
      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-200">
        <span className="block h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${ofToday ? (doneToday / ofToday) * 100 : 0}%` }} />
      </span>

      {/* The two of you, same measure, one above the other.
          Labelled, because "12/14" on its own is a number without a noun —
          it could be sets, actions, anything. */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Dagar með virkni · síðustu 14
        </p>
        <div className="space-y-2">
          {row("Þú", mine, "#047857")}
          {d.partner && row(d.partner.name.split(" ")[0], theirs, "#64748b")}
        </div>
      </div>

      {next && (
        <p className="mt-3 flex items-baseline gap-2 border-t border-slate-100 pt-3 text-xs">
          <span className="font-semibold text-slate-500">Næst</span>
          <span className="min-w-0 flex-1 truncate text-hc-ink">{next.title}</span>
          <span className="shrink-0 text-slate-400">
            {next.kind === "appointment" ? when(next.at) : ""}
          </span>
        </p>
      )}

      {msg && <p className="mt-2 text-xs font-semibold text-hc-brand-dark">{msg}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
          Nánar <ChevronDown className={`h-3.5 w-3.5 transition ${more ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {d.partner?.canNudge && !sending && (
          <button type="button" onClick={() => setSending(true)}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-hc-brand-dark hover:underline">
            <Hand className="h-3.5 w-3.5" aria-hidden />Senda kveðju
          </button>
        )}
        {!d.partner && (
          <Link href="/account/heilsuferd/adgangur" className="ml-auto text-xs font-semibold text-hc-brand-dark hover:underline">
            Velja félaga
          </Link>
        )}
      </div>

      {more && (
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3">
          <p className="col-span-3 -mb-1 text-[10px] text-slate-400">
            Allt talið í dögum þar sem eitthvað var merkt — ekki fjölda aðgerða.
          </p>
          {([["Daga í röð", mine ? `${mine.streak}` : "—", theirs ? `${theirs.streak}` : "—"],
             ["Af síðustu 7", mine ? `${mine.days7}` : "—", theirs ? `${theirs.days7}` : "—"],
             ["Af síðustu 28", mine ? `${mine.days28}` : "—", theirs ? `${theirs.days28}` : "—"]] as const).map(([k, a, b]) => (
            <div key={k}>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">{k}</dt>
              <dd className="text-sm font-bold tabular-nums text-hc-ink">{a}</dd>
              {d.partner && <dd className="text-xs tabular-nums text-slate-500">{b}</dd>}
            </div>
          ))}
        </dl>
      )}

      {sending && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {[["cheer", "Áfram þú!"], ["proud", "Vel gert"],
              ["missing", "Sakna þín í vikunni"], ["together", "Eigum við að æfa saman?"]].map(([k, label]) => (
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
          <button type="button" onClick={() => setSending(false)} className="text-xs text-slate-500 hover:underline">Hætta við</button>
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
