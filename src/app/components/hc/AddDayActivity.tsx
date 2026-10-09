"use client";

// Tapping an empty day in the week: "I do something on Thursdays."
//
// Not everything in a week needs a programme behind it. Football, a class, a
// swim — these have a day and a name and that is all the plan needs to know,
// plus what they train so the core can stop prescribing what is already
// there. That classification is the same one the setup wizard uses, so
// adding football here and adding it there produce the same week.

import { useState } from "react";
import { useScrollLock } from "@/lib/hc/use-scroll-lock";
import { Clock, X } from "lucide-react";
import { ACTIVITY_GROUPS, ACTIVITY_PRESETS, asksStrengthFocus, REGION_IS, REGIONS, STRENGTH_FOCUS_IS, type Activity, type Region, type StrengthFocus } from "@/lib/hc/adaptive-program";
import ActivityIcon, { CoverChips } from "./ActivityIcon";
import { WEEKDAYS } from "@/lib/hc/personalise";
import { hcBtn } from "./ui";

export default function AddDayActivity({ weekday, onAdd, onClose }: {
  weekday: number;
  /** Injuries are passed up because they belong to the settings, not the day. */
  onAdd: (a: Omit<Activity, "id">, injuries?: Region[]) => void;
  onClose: () => void;
}) {
  // The page behind a sheet must not scroll with it.
  useScrollLock();
  const [group, setGroup] = useState<string>(ACTIVITY_GROUPS[0]);
  const [at, setAt] = useState("");
  /**
   * A lift needs one more question. "Lyftingar" on a Friday says nothing
   * about what is being trained, so the plan cannot tell whether the week
   * already covers legs — and the session card cannot say which areas are
   * loaded. Asking once here is cheaper than guessing every week.
   */
  const [lift, setLift] = useState<{ name: string; minutes: number | null; covers: string[]; partial?: string[]; intensity: string } | null>(null);
  const [focus, setFocus] = useState<StrengthFocus>("full");
  const [injuries, setInjuries] = useState<Region[]>([]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Bæta við á ${WEEKDAYS[weekday]}`}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{WEEKDAYS[weekday]}</p>
            <p className="font-bold text-slate-900">Hvað gerirðu á þessum degi?</p>
            <p className="mt-0.5 text-xs text-slate-500">Áætlunin hættir þá að setja inn það sem þú ert nú þegar að gera.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Loka" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {lift ? (
          <div className="space-y-4 overflow-y-auto overscroll-contain p-4">
            <div>
              <p className="font-bold text-hc-ink">{lift.name}</p>
              <p className="text-xs text-slate-500">Hvað ætlarðu að taka?</p>
            </div>

            <div className="grid gap-1.5 sm:grid-cols-2">
              {(Object.keys(STRENGTH_FOCUS_IS) as StrengthFocus[]).map((f) => (
                <button key={f} type="button" onClick={() => setFocus(f)} aria-pressed={focus === f}
                  className={`rounded-xl p-3 text-left ring-1 transition ${
                    focus === f ? "bg-hc-brand/10 ring-2 ring-hc-brand" : "bg-white ring-slate-200 hover:ring-slate-300"}`}>
                  <span className="block font-semibold text-hc-ink">{STRENGTH_FOCUS_IS[f].label}</span>
                  <span className="block text-[11px] text-slate-500">{STRENGTH_FOCUS_IS[f].blurb}</span>
                </button>
              ))}
            </div>

            {/* Asked here because it changes what the programme may give
                this person, and nobody goes looking in settings for it. */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Eitthvað sem þarf að fara varlega með?</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {REGIONS.map((r) => {
                  const on = injuries.includes(r);
                  return (
                    <button key={r} type="button" aria-pressed={on}
                      onClick={() => setInjuries((xs) => (on ? xs.filter((y) => y !== r) : [...xs, r]))}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                        on ? "bg-amber-100 text-amber-900 ring-amber-300" : "bg-white text-slate-600 ring-slate-200"}`}>
                      {REGION_IS[r].label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Þetta fer í stillingarnar þínar og hefur áhrif á allar æfingar, ekki bara þessa.
              </p>
            </div>

            <div className="flex gap-2">
              <button type="button" className={`${hcBtn.primary} flex-1`}
                onClick={() => {
                  onAdd({
                    name: `${lift.name} — ${STRENGTH_FOCUS_IS[focus].label}`, day: weekday,
                    at: /^([01]\d|2[0-3]):[0-5]\d$/.test(at) ? at : null,
                    minutes: lift.minutes, covers: lift.covers as Activity["covers"],
                    partial: (lift.partial ?? []) as Activity["covers"], intensity: lift.intensity as Activity["intensity"],
                    focus, load: 0,
                  }, injuries);
                }}>
                Bæta við
              </button>
              <button type="button" className={hcBtn.ghost} onClick={() => setLift(null)}>Til baka</button>
            </div>
          </div>
        ) : (
        <div className="space-y-3 overflow-y-auto overscroll-contain p-4">
          <label className="flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
            <Clock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <input type="time" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Klukkan (valfrjálst)"
              className="bg-transparent text-sm outline-none" />
            <span className="text-xs text-slate-500">valfrjálst</span>
          </label>

          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_GROUPS.map((g) => (
              <button key={g} type="button" onClick={() => setGroup(g)} aria-pressed={group === g}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${group === g ? "bg-hc-ink text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{g}</button>
            ))}
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2">
            {ACTIVITY_PRESETS.filter((x) => x.group === group).map((x) => (
              <button key={x.name} type="button"
                onClick={() => (asksStrengthFocus(x.covers, x.name)
                  ? setLift({ name: x.name, minutes: x.minutes, covers: x.covers, partial: x.partial, intensity: x.intensity })
                  : onAdd({
                      name: x.name, day: weekday,
                      at: /^([01]\d|2[0-3]):[0-5]\d$/.test(at) ? at : null,
                      minutes: x.minutes, covers: x.covers, partial: x.partial ?? [], intensity: x.intensity,
                    }))}
                className="flex gap-2.5 rounded-xl bg-white p-3 text-left ring-1 ring-slate-200 transition hover:ring-2 hover:ring-hc-brand">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <ActivityIcon name={x.name} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                <span className="block font-semibold text-hc-ink">{x.name}</span>
                <CoverChips covers={x.covers} partial={x.partial} benefits={x.benefits} className="mt-1" />
                {x.why && <span className="mt-1 block text-[11px] leading-snug text-slate-500">{x.why}</span>}
                </span>
              </button>
            ))}
          </div>

          <button type="button" onClick={onClose} className={`${hcBtn.ghost} w-full`}>Hætta við</button>
        </div>
        )}
      </div>
    </div>
  );
}
