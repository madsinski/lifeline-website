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
      if (all.every(Boolean)) return all.filter((x): x is string => !!x).sort().at(-1)!;
      // The participant brought their own report in: the tests are behind them.
      return j.own_report_at ?? null;
    }
    // For the journey, the report is there once it is in; the doctor's
    // confirmation is tracked on its own (report_generated_at).
    case "report": return j.report_generated_at ?? j.report_imported_at ?? j.own_report_at ?? null;
    case "interview": return j.interview_done_at;
    case "plan": return j.plan_published_at;
    case "followup": return j.followup_done_at;
    case "reevaluation": return j.completed_at;
  }
}

/**
 * The coaching-only track.
 *
 * Somebody who wants the coaching and not the workup used to reach the
 * package step and stop, holding an app whose surfaces all wanted a report
 * they were never going to have. These four steps are the honest version of
 * what that person does: make an account, tell us who they are, watch the
 * introduction, and build a plan from the library themselves.
 *
 * The plan step is the same step — /api/hc/my-plan already lets a
 * participant assemble and publish their own, and only loses the
 * report-derived suggestions. Æfingar and Næring read hc_training_settings
 * and the meal library rather than the report, so they work on day one.
 *
 * followup and reevaluation are left out: both are health-check concepts
 * (three months after what? a year after which measurements?). Adding the
 * check later is a track change, not a new journey, so habits and history
 * survive it.
 */
const COACH_TRACK: StepKey[] = ["account", "profile", "welcome", "plan"];

/**
 * The app on your own.
 *
 * The same four steps minus the person. Somebody who chose to set their own
 * programme up has no coach to be introduced to, and a step promising one
 * would be a step that never completes.
 */
const APP_TRACK: StepKey[] = ["account", "profile", "welcome", "plan"];

/** Which steps this journey actually has. */
export function trackSteps(entry: HcJourney["entry"]): StepKey[] | null {
  if (entry === "coach") return COACH_TRACK;
  if (entry === "app") return APP_TRACK;
  return null;
}

/** Whether a coach is part of what this journey is. */
export function hasCoach(entry: HcJourney["entry"]): boolean {
  return entry !== "app";
}

export function journeySteps(j: HcJourney, profileComplete: boolean): JourneyStep[] {
  const only = trackSteps(j.entry);
  let defs = only ? DEFS.filter((d) => only.includes(d.key)) : DEFS;
  /*
   * On the coaching track the plan is the participant's own work, so the
   * blurb cannot promise three months written by a nurse after an
   * interview that is not going to happen.
   */
  if (only) {
    defs = defs.map((d) => (d.key === "plan"
      ? { ...d, title: "Áætlunin þín", blurb: "Veldu aðgerðir og æfingar úr safninu. Þú getur breytt þeim hvenær sem er." }
      : d));
  }
  const steps = defs.map((d) => ({ ...d, doneAt: doneAtFor(d.key, j, profileComplete), state: "upcoming" as StepState }));
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
  // A client created from a dropped-in report (or booked by staff) has
  // clinical milestones before the customer-only steps are done. The
  // workstation works from the clinical side, so that wins; otherwise the
  // client sits in "profile" for ever and never reaches the to-do list.
  //
  // own_report_at is deliberately NOT one of those milestones.
  //
  // A person who uploads their own Medalia report is reading their own data.
  // That is the viewer relationship: the report lives in Medalia, this
  // account shows it to them. It is not a care relationship, nobody at
  // Lifeline has taken them on, and 9(2)(h) covers processing for care BY a
  // health professional — which has not started.
  //
  // Counting it here advanced such a person to "interview", and "interview"
  // is inside the vinnustöð queue filter. That put somebody who only looked
  // at their own results into a clinician's worklist, waiting for an
  // appointment they never booked and have not paid for. Wrong clinically,
  // wrong operationally, and the wrong story about what the relationship is.
  //
  // A clinician-side report (generated or imported by staff) still advances
  // the journey, because that one does mean somebody has taken them on.
  const reportIn = j.report_generated_at || j.report_imported_at;
  if (CUSTOMER_ONLY.has(current.key) && (reportIn || j.blood_results_at || j.measurements_done_at || j.interview_booked_for || j.plan_published_at)) {
    if (!(j.blood_test_done_at || j.blood_results_at) || !j.measurements_done_at) {
      if (!reportIn && !j.interview_booked_for && !j.plan_published_at) return "tests";
    }
    if (!reportIn && !j.plan_published_at) return "report";
    if (!j.interview_done_at && !j.plan_published_at) return "interview";
    if (!j.plan_published_at) return "plan";
    return "action";
  }
  return current.key;
}

const CUSTOMER_ONLY = new Set(["account", "profile", "welcome", "package"]);

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
