"use client";

// "Breytingar" — everything you can change about the training week, in one
// sheet, sorted so you can tell where a thing lives without hunting.
//
// The controls existed; they were scattered. Level and load sat in a row
// under the plan, injuries in another, the programme picker behind a
// different button, the week's days inside a wizard. A person who wants to
// say "this is too heavy" had to know which of those to open.
//
// Five sections, in the order people actually reach for them:
//   Vikan        — which days, and whether HIIT splits off
//   Álag         — how hard, right now
//   Meiðsli      — what to go easy on
//   Hvar         — gym, home, classes; what kind of cardio
//   Prógramm     — the whole plan

import { useState } from "react";
import Sheet from "./Sheet";
import { Activity, CalendarDays, ChevronRight, Dumbbell, HeartPulse, MapPin, X } from "lucide-react";
import { CARDIO_IS, EMPHASIS_IS, targetsFor, type Emphasis, LOAD_IS, PLACE_IS, REGION_IS, REGIONS, type Region, type TrainingLevel, type TrainingSettings } from "@/lib/hc/adaptive-program";

/** Only two levels, and the module exports no labels for them. */
const LEVELS: { key: TrainingLevel; label: string }[] = [
  { key: "beginner", label: "Að byrja" },
  { key: "active", label: "Í formi" },
];
import { hcBtn, hcCard } from "./ui";

type Section = "week" | "load" | "injury" | "place" | "emphasis";

const SECTIONS: { key: Section; label: string; blurb: string; Icon: typeof Activity }[] = [
  { key: "week", label: "Vikan", blurb: "Hvaða daga þú æfir", Icon: CalendarDays },
  { key: "load", label: "Álag og geta", blurb: "Hversu þungt, hversu langt komin", Icon: Dumbbell },
  { key: "injury", label: "Meiðsli", blurb: "Hvað á að fara varlega með", Icon: HeartPulse },
  { key: "place", label: "Hvar og hvernig", blurb: "Ræktin, heima, hóptímar, þol", Icon: MapPin },
  /*
   * Was "Prógrammið — Skipta um áætlun", a jump to a list of named plans.
   * Choosing between two bundles whose difference nobody could see is not
   * the choice people are trying to make: they want more of one thing and
   * less of another. So it is the balance itself, set here rather than
   * somewhere else.
   */
  { key: "emphasis", label: "Áherslan", blurb: "Meiri styrkur, jafnvægi eða meira þol", Icon: Activity },
];

