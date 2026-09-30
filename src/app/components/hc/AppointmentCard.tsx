"use client";

// The next appointment, big and first: when, where, and for a video call a
// join button that lights up half an hour before. Participant side
// (heilsuferð hub and "Í dag").

import { useSyncExternalStore } from "react";
import { CalendarClock, MapPin, Video } from "lucide-react";
import type { Upcoming } from "@/lib/hc/upcoming";

const WD = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];
const MO = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
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
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-emerald-100" aria-label="Næsti tími">
      <div className="flex items-stretch">
        <div className="w-1.5 shrink-0 bg-[#10B981]" aria-hidden />
        <div className="flex-1 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Næsti tími</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{a.title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-slate-700">
                <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden />
                {WD[at.getDay()]} {at.getDate()}. {MO[at.getMonth()]} kl. {hhmm(at)}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${soon ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-800"}`}>{relative(at, now)}</span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
            {a.video ? <Video className="h-4 w-4 text-slate-400" aria-hidden /> : <MapPin className="h-4 w-4 text-slate-400" aria-hidden />}
            {a.video ? "Myndsímtal" : a.place ?? "Á staðnum"}
          </p>
          {a.note && <p className="mt-1 text-sm text-slate-500">{a.note}</p>}
          {a.video && (a.link ? (
            <a href={a.link} target="_blank" rel="noreferrer"
              className={`mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-bold transition ${
                soon ? "bg-[#10B981] text-white shadow-lg shadow-emerald-500/25 hover:bg-[#047857]" : "bg-slate-900 text-white hover:bg-slate-700"}`}>
              <Video className="h-5 w-5" aria-hidden /> Tengjast myndsímtalinu
            </a>
          ) : (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Hlekkurinn á myndsímtalið birtist hér fyrir viðtalið.</p>
          ))}
        </div>
      </div>
    </section>
  );
}
