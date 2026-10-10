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

import { useRef, useState } from "react";
import { Camera, Dumbbell, Flame, Hand, Send, UserRound, UsersRound } from "lucide-react";
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
  const [err, setErr] = useState("");
  /** Seeded from the payload, replaced the moment an upload returns. */
  const [face, setFace] = useState<string | null>(myAvatar ?? null);

  const nudge = async (kind: string, text?: string) => {
    setErr("");
    setSending(true);
    const r = await api("/api/hc/today", {
      method: "POST", body: JSON.stringify({ nudge: true, kind, note: text ?? "" }),
    }).catch(() => null);
    setSending(false);
    if (r?.ok) { setSent(true); setNote(""); onNudged(); return; }
    /*
     * Say what happened.
     *
     * This was `if (r?.ok) { … }` with no else, so every refusal looked
     * identical to nothing happening — and they were not rare: one a day is
     * enforced server-side, and a partner with no account cannot receive
     * one at all. Pressing a button and getting silence is the bug, not the
     * refusal.
     */
    const j = r ? await r.json().catch(() => ({})) : {};
    const m = j as { message?: string; error?: string };
    setErr(
      m.message
        ?? (m.error === "no-partner" ? "Félaginn er ekki með aðgang til að taka við þessu."
          : "Þetta fór ekki. Prófaðu aftur."),
    );
  };

  return (
    <Sheet title="Staðan" onClose={onClose} canvas>
      <div className="space-y-3 p-3 sm:p-4">
          <PersonCard name="Þú" stats={mine} today={done} of={of} highlight
            face={<MyFace api={api} src={face} onChanged={setFace} />} />
          {partner
            ? <PersonCard name={partner.name} stats={partner.stats}
                face={<Face src={partner.avatar ?? null} />}
                training={partner.training ?? null} />
            : (
              <p className="rounded-hc-card bg-white px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
                Þú ert ekki með ábyrgðarfélaga. Veldu einn í appinu — það er auðveldara að halda áfram þegar einhver sér það.
              </p>
            )}

          {/* A partner without an account cannot receive one — the button
              used to appear anyway and fail on a foreign key. */}
          {partner && !partner.canNudge && (
            <p className="rounded-hc-card bg-white px-4 py-4 text-center text-sm text-slate-500 ring-1 ring-slate-200">
              {/* No "búin(n)" and no pronoun: the sentence works for
                  anybody without picking a gender for them. */}
              {partner.name.split(" ")[0]} hefur ekki stofnað aðgang enn þá, svo ekki er hægt að senda hvatningu.
            </p>
          )}

          {partner?.canNudge && (
            <section className="rounded-hc-card bg-white p-4 ring-1 ring-slate-200">
              <p className="flex items-center gap-2 font-semibold text-hc-ink">
                <Hand className="h-4 w-4 text-hc-brand-dark" aria-hidden /> Ýta við {partner.name.split(" ")[0]}
              </p>
              {err && (
                <p role="status" className="mt-2 rounded-hc-element bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 ring-1 ring-red-200">
                  {err}
                </p>
              )}
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
function PersonCard({ name, face, stats, today, of, training, highlight = false }: {
  name: string;
  /** The avatar, already rendered — "you" get an upload button, they do not. */
  face?: React.ReactNode;
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
          {face}
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
 * A face, in all three shapes avatar_url actually comes in.
 *
 *   "https://…"      a photo, from here or from the app
 *   "avatar:\u{1F913}"        the app's emoji picker — not a URL, and feeding it to
 *                    <img> rendered a broken-image icon, which is what this
 *                    sheet was doing for both people
 *   null             nothing chosen yet
 *
 * The empty case is a plain person glyph rather than initials: a partner
 * who has not picked anything should look like an account without a photo,
 * not like a monogram somebody designed.
 */
function Face({ src, size = 40 }: { src: string | null; size?: number }) {
  const emoji = src?.startsWith("avatar:") ? src.slice(7) : null;
  const box = { width: size, height: size };

  if (emoji) {
    return (
      <span style={{ ...box, fontSize: Math.round(size * 0.55) }}
        className="grid shrink-0 place-items-center rounded-full bg-slate-100 ring-1 ring-slate-200">
        {emoji}
      </span>
    );
  }
  if (src) {
    // Arbitrary storage URLs, which next/image would want configured per
    // host; a 40px circle is not worth that.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size}
      style={box} className="shrink-0 rounded-full object-cover ring-1 ring-slate-200" />;
  }
  return (
    <span style={box} className="grid shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400 ring-1 ring-slate-200">
      <UserRound style={{ width: size * 0.55, height: size * 0.55 }} aria-hidden />
    </span>
  );
}

/**
 * Your own face, and a way to change it.
 *
 * One input with capture="user", which is what makes a phone offer the
 * camera as well as the library — on a desktop it is just a file picker.
 * The photo goes straight up and the sheet shows the new one without a
 * reload, because waiting for a round trip to see your own face is the kind
 * of delay that makes people press the button twice.
 */
function MyFace({ api, src, onChanged }: {
  api: Api; src: string | null; onChanged: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File) => {
    setErr("");
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    // No Content-Type: the browser has to set the multipart boundary.
    const r = await api("/api/hc/avatar", { method: "POST", body: fd }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      const j = r ? await r.json().catch(() => ({})) : {};
      setErr((j as { message?: string }).message || "Myndin fór ekki inn. Prófaðu aftur.");
      return;
    }
    const j = await r.json().catch(() => null);
    if (j?.avatar_url) onChanged(j.avatar_url as string);
  };

  return (
    <span className="relative shrink-0">
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        aria-label={src ? "Skipta um mynd" : "Setja mynd"}
        className="relative block rounded-full transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-hc-brand disabled:opacity-50">
        <Face src={src} />
        {/* Always visible, because a face that happens to be tappable is a
            face nobody taps. */}
        <span aria-hidden
          className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-hc-brand text-white ring-2 ring-white">
          <Camera className="h-3 w-3" />
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" capture="user" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ""; }} />
      {err && <span className="absolute left-0 top-full mt-1 w-40 text-[11px] font-semibold text-red-700">{err}</span>}
    </span>
  );
}
