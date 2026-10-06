"use client";

// The top of "Í dag": what today holds at a glance — the workout, the meals,
// the goals and the next fræðsla — each one tap from the full view, and the
// plan's own controls (edit, print) where they are easy to find.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Dumbbell, Pencil, Printer, Target, Utensils } from "lucide-react";
import PillarIcon from "./PillarIcon";
import { dayFor, mealName, SLOT_IS, SLOTS, type Meal } from "@/lib/hc/meals";
import type { NutritionPrefs } from "@/lib/hc/nutrition";
import type { TrainingSettings } from "@/lib/hc/adaptive-program";
import ActivityIcon from "./ActivityIcon";
import { WEEKDAYS, weekdayOf, type PersonalExercise } from "@/lib/hc/personalise";
import { PILLAR_META, type ActionPlan, type LectureRef } from "@/lib/hc/types";
import * as cache from "@/lib/hc/client-cache";

type Api = (url: string, init?: RequestInit) => Promise<Response>;

const MO = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

export function TodayHeader({ name, onEdit }: { name: string | null; onEdit: () => void }) {
  const [now] = useState(() => new Date());
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-hc-brand-dark">{WEEKDAYS[weekdayOf(now)]} {now.getDate()}. {MO[now.getMonth()]}</p>
        <h1 className="text-2xl font-bold text-hc-ink sm:text-3xl">{name ? `Hæ ${name.split(" ")[0]}` : "Í dag"}</h1>
      </div>
      <button type="button" onClick={onEdit}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-hc-ink px-5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700">
        <Pencil className="h-4 w-4" aria-hidden /> Breyta áætluninni
      </button>
      <button type="button" onClick={() => window.print()} aria-label="Prenta áætlunina"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        <Printer className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Prenta</span>
      </button>
    </div>
  );
}

