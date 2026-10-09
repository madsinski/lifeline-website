"use client";

// Þjálfari — everything that involves a person rather than a plan.
//
// It was one card ("Hafa samband") that opened a form. The things people
// actually want here are a conversation, knowing who they are talking to,
// and getting time in a diary, so the page is three of those behind an icon
// menu rather than one of them behind a button.
//
// Three and not eight. Mads listed eight things; they collapse into three
// questions — what did we say to each other, who is my coach, and when are
// we meeting — and a phone has room for three tabs that are still legible.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarPlus, Check, MessageCircle, Send, Sparkles, UserRound, Video, X,
} from "lucide-react";
import { MEASUREMENTS } from "@/lib/hc/requests";
import HelpCard from "./HelpCard";
import { hcBtn, hcCard } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

interface Worker {
  id: string;
  name: string | null;
  role: string | null;
  organization: string | null;
  credentials: string | null;
  bio: string | null;
  photo_url: string | null;
  specialties: string[] | null;
}

interface ChatMessage {
  id: string;
  author_kind: "client" | "coach";
  author_name: string | null;
  kind: "message" | "nudge";
  body: string | null;
  created_at: string;
  read_by_client_at: string | null;
}

interface Booking {
  id: string;
  kind: "video" | "measurement" | "vo2max" | "strength";
  starts_at: string;
  minutes: number;
  status: string;
  meeting_url: string | null;
  note: string | null;
}

interface CoachData {
  coach: Worker | null;
  coaches: Worker[];
  thread: ChatMessage[];
  unread: number;
  bookings: Booking[];
  consults: { allowance: number; spent: number; left: number };
}

const ROLE_IS: Record<string, string> = {
  nurse: "Hjúkrunarfræðingur", doctor: "Læknir", coach: "Þjálfari",
  psychologist: "Sálfræðingur", admin: "Umsjón",
};

const MO = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
const DAYS = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];
/** Hand-formatted: the Vercel runtime has no Icelandic locale data. */
const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}. ${MO[d.getMonth()]} kl. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const dayAndTime = (iso: string) => {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()}. ${MO[d.getMonth()]}, kl. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const BOOKABLE = [
  { kind: "measurement" as const, label: "Mælingar", hint: "Líkamssamsetning og blóðþrýstingur", minutes: 30 },
  { kind: "vo2max" as const, label: "Þrekpróf", hint: "VO₂max á hjóli eða bretti", minutes: 60 },
  { kind: "strength" as const, label: "Styrkmæling", hint: "Grip- og fótstyrkur", minutes: 30 },
];

const TABS = [
  { key: "talk" as const, label: "Skilaboð", Icon: MessageCircle },
  { key: "coach" as const, label: "Þjálfarinn", Icon: UserRound },
  { key: "book" as const, label: "Bóka", Icon: CalendarPlus },
];

