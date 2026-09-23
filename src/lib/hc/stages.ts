// The journey's step engine. Client-safe and pure: given a journey row (and
// whether the profile is complete), it says which steps are done and which
// one is next. The server stores the result in hc_journeys.stage for the
// workstation queues; the account page renders the same list.
//
// Nothing here is advanced by an admin. Each step's "done" comes from the
// customer (profile, welcome, checkout), the patient-portal partner API
// (activation, blood test, results, measurements) or the workstation
// (report, interview, plan).

import type { HcJourney } from "./types";

export type StepKey =
  | "account" | "profile" | "welcome" | "package"
  // Activation, measurements and the blood draw are one step: they are all
  // done off the back of the same code, in the same week, and splitting them
  // into three made a customer think they were three separate errands.
  | "tests"
  | "report" | "interview" | "plan"
  | "followup" | "reevaluation";

export type StepState = "done" | "current" | "upcoming" | "optional";

export interface JourneyStep {
  key: StepKey;
  title: string;
  blurb: string;
  state: StepState;
  doneAt: string | null;
  optional?: boolean;
}

const DEFS: { key: StepKey; title: string; blurb: string; optional?: boolean }[] = [
  { key: "account", title: "Frír aðgangur", blurb: "Þú hefur tekið fyrsta skrefið." },
  { key: "profile", title: "Upplýsingar um þig", blurb: "Kennitala, sími og heimilisfang. Þú getur líka sett upp PIN og tengt dagatal." },
  { key: "welcome", title: "Móttökufyrirlestur", blurb: "Stutt kynning á ferlinu og fjórum stoðum heilsu." },
  { key: "package", title: "Pakki og greiðsla", blurb: "Veldu pakka. Stéttarfélag eða vinnuveitandi getur tekið þátt í kostnaði." },
  { key: "tests", title: "Heilsufarsskoðunin", blurb: "Virkjaðu í sjúklingagáttinni, bókaðu mælingar og farðu fastandi í blóðprufu." },
  { key: "report", title: "Skýrslan þín", blurb: "Læknir Lifeline staðfestir skýrsluna þegar niðurstöður liggja fyrir." },
  { key: "interview", title: "Viðtal", blurb: "Þú og hjúkrunarfræðingur farið yfir niðurstöðurnar og gerið áætlun." },
  { key: "plan", title: "Aðgerðaáætlun", blurb: "Áætlunin þín til næstu þriggja mánaða." },
  { key: "followup", title: "Eftirfylgd eftir 3 mánuði", blurb: "Ráðlögð en valfrjáls.", optional: true },
  { key: "reevaluation", title: "Endurmat eftir ár", blurb: "Eða aukaviðtal við hjúkrunarfræðing.", optional: true },
];

function doneAtFor(key: StepKey, j: HcJourney, profileComplete: boolean): string | null {
  switch (key) {
    case "account": return j.created_at;
    case "profile": return profileComplete ? (j.profile_completed_at ?? j.created_at) : null;
    case "welcome": return j.welcome_seen_at;
    case "package": return j.paid_at;
    // Done only when all three are: the code is redeemed, the measurements
    // are taken and the blood is drawn. The step's date is the last of them.
    case "tests": {
      const blood = j.blood_test_done_at ?? j.blood_results_at;
      const all = [j.protocol_activated_at, blood, j.measurements_done_at];
      return all.every(Boolean) ? all.filter((x): x is string => !!x).sort().at(-1)! : null;
    }
    case "report": return j.report_generated_at;
    case "interview": return j.interview_done_at;
    case "plan": return j.plan_published_at;
    case "followup": return j.followup_done_at;
    case "reevaluation": return j.completed_at;
  }
}

export function journeySteps(j: HcJourney, profileComplete: boolean): JourneyStep[] {
  const steps = DEFS.map((d) => ({ ...d, doneAt: doneAtFor(d.key, j, profileComplete), state: "upcoming" as StepState }));
  // Strictly sequential now that activation, measurements and the blood draw
  // are one step — the parallelism lives inside it instead.
  let foundCurrent = false;
  for (const s of steps) {
    if (s.doneAt) { s.state = "done"; continue; }
    if (s.optional) { s.state = foundCurrent ? "upcoming" : "optional"; continue; }
    if (!foundCurrent) { s.state = "current"; foundCurrent = true; }
  }
  return steps;
}

/**
 * The journey as a row of checkpoints.
 *
 * One definition for both sides: the customer's account and the nurse's
 * workstation used to build their own lists, so the same person had two
 * journeys with different names and different lengths. They share this now
 * and the nurse sees exactly what her client sees.
 *
 * Labels are short because a checkpoint is a word wide; the full titles live
 * on the step itself.
 */
export const STEP_SHORT: Record<StepKey, string> = {
  account: "Aðgangur",
  profile: "Upplýsingar",
  welcome: "Fyrirlestur",
  package: "Greiðsla",
  tests: "Heilsufarsskoðun",
  report: "Skýrsla",
  interview: "Viðtal",
  plan: "Áætlun",
  followup: "Eftirfylgd",
  reevaluation: "Endurmat",
};

const CP_MONTHS = ["jan.", "feb.", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "sept.", "okt.", "nóv.", "des."];

/** "20. sept." — written by hand; a browser without Icelandic prints "Sep 20". */
function shortDate(iso: string | null): string | null {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])}. ${CP_MONTHS[Number(m[2]) - 1]}` : null;
}

export interface JourneyCheckpoint {
  key: StepKey;
  label: string;
  state: "done" | "current" | "waiting" | "upcoming";
  detail: string | null;
}

export function journeyCheckpoints(steps: JourneyStep[]): JourneyCheckpoint[] {
  return steps.map((s) => ({
    key: s.key,
    label: STEP_SHORT[s.key] ?? s.title,
    // "optional" is not something anyone is waiting on, so it reads as ahead.
    state: s.state === "optional" ? "upcoming" : s.state,
    detail: s.doneAt ? shortDate(s.doneAt) : s.optional ? "valfrjálst" : null,
  }));
}

/**
 * The earliest the interview can be booked.
 *
 * The lab needs time to return the blood work, and an interview held before
 * the numbers are in is an interview held twice. Two clear days after the
 * later of the blood draw and the measurements.
 *
 * Returns null while either is still outstanding — there is nothing to count
 * from yet.
 */
export const INTERVIEW_WAIT_DAYS = 2;

export function interviewEligibleFrom(j: HcJourney): Date | null {
  const blood = j.blood_test_done_at ?? j.blood_results_at;
  if (!blood || !j.measurements_done_at) return null;
  const later = [blood, j.measurements_done_at].sort().at(-1)!;
  const d = new Date(later);
  d.setDate(d.getDate() + INTERVIEW_WAIT_DAYS);
  return d;
}

/** Compact stage name stored on the journey row (for queues and filters). */
export function stageFor(j: HcJourney, profileComplete: boolean): string {
  if (j.cancelled_at) return "cancelled";
  if (j.completed_at) return "completed";
  const current = journeySteps(j, profileComplete).find((s) => s.state === "current");
  if (!current) return j.plan_published_at ? "action" : "completed";
  return current.key;
}

export const STAGE_LABELS: Record<string, string> = {
  account: "Aðgangur",
  profile: "Upplýsingar",
  welcome: "Móttaka",
  package: "Greiðsla",
  tests: "Heilsufarsskoðun",
  report: "Bíður skýrslu",
  interview: "Bíður viðtals",
  plan: "Bíður áætlunar",
  action: "Í aðgerð",
  completed: "Lokið",
  cancelled: "Hætt við",
};
