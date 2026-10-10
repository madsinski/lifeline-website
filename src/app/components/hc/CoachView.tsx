"use client";

// Þjálfari — the coach, the conversation, and the diary.
//
// Two tabs, not three. "Þjálfarinn" was a page of its own holding a profile
// card and a list to switch from, which meant the person you are writing to
// was behind a tab from the place you write. The card sits on top of the
// thread now, where it belongs: you can see who you are talking to while you
// talk to them, and switching is a disclosure inside it rather than a
// destination.
//
// The premade messages used to be a separate form underneath with its own
// status pipeline. They are starters for the thread now — tapping one opens
// the composer with its opening line, because what people needed was the
// prompt, not a second place to write.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, CalendarClock, CalendarPlus, Check, ChevronDown, ChevronRight,
  Dumbbell, Gauge, HeartPulse, MapPin, MessageCircle, MessageSquarePlus,
  Send, Sparkles, UserRound, Video, X,
} from "lucide-react";
import { hcBtn, hcCard } from "./ui";
import Sheet from "./Sheet";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * How many messages the conversation shows before "Sjá eldri skilaboð".
 *
 * Enough to hold the thread you are in the middle of, few enough that the
 * page stays a page rather than becoming its own scroller again.
 */
const TAIL = 12;

interface Worker {
  id: string; name: string | null; role: string | null; organization: string | null;
  credentials: string | null; bio: string | null; photo_url: string | null; specialties: string[] | null;
}
interface ChatMessage {
  id: string; author_kind: "client" | "coach"; author_name: string | null;
  kind: "message" | "nudge"; body: string | null; created_at: string; read_by_client_at: string | null;
}
interface Booking {
  id: string; kind: "video" | "measurement"; starts_at: string; minutes: number;
  status: string; meeting_url: string | null; note: string | null; items: string[] | null;
}
interface CoachData {
  coach: Worker | null; coaches: Worker[]; thread: ChatMessage[]; unread: number;
  bookings: Booking[]; consults: { allowance: number; spent: number; left: number };
  /** Where measurements happen, from the journey's location. */
  place?: { site: string | null; address: string | null; info: string | null } | null;
}

/**
 * What to know before a measurement, per measurement.
 *
 * Every one of these is about the number coming out right rather than about
 * health: a body-composition reading moves with a big meal, blood pressure
 * with the coffee on the way over. Saying so beforehand is the difference
 * between a measurement and a measurement you have to repeat.
 */
const PREP: Record<string, string[]> = {
  bodycomp: [
    "Komdu í léttum fötum — skórnir og sokkarnir fara af.",
    "Sleppa stórri máltíð og harðri æfingu síðustu tvo tímana.",
    "Drekktu vatn eins og venjulega; þurrkur breytir tölunni.",
  ],
  bloodpressure: [
    "Ekkert kaffi eða nikótín síðustu hálftímann.",
    "Við sitjum í fimm mínútur áður en mælt er.",
    "Laus ermi eða stutterma — það þarf að komast að upphandleggnum.",
  ],
  strength: [
    "Föt sem þú getur hreyft þig í og skór með gripi.",
    "Ekki taka þunga æfingu sama daginn.",
  ],
  vo2max: [
    "Æfingaföt, skór og handklæði.",
    "Léttur matur svona tveimur tímum áður — ekki fastandi.",
    "Taktu með vatnsbrúsa.",
  ],
};

const ROLE_IS: Record<string, string> = {
  nurse: "Hjúkrunarfræðingur", doctor: "Læknir", coach: "Þjálfari",
  psychologist: "Sálfræðingur", admin: "Umsjón",
};

/**
 * The measurements, each with what it costs in minutes.
 *
 * Mirrors MEASURE_MINUTES in the endpoint, which adds the same numbers up
 * again before writing the booking — the page is free to show a total, but
 * what lands in the diary is the server's own sum.
 */
