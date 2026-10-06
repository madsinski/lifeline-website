"use client";

// "Næring": the participant's nutrition programme with real meals from the
// meal library — a day of meals that fits the programme, each with its
// picture, protein and energy and the full recipe, and other meals to swap in.
// Picks are saved to hc_training_settings.meal_picks through onPick.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, ChevronLeft, Clock, Info, Salad, Sliders, X } from "lucide-react";
import { dayFor, mealName, mealsFor, mealText, pickKey, SLOT_IS, SLOTS, weekFor, type Meal, type MealSlot } from "@/lib/hc/meals";
import { WEEKDAYS, WEEKDAYS_SHORT, weekdayOf } from "@/lib/hc/personalise";
import * as cache from "@/lib/hc/client-cache";
import type { ActionPlan } from "@/lib/hc/types";
import { DIET_OPTIONS, EMPHASIS_IS, emphasisFor, type NutritionPrefs } from "@/lib/hc/nutrition";
import type { Signal } from "@/lib/hc/grunnheilsa";
import MealLogger from "./MealLogger";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
type PlanNutrition = NonNullable<ActionPlan["nutrition"]>;

export default function NutritionView({ api, nutrition, picks, onPick, onChangeProgram, prefs, onCustomise, signals, weightKg }: {
  api: Api;
  nutrition: PlanNutrition;
  picks: Record<string, string>;
  onPick: (slot: MealSlot, mealId: string | null) => void;
  /** Opens the programme chooser, when the participant may change it. */
  onChangeProgram?: () => void;
  /** What they eat — restrictions are a hard filter on the library. */
  prefs?: NutritionPrefs;
  /** Opens "Hvað viltu breyta?"; when given, this page stops being editable. */
  onCustomise?: () => void;
  /** Planning lights, for naming the emphasis the report asks for. */
  signals?: Record<string, Signal | null>;
  /** From the report's þyngd row, for the protein target. */
  weightKg?: number | null;
}) {
  const [meals, setMeals] = useState<Meal[] | null>(() => cache.peek<{ meals: Meal[] }>("/api/hc/library?kind=meals")?.body.meals ?? null);
  const [slotOpen, setSlotOpen] = useState<MealSlot | null>(null);
  // Which day of the week is on screen. Defaults to today, because that is
  // the one you are about to eat.
  const [todayIdx] = useState(() => weekdayOf(new Date()));
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const shownDay = pickedDay ?? todayIdx;
  const [recipe, setRecipe] = useState<Meal | null>(null);
  // The band the protein bar measures against, reported up by MealLogger so
  // the plan is built to land inside it rather than to maximise protein.
  const [band, setBand] = useState<{ min: number; max: number } | null>(null);
  const onTarget = useCallback((t: { min: number; max: number } | null) => {
    setBand((prev) => (prev?.min === t?.min && prev?.max === t?.max ? prev : t));
  }, []);
  const targetG = band ? Math.round((band.min + band.max) / 2) : null;

  useEffect(() => {
    (async () => {
      const r = await cache.load(api, "/api/hc/library?kind=meals");
      if (r.status < 400) setMeals((r.body as { meals: Meal[] }).meals ?? []);
    })();
  }, [api]);

  const day = useMemo(() => (meals ? dayFor(meals, nutrition.key, picks, prefs, shownDay, targetG) : null), [meals, nutrition.key, picks, prefs, shownDay, targetG]);
  const today = useMemo(() => (meals ? dayFor(meals, nutrition.key, picks, prefs, todayIdx, targetG) : null), [meals, nutrition.key, picks, prefs, todayIdx, targetG]);
  const week = useMemo(() => (meals ? weekFor(meals, nutrition.key, picks, prefs, targetG) : null), [meals, nutrition.key, picks, prefs, targetG]);
  const emphasis = prefs ? emphasisFor(signals ?? {}) : [];
  const totals = day ? SLOTS.reduce((t, s) => ({ kcal: t.kcal + (day[s]?.calories ?? 0), protein: t.protein + (day[s]?.protein ?? 0) }), { kcal: 0, protein: 0 }) : null;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-lime-700 via-lime-600 to-emerald-500 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">Næringaráætlunin mín</p>
            <h2 className="mt-1 text-2xl font-bold">{nutrition.name}</h2>
          </div>
          {onChangeProgram && !onCustomise && (
            <button type="button" onClick={onChangeProgram} className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-lime-800 hover:bg-lime-50">Skipta um næringaráætlun</button>
          )}
        </div>
        {/* The emphasis and the day's protein are what this page is for. The
            goal sentence and the long description used to sit here too; they
            are in the disclosure at the end now. */}
        {emphasis.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {emphasis.slice(0, 3).map((e) => (
              <span key={e.emphasis} className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">{EMPHASIS_IS[e.emphasis].label}</span>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {totals && (
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">
              Á áætlun {shownDay === todayIdx ? "í dag" : WEEKDAYS[shownDay].toLowerCase()}: {Math.round(totals.protein)} g prótein · {Math.round(totals.kcal)} kkal
            </span>
          )}
          {!!prefs?.diet.length && (
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">
              {prefs.diet.map((k) => DIET_OPTIONS.find((d) => d.key === k)?.label.replace(/^Ég borða ekki /, "Ekkert ").replace(/^Ég borða /, "") ?? k).join(" · ")}
            </span>
          )}
        </div>
        {onCustomise && (
          <button type="button" onClick={onCustomise}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-bold text-lime-800 shadow-sm transition hover:bg-lime-50">
            <Sliders className="h-5 w-5" aria-hidden /> Breyta næringaráætluninni
          </button>
        )}
      </section>


      {today && <MealLogger day={today} weightKg={weightKg ?? null} onTarget={onTarget} />}

      {/* The week. Until now the plan was one day repeated for ever — the
          same four meals every day of the year — because a pick was stored
          per slot with no day attached. Each day steps down the ranked list,
          so the week is seven different days out of the same library. */}
      {week && (
        <section>
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Vikan þín</h3>
            <p className="text-xs text-slate-500">Kvöldmatur og prótein dagsins · ýttu á dag</p>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {week.map((d, i) => {
              const on = i === shownDay;
              return (
                <button key={i} type="button" onClick={() => setPickedDay(i)} aria-pressed={on}
                  aria-label={`${WEEKDAYS[i]}${i === todayIdx ? " (í dag)" : ""}`}
                  className={`flex min-h-[84px] flex-col gap-1 rounded-xl border p-1.5 text-left transition ${
                    on ? "border-lime-500 bg-lime-50" : i === todayIdx ? "border-lime-300 bg-white" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <span className={`text-center text-[11px] font-bold uppercase ${i === todayIdx ? "text-lime-800" : "text-slate-400"}`}>
                    {WEEKDAYS_SHORT[i]}
                  </span>
                  <span className="block flex-1 overflow-hidden text-[10px] leading-tight text-slate-700">
                    {d.dinner ? mealName(d.dinner) : "—"}
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-500">
                    {SLOTS.reduce((t, sl) => t + (d[sl]?.protein ?? 0), 0)} g
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {shownDay === todayIdx ? "Í dag" : WEEKDAYS[shownDay]}
          </h3>
          <p className="text-xs text-slate-500">Máltíðir úr uppskriftasafninu sem passa við áætlunina</p>
        </div>
        {!day && <p className="mt-3 text-sm text-slate-500">Hleð máltíðum…</p>}
        {day && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {SLOTS.map((slot) => {
              const m = day[slot];
              return (
                <div key={slot} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
                  {m ? (
                    <button type="button" onClick={() => setRecipe(m)} className="block w-full text-left">
                      <span className="relative block aspect-[16/9] bg-lime-50">
                        {m.illustration_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.illustration_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                          : <Salad className="absolute inset-0 m-auto h-10 w-10 text-lime-300" aria-hidden />}
                        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-bold text-lime-800">{SLOT_IS[slot]}</span>
                      </span>
                      <span className="block p-3">
                        <span className="block font-semibold leading-tight text-slate-900">{mealName(m)}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {[m.protein != null ? `${m.protein} g prótein` : null, m.calories != null ? `${m.calories} kkal` : null, m.prep_time_min ? `${m.prep_time_min + (m.cook_time_min ?? 0)} mín.` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                  ) : <p className="p-4 text-sm text-slate-500">{SLOT_IS[slot]}: engin máltíð fannst</p>}
                  <div className="flex items-center gap-3 border-t border-slate-100 px-3 py-2 text-xs font-semibold">
                    <button type="button" onClick={() => setSlotOpen(slot)} className="inline-flex items-center gap-1 text-lime-800 hover:underline">
                      <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Skipta
                    </button>
                    {(picks[pickKey(shownDay, slot)] ?? picks[slot]) && <button type="button" onClick={() => onPick(pickKey(shownDay, slot) as MealSlot, null)} className="text-slate-500 hover:text-slate-800">Tillaga áætlunarinnar</button>}
                    {m && <button type="button" onClick={() => setRecipe(m)} className="ml-auto text-slate-600 hover:text-slate-900">Uppskrift →</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {slotOpen && meals && (
        <Sheet title={`${SLOT_IS[slotOpen]} · ${shownDay === todayIdx ? "í dag" : WEEKDAYS[shownDay].toLowerCase()}`} onClose={() => setSlotOpen(null)}>
          <ul className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
            {mealsFor(meals, nutrition.key, slotOpen, prefs, targetG).slice(0, 18).map((m) => {
              const on = day?.[slotOpen]?.id === m.id;
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => { onPick(pickKey(shownDay, slotOpen) as MealSlot, m.id); setSlotOpen(null); }}
                    className={`w-full overflow-hidden rounded-2xl bg-white text-left ring-1 transition ${on ? "ring-2 ring-lime-600" : "ring-slate-200 hover:ring-lime-500"}`}>
                    <span className="relative block aspect-[4/3] bg-lime-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {m.illustration_url && <img src={m.illustration_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      {on && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-lime-600 text-white"><Check className="h-4 w-4" /></span>}
                    </span>
                    <span className="block p-2">
                      <span className="line-clamp-2 text-xs font-semibold leading-tight text-slate-900">{mealName(m)}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">{[m.protein != null ? `${m.protein} g prót.` : null, m.calories != null ? `${m.calories} kkal` : null].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Sheet>
      )}

      {recipe && <Recipe m={recipe} onClose={() => setRecipe(null)} />}
      {(nutrition.description || nutrition.goal || nutrition.principles.length > 0) && (
        <details className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-slate-800">
            <Info className="h-4 w-4 text-lime-700" aria-hidden />
            Um áætlunina — það sem skiptir mestu
            <ChevronDown className="ml-auto h-4 w-4 text-slate-400 transition group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3 space-y-4">
            {nutrition.goal && <p className="text-sm font-medium text-slate-800">{nutrition.goal}</p>}
            {nutrition.description && <p className="text-sm leading-relaxed text-slate-700">{nutrition.description}</p>}
            {nutrition.principles.length > 0 && (
              <ol className="grid gap-2 sm:grid-cols-2">
                {nutrition.principles.map((x, i) => (
                  <li key={i} className="flex gap-3 rounded-2xl border border-lime-100 bg-lime-50/40 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-100 text-sm font-bold text-lime-800">{i + 1}</span>
                    <span className="text-sm text-slate-700">{x}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <p className="min-w-0 flex-1 font-semibold text-slate-900">{title}</p>
          <button type="button" onClick={onClose} aria-label="Loka" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Recipe({ m, onClose }: { m: Meal; onClose: () => void }) {
  const t = mealText(m);
  return (
    <Sheet title={mealName(m)} onClose={onClose}>
      {m.illustration_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.illustration_url} alt="" className="aspect-[16/9] w-full object-cover" />
      )}
      <div className="space-y-4 p-4">
        {t.description && <p className="text-slate-700">{t.description}</p>}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[["Prótein", m.protein, "g"], ["Kolvetni", m.carbs, "g"], ["Fita", m.fat, "g"], ["Orka", m.calories, "kkal"]].map(([l, v, u]) => (
            <div key={l as string} className="rounded-xl bg-lime-50 px-1 py-2">
              <p className="text-base font-bold text-lime-900">{v ?? "–"}<span className="text-xs font-semibold"> {u}</span></p>
              <p className="text-[11px] text-lime-800">{l}</p>
            </div>
          ))}
        </div>
        {(m.prep_time_min || m.cook_time_min) && (
          <p className="flex items-center gap-1.5 text-sm text-slate-600"><Clock className="h-4 w-4" aria-hidden />Undirbúningur {m.prep_time_min ?? 0} mín.{m.cook_time_min ? ` · eldun ${m.cook_time_min} mín.` : ""}</p>
        )}
        {t.ingredients.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-900">Hráefni</h4>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">{t.ingredients.map((x, i) => <li key={i}>{x}</li>)}</ul>
          </div>
        )}
        {t.instructions.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-900">Aðferð</h4>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-700">{t.instructions.map((x, i) => <li key={i}>{x}</li>)}</ol>
          </div>
        )}
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600"><ChevronLeft className="h-4 w-4" />Til baka</button>
      </div>
    </Sheet>
  );
}
