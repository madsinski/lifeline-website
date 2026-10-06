"use client";

// Setting up the nutrition plan: what you will actually eat.
//
// The programme itself is one core, and which dial it turns up comes from the
// report rather than from a menu. What it cannot work out on its own is the
// part that decides whether the plan is edible at all — what you do not eat,
// how much cooking is realistic, and whether you want a snack slot.
//
// The library depth is shown honestly at the end. Two of eighteen dinners are
// vegetarian, so a restriction can leave someone looking at the same meal
// every day, and saying so beats serving it quietly.

import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
  ALLERGEN_OPTIONS, COOKING_IS, DIET_OPTIONS, EMPHASIS_IS, emphasisFor, type Allergen,
  type NutritionPrefs,
} from "@/lib/hc/nutrition";
import { libraryDepth, SLOT_IS, type Meal } from "@/lib/hc/meals";
import type { Signal } from "@/lib/hc/grunnheilsa";
import { hcBtn, hcCard, hcKicker } from "./ui";

const STEPS = ["Mataræði", "Eldamennska", "Máltíðir", "Áherslur"] as const;

export default function NutritionWizard({ prefs, signals, meals, saving, onSave, onCancel }: {
  prefs: NutritionPrefs;
  signals: Record<string, Signal | null>;
  meals: Meal[] | null;
  saving?: boolean;
  onSave: (p: NutritionPrefs) => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [p, setP] = useState<NutritionPrefs>(prefs);
  const set = (patch: Partial<NutritionPrefs>) => setP((x) => ({ ...x, ...patch }));
  const toggleAvoid = (k: Allergen) =>
    set({ avoid: (p.avoid ?? []).includes(k) ? (p.avoid ?? []).filter((x) => x !== k) : [...(p.avoid ?? []), k] });
  const toggleDiet = (k: string) =>
    set({ diet: p.diet.includes(k) ? p.diet.filter((x) => x !== k) : [...p.diet, k] });

  const emphasis = emphasisFor(signals);
  const depth = meals ? libraryDepth(meals, p) : null;
  const thin = depth?.filter((d) => d.have < 4) ?? [];
  const last = step === STEPS.length - 1;

  const card = (on: boolean) =>
    `w-full rounded-2xl p-4 text-left transition ring-1 ${on ? "bg-emerald-50 ring-2 ring-hc-brand" : "bg-white ring-slate-200 hover:ring-slate-300"}`;

  return (
    <section className={`${hcCard.base} p-5 sm:p-6`} aria-label="Uppsetning næringaráætlunar">
      <ol className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className={`flex h-6 items-center gap-1.5 rounded-full px-2.5 ${
              i === step ? "bg-hc-ink text-white" : i < step ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-500"}`}>
              {i < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}{label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-3 bg-slate-200" aria-hidden />}
          </li>
        ))}
      </ol>

      {/* 1 ─ what you do not eat */}
      {step === 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-hc-ink">Er eitthvað sem þú borðar ekki?</h3>
          <p className="text-sm text-hc-ink-2">Þá sérðu aðeins máltíðir sem passa. Veldu ekkert ef allt er í lagi.</p>
          <div className="grid gap-2">
            {DIET_OPTIONS.map((d) => (
              <button key={d.key} type="button" onClick={() => toggleDiet(d.key)} aria-pressed={p.diet.includes(d.key)} className={card(p.diet.includes(d.key))}>
                <span className="font-semibold text-hc-ink">{d.label}</span>
              </button>
            ))}
          </div>

          <h4 className="pt-2 text-sm font-bold uppercase tracking-wide text-slate-500">Óþol og ofnæmi</h4>
          <p className="text-sm text-hc-ink-2">
            Við sleppum öllum máltíðum sem innihalda þetta — og líka þeim sem gætu innihaldið það.
            Þú sérð því frekar of fáar máltíðir en of margar.
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {ALLERGEN_OPTIONS.map((a) => {
              const on = (p.avoid ?? []).includes(a.key);
              return (
                <button key={a.key} type="button" onClick={() => toggleAvoid(a.key)} aria-pressed={on}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    on ? "border-rose-500 bg-rose-50 font-semibold text-rose-900" : "border-slate-200 bg-white text-hc-ink hover:border-slate-300"}`}>
                  {a.label}
                </button>
              );
            })}
          </div>
          {(p.avoid ?? []).map((k) => ALLERGEN_OPTIONS.find((a) => a.key === k)).filter((a) => a?.note).map((a) => (
            <p key={a!.key} className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">{a!.note}</p>
          ))}
          {/* Not a safety guarantee, and it must not read like one. */}
          {(p.avoid ?? []).length > 0 && (
            <p className="flex gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-700">
              <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <span>
                Þetta er uppskriftasafn, ekki innihaldslýsing frá framleiðanda. Við sjáum hvorki snefilmagn
                né hvað er í tilteknum pakka. Ef ofnæmið er alvarlegt þarf alltaf að lesa pakkann.
              </span>
            </p>
          )}
          {p.diet.length === 0 && (p.avoid ?? []).length === 0 && <p className="text-sm text-slate-500">Ekkert valið — allar máltíðir í boði.</p>}
        </div>
      )}

      {/* 2 ─ how much cooking */}
      {step === 1 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-hc-ink">Hversu mikið eldarðu?</h3>
          <p className="text-sm text-hc-ink-2">Ræður því hvaða máltíðir koma fyrst — ekki hvað er í boði.</p>
          <div className="grid gap-2">
            {(["quick", "normal", "prep"] as NutritionPrefs["cooking"][]).map((c) => (
              <button key={c} type="button" onClick={() => set({ cooking: c })} aria-pressed={p.cooking === c} className={card(p.cooking === c)}>
                <span className="block font-semibold text-hc-ink">{COOKING_IS[c].label}</span>
                <span className="mt-0.5 block text-xs text-hc-ink-2">{COOKING_IS[c].hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3 ─ how many meals */}
      {step === 2 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-hc-ink">Viltu millimál?</h3>
          <p className="text-sm text-hc-ink-2">Hvorugt er réttara en hitt — veldu það sem þú heldur út.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => set({ snack: true })} aria-pressed={p.snack} className={card(p.snack)}>
              <span className="block font-semibold text-hc-ink">Já — þrjár máltíðir og millimál</span>
              <span className="mt-0.5 block text-xs text-hc-ink-2">Hentar vel ef langt líður milli máltíða.</span>
            </button>
            <button type="button" onClick={() => set({ snack: false })} aria-pressed={!p.snack} className={card(!p.snack)}>
              <span className="block font-semibold text-hc-ink">Nei — þrjár máltíðir</span>
              <span className="mt-0.5 block text-xs text-hc-ink-2">Einfaldara, og lengri hlé milli máltíða.</span>
            </button>
          </div>
        </div>
      )}

      {/* 4 ─ what the report asks for, and how much library is left */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-hc-ink">Áherslan þín</h3>
            <p className="mt-1 text-sm text-hc-ink-2">Þetta kemur úr skýrslunni þinni — þú þarft ekki að velja það.</p>
          </div>
          {emphasis.length === 0 ? (
            <p className={`${hcCard.base} p-4 text-sm text-slate-600`}>Skýrslan kallar ekki á sérstaka áherslu. Grunnurinn stendur: alvöru matur, prótein og trefjar.</p>
          ) : (
            <ul className="space-y-2">
              {emphasis.map((e) => (
                <li key={e.emphasis} className={`${hcCard.base} flex items-start gap-3 p-3`}>
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${e.urgent ? "bg-rose-500" : "bg-amber-400"}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-semibold text-hc-ink">{EMPHASIS_IS[e.emphasis].label}</span>
                    <span className="block text-xs text-hc-ink-2">{e.why}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {depth && (
            <div>
              <p className={`${hcKicker} mb-2 text-slate-500`}>Máltíðir í boði fyrir þig</p>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {depth.map((d) => (
                  <div key={d.slot} className={`rounded-xl p-3 text-center ${d.have < 4 ? "bg-amber-50 ring-1 ring-amber-200" : "bg-slate-50"}`}>
                    <dt className="text-xs font-semibold text-slate-600">{SLOT_IS[d.slot]}</dt>
                    <dd className={`text-lg font-bold ${d.have < 4 ? "text-amber-800" : "text-slate-900"}`}>{d.have}<span className="text-xs font-medium text-slate-500"> af {d.total}</span></dd>
                  </div>
                ))}
              </dl>
              {thin.length > 0 && (
                <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
                  Safnið okkar á fáar máltíðir sem passa við valið þitt
                  {` (${thin.map((d) => SLOT_IS[d.slot].toLowerCase()).join(", ")})`}.
                  Þú munt sjá sömu réttina oft. Segðu hjúkrunarfræðingnum frá — við bætum við.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className={hcBtn.ghost}>
            <ArrowLeft className="h-4 w-4" aria-hidden /> Til baka
          </button>
        )}
        <span className="flex-1" />
        {onCancel && <button type="button" onClick={onCancel} className={hcBtn.ghost}>Hætta við</button>}
        {last
          ? <button type="button" onClick={() => onSave(p)} disabled={saving} className={hcBtn.primary}>{saving ? "Vista…" : "Vista"}</button>
          : <button type="button" onClick={() => setStep(step + 1)} className={hcBtn.primary}>
              Næsta: {STEPS[step + 1]} <ArrowRight className="h-4 w-4" aria-hidden />
            </button>}
      </div>
    </section>
  );
}