const MEASURES = [
  { key: "bodycomp", label: "Líkamssamsetning", hint: "Fitu- og vöðvamassi", minutes: 5, Icon: Activity },
  { key: "bloodpressure", label: "Blóðþrýstingur", hint: "Mælt á staðnum", minutes: 10, Icon: HeartPulse },
  { key: "strength", label: "Styrktarmæling", hint: "Grip- og fótstyrkur", minutes: 20, Icon: Dumbbell },
  { key: "vo2max", label: "Þrekpróf", hint: "VO₂max á hjóli eða bretti", minutes: 30, Icon: Gauge },
] as const;
const MEASURE_LABEL = new Map(MEASURES.map((m) => [m.key as string, m.label]));

/**
 * Whole messages, not openings.
 *
 * These were fragments ending in a dash for the person to finish, which is
 * the one thing a prompt should not ask for: somebody who taps a chip is
 * saying "send this for me", not "help me start". Each one now reads as a
 * complete, sendable message — and it stays editable, so anybody with more
 * to say adds it.
 */
const PROMPTS = [
  {
    label: "Áætlunin er of mikil",
    text: "Áætlunin er meiri en ég kem í verk eins og er. Getum við létt hana?",
  },
  {
    label: "Áætlunin er of létt",
    text: "Mér finnst áætlunin of létt núna. Má ég fá meira að gera?",
  },
  {
    label: "Ég meiddi mig",
    text: "Ég meiddi mig og get ekki æft eins og áætlunin segir. Hvað á ég að gera í staðinn?",
  },
  {
    label: "Vil mæla mig aftur",
    text: "Mig langar að láta mæla mig aftur. Hvenær passar það?",
  },
  {
    label: "Spurning um skýrsluna",
    text: "Ég er með spurningu um eitt gildi í skýrslunni minni.",
  },
];

const MO = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
const DAY_SHORT = ["sun", "mán", "þri", "mið", "fim", "fös", "lau"];
const DAYS_LONG = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];
/** Hand-formatted: the Vercel runtime has no Icelandic locale data. */
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const when = (iso: string) => { const d = new Date(iso); return `${d.getDate()}. ${MO[d.getMonth()]} kl. ${hhmm(d)}`; };
const longWhen = (iso: string) => { const d = new Date(iso); return `${DAYS_LONG[d.getDay()]} ${d.getDate()}. ${MO[d.getMonth()]}, kl. ${hhmm(d)}`; };

export default function CoachView({ api }: { api: Api }) {
  const [tab, setTab] = useState<"talk" | "book">("talk");
  const [data, setData] = useState<CoachData | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  /** Sent, not yet acknowledged. */
  const [pending, setPending] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const seen = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const r = await api("/api/hc/coach").catch(() => null);
    if (!r?.ok) return;
    const j = await r.json();
    setTimeout(() => setData(j), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (tab !== "talk" || !data?.unread || seen.current) return;
    seen.current = true;
    void api("/api/hc/coach", { method: "POST", body: JSON.stringify({ seen: true }) }).then(() => load()).catch(() => {});
  }, [tab, data?.unread, api, load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [data?.thread.length, pending.length]);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true); setErr("");
    const r = await api("/api/hc/coach", { method: "POST", body: JSON.stringify(payload) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) {
      setErr(j.error === "no_consults_left" ? "Myndsímtölin eru búin í þessum mánuði."
        : j.error === "unavailable" ? "Þessi þjálfari tekur ekki við nýjum núna."
        : j.error === "no_items" ? "Veldu að minnsta kosti eina mælingu."
        : "Tókst ekki. Prófaðu aftur.");
      return false;
    }
    await load();
    return true;
  };

  /**
   * Send, and show it immediately.
   *
   * It used to await the round trip before anything changed on screen, so
   * for a second or two after pressing send nothing at all happened — which
   * is indistinguishable from broken, and was reported as broken. The
   * message appears at once, greyed until the server has it, and goes back
   * into the box if the send fails.
   */
  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setPending((p) => [...p, text]);
    const ok = await post({ send: text });
    setPending((p) => p.filter((x) => x !== text));
    if (!ok) setDraft((d) => d || text);
  };

  if (!data) return <div className="h-40 animate-pulse rounded-hc-card bg-white/70" aria-hidden />;

  return (
    <div className="space-y-4">
      {/* Two tabs. The segmented control uses the brand green when active
          rather than near-black: this page is the warm one in the journey,
          and ink on a chat surface reads as a disabled state. */}
      <nav aria-label="Þjálfari" className="flex rounded-hc-element bg-white p-1 shadow-hc-card ring-1 ring-slate-200">
        {[{ key: "talk" as const, label: "Skilaboð", Icon: MessageCircle },
          { key: "book" as const, label: "Bóka", Icon: CalendarPlus }].map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
              tab === t.key ? "bg-hc-brand text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>
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

      {err && <p className="rounded-hc-element bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-900 ring-1 ring-rose-200">{err}</p>}

      {tab === "talk" && <Talk data={data} draft={draft} setDraft={setDraft} busy={busy} pending={pending}
        box={box} end={end} onSend={send} onPost={post} />}
      {tab === "book" && <Book data={data} busy={busy} onPost={post} />}
    </div>
  );
}

