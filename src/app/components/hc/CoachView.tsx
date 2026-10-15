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
import { createPortal } from "react-dom";
import AskFlow from "./AskFlow";
import { portalFor } from "@/lib/hc/portal";
import { useKeyboard } from "@/lib/hc/use-keyboard";
import {
  Activity, CalendarClock, CalendarPlus, Check, ChevronDown, ChevronRight,
  Dumbbell, Gauge, HeartPulse, MapPin, MessageCircle, MessageSquarePlus,
  Send, UserRound, Video, X,
} from "lucide-react";
import { hcBtn, hcCard, hcInput } from "./ui";
import Sheet from "./Sheet";
import Segmented from "./Segmented";
import { badgeClass } from "./Badge";
import { Alert, Button } from "@/app/components/account/ui";
import { MEASURE_PREP } from "@/lib/hc/appointment-kinds";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * How many messages the conversation shows before "Sjá eldri skilaboð".
 *
 * Three, chosen by measuring: at four the page was 934px against an 844px
 * screen, so entering Þjálfari started with a scroll. Three is the end of
 * the exchange and fits.
 *
 * It fits for messages of ordinary length. Three long ones will still push
 * past the fold — a fixed count cannot promise otherwise, and capping the
 * thread's height instead would put back the inner scrollbar this is here
 * to avoid.
 */
const TAIL = 3;

/** How many more each press of "Sjá eldri skilaboð" uncovers. */
const STEP = 10;

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


const ROLE_IS: Record<string, string> = {
  nurse: "Hjúkrunarfræðingur", doctor: "Læknir", coach: "Þjálfari",
  psychologist: "Sálfræðingur", admin: "Umsjón",
};

/**
 * The person's role, declined, for the sentences that name them.
 *
 * "Þjálfarinn þinn" was written into the card for everybody, and on the
 * care track the person on the other end is a nurse. The role comes from
 * the assigned worker; before one is assigned, from the track.
 */
const ROLE_FORMS: Record<string, { nom: string; acc: string; dat: string; gen: string }> = {
  coach: { nom: "Þjálfarinn", acc: "þjálfarann", dat: "þjálfaranum", gen: "þjálfarans" },
  nurse: { nom: "Hjúkrunarfræðingurinn", acc: "hjúkrunarfræðinginn", dat: "hjúkrunarfræðingnum", gen: "hjúkrunarfræðingsins" },
  doctor: { nom: "Læknirinn", acc: "lækninn", dat: "lækninum", gen: "læknisins" },
  psychologist: { nom: "Sálfræðingurinn", acc: "sálfræðinginn", dat: "sálfræðingnum", gen: "sálfræðingsins" },
};
type RoleForms = (typeof ROLE_FORMS)[string];
const formsFor = (role: string | null | undefined, track: "care" | "app" | undefined): RoleForms =>
  ROLE_FORMS[role ?? ""] ?? (track === "care" ? ROLE_FORMS.nurse : ROLE_FORMS.coach);

/** On a phone Enter is a new line; on a keyboard it sends. */
const coarsePointer = () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

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


const MO = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
const DAY_SHORT = ["sun", "mán", "þri", "mið", "fim", "fös", "lau"];
const DAYS_LONG = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];
/** Hand-formatted: the Vercel runtime has no Icelandic locale data. */
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const when = (iso: string) => { const d = new Date(iso); return `${d.getDate()}. ${MO[d.getMonth()]} kl. ${hhmm(d)}`; };
const longWhen = (iso: string) => { const d = new Date(iso); return `${DAYS_LONG[d.getDay()]} ${d.getDate()}. ${MO[d.getMonth()]}, kl. ${hhmm(d)}`; };

