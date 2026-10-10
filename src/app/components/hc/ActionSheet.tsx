"use client";

// Tapping an action on "Í dag".
//
// The row used to expand in place, which buried the two things people
// actually want from it — the note and "put this one aside" — under the
// teaching text, and offered no way to change the action itself without
// going to the plan editor and picking the pillar again.
//
// It is a sheet now: what the action is, why it matters, your note, and the
// two ways to change it — set it aside, or go straight to this pillar's
// actions in the editor with the pillar already chosen.

import { useState } from "react";
import Sheet from "./Sheet";
import { BookOpen, EyeOff, Pencil, X } from "lucide-react";
import { PILLAR_META, type Pillar, type PlanItem } from "@/lib/hc/types";
import PillarIcon from "./PillarIcon";
import { hcBtn } from "./ui";

export default function ActionSheet({ a, note, onNote, onHide, onEditPillar, onClose, links }: {
  a: PlanItem;
  note: string;
  onNote: (note: string) => void;
  onHide: () => void;
  /** Opens the plan editor with this pillar already chosen. */
  onEditPillar: (p: Pillar) => void;
  onClose: () => void;
  links?: { lecture?: { title: string; href: string } | null; go?: { label: string; onClick: () => void } | null };
}) {
  const [v, setV] = useState(note);
  const meta = PILLAR_META[a.pillar];

  return (
    <Sheet title={a.title} onClose={onClose}
      header={
        <div className="flex items-start gap-3 border-b border-slate-100 p-4" style={{ background: meta.soft }}>
          <PillarIcon pillar={a.pillar} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.ink }}>{meta.label}</p>
            <p className="font-bold text-slate-900">{a.title}</p>
            {a.frequency && <p className="text-xs text-slate-600">{a.frequency}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Loka" className="rounded-lg p-1 text-slate-500 hover:bg-white/60"><X className="h-5 w-5" /></button>
        </div>
      }>


        <div className="space-y-4 p-4">
          {a.summary && <p className="text-sm text-slate-700">{a.summary}</p>}
          {a.details && <p className="whitespace-pre-line text-sm text-slate-600">{a.details}</p>}
          {a.note && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm italic text-emerald-900">{a.note}</p>}

          {(links?.go || links?.lecture) && (
            <div className="flex flex-wrap gap-2">
              {links.go && (
                <button type="button" onClick={() => { links.go!.onClick(); onClose(); }}
                  className="inline-flex min-h-9 items-center rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">{links.go.label}</button>
              )}
              {links.lecture && (
                <a href={links.lecture.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <BookOpen className="h-4 w-4" aria-hidden /> {links.lecture.title}
                </a>
              )}
            </div>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-slate-500">Athugasemd til þjálfara</span>
            <textarea value={v} onChange={(e) => setV(e.target.value)} rows={2} maxLength={300}
              onBlur={() => v.trim() !== note && onNote(v.trim())}
              placeholder="T.d. hvað gekk vel eða hvað var erfitt"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Breyta</p>
            <button type="button" onClick={() => { onEditPillar(a.pillar); onClose(); }}
              className={`${hcBtn.secondary} w-full justify-start`}>
              <Pencil className="h-4 w-4" aria-hidden /> Breyta {meta.label.toLowerCase()}-aðgerðunum mínum
            </button>
            <button type="button" onClick={() => { onHide(); onClose(); }} className={`${hcBtn.ghost} w-full justify-start`}>
              <EyeOff className="h-4 w-4" aria-hidden /> Leggja þessa til hliðar í bili
            </button>
          </div>
        </div>
    </Sheet>
  );
}
