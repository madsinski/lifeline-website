// Self-service plan building: which pillars matter most for this person, and
// which library actions to suggest first. Deterministic and local — built from
// the traffic lights Lifeline's own reference ranges gave the report, never a
// model — so a participant can build their plan without their data leaving us.
//
// Pure (no server imports): used by /api/hc/my-plan and testable on its own.

import { PILLARS, type Pillar, type PlanModule } from "./types";
import type { Grunnheilsa, Signal } from "./grunnheilsa";

/** Library actions only staff put in a plan: referrals and supplements. */
export const STAFF_ONLY_TAGS = ["tilvísun", "bætiefni"];

export const selfServiceModule = (m: Pick<PlanModule, "tags" | "active">) =>
  m.active && !(m.tags ?? []).some((t) => STAFF_ONLY_TAGS.includes(t));

export interface PillarPriority {
  pillar: Pillar;
  signal: Signal | null;
  /** The report rows behind it, worst first: "Svefn — venjur", … */
  reasons: string[];
}

const RANK: Record<Signal, number> = { red: 2, yellow: 1, green: 0 };

// Markers without a pillar of their own that still point somewhere: blood
// sugar and waist to nutrition and exercise, blood pressure to nutrition.
const METABOLIC = /hba1c|glúkós|glukos|sykur|mitti|kviðfit|þríglý|triglyc|insúlín|fitu/i;
const PRESSURE = /blóðþrýsting|blodthrysting|bp_/i;

/** Worst signal per pillar, with the report rows that set it. */
export function pillarPriorities(report: Grunnheilsa | null, signals: Record<string, Signal | null>): PillarPriority[] {
  const acc = new Map<Pillar, { signal: Signal | null; reasons: { t: string; r: number }[] }>();
  for (const p of PILLARS) acc.set(p, { signal: null, reasons: [] });
  const bump = (p: Pillar, sig: Signal, title: string) => {
    const a = acc.get(p)!;
    if (!a.signal || RANK[sig] > RANK[a.signal]) a.signal = sig;
    if (sig !== "green") a.reasons.push({ t: title, r: RANK[sig] });
  };
  for (const item of report?.items ?? []) {
    const sig = signals[item.key];
    if (!sig) continue;
    if (item.pillar) bump(item.pillar, sig, item.title);
    else if (METABOLIC.test(`${item.key} ${item.title}`)) { bump("nutrition", sig, item.title); bump("exercise", sig, item.title); }
    else if (PRESSURE.test(`${item.key} ${item.title}`)) bump("nutrition", sig, item.title);
  }
  return PILLARS.map((p) => {
    const a = acc.get(p)!;
    return { pillar: p, signal: a.signal, reasons: a.reasons.sort((x, y) => y.r - x.r).map((x) => x.t).filter((t, i, arr) => arr.indexOf(t) === i).slice(0, 3) };
  }).sort((x, y) => (y.signal ? RANK[y.signal] : -1) - (x.signal ? RANK[x.signal] : -1));
}

const score = (m: PlanModule) => (m.effect ?? 3) + (m.ease ?? 3) + (m.evidence ?? 3);

/**
 * Suggested actions: more where the report is red, one foundation action
 * where it is fine. Metabolic / blood-pressure tagged actions go first when
 * those markers are flagged.
 */
export function suggestModules(modules: PlanModule[], priorities: PillarPriority[], hasReport: boolean): { key: string; pillar: Pillar; why: string }[] {
  const out: { key: string; pillar: Pillar; why: string }[] = [];
  for (const pr of priorities) {
    const n = !hasReport ? 1 : pr.signal === "red" ? 3 : pr.signal === "yellow" ? 2 : 1;
    const wantTags = pr.reasons.some((r) => METABOLIC.test(r)) ? ["efnaskipti"] : pr.reasons.some((r) => PRESSURE.test(r)) ? ["blóðþrýstingur"] : [];
    const pool = modules
      .filter((m) => m.pillar === pr.pillar && selfServiceModule(m))
      .sort((a, b) => {
        const ta = wantTags.some((t) => a.tags?.includes(t)) ? 1 : 0;
        const tb = wantTags.some((t) => b.tags?.includes(t)) ? 1 : 0;
        const ga = a.tags?.includes("grunnur") ? 1 : 0;
        const gb = b.tags?.includes("grunnur") ? 1 : 0;
        return tb - ta || (pr.signal ? 0 : gb - ga) || score(b) - score(a) || a.sort - b.sort;
      });
    for (const m of pool.slice(0, n)) {
      out.push({
        key: m.key,
        pillar: m.pillar,
        why: pr.reasons.length ? `Vegna: ${pr.reasons.slice(0, 2).join(", ")}` : "Góður grunnur",
      });
    }
  }
  return out;
}
