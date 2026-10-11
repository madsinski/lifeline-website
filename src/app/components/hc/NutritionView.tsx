"use client";

// "Næring": the participant's nutrition programme with real meals from the
// meal library — a day of meals that fits the programme, each with its
// picture, protein and energy and the full recipe, and other meals to swap in.
// Picks are saved to hc_training_settings.meal_picks through onPick.

import { useCallback, useEffect, useMemo, useState } from "react";
import Sheet from "./Sheet";
import { ArrowLeftRight, Check, ChevronDown, ChevronLeft, Clock, Info, Salad, Sliders } from "lucide-react";
import { DragGhost, useDrag } from "./useDrag";
import { alternativesFor, dayFor, mealName, mealText, pickKey, SLOT_IS, SLOTS, weekFor, type Meal, type MealSlot } from "@/lib/hc/meals";
import { WEEKDAYS, WEEKDAYS_SHORT, weekdayOf } from "@/lib/hc/personalise";
import * as cache from "@/lib/hc/client-cache";
import type { ActionPlan } from "@/lib/hc/types";
import { ALLERGEN_OPTIONS, DIET_OPTIONS, EMPHASIS_IS, emphasisFor, type NutritionPrefs } from "@/lib/hc/nutrition";
import type { Signal } from "@/lib/hc/grunnheilsa";
import MealLogger from "./MealLogger";

type Api = (url: string, init?: RequestInit) => Promise<Response>;
type PlanNutrition = NonNullable<ActionPlan["nutrition"]>;

