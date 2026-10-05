"use client";

// The week the participant already has: football on Mondays, CrossFit on
// Saturdays, a swim when they can.
//
// Each entry says what it trains, because that is what decides whether the
// core still needs to prescribe it. The classification is the interesting
// part and is shown rather than hidden: innanhússfótbolti counts as a hard
// lota and NOT as rólegt þol, which is why a footballer still gets Zone 2.

import { useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import {
  ACTIVITY_GROUPS, ACTIVITY_PRESETS, COVERS_IS, INTENSITY_IS,
  type Activity, type Covers, type Intensity,
} from "@/lib/hc/adaptive-program";
import { WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/hc/personalise";
import { hcBtn } from "./ui";

const COVER_CLS: Record<Covers, string> = {
  strength: "bg-orange-100 text-orange-900 ring-orange-200",
  hiit: "bg-rose-100 text-rose-900 ring-rose-200",
  cardio: "bg-sky-100 text-sky-900 ring-sky-200",
};

const newId = () => Math.random().toString(36).slice(2, 10);

export default function ActivityEditor({ activities, onChange }: {
  activities: Activity[];
  onChange: (a: Activity[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [group, setGroup] = useState<string>(ACTIVITY_GROUPS[0]);
  const [draft, setDraft] = useState<{ name: string; covers: Covers[]; intensity: Intensity; minutes: number; day: number; at: string }>(
    { name: "", covers: [], intensity: "moderate", minutes: 60, day: 0, at: "" });

  const add = () => {
    if (!draft.name.trim()) return;
    onChange([...activities, {
      id: newId(), name: draft.name.trim(), day: draft.day,
      at: /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.at) ? draft.at : null,
      minutes: draft.minutes, covers: draft.covers, intensity: draft.intensity,
    }]);
    setDraft({ name: "", covers: [], intensity: "moderate", minutes: 60, day: 0, at: "" });
    setAdding(false);
  };

  const byDay = [...activities].sort((a, b) => a.day - b.day || (a.at ?? "").localeCompare(b.at ?? ""));

  return (
    <div className="space-y-3">
      {byDay.length > 0 && (
        <ul className="space-y-2">
          {byDay.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
              <span className="w-12 shrink-0 rounded-lg bg-slate-100 py-1 text-center text-xs font-bold text-slate-700">{WEEKDAYS_SHORT[a.day]}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-hc-ink">{a.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {a.at && <span className="inline-flex items-center gap-1 text-xs text-hc-ink-2"><Clock className="h-3 w-3" aria-hidden />{a.at}{a.minutes ? `–${endTime(a.at, a.minutes)}` : ""}</span>}
                  {a.covers.length === 0
                    ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">Kemur ekki í stað neins</span>
                    : a.covers.map((c) => <span key={c} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${COVER_CLS[c]}`}>{COVERS_IS[c]}</span>)}
                  <span className="text-[11px] text-slate-500">{INTENSITY_IS[a.intensity]}</span>
                </span>
              </span>
              <button type="button" aria-label={`Fjarlægja ${a.name}`} onClick={() => onChange(activities.filter((x) => x.id !== a.id))}
                className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}

      {!adding ? (
        <button type="button" onClick={() => setAdding(true)} className={hcBtn.secondary}>
          <Plus className="h-4 w-4" aria-hidden /> Bæta við því sem þú gerir
        </button>
      ) : (
        <div className="space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_GROUPS.map((g) => (
              <button key={g} type="button" onClick={() => setGroup(g)} aria-pressed={group === g}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${group === g ? "bg-hc-ink text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>{g}</button>
            ))}
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {ACTIVITY_PRESETS.filter((x) => x.group === group).map((x) => (
              <button key={x.name} type="button"
                onClick={() => setDraft((d) => ({ ...d, name: x.name, covers: x.covers, intensity: x.intensity, minutes: x.minutes }))}
                aria-pressed={draft.name === x.name}
                className={`rounded-xl p-2.5 text-left text-sm ring-1 transition ${draft.name === x.name ? "bg-emerald-50 ring-2 ring-hc-brand" : "bg-white ring-slate-200 hover:ring-slate-300"}`}>
                <span className="block font-semibold text-hc-ink">{x.name}</span>
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {x.covers.length === 0
                    ? <span className="text-[11px] text-slate-500">Kemur ekki í stað neins</span>
                    : x.covers.map((c) => <span key={c} className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${COVER_CLS[c]}`}>{COVERS_IS[c]}</span>)}
                </span>
                {x.why && <span className="mt-1 block text-[11px] leading-snug text-slate-500">{x.why}</span>}
              </button>
            ))}
          </div>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Eða skrifaðu þitt eigið</span>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60}
              placeholder="t.d. „Dans“" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Dagur</span>
              <select value={draft.day} onChange={(e) => setDraft({ ...draft, day: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Klukkan (valfrjálst)</span>
              <input type="time" value={draft.at} onChange={(e) => setDraft({ ...draft, at: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={add} disabled={!draft.name.trim()} className={hcBtn.primary}>Bæta við</button>
            <button type="button" onClick={() => setAdding(false)} className={hcBtn.ghost}>Hætta við</button>
          </div>
        </div>
      )}
    </div>
  );
}

function endTime(at: string, minutes: number): string {
  const [h, m] = at.split(":").map(Number);
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
