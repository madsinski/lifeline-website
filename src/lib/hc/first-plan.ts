// Starting points for somebody's FIRST plan, in their words rather than ours.
//
// The staff templates in hc_plan_templates are named for a clinical picture
// ("Hækkaður blóðþrýstingur", "Blóðsykur og blóðfitur") because a nurse picks
// them with a report open. Offered to a participant building a plan alone,
// those names would read as a diagnosis. So each scenario here is a goal the
// person can recognise, and its actions are taken from an existing staff
// template (narrowed to the pillars the goal is about) plus a few named
// library actions — library keys only, never free text and never a model.
//
// Resolved on the server (/api/hc/my-plan GET) against the self-service
// library, so a retired or staff-only action simply drops out.
//
// Health-claims rule: these support habits and track them; none promises an
// outcome.

import type { Pillar } from "./types";

export interface FirstPlanScenario {
  key: string;
  title: string;
  line: string;
  /** hc_plan_templates.key whose actions this starts from, or null. */
  template: string | null;
  /** Only the template's actions in these pillars. */
  pillars?: Pillar[];
  /** Library actions added on top (hc_plan_modules.key). */
  extra?: string[];
  /** hc_exercise_templates.key — training is then set up from hc_training_settings. */
  exercise_key?: string | null;
  nutrition_key?: string | null;
}

export const FIRST_PLAN_SCENARIOS: FirstPlanScenario[] = [
  {
    key: "hreyfing", title: "Byrja að hreyfa mig",
    line: "Dagleg ganga, minni kyrrseta og stuttar æfingar heima.",
    template: "kyrrseta", pillars: ["exercise", "mental"], extra: ["hreyfing-ganga"],
    exercise_key: "byrjandi-heima",
  },
  {
    key: "svefn", title: "Betri svefn",
    line: "Fastur fótaferðartími, rólegra kvöld og dagsbirta á morgnana.",
    template: "svefn-streita", pillars: ["sleep"], extra: ["svefn-dagsljos"],
  },
  {
    key: "naering", title: "Bæta mataræðið",
    line: "Einföld skref í hverri máltíð, án boða og banna.",
    template: "almennt", pillars: ["nutrition"], extra: ["naering-sykradir-drykkir", "naering-trefjar"],
    nutrition_key: "jafnvaegi",
  },
  {
    key: "streita", title: "Minni streita",
    line: "Öndunaræfingar, útivera og skýrari mörk í vinnunni.",
    template: "svefn-streita", pillars: ["mental"], extra: ["andlegt-utivera"],
  },
  {
    key: "styrkur", title: "Styrkur og þol",
    line: "Æfingaáætlun sem lagar sig að þér, með próteini og svefni.",
    template: "hiit-styrkur", pillars: ["exercise", "nutrition", "sleep"],
    exercise_key: "hiit-styrkur",
  },
  {
    key: "safn", title: "Velja úr safninu",
    line: "Byrjaðu á auðu blaði og veldu venjurnar úr öllu safninu.",
    template: null,
  },
];

export interface ResolvedScenario {
  key: string;
  title: string;
  line: string;
  module_keys: string[];
  exercise_key: string | null;
  nutrition_key: string | null;
  lecture_slugs: string[];
}

/** Scenarios with their actions looked up; only keys the person may pick survive. */
export function resolveScenarios(
  templates: { key: string; module_keys: string[] | null; lecture_slugs?: string[] | null }[],
  modules: { key: string; pillar: Pillar }[],
  exerciseKeys: Set<string>,
  nutritionKeys: Set<string>,
  lectureSlugs: Set<string>,
): ResolvedScenario[] {
  const byKey = new Map(modules.map((m) => [m.key, m]));
  return FIRST_PLAN_SCENARIOS.map((s) => {
    const t = s.template ? templates.find((x) => x.key === s.template) : undefined;
    const fromTemplate = (t?.module_keys ?? []).filter((k) => {
      const m = byKey.get(k);
      return !!m && (!s.pillars || s.pillars.includes(m.pillar));
    });
    const keys = [...new Set([...fromTemplate, ...(s.extra ?? []).filter((k) => byKey.has(k))])].slice(0, 8);
    const lectures = (t?.lecture_slugs ?? []).filter((x) => lectureSlugs.has(x)).slice(0, 3);
    return {
      key: s.key, title: s.title, line: s.line, module_keys: keys,
      exercise_key: s.exercise_key && exerciseKeys.has(s.exercise_key) ? s.exercise_key : null,
      nutrition_key: s.nutrition_key && nutritionKeys.has(s.nutrition_key) ? s.nutrition_key : null,
      lecture_slugs: lectures,
    };
  });
}