export default function CoachView({ api, startOn, focusNewest = false, portalUrl, track }: {
  api: Api;
  /** The journey's track: "care" (health check, a nurse) or "app" (coaching). */
  track?: "care" | "app";
  /** The location's Medalia portal, for the clinical path in AskFlow. */
  portalUrl?: string | null;
  /** "book" to open on Bóka, where an upcoming appointment lives. */
  startOn?: "talk" | "book";
  /**
   * Scroll to the end of the thread on arrival.
   *
   * Set when a notification sent the person here to read one message.
   * Opening Þjálfari from the navbar does not set it: the coach card is
   * the point of the page, and starting halfway down a chat answered a
   * question nobody asked.
   */
  focusNewest?: boolean;
}) {
  /*
   * Which subpage, with the caller able to say.
   *
   * An upcoming appointment leads here, and it belongs on Bóka where
   * Bókað is — not in the thread. The prop is read once as the initial
   * value rather than held in sync, so pressing Skilaboð afterwards still
   * works.
   */
  const [tab, setTab] = useState<"talk" | "book">(startOn === "book" ? "book" : "talk");
  const [data, setData] = useState<CoachData | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  /** Sent, not yet acknowledged. */
  const [pending, setPending] = useState<string[]>([]);
  const [err, setErr] = useState("");
  /** The thread could not be fetched — distinct from an empty thread. */
  const [loadErr, setLoadErr] = useState(false);
  const seen = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const r = await api("/api/hc/coach").catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    // A skeleton forever was the old failure mode; say so and offer a retry.
    setTimeout(() => { if (j) { setData(j); setLoadErr(false); } else setLoadErr(true); }, 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (tab !== "talk" || !data?.unread || seen.current) return;
    seen.current = true;
    void api("/api/hc/coach", { method: "POST", body: JSON.stringify({ seen: true }) }).then(() => load()).catch(() => {});
  }, [tab, data?.unread, api, load]);
  /*
   * Land on the newest message.
   *
   * "nearest" does as little as it can get away with — the thread no
   * longer has its own scroller, so the page is what moves, and nearest
   * decided it was near enough and left the last message under the docked
   * composer. "end" puts it above the dock, which is where you came to
   * look.
   */
  useEffect(() => {
    if (tab !== "talk") return;
    /*
     * Only when something sent you here to read a message.
     *
     * Opening Þjálfari normally should start at the top: the coach card is
     * the point of the page and scrolling past it to the end of a chat
     * answered a question nobody asked. A notification is the exception —
     * you tapped a specific message, so that is what you should be looking
     * at. Sending a message scrolls too, to your own words.
     */
    if (!focusNewest && !pending.length) return;
    const a = setTimeout(() => end.current?.scrollIntoView({ block: "end", behavior: "auto" }), 80);
    const b2 = setTimeout(() => end.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 420);
    return () => { clearTimeout(a); clearTimeout(b2); };
  }, [data?.thread.length, pending.length, tab, focusNewest]);

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

  const forms = formsFor(data?.coach?.role, track);

  if (!data && loadErr) {
    return (
      <Alert tone="bad" title="Ekki tókst að sækja samtalið"
        actions={<Button variant="secondary" onClick={() => { setLoadErr(false); void load(); }}>Reyna aftur</Button>}>
        Athugaðu nettenginguna og reyndu aftur. Ef eitthvað er bráðatilfelli, hringdu í 112.
      </Alert>
    );
  }
  if (!data) return <div className="h-40 animate-pulse rounded-hc-card bg-hc-surface/70" aria-busy="true" aria-label="Hleð samtalinu" />;

  return (
    <div className="space-y-4">
      {/* Two tabs on the shared segmented control: real tab semantics,
          44px segments, and the active one in brand-dark, where white text
          passes AA (on hc-brand it measured about 2.5:1). */}
      <Segmented mode="tabs" label={forms.nom} value={tab} onChange={setTab}
        panelId={(v) => `coach-panel-${v}`}
        options={[
          { value: "talk", label: <><MessageCircle className="h-4 w-4" aria-hidden />Skilaboð</>,
            extra: data.unread > 0 ? <span className={badgeClass("count")}>{data.unread > 9 ? "9+" : data.unread}<span className="sr-only"> ólesin</span></span> : undefined },
          { value: "book", label: <><CalendarPlus className="h-4 w-4" aria-hidden />Bóka</> },
        ]} />

      {/* A failed send belongs beside the composer, where the words went
          back; this line is for Bóka. */}
      {err && tab === "book" && <p role="alert" className="rounded-hc-element bg-hc-bad-surface px-4 py-2.5 text-sm font-semibold text-hc-bad-ink ring-1 ring-hc-bad-ink/30">{err}</p>}

      <div id={`coach-panel-${tab}`} role="tabpanel" className="space-y-4">
        {tab === "talk" && <Talk data={data} draft={draft} setDraft={setDraft} busy={busy} pending={pending}
          box={box} end={end} onSend={send} onPost={post} portalUrl={portalUrl} forms={forms} err={err} />}
        {tab === "book" && <Book data={data} busy={busy} onPost={post} forms={forms} />}
      </div>
    </div>
  );
}

