"use client";

// Booking a video call from inside the client's panel.
//
// The full Booking control lives in the interview and follow-up steps, which
// is the right place when you are walking the journey in order. But the two
// calls a nurse actually books mid-conversation — "let's go through your
// report on Tuesday", "let's check in after three months" — she books while
// talking, next to the messages she is about to send. So this is the small
// version: pick a day, pick a time, done.
//
// It writes interview_booked_for / followup_booked_for on the journey, which
// is the one place the calendar reads from, so the booking is on the .ics
// feed and pushed to Google within seconds. There is no separate calendar to
// keep in step.

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Loader2, Video } from "lucide-react";
import { INTERVIEW_WAIT_DAYS, interviewEligibleFrom } from "@/lib/hc/stages";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

const WEEKDAYS_IS = ["sun.", "mán.", "þri.", "mið.", "fim.", "fös.", "lau."];
const MONTHS_SHORT_IS = ["jan.", "feb.", "mars", "apr.", "maí", "júní", "júlí", "ág.", "sept.", "okt.", "nóv.", "des."];

/** Working hours, on the half hour. */
const SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"];

interface Busy { at: string; minutes: number; what: string }

type Kind = "interview" | "followup";

const KIND_IS: Record<Kind, { label: string; blurb: string; minutes: number }> = {
  interview: { label: "Viðtal", blurb: "Farið yfir heilsufarsskýrsluna", minutes: 45 },
  followup: { label: "Eftirfylgd", blurb: "Þriggja mánaða staða", minutes: 30 },
};