/* ── Skilaboð: the coach, then the thread ──────────────────────────────── */

function Talk({ data, draft, setDraft, busy, pending, box, end, onSend, onPost }: {
  data: CoachData; draft: string; setDraft: (s: string) => void; busy: boolean; pending: string[];
  box: React.RefObject<HTMLTextAreaElement | null>; end: React.RefObject<HTMLDivElement | null>;
  onSend: () => Promise<void>; onPost: (p: Record<string, unknown>) => Promise<boolean>;
}) {
  const [switching, setSwitching] = useState(false);
  const [prompts, setPrompts] = useState(false);
  const [about, setAbout] = useState(false);
  /** The whole history, when asked for. Default is the recent end of it. */
  const [showAll, setShowAll] = useState(false);
  const c = data.coach;
  const first = c?.name?.split(" ")[0] ?? "þjálfarann þinn";

  const start = (text: string) => {
    setDraft(text);
    box.current?.focus();
    // Caret at the end, so adding to it is the natural next keystroke.
    requestAnimationFrame(() => box.current?.setSelectionRange(text.length, text.length));
  };

  return (
    <>
      {/* Who you are talking to, above the thread rather than behind a tab.
          A gradient header so the person reads as the subject of the page,
          and the rest of the card stays white. */}
      <section className={`${hcCard.base} overflow-hidden`}>
        <div className="flex items-start gap-4 bg-gradient-to-br from-hc-hero-from to-hc-hero-to p-4 text-white sm:p-5">
          {c?.photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={c.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-white/40" />
            : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/15 ring-2 ring-white/30"><UserRound className="h-8 w-8" aria-hidden /></span>}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70">Þjálfarinn þinn</p>
            <p className="text-lg font-bold leading-tight">{c?.name ?? "Ekki kominn enn"}</p>
            <p className="text-sm text-white/85">
              {[c?.role ? ROLE_IS[c.role] ?? c.role : null, c?.credentials].filter(Boolean).join(" · ")
                || "Þú fær þjálfara í viðtalinu."}
            </p>
          </div>
        </div>
        {(c?.bio || !!c?.specialties?.length || data.coaches.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-5">
            {(c?.bio || !!c?.specialties?.length) && (
              <button type="button" onClick={() => setAbout(!about)} aria-expanded={about}
                className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800">
                Um {first}
                <ChevronDown className={`h-4 w-4 transition ${about ? "rotate-180" : ""}`} aria-hidden />
              </button>
            )}
            {data.coaches.length > 0 && (
              <button type="button" onClick={() => setSwitching(!switching)} aria-expanded={switching}
                className="text-sm font-semibold text-hc-brand-dark hover:underline">Skipta um þjálfara</button>
            )}
          </div>
        )}
        {about && (
          <div className="space-y-2 border-t border-slate-100 px-4 py-3 sm:px-5">
            {c?.bio && <p className="text-sm leading-relaxed text-slate-700">{c.bio}</p>}
            {!!c?.specialties?.length && (
              <ul className="flex flex-wrap gap-1.5">
                {c.specialties.map((x) => (
                  <li key={x} className="rounded-full bg-hc-brand/10 px-2.5 py-1 text-xs font-semibold text-hc-brand-dark">{x}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {switching && (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {data.coaches.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                {w.photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={w.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                  : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400"><UserRound className="h-5 w-5" aria-hidden /></span>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-hc-ink">{w.name}</p>
                  <p className="truncate text-sm text-slate-500">
                    {[w.role ? ROLE_IS[w.role] ?? w.role : null, w.credentials].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button type="button" disabled={busy}
                  onClick={() => void onPost({ coach_id: w.id }).then((ok) => { if (ok) setSwitching(false); })}
                  className={`${hcBtn.secondary} shrink-0 disabled:opacity-40`}>Velja</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${hcCard.base} flex flex-col overflow-hidden`}>
        {/* One scroll, not two.
            This was a 48vh box with its own scrollbar sitting inside the
            page's, and the two fought: a drag over the conversation moved
            the inner one until it ended and then jerked the page, and with
            overscroll-contain it moved nothing at all. Nested scrollers are
            the wrong tool on a page that already scrolls.
            So the list has no height cap and no scrollbar of its own — the
            page is the only thing that scrolls. It stays short because only
            the last few messages render; the rest are one tap away, which
            is also the right default for reading a conversation you already
            know the beginning of. */}
        <div className="space-y-2 bg-slate-50/60 p-4">
          {data.thread.length > TAIL && !showAll && (
            <button type="button" onClick={() => setShowAll(true)}
              className="mx-auto block rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50">
              Sjá eldri skilaboð ({data.thread.length - TAIL})
            </button>
          )}
          {data.thread.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">
              Skrifaðu {first} hvað sem er. Svarið kemur hingað.
            </p>
          )}
          {(showAll ? data.thread : data.thread.slice(-TAIL)).map((m) => (
            <div key={m.id} className={`flex ${m.author_kind === "client" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                m.author_kind === "client"
                  ? "bg-hc-brand text-white"
                  : m.kind === "nudge"
                    ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200"
                    : "bg-white text-slate-900 ring-1 ring-slate-200"}`}>
                {m.author_kind === "coach" && (
                  <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide opacity-60">
                    {m.kind === "nudge" && <Sparkles className="h-3 w-3" aria-hidden />}
                    {m.author_name || c?.name || "Þjálfarinn"}
                  </p>
                )}
                <p className="whitespace-pre-wrap leading-snug">{m.body}</p>
                <p className={`mt-1 text-[10px] ${m.author_kind === "client" ? "text-white/70" : "text-slate-400"}`}>{when(m.created_at)}</p>
              </div>
            </div>
          ))}
          {/* In flight: there, but visibly not landed yet. */}
          {pending.map((t, i) => (
            <div key={`p${i}`} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-hc-brand/60 px-3.5 py-2.5 text-sm text-white shadow-sm">
                <p className="whitespace-pre-wrap leading-snug">{t}</p>
                <p className="mt-1 text-[10px] text-white/70">Sendi…</p>
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>

        {/* A sheet, not a row of chips.
            They are whole sentences now, and a chip truncates a sentence to
            a label you then send unread. The sheet shows each one in full,
            so you choose the message rather than its title — and it stays
            out of the way until asked for, which a permanent row did not. */}
        <div className="flex items-end gap-2 p-3">
          <button type="button" onClick={() => setPrompts(true)}
            aria-label="Tilbúin skilaboð"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-hc-element text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-hc-brand-dark">
            <MessageSquarePlus className="h-5 w-5" aria-hidden />
          </button>
          <textarea ref={box} value={draft} onChange={(e) => setDraft(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void onSend(); } }}
            placeholder="Skrifaðu skilaboð…" aria-label="Skilaboð til þjálfarans"
            className="max-h-28 min-h-11 min-w-0 flex-1 resize-y rounded-hc-element border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-hc-brand focus:ring-2 focus:ring-hc-brand/20" />
          <button type="button" onClick={() => void onSend()} disabled={busy || !draft.trim()}
            aria-label="Senda" className={`${hcBtn.primary} shrink-0 disabled:opacity-40`}>
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </section>

      {prompts && (
        <Sheet title="Tilbúin skilaboð" onClose={() => setPrompts(false)}>
          <ul className="divide-y divide-slate-100">
            {PROMPTS.map((x) => (
              <li key={x.label}>
                <button type="button"
                  onClick={() => { setPrompts(false); start(x.text); }}
                  className="w-full px-4 py-3.5 text-left transition hover:bg-slate-50">
                  <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">{x.label}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-hc-ink">{x.text}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="px-4 py-3 text-xs text-slate-500">
            Skilaboðin fara í reitinn — þú getur breytt þeim áður en þú sendir.
          </p>
        </Sheet>
      )}
    </>
  );
}

/* ── Bóka: a menu, then a day, then a time ─────────────────────────────── */

function Book({ data, busy, onPost }: {
  data: CoachData; busy: boolean; onPost: (p: Record<string, unknown>) => Promise<boolean>;
}) {
  const [choice, setChoice] = useState<"video" | "measurement" | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [openBooking, setOpenBooking] = useState<Booking | null>(null);
  const { allowance, left } = data.consults;

  const minutes = choice === "video" ? 30
    : MEASURES.filter((m) => picked.includes(m.key)).reduce((n, m) => n + m.minutes, 0);

  const book = async (iso: string) => {
    const ok = await onPost(choice === "video"
      ? { kind: "video", starts_at: iso }
      : { kind: "measurement", starts_at: iso, items: picked });
    if (ok) {
      setChoice(null);
      setPicked([]);
      /*
       * Back to the top.
       *
       * The booking form is the length of a day of half-hour slots, so
       * confirming one left the page at the bottom, looking at the empty
       * space where the form had been — with the new booking off-screen
       * above. The thing you just did should be the thing you see.
       */
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return ok;
  };

  return (
    <>
      {/* First in "Bóka", and only here: what is already in the diary is the
          first thing you want when you came to book something, and the last
          thing you want in the middle of a conversation. */}
  {data.bookings.length > 0 && (
          <section className={`${hcCard.base} divide-y divide-slate-100`}>
            <p className="px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Bókað</p>
            {/* The whole row opens. Cancel used to be the only thing you
                could do to a booking, and it sat on the row as a small x —
                the one irreversible action, one mis-tap away, with no way
                to reach the useful things. Those live in the sheet now and
                cancelling is behind a confirmation. */}
            {data.bookings.map((b) => (
              <button key={b.id} type="button" onClick={() => setOpenBooking(b)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 p-4 text-left transition hover:bg-slate-50">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hc-brand/10 text-hc-brand-dark">
                  {b.kind === "video" ? <Video className="h-5 w-5" aria-hidden /> : <Activity className="h-5 w-5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-hc-ink">
                    {b.kind === "video" ? "Myndsímtal"
                      : (b.items ?? []).map((k) => MEASURE_LABEL.get(k) ?? k).join(" + ") || "Mælingar"}
                  </p>
                  <p className="text-sm text-slate-600">{longWhen(b.starts_at)} · {b.minutes} mín.</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              </button>
            ))}
          </section>
        )}

      {openBooking && (
        <BookingSheet booking={openBooking} place={data.place ?? null} busy={busy}
          onClose={() => setOpenBooking(null)} onPost={onPost} />
      )}

      {/* The menu. Two things to book, as cards you pick rather than two
          forms both open at once. */}
      {!choice && (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* The menu: the brand tint, because these are the choices. */}
          <button type="button" onClick={() => setChoice("video")} disabled={left <= 0}
            className="flex flex-col items-start gap-1 rounded-hc-card bg-hc-brand/5 p-5 text-left shadow-hc-card ring-1 ring-hc-brand/25 transition hover:bg-hc-brand/10 hover:shadow-hc-raised disabled:opacity-50 disabled:hover:bg-hc-brand/5 disabled:hover:shadow-hc-card">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-hc-brand/10 text-hc-brand-dark"><Video className="h-5 w-5" aria-hidden /></span>
            <span className="mt-1 font-bold text-hc-ink">Myndsímtal</span>
            <span className="text-sm text-slate-600">30 mínútur með þjálfaranum.</span>
            <span className="mt-2 flex items-center gap-1.5" aria-label={`${left} af ${allowance} eftir í þessum mánuði`}>
              {Array.from({ length: allowance }, (_, i) => (
                <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < left ? "bg-hc-brand" : "bg-slate-200"}`} aria-hidden />
              ))}
              <span className="ml-1 text-sm font-bold tabular-nums text-slate-700">{left}/{allowance}</span>
              <span className="text-xs text-slate-500">í mánuðinum</span>
            </span>
            {left <= 0 && <span className="text-xs font-semibold text-slate-500">Búin — næsti mánuður opnast 1.</span>}
          </button>

          <button type="button" onClick={() => setChoice("measurement")}
            className="flex flex-col items-start gap-1 rounded-hc-card bg-hc-brand/5 p-5 text-left shadow-hc-card ring-1 ring-hc-brand/25 transition hover:bg-hc-brand/10 hover:shadow-hc-raised">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-hc-brand/10 text-hc-brand-dark"><Activity className="h-5 w-5" aria-hidden /></span>
            <span className="mt-1 font-bold text-hc-ink">Mælingar</span>
            <span className="text-sm text-slate-600">Veldu eina eða fleiri — tíminn leggst saman.</span>
            <span className="mt-2 text-xs text-slate-500">{MEASURES.map((m) => m.label).join(" · ")}</span>
          </button>
        </div>
      )}

      {choice && (
        <section className={`${hcCard.base} overflow-hidden`}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
            <p className="min-w-0 flex-1 font-bold text-hc-ink">{choice === "video" ? "Myndsímtal" : "Hvað á að mæla?"}</p>
            <button type="button" onClick={() => { setChoice(null); setPicked([]); }}
              aria-label="Til baka" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" aria-hidden /></button>
          </div>

          {choice === "measurement" && (
            <ul className="divide-y divide-slate-100">
              {MEASURES.map((m) => {
                const on = picked.includes(m.key);
                return (
                  <li key={m.key}>
                    <button type="button" aria-pressed={on}
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== m.key) : [...p, m.key]))}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5">
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${
                        on ? "border-hc-brand bg-hc-brand text-white" : "border-slate-300"}`}>
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
                      </span>
                      <m.Icon className={`h-5 w-5 shrink-0 ${on ? "text-hc-brand-dark" : "text-slate-400"}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-hc-ink">{m.label}</span>
                        <span className="block text-sm text-slate-500">{m.hint}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">{m.minutes} mín.</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {minutes > 0 && (
            <>
              <p className="flex items-baseline justify-between gap-2 bg-hc-brand/5 px-4 py-2.5 text-sm font-semibold text-hc-brand-dark sm:px-5">
                <span>{choice === "video" ? "Myndsímtal" : `${picked.length} ${picked.length === 1 ? "mæling" : "mælingar"}`}</span>
                <span className="tabular-nums">{minutes} mínútur í allt</span>
              </p>
              <Slots minutes={minutes} busy={busy} onBook={book} />
            </>
          )}
          {choice === "measurement" && minutes === 0 && (
            <p className="px-4 py-4 text-sm text-slate-500 sm:px-5">Veldu það sem þú vilt láta mæla og þá birtast tímarnir.</p>
          )}
        </section>
      )}

    </>
  );
}

/**
 * Pick a day, then a time — both from a list.
 *
 * Typing a date into a text field is the part people get wrong, so neither
 * is typed: fourteen days as chips, then the half-hours of the working day
 * as chips. A slot that does not fit the visit's length before closing is
 * not offered, which is why this needs the minutes.
 *
 * It offers every slot rather than the coach's free ones. There is no
 * availability source yet — hc_bookings holds what is booked, not what is
 * open — so the honest wording is that the coach confirms.
 */
function Slots({ minutes, busy, onBook }: {
  minutes: number; busy: boolean; onBook: (iso: string) => Promise<boolean>;
}) {
  const [days] = useState(() => {
    const out: Date[] = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // From tomorrow, and weekdays only: nobody is measured on a Sunday.
    for (let i = 1; out.length < 14; i++) {
      const x = new Date(d);
      x.setDate(d.getDate() + i);
      if (x.getDay() !== 0 && x.getDay() !== 6) out.push(x);
    }
    return out;
  });
  const [day, setDay] = useState<Date | null>(null);

  const OPEN = 8, CLOSE = 17;
  const slots = day
    ? Array.from({ length: (CLOSE - OPEN) * 2 }, (_, i) => {
        const t = new Date(day);
        t.setHours(OPEN + Math.floor(i / 2), (i % 2) * 30, 0, 0);
        return t;
      }).filter((t) => t.getHours() * 60 + t.getMinutes() + minutes <= CLOSE * 60)
    : [];

  return (
    <div className="space-y-3 px-4 py-3.5 sm:px-5">
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Dagur</p>
        {/* Wider cards and a hidden scrollbar. The strip is a horizontal
            list on a surface that already scrolls vertically, and a visible
            bar under it reads as a second thing to drag. The fade on the
            right is what says there is more. */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {days.map((d) => {
            const on = day?.toDateString() === d.toDateString();
            return (
              <button key={d.toISOString()} type="button" onClick={() => setDay(d)}
                className={`flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-center transition ${
                  on ? "bg-hc-brand text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                <span className="text-[11px] font-bold uppercase opacity-70">{DAY_SHORT[d.getDay()]}</span>
                <span className="text-xl font-bold leading-none tabular-nums">{d.getDate()}</span>
                <span className="text-[11px] opacity-70">{MO[d.getMonth()]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {day && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Klukkan</p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {slots.map((t) => (
              <button key={t.toISOString()} type="button" disabled={busy}
                onClick={() => void onBook(t.toISOString())}
                className="rounded-lg bg-slate-100 py-2 text-sm font-semibold tabular-nums text-slate-800 transition hover:bg-hc-brand hover:text-white disabled:opacity-40">
                {hhmm(t)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Þjálfarinn staðfestir tímann. Þú fær skilaboð ef hann þarf að færa hann.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── One booking, and everything you can do to it ───────────────────────── */

/**
 * The sheet behind a booked row.
 *
 * Four things, in the order they are wanted: join the call (the only one
 * that is time-critical), where to go and what to know (wanted the day
 * before), move it, cancel it. Cancelling is last and asks, because it is
 * the only one of the four that cannot be undone — the old row put it
 * first, as a small x, and offered none of the rest.
 */
function BookingSheet({ booking, place, busy, onClose, onPost }: {
  booking: Booking;
  place: { site: string | null; address: string | null; info: string | null } | null;
  busy: boolean;
  onClose: () => void;
  onPost: (p: Record<string, unknown>) => Promise<boolean>;
}) {
  const [moving, setMoving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isVideo = booking.kind === "video";
  const items = booking.items ?? [];
  const title = isVideo
    ? "Myndsímtal"
    : items.map((k) => MEASURE_LABEL.get(k) ?? k).join(" + ") || "Mælingar";

  /** Prep lines for everything being measured, without repeats. */
  const prep = Array.from(new Set(items.flatMap((k) => PREP[k] ?? [])));

  const move = async (iso: string) => {
    const ok = await onPost({ move: booking.id, starts_at: iso });
    if (ok) onClose();
    return ok;
  };

  return (
    <Sheet title={title} onClose={onClose} max="max-w-md">
      <div className="space-y-4 p-4">
        {/* The Sheet's own header already says what this is, so only the
            when-and-how-long goes here. */}
        <p className="text-sm text-slate-600">{longWhen(booking.starts_at)} · {booking.minutes} mín.</p>

        {/* First, because when it matters it matters more than anything
            else on this sheet. */}
        {isVideo && booking.meeting_url && (
          <a href={booking.meeting_url} target="_blank" rel="noopener noreferrer"
            className={`${hcBtn.primary} flex w-full items-center justify-center gap-2`}>
            <Video className="h-4 w-4" aria-hidden /> Fara á fundinn
          </a>
        )}
        {isVideo && !booking.meeting_url && (
          <p className="rounded-hc-element bg-slate-50 px-3 py-2.5 text-xs text-slate-600 ring-1 ring-slate-200">
            Hlekkurinn á fundinn birtist hér þegar þjálfarinn hefur staðfest tímann.
          </p>
        )}

        {/* Where, and what to know. Only for a measurement — a video call
            happens wherever you are. */}
        {!isVideo && (place?.site || place?.address || place?.info || prep.length > 0) && (
          <section className="rounded-hc-card bg-slate-50 p-3.5 ring-1 ring-slate-200">
            {(place?.site || place?.address) && (
              <>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Hvar
                </p>
                {place?.site && <p className="mt-1 text-sm font-semibold text-hc-ink">{place.site}</p>}
                {place?.address && <p className="text-sm text-slate-600">{place.address}</p>}
              </>
            )}
            {place?.info && <p className="mt-2 text-sm text-slate-600">{place.info}</p>}
            {prep.length > 0 && (
              <>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Gott að vita</p>
                <ul className="mt-1 space-y-1">
                  {prep.map((line) => (
                    <li key={line} className="flex gap-1.5 text-sm text-slate-600">
                      <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                      {line}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {/* Move it. The same picker the booking was made with, so the slots
            and the rules are the ones that applied the first time. */}
        {moving ? (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Nýr tími</p>
            <Slots minutes={booking.minutes} busy={busy} onBook={move} />
            <button type="button" onClick={() => setMoving(false)}
              className="mt-2 w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline">
              Hætta við að færa
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setMoving(true)} disabled={busy}
            className={`${hcBtn.secondary} flex w-full items-center justify-center gap-2 disabled:opacity-40`}>
            <CalendarClock className="h-4 w-4" aria-hidden /> Færa tímann
          </button>
        )}

        {/* Last, and it asks. */}
        {confirming ? (
          <div className="rounded-hc-element bg-rose-50 p-3 ring-1 ring-rose-200">
            <p className="text-sm font-semibold text-rose-900">Afbóka þennan tíma?</p>
            <p className="mt-0.5 text-xs text-rose-800">
              {isVideo
                /* Accurate, which the first draft was not: the allowance
                   query excludes cancelled rows, so cancelling hands the
                   consult back rather than spending it. */
                ? "Símtalið fer þá aftur inn í kvótann þennan mánuð og þú getur bókað nýjan tíma."
                : "Þú getur bókað nýjan tíma hvenær sem er."}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" disabled={busy}
                onClick={() => void onPost({ cancel: booking.id }).then((ok) => { if (ok) onClose(); })}
                className="flex-1 rounded-hc-element bg-rose-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-40">
                Afbóka
              </button>
              <button type="button" onClick={() => setConfirming(false)}
                className="flex-1 rounded-hc-element bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50">
                Nei
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}
            className="w-full text-center text-xs font-semibold text-slate-500 underline-offset-2 hover:text-rose-700 hover:underline">
            Afbóka tímann
          </button>
        )}
      </div>
    </Sheet>
  );
}
