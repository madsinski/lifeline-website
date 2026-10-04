// "Hentar þér" — how well an action fits THIS person.
//
// src/lib/hc/rating.ts answers "is this a good action?" — most effect for the
// least time, the same answer for everybody. It cannot answer "is this a good
// action FOR ME?", and that is the question a participant is actually asking
// when they look at a library of sixty things.
//
// Two halves, each 0–10:
//
//   þörf  how badly the report scores on what this action is aimed at.
//         Comes from hc_plan_modules.addresses (the hc_knowledge slugs the
//         action is meant to move) crossed with the traffic lights the
//         report gave those rows.
//   gagn  most effect for the least time — bangScore, unchanged.
//
// Þörf weighs slightly more, because the report is the whole reason this
// person is here: between two equally good actions, the one aimed at the red
// number is the one to do first. But it does not dominate, or a feeble action
// pointed at a bad number would outrank a strong one.
//
// An action whose targets were never measured scores on gagn alone and says
// so, rather than being pushed to the bottom: unmeasured is unknown, not bad.
//
// Deliberately NOT in the database: like the rating weights, this is a
// judgement and should be arguable without a migration.
//
// Client-safe: no server imports.

import { bangScore, type Rated } from "./rating";
import type { Signal } from "./grunnheilsa";

/** How much a traffic light argues for doing something about it. */
const NEED: Record<Signal, number> = { red: 10, yellow: 6, green: 1 };

const W = { need: 0.55, bang: 0.45 };

export interface Addressing extends Rated {
  /** hc_knowledge slugs this action is meant to move. */
  addresses?: string[] | null;
}

export interface Fit {
  /** 0–10. The number to sort and show. */
  fit: number;
  /** 0–10, or null when nothing this action targets was measured. */
  need: number | null;
  /** 0–10, or null when the action has not been rated. */
  bang: number | null;
  /** The report rows it is aimed at that are not green, worst first. */
  targets: { slug: string; signal: Signal }[];
  /** False when the report could not contribute — the score is gagn alone. */
  personalised: boolean;
}

/**
 * How badly this person scores on what the action targets.
 *
 * The worst single marker sets the level, and each further red adds a little:
 * an action that moves two red numbers is worth more than one that moves one.
 * Null when none of its targets were measured.
 */
export function needScore(addresses: string[] | null | undefined, signals: Record<string, Signal | null>): number | null {
  const hit = (addresses ?? []).map((s) => signals[s]).filter((s): s is Signal => !!s);
  if (hit.length === 0) return null;
  const worst = Math.max(...hit.map((s) => NEED[s]));
  const extraReds = Math.max(0, hit.filter((s) => s === "red").length - 1);
  return Math.min(10, worst + extraReds * 0.5);
}

const RANK: Record<Signal, number> = { red: 2, yellow: 1, green: 0 };

export function fitOf(m: Addressing, signals: Record<string, Signal | null>): Fit {
  const need = needScore(m.addresses, signals);
  const bang = bangScore(m);
  const targets = (m.addresses ?? [])
    .map((slug) => ({ slug, signal: signals[slug] }))
    .filter((t): t is { slug: string; signal: Signal } => !!t.signal && t.signal !== "green")
    .sort((a, b) => RANK[b.signal] - RANK[a.signal]);

  // Neither half known: nothing to say, sit in the middle rather than at zero.
  if (need == null && bang == null) return { fit: 5, need, bang, targets, personalised: false };
  if (need == null) return { fit: bang!, need, bang, targets, personalised: false };
  if (bang == null) return { fit: need, need, bang, targets, personalised: true };
  return {
    fit: Math.round((need * W.need + bang * W.bang) * 10) / 10,
    need, bang, targets, personalised: true,
  };
}

/** Best fit first. Stable enough to sort a library with. */
export function byFit(signals: Record<string, Signal | null>) {
  return (a: Addressing, b: Addressing) => fitOf(b, signals).fit - fitOf(a, signals).fit;
}

export const FIT_BANDS = [
  { min: 8, label: "Best fyrir þig", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-900 ring-emerald-300" },
  { min: 6.5, label: "Mjög gott fyrir þig", bar: "bg-emerald-400", chip: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  { min: 5, label: "Gott fyrir þig", bar: "bg-sky-400", chip: "bg-sky-50 text-sky-900 ring-sky-200" },
  { min: 0, label: "Minna brýnt núna", bar: "bg-slate-300", chip: "bg-slate-100 text-slate-600 ring-slate-200" },
] as const;

export const fitBand = (fit: number) => FIT_BANDS.find((b) => fit >= b.min) ?? FIT_BANDS[FIT_BANDS.length - 1];

export const FIT_IS = {
  fit: { label: "Hentar þér", hint: "Hversu brýnt þetta er fyrir þig: þörfin úr skýrslunni og gagnið af aðgerðinni." },
  need: { label: "Þín þörf", hint: "Hversu illa skýrslan þín kemur út á því sem þessi aðgerð tekur á." },
  bang: { label: "Mest fyrir minnst", hint: "Áhrif, hversu auðvelt það er og hversu góðar rannsóknirnar eru." },
} as const;
