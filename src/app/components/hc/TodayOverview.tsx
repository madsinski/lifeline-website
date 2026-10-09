"use client";

// The top of "Í dag": what today holds at a glance — the workout, the meals,
// the goals and the next fræðsla — each one tap from the full view, and the
// plan's own controls (edit, print) where they are easy to find.

import { useState } from "react";
import { Dumbbell, Target } from "lucide-react";
import PillarIcon from "./PillarIcon";
import type { TrainingSettings } from "@/lib/hc/adaptive-program";
import ActivityIcon from "./ActivityIcon";
import { WEEKDAYS, weekdayOf, type PersonalExercise } from "@/lib/hc/personalise";
import { PILLAR_META, type ActionPlan } from "@/lib/hc/types";


const MO = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

export function TodayHeader({ name, right }: { name: string | null; right?: React.ReactNode }) {
  const [now] = useState(() => new Date());
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-hc-brand-dark">{WEEKDAYS[weekdayOf(now)]} {now.getDate()}. {MO[now.getMonth()]}</p>
        <h1 className="text-2xl font-bold text-hc-ink sm:text-3xl">{name ? `Hæ ${name.split(" ")[0]}` : "Í dag"}</h1>
      </div>
      {/* The notification strip sits here, on the same line as the
          greeting, because that is the first line anybody reads. */}
      {right}
      {/* "Breyta áætluninni" and "Prenta" were here. Editing is reachable
          from the checklist below and from Breytingar on Æfingar; printing a
          plan nobody prints was two taps of chrome at the top of the page
          people open to tick one thing off. */}
    </div>
  );
}

export default function TodayOverview({ plan, exercise, training, onOpenExercise, onEdit, aside }: {
  plan: ActionPlan;
  exercise: PersonalExercise | null;
  /** What they eat; restrictions are a hard filter on the meal library. */
  /** Their own weekly commitments, so today shows everything Æfingar shows. */
  training?: TrainingSettings;
  onOpenExercise: (sessionId?: string) => void;
  /**
   * The card beside the workout. "Máltíðir dagsins" sat here; the meals are
   * a tab of their own and what belongs next to today's session is how the
   * week is actually going.
   */
  aside?: React.ReactNode;
  onEdit: () => void;
}) {
  const [today] = useState(() => weekdayOf(new Date()));
  // The meal library was fetched here to draw "Máltíðir dagsins". That card
  // moved out, and so did the request — Í dag was loading the whole meal
  // library on every open for a card it no longer shows.

  const todays = exercise?.sessions.filter((s) => s.weekday === today) ?? [];
  // "Í dag" showed only prescribed sessions, so a Monday football game — drawn
  // in the Æfingar week and counted when deciding what to prescribe — was
  // invisible on the surface people actually read.
  const myToday = (training?.activities ?? []).filter((a) => a.day === today);
  /**
   * Tomorrow, specifically — not "the next session", which could be four
   * days away and reads as a promise about a day nobody is thinking about.
   * Tomorrow is the one you can still plan around tonight.
   */
  const tomorrowIdx = (today + 1) % 7;
  const tomorrow = [
    ...(exercise?.sessions ?? []).filter((s) => s.weekday === tomorrowIdx).map((s) => s.title),
    ...(training?.activities ?? []).filter((a) => a.day === tomorrowIdx).map((a) => a.name),
  ];
  // The same restrictions as the Næring tab: a vegetarian must not be shown a
  // lamb casserole here either, which is the surface they actually read.
  // Today's meals, not Monday's: dayFor defaults to day 0, which would have
  // shown the same four meals here every day of the week.

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {exercise && (
          <button type="button" onClick={() => onOpenExercise(todays[0]?.id)}
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
                {myToday.length ? null : "Rösk ganga eða útivera telur samt."}
              </span>
            )}
            {/* Tomorrow as a chip — the same treatment as the Æfingar hero,
                so the two pages read alike. */}
            <span className="mt-2 inline-flex w-fit max-w-full items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/25">
              <span className="opacity-80">Á morgun</span>
              <span className="truncate">{tomorrow.length ? tomorrow.join(" + ") : "hvíld"}</span>
            </span>
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

        {/* The meals card stood here. Today's food lives on the Næring tab,
            and the slot beside the workout is better spent on whether the
            week is actually going — the thing the person came to check. */}
        {aside}
      </div>

      {(plan.goals?.length ?? 0) > 0 && (
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
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

      {/* The "Næsta fræðsla" card was here. Í dag is the page people open
          to tick things off; a lecture is a weekend thing, and it has its
          own tab. Taken out so the daily surface is only today. */}
    </div>
  );
}
