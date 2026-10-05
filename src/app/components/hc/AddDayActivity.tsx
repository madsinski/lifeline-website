"use client";

// Tapping an empty day in the week: "I do something on Thursdays."
//
// Not everything in a week needs a programme behind it. Football, a class, a
// swim — these have a day and a name and that is all the plan needs to know,
// plus what they train so the core can stop prescribing what is already
// there. That classification is the same one the setup wizard uses, so
// adding football here and adding it there produce the same week.

import { useState } from "react";
import { Clock, X } from "lucide-react";
import { ACTIVITY_GROUPS, ACTIVITY_PRESETS, type Activity } from "@/lib/hc/adaptive-program";
import ActivityIcon, { CoverChips } from "./ActivityIcon";
import { WEEKDAYS } from "@/lib/hc/personalise";
import { hcBtn } from "./ui";

export default function AddDayActivity({ weekday, onAdd, onClose }: {
  weekday: number;
  onAdd: (a: Omit<Activity, "id">) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState<string>(ACTIVITY_GROUPS[0]);
  const [at, setAt] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
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

        <div className="space-y-3 overflow-y-auto p-4">
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
                onClick={() => onAdd({
                  name: x.name, day: weekday,
                  at: /^([01]\d|2[0-3]):[0-5]\d$/.test(at) ? at : null,
                  minutes: x.minutes, covers: x.covers, partial: x.partial ?? [], intensity: x.intensity,
                })}
                className="flex gap-2.5 rounded-xl bg-white p-3 text-left ring-1 ring-slate-200 transition hover:ring-2 hover:ring-hc-brand">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <ActivityIcon name={x.name} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                <span className="block font-semibold text-hc-ink">{x.name}</span>
                <CoverChips covers={x.covers} partial={x.partial} className="mt-1" />
                {x.why && <span className="mt-1 block text-[11px] leading-snug text-slate-500">{x.why}</span>}
                </span>
              </button>
            ))}
          </div>

          <button type="button" onClick={onClose} className={`${hcBtn.ghost} w-full`}>Hætta við</button>
        </div>
      </div>
    </div>
  );
}
