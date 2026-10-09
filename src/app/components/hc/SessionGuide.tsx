"use client";

// What this session trains, where it tends to go wrong, and what people
// normally do before and after it.
//
// Shown inside a session on Æfingar. It is descriptive, not prescriptive:
// published injury epidemiology for the activity and the warm-up practice
// used in that sport, with the sources named so the figures can be checked.
// It never claims to prevent anything — the entries say what the literature
// found, including where the evidence is weak.
//
// The numbers describe populations in those studies. They are not a
// statement about the person reading them, and the card says so.

import { useState } from "react";
import { AlertTriangle, ChevronDown, Dumbbell, Snowflake, Sparkles } from "lucide-react";
import { guideFor } from "@/lib/hc/modality-guide";

export default function SessionGuide({ name, modality }: { name: string; modality?: string | null }) {
  const g = guideFor(name, modality);
  const [open, setOpen] = useState(false);
  if (!g) return null;

  return (
    <div className="border-t border-slate-100">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
        <Sparkles className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-slate-700">
            {g.tag} · {g.trains}
          </span>
          <span className="block truncate text-[11px] text-slate-500">
            Mest á: {g.loads.join(", ")}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />Algengustu meiðslin í þessari grein
            </p>
            <ul className="mt-1 space-y-1">
              {g.common.map((c) => (
                <li key={c.area} className="text-xs leading-snug text-slate-600">
                  <strong className="text-slate-900">{c.area}</strong> — {c.note}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                <Dumbbell className="h-3.5 w-3.5" aria-hidden />Upphitun
              </p>
              <ul className="mt-1 space-y-0.5">
                {g.warmup.map((w, i) => (
                  <li key={i} className="text-xs leading-snug text-slate-600">· {w}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-700">
                <Snowflake className="h-3.5 w-3.5" aria-hidden />Niðurlag
              </p>
              <ul className="mt-1 space-y-0.5">
                {g.cooldown.map((c, i) => (
                  <li key={i} className="text-xs leading-snug text-slate-600">· {c}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* What the evidence actually supports, including where it is thin. */}
          <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-snug text-slate-600">
            {g.evidence}
          </p>

          <p className="text-[10px] leading-snug text-slate-400">
            Tölurnar lýsa hópum í rannsóknunum hér að neðan, ekki þér. Þetta er fræðsla, ekki
            sjúkdómsgreining eða meðferð — ræddu við þjálfarann eða lækni ef eitthvað er viðvarandi.
            {" "}
            {g.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 ? " · " : ""}
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">{s.label}</a>
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
