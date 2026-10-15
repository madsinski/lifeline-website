"use client";

// Workstation "Fræðsla og þjálfun": the lectures and training programmes a
// nurse can attach to a plan. Lectures open as a slide deck that can be shown
// full screen for a group; programmes open with test settings (level, load,
// injuries) so the nurse sees what a participant would get. Editing lectures
// stays in /admin/lectures (staff).

import EmptyState from "./EmptyState";
import { ArrowLeft } from "lucide-react";
import { hcBtn, hcCard } from "./ui";
import { useEffect, useRef, useState } from "react";
import { SlideDeck } from "./LectureContent";
import { ProgramPreview } from "./PlanView";
import type { WsApi } from "./ws-api";
import { DEFAULT_TRAINING, isAdaptive, type TrainingSettings } from "@/lib/hc/adaptive-program";
import type { ExerciseTemplate, HcLecture } from "@/lib/hc/types";

const KIND_IS: Record<string, string> = { slides: "Glærur", video: "Myndband", article: "Grein" };

export default function TeachingLibrary({ api }: { api: WsApi }) {
  const [lectures, setLectures] = useState<HcLecture[] | null>(null);
  const [programs, setPrograms] = useState<ExerciseTemplate[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [open, setOpen] = useState<{ kind: "lecture"; slug: string } | { kind: "program"; key: string } | null>(null);
  const [trial, setTrial] = useState<TrainingSettings>({ ...DEFAULT_TRAINING, started_on: new Date().toISOString().slice(0, 10) });
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [l, p] = await Promise.all([api("/api/vinnustod/lectures"), api("/api/hc/plan-library")]);
      const lj = await l.json().catch(() => ({}));
      const pj = await p.json().catch(() => ({}));
      setLectures(lj.lectures ?? []);
      setCanEdit(!!lj.canEdit);
      setPrograms(((pj.exercise ?? []) as ExerciseTemplate[]).sort((a, b) => Number(isAdaptive(b.key)) - Number(isAdaptive(a.key))));
    })();
  }, [api]);

  if (lectures === null) return <p className="py-10 text-center text-hc-ink-2">Hleð…</p>;

  const lecture = open?.kind === "lecture" ? lectures.find((l) => l.slug === open.slug) : null;
  const program = open?.kind === "program" ? programs.find((p) => p.key === open.key) : null;

  if (lecture) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setOpen(null)} className={hcBtn.secondary}><ArrowLeft className="h-4 w-4" aria-hidden />Til baka</button>
          <span className="flex-1" />
          {lecture.kind === "slides" && (
            <button type="button" onClick={() => void stage.current?.requestFullscreen?.()} className={hcBtn.primary}>Kynna á skjá</button>
          )}
          {canEdit && <a href="/admin/lectures" className={hcBtn.secondary}>Breyta í stjórnborði</a>}
        </div>
        <div>
          <h2 className="text-xl font-bold text-hc-ink">{lecture.title}</h2>
          {lecture.subtitle && <p className="text-sm text-hc-ink-2">{lecture.subtitle}</p>}
        </div>
        {lecture.kind === "slides" && lecture.slides.length > 0 && (
          <div ref={stage} className="rounded-hc-hero bg-hc-surface p-2 [&:fullscreen]:flex [&:fullscreen]:items-center [&:fullscreen]:justify-center [&:fullscreen]:bg-hc-surface [&:fullscreen]:p-10">
            <div className="w-full max-w-5xl"><SlideDeck slides={lecture.slides} pillar={lecture.pillar} /></div>
          </div>
        )}
        {lecture.kind !== "slides" && <p className="text-sm text-hc-ink-2">Forskoðun er aðeins fyrir glærur. Skjólstæðingar sjá fræðsluna í heilsuferðinni.</p>}
      </div>
    );
  }

  if (program) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setOpen(null)} className={hcBtn.secondary}><ArrowLeft className="h-4 w-4" aria-hidden />Til baka</button>
        {isAdaptive(program.key) && (
          <p className="rounded-hc-card bg-hc-warn-surface px-4 py-3 text-sm text-hc-warn-ink">
            Prufustillingar: breytingar hér vistast ekki. Stillingar skjólstæðings eru í áætlun hans, skrefinu Hreyfing.
          </p>
        )}
        <ProgramPreview exercise={program} training={{ settings: trial, onChange: setTrial, who: "nurse" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-hc-ink-2">Fyrirlestrar og fræðsla</h2>
        <p className="mt-0.5 text-sm text-hc-ink-2">Hengdu fræðslu við áætlun í síðasta skrefi áætlunarinnar. Glærur má sýna á skjá fyrir hóp.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {lectures.map((l) => (
            <button key={l.slug} type="button" onClick={() => setOpen({ kind: "lecture", slug: l.slug })}
              className={`${hcCard.base} p-4 text-left transition hover:ring-hc-brand`}>
              <p className="text-xs font-bold uppercase tracking-wide text-hc-ok-ink">
                {KIND_IS[l.kind] ?? "Fræðsla"}{l.kind === "slides" ? ` · ${l.slides.length} glærur` : ""}{l.duration_min ? ` · ${l.duration_min} mín.` : ""}
              </p>
              <p className="mt-1 font-bold text-hc-ink">{l.title}</p>
              {l.subtitle && <p className="text-sm text-hc-ink-2">{l.subtitle}</p>}
            </button>
          ))}
          {!lectures.length && <div className="sm:col-span-2"><EmptyState compact title="Engin birt fræðsla" body="Fræðsla er búin til og birt í stjórnborðinu (/admin/lectures)." /></div>}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-hc-ink-2">Æfingaáætlanir</h2>
        <p className="mt-0.5 text-sm text-hc-ink-2">Veldu áætlun í skrefinu Hreyfing. „HIIT og styrkur“ lagar sig að stigi, álagi og meiðslum.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {programs.map((p) => (
            <button key={p.key} type="button" onClick={() => setOpen({ kind: "program", key: p.key })}
              className={`${hcCard.base} p-4 text-left transition hover:ring-hc-exercise`}>
              <p className="text-xs font-bold uppercase tracking-wide text-hc-exercise-ink">
                {p.days_per_week} dagar í viku{p.session_minutes ? ` · um ${p.session_minutes} mín.` : ""}{isAdaptive(p.key) ? " · aðlagast" : ""}
              </p>
              <p className="mt-1 font-bold text-hc-ink">{p.name}</p>
              {p.goal && <p className="text-sm text-hc-ink-2">{p.goal}</p>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
