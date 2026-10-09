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
import Link from "next/link";
import { CalendarClock, MapPin, Video } from "lucide-react";
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

/** The glanceable one, for Í dag. */
export function UpcomingCard({ items, max = 2, href = "/account/heilsuferd/tilkynningar" }: {
  items: Upcoming[]; max?: number; href?: string;
}) {
  if (!items.length) return null;
  const shown = items.slice(0, max);
  return (
    <section className={`${hcCard.base} overflow-hidden`}>
      <div className="flex items-center gap-2 px-4 pt-3.5 sm:px-5">
        <CalendarClock className="h-4 w-4 shrink-0 text-hc-brand-dark" aria-hidden />
        <p className="min-w-0 flex-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Á döfinni</p>
        {items.length > max && (
          <Link href={href} className="text-sm font-semibold text-hc-brand-dark hover:underline">
            Allt ({items.length})
          </Link>
        )}
      </div>
      <ul className="divide-y divide-slate-100">
        {shown.map((x) => <Row key={x.id} x={x} />)}
      </ul>
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

function Row({ x }: { x: Upcoming }) {
  const video = !!x.meetingUrl;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-hc-brand/10 text-hc-brand-dark">
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
