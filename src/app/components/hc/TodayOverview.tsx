"use client";

// The top of "Í dag": what today holds at a glance — the workout, the meals,
// the goals and the next fræðsla — each one tap from the full view, and the
// plan's own controls (edit, print) where they are easy to find.

import { useState } from "react";
import { ChevronRight, Dumbbell, Target } from "lucide-react";
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

export default function TodayOverview({ plan, exercise, training, onOpenExercise, onEdit, people }: {
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
  /**
   * The face in the hero's corner, opening you-and-your-partner.
   *
   * A sibling rather than a child: the hero is itself a button, and a
   * button inside a button is invalid and unclickable in roughly that
   * order.
   */
  people?: React.ReactNode;
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
   * Everything happening today, prescribed or their own.
   *
   * The hero had these as two different shapes — a heading for a session
   * and a chip for an activity — which made the card's prominence depend
   * on which kind of day it was. To the person doing it, it is one thing:
   * what am I doing today.
   */
  const todayItems = [
    ...todays.map((s) => ({
      key: s.id,
      sessionId: s.id as string | undefined,
      title: `${s.title}${s.minutes ? ` · um ${s.minutes} mín.` : ""}`,
      sub: s.items.filter((i) => (i.block ?? "main") === "main").map((i) => i.name).slice(0, 3).join(" · "),
    })),
    ...myToday.map((a) => ({
      key: a.id,
      // Their own activity has no prescribed session to open, so this
      // opens the Æfingar week rather than a session that does not exist.
      sessionId: undefined,
      title: a.name,
      sub: a.at ? `kl. ${a.at}` : "",
    })),
  ];
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
      {/* One column now. The status card that sat beside this became the
          face in its corner, so the hero gets the full width it was
          sharing. */}
      {/* The hero is a div, not a button.
          It used to be one whole tappable card, which meant the people
          button had to be an absolutely-positioned sibling floating over
          it — and floating over it is exactly what it looked like. The
          actions are explicit children now, in a row at the foot of the
          card, so the ring is inside the hero rather than on top of it. */}
      <div>
        {exercise && (
          <div className="flex flex-col rounded-3xl bg-gradient-to-br from-orange-500 to-amber-400 p-4 text-left text-white shadow-sm sm:p-5">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-white/85"><Dumbbell className="h-4 w-4" aria-hidden />{todayItems.length ? "Æfing dagsins" : "Hvíldardagur"}</span>
            {/* Today's session is the thing you press.
                It was a heading with a separate "Opna æfinguna →" link
                underneath, which is two elements for one action and left
                today looking no louder than tomorrow. As a solid white
                pill it is the only opaque thing on the card, and the link
                is gone because the pill is the link. */}
            {/* Both kinds of "today", in one prominent list.
                The first attempt only promoted prescribed sessions, so
                somebody whose today is their own CrossFit still got a
                small translucent chip — which is exactly the "not
                clickable, not noticeable" that was reported. A session and
                an activity someone put in themselves are the same thing to
                the person doing them, so they look and behave the same:
                white, opaque, pressable, opening Æfingar. */}
            {todayItems.length ? todayItems.map((x) => (
              <button key={x.key} type="button" onClick={() => onOpenExercise(x.sessionId)}
                className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-white px-3.5 py-3 text-left text-orange-950 shadow-md transition active:scale-[0.99] hover:bg-orange-50">
                <ActivityIcon name={x.title} className="h-5 w-5 shrink-0 text-orange-700" />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold leading-tight">{x.title}</span>
                  {x.sub && <span className="block truncate text-sm text-orange-900/70">{x.sub}</span>}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-orange-700" aria-hidden />
              </button>
            )) : (
              <span className="mt-1 block text-sm text-white/95">
                Rösk ganga eða útivera telur samt.
              </span>
            )}
            {/* Tomorrow as a chip — the same treatment as the Æfingar hero,
                so the two pages read alike. */}
            {/* Tomorrow is context, not an instruction: no ring, no
                background, just a quiet line under today's. */}
            <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-white/70">
              <span className="uppercase tracking-wide">Á morgun</span>
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
            <span className="mt-auto flex items-center gap-3 pt-3">
              {/* No "Opna æfinguna" any more — today's pill above is that
                  button. On a rest day there is nothing to open, so the
                  row is just the ring. */}
              {!todayItems.length && (
                <button type="button" onClick={() => onOpenExercise(undefined)}
                  className="min-w-0 flex-1 text-left text-sm font-semibold underline-offset-4 hover:underline">
                  Opna æfingaáætlunina →
                </button>
              )}
              <span className="ml-auto">{people}</span>
            </span>
          </div>
        )}
      </div>

      {(plan.goals?.length ?? 0) > 0 && (
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-hc-hairline sm:p-5">
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
