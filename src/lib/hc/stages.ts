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
  | "account" | "profile" | "welcome" | "package" | "protocol"
  | "blood" | "measurements" | "report" | "interview" | "plan"
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
  { key: "protocol", title: "Virkjaðu heilsufarsskoðunina", blurb: "Notaðu virkjunarkóðann þinn í sjúklingagáttinni." },
  { key: "blood", title: "Blóðprufa", blurb: "Á Heilsugæslunni. Bókað í sjúklingagáttinni." },
  { key: "measurements", title: "Mælingar", blurb: "Blóðþrýstingur og líkamssamsetning hjá samstarfsaðila." },
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
    case "protocol": return j.protocol_activated_at;
    case "blood": return j.blood_test_done_at ?? j.blood_results_at;
    case "measurements": return j.measurements_done_at;
    case "report": return j.report_generated_at;
    case "interview": return j.interview_done_at;
    case "plan": return j.plan_published_at;
    case "followup": return j.followup_done_at;
    case "reevaluation": return j.completed_at;
  }
}

export function journeySteps(j: HcJourney, profileComplete: boolean): JourneyStep[] {
  const steps = DEFS.map((d) => ({ ...d, doneAt: doneAtFor(d.key, j, profileComplete), state: "upcoming" as StepState }));
  // Blood test and measurements run in parallel: both are "current" once the
  // protocol is active. Everything else is strictly sequential.
  let foundCurrent = false;
  for (const s of steps) {
    if (s.doneAt) { s.state = "done"; continue; }
    if (s.optional) { s.state = foundCurrent ? "upcoming" : "optional"; continue; }
    if (!foundCurrent) { s.state = "current"; foundCurrent = true; continue; }
    if (s.key === "measurements" && steps.find((x) => x.key === "blood")?.state === "current") {
      s.state = "current";
    }
  }
  return steps;
}

/** Compact stage name stored on the journey row (for queues and filters). */
export function stageFor(j: HcJourney, profileComplete: boolean): string {
  if (j.cancelled_at) return "cancelled";
  if (j.completed_at) return "completed";
  const current = journeySteps(j, profileComplete).find((s) => s.state === "current");
  if (!current) return j.plan_published_at ? "action" : "completed";
  if (current.key === "blood" || current.key === "measurements") return "tests";
  return current.key;
}

export const STAGE_LABELS: Record<string, string> = {
  account: "Aðgangur",
  profile: "Upplýsingar",
  welcome: "Móttaka",
  package: "Greiðsla",
  protocol: "Virkjun",
  tests: "Blóðprufa og mælingar",
  report: "Bíður skýrslu",
  interview: "Bíður viðtals",
  plan: "Bíður áætlunar",
  action: "Í aðgerð",
  completed: "Lokið",
  cancelled: "Hætt við",
};
