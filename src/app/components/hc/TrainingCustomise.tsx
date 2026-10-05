"use client";

// "Hvað viltu breyta?" for the training programme.
//
// The Æfingar page is for doing the training, so everything that changes it
// lives behind one button and opens here. Same shape as the action-plan
// editor: ask first, then show only what the answer covers, so nobody has to
// scroll past four editors to find the one dial they came for.

import { useState } from "react";
import { ArrowLeft, CalendarDays, ChevronRight, Dumbbell, Gauge, ListChecks } from "lucide-react";
import { LOAD_IS, PLACE_IS, CARDIO_IS, type TrainingSettings } from "@/lib/hc/adaptive-program";
import { WEEKDAYS_SHORT } from "@/lib/hc/personalise";
import type { Signal } from "@/lib/hc/grunnheilsa";
import TrainingWizard from "./TrainingWizard";
import ActivityEditor from "./ActivityEditor";
import { hcBtn, hcCard, hcKicker } from "./ui";

type What = "setup" | "activities" | "load" | "arrange";

export default function TrainingCustomise({
  settings, planStart, signals, titles, gym, saving, onSave, onClose, arrange,
}: {
  settings: TrainingSettings;
  planStart: string | null;
  signals: Record<string, Signal | null>;
  titles?: Record<string, string>;
  gym?: { name: string | null; url: string | null; info: string | null } | null;
  saving?: boolean;
  onSave: (s: TrainingSettings) => void;
  onClose: () => void;
  /** The week grid and exercise swapping, which live in TrainingView. */
  arrange?: React.ReactNode;
}) {
  const [what, setWhat] = useState<What | null>(null);

  const CHOICES: { key: What; label: string; hint: string; Icon: typeof Gauge; now: string }[] = [
    { key: "setup", label: "Uppsetningin", hint: "Hvar þú æfir, hvaða daga, aðlögun og takmarkanir.", Icon: ListChecks,
      now: `${settings.places.map((pl) => PLACE_IS[pl].label).join(" + ")} · ${settings.days.map((d) => WEEKDAYS_SHORT[d]).join(", ")} · ${CARDIO_IS[settings.cardio].label.toLowerCase()}` },
    { key: "activities", label: "Það sem ég geri nú þegar", hint: "Fótbolti, CrossFit, sund — áætlunin fyllir upp í það sem vantar.", Icon: Dumbbell,
      now: settings.activities.length ? `${settings.activities.length} skráð` : "Ekkert skráð" },
    { key: "load", label: "Álagið", hint: "Léttara eða þyngra en áætlunin segir.", Icon: Gauge,
      now: LOAD_IS[settings.load] },
    ...(arrange ? [{ key: "arrange" as What, label: "Raða dögum og skipta út æfingum", hint: "Færa æfingadag á annan dag eða skipta einni æfingu út fyrir aðra.", Icon: CalendarDays, now: "" }] : []),
  ];

  if (!what) {
    return (
      <section className={`${hcCard.base} p-5 sm:p-6`} aria-label="Breyta æfingaáætlun">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold text-hc-ink">Hvað viltu breyta?</h2>
          <button type="button" onClick={onClose} className={hcBtn.ghost}>Loka</button>
        </div>
        <p className="mt-1 text-sm text-hc-ink-2">Veldu eitt — þá sérðu aðeins það sem því tengist.</p>
        <div className="mt-4 grid gap-2">
          {CHOICES.map((c) => (
            <button key={c.key} type="button" onClick={() => setWhat(c.key)}
              className={`${hcCard.base} flex items-start gap-3 p-4 text-left transition hover:ring-2 hover:ring-hc-brand`}>
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                <c.Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-hc-ink">{c.label}</span>
                <span className="mt-0.5 block text-xs text-hc-ink-2">{c.hint}</span>
                {c.now && <span className="mt-1 block text-xs font-medium text-slate-500">Núna: {c.now}</span>}
              </span>
              <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            </button>
          ))}
        </div>
      </section>
    );
  }

  const back = (
    <button type="button" onClick={() => setWhat(null)} className={`${hcBtn.ghost} mb-3`}>
      <ArrowLeft className="h-4 w-4" aria-hidden /> Velja annað
    </button>
  );

  if (what === "setup") {
    return (
      <div>
        {back}
        <TrainingWizard settings={settings} planStart={planStart} signals={signals} titles={titles} gym={gym}
          saving={saving} onSave={(s) => { onSave(s); setWhat(null); }} onCancel={() => setWhat(null)} />
      </div>
    );
  }

  if (what === "activities") {
    return (
      <div>
        {back}
        <section className={`${hcCard.base} p-5 sm:p-6`}>
          <h3 className="text-lg font-bold text-hc-ink">Það sem ég geri nú þegar</h3>
          <p className="mt-1 text-sm text-hc-ink-2">Áætlunin fyllir upp í það sem vantar í stað þess að bæta ofan á þetta.</p>
          <div className="mt-4">
            <ActivityEditor activities={settings.activities} onChange={(a) => onSave({ ...settings, activities: a })} />
          </div>
        </section>
      </div>
    );
  }

  if (what === "load") {
    return (
      <div>
        {back}
        <section className={`${hcCard.base} p-5 sm:p-6`}>
          <h3 className="text-lg font-bold text-hc-ink">Álagið</h3>
          <p className="mt-1 text-sm text-hc-ink-2">
            Breytir settum, hversu nálægt þreytu hvert sett fer og fjölda HIIT-lota. Áætlunin sjálf helst eins.
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" disabled={saving || settings.load <= -2} onClick={() => onSave({ ...settings, load: settings.load - 1 })}
              aria-label="Minnka álag"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40">−</button>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">{settings.load > 0 ? `+${settings.load}` : settings.load}</p>
              <p className="text-sm text-slate-500">{LOAD_IS[settings.load]}</p>
            </div>
            <button type="button" disabled={saving || settings.load >= 2} onClick={() => onSave({ ...settings, load: settings.load + 1 })}
              aria-label="Auka álag"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40">+</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      {back}
      <p className={`${hcKicker} mb-2 text-slate-500`}>Raða dögum og skipta út æfingum</p>
      {arrange}
    </div>
  );
}