export default function TrainingChanges({ settings, onChange, onOpenWeek, onClose, inline = false }: {
  settings: TrainingSettings;
  onChange: (next: TrainingSettings) => void;
  /** The day planner, which is its own full-screen thing. */
  onOpenWeek?: () => void;
  onClose?: () => void;
  /**
   * Rendered inside another sheet rather than being one.
   *
   * It used to be its own sleeve reached from its own button. Everything
   * about the programme lives behind one pill now, so this is the settings
   * part of that — a sheet inside a sheet would be two backdrops deep for
   * one subject.
   */
  inline?: boolean;
}) {
  const [open, setOpen] = useState<Section | null>(null);

  const set = (patch: Partial<TrainingSettings>) => onChange({ ...settings, ...patch });
  const toggleInjury = (r: Region) =>
    set({ injuries: settings.injuries.includes(r) ? settings.injuries.filter((x) => x !== r) : [...settings.injuries, r] });

  const body = (
    <>


        {/* No scroller of its own. Whether this is its own Sheet or sits
            inside the Prógrammið one, the Sheet is already the thing that
            scrolls — a second scroll area nested in it caught the drag and
            went nowhere, which is the sleeve "getting stuck". */}
        <div>
          {SECTIONS.map(({ key, label, blurb, Icon }) => {
            const isOpen = open === key;
            return (
              <div key={key} className="border-b border-slate-100 last:border-0">
                <button type="button" aria-expanded={isOpen}
                  onClick={() => {
                    // Two of these are whole screens of their own; opening a
                    // drawer only to show one button would be a step for
                    // nothing.
                    if (key === "week" && onOpenWeek) return onOpenWeek();
                    setOpen(isOpen ? null : key);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <Icon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-hc-ink">{label}</span>
                    <span className="block text-xs text-slate-500">{blurb}</span>
                  </span>
                  <ChevronRight className={`h-4 w-4 shrink-0 text-slate-300 transition ${isOpen ? "rotate-90" : ""}`} aria-hidden />
                </button>

                {isOpen && key === "emphasis" && (
                  <div className="space-y-2 px-4 pb-4">
                    {(Object.keys(EMPHASIS_IS) as Emphasis[]).map((e) => {
                      const on = (settings.emphasis ?? "balanced") === e;
                      const t = targetsFor(e);
                      return (
                        <button key={e} type="button" aria-pressed={on}
                          onClick={() => set({ emphasis: e })}
                          className={`flex w-full items-start gap-3 rounded-hc-element p-3 text-left ring-1 transition ${
                            on ? "bg-hc-brand/10 ring-hc-brand" : "bg-white ring-slate-200 hover:bg-slate-50"}`}>
                          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                            on ? "border-hc-brand bg-hc-brand" : "border-slate-300"}`}>
                            {on && <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-hc-ink">{EMPHASIS_IS[e].label}</span>
                            <span className="block text-xs text-slate-500">{EMPHASIS_IS[e].blurb}</span>
                            {/* The numbers, because "meiri styrkur" is a
                                direction and this is the actual week. */}
                            <span className="mt-1.5 flex flex-wrap gap-1">
                              {([["strength", "styrkur"], ["hiit", "HIIT"], ["cardio", "rólegt þol"]] as const).map(([k, lbl]) => (
                                <span key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                  {t[k]}× {lbl}
                                </span>
                              ))}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                    <p className="text-[11px] text-slate-500">
                      Áherslan breytir því hvað áætlunin setur inn þegar eitthvað vantar í vikuna. Það sem þú gerir sjálf(ur) telur áfram með.
                    </p>
                  </div>
                )}

                {isOpen && key === "load" && (
                  <div className="space-y-4 px-4 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Álag</p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <button type="button" aria-label="Minnka álag" disabled={settings.load <= -2}
                          onClick={() => set({ load: Math.max(-2, settings.load - 1) })}
                          className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-lg font-bold text-slate-700 disabled:opacity-30">−</button>
                        <span className="min-w-0 flex-1 text-center">
                          <span className="block text-sm font-bold text-hc-ink">{LOAD_IS[settings.load] ?? "Venjulegt"}</span>
                          <span className="block text-xs text-slate-500">{settings.load > 0 ? `+${settings.load}` : settings.load}</span>
                        </span>
                        <button type="button" aria-label="Auka álag" disabled={settings.load >= 2}
                          onClick={() => set({ load: Math.min(2, settings.load + 1) })}
                          className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-lg font-bold text-slate-700 disabled:opacity-30">+</button>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">Gildir um allar æfingar. Stakar æfingar má stilla á þeim sjálfum.</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Geta</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {LEVELS.map((lv) => (
                          <button key={lv.key} type="button" aria-pressed={settings.level === lv.key}
                            onClick={() => set({ level: lv.key })}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                              settings.level === lv.key ? "bg-hc-ink text-white ring-hc-ink" : "bg-white text-slate-700 ring-slate-200"}`}>
                            {lv.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {isOpen && key === "injury" && (
                  <div className="px-4 pb-4">
                    <div className="flex flex-wrap gap-1.5">
                      {REGIONS.map((r) => {
                        const on = settings.injuries.includes(r);
                        return (
                          <button key={r} type="button" aria-pressed={on} onClick={() => toggleInjury(r)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                              on ? "bg-amber-100 text-amber-900 ring-amber-300" : "bg-white text-slate-600 ring-slate-200"}`}>
                            {REGION_IS[r].label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Áætlunin sneiðir hjá æfingum sem hlaða það sem þú merkir hér.
                    </p>
                  </div>
                )}

                {isOpen && key === "place" && (
                  <div className="space-y-3 px-4 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Hvar</p>
                      <p className="mt-0.5 text-sm text-hc-ink">
                        {settings.places.map((pl) => PLACE_IS[pl].label).join(" + ") || "Ekki valið"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Þolþjálfun</p>
                      <p className="mt-0.5 text-sm text-hc-ink">{CARDIO_IS[settings.cardio].label}</p>
                    </div>
                    {onOpenWeek && (
                      <button type="button" onClick={onOpenWeek} className={`${hcBtn.secondary} w-full`}>
                        Breyta í uppsetningunni
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-100 p-3">
          <button type="button" onClick={onClose} className={`${hcBtn.primary} w-full`}>Loka</button>
        </div>
    </>
  );

  if (inline) {
    return (
      <section className="overflow-hidden rounded-hc-card bg-white shadow-hc-card ring-1 ring-slate-200">
        <p className="px-4 pb-1 pt-3.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Breytingar</p>
        {body}
      </section>
    );
  }

  return (
    <Sheet title="Breytingar á æfingaáætlun" onClose={onClose ?? (() => {})}
      header={
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-hc-ink">Breytingar</p>
            <p className="text-xs text-slate-500">Allt sem hægt er að stilla á æfingavikunni.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Loka"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
      }>
      {body}
    </Sheet>
  );
}

/** The button that opens it. Lives under the calendar and under Í dag. */
export function ChangesButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`${hcCard.base} flex w-full items-center gap-3 px-4 py-3 text-left transition hover:ring-slate-300`}>
      <Dumbbell className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-hc-ink">Breytingar</span>
        <span className="block text-xs text-slate-500">Dagar, álag, meiðsli, staðir, prógramm</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
    </button>
  );
}
