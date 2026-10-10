"use client";

// You and your partner, in a sleeve behind a face on the hero.
//
// This was "Dagurinn", a card sitting between the hero and the checklist
// carrying the day bar, two fortnight counts, the next thing and a nudge
// menu. It took 195px of the best space on the page to report on the past,
// above the list of what to do now — and status above action is the wrong
// way round on a page people open to tick something off.
//
// It is a button in the corner of the hero now. The information did not
// shrink; it grew. Behind the face: a full card each, your fortnight against
// theirs, and what they are actually training today and tomorrow, which is
// the thing that makes a partner an accountability partner rather than a
// number beside yours.

import { useState } from "react";
import { Dumbbell, Flame, Hand, Send, UsersRound } from "lucide-react";
import Sheet from "./Sheet";
import { hcBtn } from "./ui";
import type { Stats } from "./TodayCards";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface Partner {
  id: string | null;
  name: string;
  canNudge: boolean;
  avatar?: string | null;
  stats: Stats | null;
  training?: { today: string[]; tomorrow: string[] } | null;
}

/** What a nudge can say, so nobody has to find words to be kind. */
const NUDGE_KINDS: { key: string; label: string }[] = [
  { key: "cheer", label: "Vel gert!" },
  { key: "check", label: "Hvernig gengur?" },
  { key: "join", label: "Eigum við að hreyfa okkur saman?" },
];

/**
 * The ring in the hero: today's share, and two people behind it.
 *
 * A yellow face was decoration that happened to encode something. A ring
 * IS the number — it fills as the day does — and the two figures inside say
 * what opening it gives you, which is the comparison. It sits on the hero's
 * own gradient, so it is drawn in white at low opacity rather than in a
 * colour of its own.
 */
export function PeopleButton({ onClick, done, of }: { onClick: () => void; done: number; of: number }) {
  const share = of > 0 ? Math.min(1, done / of) : 0;
  const R = 15, C = 2 * Math.PI * R;
  return (
    <button type="button" onClick={onClick}
      aria-label={`Staðan þín og félagans — ${done} af ${of} í dag`}
      className="flex shrink-0 items-center gap-2 rounded-full bg-white/15 py-1.5 pl-1.5 pr-3 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25">
      <span className="relative grid h-9 w-9 place-items-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={R} fill="none" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <circle cx="18" cy="18" r={R} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - share)} style={{ transition: "stroke-dashoffset 400ms" }} />
        </svg>
        <UsersRound className="relative h-4 w-4" aria-hidden />
      </span>
      <span className="text-sm font-bold tabular-nums">{done}/{of}</span>
    </button>
  );
}

