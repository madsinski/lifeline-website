"use client";

// "Á döfinni" — what is coming up, as a card and as a list.
//
// ── Why this is not the bell ─────────────────────────────────────────────
//
// A notification is something that happened and that you can clear. An
// appointment next Tuesday is neither: it already happened to you in the
// sense that it is true, and there is nothing to dismiss. Putting it behind
// the bell was the first version of this, and the dot had to be suppressed
// for appointments to stop it lighting up over something nobody could clear
// — "a dot you cannot clear is a dot people stop seeing".
//
// So two things, two icons, on purpose: a bell for what happened, a calendar
// with a clock for what is about to. That pairing is the convention in
// scheduling apps, and the two feel different because they are.
//
// ── Why a card and not a list on Í dag ───────────────────────────────────
//
// The next one or two, not everything. Setmore's home widget is the nearest
// precedent for a glanceable upcoming view, and the counter-example is a
// booking case study whose home screen had to be stripped back because it
// confused people. Í dag is a checklist; one line about Tuesday is context,
// six lines is a second page.

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, MapPin, Video } from "lucide-react";
import { useSwipe } from "@/lib/hc/use-swipe";
import { hcCard } from "./ui";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

export interface Upcoming {
  id: string;
  start: string;
  minutes: number;
  title: string;
  location: string | null;
  meetingUrl: string | null;
}

const MO = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];
const DAYS = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/**
 * "á morgun kl. 09:00", "þriðjudaginn 14. okt. kl. 09:00".
 *
 * Hand-formatted, because the Vercel runtime has no Icelandic locale data
 * and toLocaleDateString("is-IS") silently answers in English there. Days
 * are compared by calendar date, not by hours elapsed: something at 23:00
 * tonight is "í dag" and something at 01:00 tomorrow is not "in two hours".
 */
export function whenIs(iso: string): string {
  const d = new Date(iso);
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(d) - midnight(new Date())) / 864e5);
  if (days === 0) return `í dag kl. ${hhmm(d)}`;
  if (days === 1) return `á morgun kl. ${hhmm(d)}`;
  if (days < 7) return `${DAYS[d.getDay()]} kl. ${hhmm(d)}`;
  return `${d.getDate()}. ${MO[d.getMonth()]} kl. ${hhmm(d)}`;
}

export function useUpcoming(api: Api) {
  const [items, setItems] = useState<Upcoming[]>([]);
  const load = useCallback(async () => {
    const r = await api("/api/hc/upcoming").catch(() => null);
    if (!r?.ok) return;
    const j = await r.json().catch(() => null);
    setTimeout(() => setItems(j?.items ?? []), 0);
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  return { items, reloadUpcoming: load };
}

/** Midnight on the day a date falls, for comparing calendar days. */
const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();

/**
 * The one on Í dag: today and tomorrow only, and swipe it away.
 *
 * It used to list the next two whatever they were, which meant the same two
 * lines for weeks — and a card that is identical twenty-eight days out of
 * thirty is one the eye learns to skip. Habituation follows the rate of
 * change, not the position on the page. Rare is what makes it readable.
 *
 * Amber rather than the usual white, because the whole point of it
 * appearing is that something is close. The full list lives behind the
 * lightning bolt, where nothing is urgent and everything is there.
 */
export function UpcomingSoon({ items, onDismiss }: {
  items: Upcoming[];
  /** Swiped away for today. */
  onDismiss?: () => void;
}) {
  const swipe = useSwipe({ width: 96 });
  const soon = items.filter((x) => {
    const days = Math.round((midnight(new Date(x.start)) - midnight(new Date())) / 864e5);
    return days <= 1 && days >= 0;
  });
  if (!soon.length) return null;

  return (
    <section className="relative overflow-hidden rounded-hc-card">
      {onDismiss && (
        <button type="button" onClick={() => { swipe.close(); onDismiss(); }}
          aria-label="Fela þar til á morgun"
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-slate-400 px-4 text-sm font-bold text-white"
          style={{ width: 96 }}>
          Fela
        </button>
      )}
      <div className="relative rounded-hc-card bg-amber-50 ring-1 ring-amber-300 transition-transform"
        style={{ transform: `translateX(${swipe.dx}px)`, transitionDuration: swipe.dx === 0 || swipe.open ? "160ms" : "0ms", touchAction: "pan-y" }}
        {...(onDismiss ? swipe.handlers : {})}>
        <div className="flex items-center gap-2 px-4 pt-3 sm:px-5">
          <CalendarClock className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <p className="min-w-0 flex-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
            {soon.length === 1 ? "Á næstunni" : "Á næstunni"}
          </p>
        </div>
        <ul className="divide-y divide-amber-200/60">
          {soon.map((x) => <Row key={x.id} x={x} urgent />)}
        </ul>
      </div>
    </section>
  );
}

/** The whole lot, for the Tilkynningar page. */
export function UpcomingList({ items }: { items: Upcoming[] }) {
  if (!items.length) {
    return (
      <p className="rounded-hc-card bg-hc-surface px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
        Ekkert bókað eins og er.
      </p>
    );
  }
  return (
    <ul className={`${hcCard.base} divide-y divide-slate-100 overflow-hidden`}>
      {items.map((x) => <Row key={x.id} x={x} />)}
    </ul>
  );
}

function Row({ x, urgent = false }: { x: Upcoming; urgent?: boolean }) {
  const video = !!x.meetingUrl;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${urgent ? "bg-amber-200 text-amber-900" : "bg-hc-brand/10 text-hc-brand-dark"}`}>
        {video ? <Video className="h-4 w-4" aria-hidden /> : <CalendarClock className="h-4 w-4" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-hc-ink">{x.title}</span>
        <span className="block text-sm text-slate-600">
          {whenIs(x.start)}
          {x.minutes ? ` · ${x.minutes} mín.` : ""}
        </span>
        {/* A place, but never a URL: the link is the button beside it. */}
        {x.location && !video && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />{x.location}
          </span>
        )}
      </span>
      {video && (
        <a href={x.meetingUrl!} target="_blank" rel="noopener noreferrer"
          className="shrink-0 rounded-hc-element bg-hc-brand px-3 py-1.5 text-sm font-bold text-white transition hover:bg-hc-brand-dark">
          Fara á fundinn
        </a>
      )}
    </li>
  );
}
