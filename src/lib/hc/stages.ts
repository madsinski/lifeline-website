// The journey's step engine. Client-safe and pure: given a journey row (and
// whether the profile is complete), it says which steps are done and which
// one is next. The server stores the result in hc_journeys.stage for the
// workstation queues; the account page renders the same list.
//
// Nothing here is advanced by an admin. Each step's "done" comes from the
// customer (profile, welcome, checkout, activation, their own report upload)
// or the workstation (measurements, the doctor-interview tick, the
// Áætlunarsamtal, the plan).
//
// The Medalia split (Mads, 2026-10-16). Medalia is the sjúkraskrá and runs
// the clinical side; Lifeline runs the coaching side. The check-track order:
//
//   activation → measurements (booked with Lifeline)
//     → the report on file (the participant's own upload, or a nurse's
//       import that the participant allowed in the app)
//     → the doctor's interview in Medalia (doctor_interview_done_at, ticked)
//     → Áætlunarsamtal with Lifeline (the interview_* columns)
//     → plan → follow-up
//
// Blood-test and measurement flags are Medalia's information. They are shown
// when present but never hold the journey back: a report on file means the
// tests are behind the person.

import type { HcJourney } from "./types";

export type StepKey =
  | "account" | "profile" | "welcome" | "package"
  // Activation, measurements and the blood draw are one step: they are all
  // done off the back of the same code, in the same week, and splitting them
  // into three made a customer think they were three separate errands.
  | "tests"
  /** @deprecated merged into "report" (the report step IS the upload now). Kept so old switches compile. */
  | "upload"
  | "report"
  /** The doctor's interview in Medalia — Lifeline only records that it happened. */
  | "doctor"
  /** Lifeline's Áætlunarsamtal (plan session). The key stays "interview" for the columns behind it. */
  | "interview"
  | "plan"
  | "followup" | "reevaluation"
  // The app, which is a subscription and not part of the check's single fee.
  | "subscription";

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
  { key: "tests", title: "Virkjun og mælingar", blurb: "Virkjaðu heilsufarsskoðunina í sjúklingagáttinni (Medalia) og bókaðu mælingar hjá Lifeline." },
  /*
   * The report is the participant's own errand: fetch the Grunnheilsa PDF
   * from the sjúklingagátt and put it in. A nurse may do it for them, but
   * only once they have allowed it in the app (staff_import_consent_at).
   * Medalia releases the report; nobody at Lifeline "confirms" it.
   */
  { key: "report", title: "Skýrslan þín (úr sjúklingagáttinni)", blurb: "Sæktu Grunnheilsa-skýrsluna (PDF) í sjúklingagáttina og settu hana hér inn." },
  { key: "doctor", title: "Læknisviðtal", blurb: "Viðtal við lækni um niðurstöðurnar. Það er bókað og fer fram í sjúklingagáttinni (Medalia)." },
  { key: "interview", title: "Áætlunarsamtal", blurb: "Þú og hjúkrunarfræðingur Lifeline gerið áætlun út frá lífsstíl þínum og markmiðum." },
  { key: "plan", title: "Aðgerðaáætlun", blurb: "Áætlunin þín til næstu þriggja mánaða." },
  /*
   * Optional, and last, because it is a different purchase.
   *
   * The health check is one fee and the app is a monthly subscription. Put
   * in the middle of the journey it would read as another thing you must
   * buy before the next step unlocks, which is false — the check works
   * without it and it works without the check. Optional and at the end is
   * the honest position: offered, never in the way.
   */
  { key: "subscription", title: "Appið í símann", blurb: "Æfingar, næring og dagleg eftirfylgd. Mánaðarleg áskrift, óháð heilsufarsskoðuninni.", optional: true },
  { key: "followup", title: "Eftirfylgd eftir 3 mánuði", blurb: "Ráðlögð en valfrjáls.", optional: true },
  { key: "reevaluation", title: "Endurmat eftir ár", blurb: "Eða aukaviðtal við hjúkrunarfræðing.", optional: true },
];

/**
 * When a report came to be on file, by any allowed route: the participant's
 * own upload, a nurse's import with their consent, or (historic) one a
 * Lifeline doctor confirmed. Null when there is none.
 */
export function reportOnFile(j: Pick<HcJourney, "own_report_at" | "report_imported_at" | "report_generated_at">): string | null {
  return j.own_report_at ?? j.report_imported_at ?? j.report_generated_at ?? null;
}

/**
 * When the doctor's interview (in Medalia) was recorded as done.
 *
 * Journeys from before the split have no tick, but a later milestone means
 * it is behind them — historically the doctor's confirmation, the
 * Áætlunarsamtal or a published plan — so those count rather than leaving
 * an old journey stuck on a step that no longer exists for it.
 */
export function doctorInterviewDoneAt(j: HcJourney): string | null {
  return j.doctor_interview_done_at ?? j.report_generated_at ?? j.interview_done_at ?? j.plan_published_at ?? null;
}

