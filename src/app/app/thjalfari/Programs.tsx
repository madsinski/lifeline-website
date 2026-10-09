"use client";

// The programme picker for one pillar.
//
// In the app this is a collapsible section inside each pillar tab, so
// everything about one pillar stays in one place (HealthCoachScreen:1748).
// Switching resets the week to 1, because that is what starting a new
// programme means.

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useT } from "./../useT";
import { appBrand, appCard } from "./../ui";

export interface Program {
  key: string; name: string; tagline: string | null; description: string | null;
  duration: number | null; level: string | null; exerciseType: string | null; current: boolean;
}
export interface Category {
  key: string; label: string; colour: string | null;
  current: { programKey: string; week: number; startedAt: string } | null;
  programs: Program[];
}

export default function Programs({ cat, onPick, busy }: {
  cat: Category;
  onPick: (programKey: string) => void;
  busy: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const current = cat.programs.find((p) => p.current) ?? null;

  return (
    <section className={`${appCard} overflow-hidden`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wide" style={{ color: appBrand.ink3 }}>
            {t("prog.title")}
          </span>
          <span className="block truncate text-sm font-bold" style={{ color: appBrand.ink1 }}>
            {current?.name ?? t("prog.none")}
          </span>
          {cat.current && (
            <span className="text-xs" style={{ color: appBrand.ink2 }}>
              {t("prog.week")} {cat.current.week}
              {current?.duration ? ` / ${current.duration} ${t("prog.weeks")}` : ""}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`}
          style={{ color: appBrand.ink3 }} aria-hidden />
      </button>

      {open && (
        <div className="border-t px-2 pb-2" style={{ borderTopColor: appBrand.hairline }}>
          {cat.programs.map((p) => (
            <button key={p.key} type="button" disabled={busy || p.current}
              onClick={() => onPick(p.key)}
              className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-black/[0.02] disabled:opacity-100">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2"
                style={{
                  borderColor: p.current ? appBrand.primary : appBrand.ink4,
                  background: p.current ? appBrand.primary : "transparent",
                }}>
                {p.current && <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold" style={{ color: appBrand.ink1 }}>{p.name}</span>
                {(p.tagline || p.description) && (
                  <span className="block text-xs leading-snug" style={{ color: appBrand.ink2 }}>
                    {p.tagline || p.description}
                  </span>
                )}
                <span className="mt-0.5 flex flex-wrap gap-1.5 text-[10px]" style={{ color: appBrand.ink3 }}>
                  {p.duration ? <span>{p.duration} {t("prog.weeks")}</span> : null}
                  {p.level ? <span>· {p.level}</span> : null}
                  {p.exerciseType ? <span>· {p.exerciseType}</span> : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
