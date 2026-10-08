// The plan, read off the report rather than reasoned out again.
//
// Medalia's Ráðleggingar column is the clinical plan: a doctor has marked
// each thing to address red (Forgangur 1) or yellow (Forgangur 2), and that
// decision is recorded in the licensed sjúkraskrá system. This turns those
// lines into the actions that implement them, in the order the report
// prioritised, and stamps each one with where it came from.
//
// Deterministic on purpose. No model decides which actions a person gets, so
// what Lifeline produces is a rendering of a decision taken in Medalia and
// can be shown to be one — every action points back at the recommendation it
// came from. That is what keeps this out of sjúkraskrá territory and out of
// the MDR conversation, and an assertion in a posture document would not.
//
// What a model may still do, downstream: write the one-sentence "why this
// matters to you". Phrasing, not selection.

import type { Grunnheilsa, Signal } from "./grunnheilsa";
import { classifyRecommendation } from "./recommendation-map";
import type { PlanModule } from "./types";

/** Where one action came from, kept on the action so it can be shown. */
export interface ActionSource {
  /** The report row it sat under — "svefn_venjur". */
  item: string;
  /** Medalia's label for it — "Reglubundinn svefntími". Empty when it prints none. */
  component: string;
  /** The report's own words, so nothing is paraphrased away. */
  text: string;
  /** red = Forgangur 1, yellow = Forgangur 2. */
  priority: Signal;
}

export interface PlannedAction {
  module: PlanModule;
  source: ActionSource;
}

export interface ReportPlan {
  actions: PlannedAction[];
  /** Lines that say to see a doctor. Never actions; the clinician decides. */
  referrals: ActionSource[];
  /** Recognised but too general to act on. */
  generic: ActionSource[];
  /** Flagged lines the map does not know. Shown to the nurse, never guessed at. */
  unmapped: ActionSource[];
}

/**
 * Red before yellow, and within a priority the order the report printed —
 * which is the doctor's own ordering and not ours to improve on.
 */
const RANK: Record<string, number> = { red: 0, yellow: 1, green: 2 };

export function planFromReport(report: Grunnheilsa, library: PlanModule[]): ReportPlan {
  const byKey = new Map(library.map((m) => [m.key, m]));
  const out: ReportPlan = { actions: [], referrals: [], generic: [], unmapped: [] };
  const seen = new Set<string>();

  const rows = report.items.flatMap((item) =>
    (item.recommendations ?? [])
      .filter((r) => r.priority === "red" || r.priority === "yellow")
      .map((r, i) => ({
        order: i,
        source: { item: item.key, component: r.component ?? "", text: r.text, priority: r.priority },
        rec: { component: r.component ?? "", text: r.text, priority: r.priority },
      })),
  );

  rows.sort((a, b) => (RANK[a.source.priority] ?? 9) - (RANK[b.source.priority] ?? 9) || a.order - b.order);

  for (const row of rows) {
    const cls = classifyRecommendation(row.rec);
    if (cls.kind === "referral") { out.referrals.push(row.source); continue; }
    if (cls.kind === "generic") { out.generic.push(row.source); continue; }
    if (cls.kind === "unmapped") { out.unmapped.push(row.source); continue; }
    const action = byKey.get(cls.moduleKey);
    // Mapped to something the library no longer has: that is a gap in our
    // content, not a reason to drop the doctor's instruction silently.
    if (!action) { out.unmapped.push(row.source); continue; }
    // Two recommendations can land on one action — "Prótein í fókus" and
    // "Próteinríkur morgunmatur" are close enough that the library has one of
    // each, but a report could name both. Keep the higher priority.
    if (seen.has(action.key)) continue;
    seen.add(action.key);
    out.actions.push({ module: action, source: row.source });
  }
  return out;
}
