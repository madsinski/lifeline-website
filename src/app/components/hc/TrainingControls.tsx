"use client";

// Settings for the adaptive training programme (src/lib/hc/adaptive-program.ts):
// where the participant is (stage and week), their level, a plus-minus load
// control and injured areas. Used on /account/heilsuferd/aaetlun (participant)
// and in the workstation (nurse, same row). Read-only without onChange.

import { LOAD_IS, REGION_IS, REGIONS, injuryNotes, stageAt, type Region, type TrainingSettings } from "@/lib/hc/adaptive-program";

export default function TrainingControls({ settings, planStart, onChange, saving, who = "participant" }: {
  settings: TrainingSettings;
  planStart: string | null;
  onChange?: (s: TrainingSettings) => void;
  saving?: boolean;
  who?: "participant" | "nurse";
}) {
  const st = stageAt(settings, planStart);
  const edit = !!onChange;
  const set = (patch: Partial<TrainingSettings>) => onChange?.({ ...settings, ...patch });
  const toggle = (r: Region) => set({ injuries: settings.injuries.includes(r) ? settings.injuries.filter((x) => x !== r) : [...settings.injuries, r] });
  const you = who === "participant";

  return (
    <section className="space-y-3" aria-label="Stillingar æfingaáætlunar">
      {/* Where am I */}
      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-orange-100 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-orange-700">{you ? "Þú ert á" : "Stig núna"}</p>
            <p className="text-lg font-bold text-slate-900">{st.title}</p>
          </div>
          <p className="text-sm text-slate-600">
            Vika {st.week}{st.weeksToNext !== null && st.nextTitle ? ` · ${st.nextTitle} eftir ${st.weeksToNext} ${st.weeksToNext === 1 ? "viku" : "vikur"}` : ""}
          </p>
        </div>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {Array.from({ length: st.count }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < st.index ? "bg-orange-300" : i === st.index ? "bg-orange-500" : "bg-slate-100"}`} />
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600">{st.text}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Level */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm font-semibold text-slate-800">{you ? "Hvar ertu stödd/staddur?" : "Byrjunarstig"}</p>
          <div className="mt-2 grid gap-1.5">
            {([["beginner", "Að byrja", "4 vikna aðlögun fyrst"], ["active", "Æfi nú þegar", "Beint á stig 1"]] as const).map(([k, label, hint]) => (
              <button key={k} type="button" disabled={!edit || saving} onClick={() => set({ level: k })} aria-pressed={settings.level === k}
                className={`rounded-xl px-3 py-2 text-left text-sm transition ${settings.level === k ? "bg-orange-500 text-white" : "bg-slate-50 text-slate-700 hover:bg-orange-50"} disabled:cursor-default`}>
                <span className="block font-semibold">{label}</span>
                <span className={`block text-xs ${settings.level === k ? "text-white/85" : "text-slate-500"}`}>{hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Load */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm font-semibold text-slate-800">Álag</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" disabled={!edit || saving || settings.load <= -2} onClick={() => set({ load: settings.load - 1 })} aria-label="Minnka álag"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40">−</button>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{settings.load > 0 ? `+${settings.load}` : settings.load}</p>
              <p className="text-xs text-slate-500">{LOAD_IS[settings.load]}</p>
            </div>
            <button type="button" disabled={!edit || saving || settings.load >= 2} onClick={() => set({ load: settings.load + 1 })} aria-label="Auka álag"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500 text-2xl font-bold text-white hover:bg-orange-600 disabled:opacity-40">+</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Breytir fjölda setta, hversu nálægt þrotum er farið og fjölda HIIT-lota.</p>
        </div>

        {/* Injuries */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-sm font-semibold text-slate-800">{you ? "Meiðsli eða verkir" : "Meiðsli"}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REGIONS.map((r) => {
              const on = settings.injuries.includes(r);
              return (
                <button key={r} type="button" disabled={!edit || saving} onClick={() => toggle(r)} aria-pressed={on}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${on ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-rose-50"} disabled:cursor-default`}>
                  {REGION_IS[r].label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">Æfingum sem reyna á svæðið er skipt út fyrir mildari útgáfu.</p>
        </div>
      </div>

      {settings.injuries.length > 0 && (
        <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-100">
          <ul className="list-disc space-y-0.5 pl-5">{injuryNotes(settings).map((n) => <li key={n}>{n}</li>)}</ul>
          <p className="mt-1.5 text-xs">Verkur sem eykst við æfingu er merki um að stoppa. Ræddu við hjúkrunarfræðinginn eða sjúkraþjálfara ef hann hverfur ekki.</p>
        </div>
      )}
      {saving && <p className="text-xs text-slate-400">Vista…</p>}
    </section>
  );
}