/* ── Skilaboð: the coach, then the thread ──────────────────────────────── */

function Talk({ data, draft, setDraft, busy, pending, box, end, onSend, onPost, portalUrl, forms, err }: {
  data: CoachData; draft: string; setDraft: (s: string) => void; busy: boolean; pending: string[];
  forms: RoleForms; err: string;
  box: React.RefObject<HTMLTextAreaElement | null>; end: React.RefObject<HTMLDivElement | null>;
  onSend: () => Promise<void>; onPost: (p: Record<string, unknown>) => Promise<boolean>;
  /** The location's Medalia portal, for the clinical path in AskFlow. */
  portalUrl?: string | null;
}) {
  const [switching, setSwitching] = useState(false);
  const [prompts, setPrompts] = useState(false);
  const [about, setAbout] = useState(false);
  /** The whole history, when asked for. Default is the recent end of it. */
  /*
   * How much of the thread is on screen.
   *
   * Was a boolean: four messages, or the entire history in a box with its
   * own scrollbar. Both ends were wrong — the collapsed view could not be
   * extended a little, and the expanded one put a second scroller inside a
   * page that already scrolls. It is a count now: four to begin with, ten
   * more per press, and the page grows to fit them.
   */
  const [shownCount, setShownCount] = useState(TAIL);
  /*
   * Messenger's layout: the person at the top, the composer at the bottom,
   * and only the page scrolling between them.
   *
   * The coach card is tall — photo, name, role, Um/Skipta — and once you
   * have scrolled past it there is no longer anything on screen saying who
   * you are writing to. So a one-line version pins itself to the top when
   * the full card leaves the viewport. An observer on a sentinel at the
   * card's bottom edge decides, rather than a scroll listener, because the
   * question is literally "is this element still visible".
   */
  const [pinned, setPinned] = useState(false);
  const host = typeof document === "undefined" ? null : document.body;
  /*
   * The dock does the opposite of the navbar when the keyboard opens.
   *
   * The navbar hides, because nobody changes tab mid-sentence. This bar
   * holds the thing being typed into, so it has to rise above the keyboard
   * instead — on iOS a fixed bottom element stays behind it otherwise, and
   * you type into a box you cannot see.
   *
   * While the keyboard is up the navbar is gone, so the dock sits on the
   * keyboard itself rather than above both.
   */
  const keyboard = useKeyboard();
  const cardEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardEnd.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => setPinned(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const c = data.coach;
  const first = c?.name?.split(" ")[0] ?? `${forms.acc} þinn`;

  const start = (text: string) => {
    setDraft(text);
    box.current?.focus();
    // Caret at the end, so adding to it is the natural next keystroke.
    requestAnimationFrame(() => box.current?.setSelectionRange(text.length, text.length));
  };

  return (
    <>
      {/* The pinned one-liner. Always in the tree so it can animate, and
          lifted out of flow while hidden so it does not take a row of space
          at the top of the page for nothing. */}
      {/* Fixed and portalled, not sticky.
          position:sticky does not work anywhere on this site: globals.css
          keeps `html, body { overflow: auto !important }` as a guard against
          third-party SDKs locking the page, which makes body a scroll
          container that never scrolls — so every sticky descendant is
          confined to a box that does not move. Proved it with a bare
          sticky probe: bottom 1012 against an 844 viewport.
          Fixed has no such problem, and the portal keeps it clear of
          whatever the tab's markup does to its children. The inner wrapper
          repeats the page's own column so it lines up with the content. */}
      {host && createPortal(
        <div className={`pointer-events-none fixed inset-x-0 top-0 z-40 transition-all duration-200 ${
          pinned ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`}>
          <div className="pointer-events-auto mx-auto flex max-w-4xl items-center gap-3 bg-gradient-to-br from-hc-hero-from to-hc-hero-to px-4 pb-2.5 text-white shadow-md sm:rounded-b-2xl"
            /* Below the notch or status bar, not under it. */
            style={{ paddingTop: "calc(0.625rem + env(safe-area-inset-top, 0px))" }}>
          {c?.photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={c.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/40" />
            : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-hc-surface/15 ring-1 ring-white/30"><UserRound className="h-5 w-5" aria-hidden /></span>}
          <p className="min-w-0 flex-1 truncate font-bold">{c?.name ?? `${forms.nom} þinn`}</p>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Upp á toppinn"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-hc-surface/15 hover:text-white">
              <ChevronDown className="h-5 w-5 rotate-180" aria-hidden />
            </button>
          </div>
        </div>,
        host,
      )}

      {/* Who you are talking to, above the thread rather than behind a tab.
          A gradient header so the person reads as the subject of the page,
          and the rest of the card stays white. */}
      <section className={`${hcCard.base} overflow-hidden`}>
        <div className="flex items-start gap-4 bg-gradient-to-br from-hc-hero-from to-hc-hero-to p-4 text-white sm:p-5">
          {c?.photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={c.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-white/40" />
            : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-hc-surface/15 ring-2 ring-white/30"><UserRound className="h-8 w-8" aria-hidden /></span>}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70">{forms.nom} þinn</p>
            <p className="text-lg font-bold leading-tight">{c?.name ?? "Ekki kominn enn"}</p>
            <p className="text-sm text-white/85">
              {[c?.role ? ROLE_IS[c.role] ?? c.role : null, c?.credentials].filter(Boolean).join(" · ")
                || (forms === ROLE_FORMS.nurse ? "Þú færð hjúkrunarfræðing í viðtalinu." : "Enginn tengiliður valinn enn.")}
            </p>
          </div>
        </div>
        {(c?.bio || !!c?.specialties?.length || data.coaches.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-5">
            {(c?.bio || !!c?.specialties?.length) && (
              <button type="button" onClick={() => setAbout(!about)} aria-expanded={about}
                className="flex min-h-11 items-center gap-1 text-sm font-semibold text-hc-ink-2 hover:text-hc-ink">
                Um {first}
                <ChevronDown className={`h-4 w-4 transition ${about ? "rotate-180" : ""}`} aria-hidden />
              </button>
            )}
            {data.coaches.length > 0 && (
              <button type="button" onClick={() => setSwitching(!switching)} aria-expanded={switching}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-hc-brand-text hover:underline">Skipta um tengilið</button>
            )}
          </div>
        )}
        {about && (
          <div className="space-y-2 border-t border-hc-hairline px-4 py-3 sm:px-5">
            {c?.bio && <p className="text-sm leading-relaxed text-hc-ink-2">{c.bio}</p>}
            {!!c?.specialties?.length && (
              <ul className="flex flex-wrap gap-1.5">
                {c.specialties.map((x) => (
                  <li key={x} className="rounded-full bg-hc-brand/10 px-2.5 py-1 text-xs font-semibold text-hc-brand-text">{x}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {switching && (
          <ul className="divide-y divide-hc-hairline border-t border-hc-hairline">
            {data.coaches.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                {w.photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={w.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-hc-hairline" />
                  : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hc-sunken-2 text-hc-ink-3"><UserRound className="h-5 w-5" aria-hidden /></span>}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-hc-ink">{w.name}</p>
                  <p className="truncate text-sm text-hc-ink-2">
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

      {/* The line the observer watches: when this passes above the top of
          the viewport, the full card is gone and the pinned one takes over. */}
      <div ref={cardEnd} aria-hidden className="h-px" />

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
        <div className="space-y-2 bg-hc-sunken/60 p-4">
          {data.thread.length > shownCount && (
            <button type="button" onClick={() => setShownCount((n) => n + STEP)}
              className="mx-auto block rounded-full bg-hc-surface px-3 py-1.5 text-xs font-semibold text-hc-ink-2 ring-1 ring-hc-hairline transition hover:bg-hc-sunken">
              Sjá eldri skilaboð ({Math.min(STEP, data.thread.length - shownCount)})
            </button>
          )}
          {data.thread.length === 0 && (
            <p className="py-6 text-center text-sm text-hc-ink-2">
              Skrifaðu {c?.name ? first : `${forms.dat} þínum`} hvað sem er. Svarið kemur hingað.
            </p>
          )}
          {data.thread.slice(-shownCount).map((m) => (
            <div key={m.id} className={`flex ${m.author_kind === "client" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                m.author_kind === "client"
                  ? "bg-hc-brand-dark text-white"
                  : m.kind === "nudge"
                    ? "bg-hc-warn-surface text-amber-950 ring-1 ring-hc-warn-ink/30"
                    : "bg-hc-surface text-hc-ink ring-1 ring-hc-hairline"}`}>
                {m.author_kind === "coach" && (
                  <p className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide opacity-60">
                    
                    {m.author_name || c?.name || forms.nom}
                  </p>
                )}
                <p className="whitespace-pre-wrap leading-snug">{m.body}</p>
                <p className={`mt-1 text-[10px] ${m.author_kind === "client" ? "text-white/70" : "text-hc-ink-3"}`}>{when(m.created_at)}</p>
              </div>
            </div>
          ))}
          {/* In flight: there, but visibly not landed yet. */}
          {pending.map((t, i) => (
            <div key={`p${i}`} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-hc-brand-dark px-3.5 py-2.5 text-sm text-white shadow-sm">
                <p className="whitespace-pre-wrap leading-snug">{t}</p>
                <p className="mt-1 text-[10px] text-white/70">Sendi…</p>
              </div>
            </div>
          ))}
          {/* The scroll target, held clear of the dock.
              block:"end" aligns to the viewport floor, which is now behind
              the fixed composer and the bottom navbar — so the newest
              message was scrolled to and then covered by them.
              scroll-margin-bottom is what scrollIntoView honours, so the
              dock's height plus the navbar offset is reserved here rather
              than corrected with a scrollBy afterwards. */}
          <div ref={end} style={{ scrollMarginBottom: "calc(var(--hc-dock-offset) + 96px)" }} />
        </div>

        {/* A sheet, not a row of chips.
            They are whole sentences now, and a chip truncates a sentence to
            a label you then send unread. The sheet shows each one in full,
            so you choose the message rather than its title — and it stays
            out of the way until asked for, which a permanent row did not. */}
      </section>

      {/* Docked, like Messenger's.
          Two attempts at sticky failed for two different reasons. Inside
          the thread card, its overflow-hidden became the box the sticky
          element was confined to. Outside it, sticky still did nothing —
          because globals.css keeps `html, body { overflow: auto
          !important }` to stop third-party SDKs locking the page, which
          makes body a scroll container that never scrolls, so sticky has
          no moving scrollport anywhere on this site. Proved with a bare
          probe: a plain sticky bottom-0 bar sat at 1012 in an 844 viewport.
          So: fixed, portalled to body so nothing above it in the tree can
          reposition or clip it, with an inner wrapper repeating the page's
          own column so it lines up with the content. The offset clears the
          bottom navbar through --hc-dock-offset, which is 0 above sm where
          the navbar is hidden. */}
{host && createPortal(
        <div className="fixed inset-x-0 z-30"
          style={{ bottom: keyboard.open ? keyboard.inset : "var(--hc-dock-offset)" }}>
          <div className="mx-auto max-w-4xl border-t border-hc-hairline bg-hc-surface/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur">
          {/* Beside the composer, where the unsent words went back. */}
          {err && <p role="alert" className="mb-2 rounded-hc-element bg-hc-bad-surface px-3 py-2 text-sm font-semibold text-hc-bad-ink ring-1 ring-hc-bad-ink/30">{err}</p>}
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => setPrompts(true)}
              aria-label="Tilbúin skilaboð"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-hc-element text-hc-ink-2 ring-1 ring-hc-hairline transition hover:bg-hc-sunken hover:text-hc-brand-text">
              <MessageSquarePlus className="h-5 w-5" aria-hidden />
            </button>
            <textarea ref={box} value={draft} onChange={(e) => setDraft(e.target.value)} rows={1}
              /* ⌘/Ctrl+Enter always sends. Plain Enter sends with a
                 keyboard, but on a touch screen it is a new line — the
                 send button is right there, and a phone keyboard's return
                 key sending half a message was the complaint. */
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (e.metaKey || e.ctrlKey || (!e.shiftKey && !coarsePointer())) { e.preventDefault(); void onSend(); }
              }}
              placeholder="Skrifaðu skilaboð…" aria-label={`Skilaboð til ${forms.gen}`}
              className={`${hcInput} max-h-28 min-h-11 min-w-0 flex-1 resize-y py-2.5`} />
            <button type="button" onClick={() => void onSend()} disabled={busy || !draft.trim()}
              aria-label="Senda" className={`${hcBtn.primary} shrink-0 disabled:opacity-40`}>
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </div>
          </div>
        </div>,
        host,
      )}

      {/* The dock's own height, kept clear so the last message is not
          hidden underneath it. */}
      {/* The dock's height, kept clear so the last message is not hidden
          under it. 20 rather than 24: at 24 the page measured 851px against
          an 844px screen, so entering Þjálfari began 7px scrolled. */}
      <div aria-hidden className="h-20" />
      {/* Two questions instead of a flat list of canned lines.
          The list was fine as far as it went, but it could not ask a second
          question — "Ég meiddi mig" produced a sentence and the coach still
          had to ask where and since when — and it could not tell a clinical
          question from a coaching one. See AskFlow. */}
      {prompts && (
        <Sheet title="Hvað get ég hjálpað þér með?" onClose={() => setPrompts(false)}>
          <AskFlow
            portalUrl={portalFor(portalUrl)}
            onPick={(opener) => { setPrompts(false); start(opener); }}
            onFree={() => { setPrompts(false); box.current?.focus(); }}
          />
        </Sheet>
      )}
    </>
  );
}

/* ── Bóka: a menu, then a day, then a time ─────────────────────────────── */

function Book({ data, busy, onPost, forms }: {
  data: CoachData; busy: boolean; onPost: (p: Record<string, unknown>) => Promise<boolean>; forms: RoleForms;
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
          <section className={`${hcCard.base} divide-y divide-hc-hairline`}>
            <p className="px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-hc-ink-3">Bókað</p>
            {/* The whole row opens. Cancel used to be the only thing you
                could do to a booking, and it sat on the row as a small x —
                the one irreversible action, one mis-tap away, with no way
                to reach the useful things. Those live in the sheet now and
                cancelling is behind a confirmation. */}
            {data.bookings.map((b) => (
              <button key={b.id} type="button" onClick={() => setOpenBooking(b)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 p-4 text-left transition hover:bg-hc-sunken">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hc-brand/10 text-hc-brand-text">
                  {b.kind === "video" ? <Video className="h-5 w-5" aria-hidden /> : <Activity className="h-5 w-5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-hc-ink">
                    {b.kind === "video" ? "Myndsímtal"
                      : (b.items ?? []).map((k) => MEASURE_LABEL.get(k) ?? k).join(" + ") || "Mælingar"}
                  </p>
                  <p className="text-sm text-hc-ink-2">{longWhen(b.starts_at)} · {b.minutes} mín.</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              </button>
            ))}
          </section>
        )}

      {openBooking && (
        <BookingSheet booking={openBooking} place={data.place ?? null} busy={busy}
          onClose={() => setOpenBooking(null)} onPost={onPost} forms={forms} />
      )}

      {/* The menu. Two things to book, as cards you pick rather than two
          forms both open at once. */}
      {!choice && (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* The menu: the brand tint, because these are the choices. */}
          <button type="button" onClick={() => setChoice("video")} disabled={left <= 0}
            className="flex flex-col items-start gap-1 rounded-hc-card bg-hc-brand/5 p-5 text-left shadow-hc-card ring-1 ring-hc-brand/25 transition hover:bg-hc-brand/10 hover:shadow-hc-raised disabled:opacity-50 disabled:hover:bg-hc-brand/5 disabled:hover:shadow-hc-card">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-hc-brand/10 text-hc-brand-text"><Video className="h-5 w-5" aria-hidden /></span>
            <span className="mt-1 font-bold text-hc-ink">Myndsímtal</span>
            <span className="text-sm text-hc-ink-2">30 mínútur með {forms.dat}.</span>
            <span className="mt-2 flex items-center gap-1.5" aria-label={`${left} af ${allowance} eftir í þessum mánuði`}>
              {Array.from({ length: allowance }, (_, i) => (
                <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < left ? "bg-hc-brand" : "bg-slate-200"}`} aria-hidden />
              ))}
              <span className="ml-1 text-sm font-bold tabular-nums text-hc-ink-2">{left}/{allowance}</span>
              <span className="text-xs text-hc-ink-2">í mánuðinum</span>
            </span>
            {left <= 0 && <span className="text-xs font-semibold text-hc-ink-2">Búin — næsti mánuður opnast 1.</span>}
          </button>

          <button type="button" onClick={() => setChoice("measurement")}
            className="flex flex-col items-start gap-1 rounded-hc-card bg-hc-brand/5 p-5 text-left shadow-hc-card ring-1 ring-hc-brand/25 transition hover:bg-hc-brand/10 hover:shadow-hc-raised">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-hc-brand/10 text-hc-brand-text"><Activity className="h-5 w-5" aria-hidden /></span>
            <span className="mt-1 font-bold text-hc-ink">Mælingar</span>
            <span className="text-sm text-hc-ink-2">Veldu eina eða fleiri — tíminn leggst saman.</span>
            <span className="mt-2 text-xs text-hc-ink-2">{MEASURES.map((m) => m.label).join(" · ")}</span>
          </button>
        </div>
      )}

      {choice && (
        <section className={`${hcCard.base} overflow-hidden`}>
          <div className="flex items-center gap-2 border-b border-hc-hairline px-4 py-3 sm:px-5">
            <p className="min-w-0 flex-1 font-bold text-hc-ink">{choice === "video" ? "Myndsímtal" : "Hvað á að mæla?"}</p>
            <button type="button" onClick={() => { setChoice(null); setPicked([]); }}
              aria-label="Til baka" className="-my-1.5 grid h-11 w-11 place-items-center rounded-lg text-hc-ink-2 hover:bg-hc-sunken-2"><X className="h-5 w-5" aria-hidden /></button>
          </div>

          {choice === "measurement" && (
            <ul className="divide-y divide-hc-hairline">
              {MEASURES.map((m) => {
                const on = picked.includes(m.key);
                return (
                  <li key={m.key}>
                    <button type="button" aria-pressed={on}
                      onClick={() => setPicked((p) => (on ? p.filter((x) => x !== m.key) : [...p, m.key]))}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-hc-sunken sm:px-5">
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${
                        on ? "border-hc-brand-dark bg-hc-brand-dark text-white" : "border-hc-control"}`}>
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
                      </span>
                      <m.Icon className={`h-5 w-5 shrink-0 ${on ? "text-hc-brand-text" : "text-hc-ink-3"}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-hc-ink">{m.label}</span>
                        <span className="block text-sm text-hc-ink-2">{m.hint}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-hc-ink-2">{m.minutes} mín.</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {minutes > 0 && (
            <>
              <p className="flex items-baseline justify-between gap-2 bg-hc-brand/5 px-4 py-2.5 text-sm font-semibold text-hc-brand-text sm:px-5">
                <span>{choice === "video" ? "Myndsímtal" : `${picked.length} ${picked.length === 1 ? "mæling" : "mælingar"}`}</span>
                <span className="tabular-nums">{minutes} mínútur í allt</span>
              </p>
              <Slots minutes={minutes} busy={busy} onBook={book} forms={forms} />
            </>
          )}
          {choice === "measurement" && minutes === 0 && (
            <p className="px-4 py-4 text-sm text-hc-ink-2 sm:px-5">Veldu það sem þú vilt láta mæla og þá birtast tímarnir.</p>
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
function Slots({ minutes, busy, onBook, forms }: {
  minutes: number; busy: boolean; onBook: (iso: string) => Promise<boolean>; forms: RoleForms;
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
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Dagur</p>
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
                  on ? "bg-hc-brand-dark text-white shadow-sm" : "bg-hc-sunken-2 text-hc-ink-2 hover:bg-slate-200"}`}>
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
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Klukkan</p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {slots.map((t) => (
              <button key={t.toISOString()} type="button" disabled={busy}
                onClick={() => void onBook(t.toISOString())}
                className="min-h-11 rounded-lg bg-hc-sunken-2 py-2 text-sm font-semibold tabular-nums text-hc-ink-2 transition hover:bg-hc-brand-dark hover:text-white disabled:opacity-40">
                {hhmm(t)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-hc-ink-2">
            {forms.nom} staðfestir tímann. Þú færð skilaboð ef færa þarf hann.
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
function BookingSheet({ booking, place, busy, onClose, onPost, forms }: {
  forms: RoleForms;
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
  const prep = Array.from(new Set(items.flatMap((k) => MEASURE_PREP[k] ?? [])));

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
        <p className="text-sm text-hc-ink-2">{longWhen(booking.starts_at)} · {booking.minutes} mín.</p>

        {/* First, because when it matters it matters more than anything
            else on this sheet. */}
        {isVideo && booking.meeting_url && (
          <a href={booking.meeting_url} target="_blank" rel="noopener noreferrer"
            className={`${hcBtn.primary} flex w-full items-center justify-center gap-2`}>
            <Video className="h-4 w-4" aria-hidden /> Fara á fundinn
          </a>
        )}
        {isVideo && !booking.meeting_url && (
          <p className="rounded-hc-element bg-hc-sunken px-3 py-2.5 text-xs text-hc-ink-2 ring-1 ring-hc-hairline">
            Hlekkurinn á fundinn birtist hér þegar {forms.nom.toLowerCase()} hefur staðfest tímann.
          </p>
        )}

        {/* Where, and what to know. Only for a measurement — a video call
            happens wherever you are. */}
        {!isVideo && (place?.site || place?.address || place?.info || prep.length > 0) && (
          <section className="rounded-hc-card bg-hc-sunken p-3.5 ring-1 ring-hc-hairline">
            {(place?.site || place?.address) && (
              <>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-hc-ink-2">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> Hvar
                </p>
                {place?.site && <p className="mt-1 text-sm font-semibold text-hc-ink">{place.site}</p>}
                {place?.address && <p className="text-sm text-hc-ink-2">{place.address}</p>}
              </>
            )}
            {place?.info && <p className="mt-2 text-sm text-hc-ink-2">{place.info}</p>}
            {prep.length > 0 && (
              <>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Gott að vita</p>
                <ul className="mt-1 space-y-1">
                  {prep.map((line) => (
                    <li key={line} className="flex gap-1.5 text-sm text-hc-ink-2">
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
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-hc-ink-2">Nýr tími</p>
            <Slots minutes={booking.minutes} busy={busy} onBook={move} forms={forms} />
            <button type="button" onClick={() => setMoving(false)}
              className="mt-2 w-full text-center text-xs font-semibold text-hc-ink-2 hover:text-hc-ink-2 hover:underline">
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
          <div className="rounded-hc-element bg-hc-bad-surface p-3 ring-1 ring-hc-bad-ink/30">
            <p className="text-sm font-semibold text-hc-bad-ink">Afbóka þennan tíma?</p>
            <p className="mt-0.5 text-xs text-hc-bad-ink">
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
                className="flex-1 rounded-hc-element bg-hc-surface px-3 py-2 text-sm font-semibold text-hc-ink-2 ring-1 ring-slate-300 transition hover:bg-hc-sunken">
                Nei
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}
            className="w-full text-center text-xs font-semibold text-hc-ink-2 underline-offset-2 hover:text-hc-bad-ink hover:underline">
            Afbóka tímann
          </button>
        )}
      </div>
    </Sheet>
  );
}
