/**
 * The three steps, as rendered on the front page.
 *
 * This is the front page's markup, moved rather than copied — HomeView now
 * renders this too. The account showed the same three steps for a while in
 * a hand-rebuilt version of this, which is how two things that are meant to
 * be identical stop being identical: one of them gets a fix and the other
 * does not.
 *
 * `onStep` is the only thing the account adds. Given it, each step becomes a
 * button; without it they are the static tiles the front page wants.
 */
"use client";

import type { ReactNode } from "react";

export const STEP_STYLES: { color: string; icon: ReactNode }[] = [
  { color: "#3B82F6", icon: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
  ) },
  { color: "#10B981", icon: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
  ) },
  { color: "#8B5CF6", icon: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  ) },
];

export interface HowStepsContent {
  how_s1_title?: unknown; how_s1_desc?: unknown;
  how_s2_title?: unknown; how_s2_desc?: unknown;
  how_s3_title?: unknown; how_s3_desc?: unknown;
  [k: string]: unknown;
}

export function HowItWorksSteps({ c, onStep, doneStep }: {
  c: HowStepsContent;
  /** Makes each tile a button. Omit for the static front-page version. */
  onStep?: (n: 1 | 2 | 3) => void;
  /** Replaces that step's number with a tick. */
  doneStep?: number;
}) {
  const Tag = (onStep ? "button" : "div") as "button" | "div";
  return (
            <div className="space-y-8 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-12 relative">
              <div className="hidden sm:block absolute top-12 left-[30%] w-[12%] h-0.5 bg-gradient-to-r from-[#EA580C]/40 to-[#84CC16]/40" />
              <div className="hidden sm:block absolute top-12 left-[58%] w-[12%] h-0.5 bg-gradient-to-r from-[#84CC16]/40 to-[#767194]/40" />
              {[1, 2, 3].map((n, i) => (
                <Tag key={n} {...(onStep ? { type: "button" as const, onClick: () => onStep(n as 1 | 2 | 3) } : {})}
                  className={`group flex flex-col items-center text-center relative${onStep ? " cursor-pointer" : ""}`}>
                  <div className={`relative mb-6${onStep ? " transition-transform duration-200 ease-out group-hover:-translate-y-1 group-hover:scale-[1.04] group-focus-visible:-translate-y-1" : ""}`}>
                    <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-lg" style={{ backgroundColor: `${STEP_STYLES[i].color}10`, border: `2px solid ${STEP_STYLES[i].color}25` }}>
                      <div style={{ color: STEP_STYLES[i].color }}>{STEP_STYLES[i].icon}</div>
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md" style={{ backgroundColor: doneStep === n ? "#047857" : STEP_STYLES[i].color }}>{doneStep === n ? "\u2713" : n}</div>
                  </div>
                  <h3 className="text-xl font-semibold text-[#1F2937] mb-3">{String(c[`how_s${n}_title`] ?? "")}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed max-w-[280px]">{String(c[`how_s${n}_desc`] ?? "")}</p>
                </Tag>
              ))}
            </div>
  );
}
