"use client";

// Fræðsla — courses for one pillar.
//
// The app has three view states: list → course → lesson. Lessons are not a
// table; they live in the `modules` jsonb on education_courses, so opening a
// course needs no further fetch. The jsonb shape is not guaranteed, so every
// field is read defensively and a module that carries nothing recognisable
// still renders its title rather than disappearing.

import { useState } from "react";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { useT } from "./../useT";
import { appBrand, appCard } from "./../ui";

export interface Course {
  id: string; name: string; description: string | null; cover: string | null;
  difficulty: string | null; minutes: number | null; category: string | null; modules: unknown[];
}

/** Modules are free-form jsonb — pull a title and a body out of whatever is there. */
function readModule(m: unknown): { title: string; body: string[] } {
  if (typeof m === "string") return { title: m, body: [] };
  const o = (m ?? {}) as Record<string, unknown>;
  const title = [o.title, o.name, o.heading].find((x) => typeof x === "string") as string | undefined;
  const raw = [o.content, o.body, o.text, o.lessons].find((x) => x != null);
  const body = Array.isArray(raw)
    ? raw.map((x) => (typeof x === "string" ? x : typeof (x as Record<string, unknown>)?.title === "string" ? String((x as Record<string, unknown>).title) : "")).filter(Boolean)
    : typeof raw === "string" ? [raw] : [];
  return { title: title ?? "—", body };
}

export default function Education({ courses }: { courses: Course[] }) {
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const course = courses.find((c) => c.id === openId) ?? null;

  if (courses.length === 0) {
    return <p className={`${appCard} p-4 text-sm`} style={{ color: appBrand.ink2 }}>{t("edu.none")}</p>;
  }

  if (course) {
    const mods = course.modules.map(readModule);
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => setOpenId(null)}
          className="flex items-center gap-1.5 px-1 text-xs font-bold" style={{ color: appBrand.primaryDark }}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />{t("edu.back")}
        </button>
        <div className={`${appCard} p-4`}>
          <h3 className="text-base font-bold" style={{ color: appBrand.ink1 }}>{course.name}</h3>
          {course.description && (
            <p className="mt-1 text-sm leading-snug" style={{ color: appBrand.ink2 }}>{course.description}</p>
          )}
          <p className="mt-1 text-[11px]" style={{ color: appBrand.ink3 }}>
            {course.minutes ? `${course.minutes} ${t("edu.minutes")}` : ""}
            {course.minutes && mods.length ? " · " : ""}
            {mods.length ? `${mods.length} ${t("edu.modules")}` : ""}
            {course.difficulty ? ` · ${course.difficulty}` : ""}
          </p>
        </div>
        {mods.map((m, i) => (
          <div key={`${course.id}-${i}`} className={`${appCard} p-4`}>
            <p className="text-sm font-bold" style={{ color: appBrand.ink1 }}>{i + 1}. {m.title}</p>
            {m.body.map((b, j) => (
              <p key={j} className="mt-1 text-sm leading-snug" style={{ color: appBrand.ink2 }}>{b}</p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {courses.map((c) => (
        <button key={c.id} type="button" onClick={() => setOpenId(c.id)}
          className={`${appCard} flex w-full items-center gap-3 px-4 py-3 text-left transition active:scale-[0.995]`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{ background: `${appBrand.mental}14` }}>
            <BookOpen className="h-4 w-4" style={{ color: appBrand.mental }} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold" style={{ color: appBrand.ink1 }}>{c.name}</span>
            <span className="block truncate text-xs" style={{ color: appBrand.ink2 }}>
              {c.minutes ? `${c.minutes} ${t("edu.minutes")}` : ""}
              {c.minutes && c.modules.length ? " · " : ""}
              {c.modules.length ? `${c.modules.length} ${t("edu.modules")}` : ""}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: appBrand.ink4 }} aria-hidden />
        </button>
      ))}
    </div>
  );
}