export default function TodayOverview({ api, plan, exercise, mealPicks, nutritionPrefs, training, lectures, onOpenExercise, onOpenNutrition, onEdit }: {
  api: Api;
  plan: ActionPlan;
  exercise: PersonalExercise | null;
  mealPicks: Record<string, string>;
  /** What they eat; restrictions are a hard filter on the meal library. */
  nutritionPrefs?: NutritionPrefs;
  /** Their own weekly commitments, so today shows everything Æfingar shows. */
  training?: TrainingSettings;
  lectures: (LectureRef & { completed?: boolean })[];
  onOpenExercise: (sessionId?: string) => void;
  onOpenNutrition: () => void;
  onEdit: () => void;
}) {
  const [today] = useState(() => weekdayOf(new Date()));
  const [meals, setMeals] = useState<Meal[] | null>(() => cache.peek<{ meals: Meal[] }>("/api/hc/library?kind=meals")?.body.meals ?? null);
  useEffect(() => {
    if (!plan.nutrition) return;
    (async () => {
      const r = await cache.load(api, "/api/hc/library?kind=meals");
      if (r.status < 400) setMeals((r.body as { meals: Meal[] }).meals ?? []);
    })();
  }, [api, plan.nutrition]);

  const todays = exercise?.sessions.filter((s) => s.weekday === today) ?? [];
  // "Í dag" showed only prescribed sessions, so a Monday football game — drawn
  // in the Æfingar week and counted when deciding what to prescribe — was
  // invisible on the surface people actually read.
  const myToday = (training?.activities ?? []).filter((a) => a.day === today);
  const next = exercise && !todays.length
    ? [...exercise.sessions].sort((a, b) => ((a.weekday - today + 7) % 7) - ((b.weekday - today + 7) % 7)).find((s) => s.weekday >= 0)
    : null;
  // The same restrictions as the Næring tab: a vegetarian must not be shown a
  // lamb casserole here either, which is the surface they actually read.
  // Today's meals, not Monday's: dayFor defaults to day 0, which would have
  // shown the same four meals here every day of the week.
  const day = useMemo(
    () => (meals && plan.nutrition ? dayFor(meals, plan.nutrition.key, mealPicks, nutritionPrefs, today) : null),
    [meals, plan.nutrition, mealPicks, nutritionPrefs, today]);
  const nextLecture = lectures.find((l) => !l.completed);
  const doneLectures = lectures.filter((l) => l.completed).length;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {exercise && (
          <button type="button" onClick={() => onOpenExercise(todays[0]?.id ?? next?.id)}
            className="flex flex-col rounded-3xl bg-gradient-to-br from-orange-500 to-amber-400 p-4 text-left text-white shadow-sm transition hover:shadow-md sm:p-5">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-white/85"><Dumbbell className="h-4 w-4" aria-hidden />{todays.length || myToday.length ? "Æfing dagsins" : "Hvíldardagur"}</span>
            {myToday.length > 0 && (
              <span className="mt-1 flex flex-wrap gap-1.5">
                {myToday.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-2.5 py-1 text-xs font-semibold">
                    <ActivityIcon name={a.name} className="h-3.5 w-3.5" />
                    {a.name}{a.at ? ` · ${a.at}` : ""}
                  </span>
                ))}
              </span>
            )}
            {todays.length ? todays.map((s) => (
              <span key={s.id} className="mt-1 block">
                <span className="block text-lg font-bold leading-tight">{s.title}{s.minutes ? ` · um ${s.minutes} mín.` : ""}</span>
                <span className="block truncate text-sm text-white/90">{s.items.filter((i) => (i.block ?? "main") === "main").map((i) => i.name).slice(0, 3).join(" · ")}</span>
              </span>
            )) : (
              <span className="mt-1 block text-sm text-white/95">
                {myToday.length ? "Þetta er það sem þú gerir í dag." : "Rösk ganga eða útivera telur samt."}
                {next ? <> Næst: <strong>{next.title}</strong>, {WEEKDAYS[next.weekday].toLowerCase()}.</> : null}
              </span>
            )}
            {todays[0]?.items.some((i) => i.image) && (
              <span className="mt-3 flex -space-x-2">
                {todays[0].items.filter((i) => i.image).slice(0, 5).map((i, k) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={k} src={i.image!} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white" />
                ))}
              </span>
            )}
            <span className="mt-auto pt-3 text-sm font-semibold">Opna æfinguna →</span>
          </button>
        )}

        {plan.nutrition && (
          <button type="button" onClick={onOpenNutrition}
            className="flex flex-col rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-lime-100 transition hover:ring-lime-300 sm:p-5">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-lime-700"><Utensils className="h-4 w-4" aria-hidden />Máltíðir dagsins</span>
            <span className="mt-1 block font-bold text-slate-900">{plan.nutrition.name}</span>
            {day ? (
              <span className="mt-2 grid grid-cols-4 gap-1.5">
                {SLOTS.map((slot) => {
                  const m = day[slot];
                  return (
                    <span key={slot} className="block min-w-0">
                      <span className="block aspect-square overflow-hidden rounded-xl bg-lime-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {m?.illustration_url && <img src={m.illustration_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-500">{SLOT_IS[slot]}</span>
                      <span className="block truncate text-[11px] text-slate-800">{m ? mealName(m) : "–"}</span>
                    </span>
                  );
                })}
              </span>
            ) : <span className="mt-2 block text-sm text-slate-500">Hleð…</span>}
            <span className="mt-auto pt-3 text-sm font-semibold text-lime-800">Sjá uppskriftir og skipta →</span>
          </button>
        )}
      </div>

      {(plan.goals?.length ?? 0) > 0 && (
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-hc-brand-dark" aria-hidden />
            <p className="flex-1 font-semibold text-slate-900">Markmiðin mín</p>
            <button type="button" onClick={onEdit} className="text-sm font-semibold text-hc-brand-dark hover:underline">Breyta</button>
          </div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {plan.goals.map((g, i) => (
              <li key={i} className="flex items-start gap-2 rounded-2xl px-3 py-2 text-sm" style={{ background: PILLAR_META[g.pillar].soft }}>
                <PillarIcon pillar={g.pillar} size="sm" />
                <span className="text-slate-800">{g.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* "Fræðslan mín" used to list every lecture here. It is a tab of its
          own now (/account/heilsuferd/fraedsla) — a list read once a week does
          not belong on the surface that is about today. What stays is the one
          lecture that is next. */}
      {nextLecture && (
        <Link href={`/account/heilsuferd/fraedsla/${nextLecture.slug}`}
          className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:ring-slate-300 sm:p-5">
          <BookOpen className="h-5 w-5 shrink-0 text-hc-brand-dark" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Næsta fræðsla</span>
            <span className="block font-semibold text-slate-900">{nextLecture.title}</span>
          </span>
          <span className="shrink-0 text-xs text-slate-500">{doneLectures}/{lectures.length}</span>
        </Link>
      )}
    </div>
  );
}
