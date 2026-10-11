"use client";

// "Næring": the participant's nutrition programme with real meals from the
// meal library — a day of meals that fits the programme, each with its
// picture, protein and energy and the full recipe, and other meals to swap in.
// Picks are saved to hc_training_settings.meal_picks through onPick.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sheet from "./Sheet";
import { ArrowLeftRight, Check, ChevronDown, ChevronLeft, Clock, Info, Plus, Salad, Sliders, Utensils } from "lucide-react";
import { OPTIONAL_SLOTS, alternativesFor, dayFor, mealName, mealText, pickKey, SLOT_IS, SLOTS, weekFor, type Meal, type MealSlot } from "@/lib/hc/meals";
import { WEEKDAYS, WEEKDAYS_SHORT, weekdayOf } from "@/lib/hc/personalise";
import * as cache from "@/lib/hc/client-cache";
import type { ActionPlan } from "@/lib/hc/types";
import { ALLERGEN_OPTIONS, DIET_OPTIONS, EMPHASIS_IS, emphasisFor, type NutritionPrefs } from "@/lib/hc/nutrition";
import type { Signal } from "@/lib/hc/grunnheilsa";
import MealLogger from "./MealLogger";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
type PlanNutrition = NonNullable<ActionPlan["nutrition"]>;

export default function NutritionView({ api, nutrition, picks, onPick, onChangeProgram, prefs, onCustomise, signals, weightKg }: {
  api: Api;
  nutrition: PlanNutrition;
  picks: Record<string, string>;
  onPick: (slot: MealSlot, mealId: string | null) => void;
  /**
   * One pick, saved.
   *
   * Note for anyone adding a second write: two onPick calls in the same
   * tick both start from the same copy of meal_picks, so the second
   * discards the first. The old day-to-day swap wrote two keys and needed a
   * batch save for exactly that reason. Anything that touches two slots at
   * once needs one save, not two calls.
   */
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

  /*
   * The meal you are about to eat, by the clock.
   *
   * The page used to open on all three of today's meals at once, named in
   * the hero and then drawn again below as three big cards — the same three
   * meals twice, which is most of why it ran to three screens. One meal is
   * the honest answer to "what now": at half eight it is breakfast, and
   * dinner is not a decision anyone needs in front of them yet.
   *
   * Read once on mount rather than live. It only decides which card opens
   * first, and a card that reshuffles itself at 15:00 while somebody is
   * reading it would be worse than one that is an hour stale.
   */
  const [nextSlot] = useState<MealSlot>(() => {
    const h = new Date().getHours();
    return h < 10 ? "breakfast" : h < 15 ? "lunch" : "dinner";
  });
  /*
   * The week starts closed.
   *
   * Seven rows is about a screen on a phone, and it answers a question
   * ("what is Thursday?") that nobody has while deciding what to eat now.
   * Opening it is one tap, and the day you are looking at is named on the
   * button, so nothing is hidden without saying so.
   */
  /** The næsta-máltíð card's detail, as Æfingar keeps its guide. */
  const [headOpen, setHeadOpen] = useState(false);
  /** The Prógrammið sleeve. */
  const [detail, setDetail] = useState(false);
  /** The sliding week. Its scroll position is its own, not React's. */
  const stripRef = useRef<HTMLDivElement | null>(null);
  const emphasis = prefs ? emphasisFor(signals ?? {}) : [];

  return (
    <div className="space-y-6">
      {/* The hero, built like the exercise one: a white card with the next
          thing to do in solid colour, the protein bar where that one has its
          stage bar, and the week inside it rather than as a section below.
          The gradient panel it replaced carried the programme name, some
          chips and little else. */}
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        {/* The name and the way in on one line, as on Æfingar.
            The kicker was "N Æ R I N G A R Á Æ T L U N I N   M Í N" at
            0.18em — twenty letters of Icelandic compound pulled apart —
            above a heading that already says which plan this is, with the
            Breyta button orphaned on a line of its own below. */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-lime-700">Áætlunin mín</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 className="min-w-0 text-2xl font-bold text-slate-900">{nutrition.name}</h2>
            {onChangeProgram && !onCustomise && (
              <button type="button" onClick={onChangeProgram} className="rounded-full border border-lime-200 px-3 py-1 text-sm font-semibold text-lime-800 hover:bg-lime-50">Skipta um næringaráætlun</button>
            )}
            {/* Was a full-width 816×48 block at the end of the page. The page
                is for what to eat; changing the plan is the rarer errand. */}
            {/* One pill, one sleeve — the same shape Æfingar gives
                "Prógrammið": where am I, how is the week, what do I change,
                in the order you would ask. */}
            <button type="button" onClick={() => setDetail(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-lime-100 px-3 py-1 text-sm font-semibold text-lime-900 ring-1 ring-lime-200 transition hover:bg-lime-200">
              <Sliders className="h-3.5 w-3.5" aria-hidden /> Prógrammið
            </button>
          </div>
        </div>

        {/* ── Næsta máltíð ────────────────────────────────────────────
            The same card Æfingar gives the day's session: a tile, an
            eyebrow saying which meal and whether it is today, the name,
            the time it takes, the detail behind a header dropdown, and one
            solid action along the bottom.

            The detail is in the dropdown rather than on the face because
            the face answers "what am I eating"; the macros answer "is that
            alright", which is a different question and a later one. */}
        {(() => {
          const m = day?.[nextSlot] ?? null;
          const mins = m ? (m.prep_time_min ?? 0) + (m.cook_time_min ?? 0) : 0;
          const isToday = shownDay === todayIdx;
          return (
            <div className={`mt-4 overflow-hidden rounded-3xl bg-white ring-1 transition ${
              isToday ? "ring-2 ring-lime-500" : "ring-slate-200"}`}>
              <button type="button" onClick={() => setHeadOpen((v) => !v)} aria-expanded={headOpen}
                className="flex w-full items-center gap-3 p-4 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime-100 text-lime-800">
                  <Utensils className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.1em] text-lime-700">
                    {SLOT_IS[nextSlot]}{isToday ? " · í dag" : ` · ${WEEKDAYS[shownDay].toLowerCase()}`}
                  </span>
                  <span className="block font-bold leading-tight text-slate-900">
                    {m ? mealName(m) : day ? "Engin máltíð valin" : "Hleð…"}
                  </span>
                  {m && (
                    <span className="mt-0.5 block text-sm text-slate-500">
                      {[m.protein != null ? `${Math.round(Number(m.protein))} g prótein` : null,
                        mins ? `${mins} mín.` : null].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${headOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>

              {headOpen && m && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-4 pb-4 pt-3.5">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {([["Prótein", m.protein, "g"], ["Kolvetni", m.carbs, "g"],
                       ["Fita", m.fat, "g"], ["Orka", m.calories, "kkal"]] as const).map(([label, v, unit]) => (
                      <div key={label} className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                        <p className="text-sm font-bold tabular-nums text-slate-900">
                          {v != null ? Math.round(Number(v)) : "—"}<span className="text-[10px] font-normal text-slate-500"> {unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                  {mealText(m).description && (
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{mealText(m).description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                    <button type="button" onClick={() => setRecipe(m)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">
                      Uppskriftin
                    </button>
                    <button type="button" onClick={() => setSlotOpen(nextSlot)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-lime-200 px-3 py-1.5 text-lime-800 hover:bg-lime-50">
                      <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Skipta um máltíð
                    </button>
                  </div>
                </div>
              )}

              {/* The tick, which is MealLogger's write — not a second copy
                  of it living in this card. */}
              {today && isToday && day?.[nextSlot] && (
                <div className="border-t border-slate-100 p-3">
                  <MealLogger day={today} weightKg={weightKg ?? null} part="list" only={nextSlot} />
                </div>
              )}
            </div>
          );
        })()}

        {/* The bar, in the place the exercise hero keeps its stage. */}
        {today && (
          <div className="mt-3">
            <MealLogger day={today} weightKg={weightKg ?? null} part="bar" onTarget={onTarget} />
          </div>
        )}

        {/* ── The planner ─────────────────────────────────────────────
            One day at a time, sliding sideways — the meal equivalent of
            the exercise week, and the reason it is not a seven-row list
            any more. A day of meals is four or five lines; seven of those
            is a screen and a half of vertical scrolling to answer "what is
            Thursday", and the answer you actually want is one day wide.

            Scroll-snap rather than a carousel library: the browser already
            does momentum, snapping and the trackpad, and it keeps working
            when JavaScript is busy. Each day is its own snap target, the
            strip is the only thing that scrolls, and the page behind it
            does not move.

            One detail worth keeping: scroll position is not state here.
            The strip owns where it is, and the day buttons above scroll it
            rather than re-render it, so a swipe never fights a setState. */}
        {week && (
          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Vikan</p>
              <p className="text-[11px] text-slate-400">Strjúktu til hliðar</p>
            </div>

            {/* The days, as a row of taps that move the strip. */}
            <div className="mb-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {WEEKDAYS_SHORT.map((lbl, i) => (
                <button key={i} type="button"
                  onClick={() => {
                    setPickedDay(i);
                    stripRef.current?.children[i]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                  }}
                  aria-pressed={i === shownDay}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase transition ${
                    i === shownDay ? "bg-lime-600 text-white"
                      : i === todayIdx ? "bg-lime-50 text-lime-800 ring-1 ring-lime-200"
                      : "text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
                  {lbl}
                </button>
              ))}
            </div>

            <div ref={stripRef}
              onScroll={(e) => {
                /* Which day is centred, read off the strip rather than
                   driven into it. */
                const el = e.currentTarget;
                const i = Math.round(el.scrollLeft / el.clientWidth);
                if (i !== shownDay && i >= 0 && i < 7) setPickedDay(i);
              }}
              className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {week.map((d, i) => {
                const protein = SLOTS.reduce((t, sl) => t + (d[sl]?.protein ?? 0), 0);
                const low = band && protein < band.min;
                return (
                  <div key={i} data-drop={`nday:${i}`}
                    className={`w-full shrink-0 snap-center rounded-2xl p-2.5 ring-1 transition ${i === todayIdx ? "bg-lime-50/60 ring-lime-300" : "bg-white ring-slate-200"}`}>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {WEEKDAYS[i]}{i === todayIdx ? " · í dag" : ""}
                      </p>
                      <p className={`text-xs font-bold tabular-nums ${low ? "text-amber-700" : "text-slate-500"}`}>
                        {protein} g prótein
                      </p>
                    </div>

                    <ul className="space-y-1">
                      {SLOTS.filter((sl) => d[sl] || !OPTIONAL_SLOTS.includes(sl)).map((sl) => {
                        const m = d[sl];
                        return (
                          <li key={sl}>
                            <div className="flex items-center gap-2 rounded-xl bg-white/80 px-2 py-1.5 ring-1 ring-slate-100">
                              <span className="w-16 shrink-0 text-[10px] font-bold uppercase leading-tight text-slate-400">
                                {SLOT_IS[sl]}
                              </span>
                              {m ? (
                                <button type="button" onClick={() => setRecipe(m)}
                                  className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-slate-800 hover:underline">
                                  {mealName(m)}
                                </button>
                              ) : <span className="min-w-0 flex-1 text-xs text-slate-400">—</span>}
                              <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                                {m?.protein != null ? `${Math.round(Number(m.protein))}g` : ""}
                              </span>
                              <button type="button" onClick={() => { setPickedDay(i); setSlotOpen(sl); }}
                                aria-label={`Skipta um ${SLOT_IS[sl].toLowerCase()} ${WEEKDAYS[i].toLowerCase()}`}
                                className="shrink-0 rounded-full p-1 text-lime-700 transition hover:bg-lime-50">
                                <ArrowLeftRight className="h-3 w-3" aria-hidden />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {/* A second millimál, if this day wants one. The pick is
                        the state — choosing a meal makes the slot exist and
                        clearing it takes it away — so there is no setting
                        that can disagree with what is on the plate. */}
                    {!d.snack2 ? (
                      <button type="button" onClick={() => { setPickedDay(i); setSlotOpen("snack2"); }}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-lime-400 hover:text-lime-800">
                        <Plus className="h-3 w-3" aria-hidden /> Millimál
                      </button>
                    ) : (
                      <button type="button" onClick={() => onPick(pickKey(i, "snack2") as MealSlot, null)}
                        className="mt-1.5 text-[11px] font-semibold text-slate-400 transition hover:text-slate-700">
                        Fjarlægja millimál 2
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* What this plan is holding to: the emphasis the report asked for
            and anything ruled out. Smaller, and on one line that counts its
            overflow instead of wrapping to three — it is standing
            information, true all week, and it was taking the room of a
            meal. Tapping any of it opens the same settings as Breyta. */}
        {(() => {
          const chips: { key: string; label: string; cls: string }[] = [
            ...emphasis.slice(0, 2).map((e) => ({
              key: `e:${e.emphasis}`, label: EMPHASIS_IS[e.emphasis].label,
              cls: "bg-lime-50 text-lime-900 ring-lime-200",
            })),
            ...(prefs?.diet ?? []).map((k) => ({
              key: `d:${k}`,
              label: DIET_OPTIONS.find((d) => d.key === k)?.label.replace(/^Ég borða ekki /, "Ekkert ").replace(/^Ég borða /, "") ?? k,
              cls: "text-slate-700 ring-slate-200",
            })),
            ...(prefs?.avoid ?? []).map((k) => ({
              key: `a:${k}`,
              label: `Ekkert ${(ALLERGEN_OPTIONS.find((a) => a.key === k)?.label ?? k).toLowerCase().replace(/ \(.*\)$/, "")}`,
              cls: "bg-rose-50 text-rose-900 ring-rose-200",
            })),
          ];
          if (chips.length === 0) return null;
          const shown = chips.slice(0, 3);
          const rest = chips.length - shown.length;
          return (
            <div className="mt-3 flex items-center gap-1.5 overflow-hidden text-xs">
              {shown.map((c) => (
                <span key={c.key} className={`shrink-0 truncate rounded-full px-2.5 py-0.5 font-semibold ring-1 ${c.cls}`}>{c.label}</span>
              ))}
              {rest > 0 && (
                <button type="button" onClick={onCustomise ?? onChangeProgram}
                  className="shrink-0 rounded-full px-2 py-0.5 font-semibold text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50">
                  +{rest}
                </button>
              )}
            </div>
          );
        })()}

      </section>

      {today && <MealLogger day={today} weightKg={weightKg ?? null} part="list" />}

      {/* The rest of the day.
          These were three cards each with a 16:9 picture — about 600px of
          the 2600 the page ran to, for meals that are mostly not the next
          thing anyone is going to eat. A row with a thumbnail says the same
          (which meal, how much protein, how long) and the next meal still
          gets its picture up in the hero. Every action survives: the
          recipe, the swap, and putting the plan's own suggestion back.

          The one being eaten next is marked rather than repeated, so the
          day still reads as a whole. */}
      <section>
        <div className="flex items-baseline justify-between">
          {/* Not "Dagurinn": the logger directly above this already says
              "Dagurinn þinn", and two headings of the same name in a row
              read as a mistake. This one lists the meals; that one counts
              what has been eaten. */}
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {shownDay === todayIdx ? "Máltíðir dagsins" : `Máltíðir · ${WEEKDAYS[shownDay].toLowerCase()}`}
          </h3>
          <p className="text-xs text-slate-500">Úr uppskriftasafninu</p>
        </div>
        {!day && <p className="mt-3 text-sm text-slate-500">Hleð máltíðum…</p>}
        {day && (
          <ul className="mt-2 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            {SLOTS.map((slot) => {
              const m = day[slot];
              const isNext = slot === nextSlot && shownDay === todayIdx;
              return (
                <li key={slot} className="border-b border-slate-100 last:border-b-0">
                  <div className={`flex items-center gap-3 p-2.5 ${isNext ? "bg-lime-50/70" : ""}`}>
                    {m?.illustration_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.illustration_url} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-lime-50" aria-hidden>
                        <Salad className="h-5 w-5 text-lime-300" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {SLOT_IS[slot]}
                        {isNext && <span className="rounded-full bg-lime-600 px-1.5 py-0.5 text-[10px] text-white">næst</span>}
                      </p>
                      {m ? (
                        <>
                          <button type="button" onClick={() => setRecipe(m)}
                            className="block max-w-full truncate text-left font-semibold leading-tight text-slate-900 hover:underline">
                            {mealName(m)}
                          </button>
                          <p className="truncate text-xs text-slate-500">
                            {[m.protein != null ? `${m.protein} g prótein` : null,
                              m.calories != null ? `${m.calories} kkal` : null,
                              m.prep_time_min ? `${m.prep_time_min + (m.cook_time_min ?? 0)} mín.` : null]
                              .filter(Boolean).join(" · ")}
                          </p>
                        </>
                      ) : <p className="text-sm text-slate-500">engin máltíð fannst</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold">
                      <button type="button" onClick={() => setSlotOpen(slot)}
                        className="inline-flex items-center gap-1 rounded-full border border-lime-200 px-2.5 py-1 text-lime-800 transition hover:bg-lime-50">
                        <ArrowLeftRight className="h-3 w-3" aria-hidden /> Skipta
                      </button>
                      {(picks[pickKey(shownDay, slot)] ?? picks[slot]) && (
                        <button type="button" onClick={() => onPick(pickKey(shownDay, slot) as MealSlot, null)}
                          className="text-[11px] font-normal text-slate-500 hover:text-slate-800">
                          Tillaga áætlunarinnar
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Prógrammið ──────────────────────────────────────────────
          What the plan is, and the question the page cannot answer on its
          face: do these meals actually add up?

          Measured against the plan, not against what was eaten. The plan is
          what this sleeve can be held responsible for — whether somebody
          ate it is in the log, and mixing the two would let a week read as
          a success because it was well planned. */}
      {detail && week && (
        <Sheet title="Prógrammið" onClose={() => setDetail(false)} canvas>
          <div className="space-y-3 p-3">
            <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Áætlunin</p>
              <h3 className="mt-0.5 text-lg font-bold text-slate-900">{nutrition.name}</h3>
              {nutrition.principles?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {nutrition.principles.map((pr, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-600">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-600" aria-hidden />
                      <span>{pr}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* The macro verdict. An average day across the seven, because
                one day under is normal and a week under is the thing worth
                knowing. */}
            <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Meðaldagur í vikunni</p>
              {(() => {
                const sum = week.reduce((t, d) => {
                  for (const sl of SLOTS) {
                    const m = d[sl];
                    if (!m) continue;
                    t.protein += Number(m.protein) || 0;
                    t.carbs += Number(m.carbs) || 0;
                    t.fat += Number(m.fat) || 0;
                    t.kcal += Number(m.calories) || 0;
                  }
                  return t;
                }, { protein: 0, carbs: 0, fat: 0, kcal: 0 });
                const per = (v: number) => Math.round(v / week.length);
                const prot = per(sum.protein);
                const rows: { label: string; got: number; unit: string; target: { min: number; max: number } | null }[] = [
                  { label: "Prótein", got: prot, unit: "g", target: band },
                  { label: "Kolvetni", got: per(sum.carbs), unit: "g", target: null },
                  { label: "Fita", got: per(sum.fat), unit: "g", target: null },
                  { label: "Orka", got: per(sum.kcal), unit: "kkal", target: null },
                ];
                return (
                  <div className="mt-2 space-y-2">
                    {rows.map((r) => {
                      const under = r.target && r.got < r.target.min;
                      const over = r.target && r.got > r.target.max;
                      const pct = r.target ? Math.min(100, Math.round((r.got / r.target.max) * 100)) : null;
                      return (
                        <div key={r.label}>
                          <div className="flex items-baseline justify-between text-sm">
                            <span className="font-semibold text-slate-700">{r.label}</span>
                            <span className="tabular-nums text-slate-600">
                              <strong className={under ? "text-amber-700" : over ? "text-slate-900" : "text-lime-700"}>{r.got}</strong>
                              <span className="text-slate-400"> {r.unit}</span>
                              {r.target && <span className="text-xs text-slate-400"> · mark {r.target.min}–{r.target.max}</span>}
                            </span>
                          </div>
                          {pct != null && (
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${under ? "bg-amber-400" : "bg-lime-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Said plainly, once. A bar that is short tells you
                        something is off; it does not tell you what to do. */}
                    {band && prot < band.min && (
                      <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        Máltíðirnar í vikunni skila að meðaltali {prot} g próteini á dag, undir markinu {band.min}–{band.max} g.
                        Skiptu einhverri máltíð út fyrir próteinríkari — þær sem eru efst í „Skipta“ eru valdar eftir próteini.
                      </p>
                    )}
                    {/* Fibre is missing on purpose, not forgotten: the meals
                        table has protein, carbs and fat on all 164 rows and
                        no fibre column at all. A bar reading 0 g against a
                        25–35 g target would tell every single person their
                        plan fails on fibre, which is a claim about their food
                        that we cannot make. */}
                    <p className="mt-2 text-xs text-slate-500">
                      Trefjar eru ekki í næringargildum uppskriftasafnsins og eru því ekki taldar hér.
                    </p>
                    {!weightKg && (
                      <p className="mt-2 text-xs text-slate-500">
                        Próteinmarkið reiknast af þyngd úr mælingunum. Það birtist þegar þyngd liggur fyrir.
                      </p>
                    )}
                  </div>
                );
              })()}
            </section>

            {onCustomise && (
              <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Breyta</p>
                <p className="mt-1 text-sm text-slate-600">Áherslur, mataræði og það sem þú vilt sleppa.</p>
                <button type="button" onClick={() => { setDetail(false); onCustomise(); }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-hc-ink px-4 py-2 text-sm font-semibold text-white">
                  <Sliders className="h-3.5 w-3.5" aria-hidden /> Breyta áætluninni
                </button>
              </section>
            )}

            {onChangeProgram && (
              <button type="button" onClick={() => { setDetail(false); onChangeProgram(); }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Skipta um næringaráætlun
              </button>
            )}
          </div>
        </Sheet>
      )}

      {slotOpen && meals && (
        <Sheet title={`${SLOT_IS[slotOpen]} · ${shownDay === todayIdx ? "í dag" : WEEKDAYS[shownDay].toLowerCase()}`} onClose={() => setSlotOpen(null)}>
          {/* The near ones first, and said so.
              This was one ungrouped list of eighteen in the library's own
              order, so a 40 g dinner sat next to a 12 g one with nothing to
              tell them apart — and protein is the number the plan is held
              to. The first group lands within 8 g of what it replaces. */}
          {(() => {
            const alts = alternativesFor(day?.[slotOpen] ?? null, meals, nutrition.key, slotOpen, prefs, targetG, shownDay);
            return alts.near.length > 0 ? (
              <p className="px-3 pt-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Svipað og núverandi
              </p>
            ) : null;
          })()}
          <ul className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
            {(() => {
              const alts = alternativesFor(day?.[slotOpen] ?? null, meals, nutrition.key, slotOpen, prefs, targetG, shownDay);
              return [...alts.near, ...alts.rest].slice(0, 18);
            })().map((m) => {
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
        <details className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
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

/* The local Sheet that stood here had the same contract as the shared one
   — title, onClose, children — and none of its behaviour: no animation, no
   drag, and a scroll lock added only last week. Deleted in favour of
   ./Sheet, which the two call sites below use unchanged apart from asking
   for the wider panel this one had. */

function Recipe({ m, onClose }: { m: Meal; onClose: () => void }) {
  const t = mealText(m);
  return (
    <Sheet title={mealName(m)} onClose={onClose} max="max-w-3xl">
      {m.illustration_url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.illustration_url} alt="" className="aspect-[16/9] w-full object-cover" />
          {/* Some licences require the photographer to be named. Ours do not,
              so this is empty today — but a picture that needs a credit and
              does not carry one is a licence breach, not a missing nicety. */}
          {m.illustration_credit && (
            <p className="px-4 pt-1 text-[11px] text-slate-400">Mynd: {m.illustration_credit}</p>
          )}
        </>
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
