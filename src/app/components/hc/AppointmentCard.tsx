"use client";

// The next appointment, big and first: when, where, and for a video call a
// join button that lights up half an hour before. Participant side
// (heilsuferð hub and "Í dag").

import { useSyncExternalStore } from "react";
import { CalendarClock, MapPin, Video } from "lucide-react";
import type { Upcoming } from "@/lib/hc/upcoming";
import { fmtDateTime } from "@/app/components/account/ui";

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

// Re-render once a minute so "Eftir 10 mín." and the join button stay current.
const subscribe = (cb: () => void) => { const t = setInterval(cb, 60_000); return () => clearInterval(t); };
const minute = () => Math.floor(Date.now() / 60_000);

function relative(at: Date, now: number): string {
  const min = Math.round((at.getTime() - now) / 60_000);
  if (min <= 0) return "Núna";
  if (min < 60) return `Eftir ${min} mín.`;
  const today = new Date(now).toDateString() === at.toDateString();
  if (today) return `Í dag kl. ${hhmm(at)}`;
  const tomorrow = new Date(now + 86400_000).toDateString() === at.toDateString();
  if (tomorrow) return `Á morgun kl. ${hhmm(at)}`;
  const days = Math.ceil((at.getTime() - now) / 86400_000);
  return `Eftir ${days} daga`;
}

export default function AppointmentCard({ a }: { a: Upcoming }) {
  const now = useSyncExternalStore(subscribe, minute, minute) * 60_000;
  const at = new Date(a.at);
  const soon = at.getTime() - now < 30 * 60_000;
  /* The interview booked in Lifeline is the plan session with the nurse.
     The doctor's interview is booked and held in the sjúklingagátt and
     never appears here, so the two must not share the name "Viðtal". */
  const title = a.kind === "interview" ? "Áætlunarsamtal með Lifeline" : a.title;
  return (
    <section className="overflow-hidden rounded-3xl bg-hc-surface shadow-sm ring-1 ring-emerald-100" aria-label="Næsti tími">
      <div className="flex items-stretch">
        <div className="w-1.5 shrink-0 bg-hc-brand" aria-hidden />
        <div className="flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-hc-ok-ink">Næsti tími</p>
              <p className="mt-1 text-lg font-bold text-hc-ink">{title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-hc-ink-2">
                <CalendarClock className="h-4 w-4 text-hc-ink-3" aria-hidden />
                {fmtDateTime(a.at, { weekday: "short" })}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${soon ? "bg-hc-brand-dark text-white" : "bg-hc-ok-surface text-hc-ok-ink"}`}>{relative(at, now)}</span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-hc-ink-2">
            {a.video ? <Video className="h-4 w-4 text-hc-ink-3" aria-hidden /> : <MapPin className="h-4 w-4 text-hc-ink-3" aria-hidden />}
            {a.video ? "Myndsímtal" : a.place ?? "Á staðnum"}
          </p>
          {a.note && <p className="mt-1 text-sm text-hc-ink-2">{a.note}</p>}
          {a.video && (a.link ? (
            <a href={a.link} target="_blank" rel="noreferrer"
              className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold transition ${
                soon ? "bg-hc-brand-dark text-white shadow-lg shadow-emerald-700/25 ring-2 ring-hc-brand/40 hover:bg-emerald-800" : "bg-hc-brand-dark text-white hover:bg-emerald-800"}`}>
              <Video className="h-5 w-5" aria-hidden /> Tengjast myndsímtalinu
            </a>
          ) : (
            <p className="mt-3 rounded-xl bg-hc-warn-surface px-3 py-2 text-sm text-hc-warn-ink">Hlekkurinn á myndsímtalið birtist hér fyrir tímann.</p>
          ))}
        </div>
      </div>
    </section>
  );
}