export default function PeopleSheet({ api, mine, myAvatar, partner, done, of, onClose, onNudged }: {
  api: Api;
  mine: Stats | null;
  /** Your own face, so the comparison is two people and not one. */
  myAvatar?: string | null;
  partner: Partner | null;
  done: number;
  of: number;
  onClose: () => void;
  onNudged: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState("");

  const nudge = async (kind: string, text?: string) => {
    setSending(true);
    const r = await api("/api/hc/today", {
      method: "POST", body: JSON.stringify({ nudge: true, kind, note: text ?? "" }),
    }).catch(() => null);
    setSending(false);
    if (r?.ok) { setSent(true); setNote(""); onNudged(); }
  };

  return (
    <Sheet title="Staðan" onClose={onClose} canvas>
      <div className="space-y-3 p-3 sm:p-4">
          <PersonCard name="Þú" avatar={myAvatar ?? null} stats={mine} today={done} of={of} highlight />
          {partner
            ? <PersonCard name={partner.name} avatar={partner.avatar ?? null} stats={partner.stats}
                training={partner.training ?? null} />
            : (
              <p className="rounded-hc-card bg-white px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
                Þú ert ekki með ábyrgðarfélaga. Veldu einn í appinu — það er auðveldara að halda áfram þegar einhver sér það.
              </p>
            )}

          {partner?.canNudge && (
            <section className="rounded-hc-card bg-white p-4 ring-1 ring-slate-200">
              <p className="flex items-center gap-2 font-semibold text-hc-ink">
                <Hand className="h-4 w-4 text-hc-brand-dark" aria-hidden /> Ýta við {partner.name.split(" ")[0]}
              </p>
              {sent ? (
                <p className="mt-2 text-sm font-semibold text-hc-brand-dark">Sent. Þau fá þetta í símann.</p>
              ) : (
                <>
                  {/* The whole thing in one tap. Choosing between four
                      kindnesses is a decision, and often the entire message
                      is "I saw you today" — so this is first and the words
                      are underneath for when there is something to say. */}
                  <button type="button" disabled={sending} onClick={() => void nudge("poke")}
                    className={`${hcBtn.primary} mt-2.5 flex w-full items-center justify-center gap-2 disabled:opacity-40`}>
                    <Hand className="h-4 w-4" aria-hidden />
                    Ýta við {partner.name.split(" ")[0]}
                  </button>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Eða með orðum</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {NUDGE_KINDS.map((k) => (
                      <button key={k.key} type="button" disabled={sending} onClick={() => void nudge(k.key)}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-hc-brand/10 hover:text-hc-brand-dark disabled:opacity-40">
                        {k.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <input value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="Eða skrifaðu eitthvað…" aria-label="Skilaboð með ýtingunni"
                      className="min-h-11 min-w-0 flex-1 rounded-hc-element border border-slate-200 px-3 text-sm outline-none focus:border-hc-brand" />
                    <button type="button" disabled={sending || !note.trim()} onClick={() => void nudge("note", note.trim())}
                      aria-label="Senda" className={`${hcBtn.primary} shrink-0 disabled:opacity-40`}>
                      <Send className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
      </div>
    </Sheet>
  );
}

/** One person, big enough to read at a glance. */
function PersonCard({ name, avatar, stats, today, of, training, highlight = false }: {
  name: string;
  /** Null for most people; initials stand in rather than a broken image. */
  avatar?: string | null;
  stats: Stats | null;
  today?: number;
  of?: number;
  training?: { today: string[]; tomorrow: string[] } | null;
  highlight?: boolean;
}) {
  return (
    <section className={`rounded-hc-card bg-white p-4 ring-1 sm:p-5 ${highlight ? "ring-hc-brand/40" : "ring-slate-200"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Face name={name} src={avatar ?? null} />
          <p className="min-w-0 truncate text-lg font-bold text-hc-ink">{name}</p>
        </div>
        {today !== undefined && of !== undefined && (
          <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">{today}/{of} í dag</p>
        )}
      </div>

      {stats ? (
        <>
          {/* The fortnight as a bar, because fourteen dots is a thing you
              count and a bar is a thing you see. */}
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums text-hc-ink">{stats.days14}</span>
            <span className="text-sm text-slate-500">af 14 dögum með virkni</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-hc-brand transition-all" style={{ width: `${Math.round((stats.days14 / 14) * 100)}%` }} aria-hidden />
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-amber-500" aria-hidden />
              <dt className="text-slate-500">Röð</dt>
              <dd className="font-bold tabular-nums text-hc-ink">{stats.streak}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-slate-500">Síðustu 28</dt>
              <dd className="font-bold tabular-nums text-hc-ink">{stats.percent28}%</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Engar tölur enn.</p>
      )}

      {/* What they are actually doing — the part that makes a partner an
          accountability partner rather than a number beside yours. */}
      {training && (
        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
          <p className="flex items-center gap-2 text-sm">
            <Dumbbell className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="text-slate-500">Í dag:</span>
            <span className="min-w-0 flex-1 font-semibold text-hc-ink">
              {training.today.length ? training.today.join(" + ") : "hvíld"}
            </span>
          </p>
          <p className="flex items-center gap-2 text-sm">
            <span className="w-4 shrink-0" aria-hidden />
            <span className="text-slate-500">Á morgun:</span>
            <span className="min-w-0 flex-1 text-slate-700">
              {training.tomorrow.length ? training.tomorrow.join(" + ") : "hvíld"}
            </span>
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * A face, or the next best thing.
 *
 * Most members have no avatar, and an empty circle says less than two
 * letters do. Initials come from the name we already show, so the fallback
 * is never a stranger — and "Þú" becomes "Þ", which is correct.
 */
function Face({ name, src }: { name: string; src: string | null }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
  if (src) {
    // Avatars come from arbitrary storage URLs, which next/image would need
    // configured per host; a 40px circle is not worth that.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={40} height={40}
        className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
    );
  }
  return (
    <span aria-hidden
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hc-brand/10 text-sm font-bold text-hc-brand-dark ring-1 ring-hc-brand/20">
      {initials || "?"}
    </span>
  );
}