/** Local midnight, n days from today. */
function dayAt(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/** "þri. 30. sept." */
function dayLabel(d: Date): string {
  return `${WEEKDAYS_IS[d.getDay()]} ${d.getDate()}. ${MONTHS_SHORT_IS[d.getMonth()]}`;
}

/** A local date and "HH:MM" as an ISO instant. */
function isoAt(day: Date, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export default function BookVideo({ api, journey, onBooked }: {
  api: Api;
  journey: {
    id: string;
    interview_booked_for: string | null;
    interview_done_at: string | null;
    followup_booked_for: string | null;
    followup_done_at: string | null;
    plan_published_at: string | null;
    blood_test_done_at?: string | null;
    blood_results_at?: string | null;
    measurements_done_at?: string | null;
  };
  /** Record the booking through the journey's own event endpoint. */
  onBooked: (kind: Kind, at: string) => Promise<string | null>;
}) {
  // Whichever call is actually outstanding.
  const needsInterview = !journey.interview_done_at;
  const [kind, setKind] = useState<Kind>(needsInterview ? "interview" : "followup");
  const [offset, setOffset] = useState<number | null>(null);
  const [busy, setBusy] = useState<Busy[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  // Read after mount: the clock is not pure and the server would disagree.
  const [now, setNow] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/vinnustod/agenda?days=60");
    if (!r.ok) return;
    const j = await r.json().catch(() => ({}));
    setBusy(j.busy ?? []);
  }, [api]);

  // Deferred a tick: setting state straight out of an effect trips
  // react-hooks/set-state-in-effect, and the diary is not needed on the
  // first paint.
  useEffect(() => {
    const t = setTimeout(() => { setNow(Date.now()); void load(); }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const booked = kind === "interview" ? journey.interview_booked_for : journey.followup_booked_for;
  const done = kind === "interview" ? journey.interview_done_at : journey.followup_done_at;

  // Weekdays only, two working weeks ahead.
  const days: Date[] = [];
  for (let i = 1; days.length < 10; i++) {
    const d = dayAt(i);
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(d);
  }

  const taken = (iso: string) => {
    const start = new Date(iso).getTime();
    const end = start + KIND_IS[kind].minutes * 60_000;
    return busy.some((b) => {
      const bs = new Date(b.at).getTime();
      const be = bs + b.minutes * 60_000;
      return start < be && bs < end;
    });
  };

  const save = async (iso: string) => {
    setSaving(true); setMsg("");
    const err = await onBooked(kind, iso);
    setSaving(false);
    if (err) { setMsg(err); return; }
    setOffset(null);
    setMsg("Bókað og sett í dagatal.");
    void load();
  };

  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
        <Video className="h-3.5 w-3.5" aria-hidden /> Bóka myndsímtal
      </p>

      {/* Which call */}
      <div className="mt-2 flex gap-1">
        {(["interview", "followup"] as const).map((k) => (
          <button key={k} type="button" onClick={() => { setKind(k); setOffset(null); setMsg(""); }}
            disabled={k === "followup" && !journey.plan_published_at && !journey.followup_booked_for}
            title={k === "followup" && !journey.plan_published_at ? "Eftirfylgd bókast eftir að áætlun er birt" : KIND_IS[k].blurb}
            className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition disabled:opacity-40 ${
              kind === k ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"}`}>
            {KIND_IS[k].label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{KIND_IS[kind].blurb} · {KIND_IS[kind].minutes} mín.</p>

      {/* Already booked */}
      {booked && !done && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900 ring-1 ring-emerald-200">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Bókað {dayLabel(new Date(booked))} kl. {new Date(booked).toTimeString().slice(0, 5)}.
            <span className="block text-emerald-800/80">Veldu nýjan tíma hér fyrir neðan til að færa það.</span>
          </span>
        </p>
      )}
      {done && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> Lokið {dayLabel(new Date(done))}.
        </p>
      )}

      {/* The customer is told the interview comes two days after the tests, so
          the nurse is told the same thing — as a note, not a block: she may
          have a reason the rule does not know about. */}
      {kind === "interview" && !journey.interview_done_at && (() => {
        const from = interviewEligibleFrom(journey as Parameters<typeof interviewEligibleFrom>[0]);
        if (!from) {
          return (
            <p className="mt-2 rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] leading-snug text-slate-600">
              Mælingar eða blóðprufa eru ekki búnar. Viðtalið er venjulega bókað eftir að hvort tveggja liggur fyrir.
            </p>
          );
        }
        if (now != null && from.getTime() > now) {
          return (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-900">
              Niðurstöður koma venjulega {INTERVIEW_WAIT_DAYS} dögum eftir síðustu rannsókn — eftir {dayLabel(from)}.
            </p>
          );
        }
        return null;
      })()}

      {/* Day, then time */}
      <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
        {days.map((d, i) => {
          const at = dayAt(i + 1);
          const free = SLOTS.filter((t) => !taken(isoAt(at, t))).length;
          const on = offset === i;
          return (
            <button key={d.toISOString()} type="button" onClick={() => setOffset(on ? null : i)}
              className={`shrink-0 rounded-lg px-2 py-1.5 text-center transition ${
                on ? "bg-slate-900 text-white" : "bg-white ring-1 ring-slate-200 hover:bg-slate-100"}`}>
              <span className="block text-[10px] leading-tight opacity-70">{WEEKDAYS_IS[d.getDay()]}</span>
              <span className="block text-sm font-bold leading-tight">{d.getDate()}</span>
              <span className={`block text-[9px] leading-tight ${on ? "opacity-70" : free ? "text-emerald-700" : "text-slate-400"}`}>
                {free ? `${free} laus` : "fullt"}
              </span>
            </button>
          );
        })}
      </div>

      {offset !== null && (
        <ul className="mt-2 grid grid-cols-4 gap-1">
          {SLOTS.map((t) => {
            const iso = isoAt(dayAt(offset + 1), t);
            const no = taken(iso);
            return (
              <li key={t}>
                <button type="button" disabled={no || saving} onClick={() => void save(iso)}
                  className={`w-full rounded-lg py-1 text-xs font-semibold transition ${
                    no ? "cursor-not-allowed bg-slate-100 text-slate-300 line-through"
                       : "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-emerald-50 hover:ring-emerald-300"}`}>
                  {t}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {saving && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Bóka…</p>}
      {msg && <p role="status" className="mt-2 text-xs text-emerald-800">{msg}</p>}
      <p className="mt-2 text-[11px] leading-snug text-slate-400">
        Bókunin fer í dagatalið sjálfkrafa — í Google innan sekúndna, og í Apple eða Outlook um áskriftarslóðina.
      </p>
    </div>
  );
}
