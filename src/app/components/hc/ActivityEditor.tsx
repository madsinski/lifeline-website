"use client";

// The week someone already has: football on Mondays and Thursdays, CrossFit
// on Tuesdays and Saturdays.
//
// Rewritten around how people actually answer the question. The first version
// asked for one sport and one day, so adding football twice a week meant
// going through the whole form twice; a sport is picked once here and then
// its days are toggled, which is both fewer taps and closer to how someone
// describes their week out loud.
//
// What each one trains is shown rather than hidden, because the classification
// is the part that decides what the core still has to prescribe — and it is
// not always what people expect. Football covers the hard lota and only half
// of the aerobic base; fríköfun covers neither.

import { useState } from "react";
import { Check, Clock, Plus, Trash2, X } from "lucide-react";
import { ACTIVITY_GROUPS, ACTIVITY_PRESETS, INTENSITY_IS, type Activity } from "@/lib/hc/adaptive-program";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/hc/personalise";
import ActivityIcon, { CoverChips, presetFor } from "./ActivityIcon";
import { hcBtn } from "./ui";

const newId = () => Math.random().toString(36).slice(2, 10);

export default function ActivityEditor({ activities, onChange }: {
  activities: Activity[];
  onChange: (a: Activity[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [group, setGroup] = useState<string>(ACTIVITY_GROUPS[0]);
  const [picked, setPicked] = useState<string | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [at, setAt] = useState("");
  const [own, setOwn] = useState("");

  const name = picked ?? own.trim();
  const preset = picked ? ACTIVITY_PRESETS.find((x) => x.name === picked) ?? null : presetFor(own);

  const reset = () => { setAdding(false); setPicked(null); setDays([]); setAt(""); setOwn(""); };

  const add = () => {
    if (!name || days.length === 0) return;
    onChange([...activities, ...days.map((day) => ({
      id: newId(), name, day,
      at: /^([01]\d|2[0-3]):[0-5]\d$/.test(at) ? at : null,
      minutes: preset?.minutes ?? 60,
      covers: preset?.covers ?? [],
      partial: preset?.partial ?? [],
      intensity: preset?.intensity ?? "moderate",
    } satisfies Activity))]);
    reset();
  };

  // One row per sport, with the days it falls on — the way someone would say it.
  const grouped = [...new Map(activities.map((a) => [a.name, activities.filter((x) => x.name === a.name)])).values()]
    .sort((x, y) => Math.min(...x.map((a) => a.day)) - Math.min(...y.map((a) => a.day)));

  return (
    <div className="space-y-3">
      {grouped.length > 0 && (
        <ul className="space-y-2">
          {grouped.map((rows) => {
            const a = rows[0];
            return (
              <li key={a.name} className="flex items-start gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <ActivityIcon name={a.name} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-hc-ink">{a.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {rows.sort((x, y) => x.day - y.day).map((r) => (
                      <span key={r.id} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">
                        {WEEKDAYS_SHORT[r.day]}{r.at ? ` ${r.at}` : ""}
                      </span>
                    ))}
                    <span className="text-[11px] text-slate-500">{INTENSITY_IS[a.intensity]}</span>
                  </span>
                  <CoverChips covers={a.covers} partial={a.partial} benefits={a.benefits} className="mt-1" />
                </span>
                <button type="button" aria-label={`Fjarlægja ${a.name}`}
                  onClick={() => onChange(activities.filter((x) => x.name !== a.name))}
                  className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      )}

      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} className={hcBtn.secondary}>
          <Plus className="h-4 w-4" aria-hidden /> Bæta við því sem þú gerir
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          {/* 1 ─ which sport */}
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-900">{picked ?? "Hvað gerirðu?"}</p>
            <button type="button" onClick={reset} aria-label="Hætta við" className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"><X className="h-4 w-4" /></button>
          </div>

          {!picked && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_GROUPS.map((g) => (
                  <button key={g} type="button" onClick={() => setGroup(g)} aria-pressed={group === g}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${group === g ? "bg-hc-ink text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{g}</button>
                ))}
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {ACTIVITY_PRESETS.filter((x) => x.group === group).map((x) => (
                  <button key={x.name} type="button" onClick={() => setPicked(x.name)}
                    className="flex gap-2.5 rounded-xl bg-white p-2.5 text-left ring-1 ring-slate-200 transition hover:ring-2 hover:ring-hc-brand">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <ActivityIcon name={x.name} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-hc-ink">{x.name}</span>
                      <CoverChips covers={x.covers} partial={x.partial} benefits={x.benefits} className="mt-0.5" />
                    </span>
                  </button>
                ))}
              </div>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Eða skrifaðu þitt eigið</span>
                <input value={own} onChange={(e) => setOwn(e.target.value)} maxLength={60}
                  placeholder="t.d. „Dans“" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
            </>
          )}

          {/* 2 ─ which days, as many as you like */}
          {name && (
            <>
              {preset?.why && <p className="rounded-xl bg-white p-2.5 text-xs leading-snug text-slate-600 ring-1 ring-slate-200">{preset.why}</p>}
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Hvaða daga?</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((w, i) => {
                    const on = days.includes(i);
                    return (
                      <button key={w} type="button" aria-pressed={on}
                        onClick={() => setDays(on ? days.filter((d) => d !== i) : [...days, i].sort((a2, b2) => a2 - b2))}
                        className={`inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold transition ${
                          on ? "bg-hc-ink text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"}`}>
                        {on && <Check className="h-3.5 w-3.5" aria-hidden />}{WEEKDAYS_SHORT[i]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                <Clock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                <input type="time" value={at} onChange={(e) => setAt(e.target.value)} aria-label="Klukkan"
                  className="bg-transparent text-sm outline-none" />
                <span className="text-xs text-slate-500">valfrjálst</span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={add} disabled={days.length === 0} className={hcBtn.primary}>
                  Bæta við {days.length > 0 ? `· ${days.length} ${days.length === 1 ? "dagur" : "dagar"}` : ""}
                </button>
                {picked && <button type="button" onClick={() => { setPicked(null); setDays([]); }} className={hcBtn.ghost}>Velja annað</button>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