export default function NutritionView({ api, nutrition, picks, onPick, onPickMany, onChangeProgram, prefs, onCustomise, signals, weightKg }: {
  api: Api;
  nutrition: PlanNutrition;
  picks: Record<string, string>;
  onPick: (slot: MealSlot, mealId: string | null) => void;
  /**
   * Several picks in one save.
   *
   * A swap writes two days at once, and two onPick calls in the same tick
   * both read the same copy of meal_picks — so the second overwrote the
   * first and the meal was copied onto the target instead of trading
   * places with it. Measured: dragging Tuesday onto Monday left both days
   * eating Monday's dinner.
   */
  onPickMany?: (entries: [string, string | null][]) => void;
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
   * Drag a dinner onto another day to trade them.
   *
   * A move rather than a copy: a week has seven dinners and dropping
   * Thursday's onto Monday has to do something with Monday's, so the two
   * exchange places. Both ends are written as explicit per-day picks —
   * dayFor already reads picks[pickKey(day, slot)] before falling back to
   * the plan's own suggestion, so this is only a matter of saying what
   * each day holds now.
   *
   * Dinner only. It is the meal people actually plan around, the week row
   * shows it, and dragging a breakfast you cannot see is not a gesture
   * anyone would attempt.
   */
  const { drag, handle } = useDrag<{ day: number }>((payload, target) => {
    const to = Number(target.replace("nday:", ""));
    const from = payload.day;
    if (!Number.isInteger(to) || to === from || !week) return;
    const a = week[from]?.dinner ?? null;
    const b = week[to]?.dinner ?? null;
    const entries: [string, string | null][] = [
      [pickKey(to, "dinner"), a?.id ?? null],
      [pickKey(from, "dinner"), b?.id ?? null],
    ];
    if (onPickMany) { onPickMany(entries); return; }
    // No batch save available: do the half that matters rather than two
    // writes that race each other.
    if (a) onPick(pickKey(to, "dinner") as MealSlot, a.id);
  });
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
  const [weekOpen, setWeekOpen] = useState(false);
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
            {onCustomise && (
              <button type="button" onClick={onCustomise}
                className="inline-flex items-center gap-1.5 rounded-full border border-lime-200 px-3 py-1 text-sm font-semibold text-lime-800 transition hover:bg-lime-50">
                <Sliders className="h-3.5 w-3.5" aria-hidden /> Breyta
              </button>
            )}
          </div>
        </div>

        {/* One meal: the one you are about to eat.
            This block named today's dinner and then listed breakfast and
            lunch under it, and the three cards below drew all three again.
            Now it carries the next meal whole — picture, protein, and the
            recipe as the thing to tap — and the cards below are a compact
            list of the rest of the day.

            No calorie count here. The number that drives the plan is
            protein, the band is right underneath, and the one consistent
            warning in the research on these apps is that putting calories
            in front of people pulls attention to them "at the expense of
            nutrition". Energy stays on the recipe, where it informs rather
            than scores. */}
        {(() => {
          const m = day?.[nextSlot] ?? null;
          const label = shownDay === todayIdx ? SLOT_IS[nextSlot] : `${SLOT_IS[nextSlot]} · ${WEEKDAYS[shownDay].toLowerCase()}`;
          return (
            <div className="mt-4 overflow-hidden rounded-2xl bg-lime-600 text-white">
              <div className="flex items-stretch gap-3">
                {m?.illustration_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.illustration_url} alt="" loading="lazy" className="h-auto w-24 shrink-0 self-stretch object-cover sm:w-32" />
                ) : (
                  <span className="flex w-24 shrink-0 items-center justify-center bg-lime-700/40 sm:w-32" aria-hidden>
                    <Salad className="h-8 w-8 text-lime-200" />
                  </span>
                )}
                <div className="min-w-0 flex-1 py-3 pr-3">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-lime-100">{label}</p>
                  <p className="mt-0.5 font-bold leading-tight">
                    {m ? mealName(m) : day ? "Engin máltíð valin" : "Hleð máltíðum…"}
                  </p>
                  {m && (
                    <p className="mt-1 text-sm text-lime-50">
                      {[m.protein != null ? `${m.protein} g prótein` : null,
                        m.prep_time_min ? `${m.prep_time_min + (m.cook_time_min ?? 0)} mín.` : null]
                        .filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {m && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                      <button type="button" onClick={() => setRecipe(m)}
                        className="rounded-full bg-white px-3 py-1 text-lime-800 transition hover:bg-lime-50">
                        Uppskrift
                      </button>
                      <button type="button" onClick={() => setSlotOpen(nextSlot)}
                        className="inline-flex items-center gap-1 rounded-full bg-lime-700/60 px-3 py-1 text-white transition hover:bg-lime-700">
                        <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden /> Skipta
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* The bar, in the place the exercise hero keeps its stage. */}
        {today && (
          <div className="mt-3">
            <MealLogger day={today} weightKg={weightKg ?? null} part="bar" onTarget={onTarget} />
          </div>
        )}

        {/* The week, inside the hero as the exercise one has it — behind a
            tap, because seven rows is about a phone screen and "what is
            Thursday?" is not a question anyone has while deciding what to
            eat now. The button names the day on screen, so nothing is
            hidden without saying what. */}
        {week && (
          <div className="mt-4">
            <button type="button" onClick={() => setWeekOpen((v) => !v)} aria-expanded={weekOpen}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left transition hover:bg-slate-50">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Vikan</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-xs text-slate-500">
                  {weekOpen ? "Kvöldmatur · dragðu til að skipta" : `Sýnir ${shownDay === todayIdx ? "í dag" : WEEKDAYS[shownDay].toLowerCase()}`}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${weekOpen ? "rotate-180" : ""}`} aria-hidden />
              </span>
            </button>
          </div>
        )}
        {week && weekOpen && (
          <div className="mt-2">
            {/* Rows on a phone, the week as a grid from sm up.
                Seven columns inside 360px gives each day about 44px, and a
                meal called "Rauðar linsur í dal með hrísgrjónum" became
                "Rauð linsul í dal með hrísgr" stacked four lines deep —
                unreadable, and the same squeeze that made Æfingar print
                "Styrk". A full-width row has space for the real name.
                Same treatment as the training week, so the two pages read
                alike. */}
            <div className="flex flex-col sm:grid sm:grid-cols-7 sm:gap-1.5">
              {week.map((d, i) => {
                const on = i === shownDay;
                const protein = SLOTS.reduce((t, sl) => t + (d[sl]?.protein ?? 0), 0);
                return (
                  <button key={i} type="button" onClick={() => setPickedDay(i)} aria-pressed={on}
                    data-drop={`nday:${i}`}
                    {...(d.dinner ? handle({ day: i }, mealName(d.dinner)) : {})}
                    aria-label={`${WEEKDAYS[i]}${i === todayIdx ? " (í dag)" : ""}${d.dinner ? ` — ${mealName(d.dinner)}. Dragðu á annan dag til að skipta.` : ""}`}
                    className={`flex items-center gap-2 border-b border-slate-100 px-1 py-2 text-left transition last:border-b-0 sm:min-h-[84px] sm:flex-col sm:items-stretch sm:gap-1 sm:rounded-xl sm:border sm:p-1.5 ${
                      d.dinner ? "cursor-grab active:cursor-grabbing" : ""} ${
                      drag?.over === `nday:${i}` ? "bg-lime-100 sm:border-lime-400"
                        : on ? "bg-lime-50 sm:border-lime-500"
                        : i === todayIdx ? "bg-lime-50/60 sm:border-lime-300"
                        : "sm:border-slate-200 sm:bg-white sm:hover:border-slate-300"}`}>
                    <span className={`w-9 shrink-0 text-[11px] font-bold uppercase sm:w-auto sm:text-center ${i === todayIdx ? "text-lime-800" : "text-slate-400"}`}>
                      {WEEKDAYS_SHORT[i]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm leading-tight text-slate-700 sm:flex-initial sm:overflow-hidden sm:text-[10px] sm:whitespace-normal">
                      {d.dinner ? mealName(d.dinner) : "—"}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500 sm:text-[10px]">
                      {protein} g
                    </span>
                  </button>
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
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {shownDay === todayIdx ? "Dagurinn" : WEEKDAYS[shownDay]}
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

      <DragGhost drag={drag} />
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
