"use client";

// "Næring": the participant's nutrition programme with real meals from the
// meal library — a day of meals that fits the programme, each with its
// picture, protein and energy and the full recipe, and other meals to swap in.
// Picks are saved to hc_training_settings.meal_picks through onPick.

import { useEffect, useMemo, useRef, useState } from "react";
import Sheet from "./Sheet";
import { ArrowLeftRight, Check, ChevronDown, ChevronLeft, Clock, Info, Plus, Sliders, Utensils } from "lucide-react";
import { OPTIONAL_SLOTS, alternativesFor, dayFor, mealName, mealText, pickKey, SLOT_IS, SLOTS, weekFor, type Meal, type MealSlot } from "@/lib/hc/meals";
import { WEEKDAYS, WEEKDAYS_SHORT, weekdayOf } from "@/lib/hc/personalise";
import * as cache from "@/lib/hc/client-cache";
import type { ActionPlan } from "@/lib/hc/types";
import { ALLERGEN_OPTIONS, DIET_OPTIONS, EMPHASIS_IS, emphasisFor, type NutritionPrefs } from "@/lib/hc/nutrition";
import type { Signal } from "@/lib/hc/grunnheilsa";
import { FIBRE_TARGET, proteinTarget } from "@/lib/hc/nutrition-log";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
type PlanNutrition = NonNullable<ActionPlan["nutrition"]>;