/** Whether a nurse may put the report in for this participant. */
export function staffImportAllowed(j: Pick<HcJourney, "staff_import_consent_at">): boolean {
  return !!j.staff_import_consent_at;
}

function doneAtFor(key: StepKey, j: HcJourney, profileComplete: boolean, subscribed?: boolean): string | null {
  switch (key) {
    case "account": return j.created_at;
    case "profile": return profileComplete ? (j.profile_completed_at ?? j.created_at) : null;
    case "welcome": return j.welcome_seen_at;
    case "package": return j.paid_at;
    // Activation opens the step's work (measurements with Lifeline, the
    // blood draw in Medalia). The blood/measurement flags are information,
    // never a gate: activated is enough to move on to waiting for the
    // report, and a report on file means the tests are behind the person.
    case "tests": return j.protocol_activated_at ?? reportOnFile(j);
    case "upload":
    case "report": return reportOnFile(j);
    case "doctor": return doctorInterviewDoneAt(j);
    case "interview": return j.interview_done_at;
    case "plan": return j.plan_published_at;
    /*
     * Not a journey column: a subscription lives in its own table with its
     * own lifecycle, so the page passes in whether one is active. Undefined
     * means "not loaded yet", which must not read as "not subscribed".
     */
    case "subscription": return subscribed ? new Date().toISOString() : null;
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

export function journeySteps(j: HcJourney, profileComplete: boolean, subscribed?: boolean): JourneyStep[] {
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
  const steps = defs.map((d) => ({ ...d, doneAt: doneAtFor(d.key, j, profileComplete, subscribed), state: "upcoming" as StepState }));
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
  tests: "Virkjun",
  upload: "Skýrslan",
  subscription: "Appið",
  report: "Skýrslan",
  doctor: "Læknisviðtal",
  interview: "Áætlunarsamtal",
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
 * The earliest the Áætlunarsamtal (interview_* columns) should be booked.
 *
 * It comes after the doctor's interview in Medalia, because the plan is
 * built on what the doctor and the participant agreed. So: from the day the
 * doctor's interview is recorded as done. Null until then.
 *
 * INTERVIEW_WAIT_DAYS is 0 since the split — the lab wait it used to cover
 * is Medalia's now, before the doctor's interview. Kept as an export so
 * existing imports compile.
 */
export const INTERVIEW_WAIT_DAYS = 0;

export function interviewEligibleFrom(j: HcJourney): Date | null {
  const at = doctorInterviewDoneAt(j);
  return at ? new Date(at) : null;
}

/** Compact stage name stored on the journey row (for queues and filters). */
export function stageFor(j: HcJourney, profileComplete: boolean): string {
  if (j.cancelled_at) return "cancelled";
  if (j.completed_at) return "completed";
  const current = journeySteps(j, profileComplete).find((s) => s.state === "current");
  if (!current) return j.plan_published_at ? "action" : "completed";
  /*
   * A client a nurse has already started with (a report she put in with
   * their consent, measurements, a booked Áætlunarsamtal) can have those
   * before the customer-only steps are done. The workstation works from
   * that side, so it wins; otherwise the client sits in "profile" for ever
   * and never reaches the to-do list.
   *
   * own_report_at alone is deliberately NOT one of those milestones: a
   * person who uploads their own Medalia report without having bought the
   * check is a viewer of their own data, not somebody Lifeline has taken
   * on, and must not land in the vinnustöð queue. Once they have paid, the
   * ordinary step order carries them forward and the upload counts there.
   *
   * Blood-test flags are Medalia's and never decide the stage.
   */
  const staffStarted = j.report_generated_at || j.report_imported_at || j.measurements_done_at
    || j.doctor_interview_done_at || j.interview_booked_for || j.plan_published_at;
  if (CUSTOMER_ONLY.has(current.key) && staffStarted) {
    if (!reportOnFile(j) && !j.doctor_interview_done_at && !j.interview_booked_for && !j.plan_published_at) return "report";
    if (!doctorInterviewDoneAt(j) && !j.interview_booked_for) return "doctor";
    if (!j.interview_done_at && !j.plan_published_at) return "interview";
    if (!j.plan_published_at) return "plan";
    return "action";
  }
  // "upload" is not a stage of its own any more.
  return current.key === "upload" ? "report" : current.key;
}

const CUSTOMER_ONLY = new Set(["account", "profile", "welcome", "package"]);

export const STAGE_LABELS: Record<string, string> = {
  account: "Aðgangur",
  profile: "Upplýsingar",
  welcome: "Móttaka",
  package: "Greiðsla",
  tests: "Virkjun og mælingar",
  report: "Bíður skýrslu",
  doctor: "Bíður læknisviðtals (Medalia)",
  interview: "Bíður áætlunarsamtals",
  plan: "Bíður áætlunar",
  action: "Í aðgerð",
  completed: "Lokið",
  cancelled: "Hætt við",
};
