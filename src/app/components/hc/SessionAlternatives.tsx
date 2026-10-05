"use client";

// "Ég geri eitthvað annað í dag."
//
// This replaces a line that read "Má skipta út fyrir: CrossFit, lyftingatími,
// hóptími með lóðum" tacked onto the end of the exercise list. It was in the
// wrong place (inside the session's blocks, so a strength day rendered an
// otherwise-empty section just to hold it), and it was the wrong idea: it
// told people what counts without letting them say they had done it.
//
// What a day is FOR is one of three things — strength, a hard interval, or
// easy aerobic work — and plenty of things satisfy each. A CrossFit class is
// a strength day. A game of football is the hard one. A hike is the easy one.
// So the session offers its equivalents as something you can pick, and
// picking one records the day as done with that modality.
//
// The last option is deliberately open: sometimes the honest answer is "I
// went for a long walk instead", and a plan that cannot hear that is a plan
// people stop opening.

import { useState } from "react";
import { Bike, CheckCircle2, Dumbbell, Footprints, Mountain, PersonStanding, Timer, Users, Waves, X, Zap } from "lucide-react";
import type { Modality } from "@/lib/hc/personalise";
import { hcBtn } from "./ui";

export interface Alternative {
  key: string;
  label: string;
  hint: string;
  Icon: typeof Dumbbell;
}

/** What else counts as this kind of day. */
const BY_MODALITY: Record<Modality, { blurb: string; options: Alternative[] }> = {
  strength: {
    blurb: "Dagurinn snýst um styrk. Allt þetta telst sem styrktaræfing.",
    options: [
      { key: "crossfit", label: "CrossFit", hint: "Lyftingar og púl í sama tíma", Icon: Zap },
      { key: "lyftingatimi", label: "Lyftingatími", hint: "Hóptími með lóðum eða stöng", Icon: Dumbbell },
      { key: "hoptimi", label: "Hóptími með lóðum", hint: "Body Pump og sambærilegt", Icon: Users },
      { key: "ahaldaleikfimi", label: "Áhaldaleikfimi", hint: "Eigin líkamsþyngd og áhöld", Icon: PersonStanding },
    ],
  },
  hiit: {
    blurb: "Dagurinn snýst um eina harða lotu. Allt þetta telst sem hörð lota.",
    options: [
      { key: "boltaithrott", label: "Boltaíþrótt", hint: "Fótbolti, handbolti, körfubolti, badminton", Icon: Zap },
      { key: "spinning", label: "Spinning eða þrektími", hint: "Hóptími á fullu", Icon: Bike },
      { key: "sprettir", label: "Sprettir eða brekkur", hint: "Úti eða á bretti", Icon: Timer },
    ],
  },
  cardio: {
    blurb: "Dagurinn snýst um rólegt þol. Allt þetta telst sem rólegt þol.",
    options: [
      { key: "ganga", label: "Rösk ganga", hint: "Úti eða á bretti", Icon: Footprints },
      { key: "fjallganga", label: "Fjallganga", hint: "Löng og róleg — einmitt það sem Zone 2 er", Icon: Mountain },
      { key: "skokk", label: "Skokk", hint: "Á hraða þar sem þú getur talað", Icon: Footprints },
      { key: "hjol", label: "Hjól", hint: "Úti eða þrekhjól", Icon: Bike },
      { key: "sund", label: "Sund", hint: "Rólegar ferðir", Icon: Waves },
    ],
  },
  other: { blurb: "", options: [] },
};

export default function SessionAlternatives({ modality, sessionTitle, onPick, onClose }: {
  modality: Modality;
  sessionTitle: string;
  /** What they did instead, and whether it still counts as this kind of day. */
  onPick: (info: { label: string; modality: Modality }) => void;
  onClose: () => void;
}) {
  const [own, setOwn] = useState("");
  const set = BY_MODALITY[modality] ?? BY_MODALITY.other;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Gera eitthvað annað"
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Í stað „{sessionTitle}“</p>
            <p className="font-bold text-slate-900">Hvað gerðirðu í staðinn?</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Loka" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {set.options.length > 0 && (
            <>
              <p className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {set.blurb}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {set.options.map((o) => (
                  <button key={o.key} type="button" onClick={() => onPick({ label: o.label, modality })}
                    className="flex items-start gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200 transition hover:ring-2 hover:ring-hc-brand">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                      <o.Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-hc-ink">{o.label}</span>
                      <span className="block text-xs text-hc-ink-2">{o.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* The honest answer is sometimes none of the above. */}
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="text-sm font-semibold text-slate-800">Eitthvað allt annað</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Göngutúr, jóga, sund með börnunum — það telst með. Hreyfing sem þú gerðir er betri en æfing sem þú slepptir.
            </p>
            <div className="mt-2 flex gap-2">
              <input value={own} onChange={(e) => setOwn(e.target.value)} maxLength={60}
                placeholder="t.d. „Fjallganga á Esjuna“" aria-label="Hvað gerðirðu?"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="button" disabled={own.trim().length < 2} className={hcBtn.primary}
                onClick={() => onPick({ label: own.trim(), modality: "other" })}>Skrá</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