export default function NutritionView({ api, nutrition, picks, onPick, onChangeProgram, prefs, onCustomise, signals, weightKg, onSelfWeight }: {
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
  /** Measured weight, or what they told us — whichever the page resolved. */
  weightKg?: number | null;
  /**
   * Save a weight they typed, where no measurement exists.
   *
   * Without this the protein target — the number the whole page is built
   * around — simply never appears on the coaching track.
   */
  onSelfWeight?: (kg: number) => void;
}) {
  const [meals, setMeals] = useState<Meal[] | null>(() => cache.peek<{ meals: Meal[] }>("/api/hc/library?kind=meals")?.body.meals ?? null);
  const [slotOpen, setSlotOpen] = useState<MealSlot | null>(null);
  // Which day of the week is on screen. Defaults to today, because that is
  // the one you are about to eat.
  const [todayIdx] = useState(() => weekdayOf(new Date()));
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const shownDay = pickedDay ?? todayIdx;
  const [recipe, setRecipe] = useState<Meal | null>(null);

  /*
   * The protein band, computed here.
   *
   * MealLogger used to work this out and report it upwards, which was fine
   * while it was on the page. It is gone with the checklist, and the band is
   * not its business anyway — the plan is built to land inside it, so the
   * page that builds the plan should own it. Same function MealLogger
   * called: 1,6-2,0 g per kilo.
   */
  const band = useMemo(() => proteinTarget(weightKg), [weightKg]);
  const targetG = band ? Math.round((band.min + band.max) / 2) : null;

  useEffect(() => {
    (async () => {
      const r = await cache.load(api, "/api/hc/library?kind=meals");
      if (r.status < 400) setMeals((r.body as { meals: Meal[] }).meals ?? []);
    })();
  }, [api]);

  const day = useMemo(() => (meals ? dayFor(meals, nutrition.key, picks, prefs, shownDay, targetG) : null), [meals, nutrition.key, picks, prefs, shownDay, targetG]);
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
  const [wInput, setWInput] = useState("");
  /** The sliding week. Its scroll position is its own, not React's. */
  const stripRef = useRef<HTMLDivElement | null>(null);
  const emphasis = prefs ? emphasisFor(signals ?? {}) : [];

  return (
    <div className="space-y-6">
      {/* No outer card.
          Æfingar is bare sections on the page background with its day cards
          sitting directly on it; Næring had everything inside one white
          panel, so every card within it was a card inside a card — the
          nesting Mads kept seeing. The page is sections now, like the other
          one, and the only cards are the things that really are cards. */}
      <section className="space-y-3">
        {/* The day, named — the heading Æfingar puts over its day card.
            A heading rather than a card header, because the card below is
            the thing and this is just its label. */}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {shownDay === todayIdx ? "Í dag" : WEEKDAYS[shownDay]}
          </h3>
          {pickedDay !== null && pickedDay !== todayIdx && (
            <button type="button" onClick={() => setPickedDay(null)} className="text-xs font-semibold text-lime-800 hover:underline">
              Fara aftur á daginn í dag
            </button>
          )}
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

              {/* No tick in this card.
                  The checklist at the foot of the page already carries every
                  slot's tick, and one of them repeated up here meant the
                  same meal could be ticked in two places — the card said
                  "what now", then asked you to confirm it in the middle of
                  saying it. */}
            </div>
          );
        })()}


      </section>

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
      <section className="space-y-3">
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
        {week && (
          <div className="mt-4">
            {/* No "Vikan" label and no "strjúktu til hliðar".
                The plan's name sits directly above with its pill, the row of
                weekdays under it is unmistakably a week, and a strip that
                slides tells you so the moment you touch it. Three lines of
                furniture for one card. */}
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

                    <ul className="space-y-2">
                      {SLOTS.filter((sl) => d[sl] || !OPTIONAL_SLOTS.includes(sl)).map((sl) => {
                        const m = d[sl];
                        return (
                          <li key={sl}>
                            {/* Shaped like the checklist at the foot of the
                                page: same radius, ring and padding, the slot
                                in small caps over the name, the numbers
                                right-aligned. Those rows are the one place
                                people already read a day of meals, so the
                                planner reads the same way instead of
                                inventing a second row style for the same
                                four facts.

                                The circle is a swap, not a tick. It sits
                                where the checklist's tick sits because that
                                is where the eye goes, and it is an outline
                                rather than a filled check so it cannot be
                                mistaken for "done" — ticking belongs to
                                today, and this card is any day of the week. */}
                            <button type="button"
                              onClick={() => { setPickedDay(i); setSlotOpen(sl); }}
                              aria-label={`${SLOT_IS[sl]}${m ? `: ${mealName(m)}` : ""} — skipta um máltíð ${WEEKDAYS[i].toLowerCase()}`}
                              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200 transition hover:ring-slate-300">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 text-slate-400 transition">
                                <ArrowLeftRight className="h-4 w-4" aria-hidden />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{SLOT_IS[sl]}</span>
                                <span className={`block truncate font-semibold ${m ? "text-slate-900" : "text-slate-400"}`}>
                                  {m ? mealName(m) : "Engin máltíð"}
                                </span>
                              </span>
                              {m && (
                                <span className="shrink-0 text-right text-xs text-slate-500">
                                  {m.protein != null && <span className="block font-semibold text-slate-700">{Math.round(Number(m.protein))} g</span>}
                                  {m.calories != null && <span className="block">{Math.round(Number(m.calories))} kkal</span>}
                                </span>
                              )}
                            </button>
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

      </section>

      {/* The checklist is gone, and with it meal logging.
          It was the only write path — part="bar" only ever displayed — so
          the "Dagurinn þinn" bar went with it rather than sit at 0 g of 4
          meals for ever with no way to move. Næring is the planner now:
          what is next, what the week holds, and whether it adds up.

          If ticking meals comes back it belongs on Í dag, beside the habit
          checklist, which is where "what did I actually do today" already
          lives. */}

      {/* The compact day list used to sit here, and the planner above now
          is that list — same meals, same slots, same swap, in the card that
          owns the day. Two of them was how this page got to three screens
          the first time. The logger directly above keeps the ticks, which
          is a different job: what was eaten, not what is planned. */}

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
                    t.fibre += Number(m.fibre_g) || 0;
                    if (m.fibre_g == null) t.noFibre += 1;
                  }
                  return t;
                }, { protein: 0, carbs: 0, fat: 0, kcal: 0, fibre: 0, noFibre: 0 });
                const per = (v: number) => Math.round(v / week.length);
                const prot = per(sum.protein);
                const rows: { label: string; got: number; unit: string; target: { min: number; max: number } | null }[] = [
                  { label: "Prótein", got: prot, unit: "g", target: band },
                  { label: "Trefjar", got: per(sum.fibre), unit: "g", target: FIBRE_TARGET },
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
                    {/* What the fibre number is, said plainly. It is
                        arithmetic over the recipe's own ingredients
                        (scripts/meal-fibre.py), not a laboratory figure, and
                        a handful of recipes could not be worked out at all —
                        so the week's total is a floor, not a verdict. */}
                    <p className="mt-2 text-xs text-slate-500">
                      Trefjar og næringargildi eru reiknuð út frá hráefnum uppskriftanna og eru því áætluð.
                      {sum.noFibre > 0 && " Nokkrar uppskriftir hafa ekki trefjagildi, svo talan getur verið lægri en raunin."}
                    </p>
                    {/* Where the target comes from, and how to get one.
                        This used to say the figure would appear "þegar þyngd
                        liggur fyrir" — from measurements that, on the
                        coaching track, are never going to be taken. So it
                        asks instead. */}
                    {!weightKg && onSelfWeight && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <label className="block text-sm font-semibold text-slate-700" htmlFor="self-weight">
                          Próteinmarkið reiknast af þyngd
                        </label>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Settu hana inn hér, eða láttu mælingarnar um það ef þú ferð í heilsufarsskoðun.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input id="self-weight" type="number" inputMode="decimal" min={30} max={300} step="0.5"
                            value={wInput} onChange={(e) => setWInput(e.target.value)}
                            placeholder="kg"
                            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lime-500/30" />
                          <button type="button"
                            disabled={!wInput.trim()}
                            onClick={() => { const v = Number(wInput.replace(",", ".")); if (Number.isFinite(v)) onSelfWeight(v); }}
                            className="rounded-full bg-hc-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                            Vista
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>

            {/* What the plan is holding to — the emphasis the report asked
                for and anything ruled out. Standing information, true all
                week, so it belongs with the programme rather than taking the
                room of a meal on the page you read every day. */}
            {(() => {
              const chips: { key: string; label: string; cls: string }[] = [
                ...emphasis.map((e) => ({
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
              return (
                <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Áherslur og það sem er sleppt</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {chips.map((c) => (
                      <span key={c.key} className={`rounded-full px-2.5 py-1 font-semibold ring-1 ${c.cls}`}>{c.label}</span>
                    ))}
                  </div>
                </section>
              );
            })()}

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