export default function CoachView({ api }: { api: Api }) {
  const [tab, setTab] = useState<"talk" | "coach" | "book">("talk");
  const [data, setData] = useState<CoachData | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [switching, setSwitching] = useState(false);
  const seen = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await api("/api/hc/coach").catch(() => null);
    if (!r?.ok) return;
    const j = await r.json();
    // Deferred: setting state synchronously inside an effect cascades
    // renders, and nothing here needs to land this tick.
    setTimeout(() => setData(j), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  // Opening the tab is reading it. Once per mount, or every reload would
  // clear the dot again and again.
  useEffect(() => {
    if (tab !== "talk" || !data?.unread || seen.current) return;
    seen.current = true;
    void api("/api/hc/coach", { method: "POST", body: JSON.stringify({ seen: true }) })
      .then(() => load()).catch(() => {});
  }, [tab, data?.unread, api, load]);

  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [data?.thread.length]);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true); setErr("");
    const r = await api("/api/hc/coach", { method: "POST", body: JSON.stringify(payload) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) {
      setErr(j.error === "no_consults_left" ? "Myndsímtölin eru búin í þessum mánuði."
        : j.error === "unavailable" ? "Þessi þjálfari tekur ekki við nýjum núna."
        : "Tókst ekki. Prófaðu aftur.");
      return false;
    }
    await load();
    return true;
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    if (await post({ send: text })) setDraft("");
  };

  if (!data) return <div className="h-40 animate-pulse rounded-hc-card bg-white/70" aria-hidden />;

  return (
    <div className="space-y-4">
      {/* The menu. Icons and labels both: an icon alone is a guess, and
          these three are not conventions anybody has learned yet. */}
      <nav aria-label="Þjálfari" className="flex rounded-hc-element bg-hc-surface p-1 ring-1 ring-slate-200">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t.key ? "bg-hc-ink text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            <span className="relative">
              <t.Icon className="h-4 w-4" aria-hidden />
              {t.key === "talk" && data.unread > 0 && (
                <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-label={`${data.unread} ný`} />
              )}
            </span>
            {t.label}
          </button>
        ))}
      </nav>

      {err && <p className="rounded-hc-element bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 ring-1 ring-red-200">{err}</p>}

      {/* ── Skilaboð ─────────────────────────────────────────────────── */}
      {tab === "talk" && (
        <>
          <section className={`${hcCard.base} flex flex-col`}>
            <div className="max-h-[52vh] min-h-32 flex-1 space-y-2 overflow-y-auto overscroll-contain p-4">
              {data.thread.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">
                  Hér talarðu við {data.coach?.name?.split(" ")[0] ?? "þjálfarann þinn"}. Skrifaðu hvað sem er — svarið kemur hingað.
                </p>
              )}
              {data.thread.map((m) => (
                <div key={m.id} className={`flex ${m.author_kind === "client" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.author_kind === "client"
                      ? "bg-hc-ink text-white"
                      : m.kind === "nudge"
                        // A nudge is the coach reaching out unprompted, so it
                        // should not look like an answer to something.
                        ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200"
                        : "bg-slate-100 text-slate-900"}`}>
                    {m.author_kind === "coach" && (
                      <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide opacity-70">
                        {m.kind === "nudge" && <Sparkles className="h-3 w-3" aria-hidden />}
                        {m.author_name || data.coach?.name || "Þjálfarinn"}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-snug">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${m.author_kind === "client" ? "text-white/60" : "text-slate-500"}`}>{when(m.created_at)}</p>
                  </div>
                </div>
              ))}
              <div ref={end} />
            </div>
            <div className="flex items-end gap-2 border-t border-slate-100 p-3">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={1}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder="Skrifaðu skilaboð…" aria-label="Skilaboð til þjálfarans"
                className="max-h-28 min-h-11 min-w-0 flex-1 resize-y rounded-hc-element border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hc-brand" />
              <button type="button" onClick={() => void send()} disabled={busy || !draft.trim()}
                aria-label="Senda" className={`${hcBtn.primary} shrink-0 disabled:opacity-40`}>
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </section>

          {/* The structured requests stay. They are a different thing from a
              message — they carry a status somebody is accountable for — and
              the suggestions in them were the part worth keeping. */}
          <HelpCard api={api} />
        </>
      )}

      {/* ── Þjálfarinn ───────────────────────────────────────────────── */}
      {tab === "coach" && (
        <>
          {data.coach ? (
            <section className={`${hcCard.base} p-5`}>
              <div className="flex items-start gap-4">
                {data.coach.photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={data.coach.photo_url} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                  : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-hc-brand/10 text-hc-brand-dark"><UserRound className="h-9 w-9" aria-hidden /></span>}
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-hc-ink">{data.coach.name}</p>
                  <p className="text-sm text-slate-600">
                    {[data.coach.role ? ROLE_IS[data.coach.role] ?? data.coach.role : null, data.coach.credentials]
                      .filter(Boolean).join(" · ")}
                  </p>
                  {data.coach.organization && <p className="text-sm text-slate-500">{data.coach.organization}</p>}
                </div>
              </div>
              {data.coach.bio && <p className="mt-3 text-sm leading-relaxed text-slate-700">{data.coach.bio}</p>}
              {!!data.coach.specialties?.length && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {data.coach.specialties.map((x) => (
                    <li key={x} className="rounded-full bg-hc-brand/10 px-2.5 py-1 text-xs font-semibold text-hc-brand-dark">{x}</li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setTab("talk")} className={hcBtn.secondary}>
                  <MessageCircle className="h-4 w-4" aria-hidden /> Senda skilaboð
                </button>
                {data.coaches.length > 0 && (
                  <button type="button" onClick={() => setSwitching(!switching)} aria-expanded={switching}
                    className="rounded-hc-element px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50">
                    Skipta um þjálfara
                  </button>
                )}
              </div>
            </section>
          ) : (
            <section className={`${hcCard.base} p-5`}>
              <p className="font-semibold text-hc-ink">Þjálfari er ekki kominn</p>
              <p className="mt-1 text-sm text-slate-600">Þú fær þjálfara í viðtalinu. Veldu hér ef þú vilt velja sjálf(ur).</p>
            </section>
          )}

          {(switching || !data.coach) && data.coaches.length > 0 && (
            <section className={`${hcCard.base} divide-y divide-slate-100`}>
              <p className="px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                {data.coach ? "Aðrir sem taka við" : "Lausir þjálfarar"}
              </p>
              {data.coaches.map((w) => (
                <div key={w.id} className="flex items-start gap-3 p-4">
                  {w.photo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={w.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                    : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400"><UserRound className="h-6 w-6" aria-hidden /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-hc-ink">{w.name}</p>
                    <p className="text-sm text-slate-600">
                      {[w.role ? ROLE_IS[w.role] ?? w.role : null, w.credentials].filter(Boolean).join(" · ")}
                    </p>
                    {w.bio && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{w.bio}</p>}
                  </div>
                  <button type="button" disabled={busy}
                    onClick={() => void post({ coach_id: w.id }).then((ok) => { if (ok) setSwitching(false); })}
                    className={`${hcBtn.secondary} shrink-0 disabled:opacity-40`}>
                    Velja
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {/* ── Bóka ─────────────────────────────────────────────────────── */}
      {tab === "book" && (
        <>
          <VideoBooking data={data} busy={busy} onBook={(iso) => post({ kind: "video", starts_at: iso })} />

          <section className={`${hcCard.base} divide-y divide-slate-100`}>
            <p className="px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Mælingar</p>
            {BOOKABLE.map((b) => (
              <SlotBooking key={b.kind} label={b.label} hint={b.hint} minutes={b.minutes}
                busy={busy} onBook={(iso) => post({ kind: b.kind, starts_at: iso })} />
            ))}
            <p className="px-5 py-3 text-xs text-slate-500">
              Mælt er á staðnum: {MEASUREMENTS.filter((m) => m.key !== "blood").map((m) => m.label.toLowerCase()).join(", ")}.
            </p>
          </section>

          {data.bookings.length > 0 && (
            <section className={`${hcCard.base} divide-y divide-slate-100`}>
              <p className="px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Bókað</p>
              {data.bookings.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-hc-brand/10 text-hc-brand-dark">
                    {b.kind === "video" ? <Video className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-hc-ink">
                      {b.kind === "video" ? "Myndsímtal" : BOOKABLE.find((x) => x.kind === b.kind)?.label ?? b.kind}
                    </p>
                    <p className="text-sm text-slate-600">{dayAndTime(b.starts_at)} · {b.minutes} mín.</p>
                  </div>
                  {b.meeting_url && (
                    <a href={b.meeting_url} target="_blank" rel="noopener noreferrer" className={hcBtn.secondary}>Fara á fundinn</a>
                  )}
                  <button type="button" onClick={() => void post({ cancel: b.id })} disabled={busy}
                    aria-label="Afbóka" className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** The month's video allowance, and a slot picker when there is one left. */
function VideoBooking({ data, busy, onBook }: {
  data: CoachData; busy: boolean; onBook: (iso: string) => Promise<boolean>;
}) {
  const { allowance, spent, left } = data.consults;
  return (
    <section className={`${hcCard.base} p-5`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Video className="h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />
        <p className="min-w-0 flex-1 font-semibold text-hc-ink">Myndsímtal við þjálfarann</p>
        {/* The count as pips, not a sentence: two of three is a thing you
            see rather than read. */}
        <span className="flex items-center gap-1.5" aria-label={`${left} af ${allowance} eftir í þessum mánuði`}>
          {Array.from({ length: allowance }, (_, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < left ? "bg-hc-brand" : "bg-slate-200"}`} aria-hidden />
          ))}
          <span className="ml-1 text-sm font-bold tabular-nums text-slate-700">{left}/{allowance}</span>
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {left > 0
          ? `${left === 1 ? "Eitt símtal" : `${left} símtöl`} eftir í þessum mánuði. Hlekkurinn kemur hingað og í dagatalið þitt.`
          : `Þú hefur notað ${spent === 1 ? "símtalið" : "símtölin"} í þessum mánuði. Næsti mánuður opnast 1.`}
      </p>
      {left > 0 && <SlotBooking label="Finna tíma" hint="30 mínútur" minutes={30} busy={busy} onBook={onBook} inline />}
    </section>
  );
}

/** A date and a time, and nothing else — the coach confirms the rest. */
function SlotBooking({ label, hint, minutes, busy, onBook, inline = false }: {
  label: string; hint: string; minutes: number; busy: boolean;
  onBook: (iso: string) => Promise<boolean>; inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [time, setTime] = useState("");
  /* Tomorrow, read once. Date.now() in the render body is impure, and the
     earliest bookable day does not need to change while a picker is open. */
  const [min] = useState(() => new Date(Date.now() + 864e5).toISOString().slice(0, 10));

  const book = async () => {
    if (!day || !time) return;
    if (await onBook(new Date(`${day}T${time}`).toISOString())) {
      setOpen(false); setDay(""); setTime("");
    }
  };

  return (
    <div className={inline ? "mt-3" : "p-4"}>
      {!inline && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-hc-ink">{label}</p>
            <p className="text-sm text-slate-600">{hint} · {minutes} mín.</p>
          </div>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={hcBtn.secondary}>
            {open ? "Loka" : "Bóka"}
          </button>
        </div>
      )}
      {inline && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={hcBtn.secondary}>
          <CalendarPlus className="h-4 w-4" aria-hidden /> {open ? "Loka" : label}
        </button>
      )}
      {open && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Dagur</span>
            <input type="date" value={day} min={min} onChange={(e) => setDay(e.target.value)}
              className="min-h-11 w-full rounded-hc-element border border-slate-200 px-3 text-sm" />
          </label>
          <label className="w-28">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Klukkan</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="min-h-11 w-full rounded-hc-element border border-slate-200 px-3 text-sm" />
          </label>
          <button type="button" onClick={() => void book()} disabled={busy || !day || !time}
            className={`${hcBtn.primary} disabled:opacity-40`}>Bóka</button>
        </div>
      )}
    </div>
  );
}
