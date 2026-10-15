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

import { useRef, useState } from "react";
import Sheet from "./Sheet";
import { BookOpen, Clock, EyeOff, Pencil, X } from "lucide-react";
import { PILLAR_META, type Pillar, type PlanItem } from "@/lib/hc/types";
import PillarIcon from "./PillarIcon";
import { hcBtn } from "./ui";
import { weeklyTarget } from "@/lib/hc/adherence";

const WEEKDAY_SHORT = ["S", "M", "Þ", "M", "F", "F", "L"];
const WEEKDAY_LONG = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];

export default function ActionSheet({ a, note, onNote, onHide, onEditPillar, onClose, links, week, today, doneOn, onToggle, atTime, onTime }: {
  a: PlanItem;
  note: string;
  onNote: (note: string) => void;
  onHide: () => void;
  /** Opens the plan editor with this pillar already chosen. */
  onEditPillar: (p: Pillar) => void;
  onClose: () => void;
  links?: { lecture?: { title: string; href: string } | null; go?: { label: string; onClick: () => void } | null };
  /** The last seven days, so the week lives here instead of on every row. */
  week?: string[];
  today?: string;
  doneOn?: (uid: string, day: string) => boolean;
  onToggle?: (uid: string, day?: string) => void;
  /** The time they have chosen for this one, and how to change it. */
  atTime?: string | null;
  onTime?: (t: string | null) => void;
}) {
  const [v, setV] = useState(note);
  /*
   * The note saves on blur, and on close as well: a sheet dismissed by
   * swipe, Escape or the backdrop unmounts the textarea without a blur, and
   * what had been typed was lost without a word. The ref keeps the two
   * paths from sending the same note twice.
   */
  const saved = useRef(note);
  const saveNote = () => {
    const t = v.trim();
    if (t === saved.current) return;
    saved.current = t;
    onNote(t);
  };
  const close = () => { saveNote(); onClose(); };
  const meta = PILLAR_META[a.pillar];
  const target = weeklyTarget(a.frequency);
  const thisWeek = (week ?? []).filter((d) => doneOn?.(a.uid, d)).length;

  return (
    <Sheet title={a.title} onClose={close}
      header={
        <div className="flex items-start gap-3 border-b border-hc-hairline p-4" style={{ background: meta.soft }}>
          <PillarIcon pillar={a.pillar} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: meta.ink }}>{meta.label}</p>
            <p className="font-bold text-hc-ink">{a.title}</p>
            {a.frequency && <p className="text-xs text-hc-ink-2">{a.frequency}</p>}
          </div>
          <button type="button" onClick={close} aria-label="Loka" className="rounded-lg p-1 text-hc-ink-2 hover:bg-hc-surface/60"><X className="h-5 w-5" /></button>
        </div>
      }>


        <div className="space-y-4 p-4">
          {a.summary && <p className="text-sm text-hc-ink-2">{a.summary}</p>}
          {a.details && <p className="whitespace-pre-line text-sm text-hc-ink-2">{a.details}</p>}
          {a.note && <p className="rounded-xl bg-hc-ok-surface px-3 py-2 text-sm italic text-hc-ok-ink">{a.note}</p>}

          {/* An exact time, if they want one.
              The plan says "daglega" and the section says "Morgunn", which
              is as precise as a nurse should be about somebody else's
              morning. This is the participant being more precise than that
              if it helps them — optional, and clearable, because a habit
              with a time you keep missing is worse than one without. */}
          {onTime && (
            <div className="flex flex-wrap items-center gap-2 rounded-hc-element bg-hc-sunken p-3 ring-1 ring-hc-hairline">
              <label className="flex items-center gap-2 text-sm font-semibold text-hc-ink">
                <Clock className="h-4 w-4 text-hc-ink-2" aria-hidden />
                Tími
                <input type="time" value={atTime ?? ""} onChange={(e) => onTime(e.target.value || null)}
                  aria-label={`Tími fyrir ${a.title}`}
                  className="rounded-hc-element border border-hc-control bg-hc-surface px-2.5 py-1.5 text-sm text-hc-ink outline-none focus:border-hc-brand" />
              </label>
              {atTime
                ? (
                  <button type="button" onClick={() => onTime(null)}
                    className="text-xs font-semibold text-hc-ink-2 underline-offset-2 hover:text-hc-ink-2 hover:underline">
                    Hreinsa
                  </button>
                )
                : <span className="text-xs text-hc-ink-2">Valfrjálst</span>}
            </div>
          )}

          {/* The week, and where it came from.
              Both used to sit on the row in Í dag, which made every row six
              things deep. They belong to one habit, so they belong here. */}
          {week && today && doneOn && onToggle && (
            <div className="rounded-hc-element bg-hc-sunken p-3 ring-1 ring-hc-hairline">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-hc-ink-2">Vikan</p>
                <p className="text-sm text-hc-ink-2">
                  {a.frequency || "Daglega"}
                  {target < 7 && (
                    <span className={thisWeek >= target ? "font-semibold text-hc-ok-ink" : "text-hc-ink-3"}>
                      {" "}· {thisWeek} af {target}
                    </span>
                  )}
                </p>
              </div>
              {/* Tappable, because filling in a day you missed is the point
                  — the server takes today and the six behind it. */}
              <div className="mt-2 flex gap-1.5" role="group"
                aria-label={`Vikan fyrir „${a.title}“. Ýttu á dag til að merkja hann.`}>
                {week.map((d) => {
                  const on = doneOn(a.uid, d);
                  const wd = new Date(`${d}T12:00:00`).getDay();
                  const future = d > today;
                  return (
                    <button key={d} type="button" disabled={future} onClick={() => onToggle(a.uid, d)}
                      aria-pressed={on}
                      aria-label={`${WEEKDAY_LONG[wd]}${d === today ? " (í dag)" : ""}: ${future ? "ekki komið" : on ? "búið" : "ekki búið"}`}
                      title={`${WEEKDAY_LONG[wd]}${d === today ? " (í dag)" : future ? " (framundan)" : ""}`}
                      className={`grid h-9 flex-1 place-items-center rounded-lg text-xs font-bold transition disabled:opacity-30 ${
                        on ? "text-white" : "bg-hc-surface text-hc-ink-3 ring-1 ring-hc-hairline"} ${d === today && !on ? "ring-2 ring-slate-400" : ""}`}
                      style={on ? { background: meta.color } : undefined}>
                      {WEEKDAY_SHORT[wd]}
                    </button>
                  );
                })}
              </div>
              {a.source && (
                <p className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                  a.source.priority === "red"
                    ? "bg-red-50 text-red-800 ring-red-200"
                    : "bg-hc-warn-surface text-hc-warn-ink ring-hc-warn-ink/30"}`}
                  title={`Úr skýrslunni þinni: ${a.source.text}`}>
                  Úr skýrslunni · {a.source.priority === "red" ? "Forgangur 1" : "Forgangur 2"}
                </p>
              )}
            </div>
          )}

          {(links?.go || links?.lecture) && (
            <div className="flex flex-wrap gap-2">
              {links.go && (
                <button type="button" onClick={() => { links.go!.onClick(); close(); }}
                  className="inline-flex min-h-9 items-center rounded-full border border-hc-hairline px-3 text-sm font-semibold text-hc-ink-2 hover:bg-hc-sunken">{links.go.label}</button>
              )}
              {links.lecture && (
                <a href={links.lecture.href} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-hc-hairline px-3 text-sm font-semibold text-hc-ink-2 hover:bg-hc-sunken">
                  <BookOpen className="h-4 w-4" aria-hidden /> {links.lecture.title}
                </a>
              )}
            </div>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-hc-ink-2">Athugasemd til þjálfara</span>
            <textarea value={v} onChange={(e) => setV(e.target.value)} rows={2} maxLength={300}
              onBlur={saveNote}
              placeholder="T.d. hvað gekk vel eða hvað var erfitt"
              className="mt-1 w-full rounded-lg border border-hc-control px-3 py-2 text-sm text-hc-ink-2 outline-none focus:ring-2 focus:ring-emerald-500" />
          </label>

          <div className="space-y-2 border-t border-hc-hairline pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-hc-ink-2">Breyta</p>
            <button type="button" onClick={() => { onEditPillar(a.pillar); close(); }}
              className={`${hcBtn.secondary} w-full justify-start`}>
              <Pencil className="h-4 w-4" aria-hidden /> Breyta {meta.label.toLowerCase()}-aðgerðunum mínum
            </button>
            <button type="button" onClick={() => { onHide(); close(); }} className={`${hcBtn.ghost} w-full justify-start`}>
              <EyeOff className="h-4 w-4" aria-hidden /> Leggja þessa til hliðar í bili
            </button>
          </div>
        </div>
    </Sheet>
  );
}
