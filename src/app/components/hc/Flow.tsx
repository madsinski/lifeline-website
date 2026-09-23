"use client";

// A client's journey as a list of steps you walk down, not tabs you hunt
// through. The step that needs doing is open; the ones behind it are closed
// with a line saying what happened; the ones ahead say what they are waiting
// for. Borrowed from the HSU doctor portal, which reads the same way.

import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

/** done = behind us · current = your move · waiting = someone else's move · upcoming = not yet */
export type StepState = "done" | "current" | "waiting" | "upcoming";

export interface FlowStep {
  key: string;
  title: string;
  icon: ReactNode;
  state: StepState;
  /** One line: what is true right now. */
  status: string;
  body: ReactNode;
  /** Hide the step entirely (e.g. follow-up before there is a plan). */
  hidden?: boolean;
}

const DOT: Record<StepState, string> = {
  done: "bg-emerald-500 text-white",
  current: "bg-slate-900 text-white",
  waiting: "bg-amber-100 text-amber-700",
  upcoming: "bg-slate-100 text-slate-400",
};

const LABEL: Record<StepState, string> = {
  done: "Lokið",
  current: "Þitt næsta skref",
  waiting: "Bíður",
  upcoming: "Seinna",
};

export default function Flow({ steps, openKey, onOpen }: {
  steps: FlowStep[];
  /** Which step is expanded; the caller starts it on the current one. */
  openKey: string | null;
  onOpen: (key: string | null) => void;
}) {
  const shown = steps.filter((s) => !s.hidden);
  // Only the first outstanding step is "your next move"; the ones behind it
  // are simply not done yet.
  const nextIdx = shown.findIndex((s) => s.state === "current");
  return (
    <ol className="space-y-2">
      {shown.map((s, i) => {
        const open = openKey === s.key;
        return (
          <li key={s.key} className="relative">
            <div className={`overflow-hidden rounded-2xl border bg-white transition ${open ? "border-slate-300 shadow-sm" : "border-slate-200"}`}>
              <button type="button" onClick={() => onOpen(open ? null : s.key)} aria-expanded={open}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50 sm:p-4">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${DOT[s.state]}`}>
                  {s.state === "done" ? <Check className="h-4 w-4" /> : s.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className={`font-bold ${s.state === "upcoming" ? "text-slate-400" : "text-slate-900"}`}>{s.title}</span>
                    {s.state === "current" && i === nextIdx && (
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{LABEL.current}</span>
                    )}
                    {s.state === "waiting" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">{LABEL.waiting}</span>
                    )}
                  </span>
                  <span className={`block truncate text-sm ${s.state === "upcoming" ? "text-slate-400" : "text-slate-500"}`}>{s.status}</span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-300 transition ${open ? "rotate-180" : ""}`} />
              </button>
              {open && <div className="border-t border-slate-100 p-3 sm:p-4">{s.body}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A quiet section for the things you only open when you need them. */
export function Drawer({ title, count, children, defaultOpen }: {
  title: string; count?: number; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50">
        <span className="font-semibold text-slate-700">{title}</span>
        {count ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{count}</span> : null}
        <span className="flex-1" />
        <ChevronDown className={`h-5 w-5 text-slate-300 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}
